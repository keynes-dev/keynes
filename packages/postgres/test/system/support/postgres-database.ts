import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client, Pool, type PoolClient, type QueryResultRow } from "pg";

import type {
  DatabaseConnection,
  QueryRows,
  TransactionalDatabase,
} from "./database.js";
import {
  installPrincipalPermissions,
  type DatabaseInstallation,
} from "./migrations.js";
import { install } from "../../../src/installer/install.js";
import type { InstallationConfig } from "../../../src/installer/config.js";
import { runPackedPostgresql } from "../../support/packed-package.js";

const BOOTSTRAP_PERMISSIONS = [
  "define_resource_type",
  "create_root_budget",
  "request_budget",
  "settle_budget",
  "read_budget",
] as const;

interface Queryable {
  query<Row extends QueryResultRow>(
    statement: string,
    parameters?: unknown[],
  ): Promise<{ readonly rows: Row[] }>;
}

class PostgresConnection implements DatabaseConnection {
  readonly #queryable: Queryable;

  constructor(queryable: Queryable) {
    this.#queryable = queryable;
  }

  async query<Row>(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<QueryRows<Row>> {
    const result = await this.#queryable.query<Row & QueryResultRow>(
      statement,
      parameters === undefined ? undefined : [...parameters],
    );
    return { rows: result.rows };
  }

  async exec(statement: string): Promise<void> {
    await this.#queryable.query(statement);
  }
}

