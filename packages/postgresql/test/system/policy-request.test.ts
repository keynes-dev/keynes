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

const SEARCH_RESOURCE_ID = "11000000-0000-4000-8000-000000000001";
const MODEL_RESOURCE_ID = "11000000-0000-4000-8000-000000000002";
const ROOT_BUDGET_ID = "21000000-0000-4000-8000-000000000001";
const REQUEST_ID = "31000000-0000-4000-8000-000000000001";
const SECOND_REQUEST_ID = "31000000-0000-4000-8000-000000000002";

type OperationName = Parameters<typeof callInstalledProcedure>[2];

interface PolicyFixture {
  readonly owner: PostgresDatabase;
  readonly application: {
    readonly role: string;
    readonly password: string;
  };
}

interface SuccessfulWire {
  readonly ok: true;
  readonly result: Readonly<Record<string, unknown>>;
  readonly replayed: boolean;
}

describe.skipIf(process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined)(
  "PostgreSQL governed Policy requests",
  () => {
    let fixture: PolicyFixture | undefined;

    afterEach(async () => {
      await fixture?.owner.close();
      fixture = undefined;
    });

    it("approves within the Policy ceiling and records canonical evidence", async () => {
      fixture = await openPolicyFixture();
      const policy = requestLimitPolicy("request_ceiling", "request_limit");
      await seedGovernedRoot(fixture, policy);

      const request = await committed(fixture, "requestBudget", {
        commandId: REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: 5 },
      });
      const evidence = policyEvidence(policy, 5, "approved");

      expect(request.result).toMatchObject({
        kind: "approved",
        childBudgetId: REQUEST_ID,
        policyEvidence: evidence,
      });

      const read = await committed(fixture, "getBudget", {
        budgetId: ROOT_BUDGET_ID,
      });
      expect(read.result).toMatchObject({
        history: {
          entries: [
            expect.any(Object),
            {
              kind: "request_approved",
              commandId: REQUEST_ID,
              policyEvidence: evidence,
            },
          ],
        },
      });
    });

    it("denies above the Policy ceiling without reserving or creating a child", async () => {
      fixture = await openPolicyFixture();
      const policy = requestLimitPolicy("request_ceiling", "request_limit");
      await seedGovernedRoot(fixture, policy);

      const request = await committed(fixture, "requestBudget", {
        commandId: REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 6 }],
        context: { request_ceiling: 5 },
      });
      const evidence = policyEvidence(policy, 5, "denied");

      expect(request.result).toMatchObject({
        kind: "denied",
        reasons: [
          {
            code: "policy_ceiling",
            resourceTypeId: MODEL_RESOURCE_ID,
            requested: 6,
            ceiling: 5,
            policyName: policy.name,
            policyRevision: policy.revision,
            reason: "request_limit",
          },
        ],
        policyEvidence: evidence,
      });
      await expectBudgetState(fixture.owner, REQUEST_ID, false);
      await expectRootHolding(fixture.owner, {
        committed: 0,
        historyEntries: 2,
      });
    });

    it("attaches only the explicit child Policy set and evaluates it on the next request", async () => {
      fixture = await openPolicyFixture();
      const parentPolicy = requestLimitPolicy("parent_ceiling", "parent_limit");
      const childPolicy = requestLimitPolicy("child_ceiling", "child_limit");
      await seedGovernedRoot(fixture, parentPolicy);

      const child = await committed(fixture, "requestBudget", {
        commandId: REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 8 }],
        context: { parent_ceiling: 10 },
        childPolicies: [childPolicy],
      });
      expect(child.result).toMatchObject({
        kind: "approved",
        childBudgetId: REQUEST_ID,
      });

      const grandchild = await committed(fixture, "requestBudget", {
        commandId: SECOND_REQUEST_ID,
        parentBudgetId: REQUEST_ID,
        resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 5 }],
        context: { child_ceiling: 4 },
      });
      expect(grandchild.result).toMatchObject({
        kind: "denied",
        reasons: [
          {
            code: "policy_ceiling",
            policyName: childPolicy.name,
            reason: "child_limit",
          },
        ],
        policyEvidence: {
          context: { child_ceiling: 4 },
          policies: [{ name: childPolicy.name }],
          decision: "denied",
        },
      });
    });

    it("keeps governed state pending until the caller commits", async () => {
      fixture = await openPolicyFixture();
      const policy = requestLimitPolicy("request_ceiling", "request_limit");
      await seedGovernedRoot(fixture, policy);
      const attempt = await beginApplicationAttempt(fixture);

      const request = requireSuccess(
        await call(attempt, "requestBudget", {
          commandId: REQUEST_ID,
          parentBudgetId: ROOT_BUDGET_ID,
          resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 4 }],
          context: { request_ceiling: 5 },
        }),
      );
      expect(request.result).toMatchObject({
        kind: "approved",
        policyEvidence: { decision: "approved" },
      });
      await expectBudgetState(fixture.owner, REQUEST_ID, false);

      await attempt.commit();
      await expectBudgetState(fixture.owner, REQUEST_ID, true);
    });

    it("rolls back governed evidence, reservation, child, history, and command identity", async () => {
      fixture = await openPolicyFixture();
      const policy = requestLimitPolicy("request_ceiling", "request_limit");
      await seedGovernedRoot(fixture, policy);
      const command = {
        commandId: REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: 5 },
      };
      const attempt = await beginApplicationAttempt(fixture);

      const first = requireSuccess(
        await call(attempt, "requestBudget", command),
      );
      expect(first.result).toMatchObject({ kind: "approved" });
      await attempt.rollback();

      await expectBudgetState(fixture.owner, REQUEST_ID, false);
      await expectRootHolding(fixture.owner, {
        committed: 0,
        historyEntries: 1,
      });

      const retry = await committed(fixture, "requestBudget", command);
      expect(retry).toMatchObject({
        replayed: false,
        result: { kind: "approved", childBudgetId: REQUEST_ID },
      });
    });

    it("locks an unrequested declared availability holding in Resource UUID order", async () => {
      fixture = await openPolicyFixture();
      const policy = requestLimitPolicy("request_ceiling", "request_limit");
      await seedGovernedRoot(fixture, policy);
      const blocker = await fixture.owner.beginTransaction();
      const request = await beginApplicationAttempt(fixture);
      const probe = await fixture.owner.beginTransaction();

      await lockHolding(blocker, SEARCH_RESOURCE_ID);
      const pending = call(request, "requestBudget", {
        commandId: REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 4 }],
        context: { request_ceiling: 5 },
      });

      await fixture.owner.requireBlockedBy(
        request.backendPid,
        blocker.backendPid,
      );
      await expect(
        lockHolding(probe, MODEL_RESOURCE_ID, true),
      ).resolves.toBeUndefined();
      await probe.rollback();

      await blocker.commit();
      expect(requireSuccess(await pending).result).toMatchObject({
        kind: "approved",
        policyEvidence: { decision: "approved" },
      });
      await request.commit();
    });
  },
);

