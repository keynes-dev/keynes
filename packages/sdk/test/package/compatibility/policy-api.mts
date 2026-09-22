import type { NodeSqliteRuntime } from "@keynes/sdk";
declare const localRuntime: NodeSqliteRuntime;
import { createKeynes } from "@keynes/sdk";
import type {
  Budget,
  BudgetHistoryEntry,
  BudgetRequestResult,
  BudgetSnapshot,
  Keynes,
  LocalKeynes,
  Policy,
  PolicyOutput,
  PolicyRequestResult,
  PolicyResult,
  ResourceBinding,
  ResourceDefinitions,
  ResourceAmounts,
} from "@keynes/sdk";
import * as sdk from "@keynes/sdk";

// @ts-expect-error Plain declarations replace the old schema wrapper type.
export type { ResourceSchema } from "@keynes/sdk";

function expectType<Value>(_value: Value): void {}

const resources = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  searchQueries: { unit: "query", accountingBehavior: "reusable" },
};

await using keynes = await createKeynes({ runtime: localRuntime, resources });
expectType<Keynes>(keynes);
expectType<LocalKeynes>(keynes);
expectType<AsyncDisposable>(keynes);

const { createBudget, close } = keynes;
const root = await createBudget({ usdCents: 100 });
expectType<Budget<"usdCents">>(root);
const binding = await keynes.defineResources(resources);
expectType<ResourceBinding<"usdCents" | "searchQueries">>(binding);
const allocation = { usdCents: 100 };
expectType<Budget<"usdCents">>(await createBudget(allocation));
const invalidAllocation = { usdCents: 100, unknownResource: 1 };
// @ts-expect-error Unknown amount keys cannot widen configured names.
await createBudget(invalidAllocation);
const checkedDefinitions = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
} satisfies ResourceDefinitions;
expectType<ResourceBinding<"usdCents">>(
  await keynes.defineResources(checkedDefinitions),
);
// @ts-expect-error The opaque reference is not public.
void binding.bindingReference;
// @ts-expect-error Bindings expose no Resource IDs.
void binding.resourceTypeId;
// @ts-expect-error The standalone helper has been removed.
void sdk.defineResources;
// @ts-expect-error Bindings have no public constructor.
new sdk.ResourceBinding();

const { request, settle, inspect } = root;
const requestResult = await request(
  { usdCents: 10 },
  { decisionEvidence: { rule: "package", revision: 1 } },
);
if (requestResult.status === "approved" && requestResult.decisionEvidence) {
  // @ts-expect-error Public evidence is readonly.
  requestResult.decisionEvidence.rule = "changed";
}
await settle({ usdCents: 1 });
await inspect();
await close();

// @ts-expect-error Amount keys must belong to the configured Resource catalog.
await keynes.createBudget({ storageBytes: 1 });
// @ts-expect-error A Budget only accepts Resources allocated to that handle.
await root.request({ searchQueries: 1 });
// @ts-expect-error Configured declarations are required.
await createKeynes();
// @ts-expect-error Explicit undefined is still a setup argument.
await createKeynes(undefined);
const extraConfiguration = { resources, initial: 0 };
// @ts-expect-error Configuration variables cannot contain unsupported fields.
await createKeynes(extraConfiguration);
// @ts-expect-error A binding cannot replace configured declarations.
await createKeynes({ runtime: localRuntime, resources: binding });
// @ts-expect-error Positional Resource definitions creation was removed.
await createBudget(resources, allocation);
// @ts-expect-error Positional ResourceBinding creation was removed.
await createBudget(binding, allocation);
const extraResource = { usdCents: 1, searchQueries: 1 };
// @ts-expect-error Exact Resource checks also reject predeclared objects.
await root.request(extraResource);

