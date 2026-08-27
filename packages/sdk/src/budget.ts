import { randomUUID } from "node:crypto";

import type {
  BudgetHistoryEntry as WireBudgetHistoryEntry,
  BudgetProjection as WireBudgetProjection,
  GetBudgetResult,
  PolicyContextV1,
  PolicyEvidenceV1 as WirePolicyEvidenceV1,
  RequestBudgetCommand,
  RequestDenialReason,
  ResourceAmount,
  SettleBudgetCommand,
  SettleBudgetResult,
} from "./generated/types.js";
import { KeynesError } from "./generated/client.js";
import type { PolicyDefinitionV1 } from "./generated/policy-types.js";
import { admit, invokeMutation, type LocalRuntime } from "./local/runtime.js";
import { canonicalResourceName } from "./resources.js";
import { KeynesSdkError } from "./sdk-errors.js";

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

export function attachedPolicyDefinitions(
  options: readonly unknown[],
): CreatePolicyDefinitions | undefined {
  if (options.length === 0) return undefined;
  const option = options[0];
  if (options.length !== 1 || !isRecord(option)) {
    throw invalidConfiguration("options", "unsupported");
  }
  const unknownField = Object.keys(option).find(
    (field) => field !== "policies",
  );
  if (unknownField !== undefined) {
    throw invalidConfiguration(unknownField, "unsupported");
  }
  return policyDefinitions(option.policies);
}

type CreatePolicyDefinitions = NonNullable<
  import("./generated/types.js").CreateBudgetCommand["policies"]
>;

function prepareRequestPolicyOptions(
  options: readonly unknown[],
): Pick<RequestBudgetCommand, "context" | "childPolicies"> {
  if (options.length === 0) return {};
  const option = options[0];
  if (options.length !== 1 || !isRecord(option)) {
    throw invalidConfiguration("options", "unsupported");
  }
  const unknownField = Object.keys(option).find(
    (field) => field !== "context" && field !== "policies",
  );
  if (unknownField !== undefined) {
    throw invalidConfiguration(unknownField, "unsupported");
  }
  const context =
    "context" in option ? canonicalContext(option.context) : undefined;
  const childPolicies =
    "policies" in option ? policyDefinitions(option.policies) : undefined;
  return {
    ...(context === undefined ? {} : { context }),
    ...(childPolicies === undefined ? {} : { childPolicies }),
  };
}

function policyDefinitions(
  value: unknown,
): CreatePolicyDefinitions | undefined {
  if (!isRecord(value) || !Array.isArray(value.definitions)) {
    throw invalidConfiguration("policies", "unsupported");
  }
  if (value.definitions.length === 0) {
    if (!isCanonicalEmptyPolicySet(value)) {
      throw invalidConfiguration("policies", "unsupported");
    }
    return undefined;
  }
  if (value.definitions.length > 16) {
    throw invalidConfiguration("policies", "unsupported");
  }
  return structuredClone(value.definitions) as CreatePolicyDefinitions;
}

function canonicalContext(value: unknown): PolicyContextV1 {
  if (!isRecord(value)) {
    throw invalidConfiguration("context", "unsupported");
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, member]) => [
      canonicalResourceName(key),
      structuredClone(member),
    ]),
  ) as PolicyContextV1;
}

function isCanonicalEmptyPolicySet(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const fields = Object.keys(value);
  if (
    fields.length !== 3 ||
    !fields.includes("definitions") ||
    !fields.includes("contextSchemaDigest") ||
    !fields.includes("setDigest")
  ) {
    return false;
  }
  return (
    Array.isArray(value.definitions) &&
    value.definitions.length === 0 &&
    value.contextSchemaDigest === null &&
    typeof value.setDigest === "string"
  );
}

