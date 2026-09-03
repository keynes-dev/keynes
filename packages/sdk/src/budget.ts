import { randomUUID } from "node:crypto";

import type {
  RequestBudgetCommand,
  SettleBudgetCommand,
} from "./generated/types.js";
import type {
  PolicyDefinitionV1,
  PolicyScalarV1,
} from "./generated/policy-types.js";
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
import type { ResourceBinding } from "./resource-binding.js";

export { attachedPolicyDefinitions } from "./budget-request-options.js";

export const budgetBrand: unique symbol = Symbol("Budget");
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

export type PolicySetInput = {
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

type CanonicalContextKey<Value extends string> =
  Value extends `${infer Head}${infer Tail}`
    ? Head extends Lowercase<Head>
      ? `${Head}${CanonicalContextKey<Tail>}`
      : `_${Lowercase<Head>}${CanonicalContextKey<Tail>}`
    : Value;

export type CanonicalPolicyContext<Context> =
  string extends Extract<keyof Context, string>
    ? Readonly<Record<string, PolicyScalarV1>>
    : Readonly<{
        [
          Key in Extract<keyof Context, string> as CanonicalContextKey<Key>
        ]: Context[Key];
      }>;

export interface PolicyEvidence<
  Name extends string = string,
  Context = Readonly<Record<string, PolicyScalarV1>>,
  Reason extends string = string,
> {
  readonly context: CanonicalPolicyContext<Context>;
  readonly policies: readonly {
    readonly name: string;
    readonly revision: number;
    readonly sourceDigest: string;
    readonly definitionDigest: string;
    readonly rows: readonly {
      readonly resource: Name;
      readonly ceiling: number;
      readonly reason: Reason;
    }[];
  }[];
  readonly effectiveCeilings: readonly {
    readonly resource: Name;
    readonly ceiling: number;
    readonly reasons: readonly {
      readonly policyName: string;
      readonly policyRevision: number;
      readonly reason: Reason;
    }[];
  }[];
  readonly decision: "approved" | "denied";
}

export type BudgetRequestResult<
  Names extends string = string,
  Reasons extends string = never,
  ChildContext = NoPolicyContext,
  ChildReasons extends string = never,
  ParentContext = Readonly<Record<string, PolicyScalarV1>>,
  HistoryNames extends string = Names,
> = [Reasons] extends [never]
  ?
      | {
          readonly status: "approved";
          readonly budget: Budget<
            Names,
            ChildContext,
            ChildReasons,
            HistoryNames
          >;
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
          readonly budget: Budget<
            Names,
            ChildContext,
            ChildReasons,
            HistoryNames
          >;
          readonly policyEvidence: PolicyEvidence<
            Names,
            ParentContext,
            Reasons
          >;
        }
      | {
          readonly status: "denied";
          readonly reasons: readonly BudgetRequestDenialReason<
            Names,
            Reasons
          >[];
          readonly policyEvidence: PolicyEvidence<
            Names,
            ParentContext,
            Reasons
          >;
        };

type PolicyEvidenceField<
  Names extends string,
  Reasons extends string,
  Context,
> = [Reasons] extends [never]
  ? object
  : { readonly policyEvidence: PolicyEvidence<Names, Context, Reasons> };

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
  Context = Readonly<Record<string, PolicyScalarV1>>,
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
    } & PolicyEvidenceField<Names, Reasons, Context>)
  | ({
      readonly kind: "request_denied";
      readonly sequence: number;
      readonly reasons: readonly BudgetRequestDenialReason<Names, Reasons>[];
    } & PolicyEvidenceField<Names, Reasons, Context>)
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
  Context = Readonly<Record<string, PolicyScalarV1>>,
  HistoryNames extends string = Names,
