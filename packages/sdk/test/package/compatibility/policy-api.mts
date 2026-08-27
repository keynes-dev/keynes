import { createKeynes, defineResources } from "@keynes/sdk";
import type { Budget, Keynes, PolicySet, ResourceSchema } from "@keynes/sdk";
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

await using keynes = await createKeynes({ resources });
expectType<Keynes<"usdCents" | "searchQueries">>(keynes);
expectType<AsyncDisposable>(keynes);

const { createBudget, close } = keynes;
const root = await createBudget({ usdCents: 100 });
expectType<Budget<"usdCents">>(root);

const { request, settle, inspect } = root;
await request({ usdCents: 10 });
await settle({ usdCents: 1 });
await inspect();
await close();

// @ts-expect-error The Resource schema fixes the complete Resource vocabulary.
await keynes.createBudget({ storageBytes: 1 });
// @ts-expect-error A Budget only accepts Resources allocated to that handle.
await root.request({ searchQueries: 1 });

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

const governed = await keynes.createBudget(
  { usdCents: 100 },
  { policies: governedPolicies },
);
await governed.request(
  { usdCents: 10 },
  { context: { customerTier: "standard" } },
);
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

const childResult = await governed.request(
  { usdCents: 10 },
  {
    context: { customerTier: "standard" },
    policies: childPolicies,
  },
);
if (childResult.status === "approved") {
  expectType<
    Budget<"usdCents", { readonly riskClass: string }, "workflow_risk_limit">
  >(childResult.budget);
}

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
