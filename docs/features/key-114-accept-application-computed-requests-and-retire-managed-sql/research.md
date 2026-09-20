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

## Inventory: deletion and retained assertions

The managed Policy implementation is concentrated enough to remove without a replacement layer. The replacement is an ordinary request and the existing authority checks.

| Area                     | Remove                                                                                                                                    | Keep or move                                                                                                                                                                                                                                               | Owner                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Contracts                | `policy-profile.json`, Policy schema/type/profile outputs, profile loaders, renderers and contract policy cases                           | Resource, command, quantity, replay and rollback schemas. Add strict legacy-key rejection and ordinary request cases.                                                                                                                                      | T003, T005-T006, T011-T013, T018 |
| SDK public API           | `PolicyDefinition`, `PolicySet`, `NoPolicyContext`, `definePolicy*`, attachment options, Policy projections/errors and exports            | `Budget.request`, detached canonical input, Resource inference, admission and existing Local/remote retry behavior. Reject legacy keys before serialization.                                                                                               | T005, T007, T010, T013           |
| SQLite                   | `src/policy/`, Policy store state, evaluator calls and Policy command bindings                                                            | Atomic request admission, exact integer quantities, permissions, lifecycle, journal/history and rollback. Enforce direct parent membership, including zero amounts.                                                                                        | T008, T014                       |
| PostgreSQL               | Policy catalog/binding tables, descriptors, validators, renderers, evaluator, Policy evidence and profile identity in `0001-baseline.sql` | `apply_command_legacy`, configured creation, locks, security-definer paths, grants, command replay, caller transaction boundaries and ordinary inventory generation. Rename `policy-migration.ts` only after preserving its non-Policy inventory function. | T009-T010, T014                  |
| Generated/package output | generated Policy client/profile/types/schema files, parser assets and package compatibility Policy API                                    | ordinary client/types/validators, installation identity/inventory, archive identity, diagnostics and cleanup checks.                                                                                                                                       | T006, T010, T016-T017            |

Policy-only tests can go: contract policy cases; SDK `test/unit/policy/`; Local `policy-request`, `policy-replay` and `policy-fail-closed`; PostgreSQL `policy-runtime`, `policy-security`, `policy-request`, `policy-replay` and `policy-backend`. Their parser, compiler, evaluator, SQL-sanitization and Policy-profile assertions have no product replacement.

Do not delete these assertions merely because they sit in Policy suites. Move or restate them in ordinary request coverage before removing the suites:

- Approval reserves the exact requested quantity. Quantity denial leaves no child or holdings change. Keep in shared request-denial and Local/native budget cases under T005, T008 and T009.
- Replay returns the stored outcome before current availability is read, changed canonical input conflicts, and a rolled-back binding can be retried. Keep in shared replay and Local/native recovery coverage under T012 and T014.
- Failed mutation leaves no command, result, history, reservation or child. Caller-owned transactions keep every Keynes effect provisional until commit. Keep in rollback and embedded transaction coverage under T014-T015.
- Native locks, trusted `SECURITY DEFINER` paths, application-role isolation, malformed-command rejection and fail-closed CI classification remain. The Policy-specific payload checks disappear; their authority boundaries stay in native security, installation and classifier cases under T004, T009, T015 and T018.

`required-scenarios.ts` and qualification inventories must stop naming deleted Policy files only after the replacement request, replay, rollback and security assertions are registered. T018 owns that transfer.

### Retained safety coverage audit during implementation

The ordinary shared `request-denial.ts` already checks whole-envelope denial without partial reservation, independent request/settlement/read permissions, and invalid lifecycle requests. Shared `rollback.ts` retries the same request identity after each injected mutation checkpoint and verifies child, holdings and history before and after retry. Shared `settlement.ts` retains conservation, explicit zero membership, isolated deficits and arithmetic overflow. These assertions stay registered; duplicating them from deleted Policy suites would add no coverage.

Native `embedded-transactions.test.ts` already checks caller-owned commit/rollback, failed application writes, provisional visibility, identity reuse after rollback and committed replay. `contention.test.ts` proves waiting sibling allocation, request/settlement ordering and matching-command replay. `remote-security.test.ts` retains tenant isolation and denial of private objects and canonical procedures. Phase 4 extends these existing cases with evidence.

The generic security-definer search-path assertion in `policy-security.test.ts` must move into ordinary security coverage before that suite is deleted. The exact no-Policy command/result/replay/history JSON assertion is already present in shared `request-denial.ts`, executed by the native Budget aggregate. Policy SQL evaluation, evaluator revisions and declared-but-unrequested evaluator input locks have no remaining product behavior to test.

### Evidence integration checks

The generated SDK client recursively orders result fields using contract field ranks. Evidence keys such as `kind` and `resources` are valid caller keys but must retain ASCII order rather than inherit those ranks. T013/T014 must cover this collision as well as ordinary key reordering. Generated object validation currently measures JSON bytes before child validation; malformed JavaScript values such as bigint or accessors must reject without serialization or getter execution. Use the existing generator owner to enforce the evidence shape before measuring it.
