import type {
  Budget,
  BudgetRequestResult,
  ExactResourceAmounts,
  ExactResourceUsage,
  ResourceAmounts,
  ResourceUsage,
  Settlement,
} from "../budget.js";
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

interface RemoteBudgetMethods<
  Names extends string,
  HistoryNames extends string,
> {
  readonly reference: BudgetReference;
  readonly request: <const Resources extends ResourceAmounts<Names>>(
    resources: ExactResourceAmounts<Names, Resources>,
    ...options: [] | [RemoteOperationOptions & BudgetRequestOptions]
  ) => Promise<
    RemoteBudgetRequestResult<Extract<keyof Resources, Names>, HistoryNames>
  >;
  readonly settle: <const Usage extends ResourceUsage<Names>>(
    usage: ExactResourceUsage<Names, Usage>,
    options?: RemoteOperationOptions,
  ) => Promise<Settlement<Names>>;
}

export type RemoteBudget<
  Names extends string,
  HistoryNames extends string = Names,
> = Omit<Budget<Names, HistoryNames>, "request"> &
  RemoteBudgetMethods<Names, HistoryNames>;
