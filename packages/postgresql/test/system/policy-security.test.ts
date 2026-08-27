import { createHash } from "node:crypto";

import {
  canonicalJson,
  POLICY_LIMITS_VERSION,
  POLICY_PROFILE_DIGEST,
  POLICY_PROGRAM_VERSION,
  POLICY_QUERY_PROFILE_VERSION,
  POLICY_VALIDATOR_VERSION,
  type PolicyDefinitionV1,
  type PolicyProgramV1,
} from "@keynes/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "./run.js";
import {
  openInstalledPostgresDatabase,
  type PostgresDatabase,
  type PostgresTransaction,
} from "./support/postgres-database.js";
import { callInstalledProcedure } from "./support/procedure-caller.js";
import {
  FIXTURE_INSTALLATION,
  FIXTURE_PRINCIPALS,
  FIXTURE_TENANT_ID,
  requirePostgresqlSystemAdministratorUrl,
  requirePostgresqlSystemCommandPath,
} from "./support/test-keynes.js";

const RESOURCE_ID = "12000000-0000-4000-8000-000000000001";
const ROOT_ID = "22000000-0000-4000-8000-000000000001";
const REQUEST_ID_PREFIX = "32000000-0000-4000-8000-";

interface SecurityFixture {
  readonly owner: PostgresDatabase;
  readonly application: { readonly role: string; readonly password: string };
}

describe.skipIf(process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined)(
  "PostgreSQL Policy security",
  () => {
    let fixture: SecurityFixture | undefined;

    afterEach(async () => {
      await fixture?.owner.close();
      fixture = undefined;
    });

    it("rejects a malformed durable program with a sanitized invalid_policy error and no state", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      const malformed = resealPolicy(basePolicy(), {
        ...baseProgram(),
        resource: { kind: "catalog_scan" },
      });

      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
        policies: [malformed],
      });

      expect(wire).toEqual({
        ok: false,
        error: {
          kind: "error",
          code: "invalid_policy",
          details: {
            operation: "createBudget",
            policyName: "request_limit",
            policyRevision: 1,
            path: "$.program.kind",
            rule: "enum",
          },
        },
      });
      await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
      expect(JSON.stringify(wire)).not.toContain("catalog_scan");
    });

    it("never executes submitted SQL bytes or parameter values", async () => {
      fixture = await openFixture();
      const policy = resealPolicy(basePolicy(), baseProgram(), {
        canonicalSql:
          "create table keynes_internal.submitted_sql_executed(value text)",
      });
      await seedGovernedRoot(fixture, policy);

      const wire = await committedCall(fixture, "requestBudget", {
        commandId: requestId(1),
        parentBudgetId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: 5 },
      });

      expect(wire).toMatchObject({ ok: true, result: { kind: "approved" } });
      const marker = await fixture.owner.database.query<{
        readonly present: boolean;
      }>(
        "select to_regclass('keynes_internal.submitted_sql_executed') is not null as present",
      );
      expect(marker.rows[0]?.present).toBe(false);
    });

    it("pins every security-definer search path to trusted schemas with pg_temp last", async () => {
      fixture = await openFixture();
      const functions = await fixture.owner.database.query<{
        readonly name: string;
        readonly search_path: string | null;
      }>(
        `select n.nspname || '.' || p.proname as name,
                (select cfg from unnest(p.proconfig) cfg where cfg like 'search_path=%') as search_path
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname in ('keynes', 'keynes_internal') and p.prosecdef
          order by name`,
      );

      expect(functions.rows.length).toBeGreaterThan(0);
      expect(functions.rows).toEqual(
        functions.rows.map(({ name }) => ({
          name,
          search_path: "search_path=pg_catalog, keynes_internal, pg_temp",
        })),
      );
    });

    it("prevents the application role from reading or invoking private Policy authority", async () => {
      fixture = await openFixture();
      const transaction = await beginApplicationAttempt(fixture);
      await expect(
        transaction.connection.query("select * from keynes_internal.budgets"),
      ).rejects.toThrow(/permission denied/u);
      await transaction.rollback();

      const second = await beginApplicationAttempt(fixture);
      await expect(
        second.connection.query(
          "select keynes_internal.validate_policy_program('{}'::jsonb)",
        ),
      ).rejects.toThrow(/permission denied/u);
      await second.rollback();
    });

    it("rejects invalid generated result rows with stable sanitized details and no mutation", async () => {
      fixture = await openFixture();
      const program = {
        ...baseProgram(),
        resource: textLiteral("undeclared_resource"),
      } satisfies PolicyProgramV1;
      await seedGovernedRoot(fixture, resealPolicy(basePolicy(), program));

      const wire = await committedCall(fixture, "requestBudget", {
        commandId: requestId(2),
        parentBudgetId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: 5 },
      });

      expectPolicyFailure(wire, "invalid_result");
      await expectRequestAbsent(fixture.owner, requestId(2));
      expect(JSON.stringify(wire)).not.toContain("undeclared_resource");
    });

    it("maps generated-query failure to stable sanitized details and rolls back", async () => {
      fixture = await openFixture();
      const program = {
        ...baseProgram(),
        ceiling: {
          kind: "binary_numeric",
          operator: "/",
          left: decimalLiteral("1"),
          right: decimalLiteral("0"),
          valueType: "numeric",
          nullable: false,
        },
      } satisfies PolicyProgramV1;
      await seedGovernedRoot(fixture, resealPolicy(basePolicy(), program));

      const wire = await committedCall(fixture, "requestBudget", {
        commandId: requestId(3),
        parentBudgetId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: 5 },
      });

      expectPolicyFailure(wire, "execution_failed");
      await expectRequestAbsent(fixture.owner, requestId(3));
      expect(JSON.stringify(wire)).not.toMatch(/division|zero|select|context/u);
    });

    it("rejects negative integer Policy context before evaluation and rolls back", async () => {
      fixture = await openFixture();
      await seedGovernedRoot(fixture, basePolicy());

      const wire = await committedCall(fixture, "requestBudget", {
        commandId: requestId(4),
        parentBudgetId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: -1 },
      });

      expect(wire).toEqual({
        ok: false,
        error: {
          kind: "error",
          code: "invalid_policy_context",
          details: {
            operation: "requestBudget",
            path: "$.context.request_ceiling",
            rule: "type",
          },
        },
      });
      await expectRequestAbsent(fixture.owner, requestId(4));
    });

    it.each([
      ["after_command_binding", 10],
      ["before_policy_evaluation", 11],
      ["after_policy_evaluation", 12],
      ["after_policy_evidence", 13],
      ["after_domain_mutation", 14],
      ["after_history_insertion", 15],
      ["after_result_storage", 16],
    ] as const)(
      "rolls back the complete governed command at %s",
      async (checkpoint, requestIndex) => {
        fixture = await openFixture();
        await seedGovernedRoot(fixture, basePolicy());
        const commandId = requestId(requestIndex);
        const transaction = await beginApplicationAttempt(fixture);
        await transaction.connection.query(
          `select
           set_config('keynes.tenant_id', $1, true),
           set_config('keynes.principal_id', $2, true),
           set_config('keynes.test_checkpoint', $3, true)`,
          [
            FIXTURE_TENANT_ID,
            FIXTURE_PRINCIPALS["product-fixture"],
            checkpoint,
          ],
        );

        await expect(
          transaction.connection.query("select keynes.request($1::jsonb)", [
            JSON.stringify({
              commandId,
              parentBudgetId: ROOT_ID,
              resources: [{ resourceTypeId: RESOURCE_ID, amount: 4 }],
              context: { request_ceiling: 5 },
            }),
          ]),
        ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);
        await transaction.rollback();

        await expectRequestAbsent(fixture.owner, commandId);
      },
    );
  },
);

