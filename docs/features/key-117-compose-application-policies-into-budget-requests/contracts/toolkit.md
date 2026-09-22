# Policy request and toolkit contract

This is the implemented KEY-117 public contract.

## SDK entry points

Policy-free calls retain their current signatures and results:

```ts
await budget.request({ usdCents: 25 });
await remoteBudget.request(
  { usdCents: 25 },
  { operationKey, decisionEvidence },
);
```

One Policy may be supplied for a fresh decision:

```ts
const result = await budget.request(
  { usdCents: 25 },
  {
    policy: async (proposal) =>
      customerTier === "pro"
        ? { kind: "prepared", request: proposal }
        : { kind: "rejected", code: "tier_not_allowed" },
  },
);
```

Preparation without allocation uses the same callback and validation:

```ts
const policyResult = await budget.prepareRequest({ usdCents: 25 }, { policy });
```

`prepareRequest` requires a Policy in v1. Applications that already have a final envelope can retain it directly. Adding a no-op preview wrapper for direct requests has no demonstrated value.

## Policy and results

The SDK exports these types:

```ts
type Policy<ProposalNames extends string, FinalNames extends string> = (
  proposal: ResourceAmounts<ProposalNames>,
) => PolicyOutput<FinalNames> | Promise<PolicyOutput<FinalNames>>;

type PolicyOutput<Names extends string> =
  | { readonly kind: "prepared"; readonly request: ResourceAmounts<Names> }
  | { readonly kind: "rejected"; readonly code: string }
  | { readonly kind: "review_required"; readonly code: string }
  | { readonly kind: "failed"; readonly code: string };
```

The public contract preserves these semantics:

- The SDK captures the proposal before invoking Policy and passes a deep-readonly value.
- Policy runs exactly once for a fresh decision.
- Result objects contain only fields for their discriminant. Codes match `^[a-z][a-z0-9_]{0,63}$` and contain no secrets.
- A thrown or rejected value becomes a controlled `failed` result without retaining the raw value.
- A malformed result becomes `failed` with an SDK-owned code.
- Internal SDK defects and client lifecycle errors remain rejected Promises rather than Policy results.

The final implementation must derive exact option and return types from existing `Budget` and `RemoteBudget` contracts where possible. It must not introduce casts that claim an original proposal key remains after Policy transformation.

## Integrated request results

Policy-free `request` returns its existing `BudgetRequestResult` or `RemoteBudgetRequestResult` unchanged.

A Policy-enabled request returns one of:

- `{ status: 'not_submitted', policy: RejectedPolicyResult | ReviewPolicyResult | FailedPolicyResult }`
- `{ status: 'submitted', policy: PreparedPolicyResult, allocation: BudgetRequestResult<FinalNames> }`

Remote replay metadata remains inside the existing allocation result. An authoritative denial is `submitted` because Keynes processed the final command. It is not a Policy rejection.

This wrapper is only for Policy-enabled calls. It prevents `approved`, `denied`, `rejected` and `failed` from sharing one ambiguous status field.

## Validation and invocation order

For a Policy-enabled request:

1. Admit the public SDK operation using existing lifecycle rules.
2. Validate that the options contain at most supported fields and that `policy` is callable. For Remote, reject `policy` plus `operationKey` now.
3. Capture and validate the proposal once without invoking accessors or reading inherited values.
4. Invoke Policy once with the captured proposal.
5. Capture and validate the complete Policy output.
6. Return a non-submittable result or submit the prepared envelope through the existing command path.
7. Preserve allocation results, errors, evidence and transaction ownership unchanged.

Calls after close reject before steps 2 through 5. An admitted asynchronous callback participates in the existing close drain. Synchronous callback throws become asynchronous Policy failure results because the public method remains Promise-returning.

## Resource validation and typing

Proposal and final envelopes use existing SDK member names and Amount rules. A final request must be non-empty. Missing Resources stay missing; explicit zero stays present. The SDK does not coerce, round, reduce or add keys.

