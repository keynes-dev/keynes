import { isDeepStrictEqual } from "node:util";

import { expect } from "vitest";

import {
  createKeynesClient,
  type KeynesClient,
} from "../../../packages/sdk/src/generated/client.js";
import type { CommandExecutor } from "../../../packages/sdk/src/command-executor.js";
import type { OperationName } from "../../../packages/sdk/src/generated/types.js";
import type { DatabaseInstallation } from "./migrations.js";
import {
  openInstalledPostgresDatabase,
  type PostgresDatabase,
} from "./postgres-database.js";
import {
  createDatabaseProcedureCaller,
  createTransactionProcedureCaller,
} from "./procedure-caller.js";
import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "../run.js";
import { openSqliteCommandExecutor } from "../../../packages/sdk/src/local/sqlite-command-executor.js";
import {
  CommittedResponseLostError,
  loseCommittedResponseOnce,
  type RollbackCheckpoint,
} from "./test-controls.js";

export const FIXTURE_TENANT_ID = "00000000-0000-4000-8000-000000000001";

export const FIXTURE_PRINCIPALS = {
  "definer-fixture": "00000000-0000-4000-8000-000000000101",
  "allocator-fixture": "00000000-0000-4000-8000-000000000102",
  "requester-fixture": "00000000-0000-4000-8000-000000000103",
  "settlement-fixture": "00000000-0000-4000-8000-000000000104",
  "reader-fixture": "00000000-0000-4000-8000-000000000105",
  "product-fixture": "00000000-0000-4000-8000-000000000106",
  "unauthorized-fixture": "00000000-0000-4000-8000-000000000107",
} as const;

export type FixturePrincipal = keyof typeof FIXTURE_PRINCIPALS;

export const FIXTURE_INSTALLATION = {
  tenantId: FIXTURE_TENANT_ID,
  principals: [
    {
      principalId: FIXTURE_PRINCIPALS["definer-fixture"],
      permissions: ["define_resource_type"],
    },
    {
      principalId: FIXTURE_PRINCIPALS["allocator-fixture"],
      permissions: ["create_root_budget"],
    },
    {
      principalId: FIXTURE_PRINCIPALS["requester-fixture"],
      permissions: ["request_budget"],
    },
    {
      principalId: FIXTURE_PRINCIPALS["settlement-fixture"],
      permissions: ["settle_budget"],
    },
    {
      principalId: FIXTURE_PRINCIPALS["reader-fixture"],
      permissions: ["read_budget"],
    },
    {
      principalId: FIXTURE_PRINCIPALS["product-fixture"],
      permissions: [
        "define_resource_type",
        "create_root_budget",
        "request_budget",
        "settle_budget",
        "read_budget",
      ],
    },
    {
      principalId: FIXTURE_PRINCIPALS["unauthorized-fixture"],
      permissions: [],
    },
  ],
} as const satisfies DatabaseInstallation;

export interface ClientFixtureOptions {
  readonly checkpoint?: RollbackCheckpoint;
  readonly dropResponseAfterCommitOnce?: boolean;
}

export interface TestKeynes {
  clientFor(
    fixture: FixturePrincipal,
    options?: ClientFixtureOptions,
  ): KeynesClient;
  close(): Promise<void>;
}

export interface KeynesCallerHost {
  callerFor(
    fixture: FixturePrincipal,
    options?: ClientFixtureOptions,
  ): CommandExecutor;
  close(): Promise<void>;
}

export interface NativeAttempt {
  readonly client: KeynesClient;
  readonly backendPid: number;
  commit(): Promise<void>;
}

export interface NativeTestKeynes extends TestKeynes {
  beginAttempt(fixture: FixturePrincipal): Promise<NativeAttempt>;
  requireBlockedBy(blockedPid: number, blockerPid: number): Promise<void>;
}

