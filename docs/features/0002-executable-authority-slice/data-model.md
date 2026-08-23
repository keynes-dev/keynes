# Data model: Executable Budget lifecycle

The database stores Resource and Budget facts and derives accounting projections. Events report committed outcomes. They never reconstruct state.

## Common value rules

| Value                                                                | Rule                                                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `TenantId`, `PrincipalId`, `CommandId`, `ResourceTypeId`, `BudgetId` | Canonical lowercase UUID text. A create command's `commandId` is the created entity ID.                                                     |
| `ResourceName`                                                       | ASCII lower snake case, 1–63 characters.                                                                                                    |
| `ResourceUnit`                                                       | 1–64 UTF-8 characters, no leading/trailing whitespace or control characters.                                                                |
| `Amount`                                                             | Integer in `[0, 9007199254740991]`; every addition and subtraction checks the same domain.                                                  |
| `Digest`                                                             | Domain-tagged lowercase SHA-256 hex. Contract, command, migration, generated-file, and evidence-attempt identities are not interchangeable. |
| `ResourceEnvelope`                                                   | Non-empty entries unique by `resourceTypeId`, sorted by that ID after validation.                                                           |

All public objects reject unknown fields. Nullable direct usage means unknown; zero means known zero.

## Stored entities

### Schema migration

The hand-authored `packages/database/migrations/manifest.json` is the only migration graph. The installer records one row per applied node.

| Field             | Constraint                                                      |
| ----------------- | --------------------------------------------------------------- |
| `migration_id`    | Primary key and graph node identity                             |
| `byte_checksum`   | Exact-file SHA-256 from the generated installation record       |
| `contract_digest` | Nullable; present when a generated public boundary is installed |
| `applied_at`      | Operational metadata                                            |

A known ID with a different checksum fails installation. Exactly one manifest entry carries the installed contract digest; the installer verifies that ledger value before returning a client. FEAT-0002 qualifies fresh install only.

### Principal binding

Provider-free fixtures map a principal to independent authorization classes. This is an installed authorization check, not host security qualification.

| Field          | Constraint                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `tenant_id`    | Part of primary key                                                                               |
| `principal_id` | Part of primary key                                                                               |
| `permission`   | One of `publish_resource`, `create_root_budget`, `request_budget`, `settle_budget`, `read_budget` |

The local harness supplies the tenant and principal through private transaction context. Neither value appears in public command input. Tests include a principal for each individual class and a product fixture with the intended combined set.

### Resource type

| Field                    | Constraint                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `tenant_id`              | Part of primary key and name uniqueness                                                      |
| `resource_type_id`       | Primary key component and foreign key to its creation command; equal to creation `commandId` |
| `canonical_name`         | Unique within tenant                                                                         |
| `unit`                   | Immutable                                                                                    |
| `accounting_behavior`    | `consumable` or `reusable`                                                                   |
| `definition`             | Canonical logical definition                                                                 |
| `definition_digest`      | Digest of the database-normalized definition                                                 |
| `publisher_principal_id` | Evidence fact                                                                                |

Publication creates no quantity. Exact republication by canonical name returns the existing identity only when the full canonical definition matches; otherwise it returns `resource_type_conflict`.

### Budget

| Field              | Constraint                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `tenant_id`        | Part of primary key                                                                          |
| `budget_id`        | Primary key component and foreign key to its creation command; equal to creation `commandId` |
| `parent_budget_id` | Null only for a root; same tenant                                                            |
| `root_budget_id`   | Self for a root; inherited by descendants                                                    |
| `depth`            | Root is 0; child is parent depth plus 1                                                      |
| `lifecycle`        | Stored seal state: `active` or `settling`; `settled` is derived when blockers are gone       |

The first valid settlement changes stored lifecycle from `active` to `settling`. It never returns to `active`. A derived projection reports `settled` only when every direct usage value is known and every descendant is settled.

### Budget Resource fact

One row exists for each Resource allocated to a Budget.

| Field                                        | Constraint                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `tenant_id`, `budget_id`, `resource_type_id` | Composite primary key                                                        |
| `allocated_amount`                           | Safe amount, immutable after creation                                        |
| `direct_usage_amount`                        | Nullable safe amount; may move once from unknown to known, then is immutable |
| `usage_command_id`                           | Null until usage becomes known; foreign key to the first recording command   |

Settlement may omit an entry, leaving it unresolved. A later command may fill it. A new command that repeats the exact known value succeeds as a committed no-op result; a different value returns `usage_conflict`. New child requests are rejected after the Budget becomes `settling`.

### Command

