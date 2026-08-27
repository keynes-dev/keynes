import { randomUUID } from "node:crypto";

import type {
  RequestBudgetCommand,
  SettleBudgetCommand,
} from "./generated/types.js";
import type { PolicyDefinitionV1 } from "./generated/policy-types.js";
import { admit, invokeMutation, type LocalRuntime } from "./local/runtime.js";
import {
  compareDenialReasons,
  invokeBudgetOperation,
  projectDenialReason,
  projectPolicyEvidence,
  projectSettlement,
  projectSnapshot,
} from "./budget-projection.js";
import { prepareRequestPolicyOptions } from "./budget-request-options.js";

export { attachedPolicyDefinitions } from "./budget-request-options.js";

declare const budgetBrand: unique symbol;
declare const noPolicyContextBrand: unique symbol;
declare const policyDefinitionBrand: unique symbol;

export type ResourceAmounts<Names extends string = string> = Readonly<
  Partial<Record<Names, number>>
>;

export type ResourceUsage<Names extends string = string> = Readonly<
  Partial<Record<Names, number | null>>
>;

export interface PolicyDefinition<
  Names extends string,
  Context,
  Reasons extends string,
> extends PolicyDefinitionV1 {
  readonly [policyDefinitionBrand]: {
    readonly names: Names;
    readonly context: Context;
    readonly reasons: Reasons;
  };
}

export type PolicySet<Names extends string, Context, Reasons extends string> =
  | {
      readonly definitions: readonly [];
      readonly contextSchemaDigest: null;
      readonly setDigest: string;
    }
  | {
      readonly definitions: readonly [
        PolicyDefinition<Names, Context, Reasons>,
        ...PolicyDefinition<Names, Context, Reasons>[],
      ];
      readonly contextSchemaDigest: string;
      readonly setDigest: string;
    };

type AnyPolicyDefinition = PolicyDefinition<string, unknown, string>;

type PolicySetInput = {
  readonly definitions: readonly AnyPolicyDefinition[];
  readonly contextSchemaDigest: string | null;
  readonly setDigest: string;
};

export interface BudgetRequestAvailabilityReason<Name extends string = string> {
  readonly code: "insufficient_available";
  readonly resource: Name;
  readonly requested: number;
  readonly available: number;
}

export interface BudgetRequestPolicyReason<
  Name extends string = string,
  Reason extends string = string,
> {
  readonly code: "policy_ceiling";
  readonly resource: Name;
  readonly requested: number;
  readonly ceiling: number;
  readonly policyName: string;
  readonly policyRevision: number;
  readonly reason: Reason;
}

export type BudgetRequestDenialReason<
  Name extends string = string,
  Reason extends string = never,
> =
  | BudgetRequestAvailabilityReason<Name>
  | BudgetRequestPolicyReason<Name, Reason>;

export interface PolicyEvidence<Name extends string = string> {
  readonly context: Readonly<Record<string, string | boolean | number | null>>;
  readonly policies: readonly {
    readonly name: string;
    readonly revision: number;
    readonly sourceDigest: string;
    readonly definitionDigest: string;
    readonly rows: readonly {
      readonly resource: Name;
      readonly ceiling: number;
      readonly reason: string;
    }[];
  }[];
  readonly effectiveCeilings: readonly {
    readonly resource: Name;
    readonly ceiling: number;
    readonly reasons: readonly {
      readonly policyName: string;
      readonly policyRevision: number;
      readonly reason: string;
    }[];
  }[];
  readonly decision: "approved" | "denied";
}

export type BudgetRequestResult<
  Names extends string = string,
  Reasons extends string = never,
  ChildContext = NoPolicyContext,
  ChildReasons extends string = never,
> = [Reasons] extends [never]
  ?
      | {
          readonly status: "approved";
          readonly budget: Budget<Names, ChildContext, ChildReasons>;
        }
      | {
          readonly status: "denied";
          readonly reasons: readonly BudgetRequestDenialReason<
            Names,
            Reasons
          >[];
        }
  :
      | {
          readonly status: "approved";
          readonly budget: Budget<Names, ChildContext, ChildReasons>;
          readonly policyEvidence: PolicyEvidence<Names>;
        }
      | {
          readonly status: "denied";
          readonly reasons: readonly BudgetRequestDenialReason<
            Names,
            Reasons
          >[];
          readonly policyEvidence: PolicyEvidence<Names>;
        };

