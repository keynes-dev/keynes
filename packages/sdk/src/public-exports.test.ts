import { describe, expect, expectTypeOf, it } from "vitest";

import {
  Budget,
  Keynes,
  KeynesError,
  KeynesLocalError,
  ResourceDefinitionError,
  type GetBudgetResult,
  type KeynesCreateOptions,
  type LocalRequestResult,
  type LocalResourceDefinitions,
  type ResourceAmounts,
  type ResourceTypeProjection,
  type ResourceUsage,
  type SettleBudgetResult,
} from "./index.js";
import * as sdk from "./index.js";

describe("package-root exports", () => {
  it("exports the local facade and accepted generated domain types", () => {
    expect(Object.keys(sdk).sort()).toEqual([
      "Budget",
      "Keynes",
      "KeynesError",
      "KeynesLocalError",
      "ResourceDefinitionError",
    ]);

    expectTypeOf<KeynesCreateOptions>().toEqualTypeOf<{
      readonly mode: "local";
    }>();
    expectTypeOf<LocalResourceDefinitions>().toMatchTypeOf<
      Readonly<Record<string, { readonly unit: string }>>
    >();
    expectTypeOf<ResourceAmounts<"usdCents">>().toMatchTypeOf<{
      readonly usdCents?: number;
    }>();
    expectTypeOf<ResourceUsage<"usdCents">>().toMatchTypeOf<{
      readonly usdCents?: number | null;
    }>();
    expectTypeOf<LocalRequestResult<"usdCents">>().toBeObject();
    expectTypeOf<ResourceTypeProjection>().toBeObject();
    expectTypeOf<GetBudgetResult>().toBeObject();
    expectTypeOf<SettleBudgetResult>().toBeObject();
    expectTypeOf<Budget<"usdCents">>().toBeObject();
    expect(Keynes).toBeTypeOf("function");
    expect(KeynesError).toBeTypeOf("function");
    expect(KeynesLocalError).toBeTypeOf("function");
    expect(ResourceDefinitionError).toBeTypeOf("function");
  });

  it("keeps hosts, identities, callers, databases, and fault controls private", () => {
    for (const privateName of [
      "PGlite",
      "ProcedureCaller",
      "createKeynesClient",
      "openLocalKeynes",
      "openProductLocalKeynes",
      "clientFor",
      "FIXTURE_TENANT_ID",
      "FIXTURE_PRINCIPALS",
      "PRODUCT_TENANT_ID",
      "PRODUCT_PRINCIPAL_ID",
      "RollbackCheckpoint",
      "CommittedResponseLostError",
      "dropResponseAfterCommitOnce",
    ]) {
      expect(privateName in sdk).toBe(false);
    }
  });
});
