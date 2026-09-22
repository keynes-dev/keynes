import { postgres } from "@keynes/postgres";
import type { PoolConfig } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  KeynesError,
  type RemoteCommandExecutor,
  type RemoteProcedureDescriptor,
} from "../../../src/generated/client.js";
import { createKeynes, createOperationKey } from "../../../src/index.js";
import type { BudgetReference, OperationKey } from "../../../src/index.js";

const remoteMocks = vi.hoisted(() => ({
  normalizeDatabaseUrl: vi.fn(),
  openPostgresqlCommandExecutor: vi.fn(),
}));

vi.mock("../../../../postgres/src/remote/connection-options.js", () => ({
  normalizeDatabaseUrl: remoteMocks.normalizeDatabaseUrl,
}));

vi.mock(
  "../../../../postgres/src/remote/postgresql-command-executor.js",
  () => ({
    openPostgresqlCommandExecutor: remoteMocks.openPostgresqlCommandExecutor,
  }),
);

const databaseUrl =
  "postgresql://application:secret@db.example.test/keynes?sslmode=verify-full";
const rootReference = `kbr_v1_${"r".repeat(43)}` as BudgetReference;
const operationKey = `kop_v1_${"o".repeat(43)}` as OperationKey;
const resources = {
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
};

beforeEach(() => {
  remoteMocks.normalizeDatabaseUrl.mockReset();
  remoteMocks.openPostgresqlCommandExecutor.mockReset();
  remoteMocks.normalizeDatabaseUrl.mockReturnValue({
    host: "db.example.test",
    max: 10,
  } satisfies PoolConfig);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("remote Budget reopen and operation recovery", () => {
  it("reuses captured settlement usage and operation key after caller mutation between attempts", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const usage = { workUnits: 2 };
    const options = { operationKey };
    let attempts = 0;
    const executor = fakeExecutor((method) => {
      if (method === "createBudget") return createdResponse();
      if (method !== "settleBudget") throw new Error(`unexpected ${method}`);
      if (++attempts === 1) {
        usage.workUnits = 9;
        options.operationKey = createOperationKey();
        return {
          ok: false,
          error: {
            kind: "error",
            code: "unavailable",
            details: { retryAfterMilliseconds: 0 },
          },
        };
      }
      return settledResponse();
    });
    openWith(executor);
    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });
    try {
      const budget = await remote.createBudget({ workUnits: 10 });
      let pending: unknown;
      expect(() => {
        pending = budget.settle(usage, options);
      }).not.toThrow();
      expect(pending).toBeInstanceOf(Promise);
      await expect(pending).resolves.toBeDefined();
      expect(executor.inputs.slice(1)).toEqual(
        Array.from({ length: 2 }, () => ({
          budgetReference: rootReference,
          operationKey,
          usage: [{ resource: "work_units", amount: 2 }],
        })),
      );
    } finally {
      await remote.close();
    }
  });

  it("recovers a definition as an opaque binding usable for creation", async () => {
    const executor = fakeExecutor((method) => {
      if (method === "recoverOperation")
        return {
          ok: true,
          result: {
            kind: "committed",
            operationKey,
            operation: "defineResources",
            result: definedResponse().result,
          },
        };
      if (method === "createBudget") return createdResponse();
      throw new Error(`unexpected operation ${method}`);
    });
    openWith(executor);
    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });
    const recovered = await remote.getOperationResult(operationKey);
    expect(recovered).toMatchObject({
      kind: "committed",
      operation: "defineResources",
      operationKey,
    });
    expect(record(recovered).result).toEqual({});
    expect(JSON.stringify(recovered)).not.toMatch(
      /krs_v1_|resourceTypeId|principalId|definitionDigest|00000000/,
    );
    const root = await remote.createBudget({ workUnits: 10 });
    expect(root.reference).toBe(rootReference);
    expect(record(executor.inputs[1]).definitions).toEqual(resources);
  });

  it("retries a lost definition response with the same key and returns an opaque binding", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    let attempts = 0;
    const executor = fakeExecutor((method) => {
      if (method === "createBudget") return createdResponse();
      if (method !== "defineResources")
        throw new Error(`unexpected operation ${method}`);
      if (++attempts === 1)
        return {
          ok: false,
          error: {
            kind: "error",
            code: "uncertain_outcome",
            details: { operation: "defineResources", operationKey },
          },
        };
      return definedResponse();
    });
    openWith(executor);
    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });
    const binding = await remote.defineResources(resources, { operationKey });
    expect(executor.inputs.map(inputOperationKey)).toEqual([
      operationKey,
      operationKey,
    ]);
    expect(executor.inputs[0]).toEqual(executor.inputs[1]);
    expect(Reflect.ownKeys(binding)).toEqual([]);
    expect(Object.isFrozen(binding)).toBe(true);
    await remote.createBudget({ workUnits: 10 });
  });

  it("replays configured creation from expanded compatible declarations with zero membership", async () => {
    const selectedResources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      zeroSeats: { unit: "seat", accountingBehavior: "reusable" },
    };
    const result = configuredCreatedResponse(false);
    let creates = 0;
    const executor = fakeExecutor((method) => {
      if (method === "createBudget") {
        creates += 1;
        return configuredCreatedResponse(creates === 2);
      }
      if (method === "recoverOperation") {
        return {
          ok: true,
          result: {
            kind: "committed",
            operationKey,
            operation: "createBudget",
            result: result.result,
          },
        };
      }
      throw new Error(`unexpected operation ${method}`);
    });
    openWith(executor);
    const first = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources: selectedResources,
    });
    const replaying = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources: {
        unusedCredits: { unit: "credit", accountingBehavior: "consumable" },
        ...selectedResources,
      },
    });

    const original = await first.createBudget(
      { workUnits: 10, zeroSeats: 0 },
      { operationKey },
    );
    const replay = await replaying.createBudget(
      { workUnits: 10, zeroSeats: 0 },
      { operationKey },
    );
    const recovered = await replaying.getOperationResult(operationKey);

    expect(replay.reference).toBe(original.reference);
    expect(recovered).toEqual({
      kind: "committed",
      operationKey,
      operation: "createBudget",
      result: result.result,
    });
    expect(
      executor.inputs.filter(
        (_input, index) => executor.methods[index] === "createBudget",
      ),
    ).toEqual([
      {
        operationKey,
        definitions: selectedResources,
        amounts: { workUnits: 10, zeroSeats: 0 },
      },
      {
        operationKey,
        definitions: selectedResources,
        amounts: { workUnits: 10, zeroSeats: 0 },
      },
    ]);
  });

  it("keeps definition uncertainty distinct from expired and unresolved recovery", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    let attempts = 0;
    let recoveries = 0;
    const executor = fakeExecutor((method) => {
      if (method === "defineResources")
        return ++attempts === 1
          ? {
              ok: false,
              error: {
                kind: "error",
                code: "uncertain_outcome",
                details: { operation: "defineResources", operationKey },
              },
            }
          : {
              ok: false,
              error: { kind: "error", code: "client_closed", details: {} },
            };
      if (method === "recoverOperation")
        return {
          ok: true,
          result:
            ++recoveries === 1
              ? {
                  kind: "unresolved",
                  operationKey,
                  retryAfterMilliseconds: 100,
                }
              : { kind: "expired", operationKey },
        };
      throw new Error(`unexpected operation ${method}`);
    });
    openWith(executor);
    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });
    await expect(
      remote.defineResources(resources, { operationKey }),
    ).rejects.toMatchObject({
      code: "uncertain_outcome",
      details: { operation: "defineResources", operationKey },
    });
    expect(await remote.getOperationResult(operationKey)).toEqual({
      kind: "unresolved",
      operationKey,
      retryAfterMilliseconds: 100,
    });
    expect(await remote.getOperationResult(operationKey)).toEqual({
      kind: "expired",
      operationKey,
    });
    expect(executor.methods).toEqual([
      "defineResources",
      "defineResources",
      "recoverOperation",
      "recoverOperation",
    ]);
  });

  it.each(["command_conflict", "invalid_command"] as const)(
    "keeps definition %s failures definitive without fabricating a binding",
    async (code) => {
      const details =
        code === "invalid_command"
          ? {
              operation: "defineResources",
              issues: [{ path: "$.definitions", rule: "type" }],
            }
          : {};
      const executor = fakeExecutor((method) =>
        method === "defineResources"
          ? { ok: false, error: { kind: "error", code, details } }
          : {
              ok: true,
              result: {
                kind: "known_failure",
                operationKey,
                error: { kind: "error", code, details },
              },
            },
      );
      openWith(executor);
      const remote = await createKeynes({
        runtime: postgres({ databaseUrl }),
        resources,
      });
      await expect(
        remote.defineResources(resources, { operationKey }),
      ).rejects.toMatchObject({ code });
      expect(executor.inputs).toHaveLength(1);
      expect(await remote.getOperationResult(operationKey)).toEqual({
        kind: "known_failure",
        operationKey,
        error: { kind: "error", code, details },
      });
    },
  );

  it("uses caller-created keys unchanged for every remote mutation", async () => {
    const executor = fakeExecutor((method) => {
      if (method === "createBudget") return createdResponse();
      if (method === "requestBudget") return approvedResponse();
      if (method === "settleBudget") return settledResponse();
      throw new Error(`unexpected operation ${method}`);
    });
    openWith(executor);
    const key = createOperationKey();

    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });
    const root = await remote.createBudget(
      { workUnits: 10 },
      { operationKey: key },
    );
    await root.request({ workUnits: 3 }, { operationKey: key });
    await root.settle({ workUnits: 2 }, { operationKey: key });

    expect(executor.inputs.map(inputOperationKey)).toEqual([key, key, key]);
    expect(key).toMatch(/^kop_v1_[A-Za-z0-9_-]{43}$/u);
  });

  it("preserves request evidence through committed recovery", async () => {
    const decisionEvidence = { rule: "pro", revision: 1 };
    const requestResult = {
      ...approvedResponse().result,
      decisionEvidence,
    };
    const executor = fakeExecutor((method) => {
      if (method === "createBudget") return createdResponse();
      if (method === "requestBudget")
        return { ok: true, result: requestResult };
      if (method === "recoverOperation")
        return {
          ok: true,
          result: {
            kind: "committed",
            operationKey,
            operation: "requestBudget",
            result: requestResult,
          },
        };
      throw new Error(`unexpected operation ${method}`);
    });
    openWith(executor);
    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });
    const root = await remote.createBudget({ workUnits: 10 });
    const requestOptions = { operationKey, decisionEvidence };
    const requested = await root.request({ workUnits: 3 }, requestOptions);

    expect(requested).toMatchObject({
      status: "approved",
      decisionEvidence,
    });
    expect(await remote.getOperationResult(operationKey)).toMatchObject({
      kind: "committed",
      operationKey,
      operation: "requestBudget",
      result: { decisionEvidence },
    });
    expect(executor.inputs[1]).toMatchObject({
      operationKey,
      decisionEvidence,
    });
  });

  it("reopens after creation permission is revoked without another validation query", async () => {
    const methods: string[] = [];
    const executor: RemoteCommandExecutor & {
      close(): Promise<void>;
      assertOpen(): void;
    } = {
      assertOpen() {},
      async execute(procedure) {
        methods.push(procedure.method);
        if (procedure.method === "validateResources") {
          return methods.length === 1
            ? { ok: true, result: { valid: true } }
            : {
                ok: false,
                error: {
                  kind: "error",
                  code: "unauthorized",
                  details: {
                    operation: "validateResources",
                    requiredPermission: "remote_access",
                  },
                },
              };
        }
        if (procedure.method !== "openBudget")
          throw new Error(`unexpected operation ${procedure.method}`);
        return {
          ok: true,
          result: {
            budgetReference: rootReference,
            budget: rootBudget("active", null),
          },
        };
      },
      async close() {},
    };
    openWith(executor);
    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });
    try {
      await expect(
        remote.openBudget({
          reference: rootReference,
          resourceTypes: resources,
        }),
      ).resolves.toMatchObject({ reference: rootReference });
      expect(methods).toEqual(["validateResources", "openBudget"]);
    } finally {
      await remote.close();
    }
  });

  it("reopens only the PostgreSQL-checked Resource binding", async () => {
    const executor = fakeExecutor((method, input) => {
      if (method !== "openBudget") {
        throw new Error(`unexpected operation ${method}`);
      }
      const expectedResources = record(input).expectedResources;
      if (
        JSON.stringify(expectedResources) !==
        JSON.stringify([
          {
            canonicalName: "work_units",
            unit: "unit",
            accountingBehavior: "consumable",
          },
        ])
      ) {
        return {
          ok: false,
          error: {
            kind: "error",
            code: "resource_binding_mismatch",
            details: {},
          },
        };
      }
      return {
        ok: true,
        result: {
          budgetReference: rootReference,
          budget: rootBudget("active", null),
        },
      };
    });
    openWith(executor);

    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });
    const reopened = await remote.openBudget({
      reference: rootReference,
      resourceTypes: resources,
    });

    expect(reopened.reference).toBe(rootReference);
    await expect(
      remote.openBudget({
        reference: rootReference,
        resourceTypes: {
          workUnits: { unit: "credit", accountingBehavior: "consumable" },
        },
      }),
    ).rejects.toMatchObject({
      name: "KeynesError",
      code: "resource_binding_mismatch",
    });
  });

  it("projects all five read-only operation results without changing the key", async () => {
    const results = [
      {
        kind: "committed",
        operationKey,
        operation: "createBudget",
        result: createdResponse().result,
      },
      {
        kind: "known_failure",
        operationKey,
        error: { kind: "error", code: "budget_not_found", details: {} },
      },
      { kind: "unresolved", operationKey, retryAfterMilliseconds: 250 },
      { kind: "not_found", operationKey },
      { kind: "expired", operationKey },
    ] as const;
    let index = 0;
    const executor = fakeExecutor((method) => {
      if (method !== "recoverOperation") {
        throw new Error(`unexpected operation ${method}`);
      }
      return { ok: true, result: results[index++] };
    });
    openWith(executor);

    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });
    const recovered = [];
    for (let call = 0; call < results.length; call += 1) {
      recovered.push(await remote.getOperationResult(operationKey));
    }

    expect(recovered.map(({ kind }) => kind)).toEqual([
      "committed",
      "known_failure",
      "unresolved",
      "not_found",
      "expired",
    ]);
    expect(
      recovered.every((result) => result.operationKey === operationKey),
    ).toBe(true);
    expect(executor.inputs).toEqual(
      Array.from({ length: 5 }, () => ({ operationKey })),
    );
  });

  it("retries at most three times with the same key", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const executor = fakeExecutor((method) => {
      if (method !== "createBudget") {
        throw new Error(`unexpected operation ${method}`);
      }
      return {
        ok: false,
        error: {
          kind: "error",
          code: "unavailable",
          details: { retryAfterMilliseconds: 0 },
        },
      };
    });
    openWith(executor);
    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });

    await expect(
      remote.createBudget({ workUnits: 10 }, { operationKey }),
    ).rejects.toMatchObject({ name: "KeynesError", code: "unavailable" });

    expect(executor.inputs).toHaveLength(3);
    expect(executor.inputs.map(inputOperationKey)).toEqual([
      operationKey,
      operationKey,
      operationKey,
    ]);
  });

  it("does not retry after the total retry deadline expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00Z"));
    const executor = fakeExecutor((method) => {
      if (method !== "createBudget") {
        throw new Error(`unexpected operation ${method}`);
      }
      vi.setSystemTime(new Date("2026-09-02T00:01:00Z"));
      return {
        ok: false,
        error: { kind: "error", code: "unavailable", details: {} },
      };
    });
    openWith(executor);
    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });

    await expect(
      remote.createBudget({ workUnits: 10 }, { operationKey }),
    ).rejects.toMatchObject({ name: "KeynesError", code: "unavailable" });
    expect(executor.inputs).toHaveLength(1);
  });

  it("preserves uncertainty when a later retry cannot dispatch", async () => {
    let attempt = 0;
    const executor = fakeExecutor((method) => {
      if (method !== "createBudget") {
        throw new Error(`unexpected operation ${method}`);
      }
      attempt += 1;
      return attempt === 1
        ? {
            ok: false,
            error: {
              kind: "error",
              code: "uncertain_outcome",
              details: { operation: "createBudget", operationKey },
            },
          }
        : {
            ok: false,
            error: { kind: "error", code: "client_closed", details: {} },
          };
    });
    openWith(executor);
    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });

    await expect(
      remote.createBudget({ workUnits: 10 }, { operationKey }),
    ).rejects.toMatchObject({
      name: "KeynesError",
      code: "uncertain_outcome",
      details: { operationKey },
    });
  });

  it("classifies an attempt crossing the retry deadline as uncertain", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0);
    let attempt = 0;
    const executor = fakeExecutor((method) => {
      if (method !== "createBudget") {
        throw new Error(`unexpected operation ${method}`);
      }
      attempt += 1;
      if (attempt === 1) {
        vi.setSystemTime(new Date("2026-09-02T00:00:59.999Z"));
        return {
          ok: false,
          error: { kind: "error", code: "unavailable", details: {} },
        };
      }
      return new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              ok: false,
              error: { kind: "error", code: "client_closed", details: {} },
            }),
          2,
        );
      });
    });
    openWith(executor);
    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });

    const pending = remote.createBudget({ workUnits: 10 }, { operationKey });
    const expected = expect(pending).rejects.toMatchObject({
      name: "KeynesError",
      code: "uncertain_outcome",
      details: { operation: "createBudget", operationKey },
    });
    await vi.advanceTimersByTimeAsync(2);
    await expected;
  });

  it("assembles three private history pages into one public inspection", async () => {
    const cursors = [
      `khc_v2_${"a".repeat(32)}_257`,
      `khc_v2_${"a".repeat(32)}_513`,
    ];
    let page = 0;
    const executor = fakeExecutor((method) => {
      if (method === "createBudget") return createdResponse();
      if (method === "getBudgetHistoryPage") {
        const entries =
          page < 2
            ? Array.from({ length: 256 }, (_, index) =>
                inspectionHistoryEntry(page * 256 + index + 1),
              )
            : [inspectionHistoryEntry(513)];
        return {
          ok: true,
          result: {
            budgetReference: rootReference,
            budget: inspectionBudget(),
            entries,
            nextCursor: cursors[page++] ?? null,
          },
        };
      }
      throw new Error(`unexpected operation ${method}`);
    });
    openWith(executor);
    const remote = await createKeynes({
      runtime: postgres({ databaseUrl }),
      resources,
    });
    const root = await remote.createBudget({ workUnits: 10 });

    const snapshot = await root.inspect();

    expect(snapshot.history.entries).toHaveLength(513);
    expect(snapshot.history.entries[0]).toMatchObject({
      kind: "budget_created",
      sequence: 1,
      resources: [{ resource: "workUnits", amount: 10 }],
    });
    expect(
      executor.inputs.filter(
        (_input, index) => executor.methods[index] === "getBudgetHistoryPage",
      ),
    ).toEqual([
      { budgetReference: rootReference },
      { budgetReference: rootReference, cursor: cursors[0] },
      { budgetReference: rootReference, cursor: cursors[1] },
    ]);
  });
});

