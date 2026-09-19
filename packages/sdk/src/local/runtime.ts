import { randomUUID } from "node:crypto";
import type { KeynesClient } from "../generated/client.js";
import type { ResourceDefinitions } from "../resources.js";
import { createKeynesClient } from "../generated/client.js";
import { CommittedResponseLostError } from "../replay.js";
import { KeynesSdkError } from "../sdk-errors.js";
import { openPgliteCommandExecutor } from "./pglite-command-executor.js";

type RuntimeState = "open" | "closing" | "closed";

export interface LocalRuntime {
  readonly client: KeynesClient;
  state: RuntimeState;
  tail: Promise<void>;
  closePromise: Promise<void> | undefined;
  readonly closeHost: () => Promise<void>;
}

interface LocalRuntimeHost {
  readonly client: KeynesClient;
  readonly close: () => Promise<void>;
}

export async function openConfiguredRuntime(
  definitions: ResourceDefinitions,
): Promise<LocalRuntime> {
  let host: LocalRuntimeHost;
  try {
    host = await openLocalRuntimeHost();
  } catch (cause: unknown) {
    throw new KeynesSdkError("initialization_failed", {}, { cause });
  }

  try {
    await host.client.defineResources({ commandId: randomUUID(), definitions });
  } catch (error: unknown) {
    await host.close();
    throw error;
  }

  const runtime: LocalRuntime = {
    client: host.client,
    state: "open",
    tail: Promise.resolve(),
    closePromise: undefined,
    closeHost: host.close,
  };

  return runtime;
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

async function openLocalRuntimeHost(): Promise<LocalRuntimeHost> {
  const executor = await openPgliteCommandExecutor();
  return {
    client: createKeynesClient(executor),
    close: () => executor.close(),
  };
}