// @ts-expect-error Managed Policy types are no longer public.
type _RemovedPolicySet = sdk.PolicySet;
// @ts-expect-error Managed Policy authoring is no longer public.
type _RemovedPolicyAuthor = typeof sdk.definePolicySql;
// @ts-expect-error Legacy request options are rejected.
await root.request({ usdCents: 1 }, { policies: undefined });
// @ts-expect-error Legacy request context is rejected.
await root.request({ usdCents: 1 }, { context: undefined });
// @ts-expect-error Legacy child Policies are rejected.
await root.request({ usdCents: 1 }, { childPolicies: undefined });
// @ts-expect-error Legacy Policy evidence is rejected.
await root.request({ usdCents: 1 }, { policyEvidence: undefined });

const policyFreeResult = await root.request({ usdCents: 1 });
expectType<BudgetRequestResult<"usdCents">>(policyFreeResult);

const transformedRoot = await keynes.createBudget({
  usdCents: 100,
  searchQueries: 100,
});
const policy = ((proposal) => {
  expectType<ResourceAmounts<"usdCents">>(proposal);
  return { kind: "prepared", request: { searchQueries: 1 } };
}) satisfies Policy<"usdCents", "searchQueries">;
const policyOutput = {
  kind: "prepared",
  request: { searchQueries: 1 },
} satisfies PolicyOutput<"searchQueries">;
expectType<PolicyOutput<"searchQueries">>(policyOutput);
declare const policyResult: PolicyResult<"searchQueries">;
expectType<PolicyResult<"searchQueries">>(policyResult);

declare const policyRequestResult: PolicyRequestResult<
  "searchQueries",
  BudgetRequestResult<"searchQueries">
>;
expectType<
  PolicyRequestResult<"searchQueries", BudgetRequestResult<"searchQueries">>
>(policyRequestResult);

const transformedResult = await transformedRoot.request(
  { usdCents: 1 },
  { policy },
);
// @ts-expect-error Policy preparation is not a public Budget operation.
await transformedRoot.prepareRequest({ usdCents: 1 }, { policy });
// @ts-expect-error Policy preparation is not a public Budget operation.
await transformedRoot.prepareRequest({ usdCents: 1 });
if (
  transformedResult.status === "submitted" &&
  transformedResult.allocation.status === "approved"
) {
  const transformedChild = transformedResult.allocation.budget;
  expectType<Budget<"searchQueries", "searchQueries" | "usdCents">>(
    transformedChild,
  );
  await transformedChild.request({ searchQueries: 1 });
  // @ts-expect-error A transformed child does not retain only proposal keys.
  await transformedChild.request({ usdCents: 1 });
}

const invalidPolicy = ((proposal) => ({
  kind: "prepared",
  request: { unknownResource: proposal.usdCents },
})) satisfies Policy<"usdCents", "unknownResource">;
// @ts-expect-error A Policy cannot name Resources outside the parent Budget.
await transformedRoot.request({ usdCents: 1 }, { policy: invalidPolicy });

declare const legacyRequestResult: BudgetRequestResult<"usdCents">;
if (legacyRequestResult.status === "approved") {
  expectType<Budget<"usdCents">>(legacyRequestResult.budget);
}
declare const legacyHistoryEntry: BudgetHistoryEntry<"usdCents">;
declare const legacySnapshot: BudgetSnapshot<"usdCents">;
expectType<readonly BudgetHistoryEntry<"usdCents">[]>(
  legacySnapshot.history.entries,
);
void legacyHistoryEntry;

// @ts-expect-error Keynes is a type-only capability with no constructor.
new Keynes();
// @ts-expect-error Budget is a type-only capability with no constructor.
new Budget();
// @ts-expect-error The package exports no Keynes runtime class value.
new sdk.Keynes();
// @ts-expect-error The package exports no Budget runtime class value.
new sdk.Budget();
// @ts-expect-error Resource installation identifiers stay private.
void resources.resourceTypeId;
// @ts-expect-error Runtime identifiers stay private.
void keynes.runtimeId;
// @ts-expect-error Budget identifiers stay private.
void root.budgetId;
// @ts-expect-error Command identifiers stay private.
void requestResult.commandId;
