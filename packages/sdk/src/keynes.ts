import { randomUUID } from "node:crypto";

import {
  createBudgetHandle,
  type Budget,
  type ExactResourceAmounts,
  type ResourceAmounts,
} from "./budget.js";
import { requireNoOptions } from "./budget-request-options.js";
import type {
  RemoteBudgetProjection,
  RemoteMutationName,
} from "./generated/types.js";
import { KeynesError } from "./generated/client.js";
import type {
  BasicRuntimeSession,
  RemoteRuntimeSession,
  NodeSqliteRuntime,
  EmbeddedPostgresRuntime,
  PostgresRuntime,
  KeynesRuntime,
} from "./generated/runtime.js";
import { createResourceBinding } from "./resource-binding.js";
import {
  createResourceDefinitionBinding,
  type ResourceBinding,
} from "./resource-definition-binding.js";
import {
  createOpenedRemoteResourceBinding,
  createRemoteBudgetHandle,
  createRemoteResourceBinding,
  type RemotePolicySession,
} from "./remote/result-mapping.js";
import type { RemoteBudget } from "./remote/public-types.js";
import {
  projectOperationResult,
  requireBudgetReference,
  requireOperationKey,
  splitRemoteMutationOptions,
  type BudgetReference,
  type OperationKey,
  type OperationResult,
  type RemoteOperationOptions,
} from "./remote/references.js";
import {
  prepareRootResources,
  requireRuntimeBindings,
  invokeResourceConfiguration,
  resourceInstallation,
  snapshotResourceDefinitions,
  type ResourceDefinitionsInput,
} from "./resources.js";
import { KeynesSdkError } from "./sdk-errors.js";

const keynesBrand: unique symbol = Symbol("Keynes");

interface RootBudgetCreator<Names extends string> {
  <const Allocation extends ResourceAmounts<Names>>(
    allocation: ExactResourceAmounts<NoInfer<Names>, Allocation>,
    ...options: readonly []
  ): Promise<Budget<Extract<keyof Allocation, string>>>;
}

export interface Keynes<Names extends string = string> extends AsyncDisposable {
  readonly [keynesBrand]: Names | undefined;
  readonly defineResources: <
    const Definitions extends ResourceDefinitionsInput,
  >(
    definitions: Definitions,
  ) => Promise<ResourceBinding<Extract<keyof Definitions, string>>>;
  readonly createBudget: RootBudgetCreator<Names>;
  readonly close: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}

export type LocalKeynes<Names extends string = string> = Keynes<Names>;

export interface RemoteKeynesOptions<
  Definitions extends ResourceDefinitionsInput = ResourceDefinitionsInput,
> {
  readonly resources: Definitions;
  readonly runtime: PostgresRuntime;
}

interface RemoteRootBudgetCreator<Names extends string> {
  <const Allocation extends ResourceAmounts<Names>>(
    allocation: ExactResourceAmounts<NoInfer<Names>, Allocation>,
    ...options: readonly [] | readonly [RemoteOperationOptions]
  ): Promise<RemoteBudget<Extract<keyof Allocation, Names>>>;
}

interface RemoteBudgetOpener {
  <const Definitions extends ResourceDefinitionsInput>(options: {
    readonly reference: BudgetReference;
    readonly resourceTypes: Definitions;
  }): Promise<RemoteBudget<Extract<keyof Definitions, string>>>;
}

export interface RemoteKeynes<Names extends string = string> extends Omit<
  Keynes<Names>,
  "createBudget" | "defineResources"
> {
  readonly defineResources: <
    const Definitions extends ResourceDefinitionsInput,
  >(
    definitions: Definitions,
    options?: RemoteOperationOptions,
  ) => Promise<ResourceBinding<Extract<keyof Definitions, string>>>;
  readonly createBudget: RemoteRootBudgetCreator<Names>;
  readonly openBudget: RemoteBudgetOpener;
  readonly getOperationResult: (
    operationKey: OperationKey,
  ) => Promise<OperationResult>;
}

