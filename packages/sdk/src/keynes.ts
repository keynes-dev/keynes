import { randomUUID } from "node:crypto";

import {
  attachedPolicyDefinitions,
  createBudgetHandle,
  type AttachPolicyArguments,
  type Budget,
  type ContextOfPolicySet,
  type ExactResourceAmounts,
  type PolicySetInput,
  type ReasonsOfPolicySet,
  type ResourceAmounts,
} from "./budget.js";
import type {
  CreateBudgetCommand,
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
  createOpenedRemoteResourceBinding,
  createRemoteBudgetHandle,
  createRemoteResourceBinding,
} from "./remote/budget.js";
import { normalizeDatabaseUrl } from "./remote/connection-options.js";
import { openPostgresqlCommandExecutor } from "./remote/postgresql-command-executor.js";
import type {
  RemoteBudget,
  RemoteAttachPolicyArguments,
} from "./remote/public-types.js";
import {
  projectRecoverOperationResult,
  requireBudgetReference,
  requireOperationKey,
  splitRemoteMutationOptions,
  type BudgetReference,
  type OperationKey,
  type RecoverOperationResult,
} from "./remote/references.js";
import { invokeRemoteMutation } from "./remote/retry.js";
import {
  prepareRootResources,
  resourceInstallation,
  rootResourceEnvelope,
  type ResourceDefinitions,
  type ResourceSchema,
} from "./resources.js";
import { KeynesSdkError } from "./sdk-errors.js";

const keynesBrand: unique symbol = Symbol("Keynes");

type ResourceNames<Definitions extends ResourceDefinitions> = Extract<
  keyof Definitions,
  string
>;

interface RootBudgetCreator {
  <
    const Definitions extends ResourceDefinitions,
    const Allocation extends ResourceAmounts<ResourceNames<Definitions>>,
    const Policies extends PolicySetInput | undefined = undefined,
  >(
    schema: ResourceSchema<Definitions>,
    allocation: ExactResourceAmounts<ResourceNames<Definitions>, Allocation>,
    ...options: AttachPolicyArguments<
      Extract<keyof Allocation, ResourceNames<Definitions>>,
      Policies
    >
  ): Promise<
    Budget<
      Extract<keyof Allocation, ResourceNames<Definitions>>,
      ContextOfPolicySet<Policies>,
      ReasonsOfPolicySet<Policies>
    >
  >;
}

export interface Keynes extends AsyncDisposable {
  readonly [keynesBrand]: undefined;
  readonly createBudget: RootBudgetCreator;
  readonly close: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}

export type LocalKeynes = Keynes;

export interface RemoteKeynesOptions {
  readonly databaseUrl: string;
}

interface RemoteRootBudgetCreator {
  <
    const Definitions extends ResourceDefinitions,
    const Allocation extends ResourceAmounts<ResourceNames<Definitions>>,
    const Policies extends PolicySetInput | undefined = undefined,
  >(
    schema: ResourceSchema<Definitions>,
    allocation: ExactResourceAmounts<ResourceNames<Definitions>, Allocation>,
    ...options: RemoteAttachPolicyArguments<
      Extract<keyof Allocation, ResourceNames<Definitions>>,
      Policies
    >
  ): Promise<
    RemoteBudget<
      Extract<keyof Allocation, ResourceNames<Definitions>>,
      ContextOfPolicySet<Policies>,
      ReasonsOfPolicySet<Policies>
    >
  >;
}

interface RemoteBudgetOpener {
  <const Definitions extends ResourceDefinitions>(options: {
    readonly reference: BudgetReference;
    readonly resourceTypes: ResourceSchema<Definitions>;
  }): Promise<RemoteBudget<Extract<keyof Definitions, string>>>;
}

export interface RemoteKeynes extends Omit<Keynes, "createBudget"> {
  readonly createBudget: RemoteRootBudgetCreator;
  readonly openBudget: RemoteBudgetOpener;
  readonly recoverOperation: (
    operationKey: OperationKey,
  ) => Promise<RecoverOperationResult>;
}