type PolicyEvidenceField<Names extends string, Reasons extends string> = [
  Reasons,
] extends [never]
  ? object
  : { readonly policyEvidence: PolicyEvidence<Names> };

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

export type BudgetHistoryEntry<
  Names extends string = string,
  Reasons extends string = never,
> =
  | {
      readonly kind: "budget_created";
      readonly sequence: number;
      readonly resources: readonly NamedResourceAmount<Names>[];
    }
  | ({
      readonly kind: "request_approved";
      readonly sequence: number;
      readonly resources: readonly NamedResourceAmount<Names>[];
    } & PolicyEvidenceField<Names, Reasons>)
  | ({
      readonly kind: "request_denied";
      readonly sequence: number;
      readonly reasons: readonly BudgetRequestDenialReason<Names, Reasons>[];
    } & PolicyEvidenceField<Names, Reasons>)
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
  Reasons extends string = never,
> {
  readonly budget: BudgetState<Names>;
  readonly history: {
    readonly entries: readonly BudgetHistoryEntry<Names, Reasons>[];
  };
}

export interface Settlement<Names extends string = string> {
  readonly kind: "settling" | "settled";
  readonly budget: BudgetState<Names>;
  readonly newlyKnown: readonly NamedResourceAmount<Names>[];
  readonly unresolvedResources: readonly Names[];
  readonly replayed: boolean;
}

export interface NoPolicyContext {
  readonly [noPolicyContextBrand]: never;
}

export interface Budget<
  Names extends string,
  Context = NoPolicyContext,
  Reasons extends string = never,
> {
  readonly [budgetBrand]: void;
  readonly request: <
    const Resources extends ResourceAmounts<Names>,
    const SuppliedContext extends Context = Context,
    const ChildPolicies extends PolicySetInput | undefined = undefined,
  >(
    resources: ExactResourceAmounts<Names, Resources>,
    ...options: RequestArguments<
      Context,
      SuppliedContext,
      Extract<keyof Resources, Names>,
      ChildPolicies
    >
  ) => Promise<
    BudgetRequestResult<
      Extract<keyof Resources, Names>,
      Reasons,
      ContextOfPolicySet<ChildPolicies>,
      ReasonsOfPolicySet<ChildPolicies>
    >
  >;
  readonly settle: <const Usage extends ResourceUsage<Names>>(
    usage: ExactResourceUsage<Names, Usage>,
  ) => Promise<Settlement<Names>>;
  readonly inspect: () => Promise<BudgetSnapshot<Names, Reasons>>;
}

export type ExactResourceAmounts<
  Names extends string,
  Resources extends ResourceAmounts<Names>,
> = Resources & Readonly<Record<Exclude<keyof Resources, Names>, never>>;

export type ExactResourceUsage<
  Names extends string,
  Usage extends ResourceUsage<Names>,
> = Usage & Readonly<Record<Exclude<keyof Usage, Names>, never>>;

export type ContextOfPolicySet<Policies> = [
  PolicyDefinitionOf<Policies>,
] extends [never]
  ? NoPolicyContext
  : PolicyDefinitionOf<Policies> extends PolicyDefinition<
        string,
        infer Context,
        string
      >
    ? Context
    : NoPolicyContext;

export type ReasonsOfPolicySet<Policies> = [
  PolicyDefinitionOf<Policies>,
] extends [never]
  ? never
  : PolicyDefinitionOf<Policies> extends PolicyDefinition<
        string,
        unknown,
        infer Reasons
      >
    ? Reasons
    : never;

export type AttachPolicyArguments<
  Names extends string,
  Policies extends PolicySetInput | undefined,
> = [Policies] extends [undefined]
  ? readonly []
  : Exclude<PolicyNames<Policies>, Names> extends never
    ? readonly [{ readonly policies: Policies }]
    : readonly [never];

type PolicyDefinitionOf<Policies> = Policies extends {
  readonly definitions: readonly (infer Definition)[];
}
  ? Definition
  : never;

type PolicyNames<Policies> =
  PolicyDefinitionOf<Policies> extends PolicyDefinition<
    infer Names,
    unknown,
    string
  >
    ? Names
    : never;

type ExactObject<Expected, Supplied extends Expected> = Supplied &
  Readonly<Record<Exclude<keyof Supplied, keyof Expected>, never>>;

type CompatiblePolicySet<
  Names extends string,
  Policies extends PolicySetInput | undefined,
> = [Policies] extends [undefined]
  ? undefined
  : Exclude<PolicyNames<Policies>, Names> extends never
    ? Policies
    : never;