The parent Budget's `Names` type bounds both proposal and final names. Policy-free inference keeps `Extract<keyof Resources, Names>`. Policy-enabled inference uses the Policy's declared `FinalNames`. Type tests must reject a Policy that claims names outside the parent vocabulary and must prove that a transformed child does not expose only the original proposal keys.

## Preview, recovery and replay

`prepareRequest` performs steps 1 through 5 and never invokes a runtime adapter. Its result is byte-equivalent under canonical serialization to the Policy portion of an integrated call with the same deterministic inputs.

Remote recovery is explicit:

1. Prepare the request.
2. Finalize bounded `decisionEvidence`.
3. Persist the trusted authority and parent reference, final request, evidence and operation key.
4. Call ordinary `remoteBudget.request(finalRequest, { operationKey, decisionEvidence })` without Policy.
5. Retry that exact command after an ambiguous response.

Replay never invokes Policy, customer storage or providers. Changed request or evidence under the same key conflicts. A new key is a new allocation attempt, and the application decides whether the retained preparation is still fresh.

Local requests expose no reusable command key. Repeating submission can allocate twice. Preparation adds no persistence.

## Optional `@keynes/policy` package

The package keeps existing parameter exports at its root and optional Zod support at `@keynes/policy/zod`. It depends on `@keynes/sdk` for public Policy types. The SDK never depends on the toolkit.

Plain SDK Policies need no toolkit. A configured Policy uses one constructor:

```ts
import type { PolicyOutput, ResourceAmounts } from "@keynes/sdk";

const configured = configurePolicy({
  declaration,
  run: (
    proposal: ResourceAmounts<"usdCents">,
    values: Readonly<{ orderLimit: number }>,
  ): PolicyOutput<"usdCents"> =>
    (proposal.usdCents ?? 0) <= values.orderLimit
      ? { kind: "prepared", request: proposal }
      : { kind: "rejected", code: "order_limit_exceeded" },
});

await budget.request({ usdCents: 25 }, { policy: configured.policy });
```

Without `snapshot`, `configurePolicy` validates and selects declaration initials once. With `snapshot`, it calls `restoreParameterSnapshot(declaration, snapshot)` once. It returns the SDK-compatible `policy` and selected parameter identities. It does not create a new snapshot per request.

Existing `createParameterSnapshot`, `overrideParameterSnapshot` and `restoreParameterSnapshot` names and bytes remain unchanged. Explicit snapshot use is for retained configuration versions, overrides and tests.

The toolkit may expose `recordPolicyResult` to capture the selected parameter identities, caller-selected strict JSON and one SDK Policy result. Records contain no automatic time, random ID, snapshot values, closure state, raw errors or provider data. A record is not a full fixture, proof of execution or Budget authority.

The toolkit defines no comparison or rule-composition helper. Applications express greater-than, less-than, equality, combinations, reductions and external-assessment rules in ordinary Policy code.

## Recorded assessment example

The fixture defines an application-owned value such as:

```ts
type RiskAssessment =
  | {
      readonly kind: "available";
      readonly risk: "low" | "high";
      readonly confidence: number;
    }
  | { readonly kind: "unavailable"; readonly code: string };
```

Customer code validates the provider response before constructing this value. Policy closes over it. `unavailable` yields a failed Policy result unless the customer explicitly chooses a fallback. Tests supply recorded values and make no network call.

The toolkit does not export Jev types, a generic provider interface, credentials, retries or live execution. Provider/model/question identity and raw answers remain application-retained data. A bounded projection may be submitted as ordinary `decisionEvidence` and remains untrusted.

## Package and compatibility boundary

Installed SDK-only consumers must use Policies without Ajv, canonicalize, Zod, database drivers or provider packages. Installed toolkit consumers must restore KEY-116 snapshots and run configured Policies without database drivers or provider packages. `/zod` remains optional and isolated.

Moving the private `packages/policy-parameters` workspace to `packages/policy` requires no compatibility shim. Historical KEY-116 evidence keeps its original paths and revision. Registry publication remains a separate feature.