export function createKeynes<
  const Options extends {
    readonly resources: ResourceDefinitionsInput;
    readonly runtime: NodeSqliteRuntime | EmbeddedPostgresRuntime;
  },
>(
  options: Options &
    Record<Exclude<keyof Options, "resources" | "runtime">, never>,
): Promise<Keynes<Extract<keyof Options["resources"], string>>>;
export function createKeynes<const Options extends RemoteKeynesOptions>(
  options: Options &
    Record<Exclude<keyof Options, "resources" | "runtime">, never>,
): Promise<RemoteKeynes<Extract<keyof Options["resources"], string>>>;
export function createKeynes<
  const Options extends {
    readonly resources: ResourceDefinitionsInput;
    readonly runtime: KeynesRuntime;
  },
>(
  options: Options &
    Record<Exclude<keyof Options, "resources" | "runtime">, never>,
): Promise<
  | Keynes<Extract<keyof Options["resources"], string>>
  | RemoteKeynes<Extract<keyof Options["resources"], string>>
>;
export async function createKeynes(
  ...arguments_: readonly unknown[]
): Promise<LocalKeynes | RemoteKeynes> {
  const options = arguments_[0];
  if (
    arguments_.length !== 1 ||
    !isRecord(options) ||
    (Object.getPrototypeOf(options) !== Object.prototype &&
      Object.getPrototypeOf(options) !== null) ||
    Object.getOwnPropertySymbols(options).length > 0 ||
    !Object.hasOwn(options, "resources") ||
    !Object.hasOwn(options, "runtime") ||
    Object.values(Object.getOwnPropertyDescriptors(options)).some(
      (field) => !("value" in field),
    ) ||
    Object.getOwnPropertyNames(options).some(
      (key) => key !== "resources" && key !== "runtime",
    )
  ) {
    throw new KeynesSdkError("invalid_configuration", {
      field: "options",
      reason: "unsupported",
    });
  }
  const descriptor = options.runtime;
  if (!isRuntime(descriptor)) {
    throw new KeynesSdkError("invalid_configuration", {
      field: "runtime",
      reason: "unsupported",
    });
  }
  const definitions = snapshotResourceDefinitions(
    options.resources,
    "validateResources",
  );
  if (descriptor.kind !== "remote") {
    const runtime = await invokeResourceConfiguration(() =>
      descriptor.initialize(definitions),
    );
    await validateInitializedBindings(runtime, definitions);
    return createKeynesHandle(runtime);
  }
  const initializedRuntime = await invokeResourceConfiguration(() =>
    descriptor.initialize(definitions),
  );
  await validateInitializedBindings(initializedRuntime, definitions);
  const runtime = admitRemotePolicies(initializedRuntime);
  const { client } = runtime;
  const createBudget: RemoteRootBudgetCreator<string> = (
    allocation,
    ...createOptions
  ) => createRemoteRootBudget(runtime, allocation, createOptions);
  const openBudget: RemoteBudgetOpener = async (options) => {
    runtime.assertOpen();
    const { reference, resourceTypes } = options;
    const budgetReference = requireBudgetReference(reference);
    const definitions = snapshotResourceDefinitions(
      resourceTypes,
      "validateResources",
    );
    const bindings = await invokeResourceConfiguration(() =>
      runtime.prepareResources(definitions),
    );
    requireRuntimeBindings(bindings, definitions);
    const resources = resourceInstallation(bindings);
    const result = await client.openBudget({
      budgetReference,
      expectedResources: resources.map(({ definition }) => definition),
    });
    if (
      result.budgetReference !== budgetReference ||
      result.budget.budgetReference !== budgetReference
    ) {
      throw remoteResultMismatch();
    }
    return createRemoteBudgetHandle(
      runtime,
      remoteBudgetIdentity(result.budget),
      createOpenedRemoteResourceBinding(resources, result.budget),
    );
  };
  const getOperationResult = async (
    suppliedOperationKey: OperationKey,
  ): Promise<OperationResult> => {
    runtime.assertOpen();
    const operationKey = requireOperationKey(suppliedOperationKey);
    const result = await client.recoverOperation({ operationKey });
    if (result.operationKey !== operationKey) throw remoteResultMismatch();
    return projectOperationResult(result);
  };
  const defineResources: RemoteKeynes["defineResources"] = async (
    definitions,
    ...options
  ) => {
    runtime.assertOpen();
    const snapshot = snapshotResourceDefinitions(definitions);
    const { operationKey } = splitRemoteMutationOptions(options, new Set());
    const input = { operationKey, definitions: snapshot };
    await runtime.invokeMutation("defineResources", operationKey, () =>
      client.defineResources(input),
    );
    return createResourceDefinitionBinding();
  };
  const close = sessionCloser(runtime);
  return Object.freeze({
    [keynesBrand]: undefined,
    defineResources,
    createBudget,
    openBudget,
    getOperationResult,
    close,
    [Symbol.asyncDispose]: close,
  });
}

