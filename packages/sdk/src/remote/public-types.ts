import type {
  Budget,
  BudgetRequestResult,
  ExactResourceAmounts,
  ExactResourceUsage,
  ResourceAmounts,
  ResourceUsage,
  Settlement,
} from "../budget.js";
import type { Policy, PolicyRequestResult, PolicyResult } from "../policy.js";
import type { BudgetReference, RemoteOperationOptions } from "./references.js";
import type { BudgetRequestOptions } from "../decision-evidence.js";

export type RemoteBudgetRequestResult<
  Names extends string,
  HistoryNames extends string,
> =
  BudgetRequestResult<Names, HistoryNames> extends infer Result
    ? Result extends {
        readonly status: "approved";
        readonly budget: Budget<Names, HistoryNames>;
      }
      ? Omit<Result, "budget"> & {
          readonly budget: RemoteBudget<Names, HistoryNames>;
        }
      : Result
    : never;

type RemotePolicyRequestOptions<
  ProposalNames extends string,
  FinalNames extends string,
> = BudgetRequestOptions & {
  readonly policy: Policy<ProposalNames, FinalNames>;
  readonly operationKey?: never;
};

interface RemoteBudgetRequest<
  Names extends string,
  HistoryNames extends string,
> {
  <const Resources extends ResourceAmounts<Names>, FinalNames extends Names>(
    resources: ExactResourceAmounts<Names, Resources>,
    options: RemotePolicyRequestOptions<
      Extract<keyof Resources, Names>,
      FinalNames
    >,
  ): Promise<
    PolicyRequestResult<
      FinalNames,
      RemoteBudgetRequestResult<FinalNames, HistoryNames>
    >
  >;
  <const Resources extends ResourceAmounts<Names>>(
    resources: ExactResourceAmounts<Names, Resources>,
    ...options: [] | [RemoteOperationOptions & BudgetRequestOptions]
  ): Promise<
    RemoteBudgetRequestResult<Extract<keyof Resources, Names>, HistoryNames>
  >;
}

interface RemoteBudgetPrepareRequest<Names extends string> {
  <const Resources extends ResourceAmounts<Names>, FinalNames extends Names>(
    resources: ExactResourceAmounts<Names, Resources>,
    options: RemotePolicyRequestOptions<
      Extract<keyof Resources, Names>,
      FinalNames
    >,
  ): Promise<PolicyResult<FinalNames>>;
}

interface RemoteBudgetMethods<
  Names extends string,
  HistoryNames extends string,
> {
  readonly reference: BudgetReference;
  readonly request: RemoteBudgetRequest<Names, HistoryNames>;
  readonly prepareRequest: RemoteBudgetPrepareRequest<Names>;
  readonly settle: <const Usage extends ResourceUsage<Names>>(
    usage: ExactResourceUsage<Names, Usage>,
    options?: RemoteOperationOptions,
  ) => Promise<Settlement<Names>>;
}

export type RemoteBudget<
  Names extends string,
  HistoryNames extends string = Names,
> = Omit<Budget<Names, HistoryNames>, "request" | "prepareRequest"> &
  RemoteBudgetMethods<Names, HistoryNames>;