export async function openNativeTestKeynes(): Promise<NativeTestKeynes> {
  const owner = await openPostgresOwner(
    requirePostgresqlSystemAdministratorUrl(),
  );
  const application = await owner.createApplicationRole();
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
      const transaction = await owner.beginTransactionAs(
        application.role,
        application.password,
      );
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

interface PairedExecutorInput {
  readonly caseName: () => string;
  readonly sqlite: CommandExecutor;
  readonly postgres: CommandExecutor;
}

type SanitizedExecutorError =
  | { readonly kind: "rollback"; readonly checkpoint: RollbackCheckpoint }
  | { readonly kind: "lost-response" };

export class PairedCommandExecutor implements CommandExecutor {
  readonly #caseName: () => string;
  readonly #sqlite: CommandExecutor;
  readonly #postgres: CommandExecutor;

  constructor(input: PairedExecutorInput) {
    this.#caseName = input.caseName;
    this.#sqlite = input.sqlite;
    this.#postgres = input.postgres;
  }

  async execute(operation: OperationName, input: unknown): Promise<unknown> {
    const sqliteCall = Promise.resolve().then(() =>
      this.#sqlite.execute(operation, input),
    );
    const postgresCall = Promise.resolve().then(() =>
      this.#postgres.execute(operation, input),
    );
    const [sqlite, postgres] = await Promise.allSettled([
      sqliteCall,
      postgresCall,
    ]);

    if (sqlite.status === "fulfilled" && postgres.status === "fulfilled") {
      if (isDeepStrictEqual(sqlite.value, postgres.value)) {
        return sqlite.value;
      }
      throw pairedFailure(
        this.#caseName(),
        operation,
        "both",
        "result-mismatch",
      );
    }

    if (sqlite.status === "rejected" && postgres.status === "rejected") {
      const sqliteError = sanitizeExpectedError(sqlite.reason);
      const postgresError = sanitizeExpectedError(postgres.reason);
      if (
        sqliteError !== undefined &&
        isDeepStrictEqual(sqliteError, postgresError)
      ) {
        throw recreateSanitizedError(sqliteError);
      }
    }

    const host =
      sqlite.status === "rejected" && postgres.status === "fulfilled"
        ? "sqlite"
        : sqlite.status === "fulfilled" && postgres.status === "rejected"
          ? "postgres"
          : "both";
    throw pairedFailure(
      this.#caseName(),
      operation,
      host,
      "unexpected-failure",
    );
  }
}

export async function openTestKeynes(): Promise<TestKeynes> {
  const source = process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV];
  if (source === undefined) {
    return openSqliteTestKeynes();
  }

  const context = parsePostgresqlSystemContext(source);
  const opened = await Promise.allSettled([
    openSqliteCallerHost(),
    openPostgresCallerHost(context.administratorUrl, context.commandPath),
  ]);
  const [sqlite, postgres] = opened;
  if (sqlite.status === "rejected" || postgres.status === "rejected") {
    await Promise.allSettled(
      opened.flatMap((result) =>
        result.status === "fulfilled" ? [result.value.close()] : [],
      ),
    );
    throw new Error("PostgreSQL system-test host failed during open");
  }

  return pairedHost(sqlite.value, postgres.value);
}

export async function openSqliteCallerHost(): Promise<KeynesCallerHost> {
  let armedCheckpoint: RollbackCheckpoint | undefined;
  const executor = openSqliteCommandExecutor(
    FIXTURE_INSTALLATION,
    {
      tenantId: FIXTURE_TENANT_ID,
      principalId: FIXTURE_PRINCIPALS["product-fixture"],
    },
    (stage) => {
      if (stage === armedCheckpoint) {
        armedCheckpoint = undefined;
        throw new Error(`private rollback checkpoint: ${stage}`);
      }
    },
  );
  return {
    callerFor(fixture, options) {
      return loseCommittedResponseOnce(
        {
          async execute(operation, input) {
            armedCheckpoint = options?.checkpoint;
            try {
              return await executor.executeFor(
                {
                  tenantId: FIXTURE_TENANT_ID,
                  principalId: FIXTURE_PRINCIPALS[fixture],
                },
                operation,
                input,
              );
            } finally {
              armedCheckpoint = undefined;
            }
          },
        },
        options?.dropResponseAfterCommitOnce ?? false,
      );
    },
    close: async () => executor.close(),
  };
}

async function openSqliteTestKeynes(): Promise<TestKeynes> {
  const host = await openSqliteCallerHost();
  return {
    clientFor: (fixture, options) =>
      createKeynesClient(host.callerFor(fixture, options)),
    close: () => host.close(),
  };
}

