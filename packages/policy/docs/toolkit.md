# Policy helpers and records

The toolkit binds one validated parameter snapshot to an ordinary SDK `Policy` and captures a portable result record. Applications still own Policy execution, business facts, provider calls, fallback, and storage.

## Configure a Policy

`configurePolicy` selects one snapshot when it creates the configured Policy.

```ts
import { configurePolicy, defineParameters } from "@keynes/policy";
import type { ResourceAmounts } from "@keynes/sdk";

const declaration = defineParameters({
  orderLimit: { schema: { type: "number", minimum: 0 }, initial: 100 },
});

const configured = configurePolicy({
  declaration,
  run: (proposal: ResourceAmounts<"usdCents">, values) =>
    (proposal.usdCents ?? 0) <= values.orderLimit
      ? { kind: "prepared", request: proposal }
      : { kind: "rejected", code: "order_limit_exceeded" },
});
```

The options are:

| Field         | Contract                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `declaration` | A declaration returned by `defineParameters`                                                       |
| `snapshot`    | An optional retained snapshot; omission selects a snapshot from the declaration initials           |
| `run`         | An own data property containing the Policy function; accessors and non-functions throw `TypeError` |

Construction validates or creates the snapshot once. Calls to `configured.policy` reuse the same deeply readonly values and never create a new snapshot. Replacing `options.run` after construction does not change the configured Policy.

The frozen result exposes `policy`, `definitionId`, and `snapshotId`. The helper does not catch Policy throws, normalize rejected Promises, validate `PolicyResult`, submit a request, or retain a record. `Budget.request` in `@keynes/sdk` owns its separate callback normalization and submission sequence.

## Record a result

Call `recordPolicyResult` after running the Policy when the application needs a portable record.

```ts
import { recordPolicyResult } from "@keynes/policy";

const result = await configured.policy({ usdCents: 80 });
const record = recordPolicyResult({
  definitionId: configured.definitionId,
  snapshotId: configured.snapshotId,
  context: { source: "checkout", revision: 4 },
  result,
});
```

The function returns a deeply frozen defensive copy with exactly `definitionId`, `snapshotId`, `context`, and `result`. It accepts the four SDK Policy result forms:

- `{ kind: "prepared", request }`
- `{ kind: "rejected", code }`
- `{ kind: "review_required", code }`
- `{ kind: "failed", code }`

A prepared request must be a non-empty plain object. Each amount must be a nonnegative safe integer. Other results require a lower-case code that matches `[a-z][a-z0-9_]{0,63}`. Extra result fields reject.

`context` can contain strict JSON. The same boundary used by parameters rejects accessors without reading them, cycles, custom prototypes, unsafe keys, malformed strings, and non-JSON values. Invalid inputs throw `TypeError` with the affected top-level field. The helper accepts identity fields as strings; it does not recompute or authenticate either identity.

The record omits parameter values, the Policy implementation, and facts that the application did not include in `context`. It also performs no storage. Decide what to retain before passing context because a defensive copy still contains any secrets or customer data supplied by the application.

## Keep external assessments bounded

Validate provider output in application code, then pass only the value the Policy needs. Treat unavailability as an explicit result rather than a low-risk answer.

```ts
import type { Policy } from "@keynes/sdk";

type RiskAssessment =
  | { readonly kind: "available"; readonly risk: "low" | "high" }
  | { readonly kind: "unavailable"; readonly code: string };

function policyFor(assessment: RiskAssessment): Policy<"usdCents", "usdCents"> {
  return (proposal) => {
    if (assessment.kind === "unavailable") {
      return { kind: "review_required", code: "manual_review" };
    }
    if (assessment.risk === "high") {
      return { kind: "rejected", code: "risk_too_high" };
    }
    return { kind: "prepared", request: proposal };
  };
}
```

The package defines no provider interface, credential, network call, timeout, retry, or sandbox. A record proves what the application captured. It does not prove that a provider or Policy ran, and it grants no Budget authority.

Use `policyRevision` in application records when code identity matters. `definitionId` identifies schemas, and `snapshotId` identifies schema-bound values. Neither identity names Policy code.