| Field                      | Constraint                                                                |
| -------------------------- | ------------------------------------------------------------------------- |
| `tenant_id`, `command_id`  | Primary key; replay identity is tenant-scoped, never principal-scoped     |
| `operation`                | One of the four mutation names                                            |
| `target_kind`, `target_id` | Canonical target; create operations bind their new entity ID              |
| `canonical_body`           | Database-normalized logical command body, excluding operational metadata  |
| `body_digest`              | SHA-256 index and integrity value; equality also compares the stored body |
| `principal_id`             | Initiating principal retained as evidence, not part of replay uniqueness  |
| `result`                   | Canonical tagged result stored before commit                              |
| `committed_at`             | Operational metadata excluded from result equality                        |

An exact match returns `result` without another mutation or event. Any operation, target, or logical-body difference returns `command_conflict` and changes nothing.

### Budget history stream and entry

`get_budget` returns the complete unpaginated history stream for the selected Budget's root lineage. Resource publication has no history stream; its result and command ledger retain publication evidence.

The Budget history stream contains root allocation, child approval or denial, and settlement evidence for one root Budget lineage.

| Field                                | Constraint                                                        |
| ------------------------------------ | ----------------------------------------------------------------- |
| `tenant_id`, `stream_id`, `sequence` | Composite primary key; sequence increases without gaps per stream |
| `event_id`                           | Stable UUID; deterministic from command ID and event ordinal      |
| `command_id`                         | Foreign key to one committed command                              |
| `event_kind`                         | Closed contract event family                                      |
| `subject_id`                         | Budget described by the event                                     |
| `payload`                            | Canonical committed-result evidence                               |
| `recorded_at`                        | Operational metadata excluded from logical payload digests        |

The stream row is locked before assigning the next sequence. An exact replay appends nothing. A denied request appends one denial event to the Budget lineage while creating no child and changing no holdings.

## Derived Budget projection

For each `(budget, resource type)`, one recursive SQL projection derives:

| Field                  | Meaning                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `allocated`            | Immutable amount granted to this Budget                                                                                                                                  |
| `directUsage`          | Known amount or `null` when unresolved                                                                                                                                   |
| `subtreeObservedUsage` | Sum of known direct usage in this Budget and descendants; includes overage and never means charge                                                                        |
| `unresolved`           | True when this Budget or any descendant lacks required direct usage evidence or remains open                                                                             |
| `deficit`              | `max(direct known usage + bounded child charges - allocated, 0)` for this Budget; descendant overage is excluded by bounded child charges and therefore remains isolated |
| `chargeToParent`       | Internal bounded amount accountable against the parent; never exposed as observed usage                                                                                  |
| `committed`            | Sum of active child reservations or settled child charges that still consume this Budget's allocation                                                                    |
| `available`            | `allocated - direct consumable charge - committed`, checked against the safe domain                                                                                      |

`chargeToParent` is derived per Resource behavior:

- **Consumable**: while the child is active or settling, its full allocation remains committed; after it settles, the parent charge is `min(child subtree observed usage, child allocation)`. Unused quantity returns and overage remains the child's deficit.
- **Reusable**: while the child subtree is active or settling, its full allocation remains committed; after the subtree settles, the parent charge is zero and the full allocation returns.

The public projection exposes `subtreeObservedUsage`, `unresolved`, `deficit`, `committed`, and `available`. It does not overload any of them with `chargeToParent` semantics.

## State transitions

```text
Resource name absent
  └─ publish_resource_type → immutable Resource type
       ├─ exact republication → same identity, no new quantity
       └─ changed definition → error, no mutation

Budget active
  ├─ exact funded request → active child + exact reservation, atomically
  ├─ exact unfunded request → canonical denial event, no reservation
  └─ first valid settle → settling, direct known values sealed

Budget settling
  ├─ later missing usage becomes known → settling or settled projection
  ├─ exact repeated known usage → committed no-op evidence
  ├─ conflicting known usage → error, no mutation
  └─ all usage known and descendants settled → derived settled
```

## Transaction and lock order

Every mutation executes in one transaction:

1. validate and normalize the public JSON value;
2. resolve private tenant/principal context and required authorization class;
3. look up `(tenant_id, command_id)` and return replay or conflict when present;
4. bind the new command body;
5. lock affected Budget ancestry root-to-leaf, then Resource or event-stream rows in canonical ID order;
6. evaluate the operation and write base facts;
7. store the canonical command result;
8. store canonical evidence as a publication result or append a Budget-lineage event;
9. return to the caller-owned transaction for commit.

The lock order is the intended native PostgreSQL strategy. FEAT-0002 proves only that these statements execute in PGlite and that serialized local sibling cases conserve Resource quantities. Independent-connection correctness remains `NOT RUN`.

## Rollback checkpoints

The private checkpoint function is a production no-op with no public grant. A test-only migration overlay replaces only that function and can raise after command binding, base-fact mutation, result storage, or event insertion. Public functions and transition handlers remain byte-identical. Evidence from this lane proves rollback at those declared points only.
