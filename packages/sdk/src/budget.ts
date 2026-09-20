import { randomUUID } from "node:crypto";

import type {
  RequestBudgetCommand,
  SettleBudgetCommand,
} from "./generated/types.js";
import { admit, invokeMutation, type LocalRuntime } from "./local/runtime.js";
import {
  compareDenialReasons,
  invokeBudgetOperation,
  projectDenialReason,
  projectSettlement,
  projectSnapshot,
} from "./budget-projection.js";
import {
  canonicalDecisionEvidence,
  requestDecisionEvidence,
  type BudgetRequestOptions,
  type DecisionEvidence,
} from "./decision-evidence.js";
import type { BudgetResourceBinding } from "./resource-binding.js";

export const budgetBrand: unique symbol = Symbol("Budget");

export type ResourceAmounts<Names extends string = string> = Readonly<
  Partial<Record<Names, number>>
>;

export type ResourceUsage<Names extends string = string> = Readonly<
  Partial<Record<Names, number | null>>
>;

export interface BudgetRequestAvailabilityReason<Name extends string = string> {
  readonly code: "insufficient_available";
  readonly resource: Name;
  readonly requested: number;
  readonly available: number;
}

export type BudgetRequestDenialReason<Name extends string = string> =
  BudgetRequestAvailabilityReason<Name>;

export type BudgetRequestResult<
  Names extends string = string,
  HistoryNames extends string = Names,
> =
  | {
      readonly status: "approved";
      readonly budget: Budget<Names, HistoryNames>;
      readonly decisionEvidence?: DecisionEvidence;
    }
  | {
      readonly status: "denied";
      readonly reasons: readonly BudgetRequestDenialReason<Names>[];
      readonly decisionEvidence?: DecisionEvidence;
    };

export interface BudgetResourceSnapshot<Name extends string = string> {
  readonly resource: Name;
  readonly unit: string;
  readonly accountingBehavior: "consumable" | "reusable";
  readonly allocated: number;
  readonly available: number;
  readonly committed: number;
  readonly directUsage: number | null;
  readonly subtreeObservedUsage: number;
  readonly unresolved: boolean;
  readonly deficit: number;
}

export interface BudgetState<Names extends string = string> {
  readonly depth: number;
  readonly lifecycle: "active" | "settling" | "settled";
  readonly resources: readonly BudgetResourceSnapshot<Names>[];
}

export interface NamedResourceAmount<Name extends string = string> {
  readonly resource: Name;
  readonly amount: number;
}

export type BudgetHistoryEntry<Names extends string = string> =
  | {
      readonly kind: "budget_created";
      readonly sequence: number;
      readonly resources: readonly NamedResourceAmount<Names>[];
    }
  | {
      readonly kind: "request_approved";
      readonly sequence: number;
      readonly resources: readonly NamedResourceAmount<Names>[];
      readonly decisionEvidence?: DecisionEvidence;
    }
  | {
      readonly kind: "request_denied";
      readonly sequence: number;
      readonly reasons: readonly BudgetRequestDenialReason<Names>[];
      readonly decisionEvidence?: DecisionEvidence;
    }
  | {
      readonly kind: "budget_settlement_recorded";
      readonly sequence: number;
      readonly newlyKnown: readonly NamedResourceAmount<Names>[];
      readonly unresolvedResources: readonly Names[];
      readonly lifecycle: "settling" | "settled";
      readonly isolatedDeficits: readonly NamedResourceAmount<Names>[];
    };

export interface BudgetSnapshot<
  Names extends string = string,
  HistoryNames extends string = Names,
> {
  readonly budget: BudgetState<Names>;
  readonly history: {
    readonly entries: readonly BudgetHistoryEntry<HistoryNames>[];
  };
}

export interface Settlement<Names extends string = string> {
  readonly kind: "settling" | "settled";
  readonly budget: BudgetState<Names>;
  readonly newlyKnown: readonly NamedResourceAmount<Names>[];
  readonly unresolvedResources: readonly Names[];
  readonly replayed: boolean;
}

export interface Budget<
  Names extends string,
  HistoryNames extends string = Names,
