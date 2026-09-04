import { describe, expect, it } from "vitest";

import fixtures from "../fixtures/source.json" with { type: "json" };
import { createContractClient } from "../conformance/host.ts";

describe("contract conformance client", () => {
  it("rejects a schema-invalid operation result", async () => {
    const client = createContractClient({
      execute: async () => ({
        ok: true,
        replayed: false,
        result: { kind: "budget" },
      }),
    });

    await expect(
      client.inspectBudget(fixtures.commands.inspectChild),
    ).rejects.toThrow(/invalid result response for inspectBudget/i);
  });

  it("rejects a schema-invalid error envelope", async () => {
    const client = createContractClient({
      execute: async () => ({
        ok: false,
        error: { kind: "error", code: "invented", details: {} },
      }),
    });

    await expect(
      client.inspectBudget(fixtures.commands.inspectChild),
    ).rejects.toThrow(/invalid error response for inspectBudget/i);
  });
});
