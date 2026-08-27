import { describe, expect, it } from "vitest";

import { parseInstallationConfig } from "../../src/installer/config.ts";

const CONFIG = {
  ownerRole: "keynes_owner",
  applicationRole: "keynes_app",
  tenantId: "00000000-0000-4000-8000-000000000001",
  principalId: "00000000-0000-4000-8000-000000000101",
} as const;

describe("PostgreSQL installation configuration", () => {
  it("accepts exactly the four declared keys", () => {
    expect(parseInstallationConfig(CONFIG)).toEqual(CONFIG);
  });

  it("rejects missing, additional, and overridden configuration fields", () => {
    expect(() =>
      parseInstallationConfig({
        ...CONFIG,
        principalId: undefined,
      }),
    ).toThrow();
    expect(() =>
      parseInstallationConfig({
        ...CONFIG,
        profileId: "embedded-postgresql-18.6-preview",
      }),
    ).toThrow();
  });

  it("requires canonical UUIDs and distinct prepared role names", () => {
    expect(() =>
      parseInstallationConfig({ ...CONFIG, tenantId: "tenant-a" }),
    ).toThrow();
    expect(() =>
      parseInstallationConfig({
        ...CONFIG,
        principalId: "00000000-0000-4000-8000-00000000010A",
      }),
    ).toThrow();
    expect(() =>
      parseInstallationConfig({
        ...CONFIG,
        ownerRole: CONFIG.applicationRole,
      }),
    ).toThrow();
    expect(() =>
      parseInstallationConfig({ ...CONFIG, ownerRole: "" }),
    ).toThrow();
  });

  it("does not expose invalid values in configuration errors", () => {
    const secret = "postgresql://keynes:super-secret@example.test/keynes";
    const invalidConfig = {
      ...CONFIG,
      ownerRole: secret,
    };

    expect(() => parseInstallationConfig(invalidConfig)).toThrowError(
      expect.not.objectContaining({ message: expect.stringContaining(secret) }),
    );
  });
});
