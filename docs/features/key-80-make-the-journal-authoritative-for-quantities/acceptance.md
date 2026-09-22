# KEY-80 acceptance evidence

KEY-80 is implemented and locally qualified on the exact source revision in
[Final acceptance](#final-acceptance). Earlier sections retain the phase
baselines, failed attempts and review history; they are not final qualification.

## Phase 1: baseline and compatibility owners

- Branch: `key-80-make-the-journal-authoritative-for-quantities`
- Source revision: `3f5792fcff5a257b07a368866badce9d593750f3`
- Checkout: clean before Phase 1 documentation changes
- KEY-76 merge `70beb791bb81dd07438d69f7f80766ee97b79318`: ancestor verified
- KEY-96 merge `3c47555e124a35844b448ba221f01f8a199109df`: ancestor verified
- Host: Darwin 25.5.0 arm64; Node v25.9.0; pnpm 11.21.0; Docker 29.6.2

`packages/database/contract.json` is the canonical contract source. Its
generated PostgreSQL installation identity is
`packages/postgres/generated/installation-record.json`; the PostgreSQL package
generator copies that record from `packages/database/postgres/generated/`.
The installer reads the package copy and exact recheck compares its recorded
contract, migration, and procedure identities. These are the compatibility
owners for this feature.

| Input                                                  | SHA-256 or generated identity                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `packages/database/contract.json`                      | `17c11670dbaf042f29a8f546beab401a3c76b920c4100cf07b01c26164b18e5d` |
| Canonical command contract digest                      | `046373b4c3c42d50437a120a3ba952ed08f5259fbe5c282d47fda0f04b033766` |
| Remote procedures digest                               | `b72a9058b6f827d859168932e6f8c04fedc312f79bef7cb59ebb685478d4eedd` |
| Migration-set digest                                   | `71a32dd66d2397ac75f4d2e4af8328d15e2fbc7843b15c5105bbbe0b275f48ed` |
| `packages/postgres/generated/installation-record.json` | `697d33397996f6f38a860a4e50e5105d753b82f068a0bfe8d903e2c8689f60b9` |
| `pnpm-lock.yaml`                                       | `8b41bae2ceb5a512d858f0eeabe6738ae8b43117c5db9392a3c85720a4cb2235` |

The generated installation record specifies profile
`embedded-postgresql-18.6-preview`, server version `180006`, and migration
`0001-baseline` with SHA-256
`87536ca5a29dbd6569440644bf8f6e9e64483836f571496dc07fbc62343c4fca`.

| Command                                                                               | Outcome                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` | PASS: selected the KEY-80 feature directory; `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, and `tasks.md` present. No extension hooks. |
| Feature checklist                                                                     | PASS: 15 checked, 0 unchecked.                                                                                                                          |
| `pnpm install --frozen-lockfile`                                                      | PASS.                                                                                                                                                   |
| `pnpm generate:check`                                                                 | PASS.                                                                                                                                                   |
| `pnpm --filter @keynes/node-sqlite test`                                              | Initial setup failure before behavioral assertions: the baseline checkout lacked built `@keynes/sdk` exports. This is not RED evidence.                 |
| `pnpm build:sdk && pnpm --filter @keynes/node-sqlite test`                            | PASS: 5 files, 194 existing baseline tests. This is setup confirmation, not KEY-80 behavioral qualification.                                            |
| `pnpm test:ci:postgresql`                                                             | PASS: 12 files, 274 existing baseline tests; test process and cleanup passed. This is setup confirmation, not KEY-80 behavioral qualification.          |

## Phase 1 review

Parent correctness review: PASS, setup evidence is explicitly distinguished from feature qualification. Ponytail review: Lean already. No implementation was included in this phase.

## Phase 2: private fault support

Source revision before this phase: `51d9f70`. Added the private
`after_quantity_movement` and `after_ancestor_finalization` fault stages, and
passed `ContractClientOptions` into native caller-owned attempts. The stages
are declarations only until the real SQLite and PostgreSQL journal paths emit
them in T012 and T013. Concrete journal facts also wait for those real rows;
this phase adds no empty, optional, or legacy-derived journal observation.

| Command                                                 | Outcome                           |
| ------------------------------------------------------- | --------------------------------- |
| `pnpm generate`                                         | PASS                              |
| `pnpm generate:check`                                   | PASS                              |
| `pnpm --filter @keynes/database typecheck`              | PASS                              |
| `pnpm --filter @keynes/node-sqlite typecheck`           | PASS                              |
| `pnpm --filter @keynes/postgres typecheck`              | PASS                              |
| `pnpm --filter @keynes/node-sqlite test -- --runInBand` | PASS: 5 files, 194 existing tests |

The SQLite suite checks that the new stage declarations preserve the current
host and shared behavior. It does not qualify journal accounting or cascade
rollback, which remain **NOT RUN** until the journal implementation and
behavioral tests land.

Parent correctness review: PASS. Ponytail review removed one redundant object spread from the native caller context; no remaining complexity findings.

## Phase 3: tests before implementation

The tests-first work starts from `f8d4eaa` with uncommitted test additions. No
journal engine changes are present at this checkpoint. Parent review requires
the native sibling test to await the first command before starting its blocked
contender, and requires the ancestor fault test to finalize a child beneath a
settling parent. A root-only settlement cannot prove an ancestor checkpoint.

The initial generation assertion used an overly strict partial procedure-array
comparison. After restoring the complete metadata assertion, the parent reran
the focused check and confirmed that its failure is generation 4 versus 5.

| Command                                                                                         | Result before accounting changes                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @keynes/database exec vitest run test/generate-contracts.test.ts --maxWorkers=1` | RED: 1 failed, 33 passed. Source semantic/minimum SDK generations remain 4; expected 5. Log `/tmp/key80-red-contract.log`.                                                                                                                                        |
| `pnpm --filter @keynes/sdk exec vitest run test/unit/public/local.test.ts --maxWorkers=1`       | RED: 1 failed, 69 passed. Returned quantity leaves a settled root with available 90 instead of 0. Log `/tmp/key80-red-sdk.log`.                                                                                                                                   |
| `pnpm --filter @keynes/node-sqlite test`                                                        | RED: 11 failed, 190 passed. Mixed root retains 55/4 instead of 0/0; deficits are recomputed; new cascade checkpoints do not fire. The 1,025-cycle turnover completes and fails on retained terminal quantity. Log `/tmp/key80-red-sqlite.log`.                    |
| `pnpm test:ci:postgresql`                                                                       | RED: 18 failed, 270 passed; 12 files executed, cleanup passed. Same retained-quantity/checkpoint failures on native PostgreSQL; sibling commands block but retain terminal quantity. Run `6521fb60-e8bc-4e0d-81be-574b8dd416ac`, log `/tmp/key80-red-native.log`. |

Two native failures are not semantic RED evidence: the turnover fixture times
out at 20 seconds, and the repeatable-read fixture uses a principal without
read permission while establishing its snapshot. Both test defects must be
corrected and rerun. The synthetic old-generation installation case also
stops at its prerequisite assertion that generation 5 exists; refusal of an
older baseline remains unproved until the metadata changes and full case run.

The added three-level cascade test also fails before conversion on missing
ancestor history: expected 8 events, received 6 (`pnpm --filter @keynes/node-sqlite exec vitest run test/contract/budget.test.ts -t 'orders a three-level cascade' --maxWorkers=1`;
log `/tmp/key80-red-cascade.log`). Native accounting qualification and journal-fact assertions remain pending.
Public projection tests must include nonzero returns and automatic ancestor
finalization: an exhausted grant already has zero availability in the old
engine and is insufficient evidence for the changed behavior.

### Compatibility metadata checkpoint

T011 changes semantic and minimum SDK generation from 4 to 5. Procedure
revisions become create 5, request 3, settle 2, and get/history/open/recover/
compatibility 3. Resource definition and validation revisions remain 1.
Canonical SQL and generated artifacts agree. No fixture-input or public-shape
change is necessary. This metadata checkpoint is not an engine qualification.

Terra writer checks, followed by parent diff review:

- `pnpm generate`: PASS.
- `pnpm generate:check`: PASS.
- `pnpm --filter @keynes/database exec vitest run test/generate-contracts.test.ts --maxWorkers=1`: PASS, 34 tests.
- `pnpm --filter @keynes/postgres exec vitest run test/unit/build.test.ts test/unit/postgresql-command-executor.test.ts --maxWorkers=1`: PASS, 29 tests.
- `git diff --check`: PASS.

At this metadata checkpoint, Phase 3 remained incomplete. The candidate and
qualification results below supersede that status.

### Integration attempts

`pnpm test:ci:postgresql`, attempt `9738daeb-b8b7-48e3-b44b-b2bfde7af0bd`,
failed during installation with `incompatible_target` for the new `budget_live`
function. The run reported 265 failed, 17 passed, 12 skipped, and one unhandled
error; cleanup passed. This does not establish accounting behavior. The canonical
function definition and generated installation metadata must agree before the
next native run. Log: `/tmp/key80-native-integration-1.log`.

After correcting the helper's canonical formatting and regenerating its
volatility metadata, native attempt `4a42f129-9192-415c-ab7a-a1682aee51b0`
ran the accounting tests: 289 passed, 5 failed across 12 files; cleanup passed.
Four failures are obsolete expectations (settled Budgets retaining availability
or reporting stored lifecycle `settling`). The new lost-response cascade fixture
fails before settlement because its root operation key was not encoded with the
existing helper. These expectations and fixture are being corrected; this is
not yet a passing native qualification. Log: `/tmp/key80-native-integration-2.log`.

Native attempt `d31cbeb6-2e54-4cb6-8eed-05583b1d11ff` passed 299 tests and
failed one reference assertion. The journal inspection order is deterministic,
but not chronological; checking nonnegativity before finishing the snapshot
fold incorrectly treated a root release as preceding the same-command return.
The assertion now checks balances after folding all rows. Trigger drift and
lost-response cascade cases passed in this run; cleanup passed. Log:
`/tmp/key80-native-integration-3.log`.

The first `pnpm test:pr` attempt stopped at the repository test's historical
contract/baseline hash pins (63 passed, 1 failed), before package quality and
type gates. Those pins must identify the reviewed generation 5 contract and
baseline, while retaining the unchanged schema identity. Log:
`/tmp/key80-pr-check-1.log`.

The fourth native attempt passed all 300 assertions in 12 files and cleanup,
but the runner rejected its exact scenario inventory with `Incomplete native
coverage`. It is not a passing lane until that registration mismatch is
resolved. Log: `/tmp/key80-native-integration-4.log`.

The second PR-check attempt reached package tests and failed on 15 PostgreSQL
unit tests whose compatible mock still advertised the old procedure revisions.
After correcting that mock without changing legacy-incompatibility fixtures,
the PostgreSQL unit suite passed all 169 tests. The full PR command remains
pending. Log: `/tmp/key80-pr-check-2.log`.

## Phase 3 candidate checks and review

`pnpm test:pr` passed on the uncommitted Phase 3 implementation based on
`f8d4eaa`: 16/16 package tasks, repository checks, generated-output checks,
types and dependency boundaries passed. Package tests include 203 SQLite
assertions, of which 138 are shared accounting scenarios, and 169 PostgreSQL
unit assertions. Log: `/tmp/key80-pr-check-3.log`. This is working-tree evidence;
the clean candidate qualification below must identify a commit.

The fifth `pnpm test:ci:postgresql` attempt also passed all 300 assertions and
cleanup, but still failed the exact scenario inventory gate. The previous
quoted-name correction was insufficient. Log: `/tmp/key80-native-integration-5.log`.

An initial `pnpm test:sqlite-postgres` invocation omitted the required output
argument and failed before running tests. The validation guide now includes the
existing output argument for both paired and package qualification. Those
runners also require a clean committed source candidate; an implementation
checkpoint commit is necessary before their evidence can be collected.

Terra engine writers completed both canonical implementations and generated
copies. Parent review checked journal-only authorization/projection, zero
movements, sticky deficits, actual rollback hooks, root-before-target locking,
ancestor history and installer trigger checks. Independent Terra correctness
spot review found no remaining issues in those final changes. The final
read-only Ponytail review found no unnecessary complexity: "Lean already. Ship."
The earlier redundant PostgreSQL movement uniqueness constraint was removed;
the primary key already covered it.

The user authorized continuing from merge `6434a5438eaf34cb6740bac15914dc42ccf08588`,
which incorporates KEY-116. Frozen installation passed with its lockfile.
`pnpm test:pr` then passed all 18 tasks, types and dependency checks on that
merged working tree. Log: `/tmp/key80-pr-check-4.log`.

The retained diagnostic report at `/tmp/key80-native-coverage-diagnostic.json`
identified the remaining inventory mismatch: Vitest truncates the long
parameterized trigger-event title. After matching the actual recorded title,
`validateSelectedPostgresqlReport(report, { kind: "ci" })` passed against that
real 300-assertion report. PostgreSQL typecheck and diff checks also passed.
This validates the retained report with the corrected inventory, not a new
terminal native run. Clean-revision qualification follows the candidate commit.

### First clean candidate qualification

Candidate `d7f06847ebc039aee0df26bd49a240de569eeab7` ran
`pnpm test:sqlite-postgres -- --output .artifacts/key-80/paired-d7f0684-1`.
Attempt `f5318739-eb7b-42ae-8492-ea53d452b551` retained clean-before/after
identity and passed all 416 SQLite assertions. Native PostgreSQL passed 311
assertions and failed the packed consumer walkthrough; cleanup passed. The
attempt is FAILED and is not qualification. Log: `/tmp/key80-paired-2.log`.

The consumer expected an unresolved direct Resource in the root's first
settlement history despite explicitly reporting zero direct usage. That history
field lists missing direct reports; unresolved descendants belong to the Budget
projection. Both canonical engines and SDK mapping confirm the distinction.
The fixture now expects an empty direct-unresolved array while retaining the
root's `settling` history and all three target/ancestor records. Parent reviewed
the one-line correction; Ponytail review found no added complexity.

## Phase 3 accepted implementation

Source candidate: `196cafc6bef73c31d819654858181e885e81d4d3`, clean before
and after qualification. Both engines, generated contracts, native transaction
coverage and public consumers now agree.

| Command                                                                      | Result                                                                                                                                                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:pr`                                                               | PASS on the merged working tree before the one-line consumer correction: 18/18 tasks, types, generation and dependency checks. Final review-revision run follows in Phase 4. |
| `pnpm test:sqlite-postgres -- --output .artifacts/key-80/paired-196cafc-1`   | PASS: 416 SQLite and 312 native PostgreSQL assertions, matching 138 shared scenarios, both cleanups passed. Attempt `0aefe91e-09ff-4476-bd5a-f857acbf1a1c`.                  |
| `pnpm test:embedded`                                                         | PASS: 167 assertions in 2 files, including caller-owned cascade rollback; cleanup passed. Log `/tmp/key80-embedded-1.log`.                                                   |
| `pnpm test:package:split -- --output .artifacts/key-80/packages-candidate-1` | PASS: all 9 stages, four clean consumer combinations, 312 native assertions, exact archive identity checks and cleanup.                                                      |
| `pnpm format:docs`                                                           | PASS: 332 files.                                                                                                                                                             |

Package qualification retains `result.json`, SDK-only and SDK+SQLite records,
PostgreSQL package and native records, native observations, CLI/native reports,
and the four archives in `.artifacts/key-80/packages-candidate-1/`. The paired
manifest and runtime reports are in `.artifacts/key-80/paired-196cafc-1/`.
These local retained records qualify this source candidate; final documentation
changes require their own review-revision record below.

Parent correctness review accepted the Terra implementations and consumer
correction. The final Phase 3 Ponytail review found no unnecessary abstraction
or dependency: "Lean already. Ship." T004-T016 are complete. The implementation
candidate and follow-up fixture correction were committed before clean-source
qualification; this phase-closing commit records the accepted result.

## Phase 4 documentation candidate

The architecture and database/runtime/SDK READMEs now describe journal-derived
quantities, immutable first-known usage, sticky deficits, empty finalized
Budgets, the public 100/40/10 return example, generation 5 and fresh-only
installation. PostgreSQL documentation replaces the old child-before-parent
lock rule with root-before-target coordination, explains whole-transaction
retry after serialization failure, and retains coherent read-only inspection.
`docs/product.md` already states this contract and needed no change.

A single canonical SQL comment documents the deliberate per-tree lock
throughput ceiling requested in the design. Generation refreshed the distributed
SQL and installation identities; no SQL behavior changed. This changes archive
and installation hashes, so final qualification uses the documentation candidate
rather than reusing Phase 3 archive evidence.

Phase 4 parent review checked the documentation against both canonical engines.
Independent Terra read-only correctness and Ponytail reviews found no actionable
discrepancy or unnecessary complexity. `pnpm generate:check`, documentation
formatting and `git diff --check` passed before the candidate commit.

## Final acceptance

Verified source revision: `599d0b48de8490ff211d216ed4738ec5939ba55a`.
The paired and package records confirm the same clean commit before and after
execution. The following evidence/task record commit changes no executable
source, package content or installation assets. It does not retroactively
change the source revision or archive hashes qualified here.

Host: Darwin 25.5.0 arm64; Node v25.9.0; pnpm 11.21.0; Vitest 4.1.11;
pg 8.23.0; SQLite 3.53.0;
Docker 29.6.2; native PostgreSQL 18.6 (`180006`); PgBouncer 1.25.2.
All four private package versions are `0.0.0`.

| Final command                                                                  | Outcome                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:pr`                                                                 | PASS: all 18 workspace tasks, none cached; repository/runner tests, generation, types, package tests and dependency boundaries.                                                                                                                            |
| `pnpm test:sqlite-postgres -- --output .artifacts/key-80/final-paired-599d0b4` | PASS: 416 SQLite and 312 native assertions; identical 138 shared scenario names; no failed, pending or todo cases. Both process exits and cleanup passed. Attempt `a719f46b-3fd6-4f51-98c9-4a5628fc643e`.                                                  |
| `pnpm test:package:split -- --output .artifacts/key-80/final-packages-599d0b4` | PASS: all 9 stages; SDK-only, SDK+SQLite, SDK+PostgreSQL, CLI consumers; 31 PostgreSQL package, 8 CLI and 312 native assertions. Archive integrity, external installed paths and cleanup passed. Native run `5cda66a3-8332-4268-bea3-22fb950446e3`.        |
| `pnpm test:embedded`                                                           | PASS: 167 assertions in 2 files, source installation, caller-owned commit/rollback and cascade behavior; process exit and cleanup passed.                                                                                                                  |
| `pnpm format:docs`                                                             | PASS: all 332 selected files. Package README formatting also passed separately.                                                                                                                                                                            |
| Explicit-directory Spec Kit prerequisites and final diff audit                 | PASS: required feature artifacts present; no allocation column or recursive quantity-authority helper remains in either canonical engine; staged copies pass generation checks. No workflow, Node support or unrelated policy changes in the feature diff. |

### Source and archive identities

| Input                      | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `contractDigest`           | `046373b4c3c42d50437a120a3ba952ed08f5259fbe5c282d47fda0f04b033766` |
| `lockfileSha256`           | `b254d5523aeeb1495946c5c967b84585cde47412cca368bd5441383576c53395` |
| `installationRecordSha256` | `7224ff2745fa502b1a309464428eef598fd7082c3e473c62a64260bfd34db8eb` |

The canonical baseline SHA-256 is
`6a7d89038cb1c3f6926801c88a1c7b8fb4b1b93862d5f663fac8e9f1f60ab3d3`.
The installed archive set below was packed once by the package runner, consumed
outside the workspace, and rehashed successfully after qualification.

| Archive               | SHA-256                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `@keynes/sdk`         | `83266e77e97c72d70077579b55ae9f7b53e1b7ab3aa41d860f91202fb74678c3` |
| `@keynes/node-sqlite` | `f841dfa4219f1114283aae973d6984618a16f8ded00db2741b7329757af54550` |
| `@keynes/postgres`    | `700928dba1abd7393c5c318dda8ac3a7db3002b619e4f1b0f65aa8fc1bb02bea` |
| `@keynes/cli`         | `59d858f791f08d2e24a335bf718b850abefd5d86390db9ca8838641bcc560380` |

### Retained evidence

These are ignored local artifacts in this feature worktree. Full consumer
records, native observations, sanitized test reports and archives sit beside
their manifests. The manifests identify tool versions, image digests, installed
paths and clean source identity. This record retains the claims and hashes in
Git; it does not claim those local files were uploaded to CI.

| Retained record                                          | SHA-256                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| `.artifacts/key-80/final-paired-599d0b4/manifest.json`   | `7bce009f98c72bf5200f2c87b3d6644bd9297b510ef99825e4577b9a82affd83` |
| `.artifacts/key-80/final-packages-599d0b4/result.json`   | `500f1c711a9239b0f932809e79b8c123f056b8680915b8909dbeaf7f80ff074d` |
| `.artifacts/key-80/final-checks-599d0b4/test-pr.log`     | `79fd290f183755828905dc8f42b64d945800e797966b4189a517eeb71763419d` |
| `.artifacts/key-80/final-checks-599d0b4/embedded.log`    | `6d00b7a01244236bfe8ba0f66c3fa2234240ba34032b42a0a550088ba32be9ef` |
| `.artifacts/key-80/final-checks-599d0b4/format-docs.log` | `0a97dba0647e5af663711fa757dc7f48aa93d4bfe5ceb0c384ee10c342d79aa3` |

### Requirement audit and phase review

| Requirements           | Implementation and executed evidence                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001/002/003, SC-001 | Both canonical journals own funding, transfers and live projection. Shared mixed-tree, fixed-grant, zero/omitted membership and journal-fold assertions pass on both engines.                                                                             |
| FR-004/005/006, SC-002 | Observation-time deficits, bounded consumable use, reusable evidence, stored empty settlement and multilevel ancestor history pass, including repeated known usage and zero remainders.                                                                   |
| FR-007, SC-003         | Shared exact replay, conflict, denial replay and injected rollback compare actual journal facts. Native lost-response cascade recovery and borrowed rollback pass.                                                                                        |
| FR-008/010, SC-004     | Real native blocking proves both sibling orders, request/settlement serialization, stale repeatable-read full retry, independent roots and observation overflow rejection. Both engines pass 1,025 MAX_SAFE turnover cycles without gross-total overflow. |
| FR-009/011, SC-005     | Native permissions/tenant isolation, coherent reads, adapters, generation 5 compatibility, exact reinstall/trigger drift, public types and corrected installed consumers pass. Fresh-only compatibility and projection semantics are documented.          |
| FR-012                 | This feature retains its own clean-revision paired, archive and focused Embedded evidence, with exact hashes and explicit exclusions.                                                                                                                     |

Parent review of the Terra-authored code and documents is complete. Independent
Terra correctness and requirement audits found no remaining functional gap.
Ponytail review ran after every phase; final result: "Lean already. Ship."
All T001-T019 work is complete, including the PR description prepared from the
repository template. The original planning-only stop was superseded by explicit
implementation authorization. `.specify/extensions.yml` contains no post-implement
hooks. No additional convergence tasks are needed.

One draft PR remains the delivery unit: [PR #68](https://github.com/keynes-dev/keynes/pull/68).
The publication step pushes these commits and replaces its planning-only body.
CI results are not claimed by this local qualification record; the PR reports
its current head checks separately. Linear remains In Progress until merge and
required acceptance. No phase issues or PR stack were created.

### Evidence boundaries

NOT RUN: full Hosted/Embedded release readiness, live or managed providers,
broad security or performance qualification, Node/OS release matrices,
cross-authority recovery, registry publication and production operations.
The recorded native TLS and pooler tests qualify only their specific profiles;
focused Embedded source checks do not establish installed Embedded release
readiness. Historical prerequisite and earlier failed attempts do not qualify
the final candidate. No replenishment, additional grants, Resource/Policy
redesign, workflow changes or temporary second quantity authority are included.
