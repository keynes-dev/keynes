import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  CreateBudgetCommand,
  PolicyDefinitionV1,
  ResourceDefinition,
} from "../../generated/types.ts";
import type { PolicyProgramV1 } from "../../generated/policy-types.ts";
import {
  POLICY_LIMITS_VERSION,
  POLICY_PROFILE_DIGEST,
  POLICY_PROGRAM_VERSION,
  POLICY_QUERY_PROFILE_VERSION,
  POLICY_VALIDATOR_VERSION,
} from "../../generated/policy-profile.ts";
import { canonicalJson } from "../../src/generation.ts";
import type { ContractClient, OpenContractTestHost } from "../host.ts";

type RootResourceInput = {
  readonly definition: ResourceDefinition;
  readonly amount: number;
};

type ResourceBoundRootCommand = Omit<CreateBudgetCommand, "resources"> & {
  readonly resources: [RootResourceInput, ...RootResourceInput[]];
};

export function registerResourceBoundRootContractTests(
  openTestKeynes: OpenContractTestHost,
): void {
  describe("Resource-bound root creation", () => {
    it("binds Resource definitions, allocations, and creation history in one root command", async () => {
      const local = await openTestKeynes();

      try {
        const client = local.clientFor("product-fixture");
        const command = rootCommand("15000000-0000-0000-0000-000000000001", [
          rootResource("model_tokens", "token", "consumable", 100),
          rootResource("reviewer_seats", "seat", "reusable", 4),
        ]);

        const created = await createResourceBoundRoot(client, command);

        expect(created).toMatchObject({
          kind: "created",
          budget: {
            budgetId: command.commandId,
            resources: [
              {
                resourceType: {
                  canonicalName: "model_tokens",
                  unit: "token",
                  accountingBehavior: "consumable",
                },
                allocated: 100,
              },
              {
                resourceType: {
                  canonicalName: "reviewer_seats",
                  unit: "seat",
                  accountingBehavior: "reusable",
                },
                allocated: 4,
              },
            ],
          },
          replayed: false,
        });
        const read = await client.getBudget({
          budgetId: created.budget.budgetId,
        });
        expect(read.history.entries.map((entry) => entry.kind)).toEqual([
          "budget_created",
        ]);
      } finally {
        await local.close();
      }
    });

    it("replays an identical combined root command without duplicating history", async () => {
      const local = await openTestKeynes();

      try {
        const client = local.clientFor("product-fixture");
        const command = rootCommand("15000000-0000-0000-0000-000000000011", [
          rootResource("model_tokens", "token", "consumable", 100),
        ]);

        const created = await createResourceBoundRoot(client, command);
        const replay = await createResourceBoundRoot(client, command);

        expect(replay).toEqual({ ...created, replayed: true });
        const read = await client.getBudget({
          budgetId: created.budget.budgetId,
        });
        expect(read.history.entries).toHaveLength(1);
      } finally {
        await local.close();
      }
    });

    it("rejects a changed definition-bearing root body under the same command identity", async () => {
      const local = await openTestKeynes();

      try {
        const client = local.clientFor("product-fixture");
        const commandId = "15000000-0000-0000-0000-000000000021";
        const first = rootCommand(commandId, [
          rootResource("model_tokens", "token", "consumable", 100),
        ]);

        await createResourceBoundRoot(client, first);

        await expect(
          createResourceBoundRoot(
            client,
            rootCommand(commandId, [
              rootResource("model_tokens", "token", "consumable", 99),
            ]),
          ),
        ).rejects.toMatchObject({
          name: "KeynesError",
          code: "command_conflict",
          details: {
            commandId,
            existingOperation: "createBudget",
            attemptedOperation: "createBudget",
          },
        });
      } finally {
        await local.close();
      }
    });

    it("commits an attached Policy with the Resource-bound root", async () => {
      const local = await openTestKeynes();

      try {
        const client = local.clientFor("product-fixture");
        const created = await createResourceBoundRoot(
          client,
          rootCommand(
            "15000000-0000-0000-0000-000000000031",
            [rootResource("model_tokens", "token", "consumable", 100)],
            [rootPolicy()],
          ),
        );
        const resource = created.budget.resources.at(0);
        if (resource === undefined) {
          throw new Error("created root must project its bound Resource");
        }

        const result = await client.requestBudget({
          commandId: "35000000-0000-0000-0000-000000000031",
          parentBudgetId: created.budget.budgetId,
          resources: [
            { resourceTypeId: resource.resourceType.resourceTypeId, amount: 6 },
          ],
        });

        expect(result).toMatchObject({
          kind: "denied",
          reasons: [
            {
              code: "policy_ceiling",
              resourceTypeId: resource.resourceType.resourceTypeId,
              ceiling: 5,
              policyName: "root_limit",
              reason: "root_limit",
            },
          ],
        });
      } finally {
        await local.close();
      }
    });

    it("rolls back definitions, root state, and history after Resource insertion", async () => {
      const local = await openTestKeynes();

      try {
        const command = rootCommand("15000000-0000-0000-0000-000000000041", [
          rootResource("rollback_tokens", "token", "consumable", 100),
        ]);

        await expect(
          createResourceBoundRoot(
            local.clientFor("product-fixture", {
              checkpoint: "after_domain_mutation",
            }),
            command,
          ),
        ).rejects.toThrow("private rollback checkpoint: after_domain_mutation");

        const client = local.clientFor("product-fixture");
        await expect(
          client.getBudget({ budgetId: command.commandId }),
        ).rejects.toMatchObject({
          name: "KeynesError",
          code: "budget_not_found",
          details: { budgetId: command.commandId },
        });

        const retry = await createResourceBoundRoot(client, command);
        expect(retry).toMatchObject({
          kind: "created",
          budget: { budgetId: command.commandId },
          replayed: false,
        });
        const read = await client.getBudget({ budgetId: command.commandId });
        expect(read.history.entries).toHaveLength(1);
      } finally {
        await local.close();
      }
    });
  });
}

