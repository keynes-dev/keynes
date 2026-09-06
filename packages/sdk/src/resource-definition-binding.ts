import type { DefineResourcesResult } from "./generated/types.js";

declare const resourceBindingBrand: unique symbol;

export interface ResourceBinding<Names extends string> {
  readonly [resourceBindingBrand]: Names;
}

interface BindingState {
  readonly bindingReference: string;
  readonly keys: readonly string[];
}

const bindings = new WeakMap<object, BindingState>();

export function createResourceDefinitionBinding<Names extends string>(
  result: Pick<DefineResourcesResult, "bindingReference" | "resources">,
): ResourceBinding<Names> {
  const binding = Object.freeze({}) as ResourceBinding<Names>;
  bindings.set(
    binding,
    Object.freeze({
      bindingReference: result.bindingReference,
      keys: Object.freeze(result.resources.map(({ key }) => key)),
    }),
  );
  return binding;
}

export function lookupResourceDefinitionBinding(
  value: unknown,
): BindingState | undefined {
  return typeof value === "object" && value !== null
    ? bindings.get(value)
    : undefined;
}