async function openPolicyFixture(): Promise<PolicyFixture> {
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
  fixture: PolicyFixture,
  policy: PolicyDefinitionV1,
): Promise<void> {
  await committed(fixture, "defineResource", {
    commandId: SEARCH_RESOURCE_ID,
    definition: {
      canonicalName: "search_queries",
      unit: "query",
      accountingBehavior: "consumable",
    },
  });
  await committed(fixture, "defineResource", {
    commandId: MODEL_RESOURCE_ID,
    definition: {
      canonicalName: "model_tokens",
      unit: "token",
      accountingBehavior: "consumable",
    },
  });
  requireSuccess(
    await committed(fixture, "createBudget", {
      commandId: ROOT_BUDGET_ID,
      resources: [
        { resourceTypeId: SEARCH_RESOURCE_ID, amount: 100 },
        { resourceTypeId: MODEL_RESOURCE_ID, amount: 100 },
      ],
      policies: [policy],
    }),
  );
}

async function committed(
  fixture: PolicyFixture,
  operation: OperationName,
  input: unknown,
): Promise<SuccessfulWire> {
  const transaction = await beginApplicationAttempt(fixture);
  try {
    const result = requireSuccess(await call(transaction, operation, input));
    await transaction.commit();
    return result;
  } catch (error: unknown) {
    await transaction.rollback();
    throw error;
  }
}

function beginApplicationAttempt(
  fixture: PolicyFixture,
): Promise<PostgresTransaction> {
  return fixture.owner.beginTransactionAs(
    fixture.application.role,
    fixture.application.password,
  );
}

