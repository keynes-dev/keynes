import { POLICY_CANONICAL_VECTORS } from "../../generated/policy-profile.ts";

import { evaluationCases, mutationCases, sourceCases } from "./source-cases.ts";
import { POLICY_RUNTIME_TEST_CASES } from "./runtime-cases.ts";
import type { PolicyTestCase } from "./types.ts";

export type {
  PolicyTestCase,
  PolicyTestCategory,
  PolicyRuntimeTestCase,
} from "./types.ts";
export { POLICY_RUNTIME_TEST_CASES } from "./runtime-cases.ts";

const canonicalVectorCases: readonly PolicyTestCase[] = Object.entries(
  POLICY_CANONICAL_VECTORS,
).flatMap(([kind, vectors]) =>
  vectors.map((vector) => ({
    name: `canonical vector: ${kind}: ${vector.name}`,
    category: "canonical_vector" as const,
    expected: vector.expected,
  })),
);

export const POLICY_TEST_CASES: readonly PolicyTestCase[] = Object.freeze([
  ...canonicalVectorCases,
  ...sourceCases,
  ...evaluationCases,
  ...POLICY_RUNTIME_TEST_CASES,
  ...mutationCases,
]);
