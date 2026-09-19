import { describe, expect, it } from "vitest";

import {
  parseExternalProfile,
  type ExternalPostgresqlProfile,
} from "./external-profile.js";
import {
  EXTERNAL_TARGET_ENVIRONMENT_KEYS,
  openExternalQualificationTarget,
  parseExternalTargetEnvironment,
} from "./external-target.js";

const profile: ExternalPostgresqlProfile = {
  schemaVersion: "keynes.external-postgresql-profile/v1",
  authorizationReference: "user-approved-2026-09-03",
  provider: "provider",
  serverProfile: "postgresql-18.3",
  hostClass: "public-dns",
  topology: "direct",
  downstreamTlsOwner: "provider",
  expectedLeafCertificateSha256: "a".repeat(64),
};

describe("attach-only external PostgreSQL target", () => {
  it("accepts only the PostgreSQL 18.3 profile", () => {
    expect(parseExternalProfile(profile)).toEqual(profile);
    expect(() =>
      parseExternalProfile({ ...profile, serverProfile: "postgresql-18.6" }),
    ).toThrow("invalid external profile");
  });

  it("parses the seven strict-TLS credentials without connecting", () => {
    const environment = validEnvironment();
    const parsed = parseExternalTargetEnvironment(environment);

    expect(parsed.primary.username).toBe("primary");
    expect(parsed.replacement.username).toBe("replacement");
    expect(parsed.hostnameMismatch.hostname).toBe("127.0.0.1");
    expect(parsed.primary.searchParams.get("sslmode")).toBe("verify-full");
    const target = openExternalQualificationTarget({ profile, environment });
    expect(target.close).toEqual(expect.any(Function));
  });

  it.each(EXTERNAL_TARGET_ENVIRONMENT_KEYS)(
    "rejects a missing %s credential without disclosing its name",
    (missing) => {
      const environment = validEnvironment();
      delete environment[missing];

      expect(() => parseExternalTargetEnvironment(environment)).toThrow(
        /^invalid external target environment$/u,
      );
    },
  );

  it.each([
    "postgresql://primary:secret@db.example.test/keynes",
    "postgresql://primary:secret@db.example.test/keynes?sslmode=require",
    "postgresql://primary:secret@db.example.test/keynes?sslmode=verify-full&sslmode=verify-full",
    "https://primary:secret@db.example.test/keynes?sslmode=verify-full",
    "postgresql://primary@db.example.test/keynes?sslmode=verify-full",
  ])("rejects an unsafe credential without echoing it", (primary) => {
    const environment = validEnvironment();
    environment.KEYNES_EXTERNAL_PRIMARY_URL = primary;

    expect(() => parseExternalTargetEnvironment(environment)).toThrow(
      /^invalid external target environment$/u,
    );
  });

  it("requires all credentials to address one database", () => {
    const environment = validEnvironment();
    environment.KEYNES_EXTERNAL_SECONDARY_URL = strictUrl(
      "secondary",
      "other-database",
    );

    expect(() => parseExternalTargetEnvironment(environment)).toThrow(
      "invalid external target environment",
    );
  });

  it("keeps the operator and every configured Keynes role distinct", () => {
    const environment = validEnvironment();
    environment.KEYNES_EXTERNAL_OPERATOR_URL = strictUrl("primary");

    expect(() => parseExternalTargetEnvironment(environment)).toThrow(
      "invalid external target environment",
    );
  });

  it("requires runtime credentials and the wrong-CA probe to share one endpoint", () => {
    const environment = validEnvironment();
    environment.KEYNES_EXTERNAL_SECONDARY_URL =
      "postgresql://secondary:secret@other.example.test/keynes?sslmode=verify-full";

    expect(() => parseExternalTargetEnvironment(environment)).toThrow(
      "invalid external target environment",
    );
  });

  it.each([
    "KEYNES_EXTERNAL_OPERATOR_URL",
    "KEYNES_EXTERNAL_ADMIN_URL",
  ] as const)("requires %s to share the direct endpoint", (name) => {
    const environment = validEnvironment();
    environment[name] =
      "postgresql://other:secret@other.example.test/keynes?sslmode=verify-full";

    expect(() => parseExternalTargetEnvironment(environment)).toThrow(
      "invalid external target environment",
    );
  });

  it("requires a distinct hostname-mismatch route", () => {
    const environment = validEnvironment();
    environment.KEYNES_EXTERNAL_HOSTNAME_MISMATCH_URL = strictUrl("mismatch");

    expect(() => parseExternalTargetEnvironment(environment)).toThrow(
      "invalid external target environment",
    );
  });

  it.each([strictUrl("untrusted"), `${strictUrl("untrusted")}&sslrootcert=`])(
    "requires an explicit wrong-CA prerequisite",
    (untrustedCa) => {
      const environment = validEnvironment();
      environment.KEYNES_EXTERNAL_UNTRUSTED_CA_URL = untrustedCa;

      expect(() => parseExternalTargetEnvironment(environment)).toThrow(
        "invalid external target environment",
      );
    },
  );
});

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    KEYNES_EXTERNAL_OPERATOR_URL: strictUrl("operator"),
    KEYNES_EXTERNAL_ADMIN_URL: strictUrl("administrator"),
    KEYNES_EXTERNAL_PRIMARY_URL: strictUrl("primary"),
    KEYNES_EXTERNAL_REPLACEMENT_URL: strictUrl("replacement"),
    KEYNES_EXTERNAL_SECONDARY_URL: strictUrl("secondary"),
    KEYNES_EXTERNAL_UNTRUSTED_CA_URL: `${strictUrl("untrusted")}&sslrootcert=%2Fwrong-ca.pem`,
    KEYNES_EXTERNAL_HOSTNAME_MISMATCH_URL:
      "postgresql://mismatch:secret@127.0.0.1/keynes?sslmode=verify-full",
  };
}

function strictUrl(role: string, database = "keynes"): string {
  return `postgresql://${role}:secret@db.example.test/${database}?sslmode=verify-full`;
}
