# Validation guide: Define Resources independently

This guide is for the future implementation revision. The current artifacts are
design only. Feature runtime, native PostgreSQL, installed consumers, and CI are
`NOT RUN` until their commands execute against that revision.

## Prerequisites

Use the owning branch and explicit feature directory. Start from a clean candidate
with Node.js `>=24`, pnpm 11.21.0, frozen dependencies, and Docker for native tests.
KEY-75's paired gate is already in the inspected ancestry. Do not copy its old
results as evidence for KEY-77.

Run from the repository root:

```sh
export SPECIFY_FEATURE_DIRECTORY=docs/features/key-77-define-resources-independently
.specify/scripts/bash/check-prerequisites.sh --json --paths-only
git rev-parse HEAD
git status --short
node --version
pnpm --version
pnpm install --frozen-lockfile
```

Implementation tasks must first add and observe failing behavioral assertions for
the relevant scenario. Generate changed command artifacts with `pnpm generate`.
The planning command does not implement those assertions or execute runtime lanes.

## Provider-free validation

```sh
pnpm generate:check
pnpm test:repository
pnpm test:local
pnpm typecheck
CI=true pnpm test:pr
pnpm format
```

Expected outcomes: current generated artifacts, no repository errors, passing
Local definition/creation and Policy regressions, exact name inference, and no
unexpected exported helper or binding internals. The PR command includes shared
SQLite scenarios and runner checks but does not establish native PostgreSQL.