function openWith(executor: RemoteCommandExecutor): void {
  remoteMocks.openPostgresqlCommandExecutor.mockResolvedValue(executor);
}

function fakeExecutor(
  respond: (
    method: RemoteProcedureDescriptor["method"],
    input: unknown,
  ) => unknown,
): RemoteCommandExecutor & {
  readonly methods: string[];
  readonly inputs: unknown[];
  readonly close: () => Promise<void>;
  assertOpen(): void;
} {
  const methods: string[] = [];
  const inputs: unknown[] = [];
  let closed = false;
  const assertOpen = () => {
    if (closed)
      throw new KeynesError({
        kind: "error",
        code: "client_closed",
        details: {},
      });
  };
  return {
    methods,
    inputs,
    assertOpen,
    close: vi.fn(async () => {
      closed = true;
    }),
    execute: vi.fn(async (procedure, input) => {
      assertOpen();
      if (procedure.method === "validateResources") {
        return { ok: true, result: { valid: true } };
      }
      methods.push(procedure.method);
      inputs.push(input);
      return respond(procedure.method, input);
    }),
  };
}

function createdResponse() {
  return {
    ok: true as const,
    result: {
      kind: "created" as const,
      budget: rootBudget("active", null, true),
      replayed: false,
    },
  };
}

