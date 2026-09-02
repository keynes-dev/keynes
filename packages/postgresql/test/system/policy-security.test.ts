import { createHash } from "node:crypto";

import {
  canonicalJson,
  POLICY_LIMITS_VERSION,
  POLICY_PROFILE_DIGEST,
  POLICY_PROGRAM_VERSION,
  POLICY_QUERY_PROFILE_VERSION,
  POLICY_VALIDATOR_VERSION,
  type ExpressionNodeV1,
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
const SECOND_RESOURCE_ID = "12000000-0000-4000-8000-000000000002";
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

    it.each([
      ["first CASE condition", () => caseAggregateProgram("first_when")],
      ["later CASE condition", () => caseAggregateProgram("later_when")],
      ["first CASE result", () => caseAggregateProgram("first_then")],
      ["later CASE result", () => caseAggregateProgram("later_then")],
      ["CASE else result", () => caseAggregateProgram("else")],
      [
        "nested second coalesce argument",
        () =>
          programWithAggregateVariadic("coalesce", [
            decimalLiteral("0"),
            aggregateVariadic("least"),
          ]),
      ],
      [
        "nested later coalesce argument",
        () =>
          programWithAggregateVariadic("coalesce", [
            decimalLiteral("0"),
            decimalLiteral("1"),
            aggregateVariadic("greatest"),
          ]),
      ],
    ] as const)(
      "rejects a direct durable aggregate in the %s",
      async (_label, program) => {
        fixture = await openFixture();
        await defineResource(fixture);
        const artifact = program();
        const policy = resealPolicy(basePolicy(), artifact, {
          canonicalSql: canonicalPolicySql(artifact),
        });

        const wire = await committedCall(fixture, "createBudget", {
          commandId: ROOT_ID,
          resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
          policies: [policy],
        });

        expect(wire).toMatchObject({
          ok: false,
          error: { code: "invalid_policy", details: { rule: "aggregate" } },
        });
        await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
      },
    );

    it.each([
      [
        "first coalesce argument",
        () =>
          programWithAggregateVariadic("coalesce", [
            aggregateExpression(),
            decimalLiteral("0"),
          ]),
      ],
      [
        "least",
        () =>
          programWithAggregateVariadic("coalesce", [
            aggregateVariadic("least"),
            decimalLiteral("0"),
          ]),
      ],
      [
        "greatest",
        () =>
          programWithAggregateVariadic("coalesce", [
            aggregateVariadic("greatest"),
            decimalLiteral("0"),
          ]),
      ],
    ] as const)(
      "accepts a direct durable aggregate in %s",
      async (_label, program) => {
        fixture = await openFixture();
        await defineResource(fixture);
        const artifact = program();
        const policy = resealPolicy(basePolicy(), artifact, {
          canonicalSql: canonicalPolicySql(artifact),
        });

        const wire = await committedCall(fixture, "createBudget", {
          commandId: ROOT_ID,
          resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
          policies: [policy],
        });

        expect(wire).toMatchObject({ ok: true });
      },
    );

    it("rejects canonical SQL that does not match the durable program without executing it", async () => {
      fixture = await openFixture();
      const policy = resealPolicy(basePolicy(), baseProgram(), {
        canonicalSql:
          "create table keynes_internal.submitted_sql_executed(value text)",
      });
      await defineResource(fixture);
      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
        policies: [policy],
      });

      expect(wire).toMatchObject({
        ok: false,
        error: { code: "invalid_policy", details: { rule: "canonicalSql" } },
      });
      await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
      const marker = await fixture.owner.database.query<{
        readonly present: boolean;
      }>(
        "select to_regclass('keynes_internal.submitted_sql_executed') is not null as present",
      );
      expect(marker.rows[0]?.present).toBe(false);
    });

    it("rejects a noncanonical Policy name before mutation", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      const policy = resealPolicy(basePolicy(), baseProgram(), {
        name: "Request_Limit",
      });

      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
        policies: [policy],
      });

      expect(wire).toMatchObject({
        ok: false,
        error: { code: "invalid_policy", details: { rule: "artifact" } },
      });
      await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
    });

    it("rejects an invalid Policy revision before mutation", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      const policy = resealPolicy(basePolicy(), baseProgram(), { revision: 0 });

      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
        policies: [policy],
      });

      expect(wire).toMatchObject({
        ok: false,
        error: { code: "invalid_policy", details: { rule: "artifact" } },
      });
      await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
    });

    it("rejects a noncanonical Policy reason before mutation", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      const program = {
        ...baseProgram(),
        reason: textLiteral("Invalid Reason"),
      } satisfies PolicyProgramV1;
      const policy = resealPolicy(basePolicy(), program, {
        reasons: ["Invalid Reason"],
        canonicalSql: canonicalPolicySql(program),
      });

      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
        policies: [policy],
      });

      expect(wire).toMatchObject({
        ok: false,
        error: {
          code: "invalid_policy",
          details: { rule: "canonical_order" },
        },
      });
      await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
    });

    it("rejects duplicate Policy names before mutation", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      const first = basePolicy();
      const second = resealPolicy(first, baseProgram(), { revision: 2 });

      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
        policies: [first, second],
      });

      expect(wire).toMatchObject({
        ok: false,
        error: {
          code: "invalid_policy",
          details: { path: "$.policies", rule: "duplicate_name" },
        },
      });
      await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
    });

    it("rejects Policy output Resources outside its declared input Resources", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      await defineSecondResource(fixture);
      const policy = resealPolicy(basePolicy(), baseProgram(), {
        outputResources: ["search_queries"],
      });

      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [
          { resourceTypeId: RESOURCE_ID, amount: 100 },
          { resourceTypeId: SECOND_RESOURCE_ID, amount: 100 },
        ],
        policies: [policy],
      });

      expect(wire).toMatchObject({
        ok: false,
        error: {
          code: "invalid_policy",
          details: { path: "$.policies", rule: "not_input_resource" },
        },
      });
      await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
    });

    it("rejects a context reference outside the Policy contextSchema", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      const program = {
        ...baseProgram(),
        ceiling: {
          kind: "reference",
          source: "context",
          field: "undeclared_ceiling",
          valueType: "numeric",
          nullable: false,
        },
      } satisfies PolicyProgramV1;
      const policy = resealPolicy(basePolicy(), program, {
        canonicalSql: canonicalPolicySql(program),
      });

      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
        policies: [policy],
      });

      expect(wire).toMatchObject({
        ok: false,
        error: {
          code: "invalid_policy",
          details: { path: "$.policies", rule: "reference_scope" },
        },
      });
      await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
    });

    it("rejects a Policy canonical source over the per-Policy byte limit", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      const policy = sourceSizedPolicy("source_limit", 64);
      expect(
        Buffer.byteLength(String(policy.canonicalSql), "utf8"),
      ).toBeGreaterThan(16_384);

      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
        policies: [policy],
      });

      expect(wire).toMatchObject({
        ok: false,
        error: { code: "invalid_policy", details: { rule: "artifact" } },
      });
      await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
    });

    it("rejects a Policy set over the aggregate canonical source byte limit", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      const policies = Array.from({ length: 5 }, (_, index) =>
        sourceSizedPolicy(`source_limit_${index}`, 54),
      );
      const sourceBytes = policies.reduce(
        (total, policy) =>
          total + Buffer.byteLength(String(policy.canonicalSql), "utf8"),
        0,
      );
      expect(
        policies.every(
          (policy) =>
            Buffer.byteLength(String(policy.canonicalSql), "utf8") <= 16_384,
        ),
      ).toBe(true);
      expect(sourceBytes).toBeGreaterThan(65_536);

      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
        policies,
      });

      expect(wire).toMatchObject({
        ok: false,
        error: {
          code: "invalid_policy",
          details: { path: "$.policies", rule: "limit" },
        },
      });
      await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
    });

    it("filters requested and available rows to each Policy input declaration", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      await defineSecondResource(fixture);
      const program = {
        ...baseProgram(),
        availabilityJoin: { kind: "cross_join" },
        resource: {
          kind: "reference",
          source: "available",
          field: "resource",
          valueType: "text",
          nullable: false,
        },
      } satisfies PolicyProgramV1;
      const policy = resealPolicy(
        { ...basePolicy(), inputResources: ["model_tokens"] },
        program,
        { canonicalSql: canonicalPolicySql(program) },
      );
      const created = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [
          { resourceTypeId: RESOURCE_ID, amount: 100 },
          { resourceTypeId: SECOND_RESOURCE_ID, amount: 100 },
        ],
        policies: [policy],
      });
      expect(created).toMatchObject({ ok: true });

      const wire = await committedCall(fixture, "requestBudget", {
        commandId: requestId(1),
        parentBudgetId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: 5 },
      });

      expect(wire).toMatchObject({ ok: true, result: { kind: "approved" } });
    });

    it("rejects duplicate result Resources as invalid_result", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      await defineSecondResource(fixture);
      const program = {
        ...baseProgram(),
        availabilityJoin: { kind: "cross_join" },
      } satisfies PolicyProgramV1;
      const policy = resealPolicy(
        { ...basePolicy(), inputResources: ["model_tokens", "search_queries"] },
        program,
        { canonicalSql: canonicalPolicySql(program) },
      );
      const created = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [
          { resourceTypeId: RESOURCE_ID, amount: 100 },
          { resourceTypeId: SECOND_RESOURCE_ID, amount: 100 },
        ],
        policies: [policy],
      });
      expect(created).toMatchObject({ ok: true });

      const wire = await committedCall(fixture, "requestBudget", {
        commandId: requestId(2),
        parentBudgetId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: 5 },
      });

      expectPolicyFailure(wire, "invalid_result");
      await expectRequestAbsent(fixture.owner, requestId(2));
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

    it("rejects an emitted requested input Resource outside outputResources", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      await defineSecondResource(fixture);
      const policy = resealPolicy(basePolicy(), baseProgram(), {
        inputResources: ["model_tokens", "search_queries"],
        outputResources: ["search_queries"],
      });
      const created = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [
          { resourceTypeId: RESOURCE_ID, amount: 100 },
          { resourceTypeId: SECOND_RESOURCE_ID, amount: 100 },
        ],
        policies: [policy],
      });
      expect(created).toMatchObject({ ok: true });

      const wire = await committedCall(fixture, "requestBudget", {
        commandId: requestId(2),
        parentBudgetId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: 5 },
      });

      expectPolicyFailure(wire, "invalid_result");
      await expectRequestAbsent(fixture.owner, requestId(2));
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
      await seedGovernedRoot(
        fixture,
        resealPolicy(basePolicy(), program, {
          canonicalSql: canonicalPolicySql(program),
        }),
      );

      const wire = await committedCall(fixture, "requestBudget", {
        commandId: requestId(3),
        parentBudgetId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: 5 },
      });

      expectPolicyFailure(wire, "numeric_domain");
      await expectRequestAbsent(fixture.owner, requestId(3));
      expect(JSON.stringify(wire)).not.toMatch(/division|zero|select|context/u);
    });

    it("maps generated numeric overflow to arithmetic_overflow and rolls back", async () => {
      fixture = await openFixture();
      const program = {
        ...baseProgram(),
        ceiling: {
          kind: "power",
          base: decimalLiteral("10000000000000000000"),
          exponent: 2,
          valueType: "numeric",
          nullable: false,
        },
      } satisfies PolicyProgramV1;
      await seedGovernedRoot(
        fixture,
        resealPolicy(basePolicy(), program, {
          canonicalSql: canonicalPolicySql(program),
        }),
      );

      const wire = await committedCall(fixture, "requestBudget", {
        commandId: requestId(31),
        parentBudgetId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: 5 },
      });

      expectPolicyFailure(wire, "arithmetic_overflow");
      await expectRequestAbsent(fixture.owner, requestId(31));
      expect(JSON.stringify(wire)).not.toMatch(/power|range|select|numeric/u);
    });

    it("maps aggregate transition overflow to arithmetic_overflow and rolls back", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      await defineSecondResource(fixture);
      const program = aggregateTransitionProgram();
      const policy = resealPolicy(basePolicy(), program, {
        inputResources: ["model_tokens", "search_queries"],
        canonicalSql: canonicalPolicySql(program),
      });
      const created = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [
          { resourceTypeId: RESOURCE_ID, amount: 9_007_199_254_740_991 },
          {
            resourceTypeId: SECOND_RESOURCE_ID,
            amount: 9_007_199_254_740_991,
          },
        ],
        policies: [policy],
      });
      expect(created).toMatchObject({ ok: true });

      const wire = await committedCall(fixture, "requestBudget", {
        commandId: requestId(32),
        parentBudgetId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 1 }],
        context: { request_ceiling: 1 },
      });

      expectPolicyFailure(wire, "arithmetic_overflow");
      await expectRequestAbsent(fixture.owner, requestId(32));
    });

    it("rejects noncanonical decimal literal precision before evaluation", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      const program = {
        ...baseProgram(),
        ceiling: decimalLiteral("0.0000000000000000001"),
      } satisfies PolicyProgramV1;
      const policy = resealPolicy(basePolicy(), program, {
        canonicalSql: canonicalPolicySql(program),
      });

      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
        policies: [policy],
      });

      expect(wire).toMatchObject({
        ok: false,
        error: {
          code: "invalid_policy",
          details: { rule: "numeric_precision" },
        },
      });
      await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
    });

    it.each([
      ["non-object", [null]],
      ["array", [["request_ceiling", "integer", false]]],
      [
        "extra key",
        [
          {
            name: "request_ceiling",
            type: "integer",
            nullable: false,
            extra: true,
          },
        ],
      ],
      [
        "invalid name",
        [{ name: "RequestCeiling", type: "integer", nullable: false }],
      ],
      [
        "invalid type",
        [{ name: "request_ceiling", type: "decimal", nullable: false }],
      ],
      [
        "invalid nullability",
        [{ name: "request_ceiling", type: "integer", nullable: "false" }],
      ],
      [
        "duplicate name",
        [
          { name: "request_ceiling", type: "integer", nullable: false },
          { name: "request_ceiling", type: "integer", nullable: false },
        ],
      ],
    ] as const)(
      "rejects a contextSchema member with %s",
      async (_caseName, contextSchema) => {
        fixture = await openFixture();
        await defineResource(fixture);
        const policy = resealPolicy(basePolicy(), baseProgram(), {
          contextSchema,
        });

        const wire = await committedCall(fixture, "createBudget", {
          commandId: ROOT_ID,
          resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
          policies: [policy],
        });

        expect(wire).toMatchObject({
          ok: false,
          error: {
            code: "invalid_policy",
            details: {
              path: "$.policies[0].contextSchema",
              rule: "artifact",
            },
          },
        });
        await expectNoCommandOrBudget(fixture.owner, ROOT_ID);
      },
    );

    it("accepts contextSchema names in canonical C byte order", async () => {
      fixture = await openFixture();
      await defineResource(fixture);
      const program = {
        ...baseProgram(),
        ceiling: decimalLiteral("5"),
      } satisfies PolicyProgramV1;
      const policy = resealPolicy(basePolicy(), program, {
        contextSchema: [
          { name: "a0", type: "integer", nullable: false },
          { name: "a_", type: "integer", nullable: false },
        ],
        canonicalSql: canonicalPolicySql(program),
      });

      const wire = await committedCall(fixture, "createBudget", {
        commandId: ROOT_ID,
        resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
        policies: [policy],
      });

      expect(wire).toMatchObject({ ok: true, result: { kind: "created" } });
    });

    it.each([
      [
        "createBudget",
        {
          commandId: "not-a-uuid",
          resources: [{ resourceTypeId: RESOURCE_ID, amount: 100 }],
          policies: [basePolicy()],
        },
      ],
      [
        "requestBudget",
        {
          commandId: requestId(30),
          parentBudgetId: "not-a-uuid",
          resources: [{ resourceTypeId: RESOURCE_ID, amount: 1 }],
          context: { request_ceiling: 1 },
        },
      ],
    ] as const)(
      "returns invalid_command for malformed %s identifiers",
      async (operation, input) => {
        fixture = await openFixture();
        await defineResource(fixture);

        const wire = await committedCall(fixture, operation, input);

        expect(wire).toMatchObject({
          ok: false,
          error: { code: "invalid_command" },
        });
      },
    );

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

