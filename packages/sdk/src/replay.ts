import type { PolicyDefinitionV1 } from "./generated/types.js";

export class CommittedResponseLostError extends Error {
  constructor() {
    super("Response lost after committed procedure call");
    this.name = "CommittedResponseLostError";
  }
}

export function canonicalPolicyDefinitionsForReplay(
  policies: readonly PolicyDefinitionV1[],
): PolicyDefinitionV1[] {
  return policies
    .map((policy) => ({
      ...policy,
      inputResources: sortedNonEmpty(policy.inputResources),
      outputResources: sortedNonEmpty(policy.outputResources),
      contextSchema: [...policy.contextSchema].sort(
        (left, right) =>
          compareStrings(left.name, right.name) ||
          compareStrings(left.type, right.type) ||
          Number(left.nullable) - Number(right.nullable),
      ),
      reasons: sortedNonEmpty(policy.reasons),
    }))
    .sort(
      (left, right) =>
        compareStrings(left.name, right.name) ||
        left.revision - right.revision ||
        compareStrings(left.definitionDigest, right.definitionDigest),
    );
}

function sortedNonEmpty<Value extends string>(
  values: readonly [Value, ...Value[]],
): [Value, ...Value[]] {
  const ordered = [...values].sort(compareStrings);
  const first = ordered[0];
  return [first, ...ordered.slice(1)];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
