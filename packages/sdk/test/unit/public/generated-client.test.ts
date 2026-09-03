import { describe, expect, it } from "vitest";

import { createKeynesClient } from "../../../src/generated/client.js";
import type { CommandExecutor } from "../../../src/command-executor.js";
import type {
  CreateBudgetCommand,
  DefineResourceTypeCommand,
  OperationName,
  RequestBudgetCommand,
  SettleBudgetCommand,
} from "../../../src/generated/types.js";
import { validateCreateBudgetCommandIssues } from "../../../src/generated/validators.js";

const commands = {
  defineResource: {
    commandId: "10000000-0000-0000-0000-000000000001",
    definition: {
      canonicalName: "model_tokens",
      unit: "token",
      accountingBehavior: "consumable",
    },
  } satisfies DefineResourceTypeCommand,
  createBudget: {
    commandId: "20000000-0000-0000-0000-000000000001",
    resources: [
      {
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
        amount: 100,
      },
    ],
  } satisfies CreateBudgetCommand,
  requestBudget: {
    commandId: "30000000-0000-0000-0000-000000000001",
    parentBudgetId: "20000000-0000-0000-0000-000000000001",
    resources: [
      {
        resourceTypeId: "10000000-0000-0000-0000-000000000001",
        amount: 40,
      },
    ],
  } satisfies RequestBudgetCommand,
  settleBudget: {
    commandId: "40000000-0000-0000-0000-000000000001",
    budgetId: "30000000-0000-0000-0000-000000000001",
    usage: [
      {
        resourceTypeId: "10000000-0000-0000-0000-000000000001",
        amount: 25,
      },
    ],
  } satisfies SettleBudgetCommand,
  getBudget: {
    budgetId: "30000000-0000-0000-0000-000000000001",
  },
};

const EXPECTED_OPERATIONS = [
  "defineResource",
  "createBudget",
  "requestBudget",
  "settleBudget",
  "getBudget",
] satisfies readonly OperationName[];

describe("generated client bindings", () => {
  it("binds every concrete method to its deployment-neutral operation", async () => {
    const calls: OperationName[] = [];
    const stop = new Error("binding observed");
    const executor: CommandExecutor = {
      async execute(operation) {
        calls.push(operation);
        throw stop;
      },
    };
    const client = createKeynesClient(executor);

    await expect(client.defineResource(commands.defineResource)).rejects.toBe(
      stop,
    );
    await expect(client.createBudget(commands.createBudget)).rejects.toBe(stop);
    await expect(client.requestBudget(commands.requestBudget)).rejects.toBe(
      stop,
    );
    await expect(client.settleBudget(commands.settleBudget)).rejects.toBe(stop);
    await expect(client.getBudget(commands.getBudget)).rejects.toBe(stop);

    expect(calls).toEqual(EXPECTED_OPERATIONS);
  });

  it("validates input before dispatch", async () => {
    let calls = 0;
    const executor: CommandExecutor = {
      async execute() {
        calls += 1;
        throw new Error("invalid input reached the executor");
      },
    };
    const client = createKeynesClient(executor);

    await expect(
      Reflect.apply(client.createBudget, client, [
        { commandId: "not-a-uuid", resources: [] },
      ]),
    ).rejects.toMatchObject({
      code: "invalid_command",
      details: { operation: "createBudget" },
    });
    expect(calls).toBe(0);
  });

  it.each([
    undefined,
    null,
    {},
    { ok: "yes" },
    { ok: true },
    { ok: false, error: null },
  ])("rejects an invalid wire envelope before returning it", async (wire) => {
    const executor: CommandExecutor = {
      async execute() {
        return wire;
      },
    };
    const client = createKeynesClient(executor);

    await expect(
      client.defineResource(commands.defineResource),
    ).rejects.toThrow(/invalid .*response for defineResource/);
  });

  it("detaches validated output from the executor wire value", async () => {
    const digest = `sha256:${"a".repeat(64)}`;
    const wireResult = {
      kind: "defined",
      resourceType: {
        resourceTypeId: "10000000-0000-0000-0000-000000000001",
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
        definitionDigest: digest,
      },
      definitionEvidence: {
        kind: "resource_type_defined",
        commandId: "10000000-0000-0000-0000-000000000001",
        principalId: "00000000-0000-0000-0000-000000000011",
        definitionDigest: digest,
      },
    };
    const executor: CommandExecutor = {
      async execute() {
        return { ok: true, result: wireResult, replayed: false };
      },
    };
    const result = await createKeynesClient(executor).defineResource(
      commands.defineResource,
    );

    wireResult.resourceType.unit = "mutated";
    expect(result.resourceType.unit).toBe("token");
  });

  it("sorts validation issues independently of property insertion order", () => {
    const common = {
      commandId: "NOT-A-UUID",
      resources: [],
    };
    const first = { zeta: true, ...common, alpha: true };
    const second = { alpha: true, ...common, zeta: true };
    const expected = [
      { path: "/alpha", rule: "additionalProperties" },
      { path: "/commandId", rule: "pattern" },
      { path: "/resources", rule: "minItems" },
      { path: "/zeta", rule: "additionalProperties" },
    ];

    expect(validateCreateBudgetCommandIssues(first)).toEqual(expected);
    expect(validateCreateBudgetCommandIssues(second)).toEqual(expected);
  });

  it("rejects structurally duplicate resource entries regardless of property order", () => {
    const definition = {
      canonicalName: "model_tokens",
      unit: "token",
      accountingBehavior: "consumable",
    };

    expect(
      validateCreateBudgetCommandIssues({
        commandId: "20000000-0000-0000-0000-000000000001",
        resources: [
          { definition, amount: 1 },
          { amount: 1, definition },
        ],
      }),
    ).toEqual([{ path: "/resources", rule: "uniqueItems" }]);
  });
});
