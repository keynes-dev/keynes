# Research: typed policy parameters

Original research performed 2026-09-20 against repository base `dc58120` and primary documentation. The declaration-owned validator refinement was approved on 2026-09-21 after reviewing PR #67 at `82e32d6`. These are design decisions, not implementation evidence.

## Portable schema and validation

**Decision**: Use JSON Schema draft-07 with an explicit supported profile and Ajv 8 strict synchronous validation. Disable `useDefaults`, `coerceTypes` and `removeAdditional`. Do not register custom formats, keywords or remote schema loaders. Reject unsupported schema constructs before compiling.

**Rationale**: The repository already pins Ajv 8.20.0. Draft-07 covers the required parameter shapes and Zod supports that conversion target. A fixed profile prevents unknown constraints from becoming ignored annotations. The exact profile is in [the contract](contracts/parameters.md).

**Alternatives considered**: A new schema language violates the issue. A hand-written validator duplicates an installed dependency. Draft 2020-12 and reference resolution add capabilities this feature does not need.

Sources: [Ajv schema dialects](https://ajv.js.org/json-schema.html), [Ajv strict mode](https://ajv.js.org/strict-mode.html), [Ajv options](https://ajv.js.org/options.html).

## Inferred application types

**Decision**: Infer literal raw schemas with `FromSchema` from json-schema-to-ts, using `keepDefaultedPropertiesOptional: true`. Preserve Zod output inference only after the adapter accepts a non-transforming declaration. Infer from schemas, never from initial values. Dynamic schemas retain `JsonValue` types until matched to an expected typed declaration.

**Rationale**: The existing json-schema-to-typescript dependency generates files; it does not provide call-site inference. A dedicated type library avoids a second, incomplete schema interpreter. The default-property option matters because schema defaults do not provision configuration. Numeric ranges remain runtime checks; types do not pretend to encode them.

**Alternatives considered**: An unchecked `define<T>` lets callers assert false types. Inferring from initial values makes an initial enum choice look like the only legal value. Generating application files would add a CLI/build lifecycle outside this feature.

Source: [json-schema-to-ts inference and defaulted properties](https://github.com/ThomasAribart/json-schema-to-ts#readme).

## Zod conversion fidelity

**Decision**: Isolate an optional Zod 4 adapter, pin its exact supported release during implementation and maintain a fail-closed node/check allowlist. Use the stock converter with draft-07, unrepresentable/cycles set to throw and an empty metadata registry. Require strict objects and reject all transformation/default/coercion/custom-check behavior. The initial profile deliberately omits regex, format and string-length checks from the Zod adapter. Raw JSON Schema authors can use supported string constraints directly.

**Rationale**: Converter success does not prove that custom refinements survived. Plain Zod objects strip extra fields while a portable strict object rejects them. Regex conversion may drop flags; number/string boundary behavior depends on the pinned release. Rejecting unproved constructs is safer than weakening them. Do not use conversion overrides that erase checks or treat unsupported nodes as an unconstrained schema.

**Alternatives considered**: Running Zod only validates the authoring process and leaves non-Zod consumers weaker. Trusting `unrepresentable: throw` alone does not detect every dropped refinement. Vendoring a converter creates a second schema implementation.

Sources: [Zod JSON Schema conversion](https://zod.dev/json-schema), [Zod core traversal](https://zod.dev/packages/core), [upstream converter processors](https://github.com/colinhacks/zod/blob/main/packages/zod/src/v4/core/json-schema-processors.ts). Upstream main is research context, not a pinned dependency guarantee. Implementation must verify the selected release's behavior and reject any unsupported change.

## Snapshot identity and ownership

**Decision**: Canonicalize complete normalized JSON using the existing canonicalize dependency and SHA-256 from Node crypto. Version the definition and snapshot envelopes. Include schemas and effective values in snapshots, exclude initial values from definition identity, and omit timestamps and random identifiers. Require exact expected-definition equality on restore.

**Rationale**: A fixture can carry its entire meaning without a schema registry or network lookup. Changing provisioning defaults does not rewrite a captured effective configuration. Exact schema identity is deliberately stricter than semantic equivalence.

**Alternatives considered**: Name-only identity misses schema drift; ordinary JSON.stringify varies with object-key insertion order; an external registry introduces persistence and lookup ownership belonging to later Cloud work. Digests are content identities, not signatures.

Sources: existing canonicalize 4.0.0 use in `packages/database/src/generation/generated-output.ts`; [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785). Reuse the dependency directly without making application tooling import the private database owner.

## Refinement: declaration-owned validators

**Decision**: Retain compiled validators privately with each declaration. Restoration first checks strict JSON/envelope structure and identities, requires exact expected-definition equality, then reuses those validators. Do not compile incoming schemas or add a global cache.

**Rationale**: Equality with a validated declaration establishes the accepted schema's meaning. A different definition is rejected without compiling it. This removes repeated work without changing snapshot identities or accepted inputs. No production performance problem or throughput improvement is claimed.

**Alternatives considered**: Recompiling each snapshot discards declaration-time work. A matching-definition shortcut plus the old foreign-schema path preserves diagnostic ordering but adds branching. The approved refinement instead changes error precedence explicitly: a structurally valid foreign definition with valid digests reports a definition mismatch even when its schema is unsupported. Public declaration methods and package consolidation add unrelated migration; keep the current function API and leave distribution to KEY-117.

## Delivery boundary

**Decision**: Implement a private source workspace for the shared contract and keep all runtime, CLI and SDK exports unchanged. KEY-117 owns optional tooling distribution. Implementation follows these decisions in the private source workspace; see acceptance.md for executed evidence.

**Rationale**: KEY-116 can establish and test the contract independently without adding a competing public package or waiting for policy composition. The source owner remains separate from allocation.

**Alternatives considered**: Putting parameters in the SDK makes optional tooling a mandatory dependency; placing them in the database owner confuses configuration with authoritative commands. A generic configuration platform is out of scope.
