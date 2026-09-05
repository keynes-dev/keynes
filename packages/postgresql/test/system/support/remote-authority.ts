export const REMOTE_TENANT_A = "00000000-0000-4000-8000-000000000021";
export const REMOTE_PRINCIPAL_A = "00000000-0000-4000-8000-000000000121";
export const REMOTE_TENANT_B = "00000000-0000-4000-8000-000000000022";
export const REMOTE_PRINCIPAL_B = "00000000-0000-4000-8000-000000000122";

export const REMOTE_RUNTIME_PROCEDURES = [
  "keynes.remote_create_budget(jsonb)",
  "keynes.remote_request(jsonb)",
  "keynes.remote_settle(jsonb)",
  "keynes.remote_get_budget(jsonb)",
  "keynes.remote_get_budget_history_page(jsonb)",
  "keynes.remote_open_budget(jsonb)",
  "keynes.remote_recover_operation(jsonb)",
  "keynes.remote_get_compatibility(jsonb)",
] as const;

export const REMOTE_ADMIN_PROCEDURES = [
  "keynes_internal.register_remote_role_v0006(name,uuid,uuid)",
  "keynes_internal.rotate_remote_role_v0006(name,name)",
  "keynes_internal.set_remote_role_enabled_v0006(name,boolean)",
  "keynes_internal.revoke_remote_role_v0006(name)",
  "keynes_internal.inspect_remote_role_v0006(name)",
  "keynes_internal.audit_remote_role_v0006(name,integer)",
] as const;