async function defineSecondResource(fixture: SecurityFixture): Promise<void> {
  const wire = await committedCall(fixture, "defineResource", {
    commandId: SECOND_RESOURCE_ID,
    definition: {
      canonicalName: "search_queries",
      unit: "query",
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
  const canonicalSql = canonicalPolicySql(program);
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
    canonicalSql,
    sourceDigest: digestText(canonicalSql),
  } satisfies Omit<PolicyDefinitionV1, "definitionDigest">;
  return { ...document, definitionDigest: digestCanonical(document) };
}

function canonicalPolicySql(program: PolicyProgramV1): string {
  const lines = [
    `select ${canonicalExpression(program.resource)} as resource,`,
    `       ${canonicalExpression(program.ceiling)} as ceiling,`,
    `       ${canonicalExpression(program.reason)} as reason`,
    "from requested_resources as requested",
    program.availabilityJoin.kind === "inner_join"
      ? "inner join available_resources as available using (resource)"
      : "cross join available_resources as available",
    "cross join policy_context as context",
  ];
  if (program.where !== null) {
    lines.push(`where ${canonicalExpression(program.where)}`);
  }
  if (program.groupBy.length > 0) {
    lines.push(
      `group by ${program.groupBy.map(canonicalExpression).join(", ")}`,
    );
  }
  lines.push("order by resource asc, reason asc, ceiling asc");
  return `${lines.join("\n")}\n`;
}

function canonicalExpression(expression: ExpressionNodeV1): string {
  switch (expression.kind) {
    case "decimal_literal":
      return expression.value;
    case "text_literal":
      return `'${expression.value.replaceAll("'", "''")}'`;
    case "boolean_literal":
      return expression.value ? "true" : "false";
    case "null_literal":
      return "null";
    case "reference":
      return `${expression.source}.${expression.field}`;
    case "unary_numeric":
      return `${expression.operator}${canonicalParenthesize(expression.operand)}`;
    case "binary_numeric":
    case "comparison":
    case "boolean_binary":
      return `${canonicalParenthesize(expression.left)} ${expression.operator} ${canonicalParenthesize(expression.right)}`;
    case "text_in":
      return `${canonicalParenthesize(expression.operand)} in (${expression.values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ")})`;
    case "is_null":
      return `${canonicalParenthesize(expression.operand)} ${expression.operator === "is_null" ? "is null" : "is not null"}`;
    case "boolean_not":
      return `not ${canonicalParenthesize(expression.operand)}`;
    case "case":
      return `case ${expression.branches.map((branch) => `when ${canonicalExpression(branch.when)} then ${canonicalExpression(branch.then)}`).join(" ")} else ${canonicalExpression(expression.else)} end`;
    case "variadic":
      return `${expression.function}(${expression.arguments.map(canonicalExpression).join(", ")})`;
    case "numeric_function":
    case "aggregate":
      return `${expression.function}(${canonicalExpression(expression.operand)})`;
    case "scale_function":
      return `${expression.function}(${canonicalExpression(expression.operand)}, ${expression.scale})`;
    case "power":
      return `power(${canonicalExpression(expression.base)}, ${expression.exponent})`;
  }
}

function canonicalParenthesize(expression: ExpressionNodeV1): string {
  switch (expression.kind) {
    case "decimal_literal":
    case "text_literal":
    case "boolean_literal":
    case "null_literal":
    case "reference":
    case "variadic":
    case "numeric_function":
    case "scale_function":
    case "power":
    case "aggregate":
      return canonicalExpression(expression);
    default:
      return `(${canonicalExpression(expression)})`;
  }
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

function sourceSizedPolicy(name: string, valueCount: number) {
  const program = {
    ...baseProgram(),
    reason: textLiteral(name),
    where: {
      kind: "text_in",
      operand: {
        kind: "reference",
        source: "requested",
        field: "resource",
        valueType: "text",
        nullable: false,
      },
      values: sourceValues(valueCount),
      valueType: "boolean",
      nullable: false,
    },
  } satisfies PolicyProgramV1;
  return resealPolicy(basePolicy(), program, {
    name,
    reasons: [name],
    canonicalSql: canonicalPolicySql(program),
  });
}

function sourceValues(valueCount: number): [string, ...string[]] {
  const values = Array.from(
    { length: valueCount },
    (_, index) => `${index.toString().padStart(2, "0")}${"x".repeat(254)}`,
  );
  const [first, ...rest] = values;
  if (first === undefined) throw new Error("source fixture must not be empty");
  return [first, ...rest];
}

function aggregateTransitionProgram(): PolicyProgramV1 {
  return {
    ...baseProgram(),
    availabilityJoin: { kind: "cross_join" },
    ceiling: {
      kind: "variadic",
      function: "coalesce",
      arguments: [
        {
          kind: "aggregate",
          function: "sum",
          operand: {
            kind: "binary_numeric",
            operator: "*",
            left: {
              kind: "reference",
              source: "available",
              field: "amount",
              valueType: "numeric",
              nullable: false,
            },
            right: decimalLiteral("10000"),
            valueType: "numeric",
            nullable: false,
          },
          valueType: "numeric",
          nullable: true,
        },
        decimalLiteral("0"),
      ],
      valueType: "numeric",
      nullable: false,
    },
    groupBy: [
      {
        kind: "reference",
        source: "requested",
        field: "resource",
        valueType: "text",
        nullable: false,
      },
    ],
  };
}

function caseAggregateProgram(
  position: "first_when" | "later_when" | "first_then" | "later_then" | "else",
): PolicyProgramV1 {
  const aggregate = aggregateExpression();
  const aggregateCondition = {
    kind: "comparison",
    operator: ">",
    left: aggregate,
    right: decimalLiteral("0"),
    valueType: "boolean",
    nullable: true,
  } satisfies ExpressionNodeV1;
  const truth = {
    kind: "boolean_literal",
    value: true,
    valueType: "boolean",
    nullable: false,
  } satisfies ExpressionNodeV1;
  const branches: [
    { when: ExpressionNodeV1; then: ExpressionNodeV1 },
    { when: ExpressionNodeV1; then: ExpressionNodeV1 },
  ] = [
    {
      when: position === "first_when" ? aggregateCondition : truth,
      then: position === "first_then" ? aggregate : decimalLiteral("1"),
    },
    {
      when: position === "later_when" ? aggregateCondition : truth,
      then: position === "later_then" ? aggregate : decimalLiteral("2"),
    },
  ];
  return {
    ...baseProgram(),
    ceiling: {
      kind: "case",
      branches,
      else: position === "else" ? aggregate : decimalLiteral("3"),
      valueType: "numeric",
      nullable:
        position === "first_then" ||
        position === "later_then" ||
        position === "else",
    },
    groupBy: [requestedResourceReference()],
  };
}

function programWithAggregateVariadic(
  name: "coalesce" | "least" | "greatest",
  arguments_: [ExpressionNodeV1, ...ExpressionNodeV1[]],
): PolicyProgramV1 {
  return {
    ...baseProgram(),
    ceiling: {
      kind: "variadic",
      function: name,
      arguments: arguments_,
      valueType: "numeric",
      nullable: arguments_.every((argument) => argument.nullable),
    },
    groupBy: [requestedResourceReference()],
  };
}

function aggregateVariadic(name: "least" | "greatest"): ExpressionNodeV1 {
  return {
    kind: "variadic",
    function: name,
    arguments: [aggregateExpression()],
    valueType: "numeric",
    nullable: true,
  };
}

function aggregateExpression(): ExpressionNodeV1 {
  return {
    kind: "aggregate",
    function: "sum",
    operand: {
      kind: "reference",
      source: "requested",
      field: "amount",
      valueType: "numeric",
      nullable: false,
    },
    valueType: "numeric",
    nullable: true,
  };
}

function requestedResourceReference(): ExpressionNodeV1 {
  return {
    kind: "reference",
    source: "requested",
    field: "resource",
    valueType: "text",
    nullable: false,
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
