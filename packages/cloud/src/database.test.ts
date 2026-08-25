import { describe, expect, it } from "vitest";

import {
  DatabaseUnavailableError,
  openPostgresAuthority,
  type QueryablePool,
  type QueryablePoolClient,
} from "./database.ts";
import {
  INSTALLATION_MIGRATIONS,
  PROCEDURES,
} from "./generated/procedures.ts";

const identity = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  principalId: "00000000-0000-4000-8000-000000000101",
} as const;

interface RecordedQuery {
  readonly statement: string;
  readonly parameters: readonly unknown[] | undefined;
}

function result<Row>(rows: readonly Row[]): { readonly rows: readonly Row[] } {
  return { rows };
}

function installedMigrationRows(): readonly Record<string, unknown>[] {
  return INSTALLATION_MIGRATIONS.map((migration) => ({
    migration_id: migration.id,
    byte_checksum: migration.byteChecksum,
    contract_digest: migration.contractDigest,
  }));
}

function verifiedPool(
  options: {
    readonly invoke?: (
      statement: string,
      parameters: readonly unknown[] | undefined,
    ) => Promise<{ readonly rows: readonly unknown[] }>;
  } = {},
): {
  readonly pool: QueryablePool;
  readonly client: QueryablePoolClient;
  readonly poolQueries: RecordedQuery[];
  readonly clientQueries: RecordedQuery[];
  readonly releases: { count: number };
  readonly releaseErrors: (Error | boolean | undefined)[];
} {
  const poolQueries: RecordedQuery[] = [];
  const clientQueries: RecordedQuery[] = [];
  const releases = { count: 0 };
  const releaseErrors: (Error | boolean | undefined)[] = [];
  const client: QueryablePoolClient = {
    async query(statement, parameters) {
      clientQueries.push({ statement, parameters });
      if (
        options.invoke !== undefined &&
        statement.startsWith("select keynes.")
      ) {
        return options.invoke(statement, parameters);
      }
      return result([]);
    },
    release(error) {
      releases.count += 1;
      releaseErrors.push(error);
    },
  };
  const pool: QueryablePool = {
    async query(statement, parameters) {
      poolQueries.push({ statement, parameters });
      if (statement.includes("schema_migrations")) {
        return result(installedMigrationRows());
      }
      if (statement.includes("to_regprocedure")) {
        return result([
          {
            exists: true,
            returns: "jsonb",
            can_execute: true,
            public_execute: false,
          },
        ]);
      }
      throw new Error(`unexpected startup query: ${statement}`);
    },
    async connect() {
      return client;
    },
    async end() {},
  };
  return {
    pool,
    client,
    poolQueries,
    clientQueries,
    releases,
    releaseErrors,
  };
}

