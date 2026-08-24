import { isDeepStrictEqual } from "node:util";

import { expect } from "vitest";

import {
  createKeynesClient,
  type InstalledTarget,
  type KeynesClient,
  type ProcedureCaller,
} from "../generated/client.js";
import {
  FIXTURE_PRINCIPALS,
  FIXTURE_TENANT_ID,
  openLocalKeynes,
  openLocalKeynesCallerHost,
  type ClientFixtureOptions,
  type FixturePrincipal,
  type KeynesCallerHost,
  type LocalKeynes,
} from "./local-keynes.js";
import {
  openInstalledPostgresDatabase,
  type OwnedPostgresDatabase,
} from "./postgres-keynes.js";
import {
  createDatabaseProcedureCaller,
  createTransactionProcedureCaller,
} from "./procedure-caller.js";
import { PLATFORM_CONTEXT_ENV } from "./run-platform-tests.js";

export type {
  ClientFixtureOptions,
  FixturePrincipal,
  LocalKeynes,
} from "./local-keynes.js";

export interface NativeAttempt {
  readonly client: KeynesClient;
  readonly backendPid: number;
  commit(): Promise<void>;
}

export interface NativeTestKeynes extends LocalKeynes {
  beginAttempt(fixture: FixturePrincipal): Promise<NativeAttempt>;
  requireBlockedBy(blockedPid: number, blockerPid: number): Promise<void>;
}

export async function openNativeTestKeynes(): Promise<NativeTestKeynes> {
  const owner = await openPostgresOwner(
    requiredPlatformContext().administratorUrl,
  );
  return {
    clientFor(fixture, options) {
      return createKeynesClient(
        createDatabaseProcedureCaller(owner.database, {
          tenantId: FIXTURE_TENANT_ID,
          principalId: FIXTURE_PRINCIPALS[fixture],
          checkpoint: options?.checkpoint,
          dropResponseAfterCommitOnce: options?.dropResponseAfterCommitOnce,
        }),
      );
    },
    async beginAttempt(fixture) {
      const transaction = await owner.beginTransaction();
      return {
        client: createKeynesClient(
          createTransactionProcedureCaller(transaction.connection, {
            tenantId: FIXTURE_TENANT_ID,
            principalId: FIXTURE_PRINCIPALS[fixture],
          }),
        ),
        backendPid: transaction.backendPid,
        commit: () => transaction.commit(),
      };
    },
    requireBlockedBy: (blockedPid, blockerPid) =>
      owner.requireBlockedBy(blockedPid, blockerPid),
    close: () => owner.close(),
  };
}

interface PairedCallerInput {
  readonly caseName: () => string;
  readonly pglite: ProcedureCaller;
  readonly postgresql: ProcedureCaller;
}

type DeclaredControl =
  | { readonly kind: "rollback"; readonly checkpoint: string }
  | { readonly kind: "lost-response" };

export class PairedProcedureCaller implements ProcedureCaller {
  readonly #caseName: () => string;
  readonly #pglite: ProcedureCaller;
  readonly #postgresql: ProcedureCaller;

  constructor(input: PairedCallerInput) {
    this.#caseName = input.caseName;
    this.#pglite = input.pglite;
    this.#postgresql = input.postgresql;
  }