type RequestArguments<
  Context,
  SuppliedContext extends Context,
  ChildNames extends string,
  ChildPolicies extends PolicySetInput | undefined,
> = [Context] extends [NoPolicyContext]
  ? AttachPolicyArguments<ChildNames, ChildPolicies>
  : [ChildPolicies] extends [undefined]
    ? readonly [{ readonly context: ExactObject<Context, SuppliedContext> }]
    : readonly [
        {
          readonly context: ExactObject<Context, SuppliedContext>;
          readonly policies: CompatiblePolicySet<ChildNames, ChildPolicies>;
        },
      ];

export function createBudgetHandle<
  Names extends string,
  Context = NoPolicyContext,
  Reasons extends string = never,
>(runtime: LocalRuntime, budgetId: string): Budget<Names, Context, Reasons> {
  const request: Budget<Names, Context, Reasons>["request"] = (
    resources,
    ...options
  ) => requestBudget(runtime, budgetId, resources, options);

  const settle: Budget<Names, Context, Reasons>["settle"] = (usage) =>
    admit(runtime, async () => {
      const command = {
        commandId: randomUUID(),
        budgetId,
        usage: runtime.resources.usage(usage),
      } satisfies SettleBudgetCommand;
      const result = await invokeBudgetOperation(runtime, () =>
        invokeMutation(() => runtime.client.settleBudget(command)),
      );
      return projectSettlement<Names>(runtime, result);
    });

  const inspect = (): Promise<BudgetSnapshot<Names, Reasons>> =>
    admit(runtime, async () => {
      const result = await invokeBudgetOperation(runtime, () =>
        runtime.client.getBudget({ budgetId }),
      );
      return projectSnapshot<Names, Reasons>(runtime, result);
    });

  const handle = Object.freeze({
    request,
    settle,
    inspect,
  });
  return handle as Budget<Names, Context, Reasons>;
}

function requestBudget<
  Names extends string,
  Context,
  Reasons extends string,
  const Resources extends ResourceAmounts<Names>,
  const SuppliedContext extends Context = Context,
  const ChildPolicies extends PolicySetInput | undefined = undefined,
>(
  runtime: LocalRuntime,
  budgetId: string,
  resources: ExactResourceAmounts<Names, Resources>,
  options: RequestArguments<
    Context,
    SuppliedContext,
    Extract<keyof Resources, Names>,
    ChildPolicies
  >,
): Promise<
  BudgetRequestResult<
    Extract<keyof Resources, Names>,
    Reasons,
    ContextOfPolicySet<ChildPolicies>,
    ReasonsOfPolicySet<ChildPolicies>
  >
> {
  type RequestedName = Extract<keyof Resources, Names>;
  const preparedOptions = prepareRequestPolicyOptions(options);
  const pending = admit(runtime, async () => {
    const resolved = runtime.resources.resources<RequestedName>(
      resources,
      "requestBudget",
    );
    const command: RequestBudgetCommand = {
      commandId: randomUUID(),
      parentBudgetId: budgetId,
      resources: resolved,
      ...preparedOptions,
    };
    const result = await invokeBudgetOperation(runtime, () =>
      invokeMutation(() => runtime.client.requestBudget(command)),
    );
    if (result.kind === "approved") {
      return Object.freeze({
        status: "approved" as const,
        budget: createBudgetHandle<
          RequestedName,
          ContextOfPolicySet<ChildPolicies>,
          ReasonsOfPolicySet<ChildPolicies>
        >(runtime, result.childBudgetId),
        ...(result.policyEvidence === undefined
          ? {}
          : {
              policyEvidence: projectPolicyEvidence<RequestedName>(
                runtime,
                result.policyEvidence,
              ),
            }),
      });
    }
    return Object.freeze({
      status: "denied" as const,
      reasons: Object.freeze(
        result.reasons
          .map((reason) =>
            projectDenialReason<RequestedName, Reasons>(runtime, reason),
          )
          .sort(compareDenialReasons),
      ),
      ...(result.policyEvidence === undefined
        ? {}
        : {
            policyEvidence: projectPolicyEvidence<RequestedName>(
              runtime,
              result.policyEvidence,
            ),
          }),
    });
  });
  return pending as Promise<
    BudgetRequestResult<
      RequestedName,
      Reasons,
      ContextOfPolicySet<ChildPolicies>,
      ReasonsOfPolicySet<ChildPolicies>
    >
  >;
}
