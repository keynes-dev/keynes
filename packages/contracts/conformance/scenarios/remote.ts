import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type {
  BudgetReference,
  HistoryCursor,
  OperationKey,
  RemoteCreateBudgetCommand,
  ResourceDefinition,
} from "../../generated/types.ts";
import type {
  OpenRemoteContractTestHost,
  RemoteContractClient,
  RemoteContractTestHost,
} from "../host.ts";
import { KeynesError } from "../host.ts";

const resource: ResourceDefinition = {
  canonicalName: "model_tokens",
  unit: "token",
  accountingBehavior: "consumable",
};

export function registerRemoteContractTests(
  openHost: OpenRemoteContractTestHost,
): void {
  describe("remote contract", () => {
    let host: RemoteContractTestHost;

    beforeAll(async () => {
      host = await openHost();
    });

    afterAll(async () => {
      await host.close();
    });

    it("creates and replays one Resource-bound root", async () => {
      const client = host.clientFor("product-fixture");
      const operationKey = key("a");
      const command: RemoteCreateBudgetCommand = {
        operationKey,
        resources: [{ definition: resource, amount: 300 }],
      };

      const created = await client.createBudget(command);
      const replayed = await client.createBudget(command);

      expect(created.kind).toBe("created");
      expect(created.replayed).toBe(false);
      expect(replayed).toEqual({
        ...created,
        replayed: true,
      });
    });

    it("recovers a committed mutation without changing its result", async () => {
      const client = host.clientFor("product-fixture");
      const operationKey = key("b");
      const created = await client.createBudget({
        operationKey,
        resources: [{ definition: resource, amount: 100 }],
      });

      const recovered = await client.recoverOperation({ operationKey });
      expect(recovered).toEqual({
        kind: "committed",
        operationKey,
        operation: "createBudget",
        result: created,
      });
      expect(await client.recoverOperation({ operationKey })).toEqual(
        recovered,
      );
    });

    it("settles a Resource-bound budget through the remote contract", async () => {
      const client = host.clientFor("product-fixture");
      const created = await client.createBudget({
        operationKey: key("s"),
        resources: [{ definition: resource, amount: 100 }],
      });

      await expect(
        client.settleBudget({
          operationKey: key("t"),
          budgetReference: created.budget.budgetReference,
          usage: [{ resource: resource.canonicalName, amount: 10 }],
        }),
      ).resolves.toMatchObject({
        kind: "settled",
        budget: {
          budgetReference: created.budget.budgetReference,
        },
        newlyKnown: [{ resource: resource.canonicalName, amount: 10 }],
        unresolvedResources: [],
        replayed: false,
      });
    });

    it("reopens only the exact Resource binding", async () => {
      const client = host.clientFor("product-fixture");
      const created = await client.createBudget({
        operationKey: key("c"),
        resources: [{ definition: resource, amount: 100 }],
      });

      await expect(
        client.openBudget({
          budgetReference: created.budget.budgetReference,
          expectedResources: [resource],
        }),
      ).resolves.toMatchObject({
        budgetReference: created.budget.budgetReference,
        budget: created.budget,
      });
      await expectKeynesError(
        client.openBudget({
          budgetReference: created.budget.budgetReference,
          expectedResources: [{ ...resource, unit: "credit" }],
        }),
        "resource_binding_mismatch",
      );
    });

    it("reads canonical history through private ordered pages", async () => {
      const client = host.clientFor("product-fixture");
      const created = await client.createBudget({
        operationKey: key("d"),
        resources: [{ definition: resource, amount: 300 }],
      });
      for (let index = 0; index < 257; index += 1) {
        await client.requestBudget({
          operationKey: keyFromIndex(index),
          parentBudgetReference: created.budget.budgetReference,
          resources: [{ resource: resource.canonicalName, amount: 0 }],
        });
      }

      const entries = await allHistory(client, created.budget.budgetReference);
      expect(entries).toHaveLength(258);
      expect(entries.map(({ sequence }) => sequence)).toEqual(
        Array.from({ length: 258 }, (_, index) => index + 1),
      );
    });

    it("projects cross-tenant failures without protected details", async () => {
      const owner = host.clientFor("product-fixture");
      const other = host.clientFor("reader-fixture");
      const created = await owner.createBudget({
        operationKey: key("e"),
        resources: [{ definition: resource, amount: 100 }],
      });

      let failure: unknown;
      try {
        await other.openBudget({
          budgetReference: created.budget.budgetReference,
          expectedResources: [resource],
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(KeynesError);
      expect(failure).toMatchObject({ code: "unauthorized" });
      expect(JSON.stringify(failure)).not.toMatch(
        /tenant|principal|password|postgresql:|select|stack/iu,
      );
    });
  });
}

async function allHistory(
  client: RemoteContractClient,
  budgetReference: BudgetReference,
) {
  const entries = [];
  let cursor: HistoryCursor | undefined;
  do {
    const page = await client.getBudgetHistoryPage({
      budgetReference,
      ...(cursor === undefined ? {} : { cursor }),
    });
    entries.push(...page.entries);
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return entries;
}

async function expectKeynesError(
  operation: Promise<unknown>,
  code: KeynesError["code"],
): Promise<void> {
  await expect(operation).rejects.toMatchObject({
    name: "KeynesError",
    code,
  });
}

function key(suffix: string): OperationKey {
  return `kop_v1_${suffix.repeat(43)}`;
}

function keyFromIndex(index: number): OperationKey {
  return `kop_v1_${index.toString(36).padStart(43, "0")}`;
}
