# Optional policy toolkit contract

Planned public contract for KEY-117. This document does not claim these exports exist yet. The realistic consumer must validate the proposed imports before implementation fixes them permanently.

## Imports and package ownership

Use `@keynes/policy` for `evaluate`, `minimumCeilings`, `evaluateAndSubmit`, their public types, and the existing parameter functions/types. Use `@keynes/policy/zod` only for `zodParameter`. Keep KEY-116's names and snapshot formats unchanged. Move the private `packages/policy-parameters` source into `packages/policy`; do not publish a second parameter package or revive a compiler package.

Compiled ESM `.js` and `.d.ts` exports must work outside the monorepo without source aliases. A normal toolkit-to-SDK dependency resolves public SDK types. Neither SDK nor database adapter depends on the toolkit. Zod remains an optional pinned peer; no root runtime or declaration import requires it. Core evaluation requires no runtime adapter or model package. Archive metadata remains private pending the separate publication feature; packing for qualification is supported.

## Caller usage

This is a usage sketch, not an implementation or an executable fixture. The implementation's first consumer test must turn it into a typechecked, runnable example.

```ts
import {
  createParameterSnapshot,
  defineParameters,
  evaluate,
  restoreParameterSnapshot,
} from "@keynes/policy";

const declaration = defineParameters({
  orderLimit: { schema: { type: "integer", minimum: 0 }, initial: 30 },
});
const selectedSnapshot = createParameterSnapshot(declaration);

// A plain object typed by the exported Policy type; no registration helper.
const policy = {
  revision: "order-v1",
  resourceNames: ["usdCents"],
  declaration,
  run: (input, values) =>
    input.needsReview
      ? { kind: "review", code: "manual_review" }
      : { kind: "allow", ceilings: { usdCents: values.orderLimit } },
};

const evaluation = await evaluate({
  policy,
  input: { needsReview: false, customerTier: "pro" },
  snapshot: selectedSnapshot,
  proposal: { usdCents: 25 },
  mode: "exact",
  capturedInput: { customerTier: "pro" },
});

if (evaluation.kind === "prepared") {
  const allocation = await budget.request(evaluation.request);
}

// Application retains the complete snapshot and sufficient synthetic facts.
const restored = restoreParameterSnapshot(declaration, parsedSnapshot);
```

The final consumer supplies explicit `Policy<Input, Values, ResourceName>` typing or equivalent contextual typing rather than relying on the unannotated sketch's literal inference. `Values` must agree with the declaration's inferred values, never a caller-selected bypass of schema validation. Public type checks must prove inference and separately declared extra-key rejection before adopting the signature.

## Policy definition and output

`Policy<I, V, R>` has exactly `revision: string`, `resourceNames: readonly R[]`, `declaration: ParameterDeclaration<V>`, and `run(input: I, parameters: DeepReadonly<V>)`. `run` may return a policy output synchronously or by Promise. Input `I` is customer-owned and may be non-JSON. The application validates it before or inside its function. The toolkit does not claim to freeze, validate business facts or reproduce hidden dependencies.

Policy output is a strict discriminated union:

- `{ kind: 'allow', ceilings: ResourceAmounts<R> }`
- `{ kind: 'reject', code: string }`
- `{ kind: 'review', code: string }`
- `{ kind: 'error', code: string }`

Ceilings may be empty; there is no implicit allow on undefined/missing output. Only the fields belonging to the selected variant are accepted. Codes match `^[a-z][a-z0-9_]{0,63}$`; revisions are non-empty well-formed strings of at most 256 UTF-8 bytes. Applications must use codes and revisions that contain no secrets. Toolkit-generated failures use controlled codes and never interpolate thrown values.

`resourceNames` is non-empty, duplicate-free and uses SDK member-name syntax `^[a-z][A-Za-z0-9]*$`. The optional toolkit excludes the existing strict-JSON reserved keys `__proto__`, `prototype`, `constructor` and `toJSON`; direct SDK use retains its own contract. Reject any such name in the vocabulary before invoking customer code. Allowed names represent the application's vocabulary, not proof that a particular Budget owns them. Validate name-list entries and amount-map descriptors without invoking accessors. Do not implement authority canonical-name conversion. Preserve legal own names such as `toString` in resource maps without consulting inherited values; strict record/parameter JSON continues to follow KEY-116's prototype-sensitive-key rules.

