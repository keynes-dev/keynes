# Research: Local Budget loop with shared backend conformance

The inspected source revision is `18bf0f149f51067806a9e041d9ff50c4a7bbbee8`. These decisions describe the planned change, not delivered behavior. Read-only investigations covered the Local authority, shared contracts, PostgreSQL implementation, and packed consumers. All planning questions are resolved. Runtime qualification is NOT RUN.

## Product scope and semantic ownership

**Decision:** Deliver the Local product and implement its shared commands in both SQLite and native PostgreSQL. Require one common scenario inventory and matching normalized transcripts. Keep PostgreSQL deployment delivery outside KEY-5.

**Rationale:** The approved clarification preserves Constitution IV. A PostgreSQL fixture proves that the logical contract travels across implementations without making the application operate PostgreSQL in Local mode.

**Alternatives considered:** Deferring PostgreSQL leaves portability unproved. Delivering remote access or an installer product now expands beyond the approved outcome. A generic storage interface would shift accounting outside the selected authority.

## Reuse the existing authority boundaries

**Decision:** Keep `packages/contracts` as the command and conformance owner, SQLite transitions in `packages/sdk/src/local/`, and PostgreSQL transitions in `packages/postgresql/migrations/`. Extend the existing generated client and private test host instead of adding a second command framework.

**Rationale:** `runtime.ts` already serializes admission and drains accepted work. `sqlite-command-executor.ts` already wraps validation, command binding, changes, history, and results in a transaction. PostgreSQL's test host already invokes real procedures and exposes controlled transactions.

**Alternatives considered:** Moving transitions into an SDK reducer would make PostgreSQL depend on application execution. Rewriting both implementations without retaining replay and rollback seams would discard useful verified mechanisms.

## Quantity belongs to the movement journal

**Decision:** Derive live balances from immutable movements. Keep immutable membership separate from quantity. Store monotonic usage and permanent deficits as evidence, not balances. Commit finalization and terminal movements explicitly.

**Rationale:** Current holdings contain allocation and direct usage, and settlement is derived recursively. They cannot express additions, permanent deficits, or a settled Budget with zero live quantity. The accepted architecture already selects a movement journal.

**Alternatives considered:** Adding a mutable balance beside the journal creates another accounting authority. Tracking funding lots adds complexity without a requirement. Deficit correction against an ancestor contradicts the specification.

## Bind definitions independently

**Decision:** `keynes.defineResources` returns an immutable quantity-free binding. A private authority-owned registry associates that object with resolved Resource identities. `createBudget({ resources, initial, allows })` accepts only such a binding. Creation uses all binding members, including omitted initial amounts as zero.

**Rationale:** Current `ResourceSchema` is a portable synchronous description; it does not prove authority scope. Existing name normalization and metadata validation can be reused, but definition writes must be atomic inside the authority.

**Alternatives considered:** A digest-only object can be forged and cannot establish provenance. A raw-definition creation overload conflicts with the accepted clarification. A Resource pool would hold quantity outside Budgets.

## Public compatibility boundary

**Decision:** The package root exposes the new ungoverned Local API. Remove standalone definition helpers, Policy authors and attachment options, remote factory overloads, operation keys, and recovery from that public entry point. Keep deferred implementation source private. Do not add a legacy public entry point or silently interpret old inputs as new inputs.

**Rationale:** This is an intentional breaking change to the current private `0.0.0` package, not a compatibility layer. The specification requires an ungoverned Local product. Retained remote code must not force a second Resource setup path into it.

**Alternatives considered:** Keeping a mixed public entry point suggests unsupported features are delivered. Deleting all deferred source is unnecessary. Hiding only TypeScript types fails to reject unsupported JavaScript calls.

Retained private Policy and remote source can keep its internal types and tests. The Local entry point must not import their factory. Build roots and the production-module allowlist must agree; retain private compilation roots where needed rather than introducing fake public exports. Package tests exercise only public Local exports. Historical evidence remains historical.

