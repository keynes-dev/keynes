# Authority contract: Resource batch and binding consumption

These proposed commands refine [spec.md](../spec.md). The public positional API is
documented in [resource-api.md](resource-api.md). The tagged source below is an
internal command shape, not KEY-78's object-form public creation API.

## Operation inventory

| Shared operation                   | PostgreSQL procedure             | Required permissions                         |
| ---------------------------------- | -------------------------------- | -------------------------------------------- |
| `defineResources`                  | `keynes.define_resources(jsonb)` | `define_resource_type`                       |
| `createBudget`, definitions source | `keynes.create_budget(jsonb)`    | `define_resource_type`, `create_root_budget` |
| `createBudget`, binding source     | `keynes.create_budget(jsonb)`    | `create_root_budget`                         |

Retain the existing singleton `defineResource` command. Its resolver shares
immutable Resource semantics with the new batch and raw creation paths. Remote
wrappers derive identity from the authenticated role and never accept a caller's
tenant/principal override. Embedded calls use the existing transaction context.

Permission metadata and generated checks must represent creation's source-dependent
requirement, or delegate that selection to the authoritative procedure. Do not
leave a blanket definition-permission requirement on binding creation.

## Definition command and result

```text
DefineResourcesCommand = {
  commandId: UUID,
  definitions: non-empty object keyed by public Resource name
}

Definition entry = { unit: string, accountingBehavior: consumable | reusable }

DefineResourcesResult = {
  kind: defined,
  bindingReference: private opaque token,
  resources: non-empty canonical-name-ordered list of {
    key: original public name,
    resourceType: existing ResourceTypeProjection,
    definitionEvidence: original Resource definition evidence
  },
  replayed: boolean
}
```

Use the existing success/error transport envelope. The stored canonical result
omits the transport replay flag as existing commands do. No Budget projection,
history stream, holdings, quantity, or spend permission is created.

Validate the full named object inside each authority: object shape, non-empty
entries, exact fields, public name pattern, canonical-name length, unit, and
behavior. Map lower-camel names to existing snake-case names. Sort by canonical
name with PostgreSQL `COLLATE "C"` and the equivalent SQLite comparison. Reject
duplicate canonical names and all unknown fields. Preserve the current definition
digest recipe; the SDK does not compute equivalence evidence.

SDK structural validation runs on the complete snapshot before JSON serialization.
Use own-property checks for schema membership and required input fields; inherited
properties cannot satisfy either. Preserve malformed own entries until rejection,
including `constructor: undefined`, `toString: undefined`, and unknown fields inside
a definition. JSON serialization must not turn invalid input into a valid subset.
Apply this boundary to both definition and raw creation, including unallocated
definitions. Valid definitions named `constructor` or `toString` remain accepted.
Each authority still validates every field it receives independently.

Canonical input includes all normalized entries in stable order. Object property
order is irrelevant. Reserve the existing scoped command identity, then resolve
every entry through the shared internal resolver. Exact reuse preserves Resource
ID, definition digest, original definition command, and definer evidence.

Store a unique private reference and the complete result on the canonical command
receipt in the same transaction. Exact command retry returns that reference and
result with `replayed: true`. A new command with equal definitions returns
`replayed: false`; it may issue a new reference while reusing all Resource identities.

## Creation command

```text
CreateBudgetCommand = {
  commandId: UUID,
  resources:
    { kind: definitions, definitions: plain definition object }
    | { kind: binding, bindingReference: private opaque token },
  allocation: non-empty object keyed by public Resource name,
  policies?: existing Policy definition list
}
```

Each source is a closed object. Mixed or unknown fields reject. Allocation values
obey existing safe-integer/range rules. Canonical/Local explicit zero amounts are
valid; remote retains its current positive-amount restriction pending KEY-78.
No branch creates omitted members or permits an empty allocation in this feature.

For raw definitions, validate the complete declaration and allocation subset, then
resolve only allocated definitions in canonical order. Include the complete
normalized declaration in the new command's canonical input, so changing even an
unallocated definition under a used command identity conflicts. This is an explicit
wire-generation change from the old allocated-only canonical input.

For a binding, resolve the reference under the receiving tenant to a successful
`defineResources` receipt with a complete valid result. Validate allocation against
that exact member set. The database uses its stored Resource identities, never
caller-supplied IDs or matching names. No definition insert/update occurs, including
for unallocated members. Missing or invalid receipt state fails closed.

Both branches then use the existing root insertion, Policy validation, holdings,
history, and projection path. Membership is allocation-based. Definition inputs
never top up an existing Budget. Root funding and child grants stay fixed; requests
and settlement retain existing behavior.

Canonical binding input includes source kind, private reference, sorted allocation,
and normalized existing Policy input. Different references are different command
inputs even if they resolve the same definitions. Resolve exact replay before
reading mutable Budget state, after the existing authorization checks.

