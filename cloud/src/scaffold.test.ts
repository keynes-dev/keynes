import { describe, expect, it } from "vitest";

import { scaffold } from "./scaffold.ts";

describe("Cloud scaffold", () => {
  it("states that no Cloud runtime behavior exists", () => {
    expect(scaffold).toEqual({
      status: "nonfunctional",
      responsibility: "future managed Cloud service",
    });
  });
});
