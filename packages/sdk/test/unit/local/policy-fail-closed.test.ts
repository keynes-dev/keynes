import { rootResources } from "@keynes/contracts/contract-tests";
import { describe, expect, it } from "vitest";

import {
  createKeynes,
  definePolicySql,
  policySet,
  policyValue,
  type PolicyDefinition,
} from "../../../src/index.js";
import { createKeynesClient } from "../../../src/generated/client.js";
import type {
  ExpressionNodeV1,
  PolicyDefinitionV1,
  PolicyProgramV1,
} from "../../../src/generated/policy-types.js";
import type { RequestBudgetCommand } from "../../../src/generated/types.js";
import { openSqliteCommandExecutor } from "../../../src/local/sqlite-command-executor.js";
import { digestCanonicalJson } from "../../../src/policy/canonicalize.js";
import {
  PolicyEvaluationError,
  evaluatePolicyProgram,
  type PolicyEvaluationFailureCategory,
} from "../../../src/policy/evaluate.js";
import { failAtMutationStage } from "../support/sqlite-faults.js";

const resources = {
  tokens: { unit: "token", accountingBehavior: "consumable" },
};

const contextSchema = {
  factor: policyValue.integer(),
};

type TestContext = { readonly factor: number };

const INSTALLATION = {
  tenantId: "00000000-0000-4000-8000-000000000002",
  principals: [
    {
      principalId: "00000000-0000-4000-8000-000000000201",
      permissions: [
        "define_resource_type",
        "create_root_budget",
        "request_budget",
        "settle_budget",
        "read_budget",
      ],
    },
  ],
} as const;

const EXECUTION_CONTEXT = {
  tenantId: INSTALLATION.tenantId,
  principalId: INSTALLATION.principals[0].principalId,
} as const;

