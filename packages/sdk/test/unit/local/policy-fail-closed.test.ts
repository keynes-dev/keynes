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
  PolicyDefinitionV1,
  PolicyProgramV1,
} from "../../../src/generated/policy-types.js";
import type { RequestBudgetCommand } from "../../../src/generated/types.js";
import { openPgliteCommandExecutor } from "../../../src/local/pglite-command-executor.js";
import { digestCanonicalJson } from "../../../src/policy/canonicalize.js";

const resources = {
  tokens: { unit: "token", accountingBehavior: "consumable" },
};
const contextSchema = {
  factor: policyValue.integer(),
};
type TestContext = { readonly factor: number };

describe("local Policy evaluation failures", () => {
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
      await expect(root.inspect()).resolves.toMatchObject({
        budget: { resources: [{ available: 10, committed: 0 }] },
        history: { entries: [{ kind: "budget_created", sequence: 1 }] },
      });
    } finally {
      await keynes.close();
    }
  });

  it("rejects a malformed compiled definition through canonical SQL before mutation", async () => {
    const executor = await openPgliteCommandExecutor();
    const client = createKeynesClient(executor);
    try {
      const rootInput = canonicalRootInput();
      await client.defineResources({
        commandId: "10000000-0000-4000-8000-000000000081",
        definitions: rootInput.definitions,
      });
      const policy = ceilingPolicy({
        name: "malformed_compiled",
        reason: "limit",
        ceiling: "available.amount",
      });
      const malformedProgram = structuredClone(policy.program);
      Reflect.set(malformedProgram, "kind", "catalog_scan");
      const malformed = resealPolicy(policy, { program: malformedProgram });
      const command = {
        commandId: "20000000-0000-4000-8000-000000000081",
        ...rootInput,
        policies: [malformed],
      };

      await expect(
        executor.execute("createBudget", command),
      ).resolves.toMatchObject({
        ok: false,
        error: {
          code: "invalid_policy",
          details: {
            operation: "createBudget",
            policyName: "malformed_compiled",
            policyRevision: 1,
            path: "$.program.kind",
            rule: "const",
          },
        },
      });
      await expect(
        client.createBudget({ ...command, policies: [policy] }),
      ).resolves.toMatchObject({ kind: "created", replayed: false });
    } finally {
      await executor.close();
    }
  });

  it.each([
    [
      "numeric_domain",
      "requested.amount / (context.factor - context.factor)",
      4,
    ],
    ["arithmetic_overflow", "power(available.amount, 18) * 100", 4],
    ["invalid_result", "requested.amount / 2", 3],
  ] as const)(
    "executes canonical SQL and rolls back a %s Policy failure",
    async (category, ceiling, amount) => {
      const harness = await openCanonicalGoverned(
        ceilingPolicy({
          name: `canonical_${category}`,
          reason: "limit",
          ceiling,
        }),
      );
      const command = {
        commandId: "30000000-0000-4000-8000-000000000081",
        parentBudgetId: harness.rootBudgetId,
        resources: [{ resourceTypeId: harness.resourceTypeId, amount }],
        context: { factor: 1 },
      } satisfies RequestBudgetCommand;
      try {
        await expect(
          harness.client.requestBudget(command),
        ).rejects.toMatchObject({
          code: "policy_evaluation_failed",
          details: {
            operation: "requestBudget",
            policyName: `canonical_${category}`,
            policyRevision: 1,
            category,
          },
        });
        await expect(
          harness.client.getBudget({ budgetId: harness.rootBudgetId }),
        ).resolves.toMatchObject({
          budget: { resources: [{ available: 10, committed: 0 }] },
          history: { entries: [{ kind: "budget_created", sequence: 1 }] },
        });
      } finally {
        await harness.executor.close();
      }
    },
  );

  it("rejects forbidden canonical Context and leaves no request binding", async () => {
    const harness = await openCanonicalGoverned(
      ceilingPolicy({
        name: "canonical_context",
        reason: "limit",
        ceiling: "context.factor",
      }),
    );
    const command = {
      commandId: "30000000-0000-4000-8000-000000000082",
      parentBudgetId: harness.rootBudgetId,
      resources: [{ resourceTypeId: harness.resourceTypeId, amount: 4 }],
      context: { factor: -1 },
    } satisfies RequestBudgetCommand;
    try {
      await expect(
        harness.executor.execute("requestBudget", command),
      ).resolves.toMatchObject({
        ok: false,
        error: {
          code: "invalid_policy_context",
          details: {
            operation: "requestBudget",
            path: "$.context.factor",
            rule: "type",
          },
        },
      });
      await expect(
        harness.client.requestBudget({
          ...command,
          context: { factor: 1 },
        }),
      ).resolves.toMatchObject({ kind: "denied", replayed: false });
    } finally {
      await harness.executor.close();
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

function canonicalRootInput() {
  return rootResources([
    {
      definition: {
        canonicalName: "tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
      amount: 10,
    },
  ]);
}

function resealPolicy(
  policy: PolicyDefinitionV1,
  replacement: Partial<PolicyDefinitionV1> & {
    readonly program?: PolicyProgramV1;
  },
): PolicyDefinitionV1 {
  const { definitionDigest: _definitionDigest, ...document } = {
    ...policy,
    ...replacement,
  };
  return { ...document, definitionDigest: digestCanonicalJson(document) };
}

async function openCanonicalGoverned(
  policy: PolicyDefinition<"tokens", TestContext, string>,
) {
  const executor = await openPgliteCommandExecutor();
  const client = createKeynesClient(executor);
  try {
    const rootInput = canonicalRootInput();
    await client.defineResources({
      commandId: "10000000-0000-4000-8000-000000000080",
      definitions: rootInput.definitions,
    });
    const root = await client.createBudget({
      commandId: "20000000-0000-4000-8000-000000000080",
      ...rootInput,
      policies: [policy],
    });
    const resourceTypeId =
      root.budget.resources[0]?.resourceType.resourceTypeId;
    if (resourceTypeId === undefined)
      throw new Error("canonical root must project its Resource");
    return {
      client,
      executor,
      resourceTypeId,
      rootBudgetId: root.budget.budgetId,
    };
  } catch (error: unknown) {
    await executor.close();
    throw error;
  }
}
