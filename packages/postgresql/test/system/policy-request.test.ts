import { rootResources } from "@keynes/contracts/contract-tests";
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
  requirePostgresqlSystemInstallation,
} from "./support/test-keynes.js";

const SEARCH_RESOURCE_ID = "11000000-0000-4000-8000-000000000001";
const MODEL_RESOURCE_ID = "11000000-0000-4000-8000-000000000002";
const RESOURCE_DEFINITIONS_BY_ID = {
  [SEARCH_RESOURCE_ID]: {
    canonicalName: "search_queries",
    unit: "query",
    accountingBehavior: "consumable",
  },
  [MODEL_RESOURCE_ID]: {
    canonicalName: "model_tokens",
    unit: "token",
    accountingBehavior: "consumable",
  },
} as const;
const ROOT_BUDGET_ID = "21000000-0000-4000-8000-000000000001";
const REQUEST_ID = "31000000-0000-4000-8000-000000000001";
const SECOND_REQUEST_ID = "31000000-0000-4000-8000-000000000002";
const NON_RFC_ROOT_BUDGET_ID = "21000000-0000-0000-0000-000000000003";
const NON_RFC_REQUEST_ID = "31000000-0000-0000-0000-000000000003";

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

if (process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined) {
  throw new Error(
    "Native tests require runner context; use a PostgreSQL deployment runner",
  );
}