function configuredCreatedResponse(replayed: boolean) {
  return {
    ok: true as const,
    result: {
      kind: "created" as const,
      budget: {
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
          {
            resource: {
              canonicalName: "zero_seats",
              unit: "seat",
              accountingBehavior: "reusable" as const,
            },
            allocated: 0,
            available: 0,
            committed: 0,
            directUsage: null,
            subtreeObservedUsage: 0,
            unresolved: true,
            deficit: 0,
          },
        ],
      },
      replayed,
    },
  };
}

function approvedResponse() {
  return {
    ok: true as const,
    result: {
      kind: "approved" as const,
      parentBudgetReference: rootReference,
      childBudgetReference: `kbr_v1_${"c".repeat(43)}`,
      resources: [{ resource: "work_units", amount: 3 }],
      replayed: false,
    },
  };
}

function settledResponse() {
  return {
    ok: true as const,
    result: {
      kind: "settled" as const,
      budget: rootBudget("settled", 2),
      newlyKnown: [{ resource: "work_units", amount: 2 }],
      unresolvedResources: [],
      replayed: false,
    },
  };
}

function rootBudget(
  lifecycle: "active" | "settled",
  directUsage: number | null,
  fresh = false,
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
          accountingBehavior: "consumable" as const,
        },
        allocated: 10,
        available: fresh ? 10 : 7,
        committed: fresh ? 0 : 3,
        directUsage,
        subtreeObservedUsage: fresh ? 0 : 2,
        unresolved: directUsage === null,
        deficit: 0,
      },
    ],
  };
}

