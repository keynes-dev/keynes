import { nodeSqlite } from "@keynes/node-sqlite";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  KeynesError,
  KeynesSdkError,
  ResourceDefinitionError,
  createKeynes,
  type Budget,
  type BudgetRequestAvailabilityReason,
  type BudgetRequestDenialReason,
  type BudgetRequestResult,
  type ResourceDefinitions,
} from "../../../src/index.js";
import * as sdk from "../../../src/index.js";

// @ts-expect-error Managed Policy authoring must not remain public.
type RemovedDefinePolicy = typeof sdk.definePolicy;
// @ts-expect-error Managed Policy authoring must not remain public.
type RemovedDefinePolicySql = typeof sdk.definePolicySql;
// @ts-expect-error Managed Policy authoring must not remain public.
type RemovedPolicySet = typeof sdk.policySet;
// @ts-expect-error Managed Policy authoring must not remain public.
type RemovedPolicyValue = typeof sdk.policyValue;
// @ts-expect-error Managed Policy types must not remain public.
type RemovedBudgetRequestPolicyReason = sdk.BudgetRequestPolicyReason;
// @ts-expect-error Managed Policy types must not remain public.
type RemovedPolicyDefinition = sdk.PolicyDefinition<string, object, string>;
// @ts-expect-error Managed Policy types must not remain public.
type RemovedPolicyEvidence = sdk.PolicyEvidence;
// @ts-expect-error Managed Policy types must not remain public.
type RemovedPolicySetType = sdk.PolicySet<string, object, string>;
// @ts-expect-error Managed Policy validation must not remain public.
type RemovedPolicyValidationError = typeof sdk.PolicyValidationError;

type RemovedPolicyPublicTypes = readonly [
  RemovedBudgetRequestPolicyReason,
  RemovedPolicyDefinition,
  RemovedPolicyEvidence,
  RemovedPolicySetType,
  RemovedDefinePolicy,
  RemovedDefinePolicySql,
  RemovedPolicySet,
  RemovedPolicyValue,
  RemovedPolicyValidationError,
];

describe("package-root exports", () => {
  it("exports ordinary allocation types and no managed Policy API", () => {
    expect(Object.keys(sdk).sort()).toEqual([
      "CONTRACT_DIGEST",
      "CommittedResponseLostError",
      "KeynesError",
      "KeynesSdkError",
      "REMOTE_CONTRACT",
      "REMOTE_PROCEDURES_DIGEST",
      "ResourceDefinitionError",
      "createKeynes",
      "createKeynesClient",
      "createOperationKey",
      "createRemoteKeynesClient",
    ]);
    expectTypeOf<ResourceDefinitions>().toBeObject();
    expectTypeOf<BudgetRequestAvailabilityReason<"usdCents">>().toBeObject();
    expectTypeOf<BudgetRequestDenialReason<"usdCents">>().toEqualTypeOf<
      BudgetRequestAvailabilityReason<"usdCents">
    >();
    expectTypeOf<BudgetRequestResult<"usdCents">>().toBeObject();
    expectTypeOf<RemovedPolicyPublicTypes>().toMatchTypeOf<
      readonly unknown[]
    >();
    expectTypeOf<Budget<"usdCents">>().toBeObject();
    expect(createKeynes).toBeTypeOf("function");
    expect(KeynesError).toBeTypeOf("function");
    expect(KeynesSdkError).toBeTypeOf("function");
    expect(ResourceDefinitionError).toBeTypeOf("function");
  });

  it("keeps Budget request and root Resource inference", () => {
    async function checkInference() {
      const keynes = await createKeynes({
        runtime: nodeSqlite(),
        resources: {
          usdCents: { unit: "cent", accountingBehavior: "consumable" },
          searchQueries: { unit: "query", accountingBehavior: "reusable" },
        },
      });
      const root = await keynes.createBudget({ usdCents: 100 });
      expectTypeOf(root).toEqualTypeOf<Budget<"usdCents">>();
      void root.request({ usdCents: 1 });
      // @ts-expect-error Root request keys stay within its allocated Resources.
      void root.request({ searchQueries: 1 });
      // @ts-expect-error Local creation no longer accepts Policy options.
      void keynes.createBudget({ usdCents: 1 }, { policies: undefined });
      // @ts-expect-error Request options no longer accept managed Policy context.
      void root.request({ usdCents: 1 }, { context: undefined });
      // @ts-expect-error Request options no longer accept child Policy attachments.
      void root.request({ usdCents: 1 }, { childPolicies: undefined });
      // @ts-expect-error Request options no longer accept Policy evidence.
      void root.request({ usdCents: 1 }, { policyEvidence: undefined });
    }

    expectTypeOf(checkInference).toBeFunction();
  });
});
