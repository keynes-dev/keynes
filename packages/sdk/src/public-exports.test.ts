import { describe, expect, expectTypeOf, it } from "vitest";

import {
  Budget,
  Keynes,
  KeynesError,
  KeynesSdkError,
  ResourceDefinitionError,
  type AccountingBehavior,
  type BudgetRequestDenialReason,
  type BudgetRequestResult,
  type GetBudgetResult,
  type KeynesCreateOptions,
  type ResourceAmounts,
  type ResourceConfig,
  type ResourceConfigs,
  type ResourceTypeProjection,
  type ResourceUsage,
  type SettleBudgetResult,
} from "./index.js";
// @ts-expect-error Old deployment-specific public names must not remain exported.
import type { KeynesLocalError } from "./index.js";
// @ts-expect-error Old deployment-specific public names must not remain exported.
import type { LocalRequestDenialReason } from "./index.js";
// @ts-expect-error Old deployment-specific public names must not remain exported.
import type { LocalRequestResult } from "./index.js";
// @ts-expect-error Old deployment-specific public names must not remain exported.
import type { LocalResourceDefinition } from "./index.js";
// @ts-expect-error Old deployment-specific public names must not remain exported.
import type { LocalResourceDefinitions } from "./index.js";
// @ts-expect-error Procedure callers remain private implementation types.
import type { ProcedureCaller } from "./index.js";
import * as sdk from "./index.js";

type RemovedPublicTypes = readonly [
  KeynesLocalError,
  LocalRequestDenialReason,
  LocalRequestResult,
  LocalResourceDefinition,
  LocalResourceDefinitions,
  ProcedureCaller,
];

describe("package-root exports", () => {
  it("exports the local facade and accepted generated domain types", () => {
    expect(Object.keys(sdk).sort()).toEqual([
      "Budget",
      "Keynes",
      "KeynesError",
      "KeynesSdkError",
      "ResourceDefinitionError",
    ]);

    expectTypeOf<KeynesCreateOptions>().toEqualTypeOf<{
      readonly mode: "local";
    }>();
    expectTypeOf<AccountingBehavior>().toEqualTypeOf<
      "consumable" | "reusable"
    >();
    expectTypeOf<ResourceConfig>().toEqualTypeOf<{
      readonly unit: string;
      readonly accountingBehavior: AccountingBehavior;
    }>();
    expectTypeOf<ResourceConfigs>().toEqualTypeOf<
      Readonly<Record<string, ResourceConfig>>
    >();
    expectTypeOf<ResourceAmounts<"usdCents">>().toEqualTypeOf<{
      readonly usdCents?: number;
    }>();
    expectTypeOf<ResourceUsage<"usdCents">>().toEqualTypeOf<{
      readonly usdCents?: number | null;
    }>();
    expectTypeOf<BudgetRequestDenialReason<"usdCents">>().toEqualTypeOf<{
      readonly code: "insufficient_available";
      readonly resource: "usdCents";
      readonly requested: number;
      readonly available: number;
    }>();
    expectTypeOf<BudgetRequestResult<"usdCents">>().toEqualTypeOf<
      | { readonly status: "approved"; readonly budget: Budget<"usdCents"> }
      | {
          readonly status: "denied";
          readonly reasons: readonly BudgetRequestDenialReason<"usdCents">[];
        }
    >();
    expectTypeOf<ResourceTypeProjection>().toBeObject();
    expectTypeOf<GetBudgetResult>().toBeObject();
    expectTypeOf<SettleBudgetResult>().toBeObject();
    expectTypeOf<RemovedPublicTypes>().toMatchTypeOf<readonly unknown[]>();
    expectTypeOf<Budget<"usdCents">>().toBeObject();
    expect(Keynes).toBeTypeOf("function");
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
});