class PostgresPoolDatabase
  extends PostgresConnection
  implements TransactionalDatabase
{
  readonly #pool: Pool;

  constructor(pool: Pool) {
    super(pool);
    this.#pool = pool;
  }

  async transaction<Result>(
    operation: (transaction: DatabaseConnection) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.#pool.connect();
    try {
      await client.query("begin");
      const result = await operation(new PostgresConnection(client));
      await client.query("commit");
      return result;
    } catch (error: unknown) {
      try {
        await client.query("rollback");
      } catch (rollbackError: unknown) {
        throw new AggregateError(
          [error, rollbackError],
          "PostgreSQL transaction and rollback failed",
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

export interface PostgresTransaction {
  readonly connection: DatabaseConnection;
  readonly backendPid: number;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): Promise<void>;
}

type TransactionState = "open" | "committed" | "rolled-back";

class OwnedTransaction implements PostgresTransaction {
  readonly connection: DatabaseConnection;
  readonly backendPid: number;
  readonly #client: PoolClient;
  readonly #onClose: (transaction: OwnedTransaction) => void;
  #state: TransactionState = "open";

  constructor(
    client: PoolClient,
    backendPid: number,
    onClose: (transaction: OwnedTransaction) => void,
  ) {
    this.#client = client;
    this.connection = new PostgresConnection(client);
    this.backendPid = backendPid;
    this.#onClose = onClose;
  }

  commit(): Promise<void> {
    return this.#finish("commit", "committed");
  }

  rollback(): Promise<void> {
    return this.#finish("rollback", "rolled-back");
  }

  async close(): Promise<void> {
    if (this.#state === "open") {
      await this.rollback();
    }
  }

  async #finish(
    statement: "commit" | "rollback",
    state: Exclude<TransactionState, "open">,
  ): Promise<void> {
    if (this.#state !== "open") {
      throw new Error(`PostgreSQL transaction is already ${this.#state}`);
    }

    try {
      await this.#client.query(statement);
      this.#state = state;
    } finally {
      this.#client.release();
      this.#onClose(this);
    }
  }
}

export class PostgresDatabase {
  readonly database: TransactionalDatabase;
  readonly #pool: Pool;
  readonly #administratorUrl: string;
  readonly #databaseName: string;
  readonly #databaseUrl: string;
  readonly #applicationPools = new Set<Pool>();
  readonly #clientEnds = new Set<Promise<void>>();
  readonly #createdRoles: Set<string>;
  readonly #transactions = new Set<OwnedTransaction>();
  #closePromise: Promise<void> | undefined;

  constructor(
    pool: Pool,
    administratorUrl: string,
    databaseName: string,
    databaseUrl: string,
    createdRoles: readonly string[] = [],
  ) {
    this.#pool = pool;
    this.#trackClients(pool);
    this.database = new PostgresPoolDatabase(pool);
    this.#administratorUrl = administratorUrl;
    this.#databaseName = databaseName;
    this.#databaseUrl = databaseUrl;
    this.#createdRoles = new Set(createdRoles);
  }

  async beginTransaction(): Promise<PostgresTransaction> {
    if (this.#closePromise !== undefined) {
      throw new Error("The PostgreSQL test database is closing");
    }

    return this.#beginTransaction(this.#pool);
  }

  async createApplicationRole(): Promise<{
    readonly role: string;
    readonly password: string;
    readonly connectionString: string;
  }> {
    const role = `keynes_app_${randomUUID().replaceAll("-", "")}`;
    const password = randomUUID();
    await this.database.exec(
      `create role "${role}" login password '${password}'`,
    );
    await this.database.exec(`grant usage on schema keynes to "${role}"`);
    for (const functionName of [
      "define_resource_type",
      "define_resources",
      "validate_resources",
      "create_budget",
      "request",
      "settle",
      "get_budget",
    ]) {
      await this.database.exec(
        `grant execute on function keynes.${functionName}(jsonb) to "${role}"`,
      );
    }
    this.#createdRoles.add(role);
    const url = new URL(this.#databaseUrl);
    url.username = role;
    url.password = password;
    return { role, password, connectionString: url.toString() };
  }

  async beginTransactionAs(
    role: string,
    password: string,
  ): Promise<PostgresTransaction> {
    const url = new URL(this.#databaseUrl);
    url.username = role;
    url.password = password;
    const pool = new Pool({ connectionString: url.toString() });
    this.#trackClients(pool);
    this.#applicationPools.add(pool);
    try {
      return await this.#beginTransaction(pool);
    } catch (error: unknown) {
      this.#applicationPools.delete(pool);
      await pool.end();
      throw error;
    }
  }

  async #beginTransaction(pool: Pool): Promise<PostgresTransaction> {
    const client = await pool.connect();
    try {
      await client.query("begin isolation level read committed");
      const result = await client.query<{ readonly backend_pid: number }>(
        "select pg_backend_pid() as backend_pid",
      );
      const backendPid = result.rows[0]?.backend_pid;
      if (backendPid === undefined) {
        throw new Error("PostgreSQL did not return a backend PID");
      }
      const transaction = new OwnedTransaction(client, backendPid, (closed) =>
        this.#transactions.delete(closed),
      );
      this.#transactions.add(transaction);
      return transaction;
    } catch (error: unknown) {
      client.release();
      throw error;
    }
  }

  async requireBlockedBy(
    blockedPid: number,
    blockerPid: number,
  ): Promise<void> {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const result = await this.database.query<{ readonly blocked: boolean }>(
        "select $2::int = any(pg_blocking_pids($1::int)) as blocked",
        [blockedPid, blockerPid],
      );
      if (result.rows[0]?.blocked === true) return;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
    }
    throw new Error(
      `PostgreSQL backend ${blockedPid} did not block behind ${blockerPid}`,
    );
  }

  close(): Promise<void> {
    return (this.#closePromise ??= this.#close());
  }

  #trackClients(pool: Pool): void {
    pool.on("connect", (client) => {
      const ended = new Promise<void>((resolve) => {
        client.once("end", () => resolve());
      });
      this.#clientEnds.add(ended);
      void ended.then(() => this.#clientEnds.delete(ended));
    });
  }

  async #close(): Promise<void> {
    const transactionResults = await Promise.allSettled(
      [...this.#transactions].map((transaction) => transaction.close()),
    );
    const transactionFailures = transactionResults
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    await this.#pool.end();
    await Promise.all([...this.#applicationPools].map((pool) => pool.end()));
    // Pool.end can resolve before its clients' sockets close.
    await Promise.all(this.#clientEnds);

    const administrator = new Client({
      connectionString: this.#administratorUrl,
    });
    try {
      await administrator.connect();
      await dropPostgresFixture(administrator, this.#databaseName, [
        ...this.#createdRoles,
      ]);
    } finally {
      await administrator.end();
    }

    if (transactionFailures.length > 0) {
      throw new AggregateError(
        transactionFailures,
        "Failed to close PostgreSQL test transactions",
      );
    }
  }
}

export async function openPostgresDatabase(
  administratorUrl: string,
): Promise<PostgresDatabase> {
  const databaseName = `keynes_test_${randomUUID().replaceAll("-", "")}`;
  const administrator = new Client({ connectionString: administratorUrl });
  try {
    await administrator.connect();
    await administrator.query(`create database ${databaseName}`);
  } finally {
    await administrator.end();
  }

  const databaseUrl = new URL(administratorUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const pool = new Pool({ connectionString: databaseUrl.toString() });
  return new PostgresDatabase(
    pool,
    administratorUrl,
    databaseName,
    databaseUrl.toString(),
  );
}

export type FixtureInstallation =
  | { readonly kind: "source" }
  | { readonly kind: "packed"; readonly commandPath: string };

export async function preparePostgresInstallation(
  administratorUrl: string,
  identity: Pick<InstallationConfig, "tenantId" | "principalId">,
  additionalLogins: readonly {
    readonly role: string;
    readonly password: string;
  }[] = [],
) {
  const suffix = randomUUID().replaceAll("-", "");
  const databaseName = `keynes_test_${suffix}`;
  const config: InstallationConfig = {
    ownerRole: `keynes_owner_${suffix}`,
    executionRole: `keynes_execution_${suffix}`,
    administrationRole: `keynes_admin_${suffix}`,
    applicationRole: `keynes_app_${suffix}`,
    ...identity,
  };
  const administrationPassword = randomUUID();
  const applicationPassword = randomUUID();
  const logins = [
    { role: config.administrationRole, password: administrationPassword },
    { role: config.applicationRole, password: applicationPassword },
    ...additionalLogins,
  ];
  const roles = [
    ...logins.map(({ role }) => role),
    config.executionRole,
    config.ownerRole,
  ];
  const administrator = new Client({ connectionString: administratorUrl });
  try {
    await administrator.connect();
    await administrator.query(`create role "${config.ownerRole}" nologin`);
    await administrator.query(
      `create role "${config.executionRole}" nologin noinherit`,
    );
    for (const { role, password } of logins)
      await administrator.query(
        `create role "${role}" login noinherit password '${password}'`,
      );
    await administrator.query(`create database "${databaseName}"`);
    await administrator.query(
      `grant "${config.ownerRole}" to "${new URL(administratorUrl).username}"`,
    );
    await administrator.query(
      `grant create on database "${databaseName}" to "${config.ownerRole}"`,
    );
    await administrator.query(
      `grant connect on database "${databaseName}" to ${logins.map(({ role }) => `"${role}"`).join(", ")}`,
    );
  } catch (error: unknown) {
    try {
      await dropPostgresFixture(administrator, databaseName, roles);
    } finally {
      await administrator.end();
    }
    throw error;
  }
  const databaseUrl = new URL(administratorUrl);
  databaseUrl.pathname = `/${databaseName}`;
  return {
    administrator,
    databaseName,
    databaseUrl: databaseUrl.toString(),
    config,
    administrationPassword,
    applicationPassword,
    roles,
  };
}

export async function dropPostgresFixture(
  administrator: Client,
  databaseName: string,
  roles: readonly string[],
): Promise<void> {
  await administrator.query(
    `drop database if exists "${databaseName}" with (force)`,
  );
  for (const role of roles)
    await administrator.query(`drop role if exists "${role}"`);
}

export async function openInstalledPostgresDatabase(
  administratorUrl: string,
  installation: DatabaseInstallation,
  execution: FixtureInstallation,
): Promise<PostgresDatabase> {
  const principal = installation.principals.find(({ permissions }) =>
    BOOTSTRAP_PERMISSIONS.every((permission) =>
      permissions.includes(permission),
    ),
  );
  if (principal === undefined)
    throw new Error(
      "PostgreSQL system fixture requires one bootstrap principal",
    );
  const prepared = await preparePostgresInstallation(administratorUrl, {
    tenantId: installation.tenantId,
    principalId: principal.principalId,
  });
  await prepared.administrator.end();
  const database = new PostgresDatabase(
    new Pool({ connectionString: prepared.databaseUrl }),
    administratorUrl,
    prepared.databaseName,
    prepared.databaseUrl,
    prepared.roles,
  );
  try {
    await installPostgresFixture(
      prepared.databaseUrl,
      prepared.config,
      execution,
      "installed",
    );
    await installPrincipalPermissions(database.database, installation);
    return database;
  } catch (error: unknown) {
    await database.close();
    throw error;
  }
}

export async function installPostgresFixture(
  databaseUrl: string,
  config: InstallationConfig,
  execution: FixtureInstallation,
  outcome: "installed" | "already-installed",
): Promise<void> {
  if (execution.kind === "source") {
    const result = await install({ connectionString: databaseUrl, config });
    if (result.outcome !== outcome)
      throw new Error(`PostgreSQL installation did not report ${outcome}`);
    return;
  }
  const configurationRoot = await mkdtemp(
    join(tmpdir(), "keynes-postgresql-config-"),
  );
  try {
    const configPath = join(configurationRoot, "installation.json");
    await writeFile(configPath, `${JSON.stringify(config)}\n`, { mode: 0o600 });
    requireInstallationOutcome(
      runPackedPostgresql(
        execution.commandPath,
        ["install", "--config", configPath],
        postgresEnvironment(new URL(databaseUrl)),
      ),
      outcome,
    );
  } finally {
    await rm(configurationRoot, { recursive: true, force: true });
  }
}

function postgresEnvironment(databaseUrl: URL): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGHOST: databaseUrl.hostname,
    PGPORT: databaseUrl.port || "5432",
    PGDATABASE: decodeURIComponent(databaseUrl.pathname.slice(1)),
    PGUSER: decodeURIComponent(databaseUrl.username),
    PGPASSWORD: decodeURIComponent(databaseUrl.password),
  };
}

function requireInstallationOutcome(
  result: ReturnType<typeof runPackedPostgresql>,
  outcome: "installed" | "already-installed",
): void {
  if (result.status !== 0) {
    throw new Error(`Packed PostgreSQL installation failed: ${result.stderr}`);
  }
  const value: unknown = JSON.parse(result.stdout);
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("outcome" in value) ||
    value.outcome !== outcome
  ) {
    throw new Error(`Packed PostgreSQL installation did not report ${outcome}`);
  }
}
