import { randomBytes } from "node:crypto";

import type {
  RecoverOperationResult as WireRecoverOperationResult,
  RemoteBudgetProjection as WireRemoteBudgetProjection,
  RemoteCreateBudgetResult as WireRemoteCreateBudgetResult,
  RemoteDefinitiveErrorEnvelope,
  RemoteRequestBudgetResult as WireRemoteRequestBudgetResult,
  RemoteSettleBudgetResult as WireRemoteSettleBudgetResult,
} from "../generated/types.js";
import { KeynesSdkError } from "../sdk-errors.js";
import { canonicalDecisionEvidence } from "../decision-evidence.js";
import type { DecisionEvidence } from "../decision-evidence.js";

import {
  createResourceDefinitionBinding,
  type ResourceBinding,
} from "../resource-definition-binding.js";

declare const operationKeyBrand: unique symbol;
declare const budgetReferenceBrand: unique symbol;

export type OperationKey = string & {
  readonly [operationKeyBrand]: "OperationKey";
};

export type BudgetReference = string & {
  readonly [budgetReferenceBrand]: "BudgetReference";
};

export interface RemoteOperationOptions {
  readonly operationKey?: OperationKey;
}

type RemoteBudgetProjection = Omit<
  WireRemoteBudgetProjection,
  "budgetReference" | "parentBudgetReference" | "rootBudgetReference"
> & {
  readonly budgetReference: BudgetReference;
  readonly parentBudgetReference: BudgetReference | null;
  readonly rootBudgetReference: BudgetReference;
};

type RemoteCreateBudgetResult = Omit<WireRemoteCreateBudgetResult, "budget"> & {
  readonly budget: RemoteBudgetProjection;
};

type RemoteRequestBudgetResult =
  WireRemoteRequestBudgetResult extends infer Result
    ? Result extends {
        readonly parentBudgetReference: string;
        readonly childBudgetReference?: string;
      }
      ? Omit<
          Result,
          "parentBudgetReference" | "childBudgetReference" | "decisionEvidence"
        > & {
          readonly parentBudgetReference: BudgetReference;
          readonly decisionEvidence?: DecisionEvidence;
        } & (Result extends { readonly childBudgetReference: string }
            ? { readonly childBudgetReference: BudgetReference }
            : object)
      : never
    : never;

type RemoteSettleBudgetResult = Omit<WireRemoteSettleBudgetResult, "budget"> & {
  readonly budget: RemoteBudgetProjection;
};

export type RecoverOperationResult =
  | {
      readonly kind: "committed";
      readonly operationKey: OperationKey;
      readonly operation: "defineResources";
      readonly result: ResourceBinding<string>;
    }
  | {
      readonly kind: "committed";
      readonly operationKey: OperationKey;
      readonly operation: "createBudget";
      readonly result: RemoteCreateBudgetResult;
    }
  | {
      readonly kind: "committed";
      readonly operationKey: OperationKey;
      readonly operation: "requestBudget";
      readonly result: RemoteRequestBudgetResult;
    }
  | {
      readonly kind: "committed";
      readonly operationKey: OperationKey;
      readonly operation: "settleBudget";
      readonly result: RemoteSettleBudgetResult;
    }
  | {
      readonly kind: "known_failure";
      readonly operationKey: OperationKey;
      readonly error: RemoteDefinitiveErrorEnvelope;
    }
  | {
      readonly kind: "unresolved";
      readonly operationKey: OperationKey;
      readonly retryAfterMilliseconds?: number;
    }
  | {
      readonly kind: "expired";
      readonly operationKey: OperationKey;
    };

const OPERATION_KEY = /^kop_v1_[A-Za-z0-9_-]{43}$/u;
const BUDGET_REFERENCE = /^kbr_v1_[A-Za-z0-9_-]{43}$/u;

export function createOperationKey(): OperationKey {
  return `kop_v1_${randomBytes(32).toString("base64url")}` as OperationKey;
}

