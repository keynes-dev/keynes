# Research: Define Resources independently

This research supports [KEY-77's specification](spec.md). It inspected source
revision `a27d8bf8b2007da6715815d1cc6f2ef469e2e72b`. Decisions below are proposed
implementation, not runtime acceptance. Two read-only research agents examined
SDK binding and type behavior, and authority transactions and compatibility.

## One batch command

Decision: Add `defineResources` to the shared command contract and remote wrappers.
Send the complete plain definition object in one command. Each authority validates
all entries, canonicalizes names, resolves them in canonical name order, and records
one complete result in the same transaction.

Rationale: `packages/sdk/src/local/sqlite-command-executor.ts` already resolves
immutable definitions inside transactions. PostgreSQL's
`packages/postgresql/migrations/0005-resource-bound-budget.sql` implements strict
canonicalization, exact reuse, original definition evidence, and conflict rollback.
Extract those resolution internals for singleton definition, batch definition, and
raw creation. Never call the public singleton operation in a loop.

Alternatives considered: SDK reconciliation would split atomicity and authority.
Independent singleton commits would leave partial definitions. A second catalog
or Resource service adds another owner for existing state.

## Binding representation and lifetime

Decision: Add a nullable, unique `binding_reference` to the existing canonical
`commands` table in both authorities. Only a successful `defineResources` command
sets it. The immutable stored result contains the exact sorted member set and its
original definition evidence. The token uses the existing opaque token pattern,
with a distinct private `krs_v1_` prefix. Look it up under the receiving tenant.

The SDK returns a frozen, branded `ResourceBinding<Names>`. A module-private
WeakMap associates that object with the token and authority-returned metadata.
It contains no producer client, executor, database URL, or runtime reference.
The existing internal `ResourceBinding` class indexes Budget projections; rename
it `BudgetResourceBinding` to keep the two responsibilities distinct.

Rationale: Canonical command results already retain immutable definition evidence.
A token identifies the whole set and cannot become valid through matching names.
Independent authorities have independent receipt catalogs. Client closure does
not delete the receipt. Canonical definition receipts have no expiry and must not
be purged while definitions or bindings depend on them. In particular, the existing
30-day `remote_operations` recovery window does not govern binding validity.

Alternatives considered: Client-bound handles fail cross-client use. URL comparison
does not establish authority identity. Signed descriptors introduce keys and
rotation. A binding table duplicates a result already retained by commands. An
expiring remote operation record would invalidate live bindings. SDK WeakMap checks
alone cannot protect supported direct database callers.

## Plain input and authoritative validation

Decision: Keep the public lower-camel Resource key convention and its canonical
snake-case mapping. Move authoritative named-input validation into each authority.
The new batch and named raw-creation commands receive full objects, including
unallocated definitions, so adapters cannot silently drop unknown fields or invalid
entries. Share the same name mapping and definition rules across those commands.
The SDK owns snapshots, transport adaptation, types, and error projection.

Rationale: `packages/sdk/src/resources.ts` currently validates definitions and
computes digests for a standalone `ResourceSchema`. Neither belongs in an
authority-issued public binding. The SQLite authority may use a private digest
helper, but SDK handles must not decide equivalence using it. Preserve the current
`resource-definition:` digest recipe and the original definer/command evidence.

Alternatives considered: Passing SDK-normalized subsets would leave direct callers
without full validation. Redesigning naming or digest semantics is unnecessary.

## Positional creation and compatibility

Decision: Preserve `createBudget(resources, allocation, ...options)` publicly.
Accept either plain definitions or the opaque binding. Replace the canonical
creation input with a tagged Resource source and a separate allocation. The
[command contract](contracts/resource-commands.md) defines both branches. Update
all generated callers, supported direct-call examples, and shared fixtures together.
This changes the low-level wire shape and requires a compatibility generation bump.

Validate the whole raw declaration, then reconcile only allocated definitions as
the existing creation path does. Binding creation reads the complete receipt and
allocates only selected members, with no definition writes. Raw creation still
requires definition and root permissions. Binding creation requires root permission
and valid scope, without requiring permission to define Resources again.

Rationale: KEY-77 must independently demonstrate binding use and foreign rejection.
Allocation continues to determine Budget membership. KEY-78 owns object-form
creation, membership from the complete input, and omitted initial amounts.

Alternatives considered: Retaining the old array as a third branch adds a legacy
adapter to an installation that already requires recreation for contract changes.
Converting a binding back into raw definitions performs unnecessary definition
work and can conceal scope failures. Adding the target public object-form API
would duplicate KEY-78; an internal tagged command does not expose that public API.

## Type inference and declaration migration

Decision: Infer names from input keys or the binding alone. Retain
`ExactResourceAmounts` so extra keys in separately declared allocation variables
fail type checking. Use `NoInfer` where allocation could otherwise widen the
binding's name parameter. Accept a structural input with string-valued unit and
accounting behavior for inference; the authority validates the behavior enum.
Continue exporting the stricter `ResourceDefinitions` type for optional `satisfies`.

Rationale: A separately declared ordinary object widens a nested string property.
A generic constrained only to the strict behavior union would require an annotation,
contrary to the specification's plain-input example. TypeScript's
[const type parameters](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)
preserve inline inference but do not recover literals already widened in a variable.
[NoInfer](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html)
can prevent an allocation argument from supplying unwanted inference candidates.
The [satisfies operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html)
checks a stricter declaration without replacing its inferred key set.

Remove the standalone helper and `ResourceSchema` export. Adapt creation,
`definePolicy`, `definePolicySql`, and the existing remote
`openBudget({ reference, resourceTypes })` declaration consumer. Policy authoring
remains pure. Context, parser, normalization, evaluation, and Policy registration
semantics do not change. Update active examples and package fixtures together.

Alternatives considered: Requiring `satisfies`, `as const`, explicit generics, or a
new helper would defeat ordinary separately declared inputs. A broad string index
on the returned binding would lose the exact key checks the feature promises.

## Transactions, contention, and recovery

Decision: Reuse the Local admission queue and SQLite transaction, and PostgreSQL's
command identity and unique tenant/name constraints. Process names in the same
canonical order for batch definition and raw creation. Reuse insert-on-conflict
followed by a fresh row read and exact comparison. Preserve whole-transaction
rollback and existing bounded retry behavior.

Rationale: PostgreSQL documents that `ON CONFLICT DO NOTHING` can skip an insertion
because of a competing transaction invisible to the statement snapshot. A later
statement at Read Committed obtains a new snapshot. Keep resolution as separate
statements, and let higher-isolation serialization failures propagate to the owner
of the transaction. See [transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html).
Sorted acquisition prevents opposite-order batches from introducing avoidable
deadlocks; native tests must establish the implementation's actual behavior.

Exact canonical command retry returns the stored token/result. A fresh command
with equal definitions reuses Resource identities but records a new, non-replayed
result. Extend remote operation-key retry and recovery for definition. Recovery by
key alone returns `ResourceBinding<string>`; retry with the original definitions
retains inferred names. Neither retries application work.

Alternatives considered: Re-reading definitions after response loss could return a
different command result. Retrying individual entries breaks batch atomicity.
An SDK replay ledger would duplicate database authority.

## Local lifecycle

Decision: New definition and touched creation entrypoints reject asynchronously,
check Local close state before accessing malformed input, copy input synchronously,
and admit queued work before the first await. Deferred validation uses that snapshot.

Rationale: Current root preparation in `packages/sdk/src/keynes.ts` occurs before
admission and can throw synchronously. New batch setup must not repeat this gap.
Only admitted work drains during close; subsequent calls reject `runtime_closed`.

Alternatives considered: Copying inside the queued callback observes later caller
mutation. Starting with an await allows close to overtake a call that should already
have been admitted. A broad lifecycle rewrite is unnecessary for these entrypoints.

## Installation and evidence boundaries

Decision: Build against the inspected migration chain `0001` through `0006` with a
feature migration `0007-resource-definitions.sql`. Update contract generation,
terminal manifest identity, wrapper digest, recovery operation enumeration, grants,
installation verification, and packed consumers together. Pin the old terminal
migration to its existing contract digest through the repository generation process.
Also pin its existing SQL bytes and verify their SHA. The current generator renders
`0006` from live remote metadata, so freezing only the manifest digest is insufficient.
Emit changed compatibility and procedure definitions in `0007` only.
Old or drifted installations fail compatibility checks. Development fixtures are
recreated; this feature promises no historical-data upgrade path.

Rationale: KEY-75's merged prerequisite is in this branch's ancestry. KEY-76's clean
baseline is a separate feature, not a hidden prerequisite. If it lands before
implementation, place the same additive behavior in its current baseline and
re-run installation evidence. Do not carry out the baseline conversion here.

Use existing shared registration for definition, consumption, and accounting
regressions. Native-only tests cover races, transactions, authorization, and remote
lifetime/recovery. Use current package runners and the paired SQLite/PostgreSQL
gate. No new runner, evidence framework, or external service is needed.

Alternatives considered: Deferring PostgreSQL, types, or consumers to later issues
would prevent independent acceptance. Reusing KEY-75's evidence as KEY-77 acceptance
would make a claim about an untested revision.

Embedded receipt lookup uses successful results visible in the current transaction.
The caller can define then consume before commit; other sessions require commit.
This follows caller-owned transaction visibility without a separate registration step.

All planning unknowns are resolved. Runtime behavior, native execution, package
acceptance, and feature CI remain `NOT RUN` during planning.
