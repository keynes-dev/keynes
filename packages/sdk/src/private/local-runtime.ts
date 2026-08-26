import { createKeynesClient, type KeynesClient } from "../generated/client.js";
import type { DatabaseInstallation } from "./migrations.js";
import { openSqliteCommandExecutor } from "./sqlite-command-executor.js";

export interface LocalRuntime {
  readonly client: KeynesClient;
  close(): Promise<void>;
}

const PRODUCT_TENANT_ID = "00000000-0000-4000-8000-000000000002";
const PRODUCT_PRINCIPAL_ID = "00000000-0000-4000-8000-000000000201";
const PRODUCT_INSTALLATION = {
  tenantId: PRODUCT_TENANT_ID,
  principals: [
    {
      principalId: PRODUCT_PRINCIPAL_ID,
      permissions: [
        "define_resource_type",
        "create_root_budget",
        "request_budget",
        "settle_budget",
        "read_budget",
      ],
    },
  ],
} as const satisfies DatabaseInstallation;

export async function openLocalRuntime(): Promise<LocalRuntime> {
  const executor = openSqliteCommandExecutor(PRODUCT_INSTALLATION, {
    tenantId: PRODUCT_TENANT_ID,
    principalId: PRODUCT_PRINCIPAL_ID,
  });
  return {
    client: createKeynesClient(executor),
    close: async () => executor.close(),
  };
}
