import type { DecisionEvidence } from "../../generated/types.js";

export function canonicalDecisionEvidence(
  evidence: DecisionEvidence | undefined,
): DecisionEvidence | undefined {
  if (evidence === undefined || Object.keys(evidence).length === 0)
    return undefined;
  return Object.freeze(
    Object.fromEntries(
      Object.entries(evidence)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, value]) => [key, Object.is(value, -0) ? 0 : value]),
    ),
  );
}
