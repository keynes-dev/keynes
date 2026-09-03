import { createKeynes, createOperationKey, defineResources } from "@keynes/sdk";
import type {
  Budget,
  BudgetReference,
  LocalKeynes,
  OperationKey,
  PolicySet,
  RecoverOperationResult,
  RemoteKeynes,
} from "@keynes/sdk";

function expectType<Value>(_value: Value): void {}

const resourceTypes = defineResources({
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  searchQueries: { unit: "query", accountingBehavior: "consumable" },
});

declare const rootPolicies: PolicySet<
  "usdCents",
  { readonly customerTier: string },
  "customer_tier_limit"
>;
declare const childPolicies: PolicySet<
  "usdCents",
  { readonly riskClass: string },
  "workflow_risk_limit"
>;
declare const storedReference: BudgetReference;

expectType<() => OperationKey>(createOperationKey);
const operationKey = createOperationKey();
expectType<OperationKey>(operationKey);

// @ts-expect-error Operation keys and Budget references are distinct values.
const referenceFromOperationKey: BudgetReference = operationKey;
// @ts-expect-error Budget references cannot identify operation recovery records.
const operationKeyFromReference: OperationKey = storedReference;

const remotePromise = createKeynes({
  databaseUrl:
    "postgresql://application:secret@db.example.test/keynes?sslmode=verify-full",
});
expectType<Promise<RemoteKeynes>>(remotePromise);
await using remote = await remotePromise;

const root = await remote.createBudget(
  resourceTypes,
  { usdCents: 1_000 },
  { operationKey },
);
expectType<BudgetReference>(root.reference);

const governed = await remote.createBudget(
  resourceTypes,
  { usdCents: 1_000 },
  { policies: rootPolicies, operationKey },
);

const requestResult = await root.request({ usdCents: 25 }, { operationKey });
if (requestResult.status === "approved") {
  expectType<BudgetReference>(requestResult.budget.reference);
}
await root.request({ usdCents: 25 }, { childPolicies, operationKey });
await governed.request(
  { usdCents: 25 },
  { context: { customerTier: "standard" }, operationKey },
);
await governed.request(
  { usdCents: 25 },
  {
    context: { customerTier: "standard" },
    childPolicies,
    operationKey,
  },
);
await root.settle({ usdCents: 19 }, { operationKey });

const reopenedPromise = remote.openBudget({
  reference: storedReference,
  resourceTypes,
});
expectType<Promise<Budget<"usdCents" | "searchQueries">>>(reopenedPromise);
const reopened = await reopenedPromise;
expectType<BudgetReference>(reopened.reference);

const recoveryPromise = remote.recoverOperation(operationKey);
expectType<Promise<RecoverOperationResult>>(recoveryPromise);
const recovery = await recoveryPromise;
expectType<"committed" | "known_failure" | "unresolved" | "expired">(
  recovery.kind,
);
if (recovery.kind === "committed") {
  if (recovery.operation === "requestBudget") {
    expectType<BudgetReference>(recovery.result.parentBudgetReference);
    if (recovery.result.kind === "approved") {
      expectType<BudgetReference>(recovery.result.childBudgetReference);
    }
  } else {
    expectType<BudgetReference>(recovery.result.budget.budgetReference);
    expectType<BudgetReference>(recovery.result.budget.rootBudgetReference);
  }
}

// @ts-expect-error A Budget reference cannot be replaced by an operation key.
await remote.openBudget({ reference: operationKey, resourceTypes });
// @ts-expect-error A raw string is not a validated operation key.
await remote.recoverOperation("kop_v1_not_a_valid_operation_key");

const localPromise = createKeynes();
expectType<Promise<LocalKeynes>>(localPromise);
await using local = await localPromise;
const localRoot = await local.createBudget(resourceTypes, { usdCents: 100 });

// @ts-expect-error Local Budget handles have no durable reference.
localRoot.reference;
// @ts-expect-error Local Keynes handles cannot reopen durable Budgets.
await local.openBudget({ reference: storedReference, resourceTypes });
// @ts-expect-error Local Keynes handles cannot recover remote operations.
await local.recoverOperation(operationKey);
await local.createBudget(
  resourceTypes,
  { usdCents: 100 },
  // @ts-expect-error Local root creation has no remote operation options.
  { operationKey },
);
// @ts-expect-error Local Budget requests have no remote operation options.
await localRoot.request({ usdCents: 1 }, { operationKey });
// @ts-expect-error Local Budget settlement has no remote operation options.
await localRoot.settle({ usdCents: 1 }, { operationKey });

void referenceFromOperationKey;
void operationKeyFromReference;
