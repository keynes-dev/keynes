# Research: independently runnable deployment checks

## Evidence boundary

Research inspected repository source at `f9d04ec` with the accepted remote-default clarification in the working tree on 2026-09-05. No deployment or installed-consumer tests ran. Linear issue contents were refreshed to confirm the exact feature branch and prerequisite ownership. Product target documentation is not proof that its installation profiles exist.

## Added strategy study: initial observations only

The user added the testing-strategy study after the initial plan. Its scope and exit criteria are defined in [Phase 0 of the plan](plan.md#phase-0-research-and-testing-strategy-study). The observations below are inputs to that study, not evidence that it is complete.

- At `837c0d9`, one local `/usr/bin/time -p pnpm test:pr` run passed in 9.81 seconds. It executed the 51 contracts tests twice: once through `test:generator` and once through Turbo. This is one existing-checkout sample, not a controlled baseline or claimed optimization.
- [CI run 33951807112](https://github.com/keynes-dev/keynes/actions/runs/33951807112) at earlier revision `0573735130274f54c4eefe36fefcf42d3148aa6c` recorded 58 seconds for repository checks and 136 seconds for paired database checks. These are historical step durations on another host, not comparable before/after samples.
- `packages/postgresql/test/system/support/postgres-database.ts` invokes the packed installer twice for each installed fixture. Dedicated installation tests already verify the `already-installed` result. Native setup savings have not been measured.
- `packages/sdk/test/package/qualify.test.ts` builds twice to test determinism, then packs through a build-running prepack hook. The SDK workflow runs qualification-tool tests in the build job and again via `test:package` in consumer jobs. Separate intentional determinism proof from redundant repetition before changing these paths.
- Shared Budget registrars and the shared Policy evaluation corpus already exist. Local/PostgreSQL Policy request/replay files total about 2,557 lines, but that total is not a deletion estimate. Their public SDK and transaction-specific assertions need distinct coverage mapping.
- The root paired runner and native runner validate overlapping report structure. Their completeness rules differ. Sharing parsing must retain the union of structural checks and separate owner-specific acceptance rules.

**Decision:** Complete the coverage map, comparable baseline, and bounded pilot before downstream implementation. Use existing scenario registrars, explicit fixtures, and coverage policies as the starting design.

**Rationale:** Independent deployment wrappers alone would carry repeated work into the new commands. Measurement and coverage mapping establish which simplifications reduce cost without losing proof.

**Alternatives considered:** A wholesale test rewrite, blanket database reuse, automatic test discovery, and reducing backend coverage to lower runtime are rejected. Broad Policy-corpus migration needs its own coverage assessment and an explicit inclusion or deferral decision.

**Outstanding work:** The controlled baseline, native/package phase timings, affected code-size comparison, and measured pilot are NOT RUN. Create the completed `testing-strategy.md` only when conducting the study; do not treat these source observations as its acceptance record.

## Keep the complete runner as the default

**Decision:** Preserve `runPostgresqlSystemTests` full defaults, `validatePostgresqlSystemReport`, and `test:sqlite-postgres`. Add an explicit selected invocation that cannot emit the full acceptance schema.

**Rationale:** `packages/postgresql/test/system/run.ts` selects 16 files and starts both poolers. `required-scenarios.ts` names 171 native-only assertions across 15 files, plus the canonical Budget aggregate. `scripts/run-sqlite-postgres.ts` compares shared names and validates native evidence identity. The full inventory includes Policy, contention, and rollback coverage that would disappear if full execution became the union of smaller deployment selections.

**Alternatives considered:** Separate copied runners would duplicate cleanup and drift. Replacing the full gate with selected results would weaken acceptance. A new fixture framework is unnecessary.

## Select tests before registration

**Decision:** Use an explicit file and assertion inventory per selection. Remote defaults to `direct`, `session-pool`, and `transaction-pool`; one explicit mode can narrow the run. Preserve the complete validator's default inventory and introduce a selected validator with an explicit inventory argument.

**Rationale:** `remote-connections.test.ts` hardcodes three modes and one assertion that requires both poolers. `support/remote-connections.ts` reads endpoints from runner context. Narrowing must change registration and fixture provisioning together. Missing context currently invokes `describe.skipIf`, which can make direct file execution look successful.

**Alternatives considered:** Vitest name filters and conditional skips hide missing execution. Keep the existing full-only combined pooler assertion for full/default-all runs, and use individually named pooler assertions only for narrower selections. Do not rename or drop existing full assertions to implement selection.

## Reuse Local consumer qualification

**Decision:** Compose the canonical Local Budget aggregate, Local/public/Policy source tests, and `qualifyArchive` from `packages/sdk/test/package/qualify.ts`.

**Rationale:** The existing qualifier installs an archive outside the repository, verifies real paths, and checks public Budget, Policy, isolation, closure, and process-loss behavior. Its default mode uses an isolated offline installation. `local-lifecycle.test.ts` already exercises queue ordering and drain behavior.

**Alternatives considered:** A new consumer framework duplicates existing checks. Running the complete SDK unit suite would include unrelated remote mock tests. Passing `--authorized-database` would violate the Local service boundary.

## Add actual installed remote consumer coverage

**Decision:** Keep current SQL fixtures and add a consumer under the SDK test owner that imports only the installed SDK. The PostgreSQL owner provisions an isolated TLS-enabled test target and selected poolers for this consumer phase.

**Rationale:** `support/remote-identity.ts` imports the source installer and current remote tests use raw `pg`. They do not prove the installed SDK. `sdk/src/remote/connection-options.ts` requires `sslmode=verify-full` and supports `sslrootcert`; the native fixture currently uses plaintext. A test-only certificate authority can prove successful verification without weakening SDK validation.

The TLS fixture follows [PostgreSQL SSL configuration](https://www.postgresql.org/docs/current/ssl-tcp.html) and [PgBouncer TLS configuration](https://www.pgbouncer.org/config.html#tls-settings). In particular, pooler client encryption is required while backend verification uses the fixture CA. SDK client verification remains unchanged.

**Alternatives considered:** A raw database client cannot substitute for SDK consumer evidence. Disabling certificate verification or changing SDK configuration for tests is rejected. Retain the existing plaintext negative fixture separately so enabling TLS cannot invalidate its intended failure condition. Reuse database startup and cleanup helpers for a subsequent TLS consumer phase, rather than changing the legacy full-run environment.

## Limit Embedded and Hosted acceptance to available products

**Decision:** Embedded defaults to native transaction fixtures and explicitly reports installed-profile acceptance as unavailable. Hosted writes an unavailable result and exits nonzero in this implementation. Neither path invents a new product implementation.

**Rationale:** `postgresql/test/system/support/postgres-database.ts` manually grants canonical procedure access. The installer grants remote wrappers and has no supported profile selector. KEY-10 and KEY-11 own the missing installed Embedded behavior. The existing SDK authorized-database walkthrough lacks a Hosted provisioning, deployed-identity, and operations contract.

**Alternatives considered:** Delivering Embedded grants here duplicates KEY-10. Treating a database URL or a GitHub-hosted job as Keynes Cloud acceptance misstates the environment. A pluggable Hosted runner is premature; Hosted delivery must add a concrete supported execution contract before this entrypoint can run live.

## Separate package creation from concurrent execution

**Decision:** Protect build and pack with an exclusive checkout-local lock, then run against immutable per-attempt archives. Supplied archives bypass packaging, but still undergo identity and content validation.

**Rationale:** Unique external consumer directories already exist. However, `sdk/scripts/build.ts` replaces shared `dist` through `dist.previous`. Two package preparations can corrupt each other's input. A unique archive destination alone is insufficient.

**Alternatives considered:** A separate source checkout per invocation is heavier than the observed need. Concurrent unlocked prepack is unsafe. A lock covers only shared build/pack operations, not test execution. All package preparations used by the full and selected runners must participate.

## Reuse evidence mechanics without broadening full acceptance

**Decision:** Add a selected-deployment manifest, retaining the existing full schemas. Extract only genuinely shared process, report, snapshot, and archive-lock helpers into testkit. Keep scenario inventories with their owners.

**Rationale:** The current full runner already sanitizes results, uses exclusive output creation, binds revision and digests, and fails on cleanup errors. Its full acceptance requires clean source. Selected diagnostic runs also need a digest of dirty inputs without retaining source contents or secrets.

**Alternatives considered:** Optional scope fields on the existing full schema invite accidental partial qualification. A generic workflow engine or new package introduces an unnecessary ownership boundary. Historical records remain byte-for-byte unchanged.
