# Testing strategy study

## Intake and execution boundary

The implementation intake on 2026-09-05 starts at
`5b294f40899e6a4ac68a71a0e8def7529b5d44c8` with a clean worktree. The selected
directory is this directory; the checkout branch matches the exact `gitBranchName`
returned by [KEY-91](https://linear.app/keynes/issue/KEY-91/make-local-hosted-and-embedded-testing-independently-runnable):
`key-91-make-local-hosted-and-embedded-testing-independently`. Existing planning
artifacts are resumed. Linear remains the owner of mutable issue status.

[KEY-10](https://linear.app/keynes/issue/KEY-10/build-embedded-budget-authority)
owns packaged Embedded installation, profile selection, grants, exact recheck,
and drift refusal.
[KEY-11](https://linear.app/keynes/issue/KEY-11/compose-embedded-transactions)
owns application/Keynes transaction composition, restoration, and replay. Their
ownership was checked against Linear at intake. Fixture grants cannot establish
installed Embedded acceptance. Hosted operations require their own product
environment, authorization, and evidence.

The requested scope ends at tasks.md Phase 3, T012. Phases 1 and 2 establish the
study inputs. Phase 3 measures existing commands and one isolated pilot. No new
deployment entrypoints, product behavior, installation profile, or broad test
migration is authorized by this study. Missing or noncomparable native/package
measurements leave T012 incomplete. A measured pilot rejection is allowed.

## Governing obligations

The study follows [contributor workflow](../../workflow.md),
[product constraints](../../product.md), [architecture](../../architecture.md),
and constitution 8.0.1. SQLite and PostgreSQL keep their existing authority over
Budget state. Shared Budget and Policy behavior, raw boundary errors, identity,
transactions, replay, recovery, isolation, and cleanup assertions must remain.
The pilot must first fail an automated behavioral regression for its intended
reason. Default verification remains provider-free.

The complete `pnpm test:sqlite-postgres` command and its strict full inventory,
matching shared scenario names, source/archive identity, cleanup verdicts,
evidence schemas, CI check name, and upload receipts remain obligations. Selected
feedback cannot replace complete acceptance. Installed SDK qualification must
use an archive outside workspace dependencies. Historical source observations
and CI timings in research.md retain their original revisions and are not study
measurements.

At intake, comparative PR/native/package measurements and the pilot are NOT RUN.
The package OS/Node matrix, installed Embedded, actual Hosted, managed recovery,
and production performance are NOT RUN here. Local study results cannot prove
those lanes. Ignore files already cover dependencies, generated builds, logs,
credentials, editor files, and `.artifacts/`; package manifests use explicit
archive file allowlists. No ignore-file change is needed.

## Measurement protocol declared before experiments

Use two detached worktrees at the intake revision, named baseline and pilot,
under `/tmp/key-91-study-d1de673a-5dbf-46f1-9271-3c2324f54fe3/`.
Both frozen installs passed, in 2.651 and 2.431 seconds respectively. Dependencies
and lockfile are identical. The host is macOS 26.5.2 arm64, Node 26.5.0,
pnpm 11.21.0, Docker Engine 29.6.2. Both pinned image references in the native
runner are already present; preparation.json retains their resolved IDs.

All observations go under the new ignored directory
`.artifacts/key-91/testing-strategy/d1de673a-5dbf-46f1-9271-3c2324f54fe3/`.
Each invocation gets a fresh child directory and output path. Preserve failed
attempts. Record source revision, source patch digest where applicable, command,
exit status, monotonic wall time, operation counts, and evidence file hashes.
Retain only operation categories and durations from subprocess observation,
never credentials, SQL, environment values, or command arguments containing
fixture secrets. Runner reports keep their existing sanitization.

Run timings serially with no concurrent study workload. Use installed dependencies,
present images, and warm package-store/OS caches for both conditions. Warm each
command once outside the three measured samples; label warmups separately. Clear
only each isolated checkout's generated Turbo cache before each PR measurement,
so no quality/build cache hit can substitute for execution. Do not clear shared
package or Docker stores. Record any deviation and exclude it from comparison.

Baseline commands, from the baseline checkout:

```sh
pnpm test:pr
pnpm test:sqlite-postgres -- --output <fresh-attempt-directory>/paired
pnpm pack:sdk
pnpm test:package:sdk -- --archive <checkout>/.artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz --output <fresh-attempt-directory>/consumer.json
```

The last two commands form one representative SDK qualification attempt. Pack
runs the existing prepack build; the test command retains qualification-tool
self-tests and its installed consumer. Record preparation separately from
qualification. This is one local OS/runtime sample, not the full CI matrix.
No authorized-database mode or Hosted target is used.

Observe subprocess preparation, installation/recheck, assertion processes, and
cleanup separately. Vitest summaries provide transform/import and test durations;
test durations include test-owned setup and are not pure assertion CPU time.
Record overlapping child intervals as operation time rather than summing them
into wall time. Database/role setup and cleanup observations distinguish fixture
cost from assertion processes. Any unobservable subdivision must be identified,
not estimated as zero. Capture affected source/test line counts before and after.

Select exactly one pilot after the baseline. Run three candidate attempts of
each affected command under the same conditions; unchanged native/package owners
need no candidate rerun for a root-only command pilot. Require unchanged affected
coverage and negative-case detection, plus fewer repeated operations or less
code. Report individual and median values; claim no speedup from noise or cache
changes. Reconcile the design only after the complete study passes.

Preparation inputs:

| Input                    | SHA-256                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| pnpm-lock.yaml           | da737ab4f37bcad423502447a96050c16e5f4cb0d009d0067eb4915bc45c94e3 |
| package.json             | 8e9fc358f9b5b6df72bc643d32bde2136737d5ece385a7ecd0434359dd4f667d |
| turbo.json               | 84c2c688a28e5073d2188d5e529e9033f3fe6dc90b7ae19e50d86fb1bebebc73 |
| installation-record.json | 9832e7ddc790119cccb4a4e349fa16994eaa831d5732d9d902027f6b6b6bc89b |

## Coverage and ownership map

The following map describes the intake source, not future entrypoints. Root
commands coordinate package owners. `turbo.json` disables caching for tests and
typechecks; quality/build may cache, so the protocol clears the isolated root
cache before PR samples. Provider-free package commands limit workers to one, but Turbo
can execute different packages concurrently. The native runner leaves Vitest
worker concurrency at its default.

| Command or suite                           | Owner and exercised boundary                                            | Artifact and fixture lifetime                                                                                                              | Required proof and repetition                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| generate:check                             | Root coordinates contracts, SDK, PostgreSQL generators                  | Source and checked-in generated output; no database                                                                                        | Generated consistency, separate from generator regression assertions                                                                                           |
| test:generator                             | Contracts test directory                                                | Source, provider-free                                                                                                                      | Same contracts tests invoked again through Turbo in test:pr                                                                                                    |
| test:repository                            | Root organization tests                                                 | Source manifests and directory ownership                                                                                                   | Workspace, package/dependency, and workflow invariants                                                                                                         |
| Root explicit runner tests                 | Paired runner and native runner unit tests                              | Synthetic reports and controlled child/fixture failures                                                                                    | Missing/duplicate/skipped/error reports, source identity, cancellation, cleanup; no real-database proof                                                        |
| turbo run quality typecheck test           | Root quality; contracts, SDK, PostgreSQL, web own package scripts       | Source/builds; private SQLite in SDK cases; provider-free PostgreSQL unit/qualification tests                                              | Each package test script once, all typechecks and dependency boundaries; contracts repeats the earlier root alias                                              |
| test:unit / test                           | Root convenience aliases                                                | Same package-owned commands                                                                                                                | Not additional CI acceptance; test:unit excludes web and root checks                                                                                           |
| SDK unit/local and unit/public             | SDK public handles, SQLite authority, lifecycle, projection, validation | Private in-memory state per host/client, no external service                                                                               | Queue order, drain/close, isolation, exact errors, replay, public types; distinct from installed consumer                                                      |
| SDK unit/policy                            | SDK Kysely/raw parser and evaluator                                     | Source and shared immutable Policy corpus                                                                                                  | Compilation/rejection and local runtime semantics; runtime cases reused on native PostgreSQL                                                                   |
| SDK contract/budget                        | Contracts registrar through SDK SQLite host                             | Fresh host per shared scenario                                                                                                             | Lifecycle, replay, denial, Resource-bound root, rollback, settlement; full paired gate compares exact shared names                                             |
| SDK contract/remote and unit/remote        | SDK remote public/configuration/transport boundary                      | Controlled executor/pool inputs                                                                                                            | Provider-free transport/error behavior, not native authenticated access                                                                                        |
| test:sqlite-postgres                       | Root paired orchestration; native owner runs its full suite             | Real SQLite plus packed PostgreSQL CLI; one PostgreSQL container, two poolers, one network per attempt; fresh databases/roles within tests | Shared-name parity plus all 171 named native-only assertions; strict complete evidence and cleanup                                                             |
| test:system:postgresql                     | PostgreSQL native owner                                                 | Same full native runner and packed archive; no SQLite comparison                                                                           | Installation, recheck/drift, grants, Policy, contention, rollback, Embedded fixture transactions, remote identity/recovery/security and three connection modes |
| Native Budget / Policy fixtures            | PostgreSQL canonical procedures                                         | Fresh databases and four roles; ordinary installed fixtures run packed install twice; close drops owned database/roles                     | Isolation and transactional/committed-state proof must survive any fixture optimization                                                                        |
| Native integration installation/recheck    | PostgreSQL installer/procedure boundary                                 | Independent database and role state                                                                                                        | Dedicated exact recheck, privileges and drift failure; repeated ordinary recheck is a candidate, not removed here                                              |
| test:package:sdk                           | SDK qualification tooling then installed SDK root                       | Tool tests build twice, then prepack builds again; external consumer and isolated offline store per qualification, removed in finally      | Distribution determinism, content/size/license/private-path negatives, public types, Budget/Policy, isolation/closure/process loss; no workspace resolution    |
| pack:sdk / build:sdk                       | SDK artifact owner                                                      | prepack runs build; shared dist is replaced                                                                                                | Build-plus-pack can repeat a build; do not remove intentional two-build determinism proof                                                                      |
| test:package:postgresql                    | PostgreSQL packaging owner                                              | Packed CLI installed in temporary consumer                                                                                                 | Archive/CLI/import and packaging-runner assertions; separate from live native suite                                                                            |
| test:external:postgresql                   | PostgreSQL external qualification owner                                 | Explicit target/profile and authorized credentials                                                                                         | External deployment evidence; not invoked or authorized by this study                                                                                          |
| measure:package:sdk / SDK test:performance | SDK performance owner                                                   | Installed archive / dedicated measurement workers                                                                                          | Explicit measurement scope; not complete deployment acceptance                                                                                                 |
| testkit                                    | Shared archive/package mechanics                                        | Attempt-owned package/consumer directories                                                                                                 | No Budget semantics or coverage verdicts; no standalone test script                                                                                            |

CI `ci.yml` invokes `test:pr` once and the paired gate once in independent jobs.
The paired job retains exact evidence files and checks upload receipts. Manual
`postgresql-system.yml` runs the full native command without SQLite comparison.
Manual `sdk-package.yml` runs tooling self-tests in its build job, explicitly
builds then packs, and runs `test:package:sdk` in every OS/Node consumer job.
That consumer command repeats tooling self-tests even though the downloaded
archive has an independent digest. The measurement job measures the downloaded
archive separately. Cross-job repetition must not be confused with two invocations
inside a single PR scope.

The Budget aggregate invokes six registrars. `registerRemoteContractTests` is
exported by contracts but is not called by that aggregate or either deployment
owner. It is not active proof. Existing SDK remote and native remote tests retain
their own boundary coverage. Adopting the unused registrar would need a separate
obligation mapping; it is deferred. Shared Policy runtime cases are actively used
by SDK evaluation and native policy-runtime tests. Source-only Policy cases cover
SDK parsing and rejection, which the native runtime cannot substitute for.

Policy request/replay similarities include ceilings, denial, canonical evidence,
Context identity, and exact replay. Local tests additionally prove public handle
projection and evaluator bypass; native tests prove raw procedure bytes, pending
state before caller commit, rollback, lock ordering, and replay before database
Policy reads. Keep these raw assertions. A shared input table alone cannot replace
their boundary-specific proof.

The first PR warmup failed because Turbo filtered the observer's destination
environment variable. It is excluded. The revised observer embeds an attempt-local
path and records only categories/timestamps/status, leaving tested source unchanged.

Native warmup executed 37 SQLite and 208 PostgreSQL assertions successfully,
with successful cleanup, but failed evidence validation: UUID-bearing checkout
paths triggered the existing sensitive-content sanitizer and erased report file
identities. Relocate both worktrees with `git worktree move` to
`/tmp/key91-study-d1de673a/{baseline,pilot}` before collecting the definitive
series. Original PR samples and native warmup remain diagnostic only. Restart
warmups and three samples under the revised paths. No validator is weakened.
The observer also recognizes pg exports loaded by absolute module path so
DB/role statement timings can be captured without SQL text.

## Pilot declaration before editing the candidate

T006 completed with three passing definitive attempts per baseline lane.
Individual timings appear in the results table; retained result files preserve
full precision.

Select the duplicate contracts invocation in root `package.json`. Remove only
`pnpm test:generator &&` from `test:pr`; retain the standalone alias and the
existing `turbo run quality typecheck test` stage. Experimental source paths are
`package.json` and `scripts/repository-organization.test.ts` in the isolated
pilot checkout. No dependency, product, fixture, installer, or CI change.

| Obligation                    | Before                                                                  | After required for adoption  |
| ----------------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| Generated-output consistency  | generate:check                                                          | Unchanged                    |
| Contracts regression coverage | 51 assertions through test:generator, then the same 51 through Turbo    | All 51 once through Turbo    |
| Standalone generator feedback | test:generator alias                                                    | Alias retained               |
| Other PR gates                | Repository, runner negatives, quality, types, package tests, boundaries | Every existing gate retained |
| Installation/recheck/drift    | Full native installer and dedicated integration tests                   | Byte-for-byte unchanged      |
| Packaging/consumer proof      | SDK qualification and full native archive execution                     | Byte-for-byte unchanged      |

Add a repository-organization regression requiring contracts execution through
the Turbo stage and forbidding the extra generator-test stage. First run it
against the unchanged pipeline; it must fail on the duplicate invocation, not
imports or compilation. After removing the stage, require the regression and
full PR command to pass. In the isolated pilot, temporarily force one contracts
assertion to fail and prove the full PR command still fails through Turbo; then
restore only that injected test change. Reject the pilot if coverage or negative
failure propagation is lost, any existing gate is removed, or contracts still
runs twice. Three measured PR samples must show one execution rather than two.
No native/package rerun is needed for this root-only change; those owners and
commands are unchanged. Do not claim a speed improvement solely from a lower
single timing. Adoption can rest on eliminated repeated work.

## Pilot results and decision

The repository regression failed on the duplicate stage, with 1 failed and 8
passed assertions. After the one-stage removal, all 9 passed. The temporary
contracts failure was then detected by Turbo: the contracts suite reported
1 failed and 50 passed assertions and the PR command exited 1. The injected
change was restored and the isolated patch bytes matched their prior SHA-256.
The retained patch digest is
`abb4fa4b8cb3e2abda0922e31f8789747b6197042872d7bb6889260c4e5fb27e`.

| Condition / command               | Attempt 1 seconds | Attempt 2 seconds | Attempt 3 seconds | Median seconds |
| --------------------------------- | ----------------: | ----------------: | ----------------: | -------------: |
| Baseline PR                       |             8.207 |             8.243 |             8.200 |          8.207 |
| Pilot PR                          |             6.929 |             6.833 |             6.831 |          6.833 |
| Baseline paired                   |            25.448 |            24.855 |            25.166 |         25.166 |
| Baseline SDK pack + qualification |             9.026 |             9.100 |             9.043 |          9.043 |

Adopt the root-only pilot. Contracts execution falls from two invocations to one
in every sample. The same 51 contracts assertions pass, together with all 128
runner, 79 PostgreSQL provider-free, 341 SDK, and 24 web assertions. Repository
coverage increases from 8 to 9 assertions. Full native/package owners and
commands remain unchanged. The local median PR reduction is 1.375 seconds,
about 16.7 percent, under the declared instrumentation/cache conditions. This is
an observed local comparison, not a CI or production guarantee. Adoption rests
on removing one repeated suite while retaining failure detection.

Root package.json stays at 48 lines; its command loses 23 bytes. The repository
regression adds 12 lines, from 212 to 224. No test/support code was deleted.
The measured benefit is less repeated execution, not fewer total source lines.

## Candidate dispositions

| Candidate                      | Disposition and reason                                                                                                                                                                            | Follow-through and retained proof                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate contracts command    | Adopt the measured one-stage removal                                                                                                                                                              | T009-T010 pilot; retain standalone alias, Turbo contracts coverage, regression and negative failure demonstration                                                                                                 |
| Repeated SDK packaging/tooling | Defer workflow optimization; three consumer installations and 27 consumer-mode processes occur per representative qualification because tooling tests qualify twice before the requested consumer | Reuse qualifyArchive directly in T026-T028; keep deterministic two-build proof, private-path/content/size negatives, and immutable downloaded archive identity; separate CI optimization needs its own regression |
| Ordinary installer recheck     | Defer optimization; 258 packed installer calls per native attempt demonstrate repetition, but this is not the selected pilot                                                                      | Preserve every dedicated installation/recheck/drift assertion and ordinary fixtures; T017 handles package preparation ownership only, not DB fixture sharing                                                      |
| Policy request/replay corpus   | Defer broad migration; 2,557 lines contain distinct public and raw transactional assertions                                                                                                       | Reuse existing Budget and Policy runtime registrars in T027/T034/T043. Preserve Context/errors/order, pending results, rollback, locks, replay-before-read and caller commit proof                                |
| Uninvoked remote registrar     | Defer activation pending a complete map to existing independent remote cases                                                                                                                      | T033-T037 declare installed remote cases explicitly; exported code is not evidence and no scenario disappears                                                                                                     |
| Report parsing/process support | Include only shared structural parsing and child cleanup mechanics actually used by paired/native/selected runners                                                                                | T013-T016/T019 preserve the strictest checks and separate full/parity/selected verdicts; keep expected inventories and manifest schema construction in runner owners                                              |
| Focused feedback               | Use existing owner commands and explicit test paths; add no scenario discovery or generic command registry                                                                                        | SDK test:unit/test:contract for source feedback; paired/native remain full gates. T029 documents feedback limits and new Local acceptance separately                                                              |
| Archive preparation            | Keep bounded checkout-local locking in shared package mechanics                                                                                                                                   | T014/T017 prove owner-only release, immutable supplied archives and cancellation. No broader scheduler or DB reuse                                                                                                |

The organization test explicitly keeps testkit product-neutral, including no
`evidence` or `schemaVersion` vocabulary. Therefore the revised design keeps
selected manifest/schema construction in SDK/PostgreSQL runner owners and
extracts only neutral source snapshots, JSON/report mechanics, process cleanup,
and archive locking into testkit. This avoids both weakening the ownership test
and adding a dependency from the SDK test owner to the PostgreSQL test owner.

The experiment did not adopt template databases, shared mutable fixtures,
blanket rollback, a generic scenario/target product, or a new fixture framework.
Native installation, isolation, contention and recovery proof remains intact.

## Phase costs and retained evidence

[testing-strategy.json](evidence/testing-strategy.json) retains individual command
results, module/test summaries, operation counts and interval durations, coverage
hashes, archive identity, tool digests, and raw artifact references. All three
paired runs passed with 37 SQLite and 208 PostgreSQL assertions, including the
171 native-only assertions. Shared/native coverage hashes are identical across
attempts. SDK qualification passed all 12 declared check categories each time.

The observer measures elapsed subprocess and SQL-operation intervals. Values in
the next tables are seconds covered by the union of intervals within that category.
Different categories overlap and must not be summed into total wall time. Native
files run concurrently. Vitest assertion durations include test-owned fixture
work; they are not pure CPU time spent evaluating expectations.

| Native operation                             | Count per attempt | Attempt 1 | Attempt 2 | Attempt 3 |
| -------------------------------------------- | ----------------: | --------: | --------: | --------: |
| PostgreSQL pack, including prepack build     |                 1 |     0.803 |     0.802 |     0.805 |
| External CLI installation                    |                 1 |     0.300 |     0.317 |     0.308 |
| Container start commands                     |                 3 |     0.341 |     0.339 |     0.334 |
| Database creation                            |               212 |     2.602 |     2.233 |     2.353 |
| Role creation                                |               960 |     1.379 |     1.191 |     1.351 |
| Packed installer install/recheck calls       |               258 |    15.936 |    15.467 |    16.123 |
| Database drops                               |               212 |     9.463 |     8.011 |     9.854 |
| Role drops, including negative cleanup paths |               965 |     0.458 |     0.425 |     0.524 |
| Filesystem cleanup calls                     |               140 |     0.077 |     0.080 |     0.083 |
| Native test-file wall interval union         |          16 files |    20.537 |    20.033 |    20.118 |
| SQLite shared test-file interval             |            1 file |     0.066 |     0.066 |     0.065 |

Installer call intervals include both installed and already-installed checks;
this pilot does not distinguish their individual SQL internals or claim savings
from removing rechecks. Database drops are slower than role creation on this
host. Sharing mutable state to avoid drops would jeopardize isolation and is not
adopted. Successful cleanup verdicts come from the full runner, not timing data.

The native runner discards stdout and its JSON reporter omits import diagnostics.
A supplemental warmup and three full paired attempts add a read-only Vitest
reporter through the external observer. These samples use unchanged source and
retain the normal JSON reporter/full validator. They are labelled `phases-*`,
not substituted into the original comparison. Every full gate passed.

| Supplemental paired metric                      | Attempt 1 | Attempt 2 | Attempt 3 |
| ----------------------------------------------- | --------: | --------: | --------: |
| Wall time                                       |    25.496 |    25.148 |    25.536 |
| Sum of import/collection time across 17 modules |     3.193 |     2.957 |     2.962 |
| Sum of runner preparation across modules        |     0.036 |     0.038 |     0.034 |
| Sum of tests/hooks across modules               |   107.165 |   107.071 |   106.187 |

Module preparation is Vitest setup, not database setup. Import/collection includes
suite registration. These module sums overlap across workers. Environment setup
is below one millisecond summed; setup-file duration is zero, as recorded by
Vitest. Raw operation intervals separately expose database/role and CLI work.

| SDK qualification operation                  | Count per attempt | Attempt 1 | Attempt 2 | Attempt 3 |
| -------------------------------------------- | ----------------: | --------: | --------: | --------: |
| Pack intervals, each including prepack build |                 2 |     1.898 |     1.921 |     1.913 |
| Explicit determinism build calls             |                 2 |     1.041 |     1.062 |     1.049 |
| External offline consumer installation       |                 3 |     1.176 |     1.170 |     1.168 |
| Consumer typechecking                        |                 3 |     0.184 |     0.182 |     0.181 |
| Consumer positive mode processes             |                27 |     2.290 |     2.284 |     2.278 |
| Private-import rejection processes           |                 3 |     0.064 |     0.067 |     0.066 |
| Filesystem cleanup                           |                26 |     0.177 |     0.177 |     0.177 |

The qualifier's immutable-record and cleanup tests each run a consumer, followed
by the caller-requested consumer. That explains three installations and 27 mode
processes, rather than a claim that a single consumer requires them. The two
packs are the representative input archive and the tooling test archive. Keep
intentional build determinism and negative evidence coverage before redesigning
this workflow. Package Vitest summaries in the JSON record retain transform,
import, test and environment durations separately.

PR samples retain each Vitest summary. The removable direct contracts invocation
alone takes 0.853/0.872/0.885 seconds of Vitest time, with
0.298/0.302/0.309 seconds of import and 0.321/0.332/0.335 seconds of tests.
Turbo still runs the same contracts suite afterward. Removing the earlier process
also avoids its package-manager and process-start overhead. All remaining PR
suite counts match except the new repository regression. No total-CPU saving is
inferred from overlapping Turbo workers.

Affected owner line counts are retained in `baseline-lines.json`: SDK qualifier
738, qualifier tests 413, PostgreSQL fixture support 481, Policy request/replay
2,557 total, paired runner 856 and native runner 1,365. These counts are scope
observations, not deletion estimates. The only adopted source change is the root
command and its 12-line regression.

For reproduction, use the retained `measure.py`, `observe.cjs`, `summarize.py`,
and `native-phases.mjs` in the artifact directory. Their digests are in the JSON
record. Run one command/attempt at a time with fresh destinations. Executable
measurement tools and raw logs are local ignored artifacts; the committed JSON
is a digest-bound observation index, not a substitute for missing raw files.
No failed warmup is included in the passing sample statistics.

## Phase 3 closure

T001-T012 are complete. Post-study Constitution Check passes all eight gates.
Cross-artifact analysis covers 18 functional requirements, 9 success criteria,
and 56 tasks with no unmapped requirement/task, remaining ambiguity, duplication
finding, or constitutional conflict. T015/T018 now test and implement selected
manifest ownership in the runners while preserving neutral testkit mechanics.
The study gate is released; the requested execution stops here. T013-T056 remain
unchecked and no independent deployment entrypoint has been implemented.

Ponytail review after each phase found no unnecessary abstraction or removable
complexity: `Lean already. Ship.` Phase 1 and Phase 2 passed the 8-test repository
check before their commits. Phase 3 passed the expected red regression, the
injected-failure negative, three baseline/pilot series, supplemental native
phase observations, and the complete PR suite in the main checkout after
adopting the identical code patch. Final focused checks verify formatting,
artifact hashes, links, and diff whitespace. Extension hooks are empty.

The study report, evidence index, and pilot are committed locally. Raw observations
remain in the ignored local artifact directory. No push, PR publication, Linear
link update, required-check readback, or Hosted acceptance was performed.
