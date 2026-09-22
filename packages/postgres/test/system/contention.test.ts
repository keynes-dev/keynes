import { setTimeout } from "node:timers/promises";
import { rootResources } from "@keynes/database/contract-tests";
import { describe, expect, it } from "vitest";

import type { ContractClient } from "@keynes/database/contract-tests";
import {
  openNativeTestKeynes,
  type NativeTestKeynes,
} from "./support/test-keynes.js";

const RESOURCE_COMMAND_ID = "15000000-0000-4000-8000-000000000001";
const ROOT_BUDGET_ID = "25000000-0000-4000-8000-000000000001";
const FIRST_REQUEST_ID = "35000000-0000-4000-8000-000000000001";
const SECOND_REQUEST_ID = "35000000-0000-4000-8000-000000000002";
const SETTLEMENT_ID = "45000000-0000-4000-8000-000000000001";
const COMPETING_ROOT_ID = "25000000-0000-4000-8000-000000000002";
const ZETA_DEFINITION_ID = "11000000-0000-4000-8000-000000000001";
const ALPHA_DEFINITION_ID = "91000000-0000-4000-8000-000000000001";
const CANONICAL_ORDER_ROOT_ID = "27000000-0000-4000-8000-000000000001";
const EXACT_ROOT_ID = "28000000-0000-4000-8000-000000000001";
const CONFLICTING_ROOT_ID = "28000000-0000-4000-8000-000000000002";
const CONFIGURED_ROOT_DEFINITION_ID = "18000000-0000-4000-8000-000000000001";
const FIRST_CHILD_SETTLEMENT_ID = "45000000-0000-4000-8000-000000000002";
const SECOND_CHILD_SETTLEMENT_ID = "45000000-0000-4000-8000-000000000003";

type RequestBudgetCommand = Parameters<ContractClient["requestBudget"]>[0];