## Failure and rollback

| Condition                                                                  | Required result                                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty/malformed definition batch, unknown fields, invalid names or amounts | Existing `invalid_command` family with safe path/rule details; no partial state.                                                                  |
| Existing name with changed immutable meaning                               | `resource_type_conflict`; retain existing definition and roll back all new definitions and canonical success receipt.                             |
| Used command/key with different canonical input                            | `command_conflict`; preserve prior result and state.                                                                                              |
| Unknown, foreign, malformed, or reconstructed binding                      | `invalid_command` with a generic issue at `$.resources.bindingReference`, rule `resourceBinding`; no token, IDs, tenant, or existence disclosure. |
| Allocation key outside declared/bound names                                | Authority `invalid_command` with safe allocation path; public adapter may preserve existing `resource_not_defined` naming error.                  |
| Missing operation permission or revoked identity                           | Existing `unauthorized` family; reference possession does not bypass it.                                                                          |
| Local call after close starts                                              | Public `runtime_closed` Promise rejection before input validation.                                                                                |
| Fault after Resource insertion or receipt/result write                     | Entire transaction rolls back; retry has no committed success to replay.                                                                          |

Remote safe-error projection must retain stable public families while stripping
private result details. A remote known-failure recovery record may persist under
existing rules, but is never a canonical successful definition receipt.

## Concurrency and transaction ownership

Acquire command identity before Resource resolution. Process Resource names in
canonical order in every defining path, including singleton/raw creation. Use
the existing unique tenant/name constraint and insert-on-conflict followed by a
fresh row read/lock and exact comparison. Opposite-order input cannot create two
meanings for one name. No-op exact reuse never rewrites original provenance.

SQLite uses the existing serialized runtime queue and one transaction. PostgreSQL
functions remain inside the caller transaction; they neither begin nor commit it.
Separate statements preserve the Read Committed visibility required after a
competing insert. Higher-isolation serialization failures propagate to the
transaction owner. Remote retries reuse the same key; no per-entry retry exists.

A failing batch leaves zero new definitions, binding references, canonical success
receipts, Budgets, holdings, or history entries. An Embedded rollback removes
definition and creation effects along with application-table writes. A separate
session cannot use an uncommitted receipt. The producing transaction can consume
its own successful receipt before commit; caller rollback removes both operations.
Failed consumption of an older committed
binding preserves that receipt.

## Remote projection and recovery

Add `keynes.remote_define_resources(jsonb)` with `operationKey` in place of
`commandId`. Reuse current authenticated identity and bounded retry/recovery
machinery. Normalize input at the authority before hashing remote replay input;
plain JSON property order must not cause conflicting replay.

The remote wire result includes the private binding reference and the public names
and definition metadata needed by the SDK. Hide Resource UUIDs, tenant/principal
IDs, private digests, and original provenance from the public SDK. The wrapper
constructs the same opaque application binding for normal completion and recovery.

Extend operation whitelists, generated unions, result validation, mutation dispatch,
and recovery projection. Keep the private binding reference on canonical commands,
not the expiring remote recovery table. Receipt validity survives producing-client
closure and remote recovery expiry. There is no new public reference loader.

## Generation, installation, and compatibility

Change `packages/contracts/schema.json` and `contract.json` first, then their
renderers as necessary. Regenerate contract metadata, SDK types/validators/client,
PostgreSQL metadata/procedures, and fixtures through existing generation commands.
No hand edits to generated outputs or Spec Kit manifests.

The changed creation wire shape requires remote semantic generation 2, minimum SDK
generation 2, and creation procedure revision 2. The new definition wrapper uses
revision 1. Recompute command/procedure digests through generation and update
compatibility tests and all low-level examples. Stale embedded creation input fails
validation. A mismatched remote client/installation fails compatibility before
mutation and never falls back to another authority.

Add authored `scripts/resource-definitions-migration.ts` and generated
`migrations/0007-resource-definitions.sql` in the PostgreSQL package. Extend command
receipt storage, versioned resolvers/dispatch, remote operation constraints, grants,
and installation object checks. Freeze the old terminal migration's existing
contract digest and mark the new terminal migration as current through generation.
The current generator renders `0006` from live remote metadata. Preserve its
existing SQL bytes as a pinned historical input, verify their SHA in immutable
migration checks, and stop rendering `0006` from changed metadata. Emit changed
compatibility and procedures only in `0007`. Historical SQL bytes remain unchanged.
Fresh install and exact recheck remain the
supported boundary; recreate incompatible development installations.

KEY-76's clean baseline conversion is outside KEY-77. If that prerequisite-free
feature lands first, integrate this behavior into the then-current baseline and
repeat installation/profile evidence. Do not omit this feature's native or
package-consumer acceptance while waiting for that work.
