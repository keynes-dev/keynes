# Parameter declaration and snapshot contract

Source contract for KEY-116. Public distribution and import names belong to KEY-117. All operations here are synchronous, local and side-effect-free; errors throw before a result is returned. They are not Promise-returning SDK methods.

## Operations

| Operation                                                     | Input                                                                           | Output and checks                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `defineParameters(descriptors)`                               | Non-empty named map of `{ schema, initial }`, or adapter-produced descriptors   | Captured typed declaration after validating every schema and initial value.                     |
| `createParameterSnapshot(declaration)`                        | Validated declaration                                                           | Immutable snapshot from its captured explicit initials.                                         |
| `overrideParameterSnapshot(declaration, snapshot, overrides)` | Expected declaration, untrusted base snapshot, explicit partial named value map | New snapshot after full base verification and whole-value replacement.                          |
| `restoreParameterSnapshot(declaration, input)`                | Expected declaration and unknown parsed JSON                                    | Typed immutable snapshot after complete verification.                                           |
| `zodParameter(schema, initial)`                               | Supported Zod schema plus explicit initial value                                | Typed descriptor with equivalent portable JSON Schema, from a separate optional adapter import. |

`defineParameters` infers types from literal schemas, never from initials. For raw schemas use `FromSchema<S, { keepDefaultedPropertiesOptional: true }>`; dynamic schema inputs expose `JsonValue`, not a caller-selected arbitrary type. Inference results of `never` also fall back conservatively to `JsonValue`; impossible schemas still reject every value at runtime. A Zod descriptor preserves its accepted schema's inferred output type, with no transform semantics. Private type metadata on validated descriptors must not serialize or let arbitrary input bypass runtime checks. Initials and overrides must typecheck against their inferred value types; runtime boundaries still accept and validate untrusted input. Compile-only checks cover separately declared excess-key inputs as well as inline literals.

The declaration and snapshot expose deep-readonly values. No public mutation API or ambient current configuration exists. An empty override returns an equivalent snapshot; an override equal to the existing value preserves content identity. Supplying undefined rejects, even for a schema whose nested properties are optional. Optional nested properties are represented by omission, not undefined.

## Supported JSON Schema profile

Use draft-07. An omitted root `$schema` normalizes to `http://json-schema.org/draft-07/schema#`; an explicitly different dialect rejects. Each parameter schema is standalone. `$schema` is permitted only at its root. There is no reference resolution or network loader.

The initial profile accepts boolean schemas and schemas built with these standard keywords only:

- `type` for JSON primitive/object/array types, including arrays of distinct types and integer validation.
- `enum`, `const`, `anyOf`, `oneOf`, `allOf`, `not`.
- `properties`, `required`, `additionalProperties` with a boolean or schema value, `minProperties`, `maxProperties`.
- Homogeneous `items` with a schema value, `minItems`, `maxItems`, `uniqueItems`.
- `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`.
- `minLength`, `maxLength`, `pattern`.
- Annotation-only `title`, `description`, `default`, `examples`, `readOnly`, `writeOnly`, `deprecated`.

Unknown keywords, `format`, references and identifiers such as `$ref`, `$id`, `$defs` or `definitions`, conditional/dependency schemas, tuple schemas and custom vocabularies reject. This is a documented subset of JSON Schema, not a custom language. Annotation values must be JSON. Defaults need not satisfy the schema because they have no provisioning semantics.

Ajv meta-schema validation and compilation remain authoritative for schema shape and supported validation behavior. Configure strict validation, `strictRequired: true`, `strictTypes: true`, `allowUnionTypes: true`, `useDefaults: false`, `coerceTypes: false`, `removeAdditional: false`, and no asynchronous compilation. Use no custom formats or keywords. Reject a schema that Ajv strict mode rejects even if all its keywords appear above. Report keyword/path errors; never silently delete keywords. The implementation must confirm standard annotation support with the pinned Ajv release and narrow the documented profile before acceptance if necessary.

No string/number coercion, insertion of defaults, removal of extra fields or application normalization occurs. JSON numbers use finite IEEE-754 values; integers must lie within JavaScript's safe integer range at the JSON boundary. Negative zero normalizes to zero. Accounting quantities keep their separate existing contract.

## Strict JSON boundary

Accept null, booleans, strings, finite numbers, dense arrays and plain own-property objects. Reject undefined, bigint, symbols, functions, non-finite numbers, unsafe integers, cycles, sparse arrays, accessors, symbol properties, non-enumerable data properties, custom prototypes and custom serialization. Reject prototype-sensitive keys recursively in data and schema maps. Repeated acyclic object references may be copied as repeated JSON values. Reject malformed Unicode strings with lone surrogates to preserve canonical serialization.