describe("native PostgreSQL contention", () => {
  it("replays an exact configured root with explicit zero membership after waiting for commit", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const definitions = configuredRootDefinitions();
      await keynes.clientFor("product-fixture").defineResources({
        commandId: CONFIGURED_ROOT_DEFINITION_ID,
        definitions,
      });
      const first = await keynes.beginAttempt("product-fixture");
      const second = await keynes.beginAttempt("product-fixture");
      const stored = await first.client.createBudget({
        commandId: EXACT_ROOT_ID,
        definitions,
        amounts: { modelTokens: 10, reviewerSeats: 0 },
      });
      const replay = second.client.createBudget({
        commandId: EXACT_ROOT_ID,
        definitions: {
          reviewerSeats: definitions.reviewerSeats,
          modelTokens: definitions.modelTokens,
        },
        amounts: { reviewerSeats: 0, modelTokens: 10 },
      });

      await keynes.requireBlockedBy(second.backendPid, first.backendPid);
      await first.commit();
      await expect(replay).resolves.toEqual({ ...stored, replayed: true });
      await second.commit();
      expect(stored.budget.resources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ allocated: 10, available: 10 }),
          expect.objectContaining({ allocated: 0, available: 0 }),
        ]),
      );
      expect(await keynes.inspectState()).toEqual({
        resources: 2,
        commands: 2,
        budgets: 1,
        holdings: 2,
        history: 1,
        quantity: 10,
      });
    } finally {
      await keynes.close();
    }
  });

  it("rejects a conflicting configured root after waiting for commit without duplicate allowances", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const definitions = configuredRootDefinitions();
      await keynes.clientFor("product-fixture").defineResources({
        commandId: CONFIGURED_ROOT_DEFINITION_ID,
        definitions,
      });
      const first = await keynes.beginAttempt("product-fixture");
      const second = await keynes.beginAttempt("product-fixture");
      const stored = await first.client.createBudget({
        commandId: CONFLICTING_ROOT_ID,
        definitions,
        amounts: { modelTokens: 10, reviewerSeats: 0 },
      });
      const conflicting = second.client.createBudget({
        commandId: CONFLICTING_ROOT_ID,
        definitions,
        amounts: { modelTokens: 10, reviewerSeats: 1 },
      });

      const rejected = expect(conflicting).rejects.toMatchObject({
        code: "command_conflict",
      });
      await keynes.requireBlockedBy(second.backendPid, first.backendPid);
      await first.commit();
      // Exercise rejection arriving before the test resumes awaiting the result.
      await setTimeout(25);
      await rejected;
      await second.commit();
      expect(stored.budget.resources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ allocated: 10, available: 10 }),
          expect.objectContaining({ allocated: 0, available: 0 }),
        ]),
      );
      expect(await keynes.inspectState()).toEqual({
        resources: 2,
        commands: 2,
        budgets: 1,
        holdings: 2,
        history: 1,
        quantity: 10,
      });
    } finally {
      await keynes.close();
    }
  });

  it.each([false, true])(
    "orders opposite-input batch overlap with conflict=%s",
    async (conflict) => {
      const keynes = await openNativeTestKeynes();
      try {
        const first = await keynes.beginAttempt("product-fixture");
        const second = await keynes.beginAttempt("product-fixture");
        const stored = await first.client.defineResources({
          commandId: RESOURCE_COMMAND_ID,
          definitions: {
            alphaTokens: { unit: "token", accountingBehavior: "consumable" },
            zetaSeats: { unit: "seat", accountingBehavior: "reusable" },
          },
        });
        const competing = second.client.defineResources({
          commandId: ALPHA_DEFINITION_ID,
          definitions: {
            zetaSeats: {
              unit: conflict ? "conflicting-seat" : "seat",
              accountingBehavior: "reusable",
            },
            ...(conflict
              ? {
                  betaNew: {
                    unit: "call",
                    accountingBehavior: "consumable" as const,
                  },
                }
              : {}),
            alphaTokens: { unit: "token", accountingBehavior: "consumable" },
          },
        });
        const outcome = conflict
          ? expect(competing).rejects.toMatchObject({
              code: "resource_type_conflict",
            })
          : expect(competing).resolves.toMatchObject({
              resources: stored.resources,
              replayed: false,
            });
        await keynes.requireBlockedBy(second.backendPid, first.backendPid);
        await first.commit();
        await outcome;
        await second.commit();
        expect(await keynes.inspectState()).toEqual({
          resources: 2,
          commands: conflict ? 1 : 2,
          budgets: 0,
          holdings: 0,
          history: 0,
          quantity: 0,
        });
      } finally {
        await keynes.close();
      }
    },
  );

  it.each(["singleton", "raw creation"])(
    "preserves original Resource evidence when a batch waits behind %s",
    async (kind) => {
      const keynes = await openNativeTestKeynes();
      try {
        const first = await keynes.beginAttempt("product-fixture");
        const second = await keynes.beginAttempt("product-fixture");
        const definition = {
          canonicalName: "alpha_tokens",
          unit: "token",
          accountingBehavior: "consumable" as const,
        };
        const priorResource =
          kind === "singleton"
            ? (
                await first.client.defineResource({
                  commandId: RESOURCE_COMMAND_ID,
                  definition,
                })
              ).resourceType
            : (await first.client.defineResources({
                commandId: RESOURCE_COMMAND_ID,
                definitions: {
                  alphaTokens: {
                    unit: "token",
                    accountingBehavior: "consumable",
                  },
                },
              }),
              await first.client.createBudget({
                commandId: ROOT_BUDGET_ID,
                ...rootResources([{ definition, amount: 7 }]),
              })).budget.resources[0].resourceType;
        const competing = second.client.defineResources({
          commandId: ALPHA_DEFINITION_ID,
          definitions: {
            zetaSeats: { unit: "seat", accountingBehavior: "reusable" },
            alphaTokens: { unit: "token", accountingBehavior: "consumable" },
          },
        });
        await keynes.requireBlockedBy(second.backendPid, first.backendPid);
        await first.commit();
        const result = await competing;
        await second.commit();
        expect(result.resources[0]).toMatchObject({
          resourceType: priorResource,
          definitionEvidence: { commandId: RESOURCE_COMMAND_ID },
        });
        expect(await keynes.inspectState()).toEqual({
          resources: 2,
          commands: kind === "singleton" ? 2 : 3,
          budgets: kind === "singleton" ? 0 : 1,
          holdings: kind === "singleton" ? 0 : 1,
          history: kind === "singleton" ? 0 : 1,
          quantity: kind === "singleton" ? 0 : 7,
        });
      } finally {
        await keynes.close();
      }
    },
  );

  it("replays one definition receipt when same-command contenders wait for commit", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const first = await keynes.beginAttempt("product-fixture");
      const second = await keynes.beginAttempt("product-fixture");
      const command = {
        commandId: RESOURCE_COMMAND_ID,
        definitions: {
          modelTokens: {
            unit: "token",
            accountingBehavior: "consumable" as const,
          },
        },
      };
      const stored = await first.client.defineResources(command);
      const competing = second.client.defineResources(command);
      await keynes.requireBlockedBy(second.backendPid, first.backendPid);
      await first.commit();
      await expect(competing).resolves.toEqual({ ...stored, replayed: true });
      await second.commit();
      expect(await keynes.inspectState()).toEqual({
        resources: 1,
        commands: 1,
        budgets: 0,
        holdings: 0,
        history: 0,
        quantity: 0,
      });
    } finally {
      await keynes.close();
    }
  });

  it("funds at most one sibling after proving the second request waits", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId } = await seedRoot(keynes);
      const first = await keynes.beginAttempt("requester-fixture");
      const second = await keynes.beginAttempt("requester-fixture");
      expect(first.backendPid).not.toBe(second.backendPid);
      const fundedEvidence = { approved: true, source: "first" };
      const deniedEvidence = { approved: true, source: "second" };

      const funded = await Reflect.apply(
        first.client.requestBudget,
        first.client,
        [
          {
            commandId: FIRST_REQUEST_ID,
            parentBudgetId: ROOT_BUDGET_ID,
            resources: [{ resourceTypeId, amount: 7 }],
            decisionEvidence: fundedEvidence,
          },
        ],
      );
      const competing = Reflect.apply(
        second.client.requestBudget,
        second.client,
        [
          {
            commandId: SECOND_REQUEST_ID,
            parentBudgetId: ROOT_BUDGET_ID,
            resources: [{ resourceTypeId, amount: 7 }],
            decisionEvidence: deniedEvidence,
          },
        ],
      );

      await keynes.requireBlockedBy(second.backendPid, first.backendPid);
      await first.commit();
      const denied = await competing;
      await second.commit();

      expect(funded).toMatchObject({
        kind: "approved",
        decisionEvidence: fundedEvidence,
      });
      expect(denied).toMatchObject({
        kind: "denied",
        reasons: [{ code: "insufficient_available", available: 3 }],
        decisionEvidence: deniedEvidence,
      });
      const final = await keynes
        .clientFor("reader-fixture")
        .getBudget({ budgetId: ROOT_BUDGET_ID });
      expect(final.budget.resources[0]).toMatchObject({
        allocated: 10,
        committed: 7,
        available: 3,
      });
      expect(
        final.history.entries.filter(
          (entry) => entry.kind === "request_approved",
        ),
      ).toEqual([
        expect.objectContaining({ decisionEvidence: fundedEvidence }),
      ]);
      expect(
        final.history.entries.filter(
          (entry) => entry.kind === "request_denied",
        ),
      ).toEqual([
        expect.objectContaining({ decisionEvidence: deniedEvidence }),
      ]);
    } finally {
      await keynes.close();
    }
  });

  it("rejects a request that waits behind a committed settlement seal", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId } = await seedRoot(keynes);
      const settlement = await keynes.beginAttempt("settlement-fixture");
      const request = await keynes.beginAttempt("requester-fixture");

      await settlement.client.settleBudget({
        commandId: SETTLEMENT_ID,
        budgetId: ROOT_BUDGET_ID,
        usage: [{ resourceTypeId, amount: 0 }],
      });
      const competing = request.client.requestBudget({
        commandId: FIRST_REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId, amount: 5 }],
      });
      const rejected = expect(competing).rejects.toMatchObject({
        code: "budget_not_active",
        details: { budgetId: ROOT_BUDGET_ID, lifecycle: "settled" },
      });

      await keynes.requireBlockedBy(request.backendPid, settlement.backendPid);
      await settlement.commit();
      await rejected;
      await request.commit();

      const final = await keynes
        .clientFor("reader-fixture")
        .getBudget({ budgetId: ROOT_BUDGET_ID });
      expect(final.budget.lifecycle).toBe("settled");
      expect(final.history.entries.map((entry) => entry.kind)).toEqual([
        "budget_created",
        "budget_settlement_recorded",
      ]);
    } finally {
      await keynes.close();
    }
  });

  it("orders a waiting settlement after the committed request", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId } = await seedRoot(keynes);
      const request = await keynes.beginAttempt("requester-fixture");
      const settlement = await keynes.beginAttempt("settlement-fixture");
      const decisionEvidence = { approved: true, source: "race" };

      const funded = await Reflect.apply(
        request.client.requestBudget,
        request.client,
        [
          {
            commandId: FIRST_REQUEST_ID,
            parentBudgetId: ROOT_BUDGET_ID,
            resources: [{ resourceTypeId, amount: 5 }],
            decisionEvidence,
          },
        ],
      );
      const competing = settlement.client.settleBudget({
        commandId: SETTLEMENT_ID,
        budgetId: ROOT_BUDGET_ID,
        usage: [{ resourceTypeId, amount: 0 }],
      });

      await keynes.requireBlockedBy(settlement.backendPid, request.backendPid);
      await request.commit();
      const sealed = await competing;
      await settlement.commit();

      expect(funded).toMatchObject({ kind: "approved", decisionEvidence });
      expect(sealed.kind).toBe("settling");
      const final = await keynes
        .clientFor("reader-fixture")
        .getBudget({ budgetId: ROOT_BUDGET_ID });
      expect(final.budget.lifecycle).toBe("settling");
      expect(final.history.entries.map((entry) => entry.kind)).toEqual([
        "budget_created",
        "request_approved",
        "budget_settlement_recorded",
      ]);
      expect(final.history.entries[1]).toMatchObject({ decisionEvidence });
    } finally {
      await keynes.close();
    }
  });

  it.each(["first child", "second child"] as const)(
    "serializes sibling finalization through the root when %s commits first",
    async (firstChild) => {
      const keynes = await openNativeTestKeynes();
      try {
        const { resourceTypeId, childBudgetIds } =
          await seedSettlingSiblings(keynes);
        const [firstBudgetId, secondBudgetId] =
          firstChild === "first child"
            ? childBudgetIds
            : [childBudgetIds[1], childBudgetIds[0]];
        const first = await keynes.beginAttempt("settlement-fixture");
        const second = await keynes.beginAttempt("settlement-fixture");
        const firstSettlement = first.client.settleBudget({
          commandId: FIRST_CHILD_SETTLEMENT_ID,
          budgetId: firstBudgetId,
          usage: [{ resourceTypeId, amount: 0 }],
        });
        await firstSettlement;
        const secondSettlement = second.client.settleBudget({
          commandId: SECOND_CHILD_SETTLEMENT_ID,
          budgetId: secondBudgetId,
          usage: [{ resourceTypeId, amount: 0 }],
        });

        await keynes.requireBlockedBy(second.backendPid, first.backendPid);
        await first.commit();
        await secondSettlement;
        await second.commit();

        const root = await keynes
          .clientFor("reader-fixture")
          .getBudget({ budgetId: ROOT_BUDGET_ID });
        expect(root.budget.resources).toEqual([
          expect.objectContaining({ available: 0 }),
        ]);
        expect(root.budget.lifecycle).toBe("settled");
        expect(root.history.entries.at(-1)).toMatchObject({
          kind: "budget_settlement_recorded",
          budgetId: ROOT_BUDGET_ID,
        });
      } finally {
        await keynes.close();
      }
    },
  );

  it("rejects a stale repeatable-read sibling finalization and allows a full retry", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId, childBudgetIds } =
        await seedSettlingSiblings(keynes);
      const stale = await keynes.beginRepeatableReadAttempt("product-fixture");
      await stale.client.getBudget({ budgetId: ROOT_BUDGET_ID });
      const winner = await keynes.beginAttempt("settlement-fixture");
      await winner.client.settleBudget({
        commandId: FIRST_CHILD_SETTLEMENT_ID,
        budgetId: childBudgetIds[0],
        usage: [{ resourceTypeId, amount: 0 }],
      });
      await winner.commit();

      await expect(
        stale.client.settleBudget({
          commandId: SECOND_CHILD_SETTLEMENT_ID,
          budgetId: childBudgetIds[1],
          usage: [{ resourceTypeId, amount: 0 }],
        }),
      ).rejects.toMatchObject({ code: "40001" });
      await stale.rollback();

      const retry = await keynes.beginAttempt("settlement-fixture");
      await retry.client.settleBudget({
        commandId: SECOND_CHILD_SETTLEMENT_ID,
        budgetId: childBudgetIds[1],
        usage: [{ resourceTypeId, amount: 0 }],
      });
      await retry.commit();
      await expect(
        keynes
          .clientFor("reader-fixture")
          .getBudget({ budgetId: ROOT_BUDGET_ID }),
      ).resolves.toMatchObject({ budget: { lifecycle: "settled" } });
    } finally {
      await keynes.close();
    }
  });

  it("serializes ancestor overage observation before a child return", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId } = await seedRoot(keynes);
      const child = await keynes.clientFor("product-fixture").requestBudget({
        commandId: FIRST_REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId, amount: 10 }],
      });
      expect(child.kind).toBe("approved");
      if (child.kind !== "approved") throw new Error("Expected child approval");
      const ancestor = await keynes.beginAttempt("settlement-fixture");
      await ancestor.client.settleBudget({
        commandId: SETTLEMENT_ID,
        budgetId: ROOT_BUDGET_ID,
        usage: [{ resourceTypeId, amount: 11 }],
      });
      const childSettlement = await keynes.beginAttempt("settlement-fixture");
      const returned = childSettlement.client.settleBudget({
        commandId: FIRST_CHILD_SETTLEMENT_ID,
        budgetId: child.childBudgetId,
        usage: [{ resourceTypeId, amount: 0 }],
      });
      await keynes.requireBlockedBy(
        childSettlement.backendPid,
        ancestor.backendPid,
      );
      await ancestor.commit();
      await returned;
      await childSettlement.commit();

      await expect(
        keynes
          .clientFor("reader-fixture")
          .getBudget({ budgetId: ROOT_BUDGET_ID }),
      ).resolves.toMatchObject({
        budget: {
          lifecycle: "settled",
          resources: [expect.objectContaining({ available: 0, deficit: 11 })],
        },
      });
    } finally {
      await keynes.close();
    }
  });

  it("allows an independent-root mutation while another tree is locked", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId } = await seedRoot(keynes);
      const product = keynes.clientFor("product-fixture");
      await product.createBudget({
        commandId: COMPETING_ROOT_ID,
        ...rootResources([
          {
            definition: {
              canonicalName: "native_tokens",
              unit: "token",
              accountingBehavior: "consumable",
            },
            amount: 1,
          },
        ]),
      });
      const held = await keynes.beginAttempt("settlement-fixture");
      await held.client.settleBudget({
        commandId: SETTLEMENT_ID,
        budgetId: ROOT_BUDGET_ID,
        usage: [{ resourceTypeId: RESOURCE_COMMAND_ID, amount: 0 }],
      });
      const independent = await keynes.beginAttempt("product-fixture");
      await expect(
        independent.client.requestBudget({
          commandId: SECOND_REQUEST_ID,
          parentBudgetId: COMPETING_ROOT_ID,
          resources: [{ resourceTypeId, amount: 1 }],
        }),
      ).resolves.toMatchObject({ kind: "approved" });
      await independent.commit();
      await held.commit();
    } finally {
      await keynes.close();
    }
  });

  it("rejects a sibling observation that overflows the root aggregate", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId, childBudgetIds } = await seedZeroSiblings(keynes);
      const first = await keynes.beginAttempt("settlement-fixture");
      await first.client.settleBudget({
        commandId: FIRST_CHILD_SETTLEMENT_ID,
        budgetId: childBudgetIds[0],
        usage: [{ resourceTypeId, amount: Number.MAX_SAFE_INTEGER }],
      });
      const second = await keynes.beginAttempt("settlement-fixture");
      const overflow = second.client.settleBudget({
        commandId: SECOND_CHILD_SETTLEMENT_ID,
        budgetId: childBudgetIds[1],
        usage: [{ resourceTypeId, amount: Number.MAX_SAFE_INTEGER }],
      });
      await keynes.requireBlockedBy(second.backendPid, first.backendPid);
      const rejected = expect(overflow).rejects.toMatchObject({
        code: "arithmetic_error",
      });
      await first.commit();
      const beforeSecond = await keynes.inspectState();
      const journalBeforeSecond = await keynes.inspectJournal();
      await rejected;
      await second.commit();
      expect(await keynes.inspectState()).toEqual(beforeSecond);
      expect(await keynes.inspectJournal()).toEqual(journalBeforeSecond);
      await expect(
        keynes.clientFor("reader-fixture").getBudget({
          budgetId: childBudgetIds[1],
        }),
      ).resolves.toMatchObject({
        budget: {
          lifecycle: "active",
          resources: [expect.objectContaining({ directUsage: null })],
        },
      });
    } finally {
      await keynes.close();
    }
  });

  it("keeps a read-only snapshot coherent across an uncommitted cascade", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId, childBudgetIds } =
        await seedSettlingSiblings(keynes);
      const first = await keynes.beginAttempt("settlement-fixture");
      await first.client.settleBudget({
        commandId: FIRST_CHILD_SETTLEMENT_ID,
        budgetId: childBudgetIds[0],
        usage: [{ resourceTypeId, amount: 0 }],
      });
      await first.commit();
      const reader =
        await keynes.beginReadOnlyRepeatableReadAttempt("product-fixture");
      const before = await reader.client.getBudget({
        budgetId: ROOT_BUDGET_ID,
      });
      const finalizer = await keynes.beginAttempt("settlement-fixture");
      await finalizer.client.settleBudget({
        commandId: SECOND_CHILD_SETTLEMENT_ID,
        budgetId: childBudgetIds[1],
        usage: [{ resourceTypeId, amount: 0 }],
      });
      expect(
        await reader.client.getBudget({ budgetId: ROOT_BUDGET_ID }),
      ).toEqual(before);
      await finalizer.commit();
      expect(
        await reader.client.getBudget({ budgetId: ROOT_BUDGET_ID }),
      ).toEqual(before);
      await reader.commit();
      await expect(
        keynes
          .clientFor("reader-fixture")
          .getBudget({ budgetId: ROOT_BUDGET_ID }),
      ).resolves.toMatchObject({
        budget: {
          lifecycle: "settled",
          resources: [expect.objectContaining({ available: 0 })],
        },
      });
    } finally {
      await keynes.close();
    }
  });

  it("returns the stored result when a matching command waits for commit", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId } = await seedRoot(keynes);
      const first = await keynes.beginAttempt("requester-fixture");
      const second = await keynes.beginAttempt("requester-fixture");
      const command = {
        commandId: FIRST_REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId, amount: 5 }],
      } satisfies RequestBudgetCommand;

      const stored = await first.client.requestBudget(command);
      const replay = second.client.requestBudget(command);

      await keynes.requireBlockedBy(second.backendPid, first.backendPid);
      await first.commit();
      await expect(replay).resolves.toEqual({ ...stored, replayed: true });
      await second.commit();
    } finally {
      await keynes.close();
    }
  });

  it("replays matching evidence and rejects changed evidence when contenders wait", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId } = await seedRoot(keynes);
      const first = await keynes.beginAttempt("requester-fixture");
      const second = await keynes.beginAttempt("requester-fixture");
      const changed = await keynes.beginAttempt("requester-fixture");
      const decisionEvidence = {
        approved: true,
        request_source: "application",
      };
      const command = {
        commandId: FIRST_REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId, amount: 5 }],
        decisionEvidence,
      };

      const stored = await Reflect.apply(
        first.client.requestBudget,
        first.client,
        [command],
      );
      expect(stored).toMatchObject({
        kind: "approved",
        replayed: false,
        decisionEvidence,
      });
      const replay = Reflect.apply(second.client.requestBudget, second.client, [
        command,
      ]);
      const conflicting = Reflect.apply(
        changed.client.requestBudget,
        changed.client,
        [
          {
            ...command,
            decisionEvidence: {
              approved: false,
              request_source: "application",
            },
          },
        ],
      );
      const conflict = expect(conflicting).rejects.toMatchObject({
        code: "command_conflict",
      });

      await keynes.requireBlockedBy(second.backendPid, first.backendPid);
      await keynes.requireBlockedBy(changed.backendPid, first.backendPid);
      await first.commit();
      await expect(replay).resolves.toMatchObject({
        kind: "approved",
        replayed: true,
        decisionEvidence,
      });
      await second.commit();
      await conflict;
      await changed.commit();
    } finally {
      await keynes.close();
    }
  });

  it("creates concurrent configured roots on one catalog Resource", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const root = rootResources([
        {
          definition: {
            canonicalName: "contended_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
          amount: 10,
        },
      ]);
      await keynes.clientFor("product-fixture").defineResources({
        commandId: RESOURCE_COMMAND_ID,
        definitions: root.definitions,
      });
      const first = await keynes.beginAttempt("product-fixture");
      const second = await keynes.beginAttempt("product-fixture");
      const [firstRoot, secondRoot] = await Promise.all([
        first.client.createBudget({ commandId: ROOT_BUDGET_ID, ...root }),
        second.client.createBudget({ commandId: COMPETING_ROOT_ID, ...root }),
      ]);
      await Promise.all([first.commit(), second.commit()]);

      const firstResource = firstRoot.budget.resources[0]?.resourceType;
      const secondResource = secondRoot.budget.resources[0]?.resourceType;
      expect(secondResource?.resourceTypeId).toBe(
        firstResource?.resourceTypeId,
      );
      expect(firstRoot.budget.budgetId).not.toBe(secondRoot.budget.budgetId);
      expect(firstRoot.budget.resources).toEqual([
        expect.objectContaining({ allocated: 10, available: 10 }),
      ]);
      expect(secondRoot.budget.resources).toEqual([
        expect.objectContaining({ allocated: 10, available: 10 }),
      ]);
      expect(await keynes.inspectState()).toEqual({
        resources: 1,
        commands: 3,
        budgets: 2,
        holdings: 2,
        history: 2,
        quantity: 20,
      });
    } finally {
      await keynes.close();
    }
  });

  it("returns root Resources in canonical name order despite opposite standalone UUID order", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const client = keynes.clientFor("product-fixture");
      const zeta = await client.defineResource({
        commandId: ZETA_DEFINITION_ID,
        definition: {
          canonicalName: "zeta_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const alpha = await client.defineResource({
        commandId: ALPHA_DEFINITION_ID,
        definition: {
          canonicalName: "alpha_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      expect(zeta.resourceType.resourceTypeId).toBe(ZETA_DEFINITION_ID);
      expect(alpha.resourceType.resourceTypeId).toBe(ALPHA_DEFINITION_ID);

      const root = await client.createBudget({
        commandId: CANONICAL_ORDER_ROOT_ID,
        ...rootResources([
          {
            definition: {
              canonicalName: "zeta_tokens",
              unit: "token",
              accountingBehavior: "consumable",
            },
            amount: 10,
          },
          {
            definition: {
              canonicalName: "alpha_tokens",
              unit: "token",
              accountingBehavior: "consumable",
            },
            amount: 10,
          },
        ]),
      });

      expect(
        root.budget.resources.map(
          ({ resourceType }) => resourceType.canonicalName,
        ),
      ).toEqual(["alpha_tokens", "zeta_tokens"]);
    } finally {
      await keynes.close();
    }
  });
});

