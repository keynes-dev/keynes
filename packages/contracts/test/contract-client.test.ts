import { describe, expect, it } from "vitest";

import fixtures from "../fixtures/source.json" with { type: "json" };
import { createContractClient } from "../contract-tests/host.ts";

describe("contract test client", () => {
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
});
