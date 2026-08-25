import { Pool } from "pg";

import type { AuthenticatedIdentity } from "./authentication.ts";
import {
  CONTRACT_DIGEST,
  type OperationName,
  PROCEDURES,
} from "./generated/procedures.ts";

export interface QueryRows {
  readonly rows: readonly unknown[];
}

export interface QueryablePoolClient {
  query(statement: string, parameters?: readonly unknown[]): Promise<QueryRows>;
  release(): void;
}

export interface QueryablePool {
  query(statement: string, parameters?: readonly unknown[]): Promise<QueryRows>;
  connect(): Promise<QueryablePoolClient>;
  end(): Promise<void>;
}

export interface AuthorityInvocation {
  readonly identity: AuthenticatedIdentity;
  readonly operation: OperationName;
  readonly input: unknown;
}

export interface PostgresAuthority {
  invoke(invocation: AuthorityInvocation): Promise<unknown>;
  close(): Promise<void>;
}

export class DatabaseUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Database unavailable", { cause });
    this.name = "DatabaseUnavailableError";
  }
}

export function connectPostgresAuthority(
  databaseUrl: string,
): Promise<PostgresAuthority> {
  return openPostgresAuthority(
    new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 1_000,
      query_timeout: 1_000,
    }),
  );
}

export async function openPostgresAuthority(
  pool: QueryablePool,
): Promise<PostgresAuthority> {
  try {
    await verifyInstalledContract(pool);
  } catch (error: unknown) {
    await pool.end().catch(() => undefined);
    throw classifyUnavailable(error);
  }

  let closePromise: Promise<void> | undefined;
  return {
    invoke: (invocation) => invoke(pool, invocation),
    close() {
      return (closePromise ??= pool.end());
    },
  };
}

async function verifyInstalledContract(pool: QueryablePool): Promise<void> {
  const digestResult = await pool.query(
    `select contract_digest
       from keynes_internal.schema_migrations
      where contract_digest is not null
      order by migration_id`,
  );
  const digestRow = requireRecord(digestResult.rows[0]);
  if (
    digestResult.rows.length !== 1 ||
    digestRow?.contract_digest !== CONTRACT_DIGEST
  ) {
    throw new Error("Installed contract does not match Cloud contract");
  }

  for (const procedure of Object.values(PROCEDURES)) {
    const signature = `${procedure.target}(jsonb)`;
    const signatureResult = await pool.query(
      `select
         to_regprocedure($1) is not null as exists,
         pg_get_function_result(to_regprocedure($1)::oid) as returns,
         has_function_privilege(current_user, $1, 'EXECUTE') as can_execute`,
      [signature],
    );
    const row = requireRecord(signatureResult.rows[0]);
    if (
      signatureResult.rows.length !== 1 ||
      row?.exists !== true ||
      row.returns !== "jsonb" ||
      row.can_execute !== true
    ) {
      throw new Error(`Installed procedure does not match ${signature}`);
    }
  }
}

async function invoke(
  pool: QueryablePool,
  invocation: AuthorityInvocation,
): Promise<unknown> {
  let client: QueryablePoolClient;
  try {
    client = await pool.connect();
  } catch (error: unknown) {
    throw classifyUnavailable(error);
  }

  try {
    await client.query("begin");
    await client.query(
      `select
         set_config('keynes.tenant_id', $1, true),
         set_config('keynes.principal_id', $2, true)`,
      [invocation.identity.tenantId, invocation.identity.principalId],
    );
    const serializedInput = JSON.stringify(invocation.input);
    if (serializedInput === undefined) {
      throw new TypeError("Procedure input must be JSON");
    }
    const result = await client.query(
      PROCEDURES[invocation.operation].statement,
      [serializedInput],
    );
    if (result.rows.length !== 1) {
      throw new Error(
        `Installed procedure returned ${result.rows.length} rows`,
      );
    }
    const row = requireRecord(result.rows[0]);
    if (row === undefined || !("response" in row)) {
      throw new Error("Installed procedure returned no response column");
    }
    const response =
      typeof row.response === "string"
        ? JSON.parse(row.response)
        : row.response;
    await client.query("commit");
    return response;
  } catch (error: unknown) {
    try {
      await client.query("rollback");
    } catch (rollbackError: unknown) {
      const aggregate = new AggregateError(
        [error, rollbackError],
        "PostgreSQL transaction and rollback failed",
      );
      if (
        classifyUnavailable(error) instanceof DatabaseUnavailableError ||
        classifyUnavailable(rollbackError) instanceof DatabaseUnavailableError
      ) {
        throw new DatabaseUnavailableError(aggregate);
      }
      throw aggregate;
    }
    throw classifyUnavailable(error);
  } finally {
    client.release();
  }
}

function requireRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function classifyUnavailable(error: unknown): unknown {
  if (error instanceof Error && error.message === "Query read timeout") {
    return new DatabaseUnavailableError(error);
  }
  if (!isRecord(error) || typeof error.code !== "string") return error;
  if (
    error.code.startsWith("08") ||
    [
      "53300",
      "57P01",
      "57P02",
      "57P03",
      "ECONNREFUSED",
      "ECONNRESET",
      "EPIPE",
      "ETIMEDOUT",
    ].includes(error.code)
  ) {
    return new DatabaseUnavailableError(error);
  }
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
