import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createBudgetHandle,
  type BudgetSnapshot,
} from "../../../src/budget.js";
import type { KeynesClient } from "../../../src/generated/client.js";
import type {
  BudgetHistoryEntry,
  BudgetProjection,
  GetBudgetResult,
  RequestDenied,
  ResourceAmount,
  SettleBudgetResult,
} from "../../../src/generated/types.js";
import type { BasicRuntimeSession } from "../../../src/generated/runtime.js";
import { createResourceBinding } from "../../../src/resource-binding.js";
import type { PreparedRootResource } from "../../../src/resources.js";

const BUDGET_ID = "00000000-0000-4000-8000-000000000010";
const LOW_RESOURCE_ID = "10000000-0000-4000-8000-000000000001";
const HIGH_RESOURCE_ID = "90000000-0000-4000-8000-000000000001";

type ResourceName = "alpha" | "zebra";

interface InstalledResource {
  readonly key: ResourceName;
  readonly resourceTypeId: string;
}

describe("public Budget projections", () => {
  it("orders Resource-bearing output by public key across private identity orders", async () => {
    const first = await exerciseRuntime([
      { key: "alpha", resourceTypeId: HIGH_RESOURCE_ID },
      { key: "zebra", resourceTypeId: LOW_RESOURCE_ID },
    ]);
    const second = await exerciseRuntime([
      { key: "alpha", resourceTypeId: LOW_RESOURCE_ID },
      { key: "zebra", resourceTypeId: HIGH_RESOURCE_ID },
    ]);

    expect(first).toEqual(second);
    expect(
      first.snapshot.budget.resources.map(({ resource }) => resource),
    ).toEqual(["alpha", "zebra"]);
    expect(first.settlement.newlyKnown.map(({ resource }) => resource)).toEqual(
      ["alpha", "zebra"],
    );
    expect(first.settlement.unresolvedResources).toEqual(["alpha", "zebra"]);
    expect(first.denial).toMatchObject({
      status: "denied",
      reasons: [{ resource: "alpha" }, { resource: "zebra" }],
    });

    const [created, denied, settled] = first.snapshot.history.entries;
    expect(created).toMatchObject({
      kind: "budget_created",
      resources: [{ resource: "alpha" }, { resource: "zebra" }],
    });
    expect(denied).toMatchObject({
      kind: "request_denied",
      reasons: [{ resource: "alpha" }, { resource: "zebra" }],
    });
    expect(settled).toMatchObject({
      kind: "budget_settlement_recorded",
      newlyKnown: [{ resource: "alpha" }, { resource: "zebra" }],
      unresolvedResources: ["alpha", "zebra"],
      isolatedDeficits: [{ resource: "alpha" }, { resource: "zebra" }],
    });

    const narrowed = await exerciseNarrowedProjection([
      { key: "alpha", resourceTypeId: HIGH_RESOURCE_ID },
      { key: "zebra", resourceTypeId: LOW_RESOURCE_ID },
    ]);
    expectTypeOf(narrowed).toEqualTypeOf<
      BudgetSnapshot<"alpha", ResourceName>
    >();
    expect(narrowed.budget.resources.map(({ resource }) => resource)).toEqual([
      "alpha",
    ]);
    expect(narrowed.history.entries[0]).toMatchObject({
      kind: "budget_created",
      resources: [{ resource: "alpha" }, { resource: "zebra" }],
    });
  });

  it("projects frozen decision evidence in ASCII order without applying contract field ranks", async () => {
    const resources = [
      { key: "alpha" as const, resourceTypeId: LOW_RESOURCE_ID },
      { key: "zebra" as const, resourceTypeId: HIGH_RESOURCE_ID },
    ];
    const runtime = createRuntime(resources);
    const binding = createResourceBinding(
      preparedResources(resources),
      budgetProjection(resources, "initial"),
    );
    const budget = createBudgetHandle<ResourceName>(
      runtime,
      BUDGET_ID,
      binding,
    );

    const result: unknown = await budget.request({ alpha: 1, zebra: 2 });

    expect(result).toMatchObject({
      status: "denied",
      decisionEvidence: { a: 0, kind: true, resources: "application" },
    });
    expect(JSON.stringify(result)).toContain(
      '"decisionEvidence":{"a":0,"kind":true,"resources":"application"}',
    );
    expect(Object.isFrozen(result)).toBe(true);
  });
});

async function exerciseRuntime(resources: readonly InstalledResource[]) {
  const runtime = createRuntime(resources);
  const binding = createResourceBinding(
    preparedResources(resources),
    budgetProjection(resources, "initial"),
  );
  const budget = createBudgetHandle<ResourceName>(runtime, BUDGET_ID, binding);
  const snapshot = await budget.inspect();
  const settlement = await budget.settle({ alpha: 1, zebra: 2 });
  const denial = await budget.request({ alpha: 1, zebra: 2 });
  return { snapshot, settlement, denial };
}

async function exerciseNarrowedProjection(
  resources: readonly InstalledResource[],
) {
  const runtime = createRuntime(
    resources,
    resources.filter(({ key }) => key === "alpha"),
  );
  const rootBinding = createResourceBinding(
    preparedResources(resources),
    budgetProjection(resources, "initial"),
  );
  const { binding } = rootBinding.resources<"alpha">(
    { alpha: 1 },
    "requestBudget",
  );
  return createBudgetHandle(runtime, BUDGET_ID, binding).inspect();
}