async function openPostgresCallerHost(
  administratorUrl: string,
  commandPath: string,
): Promise<KeynesCallerHost> {
  const owner = await openPostgresOwner(administratorUrl, commandPath);
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
  commandPath = requirePostgresqlSystemCommandPath(),
): Promise<PostgresDatabase> {
  return openInstalledPostgresDatabase(
    administratorUrl,
    FIXTURE_INSTALLATION,
    commandPath,
  );
}

function pairedHost(
  sqlite: KeynesCallerHost,
  postgres: KeynesCallerHost,
): TestKeynes {
  let admittedOperations = Promise.resolve();
  return {
    clientFor(fixture: FixturePrincipal, options?: ClientFixtureOptions) {
      const paired = new PairedCommandExecutor({
        caseName: currentTestName,
        sqlite: sqlite.callerFor(fixture, options),
        postgres: postgres.callerFor(fixture, options),
      });
      return createKeynesClient({
        execute(operation, input) {
          const result = admittedOperations.then(() =>
            paired.execute(operation, input),
          );
          admittedOperations = result.then(
            () => undefined,
            () => undefined,
          );
          return result;
        },
      });
    },
    async close() {
      const closed = await Promise.allSettled([
        sqlite.close(),
        postgres.close(),
      ]);
      if (closed.some((result) => result.status === "rejected")) {
        throw new Error("PostgreSQL system-test host failed during cleanup");
      }
    },
  };
}

function currentTestName(): string {
  return expect.getState().currentTestName ?? "unknown test";
}

function sanitizeExpectedError(
  error: unknown,
): SanitizedExecutorError | undefined {
  if (error instanceof CommittedResponseLostError) {
    return { kind: "lost-response" };
  }
  if (!(error instanceof Error)) return undefined;

  switch (error.message) {
    case "private rollback checkpoint: after_command_binding":
      return { kind: "rollback", checkpoint: "after_command_binding" };
    case "private rollback checkpoint: after_domain_mutation":
      return { kind: "rollback", checkpoint: "after_domain_mutation" };
    case "private rollback checkpoint: after_result_storage":
      return { kind: "rollback", checkpoint: "after_result_storage" };
    case "private rollback checkpoint: after_history_insertion":
      return { kind: "rollback", checkpoint: "after_history_insertion" };
    default:
      return undefined;
  }
}

function recreateSanitizedError(error: SanitizedExecutorError): Error {
  return error.kind === "lost-response"
    ? new CommittedResponseLostError()
    : new Error(`private rollback checkpoint: ${error.checkpoint}`);
}

function pairedFailure(
  caseName: string,
  operation: OperationName,
  host: "sqlite" | "postgres" | "both",
  reason: "result-mismatch" | "unexpected-failure",
): Error {
  return new Error(
    `Paired command failed: case=${caseName}; operation=${operation}; host=${host}; reason=${reason}`,
  );
}

interface PostgresqlSystemContext {
  readonly administratorUrl: string;
  readonly commandPath: string;
}

export function requirePostgresqlSystemAdministratorUrl(): string {
  const source = process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV];
  if (source === undefined) {
    throw new Error(
      "Native PostgreSQL tests require the PostgreSQL system-test runner",
    );
  }
  return parsePostgresqlSystemContext(source).administratorUrl;
}

export function requirePostgresqlSystemCommandPath(): string {
  const source = process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV];
  if (source === undefined) {
    throw new Error(
      "Native PostgreSQL tests require the PostgreSQL system-test runner",
    );
  }
  return parsePostgresqlSystemContext(source).commandPath;
}

function parsePostgresqlSystemContext(source: string): PostgresqlSystemContext {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("Invalid runner-owned PostgreSQL system context");
  }
  if (
    !isRecord(value) ||
    typeof value.runId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.runId,
    ) ||
    typeof value.administratorUrl !== "string" ||
    typeof value.commandPath !== "string" ||
    value.commandPath === ""
  ) {
    throw new Error("Invalid runner-owned PostgreSQL system context");
  }

  let url: URL;
  try {
    url = new URL(value.administratorUrl);
  } catch {
    throw new Error("Invalid runner-owned PostgreSQL system context");
  }
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.username !== "postgres" ||
    url.password === "" ||
    url.port === "" ||
    url.pathname !== "/postgres"
  ) {
    throw new Error("Invalid runner-owned PostgreSQL system context");
  }
  return { administratorUrl: url.toString(), commandPath: value.commandPath };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
