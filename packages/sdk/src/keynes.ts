import { randomUUID } from "node:crypto";

import {
  createBudgetHandle,
  type Budget,
  type ExactResourceAmounts,
  type ResourceAmounts,
} from "./budget.js";
import { requireNoOptions } from "./budget-request-options.js";
import type {
  CreateBudgetCommand,
  DefineResourcesCommand,
  RemoteDefineResourcesCommand,
  RemoteBudgetProjection,
} from "./generated/types.js";
import { createRemoteKeynesClient, KeynesError } from "./generated/client.js";
import {
  admit,
  closeRuntime,
  invokeMutation,
  type LocalRuntime,
  openConfiguredRuntime,
} from "./local/runtime.js";
import { createResourceBinding } from "./resource-binding.js";
import {
  createResourceDefinitionBinding,
  type ResourceBinding,
} from "./resource-definition-binding.js";
import {
  validateDefineResourcesCommandIssues,
  validateRemoteDefineResourcesCommandIssues,
} from "./generated/validators.js";
import {
  createOpenedRemoteResourceBinding,
  createRemoteBudgetHandle,
  createRemoteResourceBinding,
} from "./remote/budget.js";
import { normalizeDatabaseUrl } from "./remote/connection-options.js";
import { openPostgresqlCommandExecutor } from "./remote/postgresql-command-executor.js";
import type { RemoteBudget } from "./remote/public-types.js";
import {
  projectRecoverOperationResult,
  requireBudgetReference,
  requireOperationKey,
  splitRemoteMutationOptions,
  type BudgetReference,
  type OperationKey,
  type RecoverOperationResult,
  type RemoteOperationOptions,
} from "./remote/references.js";
import { invokeRemoteMutation } from "./remote/retry.js";
import {
  prepareRootResources,
  resourceInstallation,
  snapshotResourceDefinitions,
  captureResourceDefinitions,
  type ResourceDefinitionsInput,
  type ResourceDefinitions,
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
  readonly databaseUrl: string;
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
  readonly recoverOperation: (
    operationKey: OperationKey,
  ) => Promise<RecoverOperationResult>;
}

export function createKeynes<
  const Options extends {
    readonly resources: ResourceDefinitionsInput;
    readonly databaseUrl?: never;
  },
>(
  options: Options & Record<Exclude<keyof Options, "resources">, never>,
): Promise<LocalKeynes<Extract<keyof Options["resources"], string>>>;
export function createKeynes<const Options extends RemoteKeynesOptions>(
  options: Options &
    Record<Exclude<keyof Options, "resources" | "databaseUrl">, never>,
): Promise<RemoteKeynes<Extract<keyof Options["resources"], string>>>;
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
    Object.getOwnPropertyNames(options).some(
      (key) => key !== "resources" && key !== "databaseUrl",
    )
  ) {
    throw new KeynesSdkError("invalid_configuration", {
      field: "options",
      reason: "unsupported",
    });
  }
  const hasDatabaseUrl = Object.hasOwn(options, "databaseUrl");
  const databaseUrl = hasDatabaseUrl ? options.databaseUrl : undefined;
  const definitions = captureResourceDefinitions(options.resources);
  if (!hasDatabaseUrl) {
    const runtime = await openConfiguredRuntime(definitions);
    return createKeynesHandle(runtime, definitions);
  }
  if (typeof databaseUrl !== "string") {
    throw new KeynesSdkError("invalid_configuration", {
      field: "databaseUrl",
      reason: "unsupported",
    });
  }
  const poolConfig = normalizeDatabaseUrl(databaseUrl);
  const executor = await openPostgresqlCommandExecutor(poolConfig);
  const client = createRemoteKeynesClient(executor);
  try {
    await client.validateResources({ definitions });
  } catch (error: unknown) {
    await executor.close();
    throw error;
  }
  const createBudget: RemoteRootBudgetCreator<string> = (
    allocation,
    ...createOptions
  ) => createRemoteRootBudget(client, definitions, allocation, createOptions);
  const openBudget: RemoteBudgetOpener = async ({
    reference,
    resourceTypes,
  }) => {
    const budgetReference = requireBudgetReference(reference);
    const resources = resourceInstallation(resourceTypes);
    const first = resources[0];
    if (first === undefined) {
      throw new KeynesSdkError("invalid_configuration", {
        field: "resources",
        reason: "unsupported",
      });
    }
    const result = await client.openBudget({
      budgetReference,
      expectedResources: [
        first.definition,
        ...resources.slice(1).map(({ definition }) => definition),
      ],
    });
    if (
      result.budgetReference !== budgetReference ||
      result.budget.budgetReference !== budgetReference
    ) {
      throw remoteResultMismatch();
    }
    return createRemoteBudgetHandle(
      client,
      remoteBudgetIdentity(result.budget),
      createOpenedRemoteResourceBinding(resources, result.budget),
    );
  };
  const recoverOperation = async (
    suppliedOperationKey: OperationKey,
  ): Promise<RecoverOperationResult> => {
    const operationKey = requireOperationKey(suppliedOperationKey);
    const result = await client.recoverOperation({ operationKey });
    if (result.operationKey !== operationKey) throw remoteResultMismatch();
    return projectRecoverOperationResult(result);
  };
  const defineResources: RemoteKeynes["defineResources"] = async (
    definitions,
    ...options
  ) => {
    const snapshot = snapshotResourceDefinitions(definitions);
    const { operationKey } = splitRemoteMutationOptions(options, new Set());
    const input = { operationKey, definitions: snapshot };
    requireDefinitionInput(
      input,
      validateRemoteDefineResourcesCommandIssues(input),
    );
    await invokeRemoteMutation("defineResources", operationKey, () =>
      client.defineResources(input as RemoteDefineResourcesCommand),
    );
    return createResourceDefinitionBinding();
  };
  const close = (): Promise<void> => executor.close();
  return Object.freeze({
    [keynesBrand]: undefined,
    defineResources,
    createBudget,
    openBudget,
    recoverOperation,
    close,
    [Symbol.asyncDispose]: close,
  });
}

