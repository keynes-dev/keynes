import type {
  CreateBudgetCommand,
  ResourceTypeProjection,
  RootResourceInput,
} from "../../generated/types.ts";

export function rootResources(
  resources: readonly RootResourceInput[],
): Pick<CreateBudgetCommand, "definitions" | "amounts"> {
  const named = resources.map(({ definition, amount }) => ({
    key: definition.canonicalName.replaceAll(
      /_([a-z0-9])/g,
      (_match, letter: string) => letter.toUpperCase(),
    ),
    definition: {
      unit: definition.unit,
      accountingBehavior: definition.accountingBehavior,
    },
    amount,
  }));
  return {
    definitions: Object.fromEntries(
      named.map(({ key, definition }) => [key, definition]),
    ),
    amounts: Object.fromEntries(named.map(({ key, amount }) => [key, amount])),
  };
}

export function rootResource(
  resource: ResourceTypeProjection,
  amount: number,
): RootResourceInput {
  return {
    definition: {
      canonicalName: resource.canonicalName,
      unit: resource.unit,
      accountingBehavior: resource.accountingBehavior,
    },
    amount,
  };
}
