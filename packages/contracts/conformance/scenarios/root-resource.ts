import type {
  ResourceTypeProjection,
  RootResourceInput,
} from "../../generated/types.ts";

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
