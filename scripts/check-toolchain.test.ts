import { describe, expect, it } from "vitest";

import { validateToolchain } from "./check-toolchain.ts";

describe("validateToolchain", () => {
  it("accepts the exact repository toolchain", () => {
    expect(validateToolchain("v24.19.0", "11.21.0")).toEqual([]);
  });

  it("reports actionable Node and pnpm version failures", () => {
    expect(validateToolchain("v25.9.0", "10.14.0")).toEqual([
      "TOOL001_NODE_VERSION: expected Node.js 24.19.0, received 25.9.0",
      "TOOL002_PNPM_VERSION: expected pnpm 11.21.0, received 10.14.0",
    ]);
  });
});
