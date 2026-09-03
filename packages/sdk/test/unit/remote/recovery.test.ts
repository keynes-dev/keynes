import type { PoolConfig } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  RemoteCommandExecutor,
  RemoteProcedureDescriptor,
} from "../../../src/generated/client.js";
import {
  createKeynes,
  createOperationKey,
  defineResources,
} from "../../../src/index.js";
import type { BudgetReference, OperationKey } from "../../../src/index.js";

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
const rootReference = `kbr_v1_${"r".repeat(43)}` as BudgetReference;
const operationKey = `kop_v1_${"o".repeat(43)}` as OperationKey;
const resources = defineResources({
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
});

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
  it("uses caller-created keys unchanged for every remote mutation", async () => {
    const executor = fakeExecutor((method) => {
      if (method === "createBudget") return createdResponse();
      if (method === "requestBudget") return approvedResponse();
      if (method === "settleBudget") return settledResponse();
      throw new Error(`unexpected operation ${method}`);
    });
    openWith(executor);
    const key = createOperationKey();

    const remote = await createKeynes({ databaseUrl });
    const root = await remote.createBudget(
      resources,
      { workUnits: 10 },
      { operationKey: key },
    );
    await root.request({ workUnits: 3 }, { operationKey: key });
    await root.settle({ workUnits: 2 }, { operationKey: key });

    expect(executor.inputs.map(inputOperationKey)).toEqual([key, key, key]);
    expect(key).toMatch(/^kop_v1_[A-Za-z0-9_-]{43}$/u);
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

    const remote = await createKeynes({ databaseUrl });
    const reopened = await remote.openBudget({
      reference: rootReference,
      resourceTypes: resources,
    });

    expect(reopened.reference).toBe(rootReference);
    await expect(
      remote.openBudget({
        reference: rootReference,
        resourceTypes: defineResources({
          workUnits: { unit: "credit", accountingBehavior: "consumable" },
        }),
      }),
    ).rejects.toMatchObject({
      name: "KeynesError",
      code: "resource_binding_mismatch",
    });
  });

  it("projects all four read-only recovery states without changing the key", async () => {
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

    const remote = await createKeynes({ databaseUrl });
    const recovered = [];
    for (let call = 0; call < results.length; call += 1) {
      recovered.push(await remote.recoverOperation(operationKey));
    }

    expect(recovered.map(({ kind }) => kind)).toEqual([
      "committed",
      "known_failure",
      "unresolved",
      "expired",
    ]);
    expect(
      recovered.every((result) => result.operationKey === operationKey),
    ).toBe(true);
    expect(executor.inputs).toEqual(
      Array.from({ length: 4 }, () => ({ operationKey })),
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
    const remote = await createKeynes({ databaseUrl });

    await expect(
      remote.createBudget(resources, { workUnits: 10 }, { operationKey }),
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
    const remote = await createKeynes({ databaseUrl });

    await expect(
      remote.createBudget(resources, { workUnits: 10 }, { operationKey }),
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
    const remote = await createKeynes({ databaseUrl });

    await expect(
      remote.createBudget(resources, { workUnits: 10 }, { operationKey }),
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
    const remote = await createKeynes({ databaseUrl });

    const pending = remote.createBudget(
      resources,
      { workUnits: 10 },
      { operationKey },
    );
    const expected = expect(pending).rejects.toMatchObject({
      name: "KeynesError",
      code: "uncertain_outcome",
      details: { operation: "createBudget", operationKey },
    });
    await vi.advanceTimersByTimeAsync(2);
    await expected;
  });

  it("assembles three private history pages into one public inspection", async () => {
    const cursors = [`khc_v1_${"a".repeat(43)}`, `khc_v1_${"b".repeat(43)}`];
    let page = 0;
    const executor = fakeExecutor((method) => {
      if (method === "createBudget") return createdResponse();
      if (method === "getBudget") {
        return { ok: true, result: { budget: rootBudget("active", null) } };
      }
      if (method === "getBudgetHistoryPage") {
        const entries =
          page === 0
            ? [
                {
                  kind: "budget_created",
                  sequence: 1,
                  resources: [{ resource: "work_units", amount: 10 }],
                },
              ]
            : [];
        return {
          ok: true,
          result: {
            budgetReference: rootReference,
            entries,
            nextCursor: cursors[page++] ?? null,
          },
        };
      }
      throw new Error(`unexpected operation ${method}`);
    });
    openWith(executor);
    const remote = await createKeynes({ databaseUrl });
    const root = await remote.createBudget(resources, { workUnits: 10 });

    const snapshot = await root.inspect();

    expect(snapshot.history.entries).toEqual([
      {
        kind: "budget_created",
        sequence: 1,
        resources: [{ resource: "workUnits", amount: 10 }],
      },
    ]);
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
} {
  const methods: string[] = [];
  const inputs: unknown[] = [];
  return {
    methods,
    inputs,
    close: vi.fn(async () => undefined),
    execute: vi.fn(async (procedure, input) => {
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

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected record");
  }
  return value as Record<string, unknown>;
}

function inputOperationKey(input: unknown): unknown {
  return record(input).operationKey;
}