describe("PostgreSQL governed Policy requests", () => {
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

    expect(request).toEqual({
      ok: true,
      replayed: false,
      result: {
        kind: "approved",
        commandId: REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        childBudgetId: REQUEST_ID,
        resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 4 }],
        policyEvidence: evidence,
      },
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

    expect(request).toEqual({
      ok: true,
      replayed: false,
      result: {
        kind: "denied",
        commandId: REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
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
      },
    });
    await expectBudgetState(fixture.owner, REQUEST_ID, false);
    await expectRootHolding(fixture.owner, {
      committed: 0,
      historyEntries: 2,
    });
  });

  it("evaluates requested, availability, and Context through the installed request path", async () => {
    fixture = await openPolicyFixture();
    const policy = inputSensitivePolicy();
    await seedGovernedRoot(fixture, policy);

    const request = await committed(fixture, "requestBudget", {
      commandId: REQUEST_ID,
      parentBudgetId: ROOT_BUDGET_ID,
      resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 4 }],
      context: { input_offset: 2 },
    });
    const evidence = policyEvidence(policy, 6, "approved", 2);

    expect(request).toEqual({
      ok: true,
      replayed: false,
      result: {
        kind: "approved",
        commandId: REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        childBudgetId: REQUEST_ID,
        resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 4 }],
        policyEvidence: evidence,
      },
    });
  });

  it("uses available Resources when they are the Policy ceiling", async () => {
    fixture = await openPolicyFixture();
    const policy = inputSensitivePolicy();
    await seedGovernedRoot(fixture, policy, 5);

    const request = await committed(fixture, "requestBudget", {
      commandId: REQUEST_ID,
      parentBudgetId: ROOT_BUDGET_ID,
      resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 4 }],
      context: { input_offset: 2 },
    });
    const evidence = policyEvidence(policy, 5, "approved", 2);

    expect(request).toEqual({
      ok: true,
      replayed: false,
      result: {
        kind: "approved",
        commandId: REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        childBudgetId: REQUEST_ID,
        resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 4 }],
        policyEvidence: evidence,
      },
    });
    await expectRootHolding(fixture.owner, {
      committed: 4,
      historyEntries: 2,
    });
  });

  it("enforces Policies for a contract-valid non-RFC request command UUID", async () => {
    fixture = await openPolicyFixture();
    const policy = requestLimitPolicy("request_ceiling", "request_limit");
    await seedGovernedRoot(fixture, policy);

    const request = await committed(fixture, "requestBudget", {
      commandId: NON_RFC_REQUEST_ID,
      parentBudgetId: ROOT_BUDGET_ID,
      resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 1 }],
      context: { request_ceiling: 0 },
    });

    expect(request.result).toMatchObject({
      kind: "denied",
      policyEvidence: {
        decision: "denied",
        effectiveCeilings: [{ resourceTypeId: MODEL_RESOURCE_ID, ceiling: 0 }],
      },
    });
  });

  it("preserves root Policies created with a contract-valid non-RFC UUID", async () => {
    fixture = await openPolicyFixture();
    const policy = requestLimitPolicy("request_ceiling", "request_limit");
    await definePolicyResources(fixture);
    await committed(fixture, "createBudget", {
      commandId: NON_RFC_ROOT_BUDGET_ID,
      ...rootResources([
        rootResource(SEARCH_RESOURCE_ID, 100),
        rootResource(MODEL_RESOURCE_ID, 100),
      ]),
      policies: [policy],
    });

    const request = await committed(fixture, "requestBudget", {
      commandId: REQUEST_ID,
      parentBudgetId: NON_RFC_ROOT_BUDGET_ID,
      resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 1 }],
      context: { request_ceiling: 0 },
    });

    expect(request.result).toMatchObject({
      kind: "denied",
      policyEvidence: { decision: "denied" },
    });
  });

  it("attaches only the explicit child Policy set and evaluates it on the next request", async () => {
    fixture = await openPolicyFixture();
    const parentPolicy = requestLimitPolicy("parent_ceiling", "parent_limit");
    const childPolicy = resealDeclarations(
      requestLimitPolicy("child_ceiling", "child_limit"),
      ["model_tokens"],
      ["model_tokens"],
    );
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

  it("rejects a root Policy declaration outside the receiving Budget holdings", async () => {
    fixture = await openPolicyFixture();
    await definePolicyResources(fixture);
    const invalidPolicy = requestLimitPolicy(
      "request_ceiling",
      "a_outside_root",
      "search_queries",
    );
    const validPolicy = requestLimitPolicy(
      "request_ceiling",
      "z_inside_root",
      "model_tokens",
    );
    const transaction = await beginApplicationAttempt(fixture);
    await transaction.connection.query(
      "select set_config('keynes.policy_operation', 'requestBudget', true)",
    );
    const wire = await call(transaction, "createBudget", {
      commandId: ROOT_BUDGET_ID,
      ...rootResources([rootResource(MODEL_RESOURCE_ID, 100)]),
      policies: [invalidPolicy, validPolicy],
    });
    await transaction.commit();

    expect(wire).toMatchObject({
      ok: false,
      error: {
        code: "invalid_policy",
        details: {
          operation: "createBudget",
          policyName: "a_outside_root",
          policyRevision: 1,
          path: "$.policies",
          rule: "allocatedResourceTypes",
        },
      },
    });
    await expectBudgetState(fixture.owner, ROOT_BUDGET_ID, false);
  });

  it("rejects a child Policy declaration outside the receiving child holdings", async () => {
    fixture = await openPolicyFixture();
    const parentPolicy = requestLimitPolicy("parent_ceiling", "parent_limit");
    await seedGovernedRoot(fixture, parentPolicy);
    const childPolicy = resealDeclarations(
      requestLimitPolicy("child_ceiling", "child_limit"),
      ["search_queries"],
      ["search_queries"],
    );
    const transaction = await beginApplicationAttempt(fixture);
    const wire = await call(transaction, "requestBudget", {
      commandId: REQUEST_ID,
      parentBudgetId: ROOT_BUDGET_ID,
      resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 8 }],
      context: { parent_ceiling: 10 },
      childPolicies: [childPolicy],
    });
    await transaction.commit();

    expect(wire).toMatchObject({
      ok: false,
      error: {
        code: "invalid_policy",
        details: { path: "$.policies", rule: "allocatedResourceTypes" },
      },
    });
    await expectBudgetState(fixture.owner, REQUEST_ID, false);
  });

  it("approves an ungoverned parent request with child Policies without parent Policy evidence", async () => {
    fixture = await openPolicyFixture();
    await definePolicyResources(fixture);
    const childPolicy = resealDeclarations(
      requestLimitPolicy("child_ceiling", "child_limit"),
      ["model_tokens"],
      ["model_tokens"],
    );
    await committed(fixture, "createBudget", {
      commandId: ROOT_BUDGET_ID,
      ...rootResources([rootResource(MODEL_RESOURCE_ID, 100)]),
    });

    const request = await committed(fixture, "requestBudget", {
      commandId: REQUEST_ID,
      parentBudgetId: ROOT_BUDGET_ID,
      resources: [{ resourceTypeId: MODEL_RESOURCE_ID, amount: 4 }],
      childPolicies: [childPolicy],
    });

    expect(request.result).toMatchObject({
      kind: "approved",
      childBudgetId: REQUEST_ID,
    });
    expect(request.result).not.toHaveProperty("policyEvidence");
  });

  it("preserves exact no-Policy request bytes and canonical root history", async () => {
    fixture = await openPolicyFixture();
    await definePolicyResources(fixture);
    await committed(fixture, "createBudget", {
      commandId: ROOT_BUDGET_ID,
      ...rootResources([
        rootResource(SEARCH_RESOURCE_ID, 10),
        rootResource(MODEL_RESOURCE_ID, 10),
      ]),
    });

    const command = {
      commandId: REQUEST_ID,
      parentBudgetId: ROOT_BUDGET_ID,
      resources: [
        { resourceTypeId: SEARCH_RESOURCE_ID, amount: 11 },
        { resourceTypeId: MODEL_RESOURCE_ID, amount: 11 },
      ],
    };
    const commandBytes = `{"commandId":"${REQUEST_ID}","parentBudgetId":"${ROOT_BUDGET_ID}","resources":[{"resourceTypeId":"${SEARCH_RESOURCE_ID}","amount":11},{"resourceTypeId":"${MODEL_RESOURCE_ID}","amount":11}]}`;
    expect(JSON.stringify(command)).toBe(commandBytes);

    const request = await committed(fixture, "requestBudget", command);
    const expectedResult = {
      kind: "denied",
      reasons: [
        {
          code: "insufficient_available",
          available: 10,
          requested: 11,
          resourceTypeId: SEARCH_RESOURCE_ID,
        },
        {
          code: "insufficient_available",
          available: 10,
          requested: 11,
          resourceTypeId: MODEL_RESOURCE_ID,
        },
      ],
      commandId: REQUEST_ID,
      parentBudgetId: ROOT_BUDGET_ID,
    };
    expect(JSON.stringify(request)).toBe(
      JSON.stringify({ ok: true, result: expectedResult, replayed: false }),
    );

    const replay = await committed(fixture, "requestBudget", command);
    expect(JSON.stringify(replay)).toBe(
      JSON.stringify({ ok: true, result: expectedResult, replayed: true }),
    );

    const read = await committed(fixture, "getBudget", {
      budgetId: ROOT_BUDGET_ID,
    });
    expect(read.result).toMatchObject({
      history: {
        entries: [
          { kind: "budget_created" },
          { kind: "request_denied", reasons: expectedResult.reasons },
        ],
      },
    });
    if (!isRecord(read.result.history)) {
      throw new Error("expected no-Policy history");
    }
    const entries = read.result.history.entries;
    if (
      !Array.isArray(entries) ||
      !isRecord(entries[0]) ||
      !isRecord(entries[1])
    ) {
      throw new Error("expected two no-Policy history entries");
    }
    expect(JSON.stringify(read.result.history)).toBe(
      JSON.stringify({
        entries: [
          {
            kind: "budget_created",
            entryId: entries[0].entryId,
            sequence: 1,
            commandId: ROOT_BUDGET_ID,
            resources: [
              { amount: 10, resourceTypeId: MODEL_RESOURCE_ID },
              { amount: 10, resourceTypeId: SEARCH_RESOURCE_ID },
            ],
            rootBudgetId: ROOT_BUDGET_ID,
            subjectBudgetId: ROOT_BUDGET_ID,
          },
          {
            kind: "request_denied",
            entryId: entries[1].entryId,
            reasons: expectedResult.reasons,
            sequence: 2,
            commandId: REQUEST_ID,
            parentBudgetId: ROOT_BUDGET_ID,
            subjectBudgetId: ROOT_BUDGET_ID,
          },
        ],
        rootBudgetId: ROOT_BUDGET_ID,
      }),
    );
  });

  it("orders effective ceilings and tied reasons by canonical text, not Resource UUID", async () => {
    fixture = await openPolicyFixture();
    const policies = [
      requestLimitPolicy("request_ceiling", "policy_", "model_tokens"),
      requestLimitPolicy("request_ceiling", "policy0", "model_tokens"),
      requestLimitPolicy("request_ceiling", "search_policy", "search_queries"),
    ];
    await seedGovernedRoot(fixture, policies);

    const request = await committed(fixture, "requestBudget", {
      commandId: REQUEST_ID,
      parentBudgetId: ROOT_BUDGET_ID,
      resources: [
        { resourceTypeId: SEARCH_RESOURCE_ID, amount: 1 },
        { resourceTypeId: MODEL_RESOURCE_ID, amount: 1 },
      ],
      context: { request_ceiling: 5 },
    });

    expect(request.result).toMatchObject({
      kind: "approved",
      policyEvidence: {
        effectiveCeilings: [
          {
            resourceTypeId: MODEL_RESOURCE_ID,
            reasons: [
              { policyName: "policy0", reason: "policy0" },
              { policyName: "policy_", reason: "policy_" },
            ],
          },
          {
            resourceTypeId: SEARCH_RESOURCE_ID,
            reasons: [{ policyName: "search_policy", reason: "search_policy" }],
          },
        ],
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

    const first = requireSuccess(await call(attempt, "requestBudget", command));
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
});

async function openPolicyFixture(): Promise<PolicyFixture> {
  const owner = await openInstalledPostgresDatabase(
    requirePostgresqlSystemAdministratorUrl(),
    FIXTURE_INSTALLATION,
    requirePostgresqlSystemInstallation(),
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
  policy: PolicyDefinitionV1 | readonly PolicyDefinitionV1[],
  initialModelTokens = 100,
): Promise<void> {
  await definePolicyResources(fixture);
  requireSuccess(
    await committed(fixture, "createBudget", {
      commandId: ROOT_BUDGET_ID,
      ...rootResources([
        rootResource(SEARCH_RESOURCE_ID, 100),
        rootResource(MODEL_RESOURCE_ID, initialModelTokens),
      ]),
      policies: Array.isArray(policy) ? policy : [policy],
    }),
  );
}

async function definePolicyResources(fixture: PolicyFixture): Promise<void> {
  await committed(fixture, "defineResource", {
    commandId: SEARCH_RESOURCE_ID,
    definition: RESOURCE_DEFINITIONS_BY_ID[SEARCH_RESOURCE_ID],
  });
  await committed(fixture, "defineResource", {
    commandId: MODEL_RESOURCE_ID,
    definition: RESOURCE_DEFINITIONS_BY_ID[MODEL_RESOURCE_ID],
  });
}

function rootResource(
  resourceTypeId: keyof typeof RESOURCE_DEFINITIONS_BY_ID,
  amount: number,
) {
  return { definition: RESOURCE_DEFINITIONS_BY_ID[resourceTypeId], amount };
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
  if (!isRecord(value) || value.ok !== true) {
    throw new Error(
      `expected successful wire response, received ${JSON.stringify(value)}`,
    );
  }
  expect(value).toMatchObject({ ok: true, replayed: expect.any(Boolean) });
  if (!isRecord(value.result) || typeof value.replayed !== "boolean") {
    throw new Error(
      `expected successful wire response, received ${JSON.stringify(value)}`,
    );
  }
  return { ok: true, result: value.result, replayed: value.replayed };
}

function requestLimitPolicy(
  contextField: string,
  reason: string,
  resource?: "model_tokens" | "search_queries",
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
    where:
      resource === undefined
        ? null
        : {
            kind: "comparison",
            operator: "=",
            left: {
              kind: "reference",
              source: "requested",
              field: "resource",
              valueType: "text",
              nullable: false,
            },
            right: {
              kind: "text_literal",
              value: resource,
              valueType: "text",
              nullable: false,
            },
            valueType: "boolean",
            nullable: false,
          },
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
    ...(resource === undefined
      ? []
      : [`where requested.resource = '${resource}'`]),
    "order by resource asc, reason asc, ceiling asc",
    "",
  ].join("\n");
  const document = {
    kind: "keynes.policy",
    name: reason,
    revision: 1,
    inputResources:
      resource === undefined ? ["model_tokens", "search_queries"] : [resource],
    outputResources: [resource ?? "model_tokens"],
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

function inputSensitivePolicy(): PolicyDefinitionV1 {
  const requestedAmount = {
    kind: "reference",
    source: "requested",
    field: "amount",
    valueType: "numeric",
    nullable: false,
  } satisfies PolicyProgramV1["ceiling"];
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
      kind: "variadic",
      function: "least",
      arguments: [
        {
          kind: "binary_numeric",
          operator: "+",
          left: requestedAmount,
          right: {
            kind: "reference",
            source: "context",
            field: "input_offset",
            valueType: "numeric",
            nullable: false,
          },
          valueType: "numeric",
          nullable: false,
        },
        {
          kind: "reference",
          source: "available",
          field: "amount",
          valueType: "numeric",
          nullable: false,
        },
      ],
      valueType: "numeric",
      nullable: false,
    },
    reason: {
      kind: "text_literal",
      value: "input_sensitive_limit",
      valueType: "text",
      nullable: false,
    },
    where: null,
    groupBy: [],
    orderBy: ["resource", "reason", "ceiling"],
  } satisfies PolicyProgramV1;
  const canonicalSql = [
    "select requested.resource as resource,",
    "       least(requested.amount + context.input_offset, available.amount) as ceiling,",
    "       'input_sensitive_limit' as reason",
    "from requested_resources as requested",
    "inner join available_resources as available using (resource)",
    "cross join policy_context as context",
    "order by resource asc, reason asc, ceiling asc",
    "",
  ].join("\n");
  const document = {
    kind: "keynes.policy",
    name: "input_sensitive_limit",
    revision: 1,
    inputResources: ["model_tokens"],
    outputResources: ["model_tokens"],
    contextSchema: [{ name: "input_offset", type: "integer", nullable: false }],
    reasons: ["input_sensitive_limit"],
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

function resealDeclarations(
  policy: PolicyDefinitionV1,
  inputResources: PolicyDefinitionV1["inputResources"],
  outputResources: PolicyDefinitionV1["outputResources"],
): PolicyDefinitionV1 {
  const { definitionDigest: _definitionDigest, ...document } = {
    ...policy,
    inputResources,
    outputResources,
  };
  return { ...document, definitionDigest: digestCanonicalJson(document) };
}

function policyEvidence(
  policy: PolicyDefinitionV1,
  ceiling: number,
  decision: "approved" | "denied",
  contextValue = ceiling,
) {
  const contextField = policy.contextSchema[0]?.name;
  if (contextField === undefined)
    throw new Error("Policy fixture lacks context");
  return {
    context: { [contextField]: contextValue },
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
