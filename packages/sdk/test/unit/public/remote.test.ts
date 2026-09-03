import type { PoolConfig } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REMOTE_CONTRACT,
  type RemoteCommandExecutor,
  type RemoteProcedureDescriptor,
} from "../../../src/generated/client.js";
import {
  createKeynes,
  defineResources,
  type RemoteKeynes,
} from "../../../src/index.js";

const remoteMocks = vi.hoisted(() => ({
  normalizeDatabaseUrl: vi.fn(),
  openPostgresqlCommandExecutor: vi.fn(),
}));

vi.mock("../../../src/remote/connection-options.js", () => ({
  normalizeDatabaseUrl: remoteMocks.normalizeDatabaseUrl,
}));

vi.mock("../../../src/remote/postgresql-command-executor.js", () => ({
  openPostgresqlCommandExecutor: remoteMocks.openPostgresqlCommandExecutor,
}));

const databaseUrl =
  "postgresql://application:secret@db.example.test/keynes?sslmode=verify-full";
const rootReference = `kbr_v1_${"r".repeat(43)}`;
const childReference = `kbr_v1_${"c".repeat(43)}`;
const resources = defineResources({
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
});

beforeEach(() => {
  remoteMocks.normalizeDatabaseUrl.mockReset();
  remoteMocks.openPostgresqlCommandExecutor.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("public remote Keynes facade", () => {
  it("uses the one factory for a shared create, inspect, request, and settle path", async () => {
    const poolConfig: PoolConfig = { host: "db.example.test", max: 10 };
    const executor = createFakeExecutor();
    remoteMocks.normalizeDatabaseUrl.mockReturnValue(poolConfig);
    remoteMocks.openPostgresqlCommandExecutor.mockResolvedValue(executor);

    const remote: RemoteKeynes = await createKeynes({ databaseUrl });
    const root = await remote.createBudget(resources, { workUnits: 10 });
    const inspection = await root.inspect();
    const requested = await root.request({ workUnits: 3 });
    const settlement = await root.settle({ workUnits: 2 });

    expect(remoteMocks.normalizeDatabaseUrl).toHaveBeenCalledExactlyOnceWith(
      databaseUrl,
    );
    expect(
      remoteMocks.openPostgresqlCommandExecutor,
    ).toHaveBeenCalledExactlyOnceWith(poolConfig);
    expect(Object.isFrozen(remote)).toBe(true);
    expect(remote).toMatchObject({
      createBudget: expect.any(Function),
      close: expect.any(Function),
      [Symbol.asyncDispose]: expect.any(Function),
    });
    expect(inspection).toEqual({
      budget: {
        depth: 0,
        lifecycle: "active",
        resources: [
          {
            resource: "workUnits",
            unit: "unit",
            accountingBehavior: "consumable",
            allocated: 10,
            available: 7,
            committed: 3,
            directUsage: null,
            subtreeObservedUsage: 2,
            unresolved: true,
            deficit: 0,
          },
        ],
      },
      history: {
        entries: [
          {
            kind: "budget_created",
            sequence: 1,
            resources: [{ resource: "workUnits", amount: 10 }],
          },
        ],
      },
    });
    expect(requested).toMatchObject({
      status: "approved",
      budget: {
        inspect: expect.any(Function),
        request: expect.any(Function),
        settle: expect.any(Function),
      },
    });
    expect(settlement).toEqual({
      kind: "settled",
      budget: {
        depth: 0,
        lifecycle: "settled",
        resources: [
          {
            resource: "workUnits",
            unit: "unit",
            accountingBehavior: "consumable",
            allocated: 10,
            available: 7,
            committed: 3,
            directUsage: 2,
            subtreeObservedUsage: 2,
            unresolved: false,
            deficit: 0,
          },
        ],
      },
      newlyKnown: [{ resource: "workUnits", amount: 2 }],
      unresolvedResources: [],
      replayed: false,
    });
    expect(executor.methods).toEqual([
      "createBudget",
      "getBudget",
      "getBudgetHistoryPage",
      "requestBudget",
      "settleBudget",
    ]);
    expect(JSON.stringify(executor.inputs)).not.toMatch(
      /tenantId|principalId|budgetId|resourceTypeId/u,
    );

    const closing = remote.close();
    expect(remote.close()).toBe(closing);
    expect(remote[Symbol.asyncDispose]()).toBe(closing);
    await closing;
    expect(executor.close).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["explicit undefined", [undefined]],
    ["empty options", [{}]],
    ["unknown key", [{ databaseUrl, unknown: true }]],
    ["mixed connection intent", [{ databaseUrl, resources }]],
    ["more than one argument", [{ databaseUrl }, { databaseUrl }]],
  ])(
    "rejects malformed options without opening remote: %s",
    async (_description, arguments_) => {
      await expect(
        Reflect.apply(createKeynes, undefined, arguments_),
      ).rejects.toMatchObject({
        name: "KeynesSdkError",
        code: "invalid_configuration",
      });
      expect(remoteMocks.normalizeDatabaseUrl).not.toHaveBeenCalled();
      expect(remoteMocks.openPostgresqlCommandExecutor).not.toHaveBeenCalled();
    },
  );

  it("rejects a created root whose projection does not match the request", async () => {
    const executor = createFakeExecutor({
      createBudget: () => ({
        ok: true,
        result: {
          kind: "created",
          budget: {
            ...createdBudgetProjection(),
            resources: [
              {
                ...createdBudgetProjection().resources[0],
                allocated: 9,
              },
            ],
          },
          replayed: false,
        },
      }),
    });
    openRemoteWith(executor);

    const remote = await createKeynes({ databaseUrl });
    await expect(
      remote.createBudget(resources, { workUnits: 10 }),
    ).rejects.toMatchObject({ name: "KeynesError", code: "unknown" });
  });

  it.each([
    [
      "parent reference",
      {
        parentBudgetReference: childReference,
        resources: [{ resource: "work_units", amount: 3 }],
      },
    ],
    [
      "resource allocation",
      {
        parentBudgetReference: rootReference,
        resources: [{ resource: "work_units", amount: 2 }],
      },
    ],
  ])(
    "rejects an approved request with mismatched %s",
    async (_name, mismatch) => {
      const executor = createFakeExecutor({
        requestBudget: () => ({
          ok: true,
          result: {
            kind: "approved",
            childBudgetReference: childReference,
            replayed: false,
            ...mismatch,
          },
        }),
      });
      openRemoteWith(executor);

      const remote = await createKeynes({ databaseUrl });
      const root = await remote.createBudget(resources, { workUnits: 10 });
      await expect(root.request({ workUnits: 3 })).rejects.toMatchObject({
        name: "KeynesError",
        code: "unknown",
      });
    },
  );

  it("rejects inspection responses for a different Budget", async () => {
    const executor = createFakeExecutor({
      getBudgetHistoryPage: () => ({
        ok: true,
        result: {
          budgetReference: childReference,
          entries: [],
          nextCursor: null,
        },
      }),
    });
    openRemoteWith(executor);

    const remote = await createKeynes({ databaseUrl });
    const root = await remote.createBudget(resources, { workUnits: 10 });
    await expect(root.inspect()).rejects.toMatchObject({
      name: "KeynesError",
      code: "unknown",
    });
  });

  it("rejects a Budget projection for a different reference", async () => {
    const executor = createFakeExecutor({
      getBudget: () => ({
        ok: true,
        result: {
          budget: {
            ...budgetProjection("active", null),
            budgetReference: childReference,
          },
        },
      }),
    });
    openRemoteWith(executor);

    const remote = await createKeynes({ databaseUrl });
    const root = await remote.createBudget(resources, { workUnits: 10 });
    await expect(root.inspect()).rejects.toMatchObject({
      name: "KeynesError",
      code: "unknown",
    });
  });

  it("rejects settlement responses for a different Budget", async () => {
    const executor = createFakeExecutor({
      settleBudget: () => ({
        ok: true,
        result: {
          kind: "settled",
          budget: {
            ...budgetProjection("settled", 2),
            budgetReference: childReference,
          },
          newlyKnown: [{ resource: "work_units", amount: 2 }],
          unresolvedResources: [],
          replayed: false,
        },
      }),
    });
    openRemoteWith(executor);

    const remote = await createKeynes({ databaseUrl });
    const root = await remote.createBudget(resources, { workUnits: 10 });
    await expect(root.settle({ workUnits: 2 })).rejects.toMatchObject({
      name: "KeynesError",
      code: "unknown",
    });
  });

  it("bounds an in-flight inspection page by the inspection deadline", async () => {
    vi.useFakeTimers();
    const executor = createFakeExecutor({
      getBudgetHistoryPage: () => new Promise(() => undefined),
    });
    openRemoteWith(executor);

    const remote = await createKeynes({ databaseUrl });
    const root = await remote.createBudget(resources, { workUnits: 10 });
    const inspection = root.inspect();
    const rejection = expect(inspection).rejects.toMatchObject({
      name: "KeynesError",
      code: "timeout",
      details: { operation: "getBudgetHistoryPage" },
    });
    await vi.advanceTimersByTimeAsync(30_000);
    await rejection;
  });

  it("reports the stable inspection page limit", async () => {
    let page = 0;
    const executor = createFakeExecutor({
      getBudgetHistoryPage: () => ({
        ok: true,
        result: {
          budgetReference: rootReference,
          entries: [],
          nextCursor: `khc_v1_${String((page += 1)).padStart(43, "a")}`,
        },
      }),
    });
    openRemoteWith(executor);

    const remote = await createKeynes({ databaseUrl });
    const root = await remote.createBudget(resources, { workUnits: 10 });
    await expect(root.inspect()).rejects.toMatchObject({
      name: "KeynesError",
      code: "limit_exceeded",
      details: { limit: "inspection_pages", maximum: 128 },
    });
  });
});

type RemoteResponseOverrides = Partial<
  Record<RemoteProcedureDescriptor["method"], () => unknown>
>;

function openRemoteWith(executor: RemoteCommandExecutor): void {
  remoteMocks.normalizeDatabaseUrl.mockReturnValue({
    host: "db.example.test",
    max: 10,
  });
  remoteMocks.openPostgresqlCommandExecutor.mockResolvedValue(executor);
}

function createFakeExecutor(
  overrides: RemoteResponseOverrides = {},
): RemoteCommandExecutor & {
  readonly close: ReturnType<typeof vi.fn>;
  readonly methods: string[];
  readonly inputs: unknown[];
} {
  const methods: string[] = [];
  const inputs: unknown[] = [];
  const closePromise = Promise.resolve();
  const close = vi.fn(() => closePromise);
  return {
    methods,
    inputs,
    close,
    execute: vi.fn(
      async (procedure: RemoteProcedureDescriptor, input: unknown) => {
        methods.push(procedure.method);
        inputs.push(input);
        const override = overrides[procedure.method];
        return override === undefined
          ? responseFor(procedure.method)
          : await override();
      },
    ),
  };
}

function responseFor(method: RemoteProcedureDescriptor["method"]): unknown {
  switch (method) {
    case "getCompatibility":
      return {
        ok: true,
        result: {
          installationId: "embedded-postgresql-18.6-preview",
          contractDigest: `contract:${"a".repeat(64)}`,
          policyProfileDigest: `policy:${"b".repeat(64)}`,
          remoteProceduresDigest: `procedures:${"c".repeat(64)}`,
          semanticGeneration: 1,
          minimumSdkGeneration: 1,
          procedures: REMOTE_CONTRACT.procedures.map(
            ({ method: name, target, revision }) => ({
              name,
              target,
              revision,
            }),
          ),
        },
      };
    case "createBudget":
      return {
        ok: true,
        result: {
          kind: "created",
          budget: createdBudgetProjection(),
          replayed: false,
        },
      };
    case "getBudget":
      return { ok: true, result: { budget: budgetProjection("active", null) } };
    case "getBudgetHistoryPage":
      return {
        ok: true,
        result: {
          budgetReference: rootReference,
          entries: [
            {
              kind: "budget_created",
              sequence: 1,
              resources: [{ resource: "work_units", amount: 10 }],
            },
          ],
          nextCursor: null,
        },
      };
    case "requestBudget":
      return {
        ok: true,
        result: {
          kind: "approved",
          parentBudgetReference: rootReference,
          childBudgetReference: childReference,
          resources: [{ resource: "work_units", amount: 3 }],
          replayed: false,
        },
      };
    case "settleBudget":
      return {
        ok: true,
        result: {
          kind: "settled",
          budget: budgetProjection("settled", 2),
          newlyKnown: [{ resource: "work_units", amount: 2 }],
          unresolvedResources: [],
          replayed: false,
        },
      };
    case "openBudget":
    case "recoverOperation":
      throw new Error(`unexpected Phase 4 operation: ${method}`);
  }
}

function budgetProjection(
  lifecycle: "active" | "settled",
  directUsage: number | null,
) {
  return {
    budgetReference: rootReference,
    parentBudgetReference: null,
    rootBudgetReference: rootReference,
    depth: 0,
    lifecycle,
    resources: [
      {
        resource: {
          canonicalName: "work_units",
          unit: "unit",
          accountingBehavior: "consumable",
        },
        allocated: 10,
        available: 7,
        committed: 3,
        directUsage,
        subtreeObservedUsage: 2,
        unresolved: directUsage === null,
        deficit: 0,
      },
    ],
  };
}

function createdBudgetProjection() {
  return {
    budgetReference: rootReference,
    parentBudgetReference: null,
    rootBudgetReference: rootReference,
    depth: 0,
    lifecycle: "active" as const,
    resources: [
      {
        resource: {
          canonicalName: "work_units",
          unit: "unit",
          accountingBehavior: "consumable" as const,
        },
        allocated: 10,
        available: 10,
        committed: 0,
        directUsage: null,
        subtreeObservedUsage: 0,
        unresolved: true,
        deficit: 0,
      },
    ],
  };
}
