# Data model: parameter declarations and snapshots

These entities form the source contract. No database tables or migrations are introduced.

| Entity          | Fields                                                                                                          | Validation and ownership                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Declaration     | Named descriptors containing `schema` and explicit `initial`                                                    | Application-owned code; inferred names and types. Initial values validate immediately.                |
| Definition      | `formatVersion: 1`, `dialect: "http://json-schema.org/draft-07/schema#"`, `parameters` mapping names to schemas | Portable JSON with no initial values, code, imports or provider references.                           |
| Snapshot        | `formatVersion: 1`, `definition`, `definitionId`, `values`, `snapshotId`                                        | Complete, validated, immutable JSON. Definition and value names match exactly.                        |
| Override        | Partial map of declared names to replacement values                                                             | Missing name means retain; explicit undefined rejects. Nested objects replace in full.                |
| Parameter error | `code`, `path`, `rule`                                                                                          | Stable error family and JSON Pointer location; no raw values or arbitrary schema text in diagnostics. |

Schemas and snapshots use only strict JSON trees. A declaration map is non-empty. Names match `[A-Za-z][A-Za-z0-9_]{0,63}` and reserve `__proto__`, `prototype` and `constructor`; there is no case folding or alias normalization. Unknown and inherited entries do not become declared parameters. Duplicate keys in already parsed JSON cannot be recovered; serialization must originate from validated object maps, not a duplicate-key parser promise.

The [interface contract](contracts/parameters.md) owns transitions, immutability and portable identity rules.

A declaration privately retains the validators compiled for its schemas. They share the declaration's lifetime and are absent from portable definitions and snapshots. Restoration requires exact definition equality before using them; separate declarations do not share mutable validator ownership.

## Relationships and future consumers

A policy may retain the snapshot it used, but this feature has no policy identity, evaluator or execution record. KEY-117 can reference a snapshot; KEY-118 can store fixtures; KEY-119 can persist this envelope and add publication metadata separately. The snapshot does not carry a tenant, Budget ID, authority, timestamps or automatic decision evidence.
