/// <reference types="node" />

import { describe, expect, it } from "vitest";

import { runFeatureRetentionPilot } from "./feature-retention-pilot.ts";

describe("branch-only feature retention", () => {
  it("retains evidence through a merge commit and rejects incompatible history", () => {
    expect(runFeatureRetentionPilot().schemaVersion).toBe(
      "keynes.feature-retention-pilot/v1",
    );
  });
});
