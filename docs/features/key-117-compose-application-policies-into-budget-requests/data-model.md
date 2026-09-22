# Data model: application policy evaluations

No database tables or migrations. Types and records belong to the optional application toolkit.

## Policy definition

A plain typed object contains `revision`, `resourceNames`, the expected parameter `declaration`, and one `run(input, values)` function. Revision is a non-empty application identifier, not a hash or attestation. Resource names are a non-empty unique readonly list of valid SDK member names excluding the four strict-JSON reserved keys listed in the toolkit contract. The definition creates no Budget authority and is not a portable execution artifact. No registration or definition builder is required.

## Selected parameter snapshot

Reuse KEY-116's complete `ParameterSnapshot<V>` unchanged: `formatVersion`, `definition`, `definitionId`, `values`, `snapshotId`. Evaluation restores against the definition's trusted declaration once before policy execution. Canonical equality to the expected definition and validated values matter in addition to digest consistency. The record retains only `definitionId` and `snapshotId`; the application retains the full snapshot separately where restoration is required.

## Proposal and ceilings

Proposal is a non-empty own-property map from allowed SDK resource names to nonnegative safe integers. Normalize negative zero. Ceilings use the same names/amount rules but may be empty. A missing ceiling means no constraint; zero is a constraint of zero. A ceiling for an allowed name omitted from the proposal never creates membership. Combining maps takes per-key minimum without addition or rounding.

The original proposal is captured before invoking customer code. Output maps are captured after policy completion. Deep immutability applies to toolkit-produced data, not to arbitrary customer input objects or external data sources.

## Policy output

The customer returns one of `allow` with ceilings, `reject` with an application code, `review` with an application code, or `error` with an application code. Customer code determines mixed-rule precedence and execution order. The toolkit never aggregates competing control-flow outcomes. Application codes are deliberate sanitized identifiers, not messages, stacks or submitted values.

## Evaluation record and result

One immutable discriminated object is both the evaluation result and the portable record. There is no second mutable copy of the final request.

Common fields are `formatVersion: 1`, `policyRevision`, `parameterDefinitionId`, `parameterSnapshotId`, captured `proposal`, effective `mode`, and optional `capturedInput`. There are four top-level kinds:

| Kind               | Additional fields       | Meaning                                                                                                          |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `prepared`         | `ceilings`, `request`   | Validated proposal fits, or was explicitly reduced under independent ceilings.                                   |
| `rejected`         | discriminated `reason`  | Customer rejection, or exact proposal exceeding ceilings. The latter retains ceilings and sorted exceeded names. |
| `review_required`  | `code`                  | Customer requires review; no request.                                                                            |
| `evaluation_error` | discriminated `failure` | Customer-declared error, thrown policy or malformed policy output; no request.                                   |

`capturedInput` is strict JSON selected by the caller before evaluation. Omission differs from explicitly captured null. Invalid captured input rejects before policy invocation. A rejected policy has no invented ceilings; a ceiling rejection retains the actual composed map. Prepared `request` contains exactly the original proposal keys.

Strict data validation and immutable capture apply recursively. Unknown envelope fields fail validation. Records have no implicit wall-clock time, random identifier, complete parameter contents, stack trace or raw exception. Canonical JSON is the serialization format using the existing dependency. No new built-in record digest or record restoration API is needed; applications validate records at their own persistence boundary and restore parameters with the existing declaration-bound operation. A record alone is neither a replay fixture nor proof of execution.

## Submission attempt

Application-owned data associates trusted authority identity, parent reference where supported, exact prepared quantities, finalized bounded decision evidence and operation key. The application persists these before remote submission when recovery matters. The toolkit owns no attempt store or universal persisted-attempt schema.

The convenience result is either `not_submitted` with a non-prepared evaluation or `submitted` with a prepared evaluation and the inferred allocation result. Submission exceptions reject unchanged. An allocation denial is still a submitted result and leaves the evaluation prepared.

## Transitions

```text
invalid configuration/snapshot/proposal -> rejected Promise, policy not invoked
valid inputs -> one customer function
thrown policy / malformed output -> evaluation_error
customer reject / review / error -> matching non-submittable evaluation
customer allow -> exact check or explicit reduction -> prepared or rejected
prepared -> caller submission -> allocation approved / denied / failure
```

Review has no internal resume transition. Applications decide whether to change inputs or policy and explicitly evaluate again. Remote exact replay reuses an attempt; a fresh key creates another allocation attempt without automatically reevaluating. Caller rollback does not mutate the retained evaluation. First Local has no durable recovery transition.