async function openFixture(): Promise<SecurityFixture> {
  const owner = await openInstalledPostgresDatabase(
    requirePostgresqlSystemAdministratorUrl(),
    FIXTURE_INSTALLATION,
    requirePostgresqlSystemCommandPath(),
  );
  try {
    return { owner, application: await owner.createApplicationRole() };
  } catch (error: unknown) {
    await owner.close();
    throw error;
  }
}

async function defineResource(fixture: SecurityFixture): Promise<void> {
  const wire = await committedCall(fixture, "defineResource", {
    commandId: RESOURCE_ID,
    definition: {
      canonicalName: "model_tokens",
      unit: "token",
      accountingBehavior: "consumable",
    },
  });
  expect(wire).toMatchObject({ ok: true });
}

async function seedGovernedRoot(
  fixture: SecurityFixture,
  policy: Readonly<Record<string, unknown>> | PolicyDefinitionV1,
): Promise<void> {
  await defineResource(fixture);
  const wire = await committedCall(fixture, "createBudget", {
    commandId: ROOT_ID,
    resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
    policies: [policy],
  });
  expect(wire).toMatchObject({ ok: true, result: { kind: "created" } });
}

async function committedCall(
  fixture: SecurityFixture,
  operation: Parameters<typeof callInstalledProcedure>[2],
  input: unknown,
): Promise<unknown> {
  const transaction = await beginApplicationAttempt(fixture);
  try {
    const result = await callRaw(transaction, operation, input);
    await transaction.commit();
    return result;
  } catch (error: unknown) {
    await transaction.rollback();
    throw error;
  }
}