describe("PostgreSQL Cloud authority", () => {
  it("verifies the installed digest and every generated procedure", async () => {
    const fake = verifiedPool();

    const authority = await openPostgresAuthority(fake.pool);

    expect(fake.poolQueries[0]).toMatchObject({
      statement: expect.stringContaining("schema_migrations"),
    });
    expect(fake.poolQueries[0]?.statement).not.toContain("commands");
    const signatures = fake.poolQueries
      .filter(({ statement }) => statement.includes("to_regprocedure"))
      .map(({ parameters }) => parameters?.[0]);
    expect(signatures).toEqual(
      Object.values(PROCEDURES).map(({ target }) => `${target}(jsonb)`),
    );

    await authority.close();
  });

  it.each([
    ["missing", []],
    [
      "incompatible",
      installedMigrationRows().map((row, index) =>
        index === 2 ? { ...row, contract_digest: "f".repeat(64) } : row,
      ),
    ],
  ])("rejects a %s installed contract", async (_name, digestRows) => {
    const fake = verifiedPool();
    const pool: QueryablePool = {
      ...fake.pool,
      async query(statement, parameters) {
        if (statement.includes("schema_migrations")) return result(digestRows);
        return fake.pool.query(statement, parameters);
      },
    };

    await expect(openPostgresAuthority(pool)).rejects.toThrow(
      /installed contract/i,
    );
  });

  it("rejects an installed migration checksum mismatch", async () => {
    const fake = verifiedPool();
    const rows = installedMigrationRows().map((row, index) =>
      index === 0 ? { ...row, byte_checksum: "f".repeat(64) } : row,
    );

    await expect(
      openPostgresAuthority({
        ...fake.pool,
        async query(statement, parameters) {
          if (statement.includes("schema_migrations")) return result(rows);
          return fake.pool.query(statement, parameters);
        },
      }),
    ).rejects.toThrow(/installed contract/i);
  });

  it("rejects a missing or incompatible procedure signature", async () => {
    const fake = verifiedPool();
    let signatureChecks = 0;
    const pool: QueryablePool = {
      ...fake.pool,
      async query(statement, parameters) {
        if (statement.includes("to_regprocedure")) {
          signatureChecks += 1;
          return result([
            {
              exists: signatureChecks !== 2,
              returns: signatureChecks === 3 ? "text" : "jsonb",
              can_execute: true,
            },
          ]);
        }
        return fake.pool.query(statement, parameters);
      },
    };

    await expect(openPostgresAuthority(pool)).rejects.toThrow(
      /installed procedure/i,
    );
  });

  it("rejects a procedure executable by PUBLIC", async () => {
    const fake = verifiedPool();
    const pool: QueryablePool = {
      ...fake.pool,
      async query(statement, parameters) {
        if (statement.includes("to_regprocedure")) {
          return result([
            {
              exists: true,
              returns: "jsonb",
              can_execute: true,
              public_execute: true,
            },
          ]);
        }
        return fake.pool.query(statement, parameters);
      },
    };

    await expect(openPostgresAuthority(pool)).rejects.toThrow(
      /installed procedure/i,
    );
  });

  it("sets identity and commits one generated call before returning", async () => {
    const wire = { ok: true, result: { budgetId: "one" }, replayed: false };
    const fake = verifiedPool({
      invoke: async () => result([{ response: wire }]),
    });
    const authority = await openPostgresAuthority(fake.pool);

    await expect(
      authority.invoke({
        identity,
        operation: "getBudget",
        input: { budgetId: "20000000-0000-4000-8000-000000000001" },
      }),
    ).resolves.toEqual(wire);

    expect(fake.clientQueries).toEqual([
      { statement: "begin", parameters: undefined },
      {
        statement: expect.stringContaining("set_config('keynes.tenant_id'"),
        parameters: [identity.tenantId, identity.principalId],
      },
      {
        statement: PROCEDURES.getBudget.statement,
        parameters: [
          JSON.stringify({
            budgetId: "20000000-0000-4000-8000-000000000001",
          }),
        ],
      },
      { statement: "commit", parameters: undefined },
    ]);
    expect(fake.releases.count).toBe(1);
  });

  it("destroys an unavailable connection and never retries a failed call", async () => {
    const unavailable = Object.assign(new Error("socket closed: password"), {
      code: "ECONNRESET",
    });
    let calls = 0;
    const fake = verifiedPool({
      async invoke() {
        calls += 1;
        throw unavailable;
      },
    });
    const authority = await openPostgresAuthority(fake.pool);

    await expect(
      authority.invoke({ identity, operation: "createBudget", input: {} }),
    ).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(calls).toBe(1);
    expect(fake.clientQueries).not.toContainEqual({
      statement: "rollback",
      parameters: undefined,
    });
    expect(fake.releases.count).toBe(1);
    expect(fake.releaseErrors[0]).toBe(unavailable);
  });

  it("classifies the pg query timeout used for a paused authority", async () => {
    const fake = verifiedPool({
      async invoke() {
        throw new Error("Query read timeout");
      },
    });
    const authority = await openPostgresAuthority(fake.pool);

    await expect(
      authority.invoke({ identity, operation: "getBudget", input: {} }),
    ).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(fake.releases.count).toBe(1);
    expect(fake.releaseErrors[0]).toBeInstanceOf(Error);
  });

  it("preserves unavailable classification when rollback also times out", async () => {
    const procedureFailure = new Error("procedure failed");
    const rollbackTimeout = new Error("Query read timeout");
    const fake = verifiedPool({
      async invoke() {
        throw procedureFailure;
      },
    });
    const client: QueryablePoolClient = {
      ...fake.client,
      async query(statement, parameters) {
        if (statement === "rollback") throw rollbackTimeout;
        return fake.client.query(statement, parameters);
      },
    };
    const authority = await openPostgresAuthority({
      ...fake.pool,
      async connect() {
        return client;
      },
    });

    await expect(
      authority.invoke({ identity, operation: "getBudget", input: {} }),
    ).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(fake.releases.count).toBe(1);
    expect(fake.releaseErrors[0]).toBe(rollbackTimeout);
  });

  it("rolls back and releases on invalid result row cardinality", async () => {
    const fake = verifiedPool({ invoke: async () => result([]) });
    const authority = await openPostgresAuthority(fake.pool);

    await expect(
      authority.invoke({ identity, operation: "getBudget", input: {} }),
    ).rejects.toThrow(/returned 0 rows/i);
    expect(fake.clientQueries.at(-1)).toEqual({
      statement: "rollback",
      parameters: undefined,
    });
    expect(fake.releases.count).toBe(1);
  });

  it("combines the original and rollback failures without leaking success", async () => {
    const fake = verifiedPool({
      invoke: async () => {
        throw new Error("procedure failed");
      },
    });
    const client: QueryablePoolClient = {
      ...fake.client,
      async query(statement, parameters) {
        if (statement === "rollback") throw new Error("rollback failed");
        return fake.client.query(statement, parameters);
      },
    };
    const pool: QueryablePool = {
      ...fake.pool,
      async connect() {
        return client;
      },
    };
    const authority = await openPostgresAuthority(pool);

    await expect(
      authority.invoke({ identity, operation: "settleBudget", input: {} }),
    ).rejects.toBeInstanceOf(AggregateError);
    expect(fake.releases.count).toBe(1);
    expect(fake.releaseErrors[0]).toBeInstanceOf(Error);
  });

  it("does not query private Budget authority tables", async () => {
    const fake = verifiedPool({
      invoke: async () => result([{ response: { ok: true } }]),
    });
    const authority = await openPostgresAuthority(fake.pool);

    await authority.invoke({ identity, operation: "getBudget", input: {} });

    const statements = [...fake.poolQueries, ...fake.clientQueries]
      .map(({ statement }) => statement)
      .join("\n");
    expect(statements).not.toMatch(
      /keynes_internal\.(commands|budgets|budget_resources|budget_history|resource_types)/,
    );
  });
});