## Operations

| Operation                                                                | Input                                                                               | Output                                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `minimumCeilings({ resourceNames, ceilings })`                           | Allowed names and readonly list of ceiling maps                                     | Captured immutable ceiling map; synchronous validation errors throw.            |
| `evaluate({ policy, input, snapshot, proposal, mode?, capturedInput? })` | One policy, input, selected snapshot, non-empty proposal and optional captured JSON | Promise of immutable discriminated `Evaluation`; configuration failures reject. |
| `evaluateAndSubmit(options, submit)`                                     | Same evaluation options and one submission callback                                 | Promise of a discriminated submission result preserving callback return type.   |

`mode` defaults to `exact`; only `exact` and `reduce` are valid. `capturedInput` is optional caller-selected JSON. The toolkit validates and freezes it before policy invocation. No policy callback is invoked for malformed configuration.

For TypeScript inference, allowed resource names come from the policy vocabulary, not a widened union inferred from proposal or ceilings. Reject extra proposal keys in variables as well as object literals. Prepared requests preserve the proposal's exact key set but quantities have type number, not unchanged numeric literal types after reduction. Reuse exported SDK amount types where applicable and preserve Local/Remote allocation result types through callback inference. Do not expose private runtime or wire types.

## Validation order and failures

1. Validate outer options, policy shape, callable fields, mode, revision and resource-name vocabulary. Capture required option values once. For optional SDK request options, examples omit absent options rather than pass undefined.
2. Call existing `restoreParameterSnapshot(policy.declaration, snapshot)` once. Preserve KEY-116 errors and diagnostic ordering. This verifies the expected declaration, not merely a self-consistent digest. No user callback runs on failure.
3. Capture/validate the original proposal. It must contain at least one allowed name. Quantities use the existing Amount contract: safe integers in `[0, Number.MAX_SAFE_INTEGER]`, with negative zero normalized. Do not coerce, round, sum or truncate. Invalid configuration/proposal rejects with a toolkit `invalid_evaluation_input` error containing a controlled path/rule, not values.
4. Capture optional `capturedInput` as strict JSON. Invalid data rejects without invoking the policy.
5. Invoke the single customer function once with the original customer input and restored deep-readonly values. A thrown/rejected value yields failure `{ kind: 'policy_failed' }`. Do not retry, sandbox or log it. Customer code can log its own diagnostics before throwing; no raw error is stored or automatically printed by the toolkit.
6. Validate/capture the complete policy output. Malformed variants, codes, maps or quantities yield failure `{ kind: 'invalid_policy_output' }`. A declared error yields `{ kind: 'declared', code }`; rejection and review retain their sanitized application code.
7. For allow, compute exact fit or explicit reduction, then construct/freeze the complete record. Unexpected internal implementation errors remain rejected Promises; do not broad-catch all toolkit defects as policy failures.

Record capture uses the consolidated package's existing strict JSON functions. Resource maps need their own name/quantity validation before record capture. The documented reserved keys cannot become accepted resources in a portable evaluation; validate vocabulary compatibility up front and return `invalid_evaluation_input` rather than failing after the policy has run. No mutable partially built result escapes.

## Ceiling semantics

`minimumCeilings` accepts an empty collection and returns an empty map. For each allowed key present in at least one map, the result is the minimum supplied quantity. Order and duplicate ceilings do not affect the result. Invalid entries fail even when another entry would dominate them. No unknown name is silently dropped.

On allow, compare only proposal keys against ceilings. In exact mode any exceeded key produces `rejected` with reason `{ kind: 'ceiling_exceeded', ceilings, resources }`, where resources are the sorted exceeded SDK names. Otherwise request equals the captured proposal. In reduce mode request for each proposal key is its amount or the smaller present ceiling. Do not introduce a resource solely because a ceiling names it. The record always retains original proposal and effective mode.

