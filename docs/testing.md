# Repository testing

This page owns the repository's verification lanes, their commands, and the claims each result can support. Package guides own product behavior and package-specific fixture design. The [contributor workflow](workflow.md) owns when a feature must be checked, reviewed, and published. [Release guidance](releases/README.md) owns release acceptance and durable evidence.

## Evidence rules

A passing command proves only the lane it ran against the revision and environment it observed. Record the exact commit, command, environment, result, relevant input or archive digests, cleanup outcome, and every skipped or unavailable lane. Use `NOT RUN` for a lane that did not execute. Do not promote a source test, an earlier revision, or an expiring CI artifact into an archive or release claim.

Run provider-free checks before native services or external targets. A changed candidate invalidates earlier evidence for affected behavior. A failed child process or incomplete cleanup remains a failure even when its test assertions passed.

## Provider-free checks

These commands run without credentials, paid providers, or a live PostgreSQL service:

| Command                | What it checks                                                                                                         | What it does not prove                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm format:docs`     | Formatting of permanent, package, application, contributor, and Spec Kit Markdown                                      | Links, behavior, types, or runtime correctness                                     |
| `pnpm test:repository` | Repository organization and fail-closed pull-request change classification                                             | Product behavior or package contents                                               |
| `pnpm check:repo`      | Generated-file freshness, formatting, lint, types, and workspace dependency boundaries                                 | Runtime behavior                                                                   |
| `pnpm test:local`      | SDK source behavior against the in-memory Node SQLite runtime                                                          | Packed packages, persistence, PostgreSQL, or Hosted                                |
| `pnpm test:pr`         | The complete provider-free PR suite: repository tests, runner tests, package source tests, types, lint, and boundaries | Native PostgreSQL, exact archive consumers, external targets, or release readiness |

Use the smallest focused package test while developing, then run the feature's required repository lane. Package `test` and `typecheck` scripts are declared in each workspace manifest. Policy fixture commands and their meanings remain in the [Policy testing guide](../packages/policy/docs/testing.md).

`pnpm test:hosted` is an unavailable-lane probe, not a passing check. It prints the prerequisite reason and exits with failure without acquiring resources.

## Native PostgreSQL checks

Native lanes require the supported Node.js and pnpm versions, Docker, OpenSSL, and enough local capacity for the PostgreSQL fixtures. They use source adapters unless the lane explicitly installs archives.

| Command                                                                                               | Evidence boundary                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:remote`                                                                                    | Source remote behavior through direct and supported pooled modes                                                                                      |
| `pnpm test:embedded`                                                                                  | Source Embedded behavior on a caller-owned PostgreSQL connection                                                                                      |
| `pnpm test:ci:postgresql`                                                                             | Native PR correctness: shared behavior, contention, rollback, permissions, direct remote recovery, source installation, and caller-owned transactions |
| `pnpm test:system:postgresql -- --output <new-result-file>`                                           | Native PostgreSQL system evidence with an explicit result record                                                                                      |
| `pnpm test:sqlite-postgres -- --output ".artifacts/sqlite-postgres/$(node -p 'crypto.randomUUID()')"` | Paired SQLite and native PostgreSQL behavior reports plus an exact-revision manifest                                                                  |

Native source feedback does not qualify package contents, installed SDK behavior, a registry publication, a managed provider, or production readiness. The paired runner requires a clean, unchanged candidate and a new output directory. It records sanitized reports, environment observations, cleanup, hashes, and `NOT RUN` states in its manifest.

### Native source-feedback fixtures

`pnpm test:remote`, `pnpm test:embedded`, and `pnpm test:ci:postgresql` run source feedback without packing packages or creating an installed consumer. Ordinary database fixtures install the source baseline once. Dedicated installation tests retain exact recheck, no-op, rollback, and packed-CLI coverage.

Each invocation owns distinct Docker networks, containers, databases, roles, clients, and temporary files. Concurrent invocations do not share fixture identity or cleanup. Cancellation stops active children and still runs teardown. A startup, assertion, cancellation, or cleanup failure prevents a passing acceptance record. Cleanup failure invalidates the run even when every assertion passed.

The native lane keeps the existing Docker runner. A Testcontainers pilot added transitive native dependencies that required new build-policy decisions. It also relied on Docker host-binding defaults that can publish services beyond loopback on an uncontrolled daemon. The current runner keeps explicit resource ownership and loopback publication without adding those dependency and host-policy requirements.

CI runs `pnpm test:ci:postgresql` for relevant pull requests. The manual **Database qualification** workflow runs the paired lane and retains its five evidence files for 14 days. Uploaded CI files are temporary; copy essential accepted records into the owning release record before expiry.

## Exact archive checks