## Usage and settlement

**Decision:** Treat supplied usage as cumulative direct totals. Missing values remain unresolved, equal totals add no new usage, and decreasing totals fail. Consumable increments consume at most current live quantity. Reusable increments record use without consumption. Permanent deficits never fall. Settling Budgets reject additions and child creation; finalization waits for complete usage and settled children.

**Rationale:** Current settlement rejects any changed known total and derives reusable overuse from child allocation. Both differ from KEY-5. The formulas and terminal behavior are defined in [data-model.md](data-model.md).

**Alternatives considered:** Treating each report as a new total charge duplicates consumption. Treating missing values as zero hides unresolved work. Revisiting deficits after child returns erases evidence.

## PostgreSQL transaction ordering and inspection

**Decision:** For this conformance implementation, lock the connected tree's root Budget row before reading mutable accounting. Resolve command replay first. Every mutation in a tree follows that order and allocates history sequence numbers transactionally. Different trees can proceed independently. Definition batches reconcile names in canonical order under uniqueness constraints. Inspection assembles state and history in one SQL statement snapshot.

**Rationale:** A root row lock keeps ancestor finalization and sibling requests serial without opposing child-to-parent lock chains. This trades within-tree concurrency for simpler correctness. KEY-5 has no throughput target. Separate reads at PostgreSQL Read Committed may see different commits, so inspection must not assemble its result through multiple snapshots. See PostgreSQL's [locking documentation](https://www.postgresql.org/docs/18/explicit-locking.html) and [isolation documentation](https://www.postgresql.org/docs/18/transaction-iso.html).

**Alternatives considered:** Fine-grained child/parent locks need more lock-order and retry machinery. Serializable transactions also require retry handling. A sequence object would not provide rollback-contiguous history numbering; use a transactional tree counter instead.

## PostgreSQL baseline and compatibility

**Decision:** Replace the active development migration graph with the clean `0001-baseline` already required by `docs/architecture.md`. Update generator selection, hashes, installation records, and fixture installation together. Build the shared ungoverned procedures into that baseline. Reject incompatible installation metadata; never silently upgrade an old database.

**Rationale:** The current six-migration graph and checksum-pinning generator encode older semantics. Adding another compatibility layer contradicts the accepted clean-baseline direction. This feature needs a reproducible disposable PostgreSQL fixture, not a released installation or upgrade product.

**Alternatives considered:** Appending a migration preserves a target explicitly retired by the architecture. Maintaining two active accounting generations creates ambiguity about which backend the suite qualifies. Historical source and evidence remain available in Git history; no existing user database is changed by planning.

## Verification and package scope

**Decision:** Extend the same shared registrar for both real backends. Add a focused PostgreSQL conformance runner that reuses existing container, installation, cleanup, and record helpers without provisioning PgBouncer or running remote/Policy suites. Require deterministic rollback checkpoints and controlled concurrent commands. Keep Local lifecycle tests and packed-consumer qualification separate.

**Rationale:** `test:integration` is installation-oriented. The current PostgreSQL system runner executes a broad deployment inventory. Neither is a substitute for an explicit, required KEY-5 shared-semantic result. The same suite must run on both adapters; separate backend-specific copies can drift.

**Alternatives considered:** Mock PostgreSQL cannot prove its transitions. A manually selected subset can omit new scenarios. Running only repository tests misses missing archive assets and public API regressions.

Use the existing three OS lanes, resolve the latest Node release for each qualification attempt, and freeze exact versions in its record. The inspected Node documentation is currently for 26.8.1, while the local host is 26.5.0; neither replaces runtime qualification. `node:sqlite` provides the in-process database API; its synchronous operations stay behind the asynchronous SDK queue. See the [Node SQLite API](https://nodejs.org/api/sqlite.html). No new library is required. Performance and operational qualification remain NOT RUN.
