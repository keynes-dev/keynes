import { afterEach, describe, expect, it, vi } from "vitest";

import { createKeynesClient } from "../../../src/generated/client.js";
import type {
  CreateBudgetCommand,
  PolicyDefinitionV1,
  ResourceDefinition,
  RequestBudgetCommand,
} from "../../../src/generated/types.js";
import { definePolicySql, policyValue } from "../../../src/policy/authoring.js";
import { digestCanonicalJson } from "../../../src/policy/canonicalize.js";
import type { PolicyEvaluationInput } from "../../../src/policy/evaluate.js";
import type { PolicyProgramV1 } from "../../../src/generated/policy-types.js";
import { defineResources } from "../../../src/resources.js";

const resources = defineResources({
  tokens: { unit: "token", accountingBehavior: "consumable" },
});
const tokensResource = {
  canonicalName: "tokens",
  unit: "token",
  accountingBehavior: "consumable",
} satisfies ResourceDefinition;

const contextSchema = {
  factor: policyValue.integer(),
  segment: policyValue.text(),
};

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

afterEach(() => {
  vi.doUnmock("../../../src/policy/evaluate.js");
  vi.resetModules();
});

describe("local governed request replay", () => {
  it("returns stored evidence before a changed evaluator profile and mutates nothing", async () => {
    const harness = await openHarness();
    try {
      const command = harness.requestCommand({
        commandId: "30000000-0000-4000-8000-000000000001",
        context: { factor: 1, segment: "standard" },
      });
      const first = await harness.client.requestBudget(command);
      const mutationCalls = harness.observe.mock.calls.length;
      harness.failEvaluation();

      const replay = await harness.client.requestBudget(command);

      expect(replay).toEqual({ ...first, replayed: true });
      expect(harness.observe).toHaveBeenCalledTimes(mutationCalls);
      await expect(harness.snapshot()).resolves.toMatchObject({
        budget: { resources: [{ available: 6, committed: 4 }] },
        history: {
          entries: [
            { kind: "budget_created", sequence: 1 },
            {
              kind: "request_approved",
              sequence: 2,
              policyEvidence: {
                context: { factor: 1, segment: "standard" },
                decision: "approved",
              },
            },
          ],
        },
      });
    } finally {
      harness.close();
    }
  });

  it("keeps the original decision after availability and an unrelated revision change", async () => {
    const harness = await openHarness();
    try {
      const command = harness.requestCommand({
        commandId: "30000000-0000-4000-8000-000000000001",
        context: { factor: 1, segment: "standard" },
      });
      const first = await harness.client.requestBudget(command);
      await harness.client.requestBudget(
        harness.requestCommand({
          commandId: "30000000-0000-4000-8000-000000000002",
          amount: 5,
          context: { factor: 1, segment: "standard" },
        }),
      );
      await harness.client.createBudget({
        commandId: "20000000-0000-4000-8000-000000000002",
        resources: [{ definition: tokensResource, amount: 10 }],
        policies: [ceilingPolicy("root_limit", 2)],
      });
      const mutationCalls = harness.observe.mock.calls.length;

      const replay = await harness.client.requestBudget(command);

      expect(replay).toEqual({ ...first, replayed: true });
      expect(replay.policyEvidence).toMatchObject({
        policies: [{ name: "root_limit", revision: 1 }],
        effectiveCeilings: [{ ceiling: 10 }],
      });
      expect(harness.observe).toHaveBeenCalledTimes(mutationCalls);
      await expect(harness.snapshot()).resolves.toMatchObject({
        budget: { resources: [{ available: 1, committed: 9 }] },
        history: { entries: [{}, {}, {}] },
      });
    } finally {
      harness.close();
    }
  });

  it("canonicalizes Context key order but conflicts on a changed value", async () => {
    const harness = await openHarness();
    try {
      const command = harness.requestCommand({
        commandId: "30000000-0000-4000-8000-000000000001",
        context: { factor: 1, segment: "standard" },
      });
      const first = await harness.client.requestBudget(command);
      const mutationCalls = harness.observe.mock.calls.length;

      const replay = await harness.client.requestBudget({
        ...command,
        context: { segment: "standard", factor: 1 },
      });
      await expect(
        harness.client.requestBudget({
          ...command,
          context: { factor: 2, segment: "standard" },
        }),
      ).rejects.toMatchObject({ code: "command_conflict" });

      expect(replay).toEqual({ ...first, replayed: true });
      expect(harness.observe).toHaveBeenCalledTimes(mutationCalls);
      await expect(harness.snapshot()).resolves.toMatchObject({
        budget: { resources: [{ available: 6, committed: 4 }] },
        history: { entries: [{}, {}] },
      });
    } finally {
      harness.close();
    }
  });

  it("canonicalizes child Policy order and conflicts on a changed definition", async () => {
    const harness = await openHarness();
    try {
      const childA = ceilingPolicy("child_a", 1);
      const childB = ceilingPolicy("child_b", 1);
      const command = harness.requestCommand({
        commandId: "30000000-0000-4000-8000-000000000001",
        context: { factor: 1, segment: "standard" },
        childPolicies: [childA, childB],
      });
      const first = await harness.client.requestBudget(command);
      const mutationCalls = harness.observe.mock.calls.length;
      const reorderedDeclarations = structuredClone(childA);
      reorderedDeclarations.contextSchema.reverse();
      const resealedDeclarations = resealDefinition(reorderedDeclarations);
      expect(resealedDeclarations.definitionDigest).not.toBe(
        childA.definitionDigest,
      );

      const replay = await harness.client.requestBudget({
        ...command,
        childPolicies: [childB, resealedDeclarations],
      });
      await expect(
        harness.client.requestBudget({
          ...command,
          childPolicies: [childA, ceilingPolicy("child_b", 2)],
        }),
      ).rejects.toMatchObject({ code: "command_conflict" });

      expect(replay).toEqual({ ...first, replayed: true });
      expect(harness.observe).toHaveBeenCalledTimes(mutationCalls);
      await expect(harness.snapshot()).resolves.toMatchObject({
        budget: { resources: [{ available: 6, committed: 4 }] },
        history: { entries: [{}, {}] },
      });
    } finally {
      harness.close();
    }
  });

  it("treats omitted and explicit empty child Policy sets as one command", async () => {
    const harness = await openHarness();
    try {
      const command = harness.requestCommand({
        commandId: "30000000-0000-4000-8000-000000000001",
        context: { factor: 1, segment: "standard" },
      });
      const first = await harness.client.requestBudget(command);
      const mutationCalls = harness.observe.mock.calls.length;

      const replay = await harness.client.requestBudget({
        ...command,
        childPolicies: [],
      });

      expect(replay).toEqual({ ...first, replayed: true });
      expect(harness.observe).toHaveBeenCalledTimes(mutationCalls);
    } finally {
      harness.close();
    }
  });
});