function createKeynesHandle(
  runtime: LocalRuntime,
  definitions: ResourceDefinitions,
): LocalKeynes {
  const defineResources: LocalKeynes["defineResources"] = async (
    definitions,
  ) => {
    if (runtime.state !== "open")
      throw new KeynesSdkError("runtime_closed", {});
    const input = {
      commandId: randomUUID(),
      definitions: snapshotResourceDefinitions(definitions),
    };
    return admit(runtime, async () => {
      requireDefinitionInput(
        input,
        validateDefineResourcesCommandIssues(input),
      );
      await invokeMutation(() =>
        runtime.client.defineResources(input as DefineResourcesCommand),
      );
      return createResourceDefinitionBinding();
    });
  };
  const createBudget: RootBudgetCreator<string> = (allocation, ...options) =>
    createRootBudget(runtime, definitions, allocation, options);
  const close = (): Promise<void> => closeRuntime(runtime);
  return Object.freeze({
    [keynesBrand]: undefined,
    defineResources,
    createBudget,
    close,
    [Symbol.asyncDispose]: close,
  });
}

function requireDefinitionInput(
  input: { readonly definitions: unknown },
  issues: { readonly path: string; readonly rule: string }[],
): void {
  if (
    isRecord(input.definitions) &&
    Object.keys(input.definitions).length === 0
  ) {
    issues.push({ path: "/definitions", rule: "minProperties" });
  }
  const [first, ...remaining] = issues;
  if (first === undefined) return;
  throw new KeynesError({
    kind: "error",
    code: "invalid_command",
    details: { operation: "defineResources", issues: [first, ...remaining] },
  });
}

async function createRootBudget<
  Names extends string,
  const Allocation extends ResourceAmounts<Names>,
>(
  runtime: LocalRuntime,
  definitions: ResourceDefinitions,
  allocation: ExactResourceAmounts<NoInfer<Names>, Allocation>,
  options: readonly unknown[],
): Promise<Budget<Extract<keyof Allocation, Names>>> {
  type BudgetName = Extract<keyof Allocation, Names>;
  if (runtime.state !== "open") throw new KeynesSdkError("runtime_closed", {});
  const {
    definitions: selectedDefinitions,
    amounts,
    prepared,
  } = prepareRootResources<BudgetName>(definitions, allocation);
  requireNoOptions(options);
  return admit(runtime, async () => {
    const command: CreateBudgetCommand = {
      commandId: randomUUID(),
      definitions: selectedDefinitions,
      amounts,
    };
    const result = await invokeMutation(() =>
      runtime.client.createBudget(command),
    );
    const binding = createResourceBinding(prepared, result.budget);
    return createBudgetHandle<BudgetName>(
      runtime,
      result.budget.budgetId,
      binding,
    );
  });
}

async function createRemoteRootBudget<
  Names extends string,
  const Allocation extends ResourceAmounts<Names>,
>(
  client: ReturnType<typeof createRemoteKeynesClient>,
  definitions: ResourceDefinitions,
  allocation: ExactResourceAmounts<NoInfer<Names>, Allocation>,
  options: readonly unknown[],
): Promise<RemoteBudget<Extract<keyof Allocation, Names>>> {
  type BudgetName = Extract<keyof Allocation, Names>;
  const {
    definitions: selectedDefinitions,
    amounts,
    prepared,
  } = prepareRootResources<BudgetName>(definitions, allocation);
  const { operationKey } = splitRemoteMutationOptions(options, new Set());
  const result = await invokeRemoteMutation("createBudget", operationKey, () =>
    client.createBudget({
      operationKey,
      definitions: selectedDefinitions,
      amounts,
    }),
  );
  const budgetReference = requireBudgetReference(result.budget.budgetReference);
  return createRemoteBudgetHandle<BudgetName>(
    client,
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
