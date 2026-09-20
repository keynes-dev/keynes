import { describe, expect, it } from "vitest";

import fixtures from "../fixtures/source.json" with { type: "json" };
import { createContractClient } from "../contract-tests/host.ts";
import type { ValidateResourcesQuery } from "../generated/types.ts";

describe("contract test client", () => {
  it("returns read-only validation confirmation without mutation replay metadata", async () => {
    const calls: { operation: string; input: unknown }[] = [];
    const client = createContractClient({
      execute: async (operation, input) => {
        calls.push({ operation, input });
        return { ok: true, replayed: false, result: { valid: true } };
      },
    });
    const query = {
      definitions: { seats: { unit: "seat", accountingBehavior: "reusable" } },
    } satisfies ValidateResourcesQuery;
    await expect(client.validateResources(query)).resolves.toEqual({
      valid: true,
    });
    expect(calls).toEqual([{ operation: "validateResources", input: query }]);
  });

  it("rejects an invalid catalog validation confirmation", async () => {
    const client = createContractClient({
      execute: async () => ({
        ok: true,
        replayed: false,
        result: { valid: false },
      }),
    });
    await expect(
      client.validateResources({
        definitions: {
          seats: { unit: "seat", accountingBehavior: "reusable" },
        },
      }),
    ).rejects.toThrow(/invalid result response for validateResources/i);
  });

  it("rejects a schema-invalid operation result", async () => {
    const client = createContractClient({
      execute: async () => ({
        ok: true,
        replayed: false,
        result: { kind: "budget" },
      }),
    });

    await expect(client.getBudget(fixtures.commands.getChild)).rejects.toThrow(
      /invalid result response for getBudget/i,
    );
  });

  it("rejects a schema-invalid error envelope", async () => {
    const client = createContractClient({
      execute: async () => ({
        ok: false,
        error: { kind: "error", code: "invented", details: {} },
      }),
    });

    await expect(client.getBudget(fixtures.commands.getChild)).rejects.toThrow(
      /invalid error response for getBudget/i,
    );
  });

  it.each([
    {
      name: "Policy ceiling result",
      wire: {
        ok: true,
        replayed: false,
        result: {
          kind: "denied",
          commandId: fixtures.commands.requestChild.commandId,
          parentBudgetId: fixtures.commands.requestChild.parentBudgetId,
          reasons: [
            {
              code: "policy_ceiling",
              resourceTypeId:
                fixtures.commands.requestChild.resources[0].resourceTypeId,
              requested: 40,
              ceiling: 40,
              policyName: "request_limit",
              policyRevision: 1,
              reason: "customer_tier_limit",
            },
          ],
          replayed: false,
        },
      },
      error: /invalid result response for requestBudget/i,
      invoke: (client: ReturnType<typeof createContractClient>) =>
        client.requestBudget(fixtures.commands.requestChild),
    },
    {
      name: "Policy error envelope",
      wire: {
        ok: false,
        error: {
          kind: "error",
          code: "invalid_policy_context",
          details: {
            operation: "requestBudget",
            path: "/context/customer_tier",
            rule: "required",
          },
        },
      },
      error: /invalid error response for requestBudget/i,
      invoke: (client: ReturnType<typeof createContractClient>) =>
        client.requestBudget(fixtures.commands.requestChild),
    },
  ])("rejects a removed $name", async ({ wire, error, invoke }) => {
    const client = createContractClient({ execute: async () => wire });

    await expect(invoke(client)).rejects.toThrow(error);
  });
});