Inspect property descriptors before reading property values, then capture a strict JSON copy. Do not run getters or `toJSON` as a serialization convenience. Proxy reflection failures remain failures; there is no claim to sandbox malicious JavaScript code. Apply equivalent checks to declaration schemas, initials, overrides and incoming snapshots. Preserve accepted values without rounding or truncation beyond negative-zero normalization.

Errors have `invalid_parameter_declaration`, `invalid_parameter_value`, `invalid_parameter_snapshot` or `parameter_definition_mismatch` codes. Paths use JSON Pointer escaping, and rule names come from controlled validator vocabulary. Do not include submitted values, raw schema text, evaluator output or credentials. Declaration-shape/schema/Zod failures use the declaration code; invalid initials or overrides use the value code; malformed versions/digests/values on restore use the snapshot code; a well-formed snapshot for another definition uses the mismatch code. If multiple failures exist, validate in this order: envelope/JSON shape, supported schema, identities, expected definition, values. No API returns partial state.

## Zod authoring profile

The optional adapter accepts non-coercing strings without checks, booleans, null, JSON literals/enums, finite numbers with bounds, safe integers, homogeneous arrays with length bounds, strict objects, unions, nullable wrappers and optional object properties. Required parameter values themselves cannot be optional. Optional branches inside unions reject; wrap the complete object-property union in `.optional()` instead. Discriminated and XOR unions are not supported. Traverse every node and check before calling `z.toJSONSchema`, including nested branches and repeated checks. Only supported built-in node/check kinds pass.

Reject custom refinements and checks, transforms, preprocessors, pipes/codecs, coercion, defaults/prefaults/catches, overwrite/trim/normalization, stripping or passthrough objects, string regex/format/length checks, numeric `multipleOf`, non-JSON types, lazy/cyclic schemas and unknown constructs. This conservative authoring subset does not assert that all rejected features are inherently unrepresentable.

Convert with `target: "draft-07"`, `unrepresentable: "throw"`, `cycles: "throw"` and an empty metadata registry. Do not accept metadata overrides or converter callbacks that weaken checks. Then validate the generated schema through the core profile. Pin the Zod version and verify parity on accepted and rejected value corpora, including nested custom refinements, extra object fields, optional fields, Unicode, numeric boundaries and repeated/chained constraints. If stock conversion cannot preserve a supported case, reject that case or correct the declared profile before acceptance. Never fall back to `{}` or validation by Zod alone.

The core entrypoint, core types and snapshot JSON import no Zod. Source consumers using only JSON Schema must work with Zod absent. The adapter may depend on Zod without forcing every consumer to install it.

## Portable identity

A definition has exactly these fields: `formatVersion: 1`, `dialect: "http://json-schema.org/draft-07/schema#"`, and `parameters`, a named schema map. Normalize each parameter's root `$schema` as described above. Initial values are absent from the definition.

A snapshot has exactly these fields: `formatVersion: 1`, `definition`, `definitionId`, `values`, and `snapshotId`. Unknown envelope fields reject. Values contain exactly one entry for each declared name. Nested extra fields follow their schema's `additionalProperties` rule.

Let `J` be RFC 8785 canonical JSON, and `H` be SHA-256 of UTF-8 bytes, encoded as lowercase hexadecimal:

```text
definitionId = "sha256:" + H(J(definition))
snapshotId = "sha256:" + H(J({ formatVersion: 1, definitionId, values }))
serializedSnapshot = canonicalize(snapshot) // snapshot returned by creation, override or restoration
```

Object-key order is insignificant; array order remains significant. Equivalent schema syntax is not normalized beyond root dialect insertion. Annotation changes therefore change definition identity, and reordering `enum` or `required` arrays can do so too. Identical identities mean identical canonical content, subject to the hash's collision resistance; they do not imply provenance or authority.

Restoration accepts an unknown object, reconstructs/validates its definition, recomputes identities, compares its canonical definition with the expected declaration's definition, validates all values and returns defensive frozen copies. Compare canonical definitions as well as their digests. Never merge current initials, repair digests, fill defaults or migrate incompatible versions. Changed initials with an unchanged definition do not invalidate an old snapshot.

## Ownership and exclusions

The application supplies and retains the snapshot used for a policy. Helpers do not execute policy, fetch facts, select environment values, read/write files, contact Cloud, manage tenants, retry requests or submit decision evidence. No Budget command, database schema, permission or transaction changes. A snapshot is not a replay ledger. KEY-117, KEY-118 and KEY-119 consume this contract without making those responsibilities part of KEY-116.
