import { KeynesError } from "./generated/client.js";
import type {
  OperationName,
  ResourceDefinition as WireResourceDefinition,
} from "./generated/types.js";
import type { RuntimeResourceBinding } from "./generated/runtime.js";
import { captureRequest, isRecord } from "./request-serialization.js";
import { KeynesSdkError } from "./sdk-errors.js";

export type AccountingBehavior = "consumable" | "reusable";
export interface ResourceDefinition {
  readonly unit: string;
  readonly accountingBehavior: AccountingBehavior;
}
export type ResourceDefinitions = Readonly<Record<string, ResourceDefinition>>;
export type ResourceDefinitionsInput = Readonly<
  Record<string, { readonly unit: string; readonly accountingBehavior: string }>
>;

export function snapshotResourceDefinitions(
  definitions: unknown,
  operation: OperationName = "defineResources",
): unknown {
  return captureRequest(definitions, operation, "$.definitions");
}

export interface ResourceInstallationDefinition {
  readonly key: string;
  readonly canonicalName: string;
  readonly definition: WireResourceDefinition;
}

export function resourceInstallation(
  bindings: readonly RuntimeResourceBinding[],
): readonly ResourceInstallationDefinition[] {
  return bindings
    .map(({ key, canonicalName, unit, accountingBehavior }) => ({
      key,
      canonicalName,
      definition: { canonicalName, unit, accountingBehavior },
    }))
    .sort((left, right) =>
      compareStrings(left.canonicalName, right.canonicalName),
    );
}

export interface PreparedRootResource<Name extends string> {
  readonly key: Name;
  readonly canonicalName: string;
  readonly amount: unknown;
  readonly definition?: WireResourceDefinition;
}

export function prepareRootResources<Name extends string>(
  configured: readonly RuntimeResourceBinding[],
  suppliedAmounts: unknown,
): {
  readonly definitions: unknown;
  readonly amounts: unknown;
  readonly prepared: readonly PreparedRootResource<Name>[];
} {
  const amounts = captureRequest(suppliedAmounts, "createBudget", "$.amounts");
  if (!isRecord(amounts)) return { definitions: {}, amounts, prepared: [] };
  const byKey = new Map(
    resourceInstallation(configured).map((binding) => [binding.key, binding]),
  );
  const selected = Object.entries(amounts)
    .map(([key, amount]) => {
      const binding = byKey.get(key);
      if (binding === undefined)
        throw new KeynesSdkError("resource_not_defined", { resource: key });
      return { ...binding, key: key as Name, amount };
    })
    .sort((left, right) =>
      compareStrings(left.canonicalName, right.canonicalName),
    );
  return {
    definitions: Object.fromEntries(
      selected.map(({ key, definition }) => [
        key,
        {
          unit: definition.unit,
          accountingBehavior: definition.accountingBehavior,
        },
      ]),
    ),
    amounts,
    prepared: selected,
  };
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function requireRuntimeBindings(
  bindings: readonly RuntimeResourceBinding[],
  definitions: unknown,
): void {
  const mismatch = () =>
    new KeynesError({ kind: "error", code: "unknown", details: {} });
  if (
    !Array.isArray(bindings) ||
    bindings.length === 0 ||
    !isRecord(definitions) ||
    bindings.length !== Object.keys(definitions).length
  )
    throw mismatch();
  const keys = new Set<string>();
  const canonicalNames = new Set<string>();
  for (const binding of bindings) {
    if (
      !isRecord(binding) ||
      typeof binding.key !== "string" ||
      typeof binding.canonicalName !== "string" ||
      keys.has(binding.key) ||
      canonicalNames.has(binding.canonicalName) ||
      !Object.hasOwn(definitions, binding.key)
    )
      throw mismatch();
    const definition = definitions[binding.key];
    if (
      !isRecord(definition) ||
      typeof binding.unit !== "string" ||
      (binding.accountingBehavior !== "consumable" &&
        binding.accountingBehavior !== "reusable") ||
      binding.unit !== definition.unit ||
      binding.accountingBehavior !== definition.accountingBehavior
    )
      throw mismatch();
    keys.add(binding.key);
    canonicalNames.add(binding.canonicalName);
  }
}

export async function invokeResourceConfiguration<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch (error: unknown) {
    const details: unknown =
      error instanceof KeynesError ? error.details : undefined;
    if (
      error instanceof KeynesError &&
      error.code === "invalid_command" &&
      isRecord(details) &&
      Array.isArray(details.issues)
    ) {
      if (details.operation === "defineResources")
        Reflect.set(error, "details", {
          ...details,
          operation: "validateResources",
        });
      for (const issue of details.issues) {
        if (
          !isRecord(issue) ||
          issue.rule !== "maxLength" ||
          typeof issue.path !== "string"
        )
          continue;
        const match =
          /^\$\.definitions\.([^.]+)$/.exec(issue.path) ??
          /^\/definitions\/([^/]+)$/.exec(issue.path);
        if (match?.[1] !== undefined)
          throw new KeynesSdkError("invalid_resource_name", {
            resource: match[1],
          });
      }
    }
    throw error;
  }
}
