import { describe, expect, expectTypeOf, it } from "vitest";

import {
  KeynesError,
  KeynesSdkError,
  PolicyValidationError,
  ResourceDefinitionError,
  createKeynes,
  definePolicy,
  definePolicySql,
  policySet,
  policyValue,
  type AccountingBehavior,
  type Budget,
  type BudgetHistoryEntry,
  type BudgetResourceSnapshot,
  type BudgetRequestAvailabilityReason,
  type BudgetRequestDenialReason,
  type BudgetRequestPolicyReason,
  type BudgetRequestResult,
  type BudgetSnapshot,
  type BudgetState,
  type Keynes,
  type LocalKeynes,
  type NamedResourceAmount,
  type PolicyEvidence,
  type PolicySet,
  type ResourceAmounts,
  type ResourceDefinition,
  type ResourceDefinitions,
  type ResourceBinding,
  type ResourceUsage,
  type Settlement,
} from "../../../src/index.js";
// @ts-expect-error Old deployment-specific public names must not remain exported.
import type { KeynesLocalError } from "../../../src/index.js";
// @ts-expect-error Old deployment-specific public names must not remain exported.
import type { LocalRequestDenialReason } from "../../../src/index.js";
// @ts-expect-error Old deployment-specific public names must not remain exported.
import type { LocalRequestResult } from "../../../src/index.js";
// @ts-expect-error Old deployment-specific public names must not remain exported.
import type { LocalResourceDefinition } from "../../../src/index.js";
// @ts-expect-error Old deployment-specific public names must not remain exported.
import type { LocalResourceDefinitions } from "../../../src/index.js";
// @ts-expect-error The schema-first API replaced ResourceConfig.
import type { ResourceConfig } from "../../../src/index.js";
// @ts-expect-error The schema-first API replaced ResourceConfigs.
import type { ResourceConfigs } from "../../../src/index.js";
// @ts-expect-error Generated wire projections stay behind the public facade.
import type { GetBudgetResult } from "../../../src/index.js";
// @ts-expect-error Resource installation identifiers stay private.
import type { ResourceTypeProjection } from "../../../src/index.js";
// @ts-expect-error Generated settlement results stay behind the public facade.
import type { SettleBudgetResult } from "../../../src/index.js";
// @ts-expect-error Procedure callers remain private implementation types.
import type { ProcedureCaller } from "../../../src/index.js";
// @ts-expect-error Command executors remain private implementation types.
import type { CommandExecutor } from "../../../src/index.js";
// @ts-expect-error Authority-boundary validators remain private helpers.
import type { validateOperationInputIssues } from "../../../src/index.js";
import * as sdk from "../../../src/index.js";
// @ts-expect-error Plain definitions replace the standalone schema type.
import type { ResourceSchema } from "../../../src/index.js";

type RemovedPublicTypes = readonly [
  ResourceSchema,
  KeynesLocalError,
  LocalRequestDenialReason,
  LocalRequestResult,
  LocalResourceDefinition,
  LocalResourceDefinitions,
  ResourceConfig,
  ResourceConfigs,
  GetBudgetResult,
  ResourceTypeProjection,
  SettleBudgetResult,
  ProcedureCaller,
  CommandExecutor,
  typeof validateOperationInputIssues,
];

