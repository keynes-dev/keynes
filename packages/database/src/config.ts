export type InstallationConfig = {
  readonly ownerRole: string;
  readonly applicationRole: string;
  readonly tenantId: string;
  readonly principalId: string;
};

const CONFIG_KEYS = [
  "ownerRole",
  "applicationRole",
  "tenantId",
  "principalId",
] as const;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ROLE = /^[a-z_][a-z0-9_$]{0,62}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string): never {
  throw new Error(`invalid installation configuration: ${field}`);
}

export function parseInstallationConfig(value: unknown): InstallationConfig {
  if (!isRecord(value)) invalid("object");
  const keys = Object.keys(value).sort();
  const expected = [...CONFIG_KEYS].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    invalid("keys");
  }

  for (const key of CONFIG_KEYS) {
    if (typeof value[key] !== "string") invalid(key);
  }
  const config = value as InstallationConfig;
  if (!ROLE.test(config.ownerRole) || !ROLE.test(config.applicationRole))
    invalid("role");
  if (config.ownerRole === config.applicationRole) invalid("roles");
  if (!UUID.test(config.tenantId) || !UUID.test(config.principalId))
    invalid("uuid");
  return config;
}
