import { describe, expect, expectTypeOf, it } from "vitest";

import {
  KeynesError,
  KeynesSdkError,
  ResourceDefinitionError,
  createKeynes,
  defineResources,
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
  type NamedResourceAmount,
  type ResourceAmounts,
  type ResourceDefinition,
  type ResourceDefinitions,
  type ResourceSchema,
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

type RemovedPublicTypes = readonly [
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
      "ResourceDefinitionError",
      "createKeynes",
      "defineResources",
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
    expectTypeOf<ResourceSchema<ResourceDefinitions>>().toBeObject();
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
    expectTypeOf<RemovedPublicTypes>().toMatchTypeOf<readonly unknown[]>();
    expectTypeOf<Budget<"usdCents">>().toBeObject();
    expect(createKeynes).toBeTypeOf("function");
    expect(defineResources).toBeTypeOf("function");
    expect(sdk).not.toHaveProperty("Budget");
    expect(sdk).not.toHaveProperty("Keynes");
    expect(KeynesError).toBeTypeOf("function");
    expect(KeynesSdkError).toBeTypeOf("function");
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

  it("requires one complete Resource schema when opening a local runtime", () => {
    async function checkCreateTypes() {
      const resources = defineResources({
        usdCents: { unit: "cent", accountingBehavior: "consumable" },
      });
      const keynes = await createKeynes({ resources });
      expectTypeOf(keynes).toEqualTypeOf<Keynes<"usdCents">>();
      // @ts-expect-error The schema-first factory requires options.
      void createKeynes();
      // @ts-expect-error Remote API-key discovery is not implemented yet.
      void createKeynes({ resources, apiKey: "keynes_test" });
      // @ts-expect-error Resource definitions must be sealed into a schema first.
      void createKeynes({ resources: resources.definitions });
      // @ts-expect-error Explicit undefined is not a creation-options object.
      void createKeynes(undefined);
    }

    expectTypeOf(checkCreateTypes).toBeFunction();
  });
});