function inspectionBudget() {
  const { budgetReference, depth, lifecycle, resources } = rootBudget(
    "active",
    null,
  );
  return {
    budgetReference,
    lineageId: 1,
    parentLineageId: null,
    depth,
    lifecycle,
    resources,
  };
}

function inspectionHistoryEntry(sequence: number) {
  return {
    kind: "budget_created" as const,
    sequence,
    subject: 1,
    cause: { kind: "command" as const },
    movements: [
      {
        reason: "initial_allocation" as const,
        resource: "work_units",
        amount: 10,
        from: null,
        to: 1,
      },
    ],
    resources: [{ resource: "work_units", amount: 10 }],
  };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected record");
  }
  return value as Record<string, unknown>;
}

function inputOperationKey(input: unknown): unknown {
  return record(input).operationKey;
}

function definedResponse() {
  return {
    ok: true,
    result: {
      kind: "defined",
      bindingReference: `krs_v1_${"d".repeat(43)}`,
      replayed: true,
      resources: [
        {
          key: "workUnits",
          resourceType: {
            resourceTypeId: "00000000-0000-4000-8000-000000000001",
            canonicalName: "work_units",
            unit: "unit",
            accountingBehavior: "consumable",
            definitionDigest: `sha256:${"d".repeat(64)}`,
          },
          definitionEvidence: {
            kind: "resource_type_defined",
            commandId: "00000000-0000-4000-8000-000000000101",
            principalId: "00000000-0000-4000-8000-000000000201",
            definitionDigest: `sha256:${"d".repeat(64)}`,
          },
        },
      ],
    },
  };
}
