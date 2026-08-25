import { afterEach, describe, expect, it, vi } from "vitest";

import type { Keynes } from "./keynes.js";

type MutationTarget =
  | "keynes.define_resource_type"
  | "keynes.create_budget"
  | "keynes.request"
  | "keynes.settle";

afterEach(() => {
  vi.doUnmock("./private/local-runtime.js");
  vi.resetModules();
});

describe("local facade committed-response replay", () => {
  it.each([
    "keynes.define_resource_type",
    "keynes.create_budget",
    "keynes.request",
    "keynes.settle",
  ] as const)(
    "replays one lost %s response with the same command",
    async (target) => {
      const harness = await loadHarness(target, 1);
      const keynes = await harness.Keynes.create({ mode: "local" });
      try {
        await exerciseMutation(keynes, target);
        expect(harness.captured).toHaveLength(2);
        expect(harness.captured[1]).toBe(harness.captured[0]);
      } finally {
        await keynes.close();
      }
    },
  );

  it.each([
    "keynes.define_resource_type",
    "keynes.create_budget",
    "keynes.request",
    "keynes.settle",
  ] as const)(
    "maps a second lost %s response to operation_interrupted",
    async (target) => {
      const harness = await loadHarness(target, 2);
      const keynes = await harness.Keynes.create({ mode: "local" });
      try {
        let mutation: Promise<unknown>;
        let inspectCommittedEffect: (() => Promise<unknown>) | undefined;
        if (target === "keynes.define_resource_type") {
          mutation = defineWorkUnits(keynes);
        } else {
          await defineWorkUnits(keynes);
          if (target === "keynes.create_budget") {
            mutation = keynes.createBudget({ workUnits: 10 });
          } else {
            const root = await keynes.createBudget({ workUnits: 10 });
            if (target === "keynes.request") {
              mutation = root.request({ workUnits: 4 });
              inspectCommittedEffect = async () =>
                expect(
                  (await root.inspect()).history.entries.filter(
                    ({ kind }) => kind === "request_approved",
                  ),
                ).toHaveLength(1);
            } else {
              const request = await root.request({ workUnits: 4 });
              if (request.status !== "approved") {
                throw new Error("expected approved request");
              }
              mutation = request.budget.settle({ workUnits: 3 });
              inspectCommittedEffect = async () =>
                expect(
                  (await request.budget.inspect()).history.entries.filter(
                    ({ kind }) => kind === "budget_settlement_recorded",
                  ),
                ).toHaveLength(1);
            }
          }
        }

        await expect(mutation).rejects.toMatchObject({
          name: "KeynesSdkError",
          code: "operation_interrupted",
        });
        expect(harness.captured).toHaveLength(2);
        expect(harness.captured[1]).toBe(harness.captured[0]);
        await inspectCommittedEffect?.();
      } finally {
        await keynes.close();
      }
    },
  );

  it("does not retry a generated domain failure", async () => {
    const harness = await loadHarness("keynes.define_resource_type", 0);
    const keynes = await harness.Keynes.create({ mode: "local" });
    try {
      await defineWorkUnits(keynes);
      const before = harness.captured.length;
      await expect(
        keynes.defineResources({
          workUnits: { unit: "minute", accountingBehavior: "consumable" },
        }),
      ).rejects.toMatchObject({
        name: "ResourceDefinitionError",
        cause: { name: "KeynesError", code: "resource_type_conflict" },
      });
      expect(harness.captured).toHaveLength(before + 1);
    } finally {
      await keynes.close();
    }
  });

  it("creates a distinct command identity for each public call", async () => {
    const harness = await loadHarness("keynes.create_budget", 0);
    const keynes = await harness.Keynes.create({ mode: "local" });
    try {
      await defineWorkUnits(keynes);
      await keynes.createBudget({ workUnits: 10 });
      await keynes.createBudget({ workUnits: 10 });
      expect(harness.captured).toHaveLength(2);
      expect(commandId(harness.captured[0])).not.toBe(
        commandId(harness.captured[1]),
      );
    } finally {
      await keynes.close();
    }
  });
});

async function exerciseMutation(
  keynes: Keynes,
  target: MutationTarget,
): Promise<void> {
  if (target === "keynes.define_resource_type") {
    const definitions = await defineWorkUnits(keynes);
    expect(definitions).toHaveLength(1);
    return;
  }

  await defineWorkUnits(keynes);
  const root = await keynes.createBudget({ workUnits: 10 });
  if (target === "keynes.create_budget") {
    const inspection = await root.inspect();
    expect(
      inspection.history.entries.filter(
        ({ kind }) => kind === "budget_created",
      ),
    ).toHaveLength(1);
    return;
  }

  const request = await root.request({ workUnits: 4 });
  expect(request.status).toBe("approved");
  if (request.status !== "approved")
    throw new Error("expected approved request");
  if (target === "keynes.request") {
    const inspection = await root.inspect();
    expect(
      inspection.history.entries.filter(
        ({ kind }) => kind === "request_approved",
      ),
    ).toHaveLength(1);
    return;
  }

  await request.budget.settle({ workUnits: 3 });
  const inspection = await request.budget.inspect();
  expect(
    inspection.history.entries.filter(
      ({ kind }) => kind === "budget_settlement_recorded",
    ),
  ).toHaveLength(1);
}

function defineWorkUnits(keynes: Keynes) {
  return keynes.defineResources({
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  });
}

async function loadHarness(target: MutationTarget, losses: number) {
  vi.resetModules();
  const captured: unknown[] = [];
  vi.doMock("./private/local-runtime.js", async () => {
    const actual = await vi.importActual<
      typeof import("./private/local-runtime.js")
    >("./private/local-runtime.js");
    const fixtures = await vi.importActual<
      typeof import("./private/test-keynes.js")
    >("./private/test-keynes.js");
    const generated = await vi.importActual<
      typeof import("./generated/client.js")
    >("./generated/client.js");
    return {
      ...actual,
      async openLocalRuntime() {
        const host = await fixtures.openPGliteCallerHost();
        const normal = host.callerFor("product-fixture");
        const lossy = Array.from({ length: losses }, () =>
          host.callerFor("product-fixture", {
            dropResponseAfterCommitOnce: true,
          }),
        );
        return {
          client: generated.createKeynesClient({
            call(calledTarget, input) {
              if (calledTarget !== target)
                return normal.call(calledTarget, input);
              captured.push(input);
              return (lossy.shift() ?? normal).call(calledTarget, input);
            },
          }),
          close: () => host.close(),
        };
      },
    };
  });
  const { Keynes: FreshKeynes } = await import("./index.js");
  return { Keynes: FreshKeynes, captured };
}

function commandId(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !("commandId" in value)) {
    throw new Error("captured mutation has no command ID");
  }
  return value.commandId;
}