function configuredRootDefinitions() {
  return {
    modelTokens: { unit: "token", accountingBehavior: "consumable" },
    reviewerSeats: { unit: "seat", accountingBehavior: "reusable" },
  } as const;
}

async function seedRoot(
  keynes: NativeTestKeynes,
): Promise<{ readonly resourceTypeId: string }> {
  const client = keynes.clientFor("product-fixture");
  const resource = await client.defineResource({
    commandId: RESOURCE_COMMAND_ID,
    definition: {
      canonicalName: "native_tokens",
      unit: "token",
      accountingBehavior: "consumable",
    },
  });
  await client.createBudget({
    commandId: ROOT_BUDGET_ID,
    ...rootResources([
      {
        definition: {
          canonicalName: "native_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
        amount: 10,
      },
    ]),
  });
  return { resourceTypeId: resource.resourceType.resourceTypeId };
}

async function seedSettlingSiblings(keynes: NativeTestKeynes): Promise<{
  readonly resourceTypeId: string;
  readonly childBudgetIds: readonly [string, string];
}> {
  const { resourceTypeId } = await seedRoot(keynes);
  const client = keynes.clientFor("product-fixture");
  const first = await client.requestBudget({
    commandId: FIRST_REQUEST_ID,
    parentBudgetId: ROOT_BUDGET_ID,
    resources: [{ resourceTypeId, amount: 5 }],
  });
  const second = await client.requestBudget({
    commandId: SECOND_REQUEST_ID,
    parentBudgetId: ROOT_BUDGET_ID,
    resources: [{ resourceTypeId, amount: 5 }],
  });
  expect(first.kind).toBe("approved");
  expect(second.kind).toBe("approved");
  if (first.kind !== "approved" || second.kind !== "approved")
    throw new Error("Expected both sibling requests to be approved");
  await client.settleBudget({
    commandId: SETTLEMENT_ID,
    budgetId: ROOT_BUDGET_ID,
    usage: [{ resourceTypeId, amount: 0 }],
  });
  return {
    resourceTypeId,
    childBudgetIds: [first.childBudgetId, second.childBudgetId],
  };
}

async function seedZeroSiblings(keynes: NativeTestKeynes): Promise<{
  readonly resourceTypeId: string;
  readonly childBudgetIds: readonly [string, string];
}> {
  const client = keynes.clientFor("product-fixture");
  const resource = await client.defineResource({
    commandId: RESOURCE_COMMAND_ID,
    definition: {
      canonicalName: "overflow_tokens",
      unit: "token",
      accountingBehavior: "consumable",
    },
  });
  await client.createBudget({
    commandId: ROOT_BUDGET_ID,
    ...rootResources([
      {
        definition: {
          canonicalName: "overflow_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
        amount: 0,
      },
    ]),
  });
  const first = await client.requestBudget({
    commandId: FIRST_REQUEST_ID,
    parentBudgetId: ROOT_BUDGET_ID,
    resources: [
      { resourceTypeId: resource.resourceType.resourceTypeId, amount: 0 },
    ],
  });
  const second = await client.requestBudget({
    commandId: SECOND_REQUEST_ID,
    parentBudgetId: ROOT_BUDGET_ID,
    resources: [
      { resourceTypeId: resource.resourceType.resourceTypeId, amount: 0 },
    ],
  });
  if (first.kind !== "approved" || second.kind !== "approved")
    throw new Error("Expected zero-grant siblings");
  return {
    resourceTypeId: resource.resourceType.resourceTypeId,
    childBudgetIds: [first.childBudgetId, second.childBudgetId],
  };
}