function createRuntime(
  resources: readonly InstalledResource[],
  budgetResources: readonly InstalledResource[] = resources,
): BasicRuntimeSession {
  const orderedResources = [...resources].sort((left, right) =>
    left.resourceTypeId.localeCompare(right.resourceTypeId),
  );
  const client = createClient(orderedResources, budgetResources);
  return {
    client,
    resources: [],
    state: "open",
    admit,
    invokeMutation: (operation) => operation(),
    close: async () => undefined,
  };
}

function createClient(
  resources: readonly InstalledResource[],
  budgetResources: readonly InstalledResource[],
): KeynesClient {
  const budget = budgetProjection(budgetResources);
  const amounts = resourceAmounts(resources);
  const reasons = requireNonempty(
    resources.map((resource) => ({
      code: "insufficient_available" as const,
      resourceTypeId: resource.resourceTypeId,
      requested: amountFor(resource.key),
      available: 0,
    })),
  );
  const history: BudgetHistoryEntry[] = [
    {
      kind: "budget_created",
      entryId: "00000000-0000-4000-8000-000000000101",
      sequence: 1,
      commandId: "00000000-0000-4000-8000-000000000201",
      subjectBudgetId: BUDGET_ID,
      rootBudgetId: BUDGET_ID,
      resources: requireNonempty(amounts),
    },
    {
      kind: "request_denied",
      entryId: "00000000-0000-4000-8000-000000000102",
      sequence: 2,
      commandId: "00000000-0000-4000-8000-000000000202",
      subjectBudgetId: BUDGET_ID,
      parentBudgetId: BUDGET_ID,
      reasons,
    },
    {
      kind: "budget_settlement_recorded",
      entryId: "00000000-0000-4000-8000-000000000103",
      sequence: 3,
      commandId: "00000000-0000-4000-8000-000000000203",
      subjectBudgetId: BUDGET_ID,
      budgetId: BUDGET_ID,
      newlyKnown: amounts,
      unresolvedResourceTypeIds: resources.map(
        ({ resourceTypeId }) => resourceTypeId,
      ),
      lifecycle: "settling",
      isolatedDeficits: amounts,
    },
  ];

  return {
    async validateResources() {
      return { valid: true } as const;
    },
    async defineResources() {
      throw new Error("unexpected defineResources call");
    },
    async defineResource() {
      throw new Error("unexpected defineResource call");
    },
    async createBudget() {
      throw new Error("unexpected createBudget call");
    },
    async requestBudget() {
      const denied: RequestDenied = {
        kind: "denied",
        commandId: "00000000-0000-4000-8000-000000000204",
        parentBudgetId: BUDGET_ID,
        reasons,
        replayed: false,
      };
      return Object.assign(denied, {
        decisionEvidence: { resources: "application", kind: true, a: 0 },
      });
    },
    async settleBudget(): Promise<SettleBudgetResult> {
      return {
        kind: "settling",
        budget,
        newlyKnown: amounts,
        unresolvedResourceTypeIds: resources.map(
          ({ resourceTypeId }) => resourceTypeId,
        ),
        replayed: false,
      };
    },
    async getBudget(): Promise<GetBudgetResult> {
      return { budget, history: { rootBudgetId: BUDGET_ID, entries: history } };
    },
  };
}

function budgetProjection(
  resources: readonly InstalledResource[],
  state: "initial" | "current" = "current",
): BudgetProjection {
  const initial = state === "initial";
  return {
    budgetId: BUDGET_ID,
    parentBudgetId: null,
    rootBudgetId: BUDGET_ID,
    depth: 0,
    lifecycle: initial ? "active" : "settling",
    resources: requireNonempty(
      resources.map((resource) => ({
        resourceType: {
          resourceTypeId: resource.resourceTypeId,
          canonicalName: resource.key,
          unit: `${resource.key}-unit`,
          accountingBehavior: "consumable" as const,
          definitionDigest: "a".repeat(64),
        },
        allocated: amountFor(resource.key),
        available: initial ? amountFor(resource.key) : 0,
        committed: 0,
        directUsage: initial ? null : amountFor(resource.key),
        subtreeObservedUsage: 0,
        unresolved: true,
        deficit: initial ? 0 : amountFor(resource.key),
      })),
    ),
  };
}

function preparedResources(
  resources: readonly InstalledResource[],
): readonly [
  PreparedRootResource<ResourceName>,
  ...PreparedRootResource<ResourceName>[],
] {
  return requireNonempty(
    resources.map((resource): PreparedRootResource<ResourceName> => ({
      key: resource.key,
      canonicalName: resource.key,
      definition: {
        canonicalName: resource.key,
        unit: `${resource.key}-unit`,
        accountingBehavior: "consumable",
      },
      amount: amountFor(resource.key),
    })),
  );
}

function resourceAmounts(
  resources: readonly InstalledResource[],
): ResourceAmount[] {
  return resources.map((resource) => ({
    resourceTypeId: resource.resourceTypeId,
    amount: amountFor(resource.key),
  }));
}

function amountFor(resource: ResourceName): number {
  return resource === "alpha" ? 1 : 2;
}

function requireNonempty<Value>(values: readonly Value[]): [Value, ...Value[]] {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error("test fixture must not be empty");
  return [first, ...rest];
}

function admit<Result>(operation: () => Promise<Result>): Promise<Result>;
function admit<Prepared, Result>(
  prepare: () => Prepared,
  execute: (prepared: Prepared) => Promise<Result>,
): Promise<Result>;
async function admit<Prepared, Result>(
  prepare: () => Prepared,
  execute?: (prepared: Prepared) => Promise<Result>,
): Promise<Prepared | Result> {
  const prepared = prepare();
  return execute === undefined ? prepared : execute(prepared);
}
