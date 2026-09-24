# Parameters and snapshots

`@keynes/policy` validates application settings and captures the values used by
a Policy. These helpers perform no network, database, filesystem, or Budget
operation.

## Define parameters

Call `defineParameters` with a non-empty map. Each parameter has a JSON Schema
and an explicit initial value.

```ts
import {
  createParameterSnapshot,
  defineParameters,
  overrideParameterSnapshot,
  restoreParameterSnapshot,
} from "@keynes/policy";

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

const baseline = createParameterSnapshot(declaration);
const candidate = overrideParameterSnapshot(declaration, baseline, {
  reviewThreshold: 200,
});
const restored = restoreParameterSnapshot(
  declaration,
  JSON.parse(JSON.stringify(candidate)),
);
```

Parameter names match `[A-Za-z][A-Za-z0-9_]{0,63}`. A descriptor has exactly
`schema` and `initial`. Literal schemas infer the value type. A dynamically
typed `JSONSchema` produces the conservative `ReadonlyJsonValue` type. The
initial value does not determine the parameter type.

Every parameter requires `initial`. The JSON Schema `default` keyword is an
annotation. It does not provide a missing initial or fill a nested property.
Validation does not coerce types, apply defaults, or remove unknown properties.
Represent an optional nested property by omitting it, not by setting it to
`undefined`.

The declaration, definition, initials, snapshots, and nested values are frozen
defensive copies. Later caller mutation cannot change them.

## Supported JSON Schema profile

Schemas use draft-07. The package accepts boolean schemas and these keywords:

`$schema`, `type`, `enum`, `const`, `anyOf`, `oneOf`, `allOf`, `not`,
`properties`, `required`, `additionalProperties`, `minProperties`,
`maxProperties`, `items`, `minItems`, `maxItems`, `uniqueItems`, `minimum`,
`maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`, `minLength`,
`maxLength`, `pattern`, `title`, `description`, `default`, `examples`,
`readOnly`, `writeOnly`, and `deprecated`.

The package rejects references, identifiers, formats, unknown keywords, invalid
keyword combinations, and non-draft-07 `$schema` values. Ajv runs in strict mode
and validates only own properties.

All schema and value inputs cross a strict JSON boundary. Accepted values
contain plain objects, arrays without holes or extra fields, well-formed
strings, booleans, `null`, finite numbers, and safe integers. The boundary
normalizes negative zero to zero. It rejects accessors without invoking them,
non-enumerable or symbol fields, cycles, custom prototypes, custom `toJSON`,
unsafe property names, malformed strings, and non-JSON values.

## Override whole values

`overrideParameterSnapshot` restores and validates the input snapshot before
applying replacements. Each override replaces one complete parameter value. It
never merges nested objects.

Replacing `{ limit: 10, enabled: true }` with `{ limit: 20 }` rejects when the
schema requires `enabled`. An unknown name or invalid replacement throws
`invalid_parameter_value`. The original snapshot stays unchanged. An empty
override and equal replacements preserve `snapshotId`.

## Snapshot format and identity

A `ParameterSnapshot` contains:

```ts
type ParameterSnapshot<Values> = Readonly<{
  formatVersion: 1;
  definition: ParameterDefinition;
  definitionId: string;
  values: DeepReadonly<Values>;
  snapshotId: string;
}>;
```

`definition` contains the format version, draft-07 dialect, and normalized
schema map. It does not contain initials. `definitionId` is SHA-256 over the RFC
8785 canonical JSON for that definition. `snapshotId` is SHA-256 over the format
version, `definitionId`, and effective values.

Object key order does not change either identity. Array order and schema
annotations do. Changing an initial does not invalidate a retained snapshot when
the schema definition is unchanged. Restoration uses the retained complete
values and never fills them from current initials.

Use an RFC 8785 canonical JSON implementation when exact serialized bytes
matter. `JSON.stringify` and `JSON.parse` preserve a valid snapshot for
restoration, but they do not define its identity.

## Restore a snapshot

`restoreParameterSnapshot` accepts parsed input and returns a validated, frozen
snapshot. It checks the envelope and exact fields, version, digest syntax,
parameter names, computed identities, expected definition, and parameter values
in that order. A bad computed identity reports `invalid_parameter_snapshot`
before definition comparison. A valid foreign definition reports
`parameter_definition_mismatch` before value validation.

Restoration reuses validators compiled with the trusted declaration. It never
compiles a schema supplied by the snapshot.

## Use the Zod adapter

The `@keynes/policy/zod` subpath supports exactly Zod 4.6.5.

```ts
import { zodParameter } from "@keynes/policy/zod";
import { createParameterSnapshot, defineParameters } from "@keynes/policy";
import { z } from "zod";

const declaration = defineParameters({
  config: zodParameter(
    z.strictObject({
      label: z.string(),
      limit: z.number().optional(),
    }),
    { label: "preview" },
  ),
});

const snapshot = createParameterSnapshot(declaration);
```

The adapter accepts unchecked strings, booleans, `null`, JSON literals and
enums, finite numbers with bounds, safe integers, homogeneous arrays with length
bounds, strict objects, ordinary unions, nullable wrappers, and optional object
properties. Wrap the complete union for an optional property in `.optional()`.

The adapter rejects refinements, transforms, coercion, defaults, catches, string
checks, numeric multiples, non-JSON types, optional union branches,
discriminated unions, XOR unions, and custom conversion callbacks. It ignores
global metadata, converts the accepted subset to draft-07, and applies the
strict core validation. Core imports and snapshot restoration do not load Zod.

## Handle errors

Parameter operations throw `ParameterError`. The error exposes only `code`, JSON
Pointer `path`, and `rule`; it omits submitted values and schema text.

| Code                            | Meaning                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `invalid_parameter_declaration` | A descriptor, schema, or adapter input is invalid          |
| `invalid_parameter_value`       | An initial, override name, or replacement value is invalid |
| `invalid_parameter_snapshot`    | A retained envelope, identity, or value is invalid         |
| `parameter_definition_mismatch` | A valid snapshot belongs to a different schema definition  |

Snapshots contain complete parameter values and schema annotations. Treat them
as application data that may contain secrets. A digest identifies content; it
does not prove provenance, permission, or Policy execution. Keynes does not
persist snapshots.
