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
  }> {
    const role = `keynes_app_${randomUUID().replaceAll("-", "")}`;
    const password = randomUUID();
    await this.database.exec(
      `create role "${role}" login password '${password}'`,
    );
    await this.database.exec(`grant usage on schema keynes to "${role}"`);
    for (const functionName of [
      "define_resource_type",
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
    return { role, password };
  }

  async beginTransactionAs(
    role: string,
    password: string,
  ): Promise<PostgresTransaction> {
    const url = new URL(this.#databaseUrl);
    url.username = role;
    url.password = password;
    const pool = new Pool({ connectionString: url.toString() });
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

  async #close(): Promise<void> {
    const transactionResults = await Promise.allSettled(
      [...this.#transactions].map((transaction) => transaction.close()),
    );
    const transactionFailures = transactionResults
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    await this.#pool.end();
    await Promise.all([...this.#applicationPools].map((pool) => pool.end()));

    const administrator = new Client({
      connectionString: this.#administratorUrl,
    });
    try {
      await administrator.connect();
      await administrator.query(
        `drop database if exists ${this.#databaseName} with (force)`,
      );
      for (const role of this.#createdRoles) {
        await administrator.query(`drop role if exists "${role}"`);
      }
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

export async function openInstalledPostgresDatabase(
  administratorUrl: string,
  installation: DatabaseInstallation,
  commandPath: string,
): Promise<PostgresDatabase> {
  const suffix = randomUUID().replaceAll("-", "");
  const databaseName = `keynes_test_${suffix}`;
  const ownerRole = `keynes_owner_${suffix}`;
  const executionRole = `keynes_execution_${suffix}`;
  const administrationRole = `keynes_admin_${suffix}`;
  const applicationRole = `keynes_app_${suffix}`;
  const administrationPassword = randomUUID();
  const applicationPassword = randomUUID();
  const administrator = new Client({ connectionString: administratorUrl });
  await administrator.connect();
  try {
    await administrator.query(`create role "${ownerRole}" nologin`);
    await administrator.query(
      `create role "${executionRole}" nologin noinherit`,
    );
    await administrator.query(
      `create role "${administrationRole}" login noinherit password '${administrationPassword}'`,
    );
    await administrator.query(
      `create role "${applicationRole}" login noinherit password '${applicationPassword}'`,
    );
    await administrator.query(`create database "${databaseName}"`);
    const administratorRole = new URL(administratorUrl).username;
    await administrator.query(`grant "${ownerRole}" to "${administratorRole}"`);
    await administrator.query(
      `grant create on database "${databaseName}" to "${ownerRole}"`,
    );
    await administrator.query(
      `grant connect on database "${databaseName}" to "${administrationRole}", "${applicationRole}"`,
    );
  } catch (error: unknown) {
    await administrator.query(
      `drop database if exists "${databaseName}" with (force)`,
    );
    await administrator.query(`drop role if exists "${applicationRole}"`);
    await administrator.query(`drop role if exists "${administrationRole}"`);
    await administrator.query(`drop role if exists "${executionRole}"`);
    await administrator.query(`drop role if exists "${ownerRole}"`);
    throw error;
  } finally {
    await administrator.end();
  }

  const databaseUrl = new URL(administratorUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const database = new PostgresDatabase(
    new Pool({ connectionString: databaseUrl.toString() }),
    administratorUrl,
    databaseName,
    databaseUrl.toString(),
    [applicationRole, administrationRole, executionRole, ownerRole],
  );
  try {
    const principal = installation.principals.find(({ permissions }) =>
      BOOTSTRAP_PERMISSIONS.every((permission) =>
        permissions.includes(permission),
      ),
    );
    if (principal === undefined) {
      throw new Error(
        "PostgreSQL system fixture requires one bootstrap principal",
      );
    }
    const configurationRoot = await mkdtemp(
      join(tmpdir(), "keynes-postgresql-config-"),
    );
    try {
      const configPath = join(configurationRoot, "installation.json");
      await writeFile(
        configPath,
        `${JSON.stringify({ ownerRole, executionRole, administrationRole, applicationRole, tenantId: installation.tenantId, principalId: principal.principalId })}\n`,
      );
      const environment = postgresEnvironment(databaseUrl);
      requireInstallationOutcome(
        runPackedPostgresql(
          commandPath,
          ["install", "--config", configPath],
          environment,
        ),
        "installed",
      );
      requireInstallationOutcome(
        runPackedPostgresql(
          commandPath,
          ["install", "--config", configPath],
          environment,
        ),
        "already-installed",
      );
    } finally {
      await rm(configurationRoot, { recursive: true, force: true });
    }
    await installPrincipalPermissions(database.database, installation);
    return database;
  } catch (error: unknown) {
    await database.close();
    throw error;
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
