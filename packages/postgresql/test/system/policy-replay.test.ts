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

const RESOURCE_ID = "13000000-0000-4000-8000-000000000001";
const SEARCH_RESOURCE_ID = "13000000-0000-4000-8000-000000000002";
const ROOT_ID = "23000000-0000-4000-8000-000000000001";
const OTHER_ROOT_ID = "23000000-0000-4000-8000-000000000002";
const REQUEST_ID = "33000000-0000-4000-8000-000000000001";

interface ReplayFixture {
  readonly owner: PostgresDatabase;
  readonly application: { readonly role: string; readonly password: string };
}

interface SuccessfulWire {
  readonly ok: true;
  readonly result: Readonly<Record<string, unknown>>;
  readonly replayed: boolean;
}

describe.skipIf(process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined)(
  "PostgreSQL governed Policy replay",
  () => {
    let fixture: ReplayFixture | undefined;

    afterEach(async () => {
      await fixture?.owner.close();
      fixture = undefined;
    });

    it("returns the exact stored result, evidence, and Context", async () => {
      fixture = await openFixture();
      const parentPolicy = requestLimitPolicy({ revision: 1 });
      const firstChildPolicy = receivingChildPolicy(
        requestLimitPolicy({
          name: "child_a",
          revision: 1,
        }),
      );
      const secondChildPolicy = receivingChildPolicy(
        requestLimitPolicy({
          name: "child_b",
          revision: 1,
        }),
      );
      await seedGovernedRoot(fixture, parentPolicy);
      const command = requestCommand({
        childPolicies: [firstChildPolicy, secondChildPolicy],
      });

      const original = await committedCall(fixture, "requestBudget", command);
      const replay = await committedCall(
        fixture,
        "requestBudget",
        requestCommand({
          childPolicies: [
            reversePolicyDeclarations(secondChildPolicy),
            reversePolicyDeclarations(firstChildPolicy),
          ],
        }),
      );

      expect(original.replayed).toBe(false);
      expect(replay).toEqual({ ...original, replayed: true });
      expect(replay.result).toMatchObject({
        kind: "approved",
        policyEvidence: {
          context: { request_ceiling: 5, request_enabled: true },
          policies: [
            {
              name: parentPolicy.name,
              revision: parentPolicy.revision,
              sourceDigest: parentPolicy.sourceDigest,
              definitionDigest: parentPolicy.definitionDigest,
            },
          ],
        },
      });
    });

    it("ignores changed availability, an external fact, and an unrelated Policy revision", async () => {
      fixture = await openFixture();
      await seedGovernedRoot(fixture, requestLimitPolicy({ revision: 1 }));
      let externalCeiling = 5;
      const command = requestCommand({ contextCeiling: externalCeiling });
      const original = await committedCall(fixture, "requestBudget", command);

      externalCeiling = 0;
      await fixture.owner.database.query(
        `update keynes_internal.budget_resources
            set allocated_amount = 4
          where tenant_id = $1::uuid
            and budget_id = $2::uuid
            and resource_type_id = $3::uuid`,
        [FIXTURE_TENANT_ID, ROOT_ID, RESOURCE_ID],
      );
      await createOtherGovernedRoot(
        fixture,
        requestLimitPolicy({ revision: 2 }),
      );

      expect(externalCeiling).toBe(0);
      const replay = await committedCall(fixture, "requestBudget", command);
      expect(replay).toEqual({ ...original, replayed: true });
    });

    it("rejects command identity reuse with changed Context without changing state", async () => {
      fixture = await openFixture();
      await seedGovernedRoot(fixture, requestLimitPolicy({ revision: 1 }));
      await committedCall(fixture, "requestBudget", requestCommand());
      const before = await authorityState(fixture.owner);

      const conflict = await committedRawCall(
        fixture,
        "requestBudget",
        requestCommand({ contextCeiling: 4 }),
      );

      expectCommandConflict(conflict);
      expect(await authorityState(fixture.owner)).toEqual(before);
    });

    it("rejects command identity reuse with changed child Policies without changing state", async () => {
      fixture = await openFixture();
      const originalChildPolicy = receivingChildPolicy(
        requestLimitPolicy({
          name: "child_limit",
          revision: 1,
        }),
      );
      await seedGovernedRoot(fixture, requestLimitPolicy({ revision: 1 }));
      await committedCall(
        fixture,
        "requestBudget",
        requestCommand({ childPolicies: [originalChildPolicy] }),
      );
      const before = await authorityState(fixture.owner);

      const conflict = await committedRawCall(
        fixture,
        "requestBudget",
        requestCommand({
          childPolicies: [
            receivingChildPolicy(
              requestLimitPolicy({ name: "child_limit", revision: 2 }),
            ),
          ],
        }),
      );

      expectCommandConflict(conflict);
      expect(await authorityState(fixture.owner)).toEqual(before);
    });

    it("returns before reading the parent Policy snapshot or invoking the evaluator", async () => {
      fixture = await openFixture();
      await seedGovernedRoot(fixture, requestLimitPolicy({ revision: 1 }));
      const command = requestCommand();
      const original = await committedCall(fixture, "requestBudget", command);
      const blocker = await fixture.owner.beginTransaction();
      await blocker.connection.query(
        "lock table keynes_internal.budgets in access exclusive mode",
      );
      const transaction = await beginApplicationAttempt(fixture);

      try {
        await transaction.connection.query(
          `select
             set_config('keynes.tenant_id', $1, true),
             set_config('keynes.principal_id', $2, true),
             set_config('keynes.test_checkpoint', 'before_policy_evaluation', true)`,
          [FIXTURE_TENANT_ID, FIXTURE_PRINCIPALS["product-fixture"]],
        );
        await transaction.connection.query("set local lock_timeout = '250ms'");
        const response = await transaction.connection.query<{
          readonly response: unknown;
        }>("select keynes.request($1::jsonb) as response", [
          JSON.stringify(command),
        ]);
        const replay = requireSuccess(
          normalizeWireResponse(response.rows[0]?.response),
        );
        expect(replay).toEqual({ ...original, replayed: true });
        await transaction.commit();
      } catch (error: unknown) {
        await transaction.rollback();
        throw error;
      } finally {
        await blocker.rollback();
      }
    });
  },
);