async function openHarness() {
  vi.resetModules();
  const actual = await vi.importActual<
    typeof import("../../../src/policy/evaluate.js")
  >("../../../src/policy/evaluate.js");
  let shouldFail = false;
  const evaluate = vi.fn(
    (
      program: Readonly<PolicyProgramV1>,
      input: Readonly<PolicyEvaluationInput>,
    ) => {
      if (shouldFail) throw new Error("changed evaluator profile");
      return actual.evaluatePolicyProgram(program, input);
    },
  );
  vi.doMock("../../../src/policy/evaluate.js", () => ({
    ...actual,
    evaluatePolicyProgram: evaluate,
  }));
  const { openSqliteCommandExecutor } =
    await import("../../../src/local/sqlite-command-executor.js");
  const observe = vi.fn();
  const executor = openSqliteCommandExecutor(
    INSTALLATION,
    EXECUTION_CONTEXT,
    observe,
  );
  const client = createKeynesClient(executor);
  const root = await client.createBudget({
    commandId: "20000000-0000-4000-8000-000000000001",
    resources: [{ definition: tokensResource, amount: 10 }],
    policies: [ceilingPolicy("root_limit", 1)],
  } satisfies CreateBudgetCommand);
  const resourceTypeId = root.budget.resources[0]?.resourceType.resourceTypeId;
  if (resourceTypeId === undefined) {
    throw new Error("root must project its Resource");
  }
  return {
    client,
    resourceTypeId,
    observe,
    failEvaluation() {
      shouldFail = true;
    },
    requestCommand(options: {
      readonly commandId: string;
      readonly amount?: number;
      readonly context: RequestBudgetCommand["context"];
      readonly childPolicies?: readonly PolicyDefinitionV1[];
    }): RequestBudgetCommand {
      return {
        commandId: options.commandId,
        parentBudgetId: root.budget.budgetId,
        resources: [{ resourceTypeId, amount: options.amount ?? 4 }],
        context: options.context,
        ...(options.childPolicies === undefined
          ? {}
          : { childPolicies: [...options.childPolicies] }),
      };
    },
    snapshot: () => client.getBudget({ budgetId: root.budget.budgetId }),
    close: () => executor.close(),
  };
}

function ceilingPolicy(name: string, revision: number): PolicyDefinitionV1 {
  return definePolicySql(resources, {
    name,
    revision,
    inputs: ["tokens"],
    outputs: ["tokens"],
    context: contextSchema,
    reasons: ["limit"],
    sql: `
      SELECT requested.resource AS resource,
             available.amount * context.factor AS ceiling,
             'limit' AS reason
        FROM requested_resources AS requested
        INNER JOIN available_resources AS available USING (resource)
        CROSS JOIN policy_context AS context
    `,
  });
}

function resealDefinition(definition: PolicyDefinitionV1): PolicyDefinitionV1 {
  const { definitionDigest: _definitionDigest, ...document } = definition;
  return {
    ...document,
    definitionDigest: digestCanonicalJson(document),
  };
}