describe("local Policy evaluation failures", () => {
  it("rejects a digest-correct artifact whose canonical SQL does not match its program", async () => {
    const executor = openSqliteCommandExecutor(INSTALLATION, EXECUTION_CONTEXT);
    const client = createKeynesClient(executor);
    try {
      const rootInput = rootResources([
        {
          definition: {
            canonicalName: "tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
          amount: 10,
        },
      ]);
      await client.defineResources({
        commandId: "10000000-0000-4000-8000-000000000001",
        definitions: rootInput.definitions,
      });
      const policy = resealPolicy(
        ceilingPolicy({
          name: "mismatched_source",
          reason: "limit",
          ceiling: "available.amount",
        }),
        { canonicalSql: "select 1" },
      );

      await expect(
        client.createBudget({
          commandId: "20000000-0000-4000-8000-000000000001",
          ...rootInput,
          policies: [policy],
        }),
      ).rejects.toMatchObject({
        code: "invalid_policy",
        details: { path: "$.policies", rule: "canonicalDefinition" },
      });
    } finally {
      executor.close();
    }
  });

  it("rejects a direct Policy artifact whose outputs are not inputs", async () => {
    const executor = openSqliteCommandExecutor(INSTALLATION, EXECUTION_CONTEXT);
    const client = createKeynesClient(executor);
    try {
      const rootInput = rootResources([
        {
          definition: {
            canonicalName: "tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
          amount: 10,
        },
        {
          definition: {
            canonicalName: "search_queries",
            unit: "query",
            accountingBehavior: "consumable",
          },
          amount: 10,
        },
      ]);
      await client.defineResources({
        commandId: "10000000-0000-4000-8000-000000000002",
        definitions: rootInput.definitions,
      });
      const policy = resealOutputResources(
        ceilingPolicy({
          name: "invalid_outputs",
          reason: "limit",
          ceiling: "available.amount",
        }),
        ["search_queries"],
      );

      await expect(
        client.createBudget({
          commandId: "20000000-0000-4000-8000-000000000001",
          ...rootInput,
          policies: [policy],
        }),
      ).rejects.toMatchObject({
        code: "invalid_policy",
        details: { path: "$.policies", rule: "not_input_resource" },
      });
    } finally {
      executor.close();
    }
  });

  it("enforces the generated work limit", () => {
    const names = Array.from({ length: 64 }, (_, index) => `r${index}`);
    const amount = numericReference("available", "amount");
    const ceiling = Array.from({ length: 16 }).reduce<ExpressionNodeV1>(
      (left) => ({
        kind: "binary_numeric",
        operator: "+",
        left,
        right: amount,
        valueType: "numeric",
        nullable: false,
      }),
      amount,
    );

    expect(() =>
      evaluatePolicyProgram(program(ceiling), {
        requested: names.map((resource) => ({ resource, amount: 1 })),
        available: names.map((resource) => ({ resource, amount: 1 })),
        context: {},
        outputResources: names,
        reasons: ["limit"],
      }),
    ).toThrow(category("limit_exceeded"));
  });

  it.each([
    ["arithmetic_overflow", "power(available.amount, 18) * 100", 4],
    [
      "numeric_domain",
      "requested.amount / (available.amount - available.amount)",
      4,
    ],
    ["invalid_result", "requested.amount / 2", 3],
  ] as const)(
    "returns a sanitized %s failure without changing Budget state",
    async (expectedCategory, ceiling, requested) => {
      const policy = ceilingPolicy({
        name: `${expectedCategory}_policy`,
        reason: "limit",
        ceiling,
      });
      const { keynes, root } = await openGoverned(policy);
      try {
        const error = await capture(
          root.request({ tokens: requested }, { context: { factor: 1 } }),
        );

        expect(error).toMatchObject({
          name: "KeynesError",
          message: "policy_evaluation_failed",
          code: "policy_evaluation_failed",
          details: {
            operation: "requestBudget",
            policyName: `${expectedCategory}_policy`,
            policyRevision: 1,
            category: expectedCategory,
          },
        });
        expect(Object.keys(errorDetails(error)).sort()).toEqual([
          "category",
          "operation",
          "policyName",
          "policyRevision",
        ]);
        expect(JSON.stringify(errorDetails(error))).not.toContain(ceiling);
        expect(JSON.stringify(errorDetails(error))).not.toContain("factor");
        await expectUnchangedRoot(root);
      } finally {
        await keynes.close();
      }
    },
  );

  it.each([
    [
      "numeric_precision",
      {
        kind: "decimal_literal",
        value: "999999999999999999999",
        valueType: "numeric",
        nullable: false,
      } satisfies ExpressionNodeV1,
      {},
    ],
    [
      "execution_failed",
      numericReference("context", "factor"),
      { factor: "not-a-number" },
    ],
  ] as const)(
    "maps evaluator-owned %s failures",
    (expected, ceiling, context) => {
      expect(() =>
        evaluatePolicyProgram(program(ceiling), {
          requested: [{ resource: "tokens", amount: 1 }],
          available: [{ resource: "tokens", amount: 10 }],
          context,
          outputResources: ["tokens"],
          reasons: ["limit"],
        }),
      ).toThrow(category(expected));
    },
  );

  it("fails the whole command when one Policy succeeds and another fails", async () => {
    const safe = ceilingPolicy({
      name: "a_safe",
      reason: "safe_limit",
      ceiling: "available.amount",
    });
    const failing = ceilingPolicy({
      name: "z_failing",
      reason: "failed_limit",
      ceiling: "requested.amount / (context.factor - context.factor)",
    });
    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget(
        { tokens: 10 },
        { policies: policySet(safe, failing) },
      );

      await expect(
        root.request({ tokens: 4 }, { context: { factor: 1 } }),
      ).rejects.toMatchObject({
        code: "policy_evaluation_failed",
        details: {
          policyName: "z_failing",
          category: "numeric_domain",
        },
      });
      await expectUnchangedRoot(root);
    } finally {
      await keynes.close();
    }
  });
});

describe("governed SQLite mutation rollback", () => {
  it("removes failed Policy command binding so the identity can be retried", async () => {
    const executor = openSqliteCommandExecutor(INSTALLATION, EXECUTION_CONTEXT);
    const client = createKeynesClient(executor);
    try {
      const rootInput = rootResources([
        {
          definition: {
            canonicalName: "tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
          amount: 10,
        },
      ]);
      await client.defineResources({
        commandId: "10000000-0000-4000-8000-000000000003",
        definitions: rootInput.definitions,
      });
      const policy = ceilingPolicy({
        name: "retry_policy",
        reason: "limit",
        ceiling: "requested.amount / context.factor",
      });
      const root = await client.createBudget({
        commandId: "20000000-0000-4000-8000-000000000001",
        ...rootInput,
        policies: [policy],
      });
      const [rootResource] = root.budget.resources;
      if (rootResource === undefined) {
        throw new Error("root must project its Resource");
      }
      const base = {
        commandId: "30000000-0000-4000-8000-000000000001",
        parentBudgetId: root.budget.budgetId,
        resources: [
          {
            resourceTypeId: rootResource.resourceType.resourceTypeId,
            amount: 4,
          },
        ],
      } satisfies Omit<RequestBudgetCommand, "context">;

      await expect(
        client.requestBudget({ ...base, context: { factor: 0 } }),
      ).rejects.toMatchObject({
        code: "policy_evaluation_failed",
        details: { category: "numeric_domain" },
      });
      await expect(
        client.requestBudget({ ...base, context: { factor: 1 } }),
      ).resolves.toMatchObject({
        kind: "approved",
        policyEvidence: { context: { factor: 1 }, decision: "approved" },
      });
      await expect(
        client.getBudget({ budgetId: root.budget.budgetId }),
      ).resolves.toMatchObject({
        budget: { resources: [{ available: 6, committed: 4 }] },
        history: {
          entries: [
            { kind: "budget_created", sequence: 1 },
            {
              kind: "request_approved",
              sequence: 2,
              policyEvidence: { context: { factor: 1 } },
            },
          ],
        },
      });
    } finally {
      executor.close();
    }
  });

  it.each([
    "after_command_binding",
    "after_policy_evaluation",
    "after_domain_mutation",
    "after_history_insertion",
    "after_result_storage",
  ] as const)("rolls back %s", async (stage) => {
    const fault = failAtMutationStage(stage);
    const executor = openSqliteCommandExecutor(
      INSTALLATION,
      EXECUTION_CONTEXT,
      fault.observe,
    );
    const client = createKeynesClient(executor);
    try {
      const rootInput = rootResources([
        {
          definition: {
            canonicalName: "tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
          amount: 10,
        },
      ]);
      await client.defineResources({
        commandId: "10000000-0000-4000-8000-000000000004",
        definitions: rootInput.definitions,
      });
      const policy = ceilingPolicy({
        name: "checkpoint_policy",
        reason: "limit",
        ceiling: "available.amount",
      });
      const root = await client.createBudget({
        commandId: "20000000-0000-4000-8000-000000000001",
        ...rootInput,
        policies: [policy],
      });
      const [rootResource] = root.budget.resources;
      if (rootResource === undefined) {
        throw new Error("root must project its Resource");
      }
      const command = {
        commandId: "30000000-0000-4000-8000-000000000001",
        parentBudgetId: root.budget.budgetId,
        resources: [
          {
            resourceTypeId: rootResource.resourceType.resourceTypeId,
            amount: 4,
          },
        ],
        context: { factor: 1 },
      } satisfies RequestBudgetCommand;

      fault.arm();
      await expect(client.requestBudget(command)).rejects.toThrow(
        `test rollback checkpoint: ${stage}`,
      );
      await expect(
        client.getBudget({ budgetId: root.budget.budgetId }),
      ).resolves.toMatchObject({
        budget: { resources: [{ available: 10, committed: 0 }] },
        history: { entries: [{ kind: "budget_created", sequence: 1 }] },
      });

      await expect(client.requestBudget(command)).resolves.toMatchObject({
        kind: "approved",
        policyEvidence: { decision: "approved" },
      });
      await expect(
        client.getBudget({ budgetId: root.budget.budgetId }),
      ).resolves.toMatchObject({
        budget: { resources: [{ available: 6, committed: 4 }] },
        history: {
          entries: [
            { kind: "budget_created", sequence: 1 },
            {
              kind: "request_approved",
              sequence: 2,
              policyEvidence: { decision: "approved" },
            },
          ],
        },
      });
    } finally {
      executor.close();
    }
  });
});

function ceilingPolicy<const Reason extends string>(definition: {
  readonly name: string;
  readonly reason: Reason;
  readonly ceiling: string;
}): PolicyDefinition<"tokens", TestContext, Reason> {
  return definePolicySql(resources, {
    name: definition.name,
    revision: 1,
    inputs: ["tokens"],
    outputs: ["tokens"],
    context: contextSchema,
    reasons: [definition.reason],
    sql: `
      SELECT requested.resource AS resource,
             ${definition.ceiling} AS ceiling,
             '${definition.reason}' AS reason
        FROM requested_resources AS requested
        INNER JOIN available_resources AS available USING (resource)
        CROSS JOIN policy_context AS context
    `,
  });
}

function resealOutputResources(
  policy: PolicyDefinitionV1,
  outputResources: PolicyDefinitionV1["outputResources"],
): PolicyDefinitionV1 {
  const { definitionDigest: _definitionDigest, ...document } = {
    ...policy,
    outputResources,
  };
  return { ...document, definitionDigest: digestCanonicalJson(document) };
}

function resealPolicy(
  policy: PolicyDefinitionV1,
  replacement: Partial<PolicyDefinitionV1>,
): PolicyDefinitionV1 {
  const { definitionDigest: _definitionDigest, ...document } = {
    ...policy,
    ...replacement,
  };
  return { ...document, definitionDigest: digestCanonicalJson(document) };
}

async function openGoverned(
  policy: PolicyDefinition<"tokens", TestContext, string>,
) {
  const keynes = await createKeynes({ resources });
  try {
    const root = await keynes.createBudget(
      { tokens: 10 },
      { policies: policySet(policy) },
    );
    return { keynes, root };
  } catch (error: unknown) {
    await keynes.close();
    throw error;
  }
}

async function expectUnchangedRoot(
  root: Awaited<ReturnType<typeof openGoverned>>["root"],
): Promise<void> {
  await expect(root.inspect()).resolves.toMatchObject({
    budget: { resources: [{ allocated: 10, available: 10, committed: 0 }] },
    history: { entries: [{ kind: "budget_created", sequence: 1 }] },
  });
}

function program(ceiling: ExpressionNodeV1): PolicyProgramV1 {
  return {
    kind: "select",
    availabilityJoin: { kind: "cross_join" },
    resource: {
      kind: "reference",
      source: "requested",
      field: "resource",
      valueType: "text",
      nullable: false,
    },
    ceiling,
    reason: {
      kind: "text_literal",
      value: "limit",
      valueType: "text",
      nullable: false,
    },
    where: null,
    groupBy: [],
    orderBy: ["resource", "reason", "ceiling"],
  };
}

function numericReference(
  source: "available" | "context",
  field: string,
): ExpressionNodeV1 {
  return {
    kind: "reference",
    source,
    field,
    valueType: "numeric",
    nullable: false,
  };
}

function category(
  value: PolicyEvaluationFailureCategory,
): PolicyEvaluationError {
  return new PolicyEvaluationError(value);
}

async function capture(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof Error) return error;
    throw new Error("expected an Error rejection");
  }
  throw new Error("expected rejection");
}

function errorDetails(error: Error): Record<string, unknown> {
  if (!("details" in error) || !isRecord(error.details)) {
    throw new Error("expected structured error details");
  }
  return error.details;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