> {
  readonly budget: BudgetState<Names>;
  readonly history: {
    readonly entries: readonly BudgetHistoryEntry<
      HistoryNames,
      Reasons,
      Context
    >[];
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
  HistoryNames extends string = Names,
> {
  readonly [budgetBrand]: undefined;
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
      ReasonsOfPolicySet<ChildPolicies>,
      Context,
      HistoryNames
    >
  >;
  readonly settle: <const Usage extends ResourceUsage<Names>>(
    usage: ExactResourceUsage<Names, Usage>,
  ) => Promise<Settlement<Names>>;
  readonly inspect: () => Promise<
    BudgetSnapshot<Names, Reasons, Context, HistoryNames>
  >;
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

export type PolicyNames<Policies> =
  PolicyDefinitionOf<Policies> extends PolicyDefinition<
    infer Names,
    unknown,
    string
  >
    ? Names
    : never;

export type ExactObject<Expected, Supplied extends Expected> = Supplied &
  Readonly<Record<Exclude<keyof Supplied, keyof Expected>, never>>;

export type CompatiblePolicySet<
  Names extends string,
  Policies extends PolicySetInput | undefined,
> = [Policies] extends [undefined]
  ? undefined
  : Exclude<PolicyNames<Policies>, Names> extends never
    ? Policies
    : never;

export type RequestArguments<
  Context,
  SuppliedContext extends Context,
  ChildNames extends string,
  ChildPolicies extends PolicySetInput | undefined,
> = [Context] extends [NoPolicyContext]
  ? [ChildPolicies] extends [undefined]
    ? readonly []
    : readonly [
        {
          readonly childPolicies: CompatiblePolicySet<
            ChildNames,
            ChildPolicies
          >;
        },
      ]
  : [ChildPolicies] extends [undefined]
    ? readonly [{ readonly context: ExactObject<Context, SuppliedContext> }]
    : readonly [
        {
          readonly context: ExactObject<Context, SuppliedContext>;
          readonly childPolicies: CompatiblePolicySet<
            ChildNames,
            ChildPolicies
          >;
        },
      ];

export function createBudgetHandle<
  Names extends string,
  Context = NoPolicyContext,
  Reasons extends string = never,
  HistoryNames extends string = Names,
>(
  runtime: LocalRuntime,
  budgetId: string,
  binding: ResourceBinding<Names, HistoryNames>,
): Budget<Names, Context, Reasons, HistoryNames> {
  const request: Budget<Names, Context, Reasons, HistoryNames>["request"] = (
    resources,
    ...options
  ) => requestBudget(runtime, budgetId, binding, resources, options);

  const settle: Budget<Names, Context, Reasons, HistoryNames>["settle"] = (
    usage,
  ) => {
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

  const inspect = (): Promise<
    BudgetSnapshot<Names, Reasons, Context, HistoryNames>
  > =>
    admit(runtime, async () => {
      const result = await invokeBudgetOperation(binding, () =>
        runtime.client.getBudget({ budgetId }),
      );
      return projectSnapshot<Names, Reasons, Context, HistoryNames>(
        binding,
        result,
      );
    });

  const handle = Object.freeze({
    [budgetBrand]: undefined,
    request,
    settle,
    inspect,
  });
  return handle;
}

function requestBudget<
  Names extends string,
  HistoryNames extends string,
  Context,
  Reasons extends string,
  const Resources extends ResourceAmounts<Names>,
  const SuppliedContext extends Context = Context,
  const ChildPolicies extends PolicySetInput | undefined = undefined,
>(
  runtime: LocalRuntime,
  budgetId: string,
  binding: ResourceBinding<Names, HistoryNames>,
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
    ReasonsOfPolicySet<ChildPolicies>,
    Context,
    HistoryNames
  >
> {
  type RequestedName = Extract<keyof Resources, Names>;
  const preparedOptions = prepareRequestPolicyOptions(options);
  const requestedResources = Object.freeze({ ...resources });
  const pending = admit(runtime, async () => {
    const resolved = binding.resources<RequestedName>(
      requestedResources,
      "requestBudget",
    );
    const command: RequestBudgetCommand = {
      commandId: randomUUID(),
      parentBudgetId: budgetId,
      resources: resolved.envelope,
      ...preparedOptions,
    };
    const result = await invokeBudgetOperation(resolved.binding, () =>
      invokeMutation(() => runtime.client.requestBudget(command)),
    );
    if (result.kind === "approved") {
      return Object.freeze({
        status: "approved" as const,
        budget: createBudgetHandle<
          RequestedName,
          ContextOfPolicySet<ChildPolicies>,
          ReasonsOfPolicySet<ChildPolicies>,
          HistoryNames
        >(runtime, result.childBudgetId, resolved.binding),
        ...(result.policyEvidence === undefined
          ? {}
          : {
              policyEvidence: projectPolicyEvidence<
                RequestedName,
                Context,
                Reasons,
                HistoryNames
              >(resolved.binding, result.policyEvidence),
            }),
      });
    }
    return Object.freeze({
      status: "denied" as const,
      reasons: Object.freeze(
        result.reasons
          .map((reason) =>
            projectDenialReason<RequestedName, Reasons, HistoryNames>(
              resolved.binding,
              reason,
            ),
          )
          .sort(compareDenialReasons),
      ),
      ...(result.policyEvidence === undefined
        ? {}
        : {
            policyEvidence: projectPolicyEvidence<
              RequestedName,
              Context,
              Reasons,
              HistoryNames
            >(resolved.binding, result.policyEvidence),
          }),
    });
  });
  return pending as Promise<
    BudgetRequestResult<
      RequestedName,
      Reasons,
      ContextOfPolicySet<ChildPolicies>,
      ReasonsOfPolicySet<ChildPolicies>,
      Context,
      HistoryNames
    >
  >;
}
