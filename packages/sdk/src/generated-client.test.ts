import { describe, expect, it } from "vitest";

import {
  createKeynesClient,
  type InstalledTarget,
  type ProcedureCaller,
} from "./generated/client.js";
import type {
  CreateBudgetCommand,
  DefineResourceTypeCommand,
  RequestBudgetCommand,
  SettleBudgetCommand,
} from "./generated/types.js";
import { validateCreateBudgetCommandIssues } from "./generated/validators.js";

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
        resourceTypeId: "10000000-0000-0000-0000-000000000001",
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

const EXPECTED_TARGETS = [
  "keynes.define_resource_type",
  "keynes.create_budget",
  "keynes.request",
  "keynes.settle",
  "keynes.get_budget",
] satisfies readonly InstalledTarget[];

describe("generated client bindings", () => {
  it("binds every concrete method to its declared installed target", async () => {
    const calls: InstalledTarget[] = [];
    const stop = new Error("binding observed");
    const caller: ProcedureCaller = {
      async call(target) {
        calls.push(target);
        throw stop;
      },
    };
    const client = createKeynesClient(caller);

    await expect(client.defineResource(commands.defineResource)).rejects.toBe(
      stop,
    );
    await expect(client.createBudget(commands.createBudget)).rejects.toBe(stop);
    await expect(client.requestBudget(commands.requestBudget)).rejects.toBe(
      stop,
    );
    await expect(client.settleBudget(commands.settleBudget)).rejects.toBe(stop);
    await expect(client.getBudget(commands.getBudget)).rejects.toBe(stop);

    expect(calls).toEqual(EXPECTED_TARGETS);
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
});