Archive evidence must identify the SHA-256 digest of every installed archive and must exercise packages from clean consumer directories outside the repository. The consumer must resolve the shipped files and declared dependencies rather than workspace aliases, which is why building or testing source does not establish this lane.

The complete current archive lane is:

```sh
pnpm test:package:split -- --output ".artifacts/package-tests/$(node -p 'crypto.randomUUID()')"
```

It requires a clean source revision and a new output directory. It packs the SDK, Node SQLite, PostgreSQL, and CLI once; qualifies SDK-only and SDK-plus-SQLite consumers; checks the PostgreSQL and CLI archives; and runs the installed PostgreSQL/CLI native suite against that same archive set. `result.json` binds the source state, archive hashes, stage outcomes, cleanup, and exclusions. It does not qualify a registry publication, performance, or production readiness.

The manual **SDK Package** workflow exercises the SDK and Node SQLite archives across its operating-system and Node.js matrix and records a reference measurement. Its uploaded archives and reports expire after 14 days. A matrix pass applies only to the exact uploaded digests.

Package-specific archive entrypoints remain available for focused work:

- `pnpm --filter @keynes/policy test:package -- --output <new-result-file>` packs and tests the Policy and SDK archives without a database or live provider.
- `pnpm test:package:sdk -- --archive <sdk.tgz> --output <new-result-file>` qualifies an already selected SDK archive; add `--node-sqlite-archive <node-sqlite.tgz>` for the Local consumer.
- `KEYNES_SDK_PACKAGE_ARCHIVE=<sdk.tgz> pnpm test:package:postgresql -- --archive <postgres.tgz> --output <new-result-file>` checks an already selected PostgreSQL archive and SDK peer without starting PostgreSQL.
- `pnpm test:external:postgresql -- --profile <profile.json> --sdk-archive <sdk.tgz> --postgresql-archive <postgres.tgz> --output <new-result-file>` qualifies exact archives against an explicitly authorized external PostgreSQL target.

These focused lanes do not replace the complete archive set required by a claim spanning multiple packages. The external lane owns local connection cleanup, while disposal of the provider database remains operator-owned.

## Hosted and external evidence

There is no supported Hosted product runner. Hosted behavior remains `NOT RUN` until a runner with explicit target, authorization, cleanup, and retained evidence exists. Do not use Local, source PostgreSQL, installed Embedded, or an external database result as a Hosted claim.

Any live provider or external target requires prior authorization unless the active request already grants it. Record the target class without credentials, the authorization reference, exact archive digests, TLS observations, scenario outcomes, cleanup ownership, and exclusions. Never retain secrets or raw customer data.

## Test and fixture ownership

| Location                                      | Owns                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/database/contract-tests/scenarios/` | Shared accounting and command behavior that SQLite and PostgreSQL must both satisfy                        |
| `packages/node-sqlite/test/`                  | Local engine, queue, lifecycle, isolation, and SQLite integration                                          |
| `packages/postgres/test/`                     | PostgreSQL installation, transactions, locking, permissions, transport, recovery, native and archive lanes |
| `packages/sdk/test/`                          | Public TypeScript behavior, serialization, runtime binding, source systems, consumers, and measurements    |
| `packages/policy/test/fixtures/`              | Complete synthetic Policy inputs, snapshots, dependency assessments, and expected results                  |
| `apps/cli/test/`                              | Packed executable, arguments, configuration, output, failures, and redaction                               |
| `packages/testkit/`                           | Shared test-only archive, temporary consumer, process, report, and cleanup utilities                       |
| `scripts/*.test.ts`                           | Repository workflow and orchestration contracts                                                            |

Fixtures own setup and deterministic cleanup. Shared scenarios must not import a runtime adapter. Package-specific assertions stay with their package. Add a testkit helper only when more than one qualification path needs the same artifact or lifecycle operation.

## Pull-request classification

The PR workflow classifies the complete merge-base-to-head change set once. `docs/`, `.specify/memory/`, and the exact approved root metadata files may select documentation formatting only. Package and application documentation, executable tooling, dependencies, workflows, mixed changes, deletions from relevant paths, and unknown paths select the full provider-free and native correctness jobs.

Classification is fail closed because an unknown or missing decision must not skip required runtime checks. Empty, malformed, duplicated, unsafe, unrecognized, or raw rename-status input cannot produce a success-shaped decision. Git rename detection is disabled so both the deleted and added paths are classified. Both required jobs independently reject a missing, failed, or contradictory classification. A documentation-only decision means SQLite and PostgreSQL are `NOT RUN`; it is not a passing runtime result. New pushes cancel superseded runs.

Change the classifier only when repository path ownership changes. Any change must retain focused coverage for safe-only, mixed, unknown, deleted, renamed, malformed, and failed-Git cases.
