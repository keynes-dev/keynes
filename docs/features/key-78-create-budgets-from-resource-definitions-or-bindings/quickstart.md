# Validation guide: configured creation

This guide specifies acceptance after implementation. New behavior and type tests
are NOT RUN at planning time. Execute from the repository root using Node.js 24
or 26, pnpm 11.21.0, frozen dependencies, and Docker for native PostgreSQL. No
provider credentials or live Hosted environment are needed.

## Preparation

```sh
pnpm install --frozen-lockfile
export SPECIFY_FEATURE_DIRECTORY="docs/features/key-78-create-budgets-from-resource-definitions-or-bindings"
.specify/scripts/bash/check-prerequisites.sh --json --paths-only
```

The next tasks artifact must order expected failing tests before each behavioral
implementation. Retain the failing assertion/type diagnostic and revision. Do not
mistake missing infrastructure or a compilation setup error for the intended red
test.

## Focused feedback

Extend the existing public local/remote, lifecycle, Policy, and package type
fixtures. Register shared cases in the existing contract scenario suite and both
authority hosts. Update explicit native required-scenario inventories; no selected
case may disappear or remain skipped.

```sh
pnpm test:local
pnpm typecheck
pnpm test:remote -- --mode direct
pnpm test:embedded
```

The native feedback commands use isolated Docker fixtures. Provision Resources
explicitly in fixture setup before durable initialization. Initialization itself
must never provision. Selected feedback is diagnostic and does not replace the
full paired acceptance manifest.

## Required scenarios

| Cases                    | Procedure and expected evidence                                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US1 / FR-001,002,010,012 | Configure money/seats once; create positive, mixed-zero, omitted-seat, and all-zero roots. Inspect exact members, original amounts, active lifecycle, independent lineages. Zero adds no movement. Adding unused declarations changes no Budget.                                                       |
| US2 / FR-003,011         | Compile inline/imported declarations and inline/variable amounts. Unknown keys including zero reject statically; valid names infer without generics. Returned handles exclude omitted members. Exercise dynamic errors and verify no state effects.                                                    |
| US2 / FR-007,011         | Reject empty, negative, fractional, unsafe, non-finite, unknown-field, and malformed input. Mutate supplied configuration/amounts/options immediately after invocation; admitted meaning stays fixed.                                                                                                  |
| US3 / FR-004,005,006     | Compare isolated local catalogs; compatible durable subsets with extra catalog names succeed. Missing/conflicting used or unused declarations fail initialization. Compare all catalog/binding/command/Budget/history rows before and after validation to prove zero writes.                           |
| US3 / FR-005,007,011     | Fail startup after acquisition and observe host/pool cleanup. Wrong tenant, denied permission, stale definitions, invalid TLS/compatibility never disclose foreign state or fall back. A creation-capable principal without definition permission can initialize/create against a provisioned catalog. |
| US4 / FR-008             | Lose a committed response and retry the same identity. Reordered keys and extra unused compatible declarations recover the original result. Changed amount, omitted zero, and changed effective Policy conflict. Check both remote and canonical replay records.                                       |
| US4 / FR-009             | Race exact and conflicting identities; prove one root/effect. Inject failure after creation starts and roll back an embedded transaction with an application write. No membership, funding, history, or successful replay survives the failed attempt.                                                 |
| FR-010,012               | All-zero root denies positive requests, cannot gain funding, and settles only with ordinary explicit usage. Independent roots do not migrate balances or require other roots to settle. Existing Policy approval/denial/error and context/reason types remain valid.                                   |
| FR-011,014               | Close local runtime, then call malformed operations and observe asynchronous runtime_closed. Compile and run the adapted SDK package consumer. Old factory/positional/binding inputs fail. Explicit provisioning remains available without widening configured names.                                  |
| FR-013,014               | Compare shared SQLite/PostgreSQL results, errors, history, replay and state. Verify generated drift, immutable prior migration hashes, new procedure grants, incompatible generation rejection, fresh install and exact recheck.                                                                       |

Use [the interface contract](contracts/configured-creation.md) for payloads and
errors and [the data model](data-model.md) for storage invariants. The scenario
table owns expected observations, not an implementation or complete test suite.

## Candidate acceptance

Run the provider-free gate before native acceptance. Each paired output directory
must be new.

```sh
pnpm test:pr
pnpm format
pnpm test:package:sdk
pnpm test:package:postgresql
pnpm test:sqlite-postgres -- --output ".artifacts/sqlite-postgres/$(node -p 'crypto.randomUUID()')"
```

The paired command runs the complete native inventory, including supported remote
connection modes. For diagnosis use pnpm test:remote or
pnpm test:system:postgresql with a fresh output file; these do not replace paired
qualification. No separate paid or hosted lane is required.

Retain manifest.json, sqlite.vitest.json, postgresql.json,
postgresql.json.vitest.json, and postgresql.json.observations.json from the paired
attempt. Record source SHA and dirty-tree state, command, result, Node/pnpm/database
versions, attempt identity, file hashes, and cleanup observations. Record package
archive digest and consumer results separately.

Create acceptance.md only when executions supply actual results. Every lane must
say passed, failed, skipped, or NOT RUN, with startup failures distinguished from
executed assertions. Hosted, paid providers, performance, production readiness,
and installed database upgrades are outside this feature. Existing evidence from
older revisions cannot qualify the new candidate.
