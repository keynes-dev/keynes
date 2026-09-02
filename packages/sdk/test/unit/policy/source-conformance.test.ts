import { describe, expect, it } from "vitest";

import {
  POLICY_CONFORMANCE_CASES,
  type PolicyConformanceCase,
} from "@keynes/contracts/conformance";

import {
  definePolicySql,
  defineResources,
  policyValue,
} from "../../../src/index.js";
import { evaluatePolicyProgram } from "../../../src/policy/evaluate.js";

const resources = defineResources({
  modelTokens: { unit: "token", accountingBehavior: "consumable" },
});
const modelTokenInput = ["modelTokens"] satisfies readonly ["modelTokens"];

const sourceCases = POLICY_CONFORMANCE_CASES.filter(
  (testCase) => testCase.source !== undefined,
);

describe("Policy source conformance", () => {
  it("normalizes every accepted source fixture through the public authoring boundary", () => {
    const canonicalSqlByGroup = new Map<string, string>();

    for (const testCase of sourceCases) {
      if (isInvalidPolicyCase(testCase)) continue;

      let definition;
      try {
        definition = definePolicySql(resources, {
          ...declaration(),
          sql: sourceFor(testCase),
          parameters: testCase.parameters,
        });
      } catch (error: unknown) {
        throw new Error(`Accepted source fixture failed: ${testCase.name}`, {
          cause: error,
        });
      }
      expect(definition.program.kind, testCase.name).toBe("select");

      const canonicalGroup = acceptedCanonicalGroup(testCase);
      if (canonicalGroup !== undefined) {
        const previous = canonicalSqlByGroup.get(canonicalGroup);
        if (previous === undefined) {
          canonicalSqlByGroup.set(canonicalGroup, definition.canonicalSql);
        } else {
          expect(definition.canonicalSql, testCase.name).toBe(previous);
        }
      }

      if (testCase.evaluationInput !== undefined) {
        expect(
          evaluatePolicyProgram(definition.program, {
            ...testCase.evaluationInput,
            outputResources: ["model_tokens"],
            reasons: declaration().reasons,
          }),
          testCase.name,
        ).toEqual(expectedRows(testCase));
      }
    }
  });

  it("rejects every disallowed source fixture through the public authoring boundary", () => {
    for (const testCase of sourceCases) {
      if (!isInvalidPolicyCase(testCase)) continue;

      expect(
        () =>
          definePolicySql(resources, {
            ...declaration(),
            sql: sourceFor(testCase),
            parameters: testCase.parameters,
          }),
        testCase.name,
      ).toThrowError(
        expect.objectContaining({
          name: "PolicyValidationError",
          code: "invalid_policy",
          rule: testCase.expected.rule,
        }),
      );
    }
  });
});

function declaration() {
  return {
    name: "source_conformance",
    revision: 1,
    inputs: modelTokenInput,
    outputs: modelTokenInput,
    context: { customerTier: policyValue.text() },
    reasons: [
      "request_limit",
      "capacity_limit",
      "not_equal",
      "tier_limit",
      "shared_limit",
      "aggregate_limit",
      "test_limit",
      "random_limit",
      "row_limit",
      "parameter_limit",
    ],
  };
}

function sourceFor(testCase: PolicyConformanceCase): string {
  if (testCase.source === undefined) {
    throw new Error(
      `Source conformance fixture has no source: ${testCase.name}`,
    );
  }
  return testCase.source;
}

function acceptedCanonicalGroup(
  testCase: PolicyConformanceCase,
): string | undefined {
  if (!isRecord(testCase.expected)) return undefined;
  return testCase.expected.outcome === "accepted" &&
    typeof testCase.expected.canonicalGroup === "string"
    ? testCase.expected.canonicalGroup
    : undefined;
}

function isInvalidPolicyCase(
  testCase: PolicyConformanceCase,
): testCase is PolicyConformanceCase & {
  readonly expected: {
    readonly outcome: "invalid_policy";
    readonly rule: string;
  };
} {
  return (
    isRecord(testCase.expected) &&
    testCase.expected.outcome === "invalid_policy" &&
    typeof testCase.expected.rule === "string"
  );
}

function expectedRows(testCase: PolicyConformanceCase): unknown {
  if (
    !isRecord(testCase.expected) ||
    testCase.expected.outcome !== "rows" ||
    !Array.isArray(testCase.expected.rows)
  ) {
    throw new Error(`Source fixture has no row expectation: ${testCase.name}`);
  }
  return testCase.expected.rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
