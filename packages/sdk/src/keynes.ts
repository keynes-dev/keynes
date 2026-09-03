import { randomUUID } from "node:crypto";

import {
  attachedPolicyDefinitions,
  createBudgetHandle,
  type AttachPolicyArguments,
  type Budget,
  type ContextOfPolicySet,
  type ExactResourceAmounts,
  type PolicyDefinition,
  type ReasonsOfPolicySet,
  type ResourceAmounts,
} from "./budget.js";
import type { CreateBudgetCommand } from "./generated/types.js";
import { createRemoteKeynesClient } from "./generated/client.js";
import {
  admit,
  closeRuntime,
  invokeMutation,
  type LocalRuntime,
  openConfiguredRuntime,
} from "./local/runtime.js";
import { createResourceBinding } from "./resource-binding.js";
import {
  createInternalOperationKey,
  createRemoteBudgetHandle,
  createRemoteResourceBinding,
} from "./remote/budget.js";
import { normalizeDatabaseUrl } from "./remote/connection-options.js";
import { openPostgresqlCommandExecutor } from "./remote/postgresql-command-executor.js";
import {
  prepareRootResources,
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

export type RemoteKeynes = Keynes;

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
  const createBudget: RootBudgetCreator = (
    schema,
    allocation,
    ...createOptions
  ) => createRemoteRootBudget(client, schema, allocation, ...createOptions);
  const close = (): Promise<void> => executor.close();
  return Object.freeze({
    [keynesBrand]: undefined,
    createBudget,
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

type PolicySetInput = {
  readonly definitions: readonly PolicyDefinition<string, unknown, string>[];
  readonly contextSchemaDigest: string | null;
  readonly setDigest: string;
};

async function createRemoteRootBudget<
  const Definitions extends ResourceDefinitions,
  const Allocation extends ResourceAmounts<ResourceNames<Definitions>>,
  const Policies extends PolicySetInput | undefined = undefined,
>(
  client: ReturnType<typeof createRemoteKeynesClient>,
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
  const result = await client.createBudget({
    operationKey: createInternalOperationKey(),
    resources: rootResourceEnvelope(resources),
    ...(policies === undefined ? {} : { policies }),
  });
  return createRemoteBudgetHandle<
    BudgetName,
    ContextOfPolicySet<Policies>,
    ReasonsOfPolicySet<Policies>
  >(
    client,
    {
      budgetReference: result.budget.budgetReference,
      parentBudgetReference: null,
      rootBudgetReference: result.budget.budgetReference,
      depth: 0,
    },
    createRemoteResourceBinding(resources, result.budget),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
