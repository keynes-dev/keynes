import { describe, expect, it } from "vitest";

import {
  validateErrorEnvelope,
  validateGetBudgetHistoryPageResult,
  validateOpenBudgetQueryIssues,
  validateRecoverOperationResult,
  validateRemoteErrorEnvelope,
  validateRemoteRequestBudgetCommandIssues,
} from "../../../src/generated/validators.js";

describe("generated remote validators", () => {
  it("keeps remote errors safe and disjoint from shared errors", () => {
    const operationKey = `kop_v1_${"a".repeat(43)}`;
    const privateId = "00000000-0000-4000-8000-000000000001";
    const remoteInvalidCommand = {
      kind: "error",
      code: "invalid_command",
      details: {
        operation: "openBudget",
        issues: [{ path: "/expectedResources", rule: "maxItems" }],
      },
    };
    const leakedSharedFailure = {
      kind: "error",
      code: "budget_not_found",
      details: { budgetId: privateId },
    };

    expect(validateRemoteErrorEnvelope(remoteInvalidCommand)).toBe(true);
    expect(validateErrorEnvelope(remoteInvalidCommand)).toBe(false);
    expect(validateRemoteErrorEnvelope(leakedSharedFailure)).toBe(false);
    expect(
      validateRecoverOperationResult({
        kind: "known_failure",
        operationKey,
        error: leakedSharedFailure,
      }),
    ).toBe(false);
    expect(
      validateRemoteErrorEnvelope({
        kind: "error",
        code: "budget_not_found",
        details: {},
      }),
    ).toBe(true);
    expect(
      validateRemoteErrorEnvelope({
        kind: "error",
        code: "limit_exceeded",
        details: { limit: "history_page", maximum: 256 },
      }),
    ).toBe(true);
  });

  it("correlates committed recovery results with their mutation", () => {
    const operationKey = `kop_v1_${"a".repeat(43)}`;
    const budgetReference = `kbr_v1_${"b".repeat(43)}`;
    const budget = {
      budgetReference,
      parentBudgetReference: null,
      rootBudgetReference: budgetReference,
      depth: 0,
      lifecycle: "settled",
      resources: [
        {
          resource: {
            canonicalName: "model_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
          allocated: 100,
          available: 90,
          committed: 0,
          directUsage: 10,
          subtreeObservedUsage: 10,
          unresolved: false,
          deficit: 0,
        },
      ],
    };

    expect(
      validateRecoverOperationResult({
        kind: "committed",
        operationKey,
        operation: "createBudget",
        result: {
          kind: "settled",
          budget,
          newlyKnown: [{ resource: "model_tokens", amount: 10 }],
          unresolvedResources: [],
          replayed: false,
        },
      }),
    ).toBe(false);
  });

  it("enforces bounded remote inputs and history pages", () => {
    const operationKey = `kop_v1_${"a".repeat(43)}`;
    const budgetReference = `kbr_v1_${"b".repeat(43)}`;
    const request = {
      operationKey,
      parentBudgetReference: budgetReference,
      resources: [{ resource: "model_tokens", amount: 1 }],
    };
    const definitions = Array.from({ length: 65 }, (_, index) => ({
      canonicalName: `resource_${index}`,
      unit: "token",
      accountingBehavior: "consumable",
    }));

    expect(
      validateOpenBudgetQueryIssues({
        budgetReference,
        expectedResources: definitions,
      }),
    ).toContainEqual({ path: "/expectedResources", rule: "maxItems" });
    expect(
      validateRemoteRequestBudgetCommandIssues({
        ...request,
        context: { Invalid: true },
      }),
    ).toContainEqual({ path: "/context/Invalid", rule: "propertyNames" });
    expect(
      validateRemoteRequestBudgetCommandIssues({
        ...request,
        context: Object.fromEntries(
          Array.from({ length: 33 }, (_, index) => [`field_${index}`, true]),
        ),
      }),
    ).toContainEqual({ path: "/context", rule: "maxProperties" });
    expect(
      validateRemoteRequestBudgetCommandIssues({
        ...request,
        context: { label: "é".repeat(129) },
      }),
    ).not.toHaveLength(0);
    expect(
      validateRemoteRequestBudgetCommandIssues({
        ...request,
        context: Object.fromEntries(
          Array.from({ length: 32 }, (_, index) => [
            `field_${index}`,
            "x".repeat(256),
          ]),
        ),
      }),
    ).toContainEqual({ path: "/context", rule: "maxCanonicalUtf8Bytes" });

    const entry = {
      kind: "budget_created",
      sequence: 1,
      resources: [{ resource: "model_tokens", amount: 1 }],
    };
    expect(
      validateGetBudgetHistoryPageResult({
        budgetReference,
        entries: Array.from({ length: 257 }, () => entry),
        nextCursor: null,
      }),
    ).toBe(false);
  });
});
