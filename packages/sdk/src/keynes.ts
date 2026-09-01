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
import {
  admit,
  closeRuntime,
  invokeMutation,
  type LocalRuntime,
  openConfiguredRuntime,
} from "./local/runtime.js";
import type { ResourceDefinitions, ResourceSchema } from "./resources.js";
import { KeynesSdkError } from "./sdk-errors.js";

declare const keynesBrand: unique symbol;

export interface Keynes<Names extends string> extends AsyncDisposable {
  readonly [keynesBrand]: void;
  readonly createBudget: <
    const Resources extends ResourceAmounts<Names>,
    const Policies extends PolicySetInput | undefined = undefined,
  >(
    resources: ExactResourceAmounts<Names, Resources>,
    ...options: AttachPolicyArguments<Extract<keyof Resources, Names>, Policies>
  ) => Promise<
    Budget<
      Extract<keyof Resources, Names>,
      ContextOfPolicySet<Policies>,
      ReasonsOfPolicySet<Policies>
    >
  >;
  readonly close: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}

export function createKeynes<
  const Schema extends ResourceSchema<ResourceDefinitions>,
>(options: {
  readonly resources: Schema;
}): Promise<Keynes<Extract<keyof Schema["definitions"], string>>>;
export async function createKeynes(options: unknown): Promise<Keynes<string>> {
  const resources = requireCreateOptions(options);
  const runtime = await openConfiguredRuntime(resources);
  return createKeynesHandle(runtime);
}

function createKeynesHandle<Names extends string>(
  runtime: LocalRuntime,
): Keynes<Names> {
  const createBudget: Keynes<Names>["createBudget"] = (resources, ...options) =>
    createRootBudget(runtime, resources, ...options);
  const close = (): Promise<void> => closeRuntime(runtime);
  const handle = Object.freeze({
    createBudget,
    close,
    [Symbol.asyncDispose]: close,
  });
  return handle as Keynes<Names>;
}

function createRootBudget<
  Names extends string,
  const Resources extends ResourceAmounts<Names>,
  const Policies extends PolicySetInput | undefined = undefined,
>(
  runtime: LocalRuntime,
  resources: ExactResourceAmounts<Names, Resources>,
  ...options: AttachPolicyArguments<Extract<keyof Resources, Names>, Policies>
): Promise<
  Budget<
    Extract<keyof Resources, Names>,
    ContextOfPolicySet<Policies>,
    ReasonsOfPolicySet<Policies>
  >
> {
  type BudgetName = Extract<keyof Resources, Names>;
  const policies = attachedPolicyDefinitions(options);
  return admit(runtime, async () => {
    const resolved = runtime.resources.resources<BudgetName>(
      resources,
      "createBudget",
    );
    const command: CreateBudgetCommand = {
      commandId: randomUUID(),
      resources: resolved,
      ...(policies === undefined ? {} : { policies }),
    };
    const result = await invokeMutation(() =>
      runtime.client.createBudget(command),
    );
    return createBudgetHandle<
      BudgetName,
      ContextOfPolicySet<Policies>,
      ReasonsOfPolicySet<Policies>
    >(runtime, result.budget.budgetId);
  });
}

type PolicySetInput = {
  readonly definitions: readonly PolicyDefinition<string, unknown, string>[];
  readonly contextSchemaDigest: string | null;
  readonly setDigest: string;
};

function requireCreateOptions(value: unknown): ResourceSchema {
  if (!isRecord(value)) {
    throw invalidConfiguration("options", "missing");
  }
  const unknownField = Object.keys(value).find(
    (field) => field !== "resources",
  );
  if (unknownField !== undefined) {
    throw invalidConfiguration(unknownField, "unknown");
  }
  if (!("resources" in value)) {
    throw invalidConfiguration("resources", "missing");
  }
  return value.resources as ResourceSchema;
}

function invalidConfiguration(
  field: string,
  reason: "missing" | "unknown" | "unsupported",
): KeynesSdkError<"invalid_configuration"> {
  return new KeynesSdkError("invalid_configuration", { field, reason });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
