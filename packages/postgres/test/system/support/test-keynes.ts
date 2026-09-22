import {
  createContractClient,
  type ContractClient,
  type ContractClientOptions,
  type ContractTestHost,
  type FixturePrincipal,
} from "@keynes/database/contract-tests";

import type { DatabaseInstallation } from "./migrations.js";
import {
  openInstalledPostgresDatabase,
  type PostgresDatabase,
  type FixtureInstallation,
  type TransactionIsolation,
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
  rollback(): Promise<void>;
}

export interface NativeTestKeynes extends ContractTestHost {
  beginAttempt(
    fixture: FixturePrincipal,
    options?: ContractClientOptions,
  ): Promise<NativeAttempt>;
  beginRepeatableReadAttempt(
    fixture: FixturePrincipal,
    options?: ContractClientOptions,
  ): Promise<NativeAttempt>;
  beginReadOnlyRepeatableReadAttempt(
    fixture: FixturePrincipal,
  ): Promise<NativeAttempt>;
  requireBlockedBy(blockedPid: number, blockerPid: number): Promise<void>;
}

export async function openPostgresqlContractTestHost(): Promise<ContractTestHost> {
  const owner = await openPostgresOwner();
  return postgresContractHost(owner);
}

export async function openNativeTestKeynes(): Promise<NativeTestKeynes> {
  const owner = await openPostgresOwner();
  const application = await owner.createApplicationRole();
  return {
    ...postgresContractHost(owner),
    beginAttempt(fixture, options) {
      return beginAttempt(
        owner,
        application,
        fixture,
        options,
        "read committed",
      );
    },
    beginRepeatableReadAttempt(fixture, options) {
      return beginAttempt(
        owner,
        application,
        fixture,
        options,
        "repeatable read",
      );
    },
    beginReadOnlyRepeatableReadAttempt(fixture) {
      return beginAttempt(
        owner,
        application,
        fixture,
        undefined,
        "repeatable read",
        true,
      );
    },
    requireBlockedBy: (blockedPid, blockerPid) =>
      owner.requireBlockedBy(blockedPid, blockerPid),
  };
}

async function beginAttempt(
  owner: PostgresDatabase,
  application: { readonly role: string; readonly password: string },
  fixture: FixturePrincipal,
  options: ContractClientOptions | undefined,
  isolation: TransactionIsolation,
  readOnly = false,
): Promise<NativeAttempt> {
  const transaction = await owner.beginTransactionAs(
    application.role,
    application.password,
    isolation,
  );
  if (readOnly) await transaction.connection.exec("set transaction read only");
  return {
    client: createContractClient(
      createTransactionProcedureCaller(
        transaction.connection,
        transactionContext(fixture, options),
      ),
    ),
    backendPid: transaction.backendPid,
    commit: () => transaction.commit(),
    rollback: () => transaction.rollback(),
  };
}

