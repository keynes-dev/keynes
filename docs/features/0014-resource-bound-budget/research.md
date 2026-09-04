# Research: Resource-bound Budget creation

## Current flow

`defineResources()` validates and freezes a typed schema. `createKeynes({ resources })` then opens local SQLite and sends one `defineResource` command per definition. The runtime records the returned Resource identities in one mutable connection-wide catalog. A later `createBudget` call resolves application names through that catalog and sends only Resource identities and amounts.

Each `defineResource` command and the later `createBudget` command owns a separate authority transaction. Budget creation is atomic, but Resource definition and root creation are not one operation. The public `Keynes<Names>` type also fixes one name set at connection setup.

## Decision: infer Resource names at root creation

The public local factory becomes `createKeynes(): Promise<LocalKeynes>`. `LocalKeynes` implements the shared `Keynes` root-creation contract. FEAT-0013 can later add `createKeynes({ databaseUrl }): Promise<RemoteKeynes>` without changing that shared method.

Root creation uses this call shape:

```ts
const root = await keynes.createBudget(
  resources,
  { usdCents: 1_000 },
  { policies },
);
```

The method infers the schema and the allocated key subset. It returns a `Budget` typed only to allocated names. The existing conditional Policy options tuple continues to infer Policy context and reasons.

**Rationale**: This is the smallest API change from current call sites. It keeps `defineResources()` pure, removes the connection generic, and hides Resource reconciliation and identity binding behind one mutation.

**Alternatives considered**:

- A single object with `schema`, `allocation`, and `policies` is viable, but it replaces the existing tested Policy-options convention with a more complex conditional object type.
- `ResourceSchema.root()` followed by `createBudget(plan)` adds an opaque public intermediate value and a second authoring method without adding authority behavior.
- `keynes.bindResources(schema).createBudget(allocation)` exposes a temporal stage for one atomic operation and recreates a partly configured public handle.

## Decision: carry one immutable binding per root

The connection owns execution and lifecycle only. A successful root result produces an immutable map between application keys, canonical names, and authority Resource identities. The root and its descendants carry that map. Child handles narrow the visible key type but share the root binding.

**Rationale**: A connection-wide mutable catalog makes independent roots affect one another. Per-root bindings match the public type boundary and give projections, errors, requests, settlement, and history one name-resolution owner.

**Alternatives considered**:

- An accumulating connection catalog would keep shared mutable aliases and make canonical-name conflicts depend on connection history.
- Rebuilding a binding from every inspection result cannot translate request inputs before the call and repeats validation.

## Decision: revise the existing root command

The generated operation remains `createBudget`, and PostgreSQL keeps `keynes.create_budget(jsonb)`. `CreateBudgetCommand.resources` changes from identity-and-amount entries to definition-and-amount entries. Only allocated schema entries cross the command boundary. The authority sorts by canonical name, rejects duplicate canonical names, and includes definitions, amounts, and Policies in the canonical replay body.

`CreateBudgetResult` remains the existing Budget projection. Its Resource projections contain the committed identities and definitions needed to build the private binding.

**Rationale**: Adding a sixth root operation would duplicate the current creation meaning and compatibility ownership. The current operation is not a released compatibility promise, so changing its pre-release input while preserving its name and result is the smaller contract.

**Alternatives considered**:

- A new `defineAndCreateBudget` operation duplicates root creation and forces every generated client and dispatcher to carry both forms.
- Sending client-selected Resource identities leaks durable identity generation into SDK and embedded callers.

## Decision: separate Resource identity from definition provenance

`resource_type_id` remains an opaque authority-issued UUID. A new `definition_command_id` records the first command that committed the Resource definition. Existing rows backfill `definition_command_id = resource_type_id`. Standalone `defineResource` keeps its current identity behavior. A combined root command may introduce several Resource rows that share its command identity as definition provenance.

SQLite and PostgreSQL allocate a new Resource identity only after the root command has passed replay and definition-conflict checks. If the transaction rolls back, the uncommitted identity has no public meaning. Exact replay returns the stored result and never allocates another identity.

**Rationale**: One root command can define several Resources, so Resource identity can no longer double as definition command identity. Explicit provenance keeps the command ledger honest and does not invent synthetic definition commands.

**Alternatives considered**:

- Hidden subordinate `defineResource` commands preserve the old foreign key but record operations that the caller did not submit.
- Resource IDs derived from the root command and canonical name are stable, but they permanently couple durable identity to replay identity and let direct callers predict identifiers.

## Decision: condition Resource-definition authority on a missing definition

Budget creation always checks `create_root_budget` before command identity or catalog access. After exact replay or command conflict resolution, it reuses matching definitions and reports conflicts. It checks `define_resource_type` only when at least one requested canonical Resource name is absent. Standalone definition continues to require only `define_resource_type`.

**Rationale**: The combined command asserts immutable definitions and may create them. Unconditional Budget-creation authority prevents catalog observation by principals that cannot create a lineage. Conditional definition authority preserves least privilege for create-only principals that reuse exact definitions. Replay and command-conflict resolution precede catalog reconciliation, so their outcomes do not depend on current definition authority.

**Alternatives considered**:

- Requiring only `create_root_budget` for missing definitions would expand that permission to Resource definition.
- Requiring `define_resource_type` for every call prevents a create-only principal from using an existing catalog entry and adds no protection to exact replay.

## Decision: add forward-only migrations and preserve accepted migrations

The original feature added `0005-resource-bound-budget.sql`. That migration adds and backfills `definition_command_id`, moves the command foreign key from `resource_type_id` to the provenance column, installs the revised private dispatcher and public wrapper behavior, and updates the installation record. The Phase 2 review adds `0007-create-budget-permissions.sql` for conditional definition authority and zero-allocation parity. Migrations `0001` through `0006` remain byte-for-byte unchanged.

The PostgreSQL generator preserves every historical contract digest and records the current digest on `0007`. The current installer still supports only a clean install or an exact recheck. Upgrading an existing target remains unsupported and `NOT RUN`.

**Rationale**: Retained migration checksums and evidence belong to their accepted revisions. Rewriting `0004` would falsify that evidence.

## Decision: use shared scenarios before deployment-specific tests

Add shared root-binding cases for success, exact definition reuse, definition conflict, replay, command conflict, Policy attachment, and rollback after Resource insertion. Run the same cases through the SQLite and native PostgreSQL hosts. Keep local lifecycle, PostgreSQL permission, transaction, contention, installation, and package checks in their owning lanes.

Remote TLS, credentials, private administration, operation recovery, remote reopen, Cloud retirement, self-hosted packaging, managed operations, fault testing, benchmarks, and production readiness remain outside FEAT-0014.

## Architecture arena synthesis

Two independent candidates covered a direct root call and a compiled root plan. The direct call is the base because it preserves current Policy inference with one smaller public interface. The compiled-plan candidate contributed the explicit separation between authority-issued Resource identity and definition-command provenance. The Phase 2 review keeps the direct call, per-lineage immutable bindings, one definition-bearing command, an additive migration, conditional definition authority, and the embedded `defineResource` operation.

The selected design passed the red-flag screen. It adds no public setup stage, no transport type, no second replay store, and no pass-through service. The main risks are absent-row contention in PostgreSQL, removal of all assumptions that Resource ID equals definition command ID, conditional permission metadata, and result validation before commit. The task list must give each risk a direct failing test.