function createResourceBoundRoot(
  client: ContractClient,
  command: ResourceBoundRootCommand,
) {
  return client.createBudget(command);
}

function rootCommand(
  commandId: string,
  resources: [RootResourceInput, ...RootResourceInput[]],
  policies?: [PolicyDefinitionV1, ...PolicyDefinitionV1[]],
): ResourceBoundRootCommand {
  return {
    commandId,
    resources,
    ...(policies === undefined ? {} : { policies }),
  };
}

function rootResource(
  canonicalName: string,
  unit: string,
  accountingBehavior: ResourceDefinition["accountingBehavior"],
  amount: number,
): RootResourceInput {
  return {
    definition: { canonicalName, unit, accountingBehavior },
    amount,
  };
}

function rootPolicy(): PolicyDefinitionV1 {
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
      kind: "decimal_literal",
      value: "5",
      valueType: "numeric",
      nullable: false,
    },
    reason: {
      kind: "text_literal",
      value: "root_limit",
      valueType: "text",
      nullable: false,
    },
    where: null,
    groupBy: [],
    orderBy: ["resource", "reason", "ceiling"],
  } satisfies PolicyProgramV1;
  const canonicalSql = [
    "select requested.resource as resource,",
    "       5 as ceiling,",
    "       'root_limit' as reason",
    "from requested_resources as requested",
    "inner join available_resources as available using (resource)",
    "cross join policy_context as context",
    "order by resource asc, reason asc, ceiling asc",
    "",
  ].join("\n");
  const document = {
    kind: "keynes.policy",
    name: "root_limit",
    revision: 1,
    inputResources: ["model_tokens"],
    outputResources: ["model_tokens"],
    contextSchema: [],
    reasons: ["root_limit"],
    programVersion: POLICY_PROGRAM_VERSION,
    queryProfileVersion: POLICY_QUERY_PROFILE_VERSION,
    validatorVersion: POLICY_VALIDATOR_VERSION,
    limitsVersion: POLICY_LIMITS_VERSION,
    policyProfileDigest: POLICY_PROFILE_DIGEST,
    program,
    canonicalSql,
    sourceDigest: digest(canonicalSql),
  } satisfies Omit<PolicyDefinitionV1, "definitionDigest">;
  return { ...document, definitionDigest: digest(canonicalJson(document)) };
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
