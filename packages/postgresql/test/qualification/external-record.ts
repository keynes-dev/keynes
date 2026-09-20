import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";

export const REQUIRED_EXTERNAL_SCENARIOS = [
  "sdk-package-budget-reopen",
  "postgresql-semantic-compatibility",
  "postgresql-budget-lifecycle-recovery",
  "postgresql-two-tenant-isolation",
  "postgresql-credential-disable-enable",
  "postgresql-credential-rotation",
  "postgresql-credential-revocation",
  "postgresql-private-authority-denial",
  "postgresql-tls-positive",
  "postgresql-tls-unsafe-mode-rejection",
  "postgresql-tls-untrusted-chain-rejection",
  "postgresql-tls-hostname-mismatch-rejection",
  "postgresql-credential-secret-safe-tls-failures",
] as const;

export type ExternalScenarioId = (typeof REQUIRED_EXTERNAL_SCENARIOS)[number];

export interface ExternalPostgresqlAcceptanceRecord {
  readonly schemaVersion: "keynes.acceptance.external-postgresql/v1";
  readonly authorizationReference: string;
  readonly sourceRevision: {
    readonly commit: string;
    readonly cleanBefore: true;
    readonly cleanAfter: true;
  };
  readonly archives: {
    readonly sdkSha256: string;
    readonly postgresqlSha256: string;
  };
  readonly target: {
    readonly provider: string;
    readonly serverProfile: "postgresql-18.6";
    readonly serverVersionNum: "180006";
    readonly hostClass: string;
    readonly topology: "direct";
    readonly downstreamTlsOwner: string;
  };
  readonly tls: {
    readonly protocol: string;
    readonly cipher: string;
    readonly keyBits: number;
    readonly leafCertificateSha256: string;
    readonly issuerCertificateSha256: string;
    readonly validFrom: string;
    readonly validTo: string;
    readonly hostnameVerification: "passed";
  };
  readonly semantics: {
    readonly installationIdentitySha256: string;
    readonly contractDigest: string;
    readonly remoteProcedureIdentitySha256: string;
    readonly migrationSetDigest: string;
    readonly remoteProcedureCount: 10;
  };
  readonly scenarios: readonly {
    readonly id: ExternalScenarioId;
    readonly outcome: "passed";
  }[];
  readonly cleanup: {
    readonly connectionsAndLocalFiles: "passed";
    readonly providerDatabaseDisposal: "operator-owned-required";
  };
  readonly durationMilliseconds: number;
  readonly outcome: "passed";
  readonly exclusions: {
    readonly poolerDownstreamTls: "NOT RUN";
    readonly expiredCertificate: "NOT RUN";
    readonly productionReadiness: "NOT RUN";
  };
}

const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_LABEL = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const TLS_CIPHER = /^[A-Z0-9_-]+$/u;
const PROHIBITED =
  /postgres(?:ql)?:\/\/|password|PGPASSWORD|KEYNES_EXTERNAL_|-----BEGIN/iu;
const RECORD_KEYS = [
  "schemaVersion",
  "authorizationReference",
  "sourceRevision",
  "archives",
  "target",
  "tls",
  "semantics",
  "scenarios",
  "cleanup",
  "durationMilliseconds",
  "outcome",
  "exclusions",
] as const;
const NESTED_KEYS = {
  sourceRevision: ["commit", "cleanBefore", "cleanAfter"],
  archives: ["sdkSha256", "postgresqlSha256"],
  target: [
    "provider",
    "serverProfile",
    "serverVersionNum",
    "hostClass",
    "topology",
    "downstreamTlsOwner",
  ],
  tls: [
    "protocol",
    "cipher",
    "keyBits",
    "leafCertificateSha256",
    "issuerCertificateSha256",
    "validFrom",
    "validTo",
    "hostnameVerification",
  ],
  semantics: [
    "installationIdentitySha256",
    "contractDigest",
    "remoteProcedureIdentitySha256",
    "migrationSetDigest",
    "remoteProcedureCount",
  ],
  scenario: ["id", "outcome"],
  cleanup: ["connectionsAndLocalFiles", "providerDatabaseDisposal"],
  exclusions: [
    "poolerDownstreamTls",
    "expiredCertificate",
    "productionReadiness",
  ],
} as const;

