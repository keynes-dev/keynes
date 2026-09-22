import type { NodeSqliteRuntime, PostgresRuntime } from "@keynes/sdk";
declare const localRuntime: NodeSqliteRuntime;
declare const remoteRuntime: PostgresRuntime;
import { createKeynes, createOperationKey } from "@keynes/sdk";
import type {
  Budget,
  BudgetReference,
  LocalKeynes,
  OperationKey,
  RecoverOperationResult,
  RemoteKeynes,
  RemoteBudget,
  ResourceBinding,
  ResourceDefinitions,
} from "@keynes/sdk";

import { importedResources } from "./configured-resources.mjs";

function expectType<Value>(_value: Value): void {}

const resourceTypes = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  searchQueries: { unit: "query", accountingBehavior: "consumable" },
};

declare const storedReference: BudgetReference;

expectType<() => OperationKey>(createOperationKey);
const operationKey = createOperationKey();
expectType<OperationKey>(operationKey);

// @ts-expect-error Operation keys and Budget references are distinct values.
const referenceFromOperationKey: BudgetReference = operationKey;
// @ts-expect-error Budget references cannot identify operation recovery records.
const operationKeyFromReference: OperationKey = storedReference;

const remotePromise = createKeynes({
  runtime: remoteRuntime,
  resources: resourceTypes,
});
expectType<Promise<RemoteKeynes>>(remotePromise);
await using remote = await remotePromise;

const root = await remote.createBudget({ usdCents: 1_000 }, { operationKey });
expectType<BudgetReference>(root.reference);
const binding = await remote.defineResources(resourceTypes, {
  operationKey: createOperationKey(),
});
expectType<ResourceBinding<"usdCents" | "searchQueries">>(binding);
const allocation = { usdCents: 100 };
expectType<RemoteBudget<"usdCents">>(await remote.createBudget(allocation));
expectType<RemoteBudget<"usdCents">>(
  await remote.createBudget({ usdCents: 0 }),
);
const invalidAllocation = { usdCents: 100, unknownResource: 0 };
// @ts-expect-error Unknown allocation variables cannot widen the bound names.
await remote.createBudget(invalidAllocation);
// @ts-expect-error Unknown allocation variables cannot widen raw definition names.
await remote.createBudget({ usdCents: 1, unknownResource: 0 });
const checkedDefinitions = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
} satisfies ResourceDefinitions;
expectType<ResourceBinding<"usdCents">>(
  await remote.defineResources(checkedDefinitions),
);
// @ts-expect-error Bindings expose no reference.
void binding.bindingReference;
// @ts-expect-error Bindings expose no producing client.
void binding.client;

const requestResult = await root.request({ usdCents: 25 }, { operationKey });
if (requestResult.status === "approved") {
  expectType<BudgetReference>(requestResult.budget.reference);
}
await root.request({ usdCents: 1 });
const remoteSettlement = await root.settle({ usdCents: 19 }, { operationKey });
const [remoteSettledResource] = remoteSettlement.budget.resources;
if (remoteSettledResource === undefined) {
  throw new Error("expected remote settlement Resource");
}
expectType<number>(remoteSettledResource.available);
expectType<number>(remoteSettledResource.committed);
// @ts-expect-error Explicit undefined is not a remote request option.
await root.request({ usdCents: 1 }, undefined);
declare const optionalRemoteOptions:
  | { readonly operationKey: OperationKey }
  | undefined;
// @ts-expect-error Optional option variables cannot supply a remote request option.
await root.request({ usdCents: 1 }, optionalRemoteOptions);

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
  if (recovery.operation === "defineResources") {
    expectType<ResourceBinding<string>>(recovery.result);
    // @ts-expect-error Recovered bindings cannot supply configured creation names.
    await remote.createBudget(recovery.result, { recoveredName: 1 });
    // @ts-expect-error Recovery must not expose private receipt references.
    void recovery.result.bindingReference;
  } else if (recovery.operation === "requestBudget") {
    expectType<BudgetReference>(recovery.result.parentBudgetReference);
    if (recovery.result.decisionEvidence !== undefined) {
      // @ts-expect-error Recovered evidence remains readonly for package consumers.
      recovery.result.decisionEvidence.rule = "changed";
    }
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

const localPromise = createKeynes({
  runtime: localRuntime,
  resources: importedResources,
});
expectType<Promise<LocalKeynes>>(localPromise);
await using local = await localPromise;
const localRoot = await local.createBudget({ usdCents: 100 });

// @ts-expect-error Local Budget handles have no durable reference.
void localRoot.reference;
// @ts-expect-error Local Keynes handles cannot reopen durable Budgets.
await local.openBudget({ reference: storedReference, resourceTypes });
// @ts-expect-error Local Keynes handles cannot recover remote operations.
await local.recoverOperation(operationKey);
// @ts-expect-error Local root creation has no remote operation options.
await local.createBudget({ usdCents: 100 }, { operationKey });
// @ts-expect-error Local Budget requests have no remote operation options.
await localRoot.request({ usdCents: 1 }, { operationKey });
// @ts-expect-error Local Budget settlement has no remote operation options.
await localRoot.settle({ usdCents: 1 }, { operationKey });

void referenceFromOperationKey;
void operationKeyFromReference;

// @ts-expect-error Configured declarations are required.
createKeynes();
// @ts-expect-error Connection-only initialization was removed.
createKeynes({ runtime: remoteRuntime });
const extraConfiguration = { resources: resourceTypes, initial: 0 };
// @ts-expect-error Configuration variables cannot contain unsupported fields.
createKeynes(extraConfiguration);
// @ts-expect-error A binding cannot replace declarations.
createKeynes({ runtime: localRuntime, resources: binding });
// @ts-expect-error Positional Resource definitions creation was removed.
await remote.createBudget(resourceTypes, { usdCents: 1 });
// @ts-expect-error Positional ResourceBinding creation was removed.
await remote.createBudget(binding, { usdCents: 1 });
const localExtras = { usdCents: 1, unknownResource: 0 };
// @ts-expect-error Imported declaration names stay exact for variables.
await local.createBudget(localExtras);
const inline = await createKeynes({
  runtime: localRuntime,
  resources: {
    usdCents: { unit: "cent", accountingBehavior: "consumable" },
    searchQueries: { unit: "query", accountingBehavior: "consumable" },
  },
});
const zeroMember = await inline.createBudget({ usdCents: 1, searchQueries: 0 });
expectType<Budget<"usdCents" | "searchQueries">>(zeroMember);
await zeroMember.request({ searchQueries: 0 });
await zeroMember.settle({ searchQueries: 0 });
const moneyOnly = await inline.createBudget({ usdCents: 1 });
expectType<Budget<"usdCents">>(moneyOnly);
// @ts-expect-error Omitted declared names are not Budget members.
await moneyOnly.request({ searchQueries: 0 });
// @ts-expect-error Known extra names cannot widen inline configuration.
await inline.createBudget({ unknownResource: 0 });
await local.defineResources({
  addedLater: { unit: "unit", accountingBehavior: "consumable" },
});
// @ts-expect-error Explicit catalog additions cannot widen configured names.
await local.createBudget({ addedLater: 0 });
