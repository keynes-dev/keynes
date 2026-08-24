import { randomUUID } from "node:crypto";

import { Client, Pool, type PoolClient, type QueryResultRow } from "pg";

import type {
  DatabaseConnection,
  QueryRows,
  TransactionalDatabase,
} from "./database.js";
import { installDatabase, type InstallationFixtures } from "./migrations.js";

interface Queryable {
  query<Row extends QueryResultRow>(
    statement: string,
    parameters?: unknown[],
  ): Promise<{ readonly rows: Row[] }>;
}

class PgConnection implements DatabaseConnection {
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

class PgDatabase extends PgConnection implements TransactionalDatabase {
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
      const result = await operation(new PgConnection(client));
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

export interface OwnedPostgresDatabase {
  readonly database: TransactionalDatabase;
  beginTransaction(): Promise<PostgresTransaction>;
  requireBlockedBy(blockedPid: number, blockerPid: number): Promise<void>;
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
    this.connection = new PgConnection(client);
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

class PostgresDatabaseOwner implements OwnedPostgresDatabase {
  readonly database: TransactionalDatabase;
  readonly #pool: Pool;
  readonly #administratorUrl: string;
  readonly #databaseName: string;
  readonly #transactions = new Set<OwnedTransaction>();
  #closePromise: Promise<void> | undefined;

  constructor(pool: Pool, administratorUrl: string, databaseName: string) {
    this.#pool = pool;
    this.database = new PgDatabase(pool);
    this.#administratorUrl = administratorUrl;
    this.#databaseName = databaseName;
  }

  async beginTransaction(): Promise<PostgresTransaction> {
    if (this.#closePromise !== undefined) {
      throw new Error("The PostgreSQL test database is closing");
    }

    const client = await this.#pool.connect();
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

    const administrator = new Client({
      connectionString: this.#administratorUrl,
    });
    try {
      await administrator.connect();
      await administrator.query(
        `drop database if exists ${this.#databaseName} with (force)`,
      );
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
): Promise<OwnedPostgresDatabase> {
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
  return new PostgresDatabaseOwner(pool, administratorUrl, databaseName);
}

export async function openInstalledPostgresDatabase(
  administratorUrl: string,
  fixtures: InstallationFixtures,
): Promise<OwnedPostgresDatabase> {
  const database = await openPostgresDatabase(administratorUrl);
  try {
    await installDatabase(database.database, fixtures);
    return database;
  } catch (error: unknown) {
    await database.close();
    throw error;
  }
}