function call(
  transaction: PostgresTransaction,
  operation: OperationName,
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

function requestLimitPolicy(
  contextField: string,
  reason: string,
): PolicyDefinitionV1 {
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
      field: contextField,
      valueType: "numeric",
      nullable: false,
    },
    reason: {
      kind: "text_literal",
      value: reason,
      valueType: "text",
      nullable: false,
    },
    where: null,
    groupBy: [],
    orderBy: ["resource", "reason", "ceiling"],
  } satisfies PolicyProgramV1;
  const canonicalSql = [
    "select requested.resource as resource,",
    `       context.${contextField} as ceiling,`,
    `       '${reason}' as reason`,
    "from requested_resources as requested",
    "inner join available_resources as available using (resource)",
    "cross join policy_context as context",
    "order by resource asc, reason asc, ceiling asc",
    "",
  ].join("\n");
  const document = {
    kind: "keynes.policy",
    name: reason,
    revision: 1,
    inputResources: ["model_tokens", "search_queries"],
    outputResources: ["model_tokens"],
    contextSchema: [{ name: contextField, type: "integer", nullable: false }],
    reasons: [reason],
    programVersion: POLICY_PROGRAM_VERSION,
    queryProfileVersion: POLICY_QUERY_PROFILE_VERSION,
    validatorVersion: POLICY_VALIDATOR_VERSION,
    limitsVersion: POLICY_LIMITS_VERSION,
    policyProfileDigest: POLICY_PROFILE_DIGEST,
    program,
    canonicalSql,
    sourceDigest: digestText(canonicalSql),
  } satisfies Omit<PolicyDefinitionV1, "definitionDigest">;
  return { ...document, definitionDigest: digestCanonicalJson(document) };
}

function policyEvidence(
  policy: PolicyDefinitionV1,
  ceiling: number,
  decision: "approved" | "denied",
) {
  const contextField = policy.contextSchema[0]?.name;
  if (contextField === undefined)
    throw new Error("Policy fixture lacks context");
  return {
    context: { [contextField]: ceiling },
    policies: [
      {
        name: policy.name,
        revision: policy.revision,
        sourceDigest: policy.sourceDigest,
        definitionDigest: policy.definitionDigest,
        rows: [
          {
            resource: "model_tokens",
            ceiling,
            reason: policy.reasons[0],
          },
        ],
      },
    ],
    effectiveCeilings: [
      {
        resourceTypeId: MODEL_RESOURCE_ID,
        ceiling,
        reasons: [
          {
            policyName: policy.name,
            policyRevision: policy.revision,
            reason: policy.reasons[0],
          },
        ],
      },
    ],
    decision,
  };
}

async function expectBudgetState(
  owner: PostgresDatabase,
  budgetId: string,
  expected: boolean,
): Promise<void> {
  const result = await owner.database.query<{ readonly present: boolean }>(
    `select exists(
       select 1 from keynes_internal.budgets
        where tenant_id = $1::uuid and budget_id = $2::uuid
     ) as present`,
    [FIXTURE_TENANT_ID, budgetId],
  );
  expect(result.rows[0]?.present).toBe(expected);
}

async function expectRootHolding(
  owner: PostgresDatabase,
  expected: { readonly committed: number; readonly historyEntries: number },
): Promise<void> {
  const result = await owner.database.query<{
    readonly committed: string;
    readonly history_entries: string;
  }>(
    `select
       coalesce(sum(child.allocated_amount), 0)::text as committed,
       (select count(*)::text from keynes_internal.budget_history_entries
         where tenant_id = $1::uuid and stream_id = $2::uuid) as history_entries
     from keynes_internal.budgets budget
     left join keynes_internal.budget_resources child
       on child.tenant_id = budget.tenant_id
      and child.budget_id in (
        select budget_id from keynes_internal.budgets
         where tenant_id = $1::uuid and parent_budget_id = $2::uuid
      )
    where budget.tenant_id = $1::uuid and budget.budget_id = $2::uuid`,
    [FIXTURE_TENANT_ID, ROOT_BUDGET_ID],
  );
  expect(result.rows[0]).toEqual({
    committed: String(expected.committed),
    history_entries: String(expected.historyEntries),
  });
}

async function lockHolding(
  transaction: PostgresTransaction,
  resourceTypeId: string,
  nowait = false,
): Promise<void> {
  await transaction.connection.query(
    `select resource_type_id
       from keynes_internal.budget_resources
      where tenant_id = $1::uuid
        and budget_id = $2::uuid
        and resource_type_id = $3::uuid
      for update${nowait ? " nowait" : ""}`,
    [FIXTURE_TENANT_ID, ROOT_BUDGET_ID, resourceTypeId],
  );
}

function digestCanonicalJson(value: unknown): string {
  return digestText(canonicalJson(value));
}

function digestText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