function createKeynesHandle(runtime: BasicRuntimeSession): LocalKeynes {
  const defineResources: LocalKeynes["defineResources"] = async (
    definitions,
  ) => {
    return runtime.admit(
      () => ({
        commandId: randomUUID(),
        definitions: snapshotResourceDefinitions(definitions),
      }),
      async (input) => {
        await runtime.invokeMutation(() =>
          runtime.client.defineResources(input),
        );
        return createResourceDefinitionBinding();
      },
    );
  };
  const createBudget: RootBudgetCreator<string> = (allocation, ...options) =>
    createRootBudget(runtime, allocation, options);
  const close = sessionCloser(runtime);
  return Object.freeze({
    [keynesBrand]: undefined,
    defineResources,
    createBudget,
    close,
    [Symbol.asyncDispose]: close,
  });
}

function admitRemotePolicies(
  runtime: RemoteRuntimeSession,
): RemotePolicySession {
  const admitted = new Set<Promise<unknown>>();
  let closePromise: Promise<void> | undefined;

  function assertOpen(): void {
    if (closePromise !== undefined) {
      throw new KeynesError({
        kind: "error",
        code: "client_closed",
        details: {},
      });
    }
    runtime.assertOpen();
  }

  function admitPolicy<Prepared, Result>(
    prepare: () => Prepared,
    execute: (prepared: Prepared) => Promise<Result>,
  ): Promise<Result> {
    try {
      assertOpen();
    } catch (error: unknown) {
      return Promise.reject(error);
    }
    let result: Promise<Result>;
    try {
      const prepared = prepare();
      result = Promise.resolve().then(() => execute(prepared));
    } catch (error: unknown) {
      result = Promise.reject(error);
    }
    admitted.add(result);
    void result.then(
      () => admitted.delete(result),
      () => admitted.delete(result),
    );
    return result;
  }

  function close(): Promise<void> {
    if (closePromise !== undefined) return closePromise;
    closePromise = Promise.allSettled(admitted).then(() => runtime.close());
    return closePromise;
  }

  return Object.freeze({
    resources: runtime.resources,
    prepareResources: (definitions: unknown) =>
      runtime.prepareResources(definitions),
    client: runtime.client,
    invokeMutation: <Result>(
      operation: RemoteMutationName,
      operationKey: string,
      invoke: () => Promise<Result>,
    ) => runtime.invokeMutation(operation, operationKey, invoke),
    assertOpen,
    admitPolicy,
    close,
  });
}

async function createRootBudget<
  Names extends string,
  const Allocation extends ResourceAmounts<Names>,
