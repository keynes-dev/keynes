import type {
  Budget,
  BudgetRequestResult,
  CompatiblePolicySet,
  ContextOfPolicySet,
  ExactObject,
  ExactResourceAmounts,
  ExactResourceUsage,
  NoPolicyContext,
  PolicyNames,
  PolicySetInput,
  ReasonsOfPolicySet,
  ResourceAmounts,
  ResourceUsage,
  Settlement,
} from "../budget.js";
import type { BudgetReference, RemoteOperationOptions } from "./references.js";

export type RemoteAttachPolicyArguments<
  Names extends string,
  Policies extends PolicySetInput | undefined,
> = [Policies] extends [undefined]
  ? readonly [] | readonly [RemoteOperationOptions]
  : Exclude<PolicyNames<Policies>, Names> extends never
    ? readonly [{ readonly policies: Policies } & RemoteOperationOptions]
    : readonly [never];

type RemoteRequestArguments<
  Context,
  SuppliedContext extends Context,
  ChildNames extends string,
  ChildPolicies extends PolicySetInput | undefined,
> = [Context] extends [NoPolicyContext]
  ? [ChildPolicies] extends [undefined]
    ? readonly [] | readonly [RemoteOperationOptions]
    : readonly [
        {
          readonly childPolicies: CompatiblePolicySet<
            ChildNames,
            ChildPolicies
          >;
        } & RemoteOperationOptions,
      ]
  : [ChildPolicies] extends [undefined]
    ? readonly [
        {
          readonly context: ExactObject<Context, SuppliedContext>;
        } & RemoteOperationOptions,
      ]
    : readonly [
        {
          readonly context: ExactObject<Context, SuppliedContext>;
          readonly childPolicies: CompatiblePolicySet<
            ChildNames,
            ChildPolicies
          >;
        } & RemoteOperationOptions,
      ];

export type RemoteBudgetRequestResult<
  Names extends string,
  Reasons extends string,
  ChildContext,
  ChildReasons extends string,
  ParentContext,
  HistoryNames extends string,
> =
  BudgetRequestResult<
    Names,
    Reasons,
    ChildContext,
    ChildReasons,
    ParentContext,
    HistoryNames
  > extends infer Result
    ? Result extends {
        readonly status: "approved";
        readonly budget: Budget<
          Names,
          ChildContext,
          ChildReasons,
          HistoryNames
        >;
      }
      ? Omit<Result, "budget"> & {
          readonly budget: RemoteBudget<
            Names,
            ChildContext,
            ChildReasons,
            HistoryNames
          >;
        }
      : Result
    : never;

interface RemoteBudgetMethods<
  Names extends string,
  Context,
  Reasons extends string,
  HistoryNames extends string,
> {
  readonly reference: BudgetReference;
  readonly request: <
    const Resources extends ResourceAmounts<Names>,
    const SuppliedContext extends Context = Context,
    const ChildPolicies extends PolicySetInput | undefined = undefined,
  >(
    resources: ExactResourceAmounts<Names, Resources>,
    ...options: RemoteRequestArguments<
      Context,
      SuppliedContext,
      Extract<keyof Resources, Names>,
      ChildPolicies
    >
  ) => Promise<
    RemoteBudgetRequestResult<
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
    options?: RemoteOperationOptions,
  ) => Promise<Settlement<Names>>;
}

export type RemoteBudget<
  Names extends string,
  Context = NoPolicyContext,
  Reasons extends string = never,
  HistoryNames extends string = Names,
> = Budget<Names, Context, Reasons, HistoryNames> &
  RemoteBudgetMethods<Names, Context, Reasons, HistoryNames>;
