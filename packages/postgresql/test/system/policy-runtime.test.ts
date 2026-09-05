import type { ExpressionNodeV1, PolicyResultRowV1 } from "@keynes/contracts";
import { POLICY_RUNTIME_TEST_CASES } from "@keynes/contracts/contract-tests";
import { afterEach, describe, expect, it } from "vitest";

import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "./run.js";
import {
  openInstalledPostgresDatabase,
  type PostgresDatabase,
  type PostgresTransaction,
} from "./support/postgres-database.js";
import {
  FIXTURE_INSTALLATION,
  requirePostgresqlSystemAdministratorUrl,
  requirePostgresqlSystemCommandPath,
} from "./support/test-keynes.js";

interface RenderedPolicy {
  readonly sql: string;
}

interface RenderedPolicySizes {
  readonly shallow_bytes: number;
  readonly deep_bytes: number;
}

interface PostgresqlPolicyRow {
  readonly resource: string;
  readonly ceiling: string | number;
  readonly reason: string;
}

if (process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined) {
  throw new Error(
    "Native tests require runner context; use a PostgreSQL deployment runner",
  );
}

describe("PostgreSQL Policy runtime behavior", () => {
  let fixture: PostgresDatabase | undefined;
  let transaction: PostgresTransaction | undefined;

  afterEach(async () => {
    await transaction?.close();
    transaction = undefined;
    await fixture?.close();
    fixture = undefined;
  });

  it("executes every shared runtime test program through the installed renderer", async () => {
    fixture = await openInstalledPostgresDatabase(
      requirePostgresqlSystemAdministratorUrl(),
      FIXTURE_INSTALLATION,
      requirePostgresqlSystemCommandPath(),
    );
    transaction = await fixture.beginTransaction();
    const ownerRole = await requirePolicyOwner(transaction);
    await transaction.connection.exec(
      `set local role "${ownerRole.replaceAll('"', '""')}"`,
    );

    for (const testCase of POLICY_RUNTIME_TEST_CASES) {
      const rendered = await transaction.connection.query<RenderedPolicy>(
        "select keynes_internal.render_policy_program($1::jsonb) as sql",
        [JSON.stringify(testCase.program)],
      );
      const sql = rendered.rows[0]?.sql;
      if (sql === undefined) {
        throw new Error(`PostgreSQL did not render ${testCase.name}`);
      }

      const parameters = [
        JSON.stringify(testCase.input.requested),
        JSON.stringify(testCase.input.available),
        JSON.stringify(testCase.input.context),
      ];

      if ("error" in testCase.expected) {
        await expect(
          transaction.connection.query<PostgresqlPolicyRow>(sql, parameters),
          testCase.name,
        ).rejects.toMatchObject({ code: "22003" });
        continue;
      }

      const result = await transaction.connection.query<PostgresqlPolicyRow>(
        sql,
        parameters,
      );

      expect(normalizePolicyRows(result.rows), testCase.name).toEqual(
        testCase.expected,
      );
    }
  });

  it("keeps nested boolean rendering linear", async () => {
    fixture = await openInstalledPostgresDatabase(
      requirePostgresqlSystemAdministratorUrl(),
      FIXTURE_INSTALLATION,
      requirePostgresqlSystemCommandPath(),
    );
    transaction = await fixture.beginTransaction();
    const ownerRole = await requirePolicyOwner(transaction);
    await transaction.connection.exec(
      `set local role "${ownerRole.replaceAll('"', '""')}"`,
    );

    const result = await transaction.connection.query<RenderedPolicySizes>(
      `select
           octet_length(keynes_internal.render_boolean_binary($1::jsonb))::integer as shallow_bytes,
           octet_length(keynes_internal.render_boolean_binary($2::jsonb))::integer as deep_bytes`,
      [
        JSON.stringify(alternatingBooleanExpression(6)),
        JSON.stringify(alternatingBooleanExpression(10)),
      ],
    );
    const sizes = result.rows[0];
    if (sizes === undefined) {
      throw new Error("PostgreSQL did not return rendered Policy sizes");
    }

    expect(sizes.deep_bytes).toBeLessThanOrEqual(sizes.shallow_bytes * 4);
  });
});

function alternatingBooleanExpression(depth: number): ExpressionNodeV1 {
  let expression: ExpressionNodeV1 = {
    kind: "boolean_literal",
    value: true,
    valueType: "boolean",
    nullable: false,
  };
  for (let index = 0; index < depth; index += 1) {
    expression = {
      kind: "boolean_binary",
      operator: index % 2 === 0 ? "and" : "or",
      left: {
        kind: "boolean_literal",
        value: index % 2 === 0,
        valueType: "boolean",
        nullable: false,
      },
      right: expression,
      valueType: "boolean",
      nullable: false,
    };
  }
  return expression;
}

async function requirePolicyOwner(
  transaction: PostgresTransaction,
): Promise<string> {
  const result = await transaction.connection.query<{
    readonly owner_role: string;
  }>(
    `select pg_get_userbyid(procedure.proowner) as owner_role
       from pg_proc procedure
       join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'keynes_internal'
        and procedure.proname = 'render_policy_program'`,
  );
  const ownerRole = result.rows[0]?.owner_role;
  if (ownerRole === undefined || !/^keynes_owner_[0-9a-f]+$/u.test(ownerRole)) {
    throw new Error("Installed Policy renderer has an unexpected owner");
  }
  return ownerRole;
}

function normalizePolicyRows(
  rows: readonly PostgresqlPolicyRow[],
): readonly PolicyResultRowV1[] {
  return rows.map(({ resource, ceiling: wireCeiling, reason }) => {
    const ceiling = Number(wireCeiling);
    if (!Number.isSafeInteger(ceiling)) {
      throw new Error("PostgreSQL Policy renderer returned an unsafe ceiling");
    }
    return { resource, ceiling, reason };
  });
}