>(
  runtime: BasicRuntimeSession,
  allocation: ExactResourceAmounts<NoInfer<Names>, Allocation>,
  options: readonly unknown[],
): Promise<Budget<Extract<keyof Allocation, Names>>> {
  type BudgetName = Extract<keyof Allocation, Names>;
  return runtime.admit(
    () => {
      const prepared = prepareRootResources<BudgetName>(
        runtime.resources,
        allocation,
      );
      requireNoOptions(options);
      return prepared;
    },
    async ({ definitions: selectedDefinitions, amounts, prepared }) => {
      const command = {
        commandId: randomUUID(),
        definitions: selectedDefinitions,
        amounts,
      };
      const result = await runtime.invokeMutation(() =>
        runtime.client.createBudget(command),
      );
      const binding = createResourceBinding(prepared, result.budget);
      return createBudgetHandle<BudgetName>(
        runtime,
        result.budget.budgetId,
        binding,
      );
    },
  );
}

async function createRemoteRootBudget<
  Names extends string,
  const Allocation extends ResourceAmounts<Names>,
>(
  runtime: RemotePolicySession,
  allocation: ExactResourceAmounts<NoInfer<Names>, Allocation>,
  options: readonly unknown[],
): Promise<RemoteBudget<Extract<keyof Allocation, Names>>> {
  runtime.assertOpen();
  type BudgetName = Extract<keyof Allocation, Names>;
  const { client } = runtime;
  const {
    definitions: selectedDefinitions,
    amounts,
    prepared,
  } = prepareRootResources<BudgetName>(runtime.resources, allocation);
  const { operationKey } = splitRemoteMutationOptions(options, new Set());
  const result = await runtime.invokeMutation(
    "createBudget",
    operationKey,
    () =>
      client.createBudget({
        operationKey,
        definitions: selectedDefinitions,
        amounts,
      }),
  );
  const budgetReference = requireBudgetReference(result.budget.budgetReference);
  return createRemoteBudgetHandle<BudgetName>(
    runtime,
    {
      budgetReference,
      parentBudgetReference: null,
      rootBudgetReference: budgetReference,
      depth: 0,
    },
    createRemoteResourceBinding(prepared, result.budget),
  );
}

function remoteBudgetIdentity(budget: RemoteBudgetProjection): {
  readonly budgetReference: BudgetReference;
  readonly parentBudgetReference: BudgetReference | null;
  readonly rootBudgetReference: BudgetReference;
  readonly depth: number;
} {
  return {
    budgetReference: requireBudgetReference(budget.budgetReference),
    parentBudgetReference:
      budget.parentBudgetReference === null
        ? null
        : requireBudgetReference(budget.parentBudgetReference),
    rootBudgetReference: requireBudgetReference(budget.rootBudgetReference),
    depth: budget.depth,
  };
}

function remoteResultMismatch(): KeynesError {
  return new KeynesError({ kind: "error", code: "unknown", details: {} });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuntime(value: unknown): value is KeynesRuntime {
  return (
    isRecord(value) &&
    Object.values(Object.getOwnPropertyDescriptors(value)).every(
      (field) => "value" in field,
    ) &&
    Object.hasOwn(value, "kind") &&
    Object.hasOwn(value, "initialize") &&
    (value.kind === "local" ||
      value.kind === "remote" ||
      value.kind === "embedded") &&
    typeof value.initialize === "function"
  );
}

async function validateInitializedBindings(
  runtime: BasicRuntimeSession | RemoteRuntimeSession,
  definitions: unknown,
): Promise<void> {
  try {
    requireRuntimeBindings(runtime.resources, definitions);
  } catch (error: unknown) {
    try {
      await runtime.close();
    } catch (cleanup: unknown) {
      throw new AggregateError(
        [error, cleanup],
        "Runtime binding validation and cleanup failed",
        { cause: error },
      );
    }
    throw error;
  }
}

function sessionCloser(
  runtime: BasicRuntimeSession | RemoteRuntimeSession,
): () => Promise<void> {
  let closing: Promise<void> | undefined;
  return () => {
    if (closing !== undefined) return closing;
    try {
      closing = runtime.close();
    } catch (error: unknown) {
      closing = Promise.reject(error);
    }
    return closing;
  };
}
