import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  REQUIRED_EXTERNAL_SCENARIOS,
  validateExternalRecord,
  writeExternalRecord,
  type ExternalPostgresqlAcceptanceRecord,
} from "./external-record.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("external PostgreSQL acceptance record", () => {
  it("requires the closed external scenario inventory", () => {
    const record = passingRecord();
    expect(() => validateExternalRecord(record)).not.toThrow();
    expect(() =>
      validateExternalRecord({
        ...record,
        scenarios: record.scenarios.slice(1),
      }),
    ).toThrow("scenario inventory");
  });

  it("rejects secret-bearing retained content", () => {
    expect(() =>
      validateExternalRecord({
        ...passingRecord(),
        authorizationReference: "postgresql://user:secret@example.test/db",
      }),
    ).toThrow("prohibited");
  });

  it("rejects undeclared retained fields", () => {
    const record = passingRecord();
    expect(() =>
      validateExternalRecord({
        ...record,
        target: { ...record.target, endpoint: "db.example.test" },
      }),
    ).toThrow("invalid external acceptance record");
  });

  it.each([
    { durationMilliseconds: Number.NaN },
    { durationMilliseconds: 1.5 },
    { outcome: "failed" },
    {
      tls: {
        ...passingRecord().tls,
        keyBits: 0,
      },
    },
    {
      tls: {
        ...passingRecord().tls,
        validTo: "not-a-date",
      },
    },
    {
      cleanup: {
        connectionsAndLocalFiles: "failed",
        providerDatabaseDisposal: "operator-owned-required",
      },
    },
  ])("rejects malformed passing evidence", (change) => {
    expect(() =>
      validateExternalRecord({
        ...passingRecord(),
        ...change,
      } as ExternalPostgresqlAcceptanceRecord),
    ).toThrow("invalid external acceptance record");
  });

  it("writes one immutable mode-0600 record", async () => {
    const root = await mkdtemp(join(tmpdir(), "keynes-external-record-"));
    temporaryDirectories.push(root);
    const outputPath = join(root, "records", "external.json");
    const record = passingRecord();

    await writeExternalRecord(outputPath, record);

    await expect(writeExternalRecord(outputPath, record)).rejects.toThrow();
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual(record);
    expect((await stat(outputPath)).mode & 0o777).toBe(0o600);
  });
});

function passingRecord(): ExternalPostgresqlAcceptanceRecord {
  return {
    schemaVersion: "keynes.acceptance.external-postgresql/v1",
    authorizationReference: "user-approved-2026-09-03",
    sourceRevision: {
      commit: "c".repeat(40),
      cleanBefore: true,
      cleanAfter: true,
    },
    archives: {
      sdkSha256: "a".repeat(64),
      postgresqlSha256: "b".repeat(64),
    },
    target: {
      provider: "provider",
      serverProfile: "postgresql-18.6",
      serverVersionNum: "180006",
      hostClass: "public-dns",
      topology: "direct",
      downstreamTlsOwner: "provider",
    },
    tls: {
      protocol: "TLSv1.3",
      cipher: "TLS_AES_256_GCM_SHA384",
      keyBits: 256,
      leafCertificateSha256: "d".repeat(64),
      issuerCertificateSha256: "e".repeat(64),
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: "2027-01-01T00:00:00.000Z",
      hostnameVerification: "passed",
    },
    semantics: {
      installationIdentitySha256: "f".repeat(64),
      contractDigest: "1".repeat(64),
      policyProfileDigest: "3".repeat(64),
      remoteProcedureIdentitySha256: "2".repeat(64),
      migrationSetDigest: "4".repeat(64),
      remoteProcedureCount: 8,
    },
    scenarios: REQUIRED_EXTERNAL_SCENARIOS.map((id) => ({
      id,
      outcome: "passed" as const,
    })),
    cleanup: {
      connectionsAndLocalFiles: "passed",
      providerDatabaseDisposal: "operator-owned-required",
    },
    durationMilliseconds: 1_000,
    outcome: "passed",
    exclusions: {
      poolerDownstreamTls: "NOT RUN",
      expiredCertificate: "NOT RUN",
      productionReadiness: "NOT RUN",
    },
  };
}
