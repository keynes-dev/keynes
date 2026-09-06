import type { PoolConfig } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REMOTE_CONTRACT,
  type RemoteCommandExecutor,
  type RemoteProcedureDescriptor,
} from "../../../src/generated/client.js";
import {
  createKeynes,
  createOperationKey,
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
const resources = {
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
};

beforeEach(() => {
  remoteMocks.normalizeDatabaseUrl.mockReset();
  remoteMocks.openPostgresqlCommandExecutor.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("public remote Keynes facade", () => {
  it("snapshots raw remote creation before caller mutation", async () => {
    const executor = createFakeExecutor();
    openRemoteWith(executor);
    const remote = await createKeynes({ databaseUrl });
    const definitions = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      extra: { unit: "slot", accountingBehavior: "reusable" },
    };
    const allocation = { workUnits: 10 };
    const operationKey = createOperationKey();
    const options = { operationKey };
    try {
      const pending = remote.createBudget(definitions, allocation, options);
      definitions.workUnits.unit = "changed";
      allocation.workUnits = 99;
      options.operationKey = createOperationKey();
      await pending;
      expect(executor.inputs[0]).toMatchObject({
        operationKey,
        resources: {
          kind: "definitions",
          definitions: {
            workUnits: { unit: "unit", accountingBehavior: "consumable" },
            extra: { unit: "slot", accountingBehavior: "reusable" },
          },
        },
        allocation: { workUnits: 10 },
      });
    } finally {
      await remote.close();
    }
  });

  it.each<Readonly<Record<string, unknown>>>([
    { constructor: undefined },
    { toString: undefined },
    { extra: undefined },
    {
      extra: {
        unit: "unit",
        accountingBehavior: "consumable",
        unknown: undefined,
      },
    },
    {
      extra: Object.assign(Object.create({ unit: "unit" }), {
        accountingBehavior: "consumable",
      }),
    },
  ])(
    "rejects raw remote creation before serialization, case %#",
    async (extra) => {
      const executor = createFakeExecutor();
      openRemoteWith(executor);
      const remote = await createKeynes({ databaseUrl });
      try {
        const pending: unknown = Reflect.apply(remote.createBudget, remote, [
          {
            workUnits: { unit: "unit", accountingBehavior: "consumable" },
            ...extra,
          },
          { workUnits: 10 },
        ]);
        expect(pending).toBeInstanceOf(Promise);
        await expect(pending).rejects.toMatchObject({
          code: "invalid_command",
        });
        expect(executor.methods).toEqual([]);
      } finally {
        await remote.close();
      }
    },
  );

  it("keeps independent definition references out of the public binding", async () => {
    const executor = createFakeExecutor();
    openRemoteWith(executor);
    const remote = await createKeynes({ databaseUrl });
    try {
      const binding = await remote.defineResources({
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
      });
      expect(Object.isFrozen(binding)).toBe(true);
      expect(Object.keys(binding)).toEqual([]);
      expect(JSON.stringify(binding)).toBe("{}");
      for (const key of Reflect.ownKeys(binding)) {
        expect(Object.getOwnPropertyDescriptor(binding, key)).toMatchObject({
          value: undefined,
          writable: false,
          configurable: false,
        });
      }
      expect(Reflect.set(binding, "bindingReference", "forged")).toBe(false);
      expect(executor.methods).toEqual(["defineResources"]);
      for (const copy of [
        { ...binding },
        JSON.parse(JSON.stringify(binding)),
      ]) {
        await expect(
          Reflect.apply(remote.defineResources, remote, [copy]),
        ).rejects.toMatchObject({
          code: "invalid_command",
        });
      }
      expect(executor.methods).toEqual(["defineResources"]);
    } finally {
      await remote.close();
    }
  });

  it("snapshots independent definition and operation options before await", async () => {
    const executor = createFakeExecutor();
    openRemoteWith(executor);
    const remote = await createKeynes({ databaseUrl });
    const definitions = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    };
    const operationKey = createOperationKey();
    const options = { operationKey };
    try {
      const defining = remote.defineResources(definitions, options);
      definitions.workUnits.unit = "changed";
      definitions.workUnits.accountingBehavior = "reusable";
      options.operationKey = createOperationKey();
      await defining;
      expect(executor.inputs).toEqual([
        {
          operationKey,
          definitions: {
            workUnits: { unit: "unit", accountingBehavior: "consumable" },
          },
        },
      ]);
    } finally {
      await remote.close();
    }
  });

  it.each([
    ["empty batch", {}],
    ["undefined entry", { workUnits: undefined }],
    [
      "undefined constructor entry",
      {
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
        constructor: undefined,
      },
    ],
    [
      "undefined toString entry",
      {
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
        toString: undefined,
      },
    ],
    [
      "undefined unknown field",
      {
        workUnits: {
          unit: "unit",
          accountingBehavior: "consumable",
          unknown: undefined,
        },
      },
    ],
    [
      "undefined constructor field",
      {
        workUnits: {
          unit: "unit",
          accountingBehavior: "consumable",
          constructor: undefined,
        },
      },
    ],
    [
      "nonenumerable constructor entry",
      Object.defineProperty(
        { workUnits: { unit: "unit", accountingBehavior: "consumable" } },
        "constructor",
        { value: undefined },
      ),
    ],
    [
      "nonenumerable unknown field",
      {
        workUnits: Object.defineProperty(
          { unit: "unit", accountingBehavior: "consumable" },
          "unknown",
          { value: undefined },
        ),
      },
    ],
    [
      "symbol unknown field",
      {
        workUnits: {
          unit: "unit",
          accountingBehavior: "consumable",
          [Symbol("unknown")]: undefined,
        },
      },
    ],
    [
      "inherited unit",
      {
        workUnits: Object.assign(Object.create({ unit: "unit" }), {
          accountingBehavior: "consumable",
        }),
      },
    ],
    [
      "inherited behavior",
      {
        workUnits: Object.assign(
          Object.create({ accountingBehavior: "consumable" }),
          { unit: "unit" },
        ),
      },
    ],
  ])(
    "rejects malformed independent definitions before remote serialization: %s",
    async (_name, definitions) => {
      const executor = createFakeExecutor();
      openRemoteWith(executor);
      const remote = await createKeynes({ databaseUrl });
      try {
        const result: unknown = Reflect.apply(remote.defineResources, remote, [
          definitions,
        ]);
        expect(result).toBeInstanceOf(Promise);
        await expect(result).rejects.toMatchObject({ code: "invalid_command" });
        expect(executor.methods).toEqual([]);
      } finally {
        await remote.close();
      }
    },
  );

  it.each(["definition", "entry", "option"])(
    "rejects independent %s getter failures asynchronously",
    async (location) => {
      const executor = createFakeExecutor();
      openRemoteWith(executor);
      const remote = await createKeynes({ databaseUrl });
      const failure = new Error("definition getter failed");
      const read = (): never => {
        throw failure;
      };
      const definitions =
        location === "definition"
          ? Object.defineProperty({}, "workUnits", {
              enumerable: true,
              get: read,
            })
          : {
              workUnits:
                location === "entry"
                  ? Object.defineProperty(
                      { accountingBehavior: "consumable" },
                      "unit",
                      { enumerable: true, get: read },
                    )
                  : { unit: "unit", accountingBehavior: "consumable" },
            };
      const options =
        location === "option"
          ? Object.defineProperty({}, "operationKey", {
              enumerable: true,
              get: read,
            })
          : {};
      try {
        const result: unknown = Reflect.apply(remote.defineResources, remote, [
          definitions,
          options,
        ]);
        expect(result).toBeInstanceOf(Promise);
        await expect(result).rejects.toBe(failure);
        expect(executor.methods).toEqual([]);
      } finally {
        await remote.close();
      }
    },
  );

  it("rejects nonenumerable unknown definition options before transport", async () => {
    const executor = createFakeExecutor();
    openRemoteWith(executor);
    const remote = await createKeynes({ databaseUrl });
    const options = Object.defineProperty({}, "unknown", { value: undefined });
    try {
      await expect(
        Reflect.apply(remote.defineResources, remote, [
          { workUnits: { unit: "unit", accountingBehavior: "consumable" } },
          options,
        ]),
      ).rejects.toMatchObject({ code: "invalid_configuration" });
      expect(executor.methods).toEqual([]);
    } finally {
      await remote.close();
    }
  });

  it("reads the independent definition operation key once when snapshotting options", async () => {
    const executor = createFakeExecutor();
    openRemoteWith(executor);
    const remote = await createKeynes({ databaseUrl });
    const operationKey = createOperationKey();
    const read = vi.fn(() => operationKey);
    const options = Object.defineProperty({}, "operationKey", {
      enumerable: true,
      get: read,
    });
    try {
      await remote.defineResources(
        {
          workUnits: { unit: "unit", accountingBehavior: "consumable" },
        },
        options,
      );
      expect(read).toHaveBeenCalledOnce();
      expect(executor.inputs).toEqual([
        {
          operationKey,
          definitions: {
            workUnits: { unit: "unit", accountingBehavior: "consumable" },
          },
        },
      ]);
    } finally {
      await remote.close();
    }
  });

  it("sends valid constructor and toString independent definitions intact", async () => {
    const executor = createFakeExecutor();
    openRemoteWith(executor);
    const remote = await createKeynes({ databaseUrl });
    const definitions = {
      constructor: { unit: "unit", accountingBehavior: "consumable" },
      toString: { unit: "slot", accountingBehavior: "reusable" },
    };
    try {
      await remote.defineResources(definitions);
      expect(executor.inputs).toEqual([
        { operationKey: expect.any(String), definitions },
      ]);
    } finally {
      await remote.close();
    }
  });

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
          ? responseFor(procedure.method, input)
          : await override();
      },
    ),
  };
}

function responseFor(
  method: RemoteProcedureDescriptor["method"],
  input: unknown,
): unknown {
  if (String(method) === "defineResources") {
    if (
      typeof input !== "object" ||
      input === null ||
      !("definitions" in input) ||
      typeof input.definitions !== "object" ||
      input.definitions === null
    ) {
      throw new Error("expected definition command in remote fixture");
    }
    return {
      ok: true,
      result: {
        kind: "defined",
        bindingReference: `krs_v1_${"d".repeat(43)}`,
        resources: Object.entries(input.definitions).map(
          ([key, definition], index) => ({
            key,
            resourceType: {
              resourceTypeId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
              canonicalName: key.replace(
                /[A-Z]/gu,
                (letter) => `_${letter.toLowerCase()}`,
              ),
              ...definition,
              definitionDigest: `sha256:${"d".repeat(64)}`,
            },
            definitionEvidence: {
              kind: "resource_type_defined",
              commandId: "00000000-0000-4000-8000-000000000101",
              principalId: "00000000-0000-4000-8000-000000000201",
              definitionDigest: `sha256:${"d".repeat(64)}`,
            },
          }),
        ),
        replayed: false,
      },
    };
  }
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
