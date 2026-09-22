import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  CreateBudgetCommand,
  DefineResourceTypeCommand,
  RequestBudgetCommand,
  SettleBudgetCommand,
} from "../../generated/types.ts";
import type { ContractTestHost, OpenContractTestHost } from "../host.ts";
import { rootResource, rootResources } from "./root-resource.ts";
export function registerReplayContractTests(
  openTestKeynes: OpenContractTestHost,
): void {
  describe("command replay", () => {
    let local: ContractTestHost;

    beforeEach(async () => {
      local = await openTestKeynes();
    });

    afterEach(async () => {
      await local.close();
    });

    it("recovers all four canonical results across principals without duplicate history", async () => {
      const product = local.clientFor("product-fixture");
      const defineCommand = {
        commandId: "13000000-0000-0000-0000-000000000001",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      } satisfies DefineResourceTypeCommand;
      const defined = await product.defineResource(defineCommand);
      const definitionReplay = await local
        .clientFor("definer-fixture")
        .defineResource(defineCommand);
      expect(definitionReplay).toEqual({ ...defined, replayed: true });

      const createCommand = {
        commandId: "23000000-0000-0000-0000-000000000001",
        ...rootResources([rootResource(defined.resourceType, 100)]),
      } satisfies CreateBudgetCommand;
      const created = await product.createBudget(createCommand);
      const journalBeforeCreateReplay = await local.inspectJournal();
      const createdReplay = await local
        .clientFor("root-fixture")
        .createBudget(createCommand);
      expect(createdReplay).toEqual({ ...created, replayed: true });
      expect(await local.inspectJournal()).toEqual(journalBeforeCreateReplay);

      const requestCommand = {
        commandId: "33000000-0000-0000-0000-000000000001",
        parentBudgetId: created.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 40 },
        ],
      } satisfies RequestBudgetCommand;
      const requested = await product.requestBudget(requestCommand);
      expect(requested.kind).toBe("approved");
      if (requested.kind !== "approved") {
        throw new Error("fixture request must be funded");
      }
      const journalBeforeRequestReplay = await local.inspectJournal();
      const requestedReplay = await local
        .clientFor("requester-fixture")
        .requestBudget(requestCommand);
      expect(requestedReplay).toEqual({ ...requested, replayed: true });
      expect(await local.inspectJournal()).toEqual(journalBeforeRequestReplay);

      const settleCommand = {
        commandId: "43000000-0000-0000-0000-000000000001",
        budgetId: requested.childBudgetId,
        usage: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 25 },
        ],
      } satisfies SettleBudgetCommand;
      const settled = await product.settleBudget(settleCommand);
      const journalBeforeReplay = await local.inspectJournal();
      const settledReplay = await local
        .clientFor("settlement-fixture")
        .settleBudget(settleCommand);
      expect(settledReplay).toEqual({ ...settled, replayed: true });
      expect(await local.inspectJournal()).toEqual(journalBeforeReplay);

      const read = await product.getBudget({
        budgetId: requested.childBudgetId,
      });
      expect(read.budget).toMatchObject({ lineageId: 2, parentLineageId: 1 });
      expect(read.history.entries).toEqual(
        expect.arrayContaining(
          [
            {
              sequence: 1,
              subject: 1,
              cause: { kind: "command" },
              movements: [
                {
                  resourceTypeId: defined.resourceType.resourceTypeId,
                  amount: 100,
                  reason: "initial_allocation",
                  from: null,
                  to: 1,
                },
              ],
            },
            {
              sequence: 2,
              subject: 2,
              parent: 1,
              cause: { kind: "command" },
              movements: [
                {
                  resourceTypeId: defined.resourceType.resourceTypeId,
                  amount: 40,
                  reason: "child_grant",
                  from: 1,
                  to: 2,
                },
              ],
            },
            {
              sequence: 3,
              subject: 2,
              cause: { kind: "command" },
              movements: [
                {
                  resourceTypeId: defined.resourceType.resourceTypeId,
                  amount: 25,
                  reason: "consumption",
                  from: 2,
                  to: null,
                },
                {
                  resourceTypeId: defined.resourceType.resourceTypeId,
                  amount: 15,
                  reason: "settlement_return",
                  from: 2,
                  to: 1,
                },
              ],
            },
          ].map((entry) => expect.objectContaining(entry)),
        ),
      );
      expect(read.history.entries.map((entry) => entry.kind)).toEqual([
        "budget_created",
        "request_approved",
        "budget_settlement_recorded",
      ]);
      expect(read.budget.resources[0]).toMatchObject({
        directUsage: 25,
        subtreeObservedUsage: 25,
      });
    });

    it("replays a structurally equal command across principals despite object key order", async () => {
      const commandId = "13000000-0000-0000-0000-000000000081";
      const first = await local.clientFor("product-fixture").defineResource({
        commandId,
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });

      const replay = await local.clientFor("definer-fixture").defineResource({
        commandId,
        definition: {
          accountingBehavior: "consumable",
          unit: "token",
          canonicalName: "model_tokens",
        },
      });

      expect(replay).toEqual({ ...first, replayed: true });
    });

    it("recovers Resource definition after its committed response is lost", async () => {
      const command = {
        commandId: "13000000-0000-0000-0000-000000000041",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      } satisfies DefineResourceTypeCommand;

      await expect(
        local
          .clientFor("product-fixture", { dropResponseAfterCommitOnce: true })
          .defineResource(command),
      ).rejects.toThrow();

      const recovered = await local
        .clientFor("definer-fixture")
        .defineResource(command);
      expect(recovered).toMatchObject({
        kind: "defined",
        resourceType: {
          resourceTypeId: command.commandId,
          canonicalName: command.definition.canonicalName,
        },
        definitionEvidence: { commandId: command.commandId },
        replayed: true,
      });
      const repeated = await local
        .clientFor("definer-fixture")
        .defineResource(command);
      expect(repeated).toEqual(recovered);
    });

    it("recovers root allocation after its committed response is lost", async () => {
      const product = local.clientFor("product-fixture");
      const defined = await product.defineResource({
        commandId: "13000000-0000-0000-0000-000000000051",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const command = {
        commandId: "23000000-0000-0000-0000-000000000051",
        ...rootResources([rootResource(defined.resourceType, 100)]),
      } satisfies CreateBudgetCommand;

      await expect(
        local
          .clientFor("product-fixture", { dropResponseAfterCommitOnce: true })
          .createBudget(command),
      ).rejects.toThrow();

      const recovered = await local
        .clientFor("root-fixture")
        .createBudget(command);
      expect(recovered).toMatchObject({
        kind: "created",
        budget: { budgetId: command.commandId },
        replayed: true,
      });
      const read = await product.getBudget({ budgetId: command.commandId });
      expect(read.budget).toMatchObject(recovered.budget);
      expect(read.history.entries).toHaveLength(1);
    });

    it("recovers an approved request after its committed response is lost", async () => {
      const product = local.clientFor("product-fixture");
      const defined = await product.defineResource({
        commandId: "13000000-0000-0000-0000-000000000061",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const root = await product.createBudget({
        commandId: "23000000-0000-0000-0000-000000000061",
        ...rootResources([rootResource(defined.resourceType, 100)]),
      });
      const command = {
        commandId: "33000000-0000-0000-0000-000000000061",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 40 },
        ],
      } satisfies RequestBudgetCommand;

      await expect(
        local
          .clientFor("product-fixture", { dropResponseAfterCommitOnce: true })
          .requestBudget(command),
      ).rejects.toThrow();

      const recovered = await local
        .clientFor("requester-fixture")
        .requestBudget(command);
      expect(recovered).toMatchObject({
        kind: "approved",
        childBudgetId: command.commandId,
        replayed: true,
      });
      const read = await product.getBudget({ budgetId: command.commandId });
      expect(read.history.entries.map((entry) => entry.kind)).toEqual([
        "budget_created",
        "request_approved",
      ]);
      const parent = await product.getBudget({
        budgetId: root.budget.budgetId,
      });
      expect(parent.budget.resources[0]).toMatchObject({
        committed: 40,
        available: 60,
      });
    });

    it("recovers settlement after its committed response is lost", async () => {
      const product = local.clientFor("product-fixture");
      const defined = await product.defineResource({
        commandId: "13000000-0000-0000-0000-000000000071",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const root = await product.createBudget({
        commandId: "23000000-0000-0000-0000-000000000071",
        ...rootResources([rootResource(defined.resourceType, 100)]),
      });
      const request = await product.requestBudget({
        commandId: "33000000-0000-0000-0000-000000000071",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 40 },
        ],
      });
      expect(request.kind).toBe("approved");
      if (request.kind !== "approved") {
        throw new Error("fixture request must be funded");
      }
      const command = {
        commandId: "43000000-0000-0000-0000-000000000071",
        budgetId: request.childBudgetId,
        usage: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 25 },
        ],
      } satisfies SettleBudgetCommand;

      await expect(
        local
          .clientFor("product-fixture", { dropResponseAfterCommitOnce: true })
          .settleBudget(command),
      ).rejects.toThrow();

      const recovered = await local
        .clientFor("settlement-fixture")
        .settleBudget(command);
      expect(recovered).toMatchObject({
        kind: "settled",
        budget: { budgetId: request.childBudgetId },
        newlyKnown: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 25 },
        ],
        replayed: true,
      });
      const read = await product.getBudget({
        budgetId: request.childBudgetId,
      });
      expect(read.budget).toMatchObject(recovered.budget);
      expect(read.history.entries.map((entry) => entry.kind)).toEqual([
        "budget_created",
        "request_approved",
        "budget_settlement_recorded",
      ]);
    });

    it("rejects changed bodies for each mutation, including across principals", async () => {
      const product = local.clientFor("product-fixture");
      const defined = await product.defineResource({
        commandId: "13000000-0000-0000-0000-000000000011",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      await expectCommandConflict(
        local.clientFor("definer-fixture").defineResource({
          commandId: "13000000-0000-0000-0000-000000000011",
          definition: {
            canonicalName: "model_tokens",
            unit: "credit",
            accountingBehavior: "consumable",
          },
        }),
        "13000000-0000-0000-0000-000000000011",
        "defineResource",
        "defineResource",
      );

      const root = await product.createBudget({
        commandId: "23000000-0000-0000-0000-000000000011",
        ...rootResources([rootResource(defined.resourceType, 100)]),
      });
      await expectCommandConflict(
        local.clientFor("root-fixture").createBudget({
          commandId: root.budget.budgetId,
          ...rootResources([rootResource(defined.resourceType, 99)]),
        }),
        root.budget.budgetId,
        "createBudget",
        "createBudget",
      );

      const request = await product.requestBudget({
        commandId: "33000000-0000-0000-0000-000000000011",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 40 },
        ],
      });
      expect(request.kind).toBe("approved");
      if (request.kind !== "approved") {
        throw new Error("fixture request must be funded");
      }
      await expectCommandConflict(
        local.clientFor("requester-fixture").requestBudget({
          commandId: request.commandId,
          parentBudgetId: root.budget.budgetId,
          resources: [
            { resourceTypeId: defined.resourceType.resourceTypeId, amount: 39 },
          ],
        }),
        request.commandId,
        "requestBudget",
        "requestBudget",
      );

      const settlement = await product.settleBudget({
        commandId: "43000000-0000-0000-0000-000000000011",
        budgetId: request.childBudgetId,
        usage: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 25 },
        ],
      });
      const journalBeforeConflict = await local.inspectJournal();
      const inspectionBeforeConflict = await product.getBudget({
        budgetId: request.childBudgetId,
      });
      await expectCommandConflict(
        local.clientFor("settlement-fixture").settleBudget({
          commandId: "43000000-0000-0000-0000-000000000011",
          budgetId: request.childBudgetId,
          usage: [
            { resourceTypeId: defined.resourceType.resourceTypeId, amount: 24 },
          ],
        }),
        "43000000-0000-0000-0000-000000000011",
        "settleBudget",
        "settleBudget",
      );
      expect(await local.inspectJournal()).toEqual(journalBeforeConflict);
      const unchanged = await product.getBudget({
        budgetId: request.childBudgetId,
      });
      expect(unchanged).toEqual(inspectionBeforeConflict);
      expect(unchanged.budget).toMatchObject({
        lineageId: 2,
        parentLineageId: 1,
      });
      expect(unchanged.history.entries).toEqual(
        expect.arrayContaining(
          [
            {
              sequence: 3,
              subject: 2,
              cause: { kind: "command" },
              movements: [
                {
                  resourceTypeId: defined.resourceType.resourceTypeId,
                  amount: 25,
                  reason: "consumption",
                  from: 2,
                  to: null,
                },
                {
                  resourceTypeId: defined.resourceType.resourceTypeId,
                  amount: 15,
                  reason: "settlement_return",
                  from: 2,
                  to: 1,
                },
              ],
            },
          ].map((entry) => expect.objectContaining(entry)),
        ),
      );
      expect(unchanged.budget).toMatchObject(settlement.budget);
      expect(unchanged.history.entries).toHaveLength(3);
    });

    it("rejects reuse by a different operation", async () => {
      const client = local.clientFor("product-fixture");
      const defined = await client.defineResource({
        commandId: "13000000-0000-0000-0000-000000000021",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const root = await client.createBudget({
        commandId: "23000000-0000-0000-0000-000000000021",
        ...rootResources([rootResource(defined.resourceType, 10)]),
      });

      await expectCommandConflict(
        client.requestBudget({
          commandId: root.budget.budgetId,
          parentBudgetId: root.budget.budgetId,
          resources: [
            { resourceTypeId: defined.resourceType.resourceTypeId, amount: 1 },
          ],
        }),
        root.budget.budgetId,
        "createBudget",
        "requestBudget",
      );
      const read = await client.getBudget({ budgetId: root.budget.budgetId });
      expect(read.budget.resources[0]).toMatchObject({
        available: 10,
        committed: 0,
      });
      expect(read.history.entries).toHaveLength(1);
    });

    it("rejects reuse against a different target", async () => {
      const client = local.clientFor("product-fixture");
      const defined = await client.defineResource({
        commandId: "13000000-0000-0000-0000-000000000031",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const root = await client.createBudget({
        commandId: "23000000-0000-0000-0000-000000000031",
        ...rootResources([rootResource(defined.resourceType, 20)]),
      });
      const first = await client.requestBudget({
        commandId: "33000000-0000-0000-0000-000000000031",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 10 },
        ],
      });
      const second = await client.requestBudget({
        commandId: "33000000-0000-0000-0000-000000000032",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 10 },
        ],
      });
      expect(first.kind).toBe("approved");
      expect(second.kind).toBe("approved");
      if (first.kind !== "approved" || second.kind !== "approved") {
        throw new Error("fixture requests must be funded");
      }
      const commandId = "43000000-0000-0000-0000-000000000031";
      await client.settleBudget({
        commandId,
        budgetId: first.childBudgetId,
        usage: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 5 },
        ],
      });

      await expectCommandConflict(
        client.settleBudget({
          commandId,
          budgetId: second.childBudgetId,
          usage: [
            { resourceTypeId: defined.resourceType.resourceTypeId, amount: 5 },
          ],
        }),
        commandId,
        "settleBudget",
        "settleBudget",
      );
      const untouched = await client.getBudget({
        budgetId: second.childBudgetId,
      });
      expect(untouched.budget).toMatchObject({
        lifecycle: "active",
        resources: [{ directUsage: null }],
      });
    });

    it("replays reordered definitions and amounts with the original result", async () => {
      const client = local.clientFor("product-fixture");
      const definitions = {
        modelTokens: { unit: "token", accountingBehavior: "consumable" },
        reviewerSeats: { unit: "seat", accountingBehavior: "reusable" },
      } satisfies CreateBudgetCommand["definitions"];
      await client.defineResources({
        commandId: "13000000-0000-0000-0000-000000000091",
        definitions,
      });
      const command = {
        commandId: "23000000-0000-0000-0000-000000000091",
        definitions,
        amounts: { modelTokens: 10, reviewerSeats: 0 },
      } satisfies CreateBudgetCommand;
      const created = await client.createBudget(command);
      const replay = await local.clientFor("root-fixture").createBudget({
        commandId: command.commandId,
        definitions: {
          reviewerSeats: definitions.reviewerSeats,
          modelTokens: definitions.modelTokens,
        },
        amounts: { reviewerSeats: 0, modelTokens: 10 },
      });
      expect(replay).toEqual({ ...created, replayed: true });
    });

    it("binds caller decision evidence into request replay identity", async () => {
      const client = local.clientFor("product-fixture");
      const defined = await client.defineResource({
        commandId: "13000000-0000-0000-0000-000000000095",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const root = await client.createBudget({
        commandId: "23000000-0000-0000-0000-000000000095",
        ...rootResources([rootResource(defined.resourceType, 10)]),
      });
      const request = {
        commandId: "33000000-0000-0000-0000-000000000095",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 4 },
        ],
        decisionEvidence: { rule: "pro", revision: 1 },
      } satisfies RequestBudgetCommand;
      const approved = await client.requestBudget(request);
      expect(approved.kind).toBe("approved");
      await expect(
        local.clientFor("requester-fixture").requestBudget({
          ...request,
          decisionEvidence: { revision: 1, rule: "pro" },
        }),
      ).resolves.toEqual({ ...approved, replayed: true });
      await expectCommandConflict(
        local.clientFor("requester-fixture").requestBudget({
          ...request,
          decisionEvidence: { rule: "pro", revision: 2 },
        }),
        request.commandId,
        "requestBudget",
        "requestBudget",
      );
      await expectCommandConflict(
        local.clientFor("requester-fixture").requestBudget({
          commandId: request.commandId,
          parentBudgetId: request.parentBudgetId,
          resources: request.resources,
        }),
        request.commandId,
        "requestBudget",
        "requestBudget",
      );
    });

    it("replays a recorded denial after availability is restored", async () => {
      const client = local.clientFor("product-fixture");
      const defined = await client.defineResource({
        commandId: "13000000-0000-0000-0000-000000000096",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const root = await client.createBudget({
        commandId: "23000000-0000-0000-0000-000000000096",
        ...rootResources([rootResource(defined.resourceType, 10)]),
      });
      const consuming = await client.requestBudget({
        commandId: "33000000-0000-0000-0000-000000000096",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 10 },
        ],
      });
      if (consuming.kind !== "approved") {
        throw new Error("fixture request must be funded");
      }
      const deniedCommand = {
        commandId: "33000000-0000-0000-0000-000000000097",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 1 },
        ],
        decisionEvidence: { rule: "pro", revision: 1 },
      } satisfies RequestBudgetCommand;
      const denied = await client.requestBudget(deniedCommand);
      expect(denied.kind).toBe("denied");

      await client.settleBudget({
        commandId: "43000000-0000-0000-0000-000000000096",
        budgetId: consuming.childBudgetId,
        usage: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 0 },
        ],
      });
      const restored = await client.getBudget({
        budgetId: root.budget.budgetId,
      });
      expect(restored.budget.resources[0]).toMatchObject({ available: 10 });

      await expect(
        local.clientFor("requester-fixture").requestBudget(deniedCommand),
      ).resolves.toEqual({ ...denied, replayed: true });
    });

    it("replays the original settling target after a child finalizes its ancestor", async () => {
      const client = local.clientFor("product-fixture");
      const defined = await client.defineResource({
        commandId: "13000000-0000-0000-0000-000000000098",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const root = await client.createBudget({
        commandId: "23000000-0000-0000-0000-000000000098",
        ...rootResources([rootResource(defined.resourceType, 10)]),
      });
      const child = await client.requestBudget({
        commandId: "33000000-0000-0000-0000-000000000098",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 10 },
        ],
      });
      if (child.kind !== "approved") {
        throw new Error("fixture request must be funded");
      }
      const settlingCommand = {
        commandId: "43000000-0000-0000-0000-000000000098",
        budgetId: root.budget.budgetId,
        usage: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 0 },
        ],
      } satisfies SettleBudgetCommand;
      const settling = await client.settleBudget(settlingCommand);
      expect(settling).toMatchObject({ kind: "settling" });

      await client.settleBudget({
        commandId: "43000000-0000-0000-0000-000000000099",
        budgetId: child.childBudgetId,
        usage: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 0 },
        ],
      });
      expect(
        (await client.getBudget({ budgetId: root.budget.budgetId })).budget,
      ).toMatchObject({ lifecycle: "settled", resources: [{ available: 0 }] });
      const journalBeforeTargetReplay = await local.inspectJournal();
      await expect(
        local.clientFor("settlement-fixture").settleBudget(settlingCommand),
      ).resolves.toEqual({ ...settling, replayed: true });
      expect(await local.inspectJournal()).toEqual(journalBeforeTargetReplay);
    });

    it("rejects omitted explicit-zero membership under the same command identity", async () => {
      const client = local.clientFor("product-fixture");
      const definitions = {
        modelTokens: { unit: "token", accountingBehavior: "consumable" },
        reviewerSeats: { unit: "seat", accountingBehavior: "reusable" },
      } satisfies CreateBudgetCommand["definitions"];
      await client.defineResources({
        commandId: "13000000-0000-0000-0000-000000000092",
        definitions,
      });
      const command = {
        commandId: "23000000-0000-0000-0000-000000000092",
        definitions,
        amounts: { modelTokens: 10, reviewerSeats: 0 },
      } satisfies CreateBudgetCommand;
      await client.createBudget(command);
      await expectCommandConflict(
        client.createBudget({
          commandId: command.commandId,
          definitions: { modelTokens: definitions.modelTokens },
          amounts: { modelTokens: 10 },
        }),
        command.commandId,
        "createBudget",
        "createBudget",
      );
    });

    it("creates independent roots for new identities and replays the original result after settlement", async () => {
      const client = local.clientFor("product-fixture");
      const defined = await client.defineResource({
        commandId: "13000000-0000-0000-0000-000000000093",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const command = {
        commandId: "23000000-0000-0000-0000-000000000093",
        ...rootResources([rootResource(defined.resourceType, 10)]),
      } satisfies CreateBudgetCommand;
      const first = await client.createBudget(command);
      const second = await client.createBudget({
        ...command,
        commandId: "23000000-0000-0000-0000-000000000094",
      });
      expect(second.budget.budgetId).not.toBe(first.budget.budgetId);
      await client.settleBudget({
        commandId: "43000000-0000-0000-0000-000000000093",
        budgetId: first.budget.budgetId,
        usage: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 4 },
        ],
      });
      expect(
        await local.clientFor("root-fixture").createBudget(command),
      ).toEqual({
        ...first,
        replayed: true,
      });
    });
  });
}

async function expectCommandConflict(
  operation: Promise<unknown>,
  commandId: string,
  existingOperation: string,
  attemptedOperation: string,
): Promise<void> {
  await expect(operation).rejects.toMatchObject({
    name: "KeynesError",
    code: "command_conflict",
    details: { commandId, existingOperation, attemptedOperation },
  });
}
