import { describe, expect, it } from "vitest";

import type {
  CreateBudgetCommand,
  RequestBudgetCommand,
  ResourceDefinition,
  SettleBudgetCommand,
} from "../../generated/types.ts";
import type { OpenContractTestHost } from "../host.ts";

export function registerResourceBoundRootContractTests(
  openTestKeynes: OpenContractTestHost,
): void {
  describe("Resource-bound root creation", () => {
    const definitions = {
      modelTokens: { unit: "token", accountingBehavior: "consumable" },
      reviewerSeats: { unit: "seat", accountingBehavior: "reusable" },
    } satisfies Record<string, Omit<ResourceDefinition, "canonicalName">>;

    it.each([
      ["fully funded", { modelTokens: 10, reviewerSeats: 4 }],
      ["explicit zero member", { modelTokens: 10, reviewerSeats: 0 }],
      ["omitted member", { modelTokens: 10 }],
      ["all-zero root", { modelTokens: 0, reviewerSeats: 0 }],
    ] satisfies [string, Record<string, number>][])(
      "creates exact immutable membership for %s",
      async (_label, amounts) => {
        const host = await openTestKeynes();
        try {
          const client = host.clientFor("product-fixture");
          const provisioned = await client.defineResources({
            commandId: id(1),
            definitions,
          });
          const selected = Object.fromEntries(
            Object.entries(definitions).filter(([key]) => key in amounts),
          );
          const selectedAmounts: Record<string, number> = amounts;
          const before = await host.inspectState();
          const created = await host
            .clientFor("allocator-fixture", { forbidResourceWrites: true })
            .createBudget({ commandId: id(2), definitions: selected, amounts });
          expect(created.budget.lifecycle).toBe("active");
          expect(created.budget.resources).toEqual(
            provisioned.resources
              .filter(({ key }) => key in amounts)
              .map(({ key, resourceType }) =>
                expect.objectContaining({
                  resourceType,
                  allocated: selectedAmounts[key],
                  available: selectedAmounts[key],
                }),
              ),
          );
          const read = await client.getBudget({
            budgetId: created.budget.budgetId,
          });
          expect(read.budget).toEqual(created.budget);
          expect(read.history.entries.map(({ kind }) => kind)).toEqual([
            "budget_created",
          ]);
          expect(await host.inspectState()).toEqual({
            ...before,
            commands: before.commands + 1,
            budgets: 1,
            holdings: Object.keys(amounts).length,
            history: 1,
            quantity: Object.values(amounts).reduce(
              (sum, amount) => sum + amount,
              0,
            ),
          });
          expect(
            (await client.defineResources({ commandId: id(1), definitions }))
              .resources,
          ).toEqual(provisioned.resources);
        } finally {
          await host.close();
        }
      },
    );

    it("creates independent roots around settlement without moving or increasing fixed funding", async () => {
      const host = await openTestKeynes();
      try {
        const client = host.clientFor("product-fixture");
        await client.defineResources({ commandId: id(1), definitions });
        const selected = { modelTokens: definitions.modelTokens };
        const first = await client.createBudget({
          commandId: id(2),
          definitions: selected,
          amounts: { modelTokens: 10 },
        });
        const second = await client.createBudget({
          commandId: id(3),
          definitions: selected,
          amounts: { modelTokens: 20 },
        });
        const resourceTypeId =
          first.budget.resources[0]?.resourceType.resourceTypeId;
        if (resourceTypeId === undefined)
          throw new Error("root Resource missing");
        await client.settleBudget({
          commandId: id(4),
          budgetId: first.budget.budgetId,
          usage: [{ resourceTypeId, amount: 4 }],
        });
        const settled = await client.getBudget({
          budgetId: first.budget.budgetId,
        });
        await client.defineResources({
          commandId: id(5),
          definitions: {
            apiCalls: { unit: "call", accountingBehavior: "consumable" },
          },
        });
        const third = await client.createBudget({
          commandId: id(6),
          definitions: selected,
          amounts: { modelTokens: 30 },
        });
        expect(
          new Set([first, second, third].map(({ budget }) => budget.budgetId))
            .size,
        ).toBe(3);
        expect(
          await client.getBudget({ budgetId: first.budget.budgetId }),
        ).toEqual(settled);
        expect(
          (await client.getBudget({ budgetId: second.budget.budgetId })).budget,
        ).toEqual(second.budget);
        expect(third.budget.resources).toEqual([
          expect.objectContaining({ allocated: 30, available: 30 }),
        ]);
        expect(settled.budget.resources).toEqual([
          expect.objectContaining({ allocated: 10 }),
        ]);
      } finally {
        await host.close();
      }
    });

    it("keeps an all-zero root active until ordinary settlement and denies unfunded work", async () => {
      const host = await openTestKeynes();
      try {
        const client = host.clientFor("product-fixture");
        await client.defineResources({ commandId: id(1), definitions });
        const command = {
          commandId: id(2),
          definitions,
          amounts: { modelTokens: 0, reviewerSeats: 0 },
        };
        const created = await client.createBudget(command);
        const [firstResource, ...remainingResources] = created.budget.resources;
        if (firstResource === undefined)
          throw new Error("root Resource missing");
        const resources = [
          {
            resourceTypeId: firstResource.resourceType.resourceTypeId,
            amount: 1,
          },
          ...remainingResources.map(({ resourceType }) => ({
            resourceTypeId: resourceType.resourceTypeId,
            amount: 1,
          })),
        ] satisfies RequestBudgetCommand["resources"];
        expect(
          await client.requestBudget({
            commandId: id(3),
            parentBudgetId: created.budget.budgetId,
            resources,
          }),
        ).toMatchObject({ kind: "denied" });
        const active = await client.getBudget({
          budgetId: created.budget.budgetId,
        });
        expect(active.budget.lifecycle).toBe("active");
        expect(
          active.budget.resources.every(
            ({ allocated, available }) => allocated === 0 && available === 0,
          ),
        ).toBe(true);
        await expect(
          client.createBudget({
            ...command,
            amounts: { modelTokens: 1, reviewerSeats: 0 },
          }),
        ).rejects.toMatchObject({ code: "command_conflict" });
        expect(
          await client.settleBudget({
            commandId: id(4),
            budgetId: created.budget.budgetId,
            usage: [
              {
                resourceTypeId: firstResource.resourceType.resourceTypeId,
                amount: 0,
              },
              ...remainingResources.map(({ resourceType }) => ({
                resourceTypeId: resourceType.resourceTypeId,
                amount: 0,
              })),
            ] satisfies SettleBudgetCommand["usage"],
          }),
        ).toMatchObject({ kind: "settled" });
        expect((await host.inspectState()).quantity).toBe(0);
      } finally {
        await host.close();
      }
    });

    it("creates without Resource writes while retaining separate definition provenance", async () => {
      const host = await openTestKeynes();
      try {
        const client = host.clientFor("product-fixture");
        const receipt = await client.defineResources({
          commandId: id(1),
          definitions,
        });
        const guarded = host.clientFor("product-fixture", {
          forbidResourceWrites: true,
        });
        await expect(
          guarded.defineResources({
            commandId: id(9),
            definitions: {
              apiCalls: { unit: "call", accountingBehavior: "consumable" },
            },
          }),
        ).rejects.toThrow("private Resource write prohibition");
        const created = await guarded.createBudget({
          commandId: id(2),
          definitions,
          amounts: { modelTokens: 10, reviewerSeats: 0 },
        });
        expect(
          created.budget.resources.map(({ resourceType }) => resourceType),
        ).toEqual(receipt.resources.map(({ resourceType }) => resourceType));
        expect(
          receipt.resources.every(
            ({ definitionEvidence }) => definitionEvidence.commandId === id(1),
          ),
        ).toBe(true);
        expect((await host.inspectState()).resources).toBe(2);
      } finally {
        await host.close();
      }
    });

    it.each([
      ["empty amounts", { definitions: {}, amounts: {} }],
      ["extra declaration", { definitions, amounts: { modelTokens: 1 } }],
      [
        "unknown zero key",
        {
          definitions: { modelTokens: definitions.modelTokens },
          amounts: { modelTokens: 1, unknownResource: 0 },
        },
      ],
      [
        "catalog-only amount key",
        {
          definitions: { modelTokens: definitions.modelTokens },
          amounts: { reviewerSeats: 0 },
        },
      ],
      [
        "negative",
        { definitions, amounts: { modelTokens: -1, reviewerSeats: 0 } },
      ],
      [
        "fraction",
        { definitions, amounts: { modelTokens: 0.5, reviewerSeats: 0 } },
      ],
      [
        "unsafe integer",
        {
          definitions,
          amounts: {
            modelTokens: Number.MAX_SAFE_INTEGER + 1,
            reviewerSeats: 0,
          },
        },
      ],
      ["null amounts", { definitions, amounts: null }],
      ["array amounts", { definitions, amounts: [0, 0] }],
      [
        "null definition",
        { definitions: { modelTokens: null }, amounts: { modelTokens: 1 } },
      ],
      [
        "unsupported definition field",
        {
          definitions: {
            modelTokens: { ...definitions.modelTokens, unexpected: true },
          },
          amounts: { modelTokens: 1 },
        },
      ],
      [
        "unknown command field",
        {
          definitions,
          amounts: { modelTokens: 1, reviewerSeats: 0 },
          topUp: true,
        },
      ],
      [
        "old ResourceSource",
        {
          resources: { kind: "definitions", definitions },
          allocation: { modelTokens: 1 },
        },
      ],
    ])("rejects %s without partial creation effects", async (_label, input) => {
      const host = await openTestKeynes();
      try {
        const client = host.clientFor("product-fixture");
        await client.defineResources({ commandId: id(1), definitions });
        const before = await host.inspectState();
        await expect(
          Reflect.apply(client.createBudget, client, [
            { commandId: id(2), ...input },
          ]),
        ).rejects.toMatchObject({ code: "invalid_command" });
        expect(await host.inspectState()).toEqual(before);
      } finally {
        await host.close();
      }
    });

    it.each([
      [
        "missing catalog definition",
        { apiCalls: { unit: "call", accountingBehavior: "consumable" } },
        { apiCalls: 1 },
        "resource_type_not_found",
      ],
      [
        "conflicting catalog definition",
        { modelTokens: { ...definitions.modelTokens, unit: "different" } },
        { modelTokens: 1 },
        "resource_type_conflict",
      ],
    ] satisfies [
      string,
      CreateBudgetCommand["definitions"],
      CreateBudgetCommand["amounts"],
      string,
    ][])(
      "rejects %s without catalog or Budget writes",
      async (_label, declarations, amounts, code) => {
        const host = await openTestKeynes();
        try {
          const client = host.clientFor("product-fixture");
          await client.defineResources({ commandId: id(1), definitions });
          const before = await host.inspectState();
          await expect(
            client.createBudget({
              commandId: id(2),
              definitions: declarations,
              amounts,
            }),
          ).rejects.toMatchObject({ code });
          expect(await host.inspectState()).toEqual(before);
        } finally {
          await host.close();
        }
      },
    );

    it("replays exact creation and rejects conflicting amounts without duplicate history", async () => {
      const host = await openTestKeynes();
      try {
        const client = host.clientFor("product-fixture");
        await client.defineResources({ commandId: id(1), definitions });
        const command = {
          commandId: id(2),
          definitions,
          amounts: { modelTokens: 10, reviewerSeats: 0 },
        };
        const created = await client.createBudget(command);
        const before = await host.inspectState();
        expect(await client.createBudget(command)).toEqual({
          ...created,
          replayed: true,
        });
        await expect(
          client.createBudget({
            ...command,
            amounts: { modelTokens: 9, reviewerSeats: 0 },
          }),
        ).rejects.toMatchObject({ code: "command_conflict" });
        expect(await host.inspectState()).toEqual(before);
      } finally {
        await host.close();
      }
    });

    it.each(["after_command_binding", "after_domain_mutation"] as const)(
      "rolls back creation at %s and preserves committed definitions",
      async (checkpoint) => {
        const host = await openTestKeynes();
        try {
          const client = host.clientFor("product-fixture");
          const receipt = await client.defineResources({
            commandId: id(1),
            definitions,
          });
          const before = await host.inspectState();
          const command = {
            commandId: id(2),
            definitions,
            amounts: { modelTokens: 10, reviewerSeats: 0 },
          };
          await expect(
            host
              .clientFor("product-fixture", { checkpoint })
              .createBudget(command),
          ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);
          expect(await host.inspectState()).toEqual(before);
          expect(await client.createBudget(command)).toMatchObject({
            kind: "created",
            replayed: false,
          });
          expect(
            await client.defineResources({ commandId: id(1), definitions }),
          ).toEqual({ ...receipt, replayed: true });
        } finally {
          await host.close();
        }
      },
    );
  });
}

function id(suffix: number): string {
  return `17000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
}