function projectSettlement<Names extends string>(
  runtime: LocalRuntime,
  result: SettleBudgetResult,
): Settlement<Names> {
  return Object.freeze({
    kind: result.kind,
    budget: projectBudget<Names>(runtime, result.budget),
    newlyKnown: projectAmounts<Names>(runtime, result.newlyKnown),
    unresolvedResources: Object.freeze(
      result.unresolvedResourceTypeIds
        .map((resourceTypeId) => resourceName<Names>(runtime, resourceTypeId))
        .sort(compareStrings),
    ),
    replayed: result.replayed,
  });
}

function projectSnapshot<Names extends string, Reasons extends string>(
  runtime: LocalRuntime,
  result: GetBudgetResult,
): BudgetSnapshot<Names, Reasons> {
  return Object.freeze({
    budget: projectBudget<Names>(runtime, result.budget),
    history: Object.freeze({
      entries: Object.freeze(
        result.history.entries.map((entry) =>
          projectHistoryEntry<Names, Reasons>(runtime, entry),
        ),
      ),
    }),
  });
}

function projectBudget<Names extends string>(
  runtime: LocalRuntime,
  budget: WireBudgetProjection,
): BudgetState<Names> {
  return Object.freeze({
    depth: budget.depth,
    lifecycle: budget.lifecycle,
    resources: Object.freeze(
      budget.resources
        .map((value) => {
          const resource = runtime.resources.resource(
            value.resourceType.resourceTypeId,
          );
          return Object.freeze({
            resource: resource.key as Names,
            unit: resource.unit,
            accountingBehavior: resource.accountingBehavior,
            allocated: value.allocated,
            available: value.available,
            committed: value.committed,
            directUsage: value.directUsage,
            subtreeObservedUsage: value.subtreeObservedUsage,
            unresolved: value.unresolved,
            deficit: value.deficit,
          });
        })
        .sort((left, right) => compareStrings(left.resource, right.resource)),
    ),
  });
}

function projectHistoryEntry<Names extends string, Reasons extends string>(
  runtime: LocalRuntime,
  entry: WireBudgetHistoryEntry,
): BudgetHistoryEntry<Names, Reasons> {
  switch (entry.kind) {
    case "budget_created":
    case "request_approved":
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        resources: projectAmounts<Names>(runtime, entry.resources),
        ...(entry.kind === "request_approved" &&
        entry.policyEvidence !== undefined
          ? {
              policyEvidence: projectPolicyEvidence<Names>(
                runtime,
                entry.policyEvidence,
              ),
            }
          : {}),
      });
    case "request_denied":
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        reasons: Object.freeze(
          entry.reasons
            .map((reason) =>
              projectDenialReason<Names, Reasons>(runtime, reason),
            )
            .sort(compareDenialReasons),
        ),
        ...(entry.policyEvidence === undefined
          ? {}
          : {
              policyEvidence: projectPolicyEvidence<Names>(
                runtime,
                entry.policyEvidence,
              ),
            }),
      });
    case "budget_settlement_recorded":
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        newlyKnown: projectAmounts<Names>(runtime, entry.newlyKnown),
        unresolvedResources: Object.freeze(
          entry.unresolvedResourceTypeIds
            .map((resourceTypeId) =>
              resourceName<Names>(runtime, resourceTypeId),
            )
            .sort(compareStrings),
        ),
        lifecycle: entry.lifecycle,
        isolatedDeficits: projectAmounts<Names>(
          runtime,
          entry.isolatedDeficits,
        ),
      });
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}

function projectAmounts<Names extends string>(
  runtime: LocalRuntime,
  amounts: readonly ResourceAmount[],
): readonly NamedResourceAmount<Names>[] {
  return Object.freeze(
    amounts
      .map((amount) =>
        Object.freeze({
          resource: resourceName<Names>(runtime, amount.resourceTypeId),
          amount: amount.amount,
        }),
      )
      .sort((left, right) => compareStrings(left.resource, right.resource)),
  );
}

async function invokeBudgetOperation<Result>(
  runtime: LocalRuntime,
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (!(error instanceof KeynesError)) throw error;
    Reflect.set(error, "details", projectErrorValue(runtime, error.details));
    throw error;
  }
}

