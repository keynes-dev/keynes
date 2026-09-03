export interface ExternalPostgresqlProfile {
  readonly schemaVersion: "keynes.external-postgresql-profile/v1";
  readonly authorizationReference: string;
  readonly provider: string;
  readonly serverProfile: "postgresql-18.6";
  readonly hostClass: string;
  readonly topology: "direct";
  readonly downstreamTlsOwner: string;
  readonly expectedLeafCertificateSha256: string;
}

const PROFILE_KEYS = [
  "schemaVersion",
  "authorizationReference",
  "provider",
  "serverProfile",
  "hostClass",
  "topology",
  "downstreamTlsOwner",
  "expectedLeafCertificateSha256",
] as const;
const SAFE_LABEL = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export function parseExternalProfile(
  value: unknown,
): ExternalPostgresqlProfile {
  if (!isRecord(value) || !hasExactKeys(value, PROFILE_KEYS)) invalidProfile();
  const {
    schemaVersion,
    authorizationReference,
    provider,
    serverProfile,
    hostClass,
    topology,
    downstreamTlsOwner,
    expectedLeafCertificateSha256,
  } = value;
  if (
    schemaVersion !== "keynes.external-postgresql-profile/v1" ||
    typeof authorizationReference !== "string" ||
    !SAFE_LABEL.test(authorizationReference) ||
    typeof provider !== "string" ||
    !SAFE_LABEL.test(provider) ||
    serverProfile !== "postgresql-18.6" ||
    typeof hostClass !== "string" ||
    !SAFE_LABEL.test(hostClass) ||
    topology !== "direct" ||
    typeof downstreamTlsOwner !== "string" ||
    !SAFE_LABEL.test(downstreamTlsOwner) ||
    typeof expectedLeafCertificateSha256 !== "string" ||
    !SHA256.test(expectedLeafCertificateSha256)
  ) {
    invalidProfile();
  }
  return {
    schemaVersion,
    authorizationReference,
    provider,
    serverProfile,
    hostClass,
    topology,
    downstreamTlsOwner,
    expectedLeafCertificateSha256,
  };
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

function invalidProfile(): never {
  throw new Error("invalid external profile");
}
