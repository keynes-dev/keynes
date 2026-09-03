import {
  createContractClient,
  type ContractClient,
  type ContractClientOptions,
  type ContractTestHost,
  type FixturePrincipal,
} from "@keynes/contracts/conformance";

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

export const FIXTURE_TENANT_ID = "00000000-0000-4000-8000-000000000001";

export const FIXTURE_PRINCIPALS = {
  "definer-fixture": "00000000-0000-4000-8000-000000000101",
  "allocator-fixture": "00000000-0000-4000-8000-000000000102",
  "root-fixture": "00000000-0000-4000-8000-000000000108",
  "requester-fixture": "00000000-0000-4000-8000-000000000103",
  "settlement-fixture": "00000000-0000-4000-8000-000000000104",
  "reader-fixture": "00000000-0000-4000-8000-000000000105",
  "product-fixture": "00000000-0000-4000-8000-000000000106",
  "unauthorized-fixture": "00000000-0000-4000-8000-000000000107",
} as const satisfies Record<FixturePrincipal, string>;

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
      principalId: FIXTURE_PRINCIPALS["root-fixture"],
      permissions: ["define_resource_type", "create_root_budget"],
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

export interface NativeAttempt {
  readonly client: ContractClient;
  readonly backendPid: number;
  commit(): Promise<void>;
}

export interface NativeTestKeynes extends ContractTestHost {
  beginAttempt(fixture: FixturePrincipal): Promise<NativeAttempt>;
  requireBlockedBy(blockedPid: number, blockerPid: number): Promise<void>;
}

export async function openPostgresqlContractTestHost(): Promise<ContractTestHost> {
  const context = parsePostgresqlSystemContext(
    requirePostgresqlSystemContext(),
  );
  const owner = await openPostgresOwner(
    context.administratorUrl,
    context.commandPath,
  );
  return postgresContractHost(owner);
}

export async function openNativeTestKeynes(): Promise<NativeTestKeynes> {
  const context = parsePostgresqlSystemContext(
    requirePostgresqlSystemContext(),
  );
  const owner = await openPostgresOwner(
    context.administratorUrl,
    context.commandPath,
  );
  const application = await owner.createApplicationRole();
  return {
    ...postgresContractHost(owner),
    async beginAttempt(fixture) {
      const transaction = await owner.beginTransactionAs(
        application.role,
        application.password,
      );
      return {
        client: createContractClient(
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
  };
}

function postgresContractHost(owner: PostgresDatabase): ContractTestHost {
  return {
    clientFor(fixture, options) {
      return createContractClient(
        createDatabaseProcedureCaller(
          owner.database,
          transactionContext(fixture, options),
        ),
      );
    },
    close: () => owner.close(),
  };
}

function transactionContext(
  fixture: FixturePrincipal,
  options: ContractClientOptions | undefined,
) {
  return {
    tenantId: FIXTURE_TENANT_ID,
    principalId: FIXTURE_PRINCIPALS[fixture],
    checkpoint: options?.checkpoint,
    dropResponseAfterCommitOnce: options?.dropResponseAfterCommitOnce,
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

interface PostgresqlSystemContext {
  readonly administratorUrl: string;
  readonly commandPath: string;
}

export function requirePostgresqlSystemAdministratorUrl(): string {
  return parsePostgresqlSystemContext(requirePostgresqlSystemContext())
    .administratorUrl;
}

export function requirePostgresqlSystemCommandPath(): string {
  return parsePostgresqlSystemContext(requirePostgresqlSystemContext())
    .commandPath;
}

function requirePostgresqlSystemContext(): string {
  const source = process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV];
  if (source === undefined) {
    throw new Error(
      "Native PostgreSQL tests require the PostgreSQL system-test runner",
    );
  }
  return source;
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
