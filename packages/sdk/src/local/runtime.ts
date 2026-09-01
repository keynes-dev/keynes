import { randomUUID } from "node:crypto";

import type { KeynesClient } from "../generated/client.js";
import { createKeynesClient } from "../generated/client.js";
import type {
  DefineResourceTypeCommand,
  ResourceTypeProjection,
} from "../generated/types.js";
import { CommittedResponseLostError } from "../replay.js";
import type { ResourceSchema } from "../resources.js";
import { resourceInstallation } from "../resources.js";
import {
  KeynesSdkError,
  ResourceDefinitionError,
  type DefinedResource,
} from "../sdk-errors.js";
import { ResourceCatalog } from "./resource-catalog.js";
import { openSqliteCommandExecutor } from "./sqlite-command-executor.js";

type RuntimeState = "open" | "closing" | "closed";

export interface LocalRuntime {
  readonly client: KeynesClient;
  readonly resources: ResourceCatalog;
  state: RuntimeState;
  tail: Promise<void>;
  closePromise: Promise<void> | undefined;
  readonly closeHost: () => Promise<void>;
}

interface LocalRuntimeHost {
  readonly client: KeynesClient;
  readonly close: () => Promise<void>;
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
} as const;

export async function openConfiguredRuntime(
  schema: ResourceSchema,
): Promise<LocalRuntime> {
  const installation = resourceInstallation(schema);
  let host: LocalRuntimeHost;
  try {
    host = openLocalRuntimeHost();
  } catch (cause: unknown) {
    throw new KeynesSdkError("initialization_failed", {}, { cause });
  }

  const runtime: LocalRuntime = {
    client: host.client,
    resources: new ResourceCatalog(),
    state: "open",
    tail: Promise.resolve(),
    closePromise: undefined,
    closeHost: host.close,
  };

  try {
    await installResources(runtime, installation);
    return runtime;
  } catch (cause: unknown) {
    runtime.state = "closing";
    try {
      await host.close();
    } catch (cleanupFailure: unknown) {
      runtime.state = "closed";
      throw new AggregateError(
        [cause, cleanupFailure],
        "Resource installation and cleanup failed",
        { cause },
      );
    }
    runtime.state = "closed";
    throw cause;
  }
}

export function admit<Result>(
  runtime: LocalRuntime,
  operation: () => Promise<Result>,
): Promise<Result> {
  if (runtime.state !== "open") {
    return Promise.reject(new KeynesSdkError("runtime_closed", {}));
  }
  const result = runtime.tail.then(operation);
  runtime.tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function invokeMutation<Result>(
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

export function closeRuntime(runtime: LocalRuntime): Promise<void> {
  if (runtime.closePromise !== undefined) return runtime.closePromise;
  runtime.state = "closing";
  runtime.closePromise = runtime.tail.then(runtime.closeHost).finally(() => {
    runtime.state = "closed";
  });
  return runtime.closePromise;
}

async function installResources(
  runtime: LocalRuntime,
  installation: ReturnType<typeof resourceInstallation>,
): Promise<void> {
  const definedResources: DefinedResource[] = [];
  for (const resource of installation) {
    try {
      const command = {
        commandId: randomUUID(),
        definition: resource.definition,
      } satisfies DefineResourceTypeCommand;
      const result = await invokeMutation(() =>
        runtime.client.defineResource(command),
      );
      runtime.resources.record(resource, result.resourceType);
      definedResources.push(publicResource(resource.key, result.resourceType));
    } catch (cause: unknown) {
      if (
        cause instanceof KeynesSdkError &&
        cause.code === "operation_interrupted"
      ) {
        throw cause;
      }
      throw new ResourceDefinitionError(
        resource.key,
        Object.freeze([...definedResources]),
        cause,
      );
    }
  }
}

function publicResource(
  resource: string,
  projection: ResourceTypeProjection,
): DefinedResource {
  return Object.freeze({
    resource,
    canonicalName: projection.canonicalName,
    unit: projection.unit,
    accountingBehavior: projection.accountingBehavior,
    definitionDigest: projection.definitionDigest,
  });
}

function openLocalRuntimeHost(): LocalRuntimeHost {
  const executor = openSqliteCommandExecutor(PRODUCT_INSTALLATION, {
    tenantId: PRODUCT_TENANT_ID,
    principalId: PRODUCT_PRINCIPAL_ID,
  });
  return {
    client: createKeynesClient(executor),
    close: async () => executor.close(),
  };
}
