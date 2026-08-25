import { Pool } from "pg";

import type { AuthenticatedIdentity } from "./authentication.ts";
import {
  INSTALLATION_MIGRATIONS,
  type OperationName,
  PROCEDURES,
} from "./generated/procedures.ts";

export interface QueryRows {
  readonly rows: readonly unknown[];
}

export interface QueryablePoolClient {
  query(statement: string, parameters?: readonly unknown[]): Promise<QueryRows>;
  release(error?: Error | boolean): void;
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
  const migrationResult = await pool.query(
    `select migration_id, byte_checksum, contract_digest
       from keynes_internal.schema_migrations
      order by migration_id`,
  );
  if (migrationResult.rows.length !== INSTALLATION_MIGRATIONS.length) {
    throw new Error("Installed contract does not match Cloud contract");
  }
  for (const [index, expected] of INSTALLATION_MIGRATIONS.entries()) {
    const installed = requireRecord(migrationResult.rows[index]);
    if (
      installed?.migration_id !== expected.id ||
      installed.byte_checksum !== expected.byteChecksum ||
      installed.contract_digest !== expected.contractDigest
    ) {
      throw new Error("Installed contract does not match Cloud contract");
    }
  }

  for (const procedure of Object.values(PROCEDURES)) {
    const signature = `${procedure.target}(jsonb)`;
    const signatureResult = await pool.query(
      `select
         to_regprocedure($1) is not null as exists,
         pg_get_function_result(to_regprocedure($1)::oid) as returns,
         has_function_privilege(current_user, $1, 'EXECUTE') as can_execute,
         exists (
           select 1
             from pg_proc as candidate
             cross join lateral aclexplode(
               coalesce(candidate.proacl, acldefault('f', candidate.proowner))
             ) as privilege
            where candidate.oid = to_regprocedure($1)
              and privilege.grantee = 0
              and privilege.privilege_type = 'EXECUTE'
         ) as public_execute`,
      [signature],
    );
    const row = requireRecord(signatureResult.rows[0]);
    if (
      signatureResult.rows.length !== 1 ||
      row?.exists !== true ||
      row.returns !== "jsonb" ||
      row.can_execute !== true ||
      row.public_execute !== false
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
  let releaseError: Error | boolean | undefined;
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
    const classified = classifyUnavailable(error);
    if (classified instanceof DatabaseUnavailableError) {
      releaseError = releasableError(error);
      throw classified;
    }
    try {
      await client.query("rollback");
    } catch (rollbackError: unknown) {
      releaseError = releasableError(rollbackError);
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
    throw classified;
  } finally {
    client.release(releaseError);
  }
}

function releasableError(error: unknown): Error | boolean {
  return error instanceof Error ? error : true;
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
