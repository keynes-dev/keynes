import { rootResources } from "@keynes/contracts/contract-tests";
import { describe, expect, it } from "vitest";

import { createKeynesClient } from "../../../src/generated/client.js";
import type {
  PolicyDefinitionV1,
  ResourceDefinition,
  RequestBudgetCommand,
} from "../../../src/generated/types.js";
import { openPgliteCommandExecutor } from "../../../src/local/pglite-command-executor.js";
import { definePolicySql, policyValue } from "../../../src/policy/authoring.js";

const resources = {
  tokens: { unit: "token", accountingBehavior: "consumable" },
};
const tokensResource = {
  canonicalName: "tokens",
  unit: "token",
  accountingBehavior: "consumable",
} satisfies ResourceDefinition;
const contextSchema = {
  factor: policyValue.integer(),
  segment: policyValue.text(),
};

describe("local governed request replay", () => {
  it("replays canonical SQL with normalized Context and rejects changed Context", async () => {
    const executor = await openPgliteCommandExecutor();
    const client = createKeynesClient(executor);
    try {
      const rootInput = rootResources([
        { definition: tokensResource, amount: 10 },
      ]);
      await client.defineResources({
        commandId: "10000000-0000-4000-8000-000000000071",
        definitions: rootInput.definitions,
      });
      const root = await client.createBudget({
        commandId: "20000000-0000-4000-8000-000000000071",
        ...rootInput,
        policies: [ceilingPolicy("canonical_replay", 1)],
      });
      const resourceTypeId =
        root.budget.resources[0]?.resourceType.resourceTypeId;
      if (resourceTypeId === undefined)
        throw new Error("canonical root must project its Resource");
      const command = {
        commandId: "30000000-0000-4000-8000-000000000071",
        parentBudgetId: root.budget.budgetId,
        resources: [{ resourceTypeId, amount: 4 }],
        context: { factor: 1, segment: "standard" },
      } satisfies RequestBudgetCommand;

      const first = await client.requestBudget(command);
      const replay = await client.requestBudget({
        ...command,
        context: { segment: "standard", factor: 1 },
      });
      await expect(
        client.requestBudget({
          ...command,
          context: { factor: 2, segment: "standard" },
        }),
      ).rejects.toMatchObject({ code: "command_conflict" });

      expect(replay).toEqual({ ...first, replayed: true });
      await expect(
        client.getBudget({ budgetId: root.budget.budgetId }),
      ).resolves.toMatchObject({
        budget: { resources: [{ available: 6, committed: 4 }] },
        history: {
          entries: [{}, { policyEvidence: { decision: "approved" } }],
        },
      });
    } finally {
      await executor.close();
    }
  });
});

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