export function projectRecoverOperationResult(
  result: WireRecoverOperationResult,
): RecoverOperationResult {
  const operationKey = requireOperationKey(result.operationKey);
  if (result.kind !== "committed") return { ...result, operationKey };
  switch (result.operation) {
    case "defineResources":
      return {
        kind: "committed",
        operationKey,
        operation: "defineResources",
        result: createResourceDefinitionBinding(),
      };
    case "createBudget":
      return {
        ...result,
        operationKey,
        result: {
          ...result.result,
          budget: projectBudget(result.result.budget),
        },
      };
    case "requestBudget": {
      if (result.result.kind === "approved") {
        const { decisionEvidence: rawDecisionEvidence, ...requestResult } =
          result.result;
        const decisionEvidence = canonicalDecisionEvidence(rawDecisionEvidence);
        return {
          ...result,
          operationKey,
          result: {
            ...requestResult,
            parentBudgetReference: requireBudgetReference(
              result.result.parentBudgetReference,
            ),
            childBudgetReference: requireBudgetReference(
              result.result.childBudgetReference,
            ),
            ...(decisionEvidence === undefined ? {} : { decisionEvidence }),
          },
        };
      }
      const { decisionEvidence: rawDecisionEvidence, ...requestResult } =
        result.result;
      const decisionEvidence = canonicalDecisionEvidence(rawDecisionEvidence);
      return {
        ...result,
        operationKey,
        result: {
          ...requestResult,
          parentBudgetReference: requireBudgetReference(
            result.result.parentBudgetReference,
          ),
          ...(decisionEvidence === undefined ? {} : { decisionEvidence }),
        },
      };
    }
    case "settleBudget":
      return {
        ...result,
        operationKey,
        result: {
          ...result.result,
          budget: projectBudget(result.result.budget),
        },
      };
  }
}

export function requireOperationKey(value: unknown): OperationKey {
  if (typeof value !== "string" || !OPERATION_KEY.test(value)) {
    throw invalidConfiguration("operationKey");
  }
  return value as OperationKey;
}

export function requireBudgetReference(value: unknown): BudgetReference {
  if (typeof value !== "string" || !BUDGET_REFERENCE.test(value)) {
    throw invalidConfiguration("reference");
  }
  return value as BudgetReference;
}

export function splitRemoteMutationOptions(
  options: readonly unknown[],
  allowedFields: ReadonlySet<string>,
): {
  readonly operationKey: OperationKey;
  readonly remainingOptions: readonly unknown[];
} {
  if (options.length === 0) {
    return { operationKey: createOperationKey(), remainingOptions: [] };
  }
  const option = options[0];
  if (
    options.length !== 1 ||
    !isRecord(option) ||
    (Object.getPrototypeOf(option) !== Object.prototype &&
      Object.getPrototypeOf(option) !== null)
  ) {
    throw invalidConfiguration("options");
  }
  if (Object.getOwnPropertySymbols(option).length > 0) {
    throw invalidConfiguration("options");
  }
  const fields = Object.getOwnPropertyNames(option);
  const unknownField = fields.find(
    (field) => field !== "operationKey" && !allowedFields.has(field),
  );
  if (unknownField !== undefined) throw invalidConfiguration(unknownField);
  for (const field of fields) {
    if (field === "operationKey") continue;
    const descriptor = Object.getOwnPropertyDescriptor(option, field);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      throw invalidConfiguration(field);
    }
  }

  const operationKey = Object.hasOwn(option, "operationKey")
    ? requireOperationKey(option.operationKey)
    : createOperationKey();
  const remaining: Record<string, unknown> = {};
  for (const field of fields) {
    if (field !== "operationKey") remaining[field] = option[field];
  }
  return {
    operationKey,
    remainingOptions:
      Object.keys(remaining).length === 0 ? [] : [Object.freeze(remaining)],
  };
}

function projectBudget(
  budget: WireRemoteBudgetProjection,
): RemoteBudgetProjection {
  return {
    ...budget,
    budgetReference: requireBudgetReference(budget.budgetReference),
    parentBudgetReference:
      budget.parentBudgetReference === null
        ? null
        : requireBudgetReference(budget.parentBudgetReference),
    rootBudgetReference: requireBudgetReference(budget.rootBudgetReference),
  };
}

function invalidConfiguration(
  field: string,
): KeynesSdkError<"invalid_configuration"> {
  return new KeynesSdkError("invalid_configuration", {
    field,
    reason: "unsupported",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