Minimum composition and reduction assert only independent upper bounds. They cannot preserve arbitrary minimum quantities, ratios, alternatives or business validity. Coupled rules construct their own final envelope and use exact checking. The toolkit does not offer a generalized solver or default mixed-outcome precedence.

## Evaluation record version 1

The public `Evaluation` is the record. Its common fields and variants are defined in [data-model.md](../data-model.md). Use discriminated unions throughout, including rejection reasons and failures. `kind: 'prepared'` alone carries `request` and `ceilings`. Policy rejection reason is `{ kind: 'policy_rejected', code }`. Review carries `code`; evaluation error carries `failure`. Non-prepared variants cannot be submitted through the convenience operation.

No allocation status is written into this record. Canonicalize with the existing RFC 8785 dependency; object insertion order is insignificant. Do not assign random identity or time during evaluation. Identical selected inputs and deterministic output produce identical canonical records. Unknown record versions have no toolkit restoration guarantee. Applications own validation/storage of records, while parameter restoration retains its existing strict contract.

Captured input is opt-in. No snapshot values, credentials or original input are automatically included. Full fixtures separately retain sufficient facts, dependencies and complete parameter snapshots. Redacted projections cannot claim full replay. A record's contents or digest do not attest to policy execution or grant Budget authority.

## Submission, recovery and transaction boundaries

The convenience callback receives the whole prepared evaluation so the caller can select evidence or inspect its request: `submit(prepared)`. Its return type is inferred unchanged, including a Local or Remote child Budget.

The result is `{ kind: 'not_submitted', evaluation: NonPreparedEvaluation }` or `{ kind: 'submitted', evaluation: PreparedEvaluation, allocation: A }`. Validate `submit` is callable before evaluation begins. Call it exactly once for preparation and never otherwise. Callback exceptions/rejections propagate unchanged, not as evaluation errors. The convenience operation provides no durable recovery guarantee and returns no invented successful result after a failed submission.

For recoverable calls, evaluate separately; retain the complete parameter snapshot as needed and persist the exact target authority/parent, request, chosen evidence and caller-created operation key before invoking RemoteBudget.request. Reopen the same trusted authority and parent on recovery, and retry the exact command. Never regenerate its key or evidence, rerun policy, or select a fallback authority automatically.

A recorded denial remains denial on exact retry. A caller may choose a new key for a new allocation attempt using the retained request if its freshness rules permit. This is not an automatic retry or reevaluation. Changed quantities or evidence under the same key conflict. Once submitted, evidence is immutable for that attempt; redaction must happen before its final capture.

Local public requests generate fresh internal keys and expose no durable target reference; repeated calls can allocate twice. Toolkit records do not add Local idempotency, persistence or crash recovery. Native PostgreSQL borrowed-connection calls remain in the caller's transaction and provisional until commit. The toolkit never commits, rolls back, reconnects, closes, or retries a transaction fragment.

## Evidence projection

Full records do not fit the existing decisionEvidence contract. The application may submit a bounded projection, for example `{ policy_revision: evaluation.policyRevision }`, or a digest/reference it owns. Preserve the current field-name/value/count/byte restrictions. Evidence is untrusted, replay-bound caller metadata. No automatic projection helper, ledger storage or widening of the existing schema is planned.

## Qualification and compatibility

The first failing realistic consumer selects a snapshot, evaluates the order policy, retains complete synthetic data, restores the snapshot and repeats evaluation without providers. It validates the proposed public names before implementation expands. Later KEY-118 reuses these accepted contracts instead of inventing its own evaluator.

Archive qualification installs the actual toolkit plus its SDK dependency outside the workspace; core runtime/types must work with Zod, drivers and provider packages absent. Separately install the pinned Zod peer and check the optional entrypoint and conversion parity; its snapshot must restore through core alone. Reject private deep imports and verify every exported JS/declaration target exists. Retain process/cleanup outcomes and exact revision/archive hashes.

Keep existing parameter behavior/tests and snapshot identities unchanged during the move. Update active imports and filters; historical feature artifacts and acceptance evidence retain their original package paths. No public compatibility shim is promised for the private unpublished workspace. No DB migration or SDK command contract change is needed.
