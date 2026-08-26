export const SUPPORTED_PERMISSIONS = [
  "define_resource_type",
  "create_root_budget",
  "request_budget",
  "settle_budget",
  "read_budget",
] as const;

export const SUPPORTED_PROFILE = {
  profileId: "embedded-postgresql-18.6-preview",
  serverVersionNum: "180006",
  permissions: SUPPORTED_PERMISSIONS,
} as const;

export type InstallationConfig = {
  readonly ownerRole: string;
  readonly applicationRole: string;
  readonly tenantId: string;
  readonly principalId: string;
};