Extend the current SDK package consumer and compatibility fixtures with the
[ordinary example](contracts/resource-api.md#ordinary-use), raw creation, exact
allocation checks, declaration-based Policy authoring, and removed-export checks.
Separately declared definitions must work without `satisfies`, helper, generic,
or `as const`; the optional strict form must also compile.

## Shared authority scenarios

Add the feature scenarios through
`packages/contracts/contract-tests/scenarios/index.ts` and
`registerBudgetContractTests`. Extend existing host clients and private state
observation/fault hooks only as needed. Do not create a copied scenario inventory
for one authority.

| Scenario group                                                              | Expected observable result                                                                                                              | Requirements                           |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| New batch, mixed new/existing, reordered exact reuse                        | One complete binding; stable Resource IDs and original evidence; zero Budgets and quantity.                                             | FR-001, FR-002, FR-005; SC-001, SC-002 |
| Invalid field/name/unit/behavior anywhere, conflicting immutable definition | No new definitions, private references, or canonical success result; unrelated state preserved.                                         | FR-003, FR-004; SC-003                 |
| Lost response, exact canonical retry, conflicting command identity          | Exact stored result and reference on replay; new equal command is non-replay; changed input conflicts.                                  | FR-010; SC-003                         |
| Raw and binding creation, subset allocation, unknown names, failed creation | Same existing allocation-based membership; bound creation has zero definition writes; failures preserve committed definitions.          | FR-007, FR-008; SC-001, SC-003, SC-004 |
| Fixed funding and independent roots                                         | Reused binding creates independent roots before or after another settles; no reopening or migrated balances; no top-up path.            | FR-014, FR-015, FR-016; SC-007         |
| Consumable/reusable child return and insufficient request                   | Parent availability recovers only existing grant remainder; funding unchanged; denial does not settle outstanding work or invent usage. | FR-014, FR-015, FR-016; SC-007         |
| Existing Policy behavior with plain definitions                             | Same compilation, context, decisions, reasons, evidence, and replay for raw/bound creation.                                             | FR-009, FR-014; SC-005, SC-006         |

For conservation assertions, count each live quantity once: use available quantity
at a parent rather than adding its full allocation again to child holdings. Count
consumed and terminally released quantity once. Reported overage is deficit
evidence, never authorized funding. Keep this a bounded regression over existing
projections/history; KEY-80 owns the journal conversion and full target evidence.

Retain explicit zero-member and all-zero-root checks on canonical PostgreSQL and
Local, including no later funding. Record remote zero rejection as the known
KEY-78 boundary. Do not label it as new full-target parity evidence.

## Native and deployment-specific validation

After the provider-free checks pass, use existing isolated Docker fixtures:

```sh
pnpm test:embedded
pnpm test:remote
pnpm test:sqlite-postgres -- --output ".artifacts/key-77/paired-$(node -p 'crypto.randomUUID()')"
```

The focused commands are feedback. The paired command is required acceptance and
must run the complete shared registration against real private SQLite and native
PostgreSQL, plus the complete native-only inventory. Missing Docker, skipped or
empty scenarios, failed assertions, stale reports, and failed cleanup cannot pass.

| Native scenario                                                                                                     | Location to extend                                                                              | Evidence required                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Matching/conflicting overlapping batches in opposite orders; singleton/raw creation races; same-command contenders  | `packages/postgresql/test/system/contention.test.ts`                                            | One identity per name; losers have no partial effects; command wait/replay is correct.                                                 |
| Fault after definition insertion, reference/result storage, and bound root mutation                                 | `packages/postgresql/test/system/rollback.test.ts`                                              | No partial definitions/receipt/root/history; subsequent retry is correct.                                                              |
| Definition, bound creation, and application-table writes in caller transaction; visibility across sessions          | `packages/postgresql/test/system/embedded-transactions.test.ts`                                 | Commit is visible only after caller commit; rollback removes all work; existing committed bindings survive failed consumption.         |
| Same-scope second client after producer close; independent installation and tenant; revoked and unauthorized caller | `packages/postgresql/test/system/remote-security.test.ts` and `remote-budget.test.ts`           | Valid same-scope use; generic foreign rejection with no mutation/disclosure; binding creation works without definition permission.     |
| Definition response loss, stable operation key, exact replay/conflict, recovery, simulated recovery expiry          | `packages/postgresql/test/system/remote-recovery.test.ts`                                       | No duplicate effects; recovered opaque binding works; canonical receipt survives recovery expiry.                                      |
| Fresh installation, exact recheck, stale wire/generation, changed grants and procedure inventory                    | `packages/postgresql/test/system/installation.test.ts` and integration/unit installation suites | Current contract installs/rechecks; stale or drifted state fails before mutation; remote role cannot access private/canonical objects. |

Update `required-scenarios.ts` and the fixed procedure map in
`test/system/support/procedure-caller.ts` so new operations and tests actually run.
Use controlled test time/state to exercise expiry, not a 30-day wait. Retain direct
and supported pooled connection coverage through the existing native runner.

SDK-specific tests also prove FR-006, FR-009, FR-012, and SC-005: binding reflection
and mutation resistance, copied/reconstructed rejection, separately declared
inputs, asynchronous malformed-call rejection, snapshots, Local close precedence,
queue drain, and isolated Local authorities. Extend existing public, lifecycle,
remote-recovery, and Policy test files. FR-011 and FR-013 require the native
contention and caller-owned transaction evidence above, completing SC-006.

## Installed package consumers

Build and qualify exact archives using the existing runners:

```sh
pnpm pack:sdk
node packages/sdk/test/package/qualify.ts \
  --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz \
  --output ".artifacts/key-77/sdk-$(node -p 'crypto.randomUUID()').json"
pnpm pack:postgresql
node packages/postgresql/test/package/run.ts \
  --archive .artifacts/package-tests/postgresql/keynes-postgresql-0.0.0.tgz \
  --output ".artifacts/key-77/postgresql-package-$(node -p 'crypto.randomUUID()').json"
```

These filenames match the inspected `0.0.0` packages. If package versions change,
use the exact paths emitted by pack. Record archive digests. The SDK consumer
must import the installed package, compile the changed API examples, execute
Local definition and binding creation, and verify no private exports or helper
remain. The PostgreSQL package checks must include the new emitted migration,
metadata, and installer behavior. Native tests separately establish installed
database procedures, profile/grant behavior, and caller transactions.

Provider-free SDK archive qualification does not establish installed remote SDK
acceptance. Keep that broader lane `NOT RUN` unless separately executed under its
existing qualification contract. KEY-77's focused package proof covers its API,
Local runtime, generated contents, and PostgreSQL installable package; native
remote source tests prove the feature's remote behavior. No live Hosted or paid
provider execution is needed for this feature.

## Retained acceptance record

Record the candidate SHA, clean/dirty state, dependency and runtime versions,
contract/procedure identities, archive digests, host, fixture image identities,
attempt ID, exact commands and outcomes, and cleanup results in feature evidence.
The paired manifest and sanitized reports must identify the same candidate and
complete scenario sets. Retain reports or durable copies before CI expiry.

Provider-free, SQLite, native PostgreSQL, Embedded, remote, package, and CI results
must stay distinct. Record failed, skipped, and `NOT RUN` lanes explicitly. A
generated migration or green unrelated CI is not runtime acceptance. No readiness,
performance, production, or live Hosted claim follows from this plan.

## Planning-only checks

For this design-only change, run:

```sh
pnpm exec oxfmt --check docs/features/key-77-define-resources-independently
pnpm test:repository
git diff --check
```

Also verify internal Markdown links and absence of unresolved template markers.
No behavioral test is required for planning prose. Runtime implementation and
acceptance begin only in the implementation phase.