describe("package-root exports", () => {
  it("exports the local facade and accepted generated domain types", () => {
    expect(Object.keys(sdk).sort()).toEqual([
      "KeynesError",
      "KeynesSdkError",
      "PolicyValidationError",
      "ResourceDefinitionError",
      "createKeynes",
      "createOperationKey",
      "definePolicy",
      "definePolicySql",
      "policySet",
      "policyValue",
    ]);

    expectTypeOf<AccountingBehavior>().toEqualTypeOf<
      "consumable" | "reusable"
    >();
    expectTypeOf<ResourceDefinition>().toEqualTypeOf<{
      readonly unit: string;
      readonly accountingBehavior: AccountingBehavior;
    }>();
    expectTypeOf<ResourceDefinitions>().toEqualTypeOf<
      Readonly<Record<string, ResourceDefinition>>
    >();
    expectTypeOf<ResourceBinding<"usdCents">>().toBeObject();
    expectTypeOf<ResourceAmounts<"usdCents">>().toEqualTypeOf<{
      readonly usdCents?: number;
    }>();
    expectTypeOf<ResourceUsage<"usdCents">>().toEqualTypeOf<{
      readonly usdCents?: number | null;
    }>();
    expectTypeOf<BudgetRequestAvailabilityReason<"usdCents">>().toEqualTypeOf<{
      readonly code: "insufficient_available";
      readonly resource: "usdCents";
      readonly requested: number;
      readonly available: number;
    }>();
    expectTypeOf<BudgetRequestDenialReason<"usdCents">>().toEqualTypeOf<
      | BudgetRequestAvailabilityReason<"usdCents">
      | BudgetRequestPolicyReason<"usdCents", never>
    >();
    expectTypeOf<BudgetRequestResult<"usdCents">>().toEqualTypeOf<
      | { readonly status: "approved"; readonly budget: Budget<"usdCents"> }
      | {
          readonly status: "denied";
          readonly reasons: readonly BudgetRequestDenialReason<"usdCents">[];
        }
    >();
    expectTypeOf<BudgetState<"usdCents">>().toBeObject();
    expectTypeOf<BudgetResourceSnapshot<"usdCents">>().toBeObject();
    expectTypeOf<BudgetSnapshot<"usdCents">>().toBeObject();
    expectTypeOf<Settlement<"usdCents">>().toBeObject();
    expectTypeOf<NamedResourceAmount<"usdCents">>().toBeObject();
    expectTypeOf<BudgetHistoryEntry<"usdCents">>().toBeObject();
    expectTypeOf<
      PolicyEvidence<
        "usdCents",
        { readonly customerTier: string },
        "customer_tier_limit"
      >["context"]
    >().toEqualTypeOf<{ readonly customer_tier: string }>();
    expectTypeOf<RemovedPublicTypes>().toMatchTypeOf<readonly unknown[]>();
    expectTypeOf<Budget<"usdCents">>().toBeObject();
    expect(createKeynes).toBeTypeOf("function");
    expect(definePolicy).toBeTypeOf("function");
    expect(definePolicySql).toBeTypeOf("function");
    expect(sdk).not.toHaveProperty("defineResources");
    expect(sdk).not.toHaveProperty("ResourceBinding");
    expect(policySet).toBeTypeOf("function");
    expect(policyValue).toBeTypeOf("object");
    expect(sdk).not.toHaveProperty("Budget");
    expect(sdk).not.toHaveProperty("Keynes");
    expect(KeynesError).toBeTypeOf("function");
    expect(KeynesSdkError).toBeTypeOf("function");
    expect(PolicyValidationError).toBeTypeOf("function");
    expect(ResourceDefinitionError).toBeTypeOf("function");
  });

  it("keeps Budget request keys within the handle's Resource names", () => {
    function checkRequestTypes(budget: Budget<"usdCents" | "searchQueries">) {
      void budget.request({ usdCents: 1 });
      const extra = { usdCents: 1, tokens: 1 };
      // @ts-expect-error tokens is not part of this Budget handle.
      void budget.request(extra);
      // @ts-expect-error Extra Resource keys also fail on object literals.
      void budget.request({ usdCents: 1, tokens: 1 });
    }

    expectTypeOf(checkRequestTypes).toBeFunction();
  });

  it("configures Resource declarations at startup and narrows each root to its amounts", () => {
    async function checkCreateTypes(
      governedPolicies: PolicySet<
        "usdCents",
        { readonly customerTier: string },
        "customer_tier_limit"
      >,
      searchPolicies: PolicySet<
        "searchQueries",
        { readonly region: string },
        "regional_limit"
      >,
    ) {
      const resources = {
        usdCents: { unit: "cent", accountingBehavior: "consumable" },
        searchQueries: { unit: "query", accountingBehavior: "reusable" },
      };
      const keynes = await createKeynes({ resources });
      expectTypeOf(keynes).toEqualTypeOf<
        LocalKeynes<"usdCents" | "searchQueries">
      >();
      expectTypeOf(keynes).toEqualTypeOf<
        Keynes<"usdCents" | "searchQueries">
      >();

      const root = await keynes.createBudget({ usdCents: 100 });
      expectTypeOf(root).toEqualTypeOf<Budget<"usdCents">>();
      const binding = await keynes.defineResources(resources);
      expectTypeOf(binding).toEqualTypeOf<
        ResourceBinding<"usdCents" | "searchQueries">
      >();
      const allocation = { usdCents: 100 };
      const configuredRoot = await keynes.createBudget(allocation);
      expectTypeOf(configuredRoot).toEqualTypeOf<Budget<"usdCents">>();
      const unknownAllocation = { usdCents: 1, storageBytes: 1 };
      // @ts-expect-error Startup declarations reject unknown root amounts.
      void keynes.createBudget(unknownAllocation);
      // @ts-expect-error Binding references remain private.
      void binding.bindingReference;
      // @ts-expect-error Resource identities remain private.
      void binding.resourceTypeId;
      // @ts-expect-error Only authority-produced bindings carry the opaque brand.
      const copied: ResourceBinding<"usdCents"> = {};
      void copied;
      const checked = {
        usdCents: { unit: "cent", accountingBehavior: "consumable" },
      } satisfies ResourceDefinitions;
      expectTypeOf(await keynes.defineResources(checked)).toEqualTypeOf<
        ResourceBinding<"usdCents">
      >();
      // @ts-expect-error The root binds only allocated Resource names.
      void root.request({ searchQueries: 1 });
      // @ts-expect-error Allocation keys must belong to the configured schema.
      void keynes.createBudget({ storageBytes: 1 });

      const governed = await keynes.createBudget(
        { usdCents: 100 },
        { policies: governedPolicies },
      );
      expectTypeOf(governed).toEqualTypeOf<
        Budget<
          "usdCents",
          { readonly customerTier: string },
          "customer_tier_limit"
        >
      >();
      const usdAllocation = { usdCents: 100 };
      const incompatibleOptions = { policies: searchPolicies };
      // @ts-expect-error Root Policies may refer only to allocated Resources.
      void keynes.createBudget(usdAllocation, incompatibleOptions);

      // @ts-expect-error Explicit undefined is still an argument.
      void createKeynes(undefined);
      void createKeynes({
        resources,
        databaseUrl: "postgresql://example.invalid/keynes",
      });
    }

    expectTypeOf(checkCreateTypes).toBeFunction();
  });
});
