import { randomUUID } from "node:crypto";
import {
  createKeynesClient,
  CommittedResponseLostError,
  KeynesSdkError,
  type ResourceDefinitions,
  type BasicRuntimeSession,
  type NodeSqliteRuntime,
} from "@keynes/sdk";
import { openSqliteCommandExecutor } from "./local/sqlite-command-executor.js";

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
} as const;

async function openConfiguredRuntime(
  definitions: ResourceDefinitions,
): Promise<BasicRuntimeSession> {
  let host: ReturnType<typeof openLocalRuntimeHost>;
  try {
    host = openLocalRuntimeHost();
  } catch (cause: unknown) {
    throw new KeynesSdkError("initialization_failed", {}, { cause });
  }

  try {
    await host.client.defineResources({ commandId: randomUUID(), definitions });
  } catch (error: unknown) {
    try {
      await host.close();
    } catch (cleanupFailure: unknown) {
      throw new AggregateError(
        [error, cleanupFailure],
        "SQLite catalog initialization and cleanup failed",
        { cause: error },
      );
    }
    throw error;
  }

  let state: "open" | "closing" | "closed" = "open";
  let tail = Promise.resolve();
  let closePromise: Promise<void> | undefined;
  return {
    client: host.client,
    get state() {
      return state;
    },
    admit<Result>(operation: () => Promise<Result>): Promise<Result> {
      if (state !== "open")
        return Promise.reject(new KeynesSdkError("runtime_closed", {}));
      const result = tail.then(operation);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    invokeMutation,
    close() {
      if (closePromise !== undefined) return closePromise;
      state = "closing";
      closePromise = tail.then(host.close).finally(() => {
        state = "closed";
      });
      return closePromise;
    },
  };
}

async function invokeMutation<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (!(error instanceof CommittedResponseLostError)) throw error;
  }

  try {
    return await operation();
  } catch (cause: unknown) {
    if (!(cause instanceof CommittedResponseLostError)) throw cause;
    throw new KeynesSdkError("operation_interrupted", {}, { cause });
  }
}

function openLocalRuntimeHost() {
  const executor = openSqliteCommandExecutor(PRODUCT_INSTALLATION, {
    tenantId: PRODUCT_TENANT_ID,
    principalId: PRODUCT_PRINCIPAL_ID,
  });
  return {
    client: createKeynesClient(executor),
    close: async () => executor.close(),
  };
}

export function nodeSqlite(): NodeSqliteRuntime {
  if (arguments.length !== 0)
    throw new KeynesSdkError("invalid_configuration", {
      field: "runtime",
      reason: "unsupported",
    });
  return { kind: "local", initialize: openConfiguredRuntime };
}
