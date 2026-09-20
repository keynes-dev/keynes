# Research: Request boundary and Policy retirement

Fresh source inspection at `6f765b81cc93824340cfcf2a79a3b4b031af7802`; runtime behavior NOT RUN. The old drafts were deleted. These decisions come from the current contracts, SDK and PostgreSQL sources, including independent read-only SQL research.

## Reuse allocation

**Decision**: Keep `Budget.request(amounts, options?)`, canonical `requestBudget` and `keynes.request(jsonb)`.

**Rationale**: SQLite `sqlite-command-executor.ts` already allocates without attached Policies. PostgreSQL `apply_command_legacy` owns ordinary validation, replay, locks and atomic denial/grant. Its Policy wrapper strips empty attachments; remove that behavior. Preserve KEY-78's current `apply_create_budget_v0008` creation logic instead of reverting creation to an older allocator.

**Alternatives considered**: Another allocation API or mandatory evaluator creates duplicate machinery and contradicts the governing boundary.

## Evidence without managed evaluation

**Decision**: Introduce optional `decisionEvidence` using the existing scalar-context bounds, stored in ordinary results/history. Reject old `context` rather than silently changing its meaning.

**Rationale**: Canonical and remote request schemas contain no general metadata property. Existing context is validated against attached Policies and rejects when none exist. Reuse the bounded data shape, validation primitives where independent, and storage; delete the compiler/profile ownership. The new name makes untrusted provenance explicit.

**Alternatives considered**: Reinterpreting `context` silently removes its former check. Arbitrary nested JSON and an evidence service are unnecessary. Applications keep large evaluation records and can submit a short identifier.

## Preserve identity and exact quantities

**Decision**: Snapshot and normalize evidence before command admission/binding. Include it in canonical and remote replay identity. Preserve Local fresh command UUIDs and remote operation keys/recovery.

**Rationale**: Local public calls create a fresh UUID; internal committed-response-loss retries reuse captured input. Remote definitive admitted failures have existing `known_failure` receipts even when canonical allocation rolls back. Neither mechanism should be replaced. Current quantities are nonnegative safe integers, with exact SQLite integer/BigInt and PostgreSQL arithmetic. Policy decimal evaluation can disappear without rewriting accounting.

**Alternatives considered**: Re-evaluation on replay duplicates customer work. Ignoring evidence in identity makes changed decisions look like exact retries.

## Reject obsolete installations

**Decision**: Advance semantic/minimum SDK generation from 3 to 4, revise affected procedures, remove Policy-profile identity and regenerate the single baseline/inventory.

**Rationale**: Remote compatibility already checks installation, command and procedure identities. The installer checks object inventory before identity columns, allowing old Policy objects to trigger structured incompatibility before querying removed columns. Explicit old/partial-target tests must prove that ordering fails closed without mutation.

**Alternatives considered**: A compatibility shim, upgrade migration or retained Policy-profile column contradicts complete retirement/fresh installs. No new installer profile is needed.

## Preserve membership and safety coverage

**Decision**: Test direct canonical requests for a tenant Resource absent from the parent, including amount zero, and fix the authority if reproduced.

**Rationale**: SQLite currently uses absent availability as zero after checking catalog existence. Source inspection suggests a zero-grant membership gap hidden by named SDK filtering. This is a suspected gap, not a verified runtime result. The submitted request must not expand parent authority. Preserve ordinary assertions from Policy suites before deleting evaluator-only tests.

**Alternatives considered**: Relying on SDK validation leaves direct callers unchecked. Deleting whole Policy suites without tracing assertions risks losing permission, replay and rollback proof.

## Retain generators and measurement responsibilities

**Decision**: Remove Policy profile loaders, generated types/SQL and parser bundles; retain ordinary generation, inventory, test selectors and measurement identity/cleanup checks.

**Rationale**: `packages/postgresql/scripts/policy-migration.ts` also builds the ordinary object inventory. `packages/sdk/test/performance/measure-worker.mjs` discovers parser assets. Both need selective changes. KEY-96 owns later package separation. No benchmark or package redesign is needed for planning.

**Alternatives considered**: Keeping a parser solely for fixtures defeats retirement; deleting all machinery in Policy-named files can break unrelated acceptance.
