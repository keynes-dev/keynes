export type InstallationConfig = {
  readonly ownerRole: string;
  readonly executionRole: string;
  readonly administrationRole: string;
  readonly applicationRole: string;
  readonly tenantId: string;
  readonly principalId: string;
};

const CONFIG_KEYS = [
  "ownerRole",
  "executionRole",
  "administrationRole",
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
  if (
    Object.keys(value).length !== CONFIG_KEYS.length ||
    CONFIG_KEYS.some((key) => typeof value[key] !== "string")
  ) {
    invalid("keys");
  }
  const ownerRole = value.ownerRole;
  const executionRole = value.executionRole;
  const administrationRole = value.administrationRole;
  const applicationRole = value.applicationRole;
  const tenantId = value.tenantId;
  const principalId = value.principalId;
  if (
    typeof ownerRole !== "string" ||
    typeof executionRole !== "string" ||
    typeof administrationRole !== "string" ||
    typeof applicationRole !== "string" ||
    typeof tenantId !== "string" ||
    typeof principalId !== "string"
  ) {
    invalid("keys");
  }
  if (
    !ROLE.test(ownerRole) ||
    !ROLE.test(executionRole) ||
    !ROLE.test(administrationRole) ||
    !ROLE.test(applicationRole)
  )
    invalid("role");
  if (
    new Set([ownerRole, executionRole, administrationRole, applicationRole])
      .size !== 4
  ) {
    invalid("roles");
  }
  if (!UUID.test(tenantId) || !UUID.test(principalId)) invalid("uuid");
  return {
    ownerRole,
    executionRole,
    administrationRole,
    applicationRole,
    tenantId,
    principalId,
  };
}