export function createKeynes(): Promise<LocalKeynes>;
export function createKeynes(
  options: RemoteKeynesOptions,
): Promise<RemoteKeynes>;
export async function createKeynes(
  ...arguments_: readonly unknown[]
): Promise<LocalKeynes | RemoteKeynes> {
  if (arguments_.length === 0) {
    const runtime = await openConfiguredRuntime();
    return createKeynesHandle(runtime);
  }
  const options = arguments_[0];
  if (
    arguments_.length !== 1 ||
    !isRecord(options) ||
    Object.keys(options).length !== 1 ||
    typeof options.databaseUrl !== "string"
  ) {
    throw new KeynesSdkError("invalid_configuration", {
      field: "options",
      reason: "unsupported",
    });
  }
  const poolConfig = normalizeDatabaseUrl(options.databaseUrl);
  const executor = await openPostgresqlCommandExecutor(poolConfig);
  const client = createRemoteKeynesClient(executor);
  const createBudget: RemoteRootBudgetCreator = (
    schema,
    allocation,
    ...createOptions
  ) => createRemoteRootBudget(client, schema, allocation, ...createOptions);
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
  const close = (): Promise<void> => executor.close();
  return Object.freeze({
    [keynesBrand]: undefined,
    createBudget,
    openBudget,
    recoverOperation,
    close,
    [Symbol.asyncDispose]: close,
  });
}

function createKeynesHandle(runtime: LocalRuntime): LocalKeynes {
  const createBudget: RootBudgetCreator = (schema, allocation, ...options) =>
    createRootBudget(runtime, schema, allocation, ...options);
  const close = (): Promise<void> => closeRuntime(runtime);
  return Object.freeze({
    [keynesBrand]: undefined,
    createBudget,
    close,
    [Symbol.asyncDispose]: close,
  });
}

function createRootBudget<
  const Definitions extends ResourceDefinitions,
  const Allocation extends ResourceAmounts<ResourceNames<Definitions>>,
  const Policies extends PolicySetInput | undefined = undefined,
>(
  runtime: LocalRuntime,
  schema: ResourceSchema<Definitions>,
  allocation: ExactResourceAmounts<ResourceNames<Definitions>, Allocation>,
  ...options: AttachPolicyArguments<
    Extract<keyof Allocation, ResourceNames<Definitions>>,
    Policies
  >
): Promise<
  Budget<
    Extract<keyof Allocation, ResourceNames<Definitions>>,
    ContextOfPolicySet<Policies>,
    ReasonsOfPolicySet<Policies>
  >
> {
  type BudgetName = Extract<keyof Allocation, ResourceNames<Definitions>>;
  const resources = prepareRootResources<Definitions, BudgetName>(
    schema,
    allocation,
  );
  const policies = attachedPolicyDefinitions(options);
  return admit(runtime, async () => {
    const command: CreateBudgetCommand = {
      commandId: randomUUID(),
      resources: rootResourceEnvelope(resources),
      ...(policies === undefined ? {} : { policies }),
    };
    const result = await invokeMutation(() =>
      runtime.client.createBudget(command),
    );
    const binding = createResourceBinding(resources, result.budget);
    return createBudgetHandle<
      BudgetName,
      ContextOfPolicySet<Policies>,
      ReasonsOfPolicySet<Policies>
    >(runtime, result.budget.budgetId, binding);
  });
}

async function createRemoteRootBudget<
  const Definitions extends ResourceDefinitions,
  const Allocation extends ResourceAmounts<ResourceNames<Definitions>>,
  const Policies extends PolicySetInput | undefined = undefined,
>(
  client: ReturnType<typeof createRemoteKeynesClient>,
  schema: ResourceSchema<Definitions>,
  allocation: ExactResourceAmounts<ResourceNames<Definitions>, Allocation>,
  ...options: RemoteAttachPolicyArguments<
    Extract<keyof Allocation, ResourceNames<Definitions>>,
    Policies
  >
): Promise<
  RemoteBudget<
    Extract<keyof Allocation, ResourceNames<Definitions>>,
    ContextOfPolicySet<Policies>,
    ReasonsOfPolicySet<Policies>
  >
> {
  type BudgetName = Extract<keyof Allocation, ResourceNames<Definitions>>;
  const resources = prepareRootResources<Definitions, BudgetName>(
    schema,
    allocation,
  );
  const { operationKey, remainingOptions } = splitRemoteMutationOptions(
    options,
    new Set(["policies"]),
  );
  const policies = attachedPolicyDefinitions(remainingOptions);
  const result = await invokeRemoteMutation("createBudget", operationKey, () =>
    client.createBudget({
      operationKey,
      resources: rootResourceEnvelope(resources),
      ...(policies === undefined ? {} : { policies }),
    }),
  );
  const budgetReference = requireBudgetReference(result.budget.budgetReference);
  return createRemoteBudgetHandle<
    BudgetName,
    ContextOfPolicySet<Policies>,
    ReasonsOfPolicySet<Policies>
  >(
    client,
    {
      budgetReference,
      parentBudgetReference: null,
      rootBudgetReference: budgetReference,
      depth: 0,
    },
    createRemoteResourceBinding(resources, result.budget),
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