> {
  readonly [budgetBrand]: undefined;
  readonly request: <const Resources extends ResourceAmounts<Names>>(
    resources: ExactResourceAmounts<Names, Resources>,
    ...options: readonly [] | readonly [BudgetRequestOptions]
  ) => Promise<
    BudgetRequestResult<Extract<keyof Resources, Names>, HistoryNames>
  >;
  readonly settle: <const Usage extends ResourceUsage<Names>>(
    usage: ExactResourceUsage<Names, Usage>,
  ) => Promise<Settlement<Names>>;
  readonly inspect: () => Promise<BudgetSnapshot<Names, HistoryNames>>;
}

export type ExactResourceAmounts<
  Names extends string,
  Resources extends ResourceAmounts<Names>,
> = Resources & Readonly<Record<Exclude<keyof Resources, Names>, never>>;

export type ExactResourceUsage<
  Names extends string,
  Usage extends ResourceUsage<Names>,
> = Usage & Readonly<Record<Exclude<keyof Usage, Names>, never>>;

export function createBudgetHandle<
  Names extends string,
  HistoryNames extends string = Names,
>(
  runtime: LocalRuntime,
  budgetId: string,
  binding: BudgetResourceBinding<Names, HistoryNames>,
): Budget<Names, HistoryNames> {
  const request: Budget<Names, HistoryNames>["request"] = (
    resources,
    ...options
  ) => requestBudget(runtime, budgetId, binding, resources, options);

  const settle: Budget<Names, HistoryNames>["settle"] = (usage) => {
    const observedUsage = Object.freeze({ ...usage });
    return admit(runtime, async () => {
      const command = {
        commandId: randomUUID(),
        budgetId,
        usage: binding.usage(observedUsage),
      } satisfies SettleBudgetCommand;
      const result = await invokeBudgetOperation(binding, () =>
        invokeMutation(() => runtime.client.settleBudget(command)),
      );
      return projectSettlement(binding, result);
    });
  };

  const inspect = (): Promise<BudgetSnapshot<Names, HistoryNames>> =>
    admit(runtime, async () => {
      const result = await invokeBudgetOperation(binding, () =>
        runtime.client.getBudget({ budgetId }),
      );
      return projectSnapshot<Names, HistoryNames>(binding, result);
    });

  const handle = Object.freeze({
    [budgetBrand]: undefined,
    request,
    settle,
    inspect,
  });
  return handle;
}

async function requestBudget<
  Names extends string,
  HistoryNames extends string,
  const Resources extends ResourceAmounts<Names>,
>(
  runtime: LocalRuntime,
  budgetId: string,
  binding: BudgetResourceBinding<Names, HistoryNames>,
  resources: ExactResourceAmounts<Names, Resources>,
  options: readonly unknown[],
): Promise<BudgetRequestResult<Extract<keyof Resources, Names>, HistoryNames>> {
  type RequestedName = Extract<keyof Resources, Names>;
  const requestedResources = Object.freeze({ ...resources });
  const decisionEvidence = requestDecisionEvidence(options);
  const pending = admit(runtime, async () => {
    const resolved = binding.resources<RequestedName>(
      requestedResources,
      "requestBudget",
    );
    const command: RequestBudgetCommand = {
      commandId: randomUUID(),
      parentBudgetId: budgetId,
      resources: resolved.envelope,
      ...(decisionEvidence === undefined ? {} : { decisionEvidence }),
    };
    const result = await invokeBudgetOperation(resolved.binding, () =>
      invokeMutation(() => runtime.client.requestBudget(command)),
    );
    const resultDecisionEvidence = canonicalDecisionEvidence(
      result.decisionEvidence,
    );
    if (result.kind === "approved") {
      return Object.freeze({
        status: "approved" as const,
        budget: createBudgetHandle<RequestedName, HistoryNames>(
          runtime,
          result.childBudgetId,
          resolved.binding,
        ),
        ...(resultDecisionEvidence === undefined
          ? {}
          : { decisionEvidence: resultDecisionEvidence }),
      });
    }
    return Object.freeze({
      status: "denied" as const,
      reasons: Object.freeze(
        result.reasons
          .map((reason) =>
            projectDenialReason<RequestedName, HistoryNames>(
              resolved.binding,
              reason,
            ),
          )
          .sort(compareDenialReasons),
      ),
      ...(resultDecisionEvidence === undefined
        ? {}
        : { decisionEvidence: resultDecisionEvidence }),
    });
  });
  return pending;
}
