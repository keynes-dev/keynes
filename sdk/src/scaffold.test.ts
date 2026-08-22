import { describe, expect, it } from "vitest";

import { scaffold } from "./scaffold.ts";

describe("SDK scaffold", () => {
  it("states that no SDK runtime behavior exists", () => {
    expect(scaffold).toEqual({
      status: "nonfunctional",
      responsibility: "future TypeScript SDK",
    });
  });
});
