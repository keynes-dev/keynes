# Data model: Policy preparation and submission

No database table or migration is added. Policy data belongs to the SDK call or the application.

## Policy

A Policy is one synchronous or asynchronous customer function. Its input is an immutable captured Resource proposal. Its output vocabulary is a declared subset of the parent Budget's Resource names. Application facts, assessments and services enter through ordinary closures.

Policy has no stored identity, registry, Budget inheritance or authority. A plain Policy needs no revision or parameters.

## Policy result

One immutable discriminated result has four variants:

| Kind              | Fields    | Meaning                                                                     |
| ----------------- | --------- | --------------------------------------------------------------------------- |
| `prepared`        | `request` | A validated final envelope is ready for an allocation attempt.              |
| `rejected`        | `code`    | Customer rules stopped the operation.                                       |
| `review_required` | `code`    | Customer rules require another application step.                            |
| `failed`          | `failure` | Policy threw, rejected, declared unavailability or returned malformed data. |

Codes are sanitized application identifiers. Failures never retain raw thrown values. Only `prepared` contains a request.

## Prepared request

The request is a non-empty own-property map from allowed Resource names to nonnegative safe integers. The SDK captures it before exposure or submission. It rejects accessors, inherited values, unknown names, fractions, negative values, non-finite numbers and values above `Number.MAX_SAFE_INTEGER`.

Preparation does not reserve quantity. Authoritative allocation may still deny a valid prepared request because live availability or permissions changed.

## Configured Policy

The optional toolkit associates a trusted parameter declaration and selected immutable values with an SDK-compatible Policy. Construction either validates declaration initials once or restores one explicit KEY-116 snapshot. The callback closes over the resulting deep-readonly values.

An optional portable record may retain the parameter definition and snapshot identities, caller-selected strict JSON and the captured Policy result. It does not implicitly retain parameter values, arbitrary closure state, credentials, raw errors or provider prompts.

## Assessment

The provider-free example uses a discriminated application value:

- `available` contains the validated typed answer plus caller-retained provider, model and question revision data.
- `unavailable` contains a sanitized reason code.

Policy code chooses whether unavailable means failure or an explicit customer fallback. Keynes does not convert it to a negative answer.

## Submission attempt

A recoverable Remote attempt associates the trusted authority and parent, prepared request, finalized bounded decision evidence and caller-created operation key. Applications persist it before the first submission. Exact retry sends this ordinary command without Policy options.

## Transitions

```text
fresh proposal -> captured proposal -> one Policy invocation
Policy reject/review/failure -> non-submittable Policy result
Policy prepare -> validated prepared request
prepared request -> authoritative allocation approval or denial
retained attempt -> exact replay without Policy
```

Closing after admission waits for Policy preparation and any resulting command. A new call after close rejects before proposal or Policy inspection. Local preparation has no durable recovery transition.
