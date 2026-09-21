import { describe, expect, it } from "vitest";

import {
  validateErrorEnvelope,
  validateGetBudgetHistoryPageResult,
  validateRecoverOperationResult,
  validateRemoteErrorEnvelope,
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

  it("enforces bounded history-page replies", () => {
    const budgetReference = `kbr_v1_${"b".repeat(43)}`;
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