export function validateExternalRecord(
  record: unknown,
): asserts record is ExternalPostgresqlAcceptanceRecord {
  if (!hasExactRecordShape(record)) {
    throw new Error("invalid external acceptance record");
  }
  if (PROHIBITED.test(JSON.stringify(record))) {
    throw new Error("external acceptance record contains prohibited content");
  }
  const scenarioIds = record.scenarios.map(({ id }) => id);
  if (
    scenarioIds.length !== REQUIRED_EXTERNAL_SCENARIOS.length ||
    REQUIRED_EXTERNAL_SCENARIOS.some((id, index) => scenarioIds[index] !== id)
  ) {
    throw new Error("invalid external scenario inventory");
  }
  if (
    record.schemaVersion !== "keynes.acceptance.external-postgresql/v1" ||
    record.sourceRevision.cleanBefore !== true ||
    record.sourceRevision.cleanAfter !== true ||
    !/^[a-f0-9]{40}$/u.test(record.sourceRevision.commit) ||
    !SAFE_LABEL.test(record.authorizationReference) ||
    !SHA256.test(record.archives.sdkSha256) ||
    !SHA256.test(record.archives.postgresqlSha256) ||
    !SAFE_LABEL.test(record.target.provider) ||
    !SAFE_LABEL.test(record.target.hostClass) ||
    !SAFE_LABEL.test(record.target.downstreamTlsOwner) ||
    !SHA256.test(record.tls.leafCertificateSha256) ||
    !SHA256.test(record.tls.issuerCertificateSha256) ||
    !/^TLSv1\.[23]$/u.test(record.tls.protocol) ||
    !TLS_CIPHER.test(record.tls.cipher) ||
    !isIsoDate(record.tls.validFrom) ||
    !isIsoDate(record.tls.validTo) ||
    Date.parse(record.tls.validTo) <= Date.parse(record.tls.validFrom) ||
    !SHA256.test(record.semantics.installationIdentitySha256) ||
    !SHA256.test(record.semantics.contractDigest) ||
    !SHA256.test(record.semantics.remoteProcedureIdentitySha256) ||
    !SHA256.test(record.semantics.migrationSetDigest) ||
    record.semantics.remoteProcedureCount !== 10 ||
    record.target.serverProfile !== "postgresql-18.6" ||
    record.target.serverVersionNum !== "180006" ||
    record.target.topology !== "direct" ||
    record.tls.hostnameVerification !== "passed" ||
    !Number.isInteger(record.tls.keyBits) ||
    record.tls.keyBits <= 0 ||
    !Number.isInteger(record.durationMilliseconds) ||
    record.durationMilliseconds < 0 ||
    record.cleanup.connectionsAndLocalFiles !== "passed" ||
    record.cleanup.providerDatabaseDisposal !== "operator-owned-required" ||
    record.outcome !== "passed" ||
    Object.values(record.exclusions).some((value) => value !== "NOT RUN") ||
    record.scenarios.some(({ outcome }) => outcome !== "passed")
  ) {
    throw new Error("invalid external acceptance record");
  }
}

function hasExactRecordShape(
  value: unknown,
): value is ExternalPostgresqlAcceptanceRecord {
  return (
    isRecord(value) &&
    hasExactKeys(value, RECORD_KEYS) &&
    isRecord(value.sourceRevision) &&
    hasExactKeys(value.sourceRevision, NESTED_KEYS.sourceRevision) &&
    isRecord(value.archives) &&
    hasExactKeys(value.archives, NESTED_KEYS.archives) &&
    isRecord(value.target) &&
    hasExactKeys(value.target, NESTED_KEYS.target) &&
    isRecord(value.tls) &&
    hasExactKeys(value.tls, NESTED_KEYS.tls) &&
    isRecord(value.semantics) &&
    hasExactKeys(value.semantics, NESTED_KEYS.semantics) &&
    Array.isArray(value.scenarios) &&
    value.scenarios.every(
      (scenario) =>
        isRecord(scenario) && hasExactKeys(scenario, NESTED_KEYS.scenario),
    ) &&
    isRecord(value.cleanup) &&
    hasExactKeys(value.cleanup, NESTED_KEYS.cleanup) &&
    isRecord(value.exclusions) &&
    hasExactKeys(value.exclusions, NESTED_KEYS.exclusions)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function isIsoDate(value: string): boolean {
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

export async function writeExternalRecord(
  outputPath: string,
  record: ExternalPostgresqlAcceptanceRecord,
): Promise<void> {
  validateExternalRecord(record);
  await mkdir(dirname(outputPath), { recursive: true });
  const handle = await open(outputPath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`);
  } finally {
    await handle.close();
  }
}