  async call(target: InstalledTarget, input: unknown): Promise<unknown> {
    const pgliteCall = Promise.resolve().then(() =>
      this.#pglite.call(target, input),
    );
    const postgresqlCall = Promise.resolve().then(() =>
      this.#postgresql.call(target, input),
    );
    const [pglite, postgresql] = await Promise.allSettled([
      pgliteCall,
      postgresqlCall,
    ]);

    if (pglite.status === "fulfilled" && postgresql.status === "fulfilled") {
      if (isDeepStrictEqual(pglite.value, postgresql.value)) {
        return pglite.value;
      }
      throw pairedFailure(this.#caseName(), target, "both", "result-mismatch");
    }

    if (pglite.status === "rejected" && postgresql.status === "rejected") {
      const pgliteControl = declaredControl(pglite.reason);
      const postgresqlControl = declaredControl(postgresql.reason);
      if (
        pgliteControl !== undefined &&
        isDeepStrictEqual(pgliteControl, postgresqlControl)
      ) {
        throw controlError(pgliteControl);
      }
    }

    const host =
      pglite.status === "rejected" && postgresql.status === "fulfilled"
        ? "pglite"
        : pglite.status === "fulfilled" && postgresql.status === "rejected"
          ? "postgresql"
          : "both";
    throw pairedFailure(this.#caseName(), target, host, "unexpected-failure");
  }
}

export async function openTestKeynes(): Promise<LocalKeynes> {
  const source = process.env[PLATFORM_CONTEXT_ENV];
  if (source === undefined) {
    return openLocalKeynes();
  }

  const context = parsePlatformContext(source);
  const opened = await Promise.allSettled([
    openLocalKeynesCallerHost(),
    openPostgresCallerHost(context.administratorUrl),
  ]);
  const [pglite, postgresql] = opened;
  if (pglite.status === "rejected" || postgresql.status === "rejected") {
    await Promise.allSettled(
      opened.flatMap((result) =>
        result.status === "fulfilled" ? [result.value.close()] : [],
      ),
    );
    throw new Error("Platform test host failed during open");
  }

  return pairedHost(pglite.value, postgresql.value);
}

async function openPostgresCallerHost(
  administratorUrl: string,
): Promise<KeynesCallerHost> {
  const owner = await openPostgresOwner(administratorUrl);
  return {
    callerFor(fixture, options) {
      return createDatabaseProcedureCaller(owner.database, {
        tenantId: FIXTURE_TENANT_ID,
        principalId: FIXTURE_PRINCIPALS[fixture],
        checkpoint: options?.checkpoint,
        dropResponseAfterCommitOnce: options?.dropResponseAfterCommitOnce,
      });
    },
    close: () => owner.close(),
  };
}

function openPostgresOwner(
  administratorUrl: string,
): Promise<OwnedPostgresDatabase> {
  return openInstalledPostgresDatabase(administratorUrl, {
    tenantId: FIXTURE_TENANT_ID,
    principals: FIXTURE_PRINCIPALS,
  });
}

function pairedHost(
  pglite: KeynesCallerHost,
  postgresql: KeynesCallerHost,
): LocalKeynes {
  return {
    clientFor(fixture: FixturePrincipal, options?: ClientFixtureOptions) {
      return createKeynesClient(
        new PairedProcedureCaller({
          caseName: currentTestName,
          pglite: pglite.callerFor(fixture, options),
          postgresql: postgresql.callerFor(fixture, options),
        }),
      );
    },
    async close() {
      const closed = await Promise.allSettled([
        pglite.close(),
        postgresql.close(),
      ]);
      if (closed.some((result) => result.status === "rejected")) {
        throw new Error("Platform test host failed during cleanup");
      }
    },
  };
}

function currentTestName(): string {
  return expect.getState().currentTestName ?? "unknown test";
}

function declaredControl(error: unknown): DeclaredControl | undefined {
  if (!(error instanceof Error)) return undefined;
  if (
    error.message === "Simulated lost response after committed procedure call"
  ) {
    return { kind: "lost-response" };
  }

  const rollback =
    /^private rollback checkpoint: (after_(?:command_binding|domain_mutation|result_storage|history_insertion))$/.exec(
      error.message,
    );
  return rollback?.[1] === undefined
    ? undefined
    : { kind: "rollback", checkpoint: rollback[1] };
}

function controlError(control: DeclaredControl): Error {
  return control.kind === "lost-response"
    ? new Error("Simulated lost response after committed procedure call")
    : new Error(`private rollback checkpoint: ${control.checkpoint}`);
}

function pairedFailure(
  caseName: string,
  target: InstalledTarget,
  host: "pglite" | "postgresql" | "both",
  reason: "result-mismatch" | "unexpected-failure",
): Error {
  return new Error(
    `Paired call failed: case=${caseName}; target=${target}; host=${host}; reason=${reason}`,
  );
}

interface PlatformContext {
  readonly administratorUrl: string;
}

function requiredPlatformContext(): PlatformContext {
  const source = process.env[PLATFORM_CONTEXT_ENV];
  if (source === undefined) {
    throw new Error("Native PostgreSQL tests require the platform runner");
  }
  return parsePlatformContext(source);
}

function parsePlatformContext(source: string): PlatformContext {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("Invalid runner-owned platform context");
  }
  if (
    !isRecord(value) ||
    typeof value.runId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.runId,
    ) ||
    typeof value.administratorUrl !== "string"
  ) {
    throw new Error("Invalid runner-owned platform context");
  }

  let url: URL;
  try {
    url = new URL(value.administratorUrl);
  } catch {
    throw new Error("Invalid runner-owned platform context");
  }
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.username !== "postgres" ||
    url.password === "" ||
    url.port === "" ||
    url.pathname !== "/postgres"
  ) {
    throw new Error("Invalid runner-owned platform context");
  }
  return { administratorUrl: url.toString() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
