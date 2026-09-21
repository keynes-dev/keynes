import { randomUUID } from "node:crypto";
import {
  createKeynesClient,
  CommittedResponseLostError,
  KeynesSdkError,
  type RuntimeResourceBinding,
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
  definitions: unknown,
): Promise<BasicRuntimeSession> {
  let host: ReturnType<typeof openLocalRuntimeHost>;
  try {
    host = openLocalRuntimeHost();
  } catch (cause: unknown) {
    throw new KeynesSdkError("initialization_failed", {}, { cause });
  }

  let resources: readonly RuntimeResourceBinding[];
  try {
    const result = await host.client.defineResources({
      commandId: randomUUID(),
      definitions,
    });
    resources = result.resources.map(({ key, resourceType }) => ({
      key,
      canonicalName: resourceType.canonicalName,
      unit: resourceType.unit,
      accountingBehavior: resourceType.accountingBehavior,
    }));
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
  function admit<Result>(operation: () => Promise<Result>): Promise<Result>;
  function admit<Prepared, Result>(
    prepare: () => Prepared,
    execute: (prepared: Prepared) => Promise<Result>,
  ): Promise<Result>;
  function admit<Prepared, Result>(
    prepare: () => Prepared,
    execute?: (prepared: Prepared) => Promise<Result>,
  ): Promise<Prepared | Result> {
    if (state !== "open")
      return Promise.reject(new KeynesSdkError("runtime_closed", {}));
    if (execute === undefined) {
      const result = tail.then(prepare);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    }
    const previous = tail;
    const result = Promise.withResolvers<Result>();
    tail = Promise.allSettled([previous, result.promise]).then(() => undefined);
    try {
      const prepared = prepare();
      previous
        .then(() => execute(prepared))
        .then(result.resolve, result.reject);
    } catch (error: unknown) {
      result.reject(error);
    }
    return result.promise;
  }
  return {
    client: host.client,
    resources,
    get state() {
      return state;
    },
    admit,
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
