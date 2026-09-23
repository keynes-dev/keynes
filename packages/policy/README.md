# Policy parameters

Declare application settings with JSON Schema, validate explicit initial values, and capture the values used by a policy in an immutable local snapshot. These helpers perform no network, database or filesystem work.

This is a private source workspace for Node.js >=24. The examples use its workspace imports after `pnpm install --frozen-lockfile`; they do not describe a published archive. KEY-117 owns tooling distribution.

## Declare and use values

A parameter is a named setting that an application retains across requests, such as a review threshold. A per-request fact, such as the current order's estimated cost, stays in application code. The application decides when to select a snapshot and how to evaluate a policy.

```ts
import {
  createParameterSnapshot,
  defineParameters,
  overrideParameterSnapshot,
  restoreParameterSnapshot,
} from "@keynes/policy";
import canonicalize from "canonicalize";

const declaration = defineParameters({
  reviewThreshold: {
    schema: { type: "number", minimum: 0 },
    initial: 100,
  },
  reviewMode: {
    schema: { enum: ["manual", "automatic"] },
    initial: "manual",
  },
});
const snapshot = createParameterSnapshot(declaration);
const facts = { estimatedCost: 140 };
const needsReview = facts.estimatedCost > snapshot.values.reviewThreshold;

const preview = overrideParameterSnapshot(declaration, snapshot, {
  reviewThreshold: 200,
});
const bytes = canonicalize(preview)!;
const restored = restoreParameterSnapshot(declaration, JSON.parse(bytes));
console.log(needsReview, restored.values.reviewThreshold); // true, 200
```

Literal schemas infer value types and parameter names. The initial value does not determine its parameter's type. Dynamic schemas expose conservative JSON types, and every input still undergoes runtime validation. Returned declarations and snapshots are deeply frozen defensive captures.

Every parameter needs an explicit `initial`. JSON Schema `default` is an annotation: it neither provisions a missing initial nor fills a nested property. Validation does not coerce strings or remove unknown fields. Optional nested properties use omission rather than `undefined`.

## Override and reproduce

Overrides replace whole parameter values. Replacing `{ limit: 10, enabled: true }` with `{ limit: 20 }` does not retain `enabled`; it rejects if the schema requires that field. Unknown parameter names and invalid replacement values reject before a result is returned. The original snapshot is unchanged.

`definitionId` identifies the versioned schema map. `snapshotId` identifies that definition and the effective values. Both use SHA-256 over RFC 8785 canonical JSON. Object-key order does not affect identity; array order and schema annotations do. Empty overrides and equal replacements preserve identity.

Serialize a validated snapshot with `canonicalize(snapshot)`. Restore parsed JSON against the declaration expected by the application. Restoration checks strict JSON and envelope structure, then digests, exact expected definition and values. It reuses validators retained privately by the declaration and never compiles incoming schemas. With valid structure and digests, a different definition reports `parameter_definition_mismatch`, even if its schemas are unsupported; incorrect digests report `invalid_parameter_snapshot` first. It rejects tampering and incompatible versions without repairing them. Changed initials do not invalidate a snapshot whose definition is unchanged, and restoration never fills values from current initials.

Snapshots contain complete values and schema annotations. Treat them as application data that may contain secrets; decide what to retain or disclose before recording a fixture or decision evidence. A digest proves content identity, not provenance, permission or correct policy execution. Keynes does not execute policy or persist these snapshots.

## Test a Policy directly

An application Policy is an ordinary function. Build it with a retained complete
snapshot, call it with a proposal, and use native test assertions for the exact
`prepared`, `rejected`, `review_required`, or `failed` result. A direct test does
not construct a Budget, invoke an SDK wrapper, or normalize synchronous throws
or rejected Promises.

## Recorded assessments stay in the application

An assessment is application data, not a Keynes provider contract. Validate an external response in application code, then retain only the bounded value that the Policy needs. This provider-free example uses a recorded checkout risk assessment and requires manual review when the assessment is unavailable:

```ts
import type { Policy } from "@keynes/sdk";

type RiskAssessment =
  | {
      readonly kind: "available";
      readonly risk: "low" | "high";
      readonly confidence: number;
    }
  | { readonly kind: "unavailable"; readonly code: string };

const recorded: RiskAssessment = {
  kind: "available",
  risk: "low",
  confidence: 0.96,
};
const unavailableFallback = {
  kind: "review_required" as const,
  code: "manual_review",
};

function policyFor(recorded: RiskAssessment): Policy<"usdCents", "usdCents"> {
  return (proposal) => {
    if (recorded.kind === "unavailable") return unavailableFallback;
    if (recorded.risk === "high" || recorded.confidence < 0.9)
      return { kind: "review_required", code: "risk_review_required" };
    return { kind: "prepared", request: proposal };
  };
}

const policy = policyFor(recorded);
```

Without `unavailableFallback`, this application Policy should return `{ kind: "failed", code: "assessment_unavailable" }`; it must not treat unavailability as low risk, a negative answer or zero confidence. Keep provider, model, question revision and raw answers in application records. A bounded projection can accompany an ordinary request as untrusted `decisionEvidence`, but neither the assessment nor a Policy result grants Budget authority. This package adds no provider interface, credentials, network calls or retries.

## Optional Zod authoring

The separate adapter supports exactly Zod 4.6.5. Core imports and snapshot restoration do not require Zod.

```ts
import { z } from "zod";
import { zodParameter } from "@keynes/policy/zod";
import { createParameterSnapshot, defineParameters } from "@keynes/policy";

const declaration = defineParameters({
  reviewThreshold: zodParameter(z.number().min(0), 100),
  config: zodParameter(
    z.strictObject({ label: z.string(), limit: z.number().optional() }),
    { label: "preview" },
  ),
});
const snapshot = createParameterSnapshot(declaration);
console.log(snapshot.values.config.label); // preview
```

Supported authoring includes unchecked strings, booleans, null, JSON literals/enums, finite numbers with bounds, safe integers, homogeneous arrays with length bounds, strict objects, ordinary unions, nullable wrappers and optional wrappers on object properties. An optional branch inside a union is rejected; wrap the complete property union in `.optional()` instead. Discriminated unions and XOR unions are not qualified.

The adapter rejects refinements, transforms, coercion, defaults, catches, string checks, numeric multiples, non-JSON types and other unsupported constructs. It ignores global metadata and rejects converter/conditional callbacks. Conversion uses stock draft-07 output and the same strict core validation as raw JSON Schema. Typed adapter descriptors are local authoring objects; serialize their resulting snapshots.

## Validation and errors

The [contract](../../docs/features/key-116-declare-typed-policy-parameters/contracts/parameters.md) lists the supported draft-07 keywords, strict JSON boundary and error ordering. References, identifiers, formats and unknown keywords reject. JSON inputs must have ordinary data properties, finite numbers and well-formed strings. Accessors, custom serialization, cycles and prototype-sensitive keys reject.

Errors expose a controlled `code`, JSON Pointer `path` and validation `rule`, without submitted values or schema text. Codes distinguish invalid declarations, invalid initials/overrides, invalid snapshots and definition mismatches. See the contract for their exact names.

Run the provider-free source checks from the repository root:

```sh
pnpm --filter @keynes/policy test
pnpm --filter @keynes/policy typecheck
```

The [validation guide](../../docs/features/key-116-declare-typed-policy-parameters/quickstart.md) maps checks to acceptance evidence. These checks do not qualify published archives or Local preview publication.