function beginApplicationAttempt(
  fixture: SecurityFixture,
): Promise<PostgresTransaction> {
  return fixture.owner.beginTransactionAs(
    fixture.application.role,
    fixture.application.password,
  );
}

function callRaw(
  transaction: PostgresTransaction,
  operation: Parameters<typeof callInstalledProcedure>[2],
  input: unknown,
): Promise<unknown> {
  return callInstalledProcedure(
    transaction.connection,
    {
      tenantId: FIXTURE_TENANT_ID,
      principalId: FIXTURE_PRINCIPALS["product-fixture"],
    },
    operation,
    JSON.stringify(input),
  );
}

async function expectNoCommandOrBudget(
  owner: PostgresDatabase,
  commandId: string,
): Promise<void> {
  const state = await owner.database.query<{
    readonly commands: number;
    readonly budgets: number;
  }>(
    `select
       (select count(*)::integer from keynes_internal.commands where command_id = $1) as commands,
       (select count(*)::integer from keynes_internal.budgets where budget_id = $1) as budgets`,
    [commandId],
  );
  expect(state.rows[0]).toEqual({ commands: 0, budgets: 0 });
}

async function expectRequestAbsent(
  owner: PostgresDatabase,
  commandId: string,
): Promise<void> {
  await expectNoCommandOrBudget(owner, commandId);
  const state = await owner.database.query<{
    readonly history_entries: number;
    readonly committed: number;
  }>(
    `select
       (select count(*)::integer from keynes_internal.budget_history_entries where command_id = $1) as history_entries,
       (select coalesce(sum(allocated_amount), 0)::integer from keynes_internal.budget_resources where budget_id = $1) as committed`,
    [commandId],
  );
  expect(state.rows[0]).toEqual({ history_entries: 0, committed: 0 });
}

function expectPolicyFailure(value: unknown, category: string): void {
  expect(value).toEqual({
    ok: false,
    error: {
      kind: "error",
      code: "policy_evaluation_failed",
      details: {
        operation: "requestBudget",
        policyName: "request_limit",
        policyRevision: 1,
        category,
      },
    },
  });
}

function basePolicy(): PolicyDefinitionV1 {
  const program = baseProgram();
  const document = {
    kind: "keynes.policy",
    name: "request_limit",
    revision: 1,
    inputResources: ["model_tokens"],
    outputResources: ["model_tokens"],
    contextSchema: [
      { name: "request_ceiling", type: "integer", nullable: false },
    ],
    reasons: ["request_limit"],
    programVersion: POLICY_PROGRAM_VERSION,
    queryProfileVersion: POLICY_QUERY_PROFILE_VERSION,
    validatorVersion: POLICY_VALIDATOR_VERSION,
    limitsVersion: POLICY_LIMITS_VERSION,
    policyProfileDigest: POLICY_PROFILE_DIGEST,
    program,
    canonicalSql: "generated fixture SQL",
    sourceDigest: digestText("generated fixture SQL"),
  } satisfies Omit<PolicyDefinitionV1, "definitionDigest">;
  return { ...document, definitionDigest: digestCanonical(document) };
}

function resealPolicy(
  policy: PolicyDefinitionV1,
  program: Readonly<Record<string, unknown>> | PolicyProgramV1,
  replacement: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  const document = {
    ...policy,
    ...replacement,
    program,
    sourceDigest: digestText(
      typeof replacement.canonicalSql === "string"
        ? replacement.canonicalSql
        : policy.canonicalSql,
    ),
  };
  const { definitionDigest: _definitionDigest, ...unsigned } = document;
  return { ...unsigned, definitionDigest: digestCanonical(unsigned) };
}

function baseProgram(): PolicyProgramV1 {
  return {
    kind: "select",
    availabilityJoin: { kind: "inner_join" },
    resource: {
      kind: "reference",
      source: "requested",
      field: "resource",
      valueType: "text",
      nullable: false,
    },
    ceiling: {
      kind: "reference",
      source: "context",
      field: "request_ceiling",
      valueType: "numeric",
      nullable: false,
    },
    reason: textLiteral("request_limit"),
    where: null,
    groupBy: [],
    orderBy: ["resource", "reason", "ceiling"],
  };
}

function textLiteral(value: string) {
  return {
    kind: "text_literal" as const,
    value,
    valueType: "text" as const,
    nullable: false as const,
  };
}

function decimalLiteral(value: string) {
  return {
    kind: "decimal_literal" as const,
    value,
    valueType: "numeric" as const,
    nullable: false as const,
  };
}

function requestId(index: number): string {
  return `${REQUEST_ID_PREFIX}${index.toString().padStart(12, "0")}`;
}

function digestText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function digestCanonical(value: unknown): string {
  return digestText(canonicalJson(value));
}
