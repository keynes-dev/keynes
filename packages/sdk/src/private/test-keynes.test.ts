import { describe, expect, it } from "vitest";

import type { InstalledTarget, ProcedureCaller } from "../generated/client.js";
import { PairedProcedureCaller } from "./test-keynes.js";

const TARGET: InstalledTarget = "keynes.request";

function caller(call: () => Promise<unknown>): ProcedureCaller {
  return { call };
}

function paired(
  pglite: ProcedureCaller,
  postgresql: ProcedureCaller,
): ProcedureCaller {
  return new PairedProcedureCaller({
    caseName: () => "paired caller case",
    pglite,
    postgresql,
  });
}

describe("paired procedure caller", () => {
  it("returns deeply equal public JSON", async () => {
    const left = { ok: true, result: { values: [1, 2, 3] } };
    const right = { ok: true, result: { values: [1, 2, 3] } };

    await expect(
      paired(
        caller(async () => left),
        caller(async () => right),
      ).call(TARGET, {}),
    ).resolves.toBe(left);
  });

  it("rejects unequal public JSON with a sanitized case and target", async () => {
    await expect(
      paired(
        caller(async () => ({ ok: true, result: { amount: 1 } })),
        caller(async () => ({ ok: true, result: { amount: 2 } })),
      ).call(TARGET, {}),
    ).rejects.toThrow(
      "Paired call failed: case=paired caller case; target=keynes.request; host=both; reason=result-mismatch",
    );
  });

  it("waits for the slower host before reporting a one-sided failure", async () => {
    let resolvePostgresql: ((value: unknown) => void) | undefined;
    const postgresqlResult = new Promise<unknown>((resolveResult) => {
      resolvePostgresql = resolveResult;
    });
    const call = paired(
      caller(async () => {
        throw new Error("pglite failed");
      }),
      caller(() => postgresqlResult),
    ).call(TARGET, {});
    let settled = false;
    void call.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await Promise.resolve();
    expect(settled).toBe(false);
    resolvePostgresql?.({ ok: true });

    await expect(call).rejects.toThrow(
      "Paired call failed: case=paired caller case; target=keynes.request; host=pglite; reason=unexpected-failure",
    );
  });

  it("preserves matching rollback checkpoint controls", async () => {
    const checkpoint = "private rollback checkpoint: after_domain_mutation";

    await expect(
      paired(
        caller(async () => {
          throw new Error(checkpoint);
        }),
        caller(async () => {
          throw new Error(checkpoint);
        }),
      ).call(TARGET, {}),
    ).rejects.toThrow(checkpoint);
  });

  it("preserves matching simulated lost-response controls", async () => {
    const lostResponse =
      "Simulated lost response after committed procedure call";

    await expect(
      paired(
        caller(async () => {
          throw new Error(lostResponse);
        }),
        caller(async () => {
          throw new Error(lostResponse);
        }),
      ).call(TARGET, {}),
    ).rejects.toThrow(lostResponse);
  });

  it("does not retain credentials or driver diagnostics", async () => {
    const credential =
      "postgresql://postgres:private-password@127.0.0.1/postgres";
    const call = paired(
      caller(async () => ({ ok: true })),
      caller(async () => {
        throw new Error(`driver failed for ${credential}`);
      }),
    ).call(TARGET, {});

    let failure: unknown;
    try {
      await call;
    } catch (error: unknown) {
      failure = error;
    }

    expect(String(failure)).toBe(
      "Error: Paired call failed: case=paired caller case; target=keynes.request; host=postgresql; reason=unexpected-failure",
    );
    expect(String(failure)).not.toContain("private-password");
    expect(String(failure)).not.toContain("driver failed");
  });
});
