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

    const [created, denied, , settled] = first.snapshot.history.entries;
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

    const settledSnapshot = await exerciseSettledProjection([
      { key: "alpha", resourceTypeId: HIGH_RESOURCE_ID },
      { key: "zebra", resourceTypeId: LOW_RESOURCE_ID },
    ]);
    expect(settledSnapshot.budget).toMatchObject({ lifecycle: "settled" });
    expect(settledSnapshot.budget.resources).toEqual([
      expect.objectContaining({
        resource: "alpha",
        allocated: 1,
        available: 0,
        committed: 0,
      }),
      expect.objectContaining({
        resource: "zebra",
        allocated: 2,
        available: 0,
        committed: 0,
      }),
    ]);

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
      kind: "budget_created" as const,
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

  it("keeps a narrowed target separate from frozen root-wide lineage", async () => {
    const snapshot = await exerciseNarrowedProjection([
      { key: "alpha", resourceTypeId: HIGH_RESOURCE_ID },
      { key: "zebra", resourceTypeId: LOW_RESOURCE_ID },
    ]);

    expectTypeOf(snapshot).toEqualTypeOf<
      BudgetSnapshot<"alpha", ResourceName>
    >();
    expect(snapshot.budget).toMatchObject({
      lineageId: 2,
      parentLineageId: 1,
      resources: [{ resource: "alpha" }],
    });
    expect(snapshot.history.entries).toMatchObject([
      {
        kind: "budget_created",
        subject: 1,
        cause: { kind: "command" },
        movements: [
          {
            reason: "initial_allocation",
            resource: "alpha",
            amount: 1,
            from: null,
            to: 1,
          },
          {
            reason: "initial_allocation",
            resource: "zebra",
            amount: 2,
            from: null,
            to: 1,
          },
        ],
      },
      {
        kind: "request_denied",
        subject: 1,
        cause: { kind: "command" },
        movements: [],
      },
      {
        kind: "request_approved",
        subject: 2,
        parent: 1,
        cause: { kind: "command" },
        decisionEvidence: {
          budgetId: "caller-budget",
          commandId: "caller-command",
          movement: "caller-movement",
          resourceTypeId: "caller-resource",
        },
        movements: [
          {
            reason: "child_grant",
            resource: "alpha",
            amount: 1,
            from: 1,
            to: 2,
          },
        ],
      },
      {
        kind: "budget_settlement_recorded",
        subject: 2,
        cause: { kind: "command" },
        movements: [
          {
            reason: "consumption",
            resource: "alpha",
            amount: 1,
            from: 2,
            to: null,
          },
          {
            reason: "settlement_return",
            resource: "zebra",
            amount: 2,
            from: 2,
            to: 1,
          },
        ],
      },
    ]);

    const approved = snapshot.history.entries[2];
    const childSettled = snapshot.history.entries[3];
    expect(approved).toBeDefined();
    expect(childSettled).toBeDefined();
    expect(Object.isFrozen(snapshot.budget)).toBe(true);
    expect(Object.isFrozen(snapshot.history)).toBe(true);
    expect(Object.isFrozen(snapshot.history.entries)).toBe(true);
    expect(Object.isFrozen(approved)).toBe(true);
    expect(Object.isFrozen(approved?.cause)).toBe(true);
    expect(Object.isFrozen(approved?.movements)).toBe(true);
    expect(Object.isFrozen(approved?.movements[0])).toBe(true);
    expect(Object.isFrozen(childSettled?.movements)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    expect(JSON.stringify(snapshot)).not.toContain("kop_v1_");
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

async function exerciseSettledProjection(
  resources: readonly InstalledResource[],
) {
  const runtime = createRuntime(resources, resources, "settled");
  const binding = createResourceBinding(
    preparedResources(resources),
    budgetProjection(resources, "initial"),
  );
  return createBudgetHandle<ResourceName>(
    runtime,
    BUDGET_ID,
    binding,
  ).inspect();
}

function createRuntime(
  resources: readonly InstalledResource[],
  budgetResources: readonly InstalledResource[] = resources,
  state: "current" | "settled" = "current",
): BasicRuntimeSession {
  const orderedResources = [...resources].sort((left, right) =>
    left.resourceTypeId.localeCompare(right.resourceTypeId),
  );
  const client = createClient(orderedResources, budgetResources, state);
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
  state: "current" | "settled" = "current",
): KeynesClient {
  const budget = {
    ...budgetProjection(budgetResources, state),
    lineageId: budgetResources.length === resources.length ? 1 : 2,
    parentLineageId: budgetResources.length === resources.length ? null : 1,
  };
  const amounts = resourceAmounts(resources);
  const alphaResourceId = resources.find(
    ({ key }) => key === "alpha",
  )?.resourceTypeId;
  if (alphaResourceId === undefined)
    throw new Error("test fixture must define alpha");
  const zebraResourceId = resources.find(
    ({ key }) => key === "zebra",
  )?.resourceTypeId;
  if (zebraResourceId === undefined)
    throw new Error("test fixture must define zebra");
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
      subject: 1,
      cause: { kind: "command" },
      movements: [
        {
          reason: "initial_allocation",
          resourceTypeId: alphaResourceId,
          amount: 1,
          from: null,
          to: 1,
        },
        {
          reason: "initial_allocation",
          resourceTypeId: zebraResourceId,
          amount: 2,
          from: null,
          to: 1,
        },
      ],
      commandId: "00000000-0000-4000-8000-000000000201",
      subjectBudgetId: BUDGET_ID,
      rootBudgetId: BUDGET_ID,
      resources: requireNonempty(amounts),
    },
    {
      kind: "request_denied",
      entryId: "00000000-0000-4000-8000-000000000102",
      sequence: 2,
      subject: 1,
      cause: { kind: "command" },
      movements: [],
      commandId: "00000000-0000-4000-8000-000000000202",
      subjectBudgetId: BUDGET_ID,
      parentBudgetId: BUDGET_ID,
      reasons,
    },
    {
      kind: "request_approved",
      entryId: "00000000-0000-4000-8000-000000000104",
      sequence: 3,
      subject: 2,
      parent: 1,
      cause: { kind: "command" },
      movements: [
        {
          reason: "child_grant",
          resourceTypeId: alphaResourceId,
          amount: 1,
          from: 1,
          to: 2,
        },
      ],
      commandId: "00000000-0000-4000-8000-000000000204",
      subjectBudgetId: BUDGET_ID,
      parentBudgetId: BUDGET_ID,
      childBudgetId: "00000000-0000-4000-8000-000000000011",
      resources: requireNonempty([
        { resourceTypeId: alphaResourceId, amount: 1 },
      ]),
      decisionEvidence: {
        budgetId: "caller-budget",
        commandId: "caller-command",
        movement: "caller-movement",
        resourceTypeId: "caller-resource",
      },
    },
    {
      kind: "budget_settlement_recorded",
      entryId: "00000000-0000-4000-8000-000000000103",
      sequence: 4,
      subject: 2,
      cause: { kind: "command" },
      movements: [
        {
          reason: "consumption",
          resourceTypeId: alphaResourceId,
          amount: 1,
          from: 2,
          to: null,
        },
        {
          reason: "settlement_return",
          resourceTypeId: zebraResourceId,
          amount: 2,
          from: 2,
          to: 1,
        },
      ],
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
  state: "initial" | "current" | "settled" = "current",
): BudgetProjection {
  const initial = state === "initial";
  const settled = state === "settled";
  return {
    budgetId: BUDGET_ID,
    parentBudgetId: null,
    rootBudgetId: BUDGET_ID,
    depth: 0,
    lifecycle: initial ? "active" : settled ? "settled" : "settling",
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
        unresolved: !settled,
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