async function openFixture(): Promise<ReplayFixture> {
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

async function seedGovernedRoot(
  fixture: ReplayFixture,
  policy: PolicyDefinitionV1,
): Promise<void> {
  requireSuccess(
    await committedRawCall(fixture, "defineResource", {
      commandId: RESOURCE_ID,
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    }),
  );
  requireSuccess(
    await committedRawCall(fixture, "defineResource", {
      commandId: SEARCH_RESOURCE_ID,
      definition: {
        canonicalName: "search_queries",
        unit: "query",
        accountingBehavior: "consumable",
      },
    }),
  );
  requireSuccess(
    await committedRawCall(fixture, "createBudget", {
      commandId: ROOT_ID,
      resources: [
        { resourceTypeId: RESOURCE_ID, amount: 100 },
        { resourceTypeId: SEARCH_RESOURCE_ID, amount: 100 },
      ],
      policies: [policy],
    }),
  );
}

async function createOtherGovernedRoot(
  fixture: ReplayFixture,
  policy: PolicyDefinitionV1,
): Promise<void> {
  requireSuccess(
    await committedRawCall(fixture, "createBudget", {
      commandId: OTHER_ROOT_ID,
      resources: [
        { resourceTypeId: RESOURCE_ID, amount: 1 },
        { resourceTypeId: SEARCH_RESOURCE_ID, amount: 1 },
      ],
      policies: [policy],
    }),
  );
}

async function committedCall(
  fixture: ReplayFixture,
  operation: Parameters<typeof callInstalledProcedure>[2],
  input: unknown,
): Promise<SuccessfulWire> {
  return requireSuccess(await committedRawCall(fixture, operation, input));
}

async function committedRawCall(
  fixture: ReplayFixture,
  operation: Parameters<typeof callInstalledProcedure>[2],
  input: unknown,
): Promise<unknown> {
  const transaction = await beginApplicationAttempt(fixture);
  try {
    const wire = await callRaw(transaction, operation, input);
    await transaction.commit();
    return wire;
  } catch (error: unknown) {
    await transaction.rollback();
    throw error;
  }
}

function beginApplicationAttempt(
  fixture: ReplayFixture,
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

function normalizeWireResponse(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function requireSuccess(value: unknown): SuccessfulWire {
  expect(value).toMatchObject({ ok: true, replayed: expect.any(Boolean) });
  if (
    !isRecord(value) ||
    value.ok !== true ||
    !isRecord(value.result) ||
    typeof value.replayed !== "boolean"
  ) {
    throw new Error(
      `expected successful wire response, received ${JSON.stringify(value)}`,
    );
  }
  return { ok: true, result: value.result, replayed: value.replayed };
}

function expectCommandConflict(value: unknown): void {
  expect(value).toEqual({
    ok: false,
    error: {
      kind: "error",
      code: "command_conflict",
      details: {
        commandId: REQUEST_ID,
        existingOperation: "requestBudget",
        attemptedOperation: "requestBudget",
      },
    },
  });
}

function requestCommand(
  options: {
    readonly contextCeiling?: number;
    readonly childPolicies?: readonly PolicyDefinitionV1[];
  } = {},
): Readonly<Record<string, unknown>> {
  return {
    commandId: REQUEST_ID,
    parentBudgetId: ROOT_ID,
    resources: [{ resourceTypeId: RESOURCE_ID, amount: 4 }],
    context: {
      request_ceiling: options.contextCeiling ?? 5,
      request_enabled: true,
    },
    ...(options.childPolicies === undefined
      ? {}
      : { childPolicies: options.childPolicies }),
  };
}

function requestLimitPolicy(options: {
  readonly name?: string;
  readonly revision: number;
}): PolicyDefinitionV1 {
  const name = options.name ?? "request_limit";
  const program = {
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
    reason: {
      kind: "text_literal",
      value: name,
      valueType: "text",
      nullable: false,
    },
    where: null,
    groupBy: [],
    orderBy: ["resource", "reason", "ceiling"],
  } satisfies PolicyProgramV1;
  const canonicalSql = [
    "select requested.resource as resource,",
    "       context.request_ceiling as ceiling,",
    `       '${name}' as reason`,
    "from requested_resources as requested",
    "inner join available_resources as available using (resource)",
    "cross join policy_context as context",
    "order by resource asc, reason asc, ceiling asc",
    "",
  ].join("\n");
  const document = {
    kind: "keynes.policy",
    name,
    revision: options.revision,
    inputResources: ["model_tokens", "search_queries"],
    outputResources: ["model_tokens", "search_queries"],
    contextSchema: [
      { name: "request_ceiling", type: "integer", nullable: false },
      { name: "request_enabled", type: "boolean", nullable: false },
    ],
    reasons: [name, `${name}_secondary`],
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

function reversePolicyDeclarations(
  policy: PolicyDefinitionV1,
): PolicyDefinitionV1 {
  return {
    ...policy,
    inputResources: reverseNonEmpty(policy.inputResources),
    outputResources: reverseNonEmpty(policy.outputResources),
    contextSchema: [...policy.contextSchema].reverse(),
    reasons: reverseNonEmpty(policy.reasons),
  };
}

function receivingChildPolicy(policy: PolicyDefinitionV1): PolicyDefinitionV1 {
  const inputResources: [string, ...string[]] = ["model_tokens"];
  const outputResources: [string, ...string[]] = ["model_tokens"];
  const { definitionDigest: _definitionDigest, ...document } = {
    ...policy,
    inputResources,
    outputResources,
  };
  return { ...document, definitionDigest: digestCanonical(document) };
}

function reverseNonEmpty<Value>(
  values: readonly [Value, ...Value[]],
): [Value, ...Value[]] {
  const reversed = [...values].reverse();
  const first = reversed[0];
  if (first === undefined) throw new Error("expected a non-empty declaration");
  return [first, ...reversed.slice(1)];
}

async function authorityState(
  owner: PostgresDatabase,
): Promise<Readonly<Record<string, string>>> {
  const result = await owner.database.query<{
    readonly budgets: string;
    readonly commands: string;
    readonly history: string;
    readonly committed: string;
  }>(
    `select
       (select count(*)::text from keynes_internal.budgets where tenant_id = $1::uuid) as budgets,
       (select count(*)::text from keynes_internal.commands where tenant_id = $1::uuid) as commands,
       (select count(*)::text from keynes_internal.budget_history_entries where tenant_id = $1::uuid) as history,
       (select coalesce(sum(allocated_amount), 0)::text from keynes_internal.budget_resources where tenant_id = $1::uuid and budget_id = $2::uuid) as committed`,
    [FIXTURE_TENANT_ID, REQUEST_ID],
  );
  const state = result.rows[0];
  if (state === undefined)
    throw new Error("authority state query returned no row");
  return state;
}

function digestCanonical(value: unknown): string {
  return digestText(canonicalJson(value));
}

function digestText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
