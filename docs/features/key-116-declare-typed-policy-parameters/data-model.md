# Data model: parameter declarations and snapshots

All entities below are proposed. No database tables or migrations are introduced.

| Entity          | Fields                                                                                                          | Validation and ownership                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Declaration     | Named descriptors containing `schema` and explicit `initial`                                                    | Application-owned code; inferred names and types. Initial values validate immediately.                |
| Definition      | `formatVersion: 1`, `dialect: "http://json-schema.org/draft-07/schema#"`, `parameters` mapping names to schemas | Portable JSON with no initial values, code, imports or provider references.                           |
| Snapshot        | `formatVersion: 1`, `definition`, `definitionId`, `values`, `snapshotId`                                        | Complete, validated, immutable JSON. Definition and value names match exactly.                        |
| Override        | Partial map of declared names to replacement values                                                             | Missing name means retain; explicit undefined rejects. Nested objects replace in full.                |
| Parameter error | `code`, `path`, `rule`                                                                                          | Stable error family and JSON Pointer location; no raw values or arbitrary schema text in diagnostics. |

Schemas and snapshots use only strict JSON trees. A declaration map is non-empty. Names match `[A-Za-z][A-Za-z0-9_]{0,63}` and reserve `__proto__`, `prototype` and `constructor`; there is no case folding or alias normalization. Unknown and inherited entries do not become declared parameters. Duplicate keys in already parsed JSON cannot be recovered; serialization must originate from validated object maps, not a duplicate-key parser promise.

## Transitions

1. A declaration validates its entire schema/value batch and captures defensive copies, or returns no declaration.
2. Provisioning creates a snapshot from captured initial values. Schema defaults remain annotations.
3. An override validates the supplied base against the declaration, replaces selected whole values and validates all effective values before returning a new snapshot.
4. Restoration validates untrusted snapshot structure, version, definition, values and both identities against the expected declaration. It never provisions missing values or reuses current initials.

There is no shared mutable registry or global current snapshot. Repeated calls with the same definition and effective values produce equal canonical bytes and identities. Reordering object keys has no effect; changing array order does. Mutating the original inputs cannot mutate captured definitions or snapshots. Returned graphs are recursively frozen and expose deep-readonly types.

## Identities

The [interface contract](contracts/parameters.md#portable-identity) defines exact digest inputs. `definitionId` changes with any schema-content or name change after dialect normalization, including annotation changes. Initial values are outside that identity. `snapshotId` binds the definition identity and effective values, excluding itself. Digests detect accidental mismatch; an attacker can recompute them, so validation and expected-definition comparison remain mandatory.

## Relationships and future consumers

A policy may retain the snapshot it used, but this feature has no policy identity, evaluator or execution record. KEY-117 can reference a snapshot; KEY-118 can store fixtures; KEY-119 can persist this envelope and add publication metadata separately. The snapshot does not carry a tenant, Budget ID, authority, timestamps or automatic decision evidence.