function projectErrorValue(runtime: LocalRuntime, value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((member) => projectErrorValue(runtime, member)),
    );
  }
  if (!isRecord(value)) return value;
  const projected: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(value)) {
    if (key === "resourceTypeId") {
      const resource = knownResourceName(runtime, member);
      if (resource !== undefined) projected.resource = resource;
      continue;
    }
    if (isPrivateIdentityField(key)) continue;
    projected[key] = projectErrorValue(runtime, member);
  }
  return Object.freeze(projected);
}

function knownResourceName(
  runtime: LocalRuntime,
  value: unknown,
): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return runtime.resources.resource(value).key;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "Database returned an unknown Resource identity"
    ) {
      return undefined;
    }
    throw error;
  }
}

function isPrivateIdentityField(field: string): boolean {
  return /(?:budget|command|resourceType)Id$/i.test(field);
}

function compareDenialReasons<Names extends string>(
  left: BudgetRequestDenialReason<Names, string>,
  right: BudgetRequestDenialReason<Names, string>,
): number {
  const resource = compareStrings(left.resource, right.resource);
  if (resource !== 0) return resource;
  const code = compareStrings(left.code, right.code);
  if (code !== 0) return code;
  if (left.code !== "policy_ceiling" || right.code !== "policy_ceiling") {
    return 0;
  }
  return (
    compareStrings(left.policyName, right.policyName) ||
    left.policyRevision - right.policyRevision ||
    compareStrings(left.reason, right.reason)
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function projectDenialReason<Names extends string, Reasons extends string>(
  runtime: LocalRuntime,
  reason: RequestDenialReason,
): BudgetRequestDenialReason<Names, Reasons> {
  return reason.code === "insufficient_available"
    ? Object.freeze({
        code: reason.code,
        resource: resourceName<Names>(runtime, reason.resourceTypeId),
        requested: reason.requested,
        available: reason.available,
      })
    : Object.freeze({
        code: reason.code,
        resource: resourceName<Names>(runtime, reason.resourceTypeId),
        requested: reason.requested,
        ceiling: reason.ceiling,
        policyName: reason.policyName,
        policyRevision: reason.policyRevision,
        reason: reason.reason as Reasons,
      });
}

function projectPolicyEvidence<Names extends string>(
  runtime: LocalRuntime,
  evidence: WirePolicyEvidenceV1,
): PolicyEvidence<Names> {
  return Object.freeze({
    context: Object.freeze({ ...evidence.context }),
    policies: Object.freeze(
      evidence.policies.map((policy) =>
        Object.freeze({
          name: policy.name,
          revision: policy.revision,
          sourceDigest: policy.sourceDigest,
          definitionDigest: policy.definitionDigest,
          rows: Object.freeze(
            policy.rows.map((row) =>
              Object.freeze({
                resource: runtime.resources.resourceByCanonicalName(
                  row.resource,
                ).key as Names,
                ceiling: row.ceiling,
                reason: row.reason,
              }),
            ),
          ),
        }),
      ),
    ),
    effectiveCeilings: Object.freeze(
      evidence.effectiveCeilings.map((effective) =>
        Object.freeze({
          resource: resourceName<Names>(runtime, effective.resourceTypeId),
          ceiling: effective.ceiling,
          reasons: Object.freeze(
            effective.reasons.map((reason) => Object.freeze({ ...reason })),
          ),
        }),
      ),
    ),
    decision: evidence.decision,
  });
}

function resourceName<Names extends string>(
  runtime: LocalRuntime,
  resourceTypeId: string,
): Names {
  return runtime.resources.resource(resourceTypeId).key as Names;
}

function invalidConfiguration(
  field: string,
  reason: "missing" | "unknown" | "unsupported",
): KeynesSdkError<"invalid_configuration"> {
  return new KeynesSdkError("invalid_configuration", { field, reason });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
