import { POLICY_CANONICAL_VECTORS } from "../../generated/policy-profile.ts";

import { evaluationCases, mutationCases, sourceCases } from "./source-cases.ts";
import { POLICY_RUNTIME_CONFORMANCE_CASES } from "./runtime-cases.ts";
import type { PolicyConformanceCase } from "./types.ts";

export type {
  PolicyConformanceCase,
  PolicyConformanceCategory,
  PolicyRuntimeConformanceCase,
} from "./types.ts";
export { POLICY_RUNTIME_CONFORMANCE_CASES } from "./runtime-cases.ts";

const canonicalVectorCases: readonly PolicyConformanceCase[] = Object.entries(
  POLICY_CANONICAL_VECTORS,
).flatMap(([kind, vectors]) =>
  vectors.map((vector) => ({
    name: `canonical vector: ${kind}: ${vector.name}`,
    category: "canonical_vector" as const,
    input: vector.input,
    expected: vector.expected,
  })),
);

export const POLICY_CONFORMANCE_CASES: readonly PolicyConformanceCase[] =
  Object.freeze([
    ...canonicalVectorCases,
    ...sourceCases,
    ...evaluationCases,
    ...POLICY_RUNTIME_CONFORMANCE_CASES,
    ...mutationCases,
  ]);
