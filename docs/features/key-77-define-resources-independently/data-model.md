# Data model: Independent Resource definitions

This proposed model refines [spec.md](spec.md) and the
[command contract](contracts/resource-commands.md). It introduces no quantity owner.

## Resource definition

Existing `resource_types` rows remain the authoritative catalog.

| Field                   | Rule                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| `tenant_id`             | Authenticated authority context; never supplied by a remote binding.   |
| `resource_type_id`      | Stable authority-generated identity, private in the public SDK.        |
| `canonical_name`        | Existing snake-case name, unique within tenant, maximum 63 characters. |
| `unit`                  | Required valid unit under the existing Resource schema; immutable.     |
| `accounting_behavior`   | `consumable` or `reusable`; immutable.                                 |
| `definition_digest`     | Existing canonical definition digest computed by the authority.        |
| `definition_command_id` | Original inserting command; unchanged on exact reuse.                  |
| Definer evidence        | Original definer principal and existing evidence remain unchanged.     |

Public lower-camel keys map to canonical names under the existing conversion rule.
Named-input validation rejects malformed entries and unknown fields before
resolution. Both authorities sort canonical names in the same order.

The only transitions are absent to defined, or defined to exactly reused. A
different unit or accounting behavior produces `resource_type_conflict`. No
update, quantity, Budget membership, or spending permission comes from definition.

## Definition command receipt

Extend the canonical command row with nullable, unique `binding_reference`,
populated only by a successful `defineResources` command. No other command issues
a Resource binding.

| Receipt field               | Ownership and invariant                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Tenant and command identity | Existing scoped command key and authenticated context.                                 |
| Operation                   | `defineResources`, distinct from retained singleton `defineResource`.                  |
| Canonical input and digest  | Complete normalized batch; property order is irrelevant.                               |
| Binding reference           | Authority-generated private token; lookup requires the receiving tenant.               |
| Stored result               | Exact sorted members, original key, Resource projection, original definition evidence. |

One command has one receipt and many Resource members. Several receipts may
resolve the same immutable Resources. The result already contains the member set;
no separate binding or membership table is needed.

The transaction reserves command identity, resolves definitions, constructs the
reference/result, and commits them together. Failure rolls back all new rows.
Exact retry returns the stored reference/result with replay set; different
canonical input under a used identity returns `command_conflict`.

Canonical definition receipts do not expire. Resource provenance already depends
on their retention. A valid lookup requires a successful definition receipt and
a complete valid result, not merely a matching token column. Never fall back to
name lookup if that receipt is absent or invalid.

## Public Resource binding

`ResourceBinding<Names>` is an immutable application value, not a database handle.
A private unique-symbol brand provides nominal typing. Module-private WeakMap
membership associates the object with its reference and returned name metadata.
Neither token nor private identities, scope, or provenance appear as public
properties, JSON output, logs, or error details.

The binding has no lifecycle methods, balance, Budget membership, or registration
behavior. Closing the producing durable client does not invalidate it for another
authorized client in the same scope. Copying, spreading, reconstructing, or
serializing the object does not create another accepted binding. Cross-process
serialization and interoperability between duplicate SDK package instances are
outside the public binding contract.

## Creation source and allocation

The internal creation command selects exactly one source:

- `definitions`: a complete plain definition object, validated before resolving
  its allocated subset.
- `binding`: a private reference to a successful batch receipt visible to the
  current transaction, resolved without definition writes.

Allocation is a separate non-empty amount object under current creation rules.
Unknown keys reject. Membership remains exactly the allocation keys. Unallocated
binding members remain independent definitions; they do not become zero-funded
Budget members in KEY-77. KEY-78 owns that target membership change.

Existing Budget/holding/history rows retain their meaning. Original root funding
and child grants never expand. Settlement may restore parent availability without
changing original funding. A new root has independent lineage and balances even
when it uses the same definitions. Denial does not settle outstanding work.
Canonical/Local zero amounts remain valid; remote zero consistency remains the
explicit KEY-78 limitation.

## Remote operation recovery

Extend `remote_operations.operation`, validators, and response projection with
`defineResources`. Operation-key identity wraps the same canonical definition
command. Preserve current committed, known-failure, unresolved, and expiry
semantics. A known-failure recovery record is diagnostic; it is never a successful
canonical receipt or valid binding.

Remote recovery expiry does not delete the canonical receipt. Recovery wraps a
committed definition reference into an opaque binding and conceals private fields.
By-key recovery has a broad name type; typed exact retry uses the original
declaration. Exact definition reuse and command replay remain distinct.

## Transactions and security

Local receipt state lives in private SQLite and disappears on close. PostgreSQL
receipt state participates in the caller's transaction. Definition, creation,
and application-table writes can commit or roll back together. Other sessions
cannot consume an uncommitted receipt. The producing transaction can define and
consume its own successful receipt before commit. Failed creation using a previously
committed binding preserves that receipt and its definitions.

The receiving caller must hold existing operation permissions. Binding creation
requires root-creation permission; raw creation also requires definition permission.
A reference never grants either. Unknown, foreign-tenant, and foreign-authority
references produce the same safe failure without revealing another scope's data.