function postgresContractHost(owner: PostgresDatabase): ContractTestHost {
  return {
    async inspectJournal() {
      const { rows } = await owner.database.query<{
        readonly tenant_id: string;
        readonly root_budget_id: string;
        readonly command_id: string;
        readonly resource_type_id: string;
        readonly movement_id: string;
        readonly reason:
          | "initial_allocation"
          | "child_grant"
          | "consumption"
          | "settlement_return"
          | "root_release";
        readonly source_budget_id: string | null;
        readonly destination_budget_id: string | null;
        readonly amount: string;
      }>(`select tenant_id::text, root_budget_id::text, command_id::text,
                resource_type_id::text, movement_id::text, reason,
                source_budget_id::text, destination_budget_id::text, amount::text
           from keynes_internal.quantity_movements
          order by tenant_id, root_budget_id, command_id, movement_id`);
      return rows.map((row) => ({
        tenantId: row.tenant_id,
        rootBudgetId: row.root_budget_id,
        commandId: row.command_id,
        resourceTypeId: row.resource_type_id,
        movementId: row.movement_id,
        reason: row.reason,
        sourceBudgetId: row.source_budget_id,
        destinationBudgetId: row.destination_budget_id,
        amount: Number(row.amount),
      }));
    },
    async inspectState() {
      const { rows } = await owner.database.query<
        Awaited<ReturnType<ContractTestHost["inspectState"]>>
      >(`
        SELECT
          (SELECT count(*)::integer FROM keynes_internal.resource_types) AS resources,
          (SELECT count(*)::integer FROM keynes_internal.commands WHERE result IS NOT NULL) AS commands,
          (SELECT count(*)::integer FROM keynes_internal.budgets) AS budgets,
          (SELECT count(*)::integer FROM keynes_internal.budget_resources) AS holdings,
          (SELECT count(*)::integer FROM keynes_internal.budget_history_entries) AS history,
          (SELECT coalesce(sum(
             case when destination_budget_id is not null then amount else 0 end -
             case when source_budget_id is not null then amount else 0 end
           ), 0)::double precision FROM keynes_internal.quantity_movements) AS quantity
      `);
      const state = rows[0];
      if (state === undefined)
        throw new Error("Missing authority state counts");
      return state;
    },
    clientFor(fixture, options) {
      const caller = createDatabaseProcedureCaller(
        owner.database,
        transactionContext(fixture, options),
      );
      let arm = options?.forbidResourceWrites ?? false;
      return createContractClient({
        async execute(operation, input) {
          if (arm) {
            await owner.database
              .exec(`CREATE FUNCTION keynes_internal.forbid_resource_write_test()
              RETURNS trigger LANGUAGE plpgsql AS $test$
              BEGIN RAISE EXCEPTION 'private Resource write prohibition'; END;
              $test$;
              CREATE TRIGGER forbid_resource_write_test BEFORE INSERT OR UPDATE OR DELETE
              ON keynes_internal.resource_types FOR EACH STATEMENT
              EXECUTE FUNCTION keynes_internal.forbid_resource_write_test();`);
            arm = false;
          }
          return caller.execute(operation, input);
        },
      });
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

function openPostgresOwner(): Promise<PostgresDatabase> {
  const { administratorUrl, installation } = parsePostgresqlSystemContext(
    requirePostgresqlSystemContext(),
  );
  return openInstalledPostgresDatabase(
    administratorUrl,
    FIXTURE_INSTALLATION,
    installation,
  );
}

interface PostgresqlSystemContext {
  readonly administratorUrl: string;
  readonly installation: FixtureInstallation;
}

export function requirePostgresqlSystemAdministratorUrl(): string {
  return parsePostgresqlSystemContext(requirePostgresqlSystemContext())
    .administratorUrl;
}

export function requirePostgresqlSystemInstallation(): FixtureInstallation {
  return parsePostgresqlSystemContext(requirePostgresqlSystemContext())
    .installation;
}

export function requirePostgresqlSystemCli(): {
  readonly commandPath: string;
  readonly archivePath: string;
} {
  const source = requirePostgresqlSystemContext();
  parsePostgresqlSystemContext(source);
  const value: unknown = JSON.parse(source);
  if (
    !isRecord(value) ||
    value.scope !== "full" ||
    !isRecord(value.cli) ||
    typeof value.cli.commandPath !== "string" ||
    !value.cli.commandPath.startsWith("/") ||
    typeof value.cli.archivePath !== "string" ||
    !value.cli.archivePath.startsWith("/")
  )
    throw new Error(
      "Native CLI tests require a runner-owned exact CLI consumer",
    );
  return {
    commandPath: value.cli.commandPath,
    archivePath: value.cli.archivePath,
  };
}

export function requirePostgresqlSystemTlsRootCertificate(): string {
  const source = requirePostgresqlSystemContext();
  parsePostgresqlSystemContext(source);
  const value: unknown = JSON.parse(source);
  if (
    !isRecord(value) ||
    typeof value.tlsRootCertificate !== "string" ||
    !value.tlsRootCertificate.startsWith("/")
  ) {
    throw new Error("Invalid runner-owned PostgreSQL TLS root certificate");
  }
  return value.tlsRootCertificate;
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
    !isRecord(value.installation)
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
  const installation = value.installation;
  if (installation.kind === "source" && value.scope === "selected")
    return {
      administratorUrl: url.toString(),
      installation: { kind: "source" },
    };
  if (
    installation.kind === "packed" &&
    value.scope === "full" &&
    typeof installation.consumerRoot === "string" &&
    installation.consumerRoot !== ""
  )
    return {
      administratorUrl: url.toString(),
      installation: { kind: "packed", consumerRoot: installation.consumerRoot },
    };
  throw new Error("Invalid runner-owned PostgreSQL system context");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
