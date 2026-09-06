import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  CreateBudgetCommand,
  PolicyDefinitionV1,
  ResourceDefinition,
  RootResourceInput,
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
import { rootResources } from "./root-resource.ts";

export function registerResourceBoundRootContractTests(
  openTestKeynes: OpenContractTestHost,
): void {
  describe("Resource-bound root creation", () => {
    const definitions = {
      modelTokens: { unit: "token", accountingBehavior: "consumable" },
      reviewerSeats: { unit: "seat", accountingBehavior: "reusable" },
    } satisfies Record<string, Omit<ResourceDefinition, "canonicalName">>;

    it("creates raw and bound subsets while preserving the complete binding", async () => {
      const host = await openTestKeynes();
      try {
        const client = host.clientFor("product-fixture");
        const binding = await client.defineResources({
          commandId: id(1),
          definitions,
        });
        const before = await host.inspectState();
        const bound = await host.clientFor("allocator-fixture").createBudget({
          commandId: id(2),
          resources: {
            kind: "binding",
            bindingReference: binding.bindingReference,
          },
          allocation: { modelTokens: 10 },
        });
        expect(bound.budget.resources).toEqual([
          expect.objectContaining({
            resourceType: binding.resources[0].resourceType,
            allocated: 10,
          }),
        ]);
        expect(await host.inspectState()).toEqual({
          ...before,
          commands: before.commands + 1,
          budgets: 1,
          holdings: 1,
          history: 1,
          quantity: 10,
        });
        const raw = await client.createBudget({
          commandId: id(3),
          resources: { kind: "definitions", definitions },
          allocation: { reviewerSeats: 4 },
        });
        expect(raw.budget.resources).toEqual([
          expect.objectContaining({
            resourceType: binding.resources[1].resourceType,
            allocated: 4,
          }),
        ]);
        const reused = await client.defineResources({
          commandId: id(4),
          definitions,
        });
        expect(reused.resources).toEqual(binding.resources);
      } finally {
        await host.close();
      }
    });

    it("consumes a binding without any Resource definition writes", async () => {
      const host = await openTestKeynes();
      try {
        const client = host.clientFor("product-fixture");
        const binding = await client.defineResources({
          commandId: id(16),
          definitions,
        });
        const guarded = host.clientFor("product-fixture", {
          forbidResourceWrites: true,
        });
        await expect(
          guarded.defineResources({
            commandId: id(17),
            definitions: {
              apiCalls: { unit: "call", accountingBehavior: "consumable" },
            },
          }),
        ).rejects.toThrow("private Resource write prohibition");
        const before = await host.inspectState();
        const created = await guarded.createBudget({
          commandId: id(18),
          resources: {
            kind: "binding",
            bindingReference: binding.bindingReference,
          },
          allocation: { modelTokens: 10 },
        });
        expect(created.budget.resources).toEqual([
          expect.objectContaining({
            resourceType: binding.resources[0].resourceType,
            allocated: 10,
          }),
        ]);
        expect((await host.inspectState()).resources).toBe(before.resources);
      } finally {
        await host.close();
      }
    });

    it("reconciles only allocated raw definitions and preserves unallocated meaning in replay", async () => {
      const host = await openTestKeynes();
      try {
        const client = host.clientFor("product-fixture");
        const command = {
          commandId: id(5),
          resources: { kind: "definitions", definitions },
          allocation: { modelTokens: 10 },
        } satisfies CreateBudgetCommand;
        const first = await client.createBudget(command);
        expect((await host.inspectState()).resources).toBe(1);
        expect(first.budget.resources).toHaveLength(1);
        expect(await client.createBudget(command)).toEqual({
          ...first,
          replayed: true,
        });
        const before = await host.inspectState();
        await expect(
          client.createBudget({
            ...command,
            resources: {
              kind: "definitions",
              definitions: {
                ...definitions,
                reviewerSeats: {
                  unit: "different",
                  accountingBehavior: "reusable",
                },
              },
            },
          }),
        ).rejects.toMatchObject({ code: "command_conflict" });
        expect(await host.inspectState()).toEqual(before);
      } finally {
        await host.close();
      }
    });

    it("rejects unknown raw and bound allocation names without partial state", async () => {
      const host = await openTestKeynes();
      try {
        const client = host.clientFor("product-fixture");
        const binding = await client.defineResources({
          commandId: id(6),
          definitions,
        });
        const before = await host.inspectState();
        for (const [index, resources] of [
          { kind: "definitions", definitions },
          { kind: "binding", bindingReference: binding.bindingReference },
        ].entries()) {
          await expect(
            Reflect.apply(client.createBudget, client, [
              {
                commandId: id(7 + index),
                resources,
                allocation: { unknownResource: 1 },
              },
            ]),
          ).rejects.toMatchObject({ code: "invalid_command" });
          expect(await host.inspectState()).toEqual(before);
        }
      } finally {
        await host.close();
      }
    });

    it("validates malformed unallocated raw definitions before creating a root", async () => {
      const host = await openTestKeynes();
      try {
        const client = host.clientFor("product-fixture");
        const before = await host.inspectState();
        const malformed = [
          null,
          { unit: "seat", accountingBehavior: "reusable", unknown: null },
          { unit: "", accountingBehavior: "reusable" },
          { unit: "seat", accountingBehavior: "refillable" },
        ];
        for (const [index, reviewerSeats] of malformed.entries()) {
          await expect(
            Reflect.apply(client.createBudget, client, [
              {
                commandId: id(10 + index),
                resources: {
                  kind: "definitions",
                  definitions: { ...definitions, reviewerSeats },
                },
                allocation: { modelTokens: 10 },
              },
            ]),
          ).rejects.toMatchObject({ code: "invalid_command" });
          expect(await host.inspectState()).toEqual(before);
        }
      } finally {
        await host.close();
      }
    });

    it("rolls back failed bound creation while preserving its committed receipt", async () => {
      const host = await openTestKeynes();
      try {
        const client = host.clientFor("product-fixture");
        const binding = await client.defineResources({
          commandId: id(14),
          definitions,
        });
        const before = await host.inspectState();
        const command = {
          commandId: id(15),
          resources: {
            kind: "binding",
            bindingReference: binding.bindingReference,
          },
          allocation: { modelTokens: 10 },
        } satisfies CreateBudgetCommand;
        await expect(
          host
            .clientFor("product-fixture", {
              checkpoint: "after_domain_mutation",
            })
            .createBudget(command),
        ).rejects.toThrow("private rollback checkpoint: after_domain_mutation");
        expect(await host.inspectState()).toEqual(before);
        expect(await client.createBudget(command)).toMatchObject({
          kind: "created",
          replayed: false,
        });
        expect(
          (await client.defineResources({ commandId: id(14), definitions }))
            .bindingReference,
        ).toBe(binding.bindingReference);
      } finally {
        await host.close();
      }
    });

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
        const [modelTokens] = created.budget.resources;
        if (modelTokens === undefined) {
          throw new Error("created root must project its bound Resources");
        }
        expect(modelTokens.resourceType.resourceTypeId).not.toBe(
          command.commandId,
        );
        const definition = await client.defineResource({
          commandId: "15000000-0000-0000-0000-000000000002",
          definition: {
            canonicalName: "model_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
        });
        expect(definition.definitionEvidence.commandId).toBe(command.commandId);
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
          context: {},
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
              checkpoint: "after_resource_insertion",
            }),
            command,
          ),
        ).rejects.toThrow(
          "private rollback checkpoint: after_resource_insertion",
        );

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
  command: CreateBudgetCommand,
) {
  return client.createBudget(command);
}

function rootCommand(
  commandId: string,
  resources: [RootResourceInput, ...RootResourceInput[]],
  policies?: [PolicyDefinitionV1, ...PolicyDefinitionV1[]],
): CreateBudgetCommand {
  return {
    commandId,
    ...rootResources(resources),
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

function id(suffix: number): string {
  return `17000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
}
