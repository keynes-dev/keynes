import { describe, expect, it } from "vitest";

import { parseExternalProfile } from "./external-profile.js";

const validProfile = {
  schemaVersion: "keynes.external-postgresql-profile/v1",
  authorizationReference: "user-approved-2026-09-03",
  provider: "provider",
  serverProfile: "postgresql-18.6",
  hostClass: "public-dns",
  topology: "direct",
  downstreamTlsOwner: "provider",
  expectedLeafCertificateSha256: "a".repeat(64),
};

describe("external PostgreSQL provider profile", () => {
  it("accepts only the closed non-secret profile", () => {
    expect(parseExternalProfile(validProfile)).toEqual(validProfile);
  });

  it.each([
    { provider: "postgresql://secret" },
    { serverProfile: "postgresql-17.6" },
    { topology: "unknown" },
    { extra: "field" },
  ])("rejects an invalid profile", (change) => {
    expect(() =>
      parseExternalProfile({
        ...validProfile,
        ...change,
      }),
    ).toThrow("external profile");
  });
});
