import { createKeynes, defineResources } from "@keynes/sdk";
import type {
  Budget,
  BudgetHistoryEntry,
  BudgetRequestResult,
  BudgetSnapshot,
  Keynes,
  LocalKeynes,
  PolicySet,
  ResourceSchema,
} from "@keynes/sdk";
import * as sdk from "@keynes/sdk";

function expectType<Value>(_value: Value): void {}

const resources = defineResources({
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  searchQueries: { unit: "query", accountingBehavior: "reusable" },
});

expectType<
  ResourceSchema<{
    readonly usdCents: {
      readonly unit: "cent";
      readonly accountingBehavior: "consumable";
    };
    readonly searchQueries: {
      readonly unit: "query";
      readonly accountingBehavior: "reusable";
    };
  }>
>(resources);

await using keynes = await createKeynes();
expectType<Keynes>(keynes);
expectType<LocalKeynes>(keynes);
expectType<AsyncDisposable>(keynes);

const { createBudget, close } = keynes;
const root = await createBudget(resources, { usdCents: 100 });
expectType<Budget<"usdCents">>(root);

const { request, settle, inspect } = root;
await request({ usdCents: 10 });
await settle({ usdCents: 1 });
await inspect();
await close();

// @ts-expect-error Allocation keys must belong to the supplied Resource schema.
await keynes.createBudget(resources, { storageBytes: 1 });
// @ts-expect-error A Budget only accepts Resources allocated to that handle.
await root.request({ searchQueries: 1 });

// @ts-expect-error Connection setup accepts no Resource schema.
await createKeynes({ resources });
// @ts-expect-error Explicit undefined is still a setup argument.
await createKeynes(undefined);

const extraResource = { usdCents: 1, searchQueries: 1 };
// @ts-expect-error Exact Resource checks also reject predeclared objects.
await root.request(extraResource);

declare const governedPolicies: PolicySet<
  "usdCents",
  { readonly customerTier: string },
  "customer_tier_limit"
>;
declare const childPolicies: PolicySet<
  "usdCents",
  { readonly riskClass: string },
  "workflow_risk_limit"
>;

const governedChildFromUngovernedResult = await root.request(
  { usdCents: 10 },
  { childPolicies },
);
if (governedChildFromUngovernedResult.status === "approved") {
  expectType<
    Budget<"usdCents", { readonly riskClass: string }, "workflow_risk_limit">
  >(governedChildFromUngovernedResult.budget);
  await governedChildFromUngovernedResult.budget.request(
    { usdCents: 1 },
    { context: { riskClass: "standard" } },
  );
}
await root.request(
  { usdCents: 10 },
  // @ts-expect-error Request-time Policies must be named childPolicies.
  {
    policies: childPolicies,
  },
);

const governed = await keynes.createBudget(
  resources,
  { usdCents: 100 },
  { policies: governedPolicies },
);
const governedResult = await governed.request(
  { usdCents: 10 },
  { context: { customerTier: "standard" } },
);
if (governedResult.status === "approved") {
  expectType<string>(governedResult.policyEvidence.context.customer_tier);
  expectType<"customer_tier_limit" | undefined>(
    governedResult.policyEvidence.policies[0]?.rows[0]?.reason,
  );
  // @ts-expect-error Evidence records canonical context keys.
  void governedResult.policyEvidence.context.customerTier;
}
const governedSnapshot = await governed.inspect();
for (const entry of governedSnapshot.history.entries) {
  if ("policyEvidence" in entry) {
    expectType<string>(entry.policyEvidence.context.customer_tier);
    expectType<"customer_tier_limit" | undefined>(
      entry.policyEvidence.effectiveCeilings[0]?.reasons[0]?.reason,
    );
  }
}
// @ts-expect-error Governed requests require their complete Context.
await governed.request({ usdCents: 10 });
await governed.request(
  { usdCents: 10 },
  // @ts-expect-error Governed Context rejects undeclared fields.
  { context: { customerTier: "standard", riskClass: "low" } },
);

const extraContext = { customerTier: "standard", riskClass: "low" };
// @ts-expect-error Exact Context checks also reject predeclared objects.
await governed.request({ usdCents: 10 }, { context: extraContext });

// @ts-expect-error Ungoverned requests reject Context instead of ignoring it.
await root.request({ usdCents: 10 }, { context: { customerTier: "standard" } });

const unexpectedContext = { customerTier: "standard" };
// @ts-expect-error Ungoverned Context is forbidden for predeclared objects too.
await root.request({ usdCents: 10 }, { context: unexpectedContext });

const ungovernedChildResult = await governed.request(
  { usdCents: 10 },
  { context: { customerTier: "standard" } },
);
if (ungovernedChildResult.status === "approved") {
  expectType<Budget<"usdCents">>(ungovernedChildResult.budget);
  await ungovernedChildResult.budget.request({ usdCents: 1 });
  await ungovernedChildResult.budget.request(
    { usdCents: 1 },
    // @ts-expect-error A child does not inherit its parent's governed Context.
    { context: { customerTier: "standard" } },
  );
}

const governedChildResult = await governed.request(
  { usdCents: 10 },
  {
    context: { customerTier: "standard" },
    childPolicies,
  },
);
if (governedChildResult.status === "approved") {
  expectType<
    Budget<"usdCents", { readonly riskClass: string }, "workflow_risk_limit">
  >(governedChildResult.budget);
  await governedChildResult.budget.request(
    { usdCents: 1 },
    { context: { riskClass: "low" } },
  );
  // @ts-expect-error A governed child requires its own complete Context.
  await governedChildResult.budget.request({ usdCents: 1 });
}

await governed.request(
  { usdCents: 10 },
  {
    context: { customerTier: "standard" },
    // @ts-expect-error Request-time Policies must be named childPolicies.
    policies: childPolicies,
  },
);

declare const legacyRequestResult: BudgetRequestResult<
  "usdCents",
  "parent_limit",
  { readonly riskClass: string },
  "child_limit"
>;
if (legacyRequestResult.status === "approved") {
  expectType<Budget<"usdCents", { readonly riskClass: string }, "child_limit">>(
    legacyRequestResult.budget,
  );
  expectType<"parent_limit" | undefined>(
    legacyRequestResult.policyEvidence.policies[0]?.rows[0]?.reason,
  );
}

declare const legacyHistoryEntry: BudgetHistoryEntry<
  "usdCents",
  "parent_limit"
>;
if ("policyEvidence" in legacyHistoryEntry) {
  expectType<"parent_limit" | undefined>(
    legacyHistoryEntry.policyEvidence.policies[0]?.rows[0]?.reason,
  );
}

declare const legacySnapshot: BudgetSnapshot<"usdCents", "parent_limit">;
expectType<readonly BudgetHistoryEntry<"usdCents", "parent_limit">[]>(
  legacySnapshot.history.entries,
);

// @ts-expect-error Keynes is a type-only capability with no constructor.
new Keynes();
// @ts-expect-error Budget is a type-only capability with no constructor.
new Budget();
// @ts-expect-error The package exports no Keynes runtime class value.
new sdk.Keynes();
// @ts-expect-error The package exports no Budget runtime class value.
new sdk.Budget();

// @ts-expect-error Resource installation identifiers stay private.
resources.resourceTypeId;
// @ts-expect-error Runtime identifiers stay private.
keynes.runtimeId;
// @ts-expect-error Budget identifiers stay private.
root.budgetId;
const requestResult = await root.request({ usdCents: 1 });
// @ts-expect-error Command identifiers stay private.
requestResult.commandId;
