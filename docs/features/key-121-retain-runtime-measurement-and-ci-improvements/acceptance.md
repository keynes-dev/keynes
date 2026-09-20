# Acceptance: KEY-121

## Implemented scope

Local stays on main's private in-memory SQLite runtime. PostgreSQL remains 18.6. Retained measurement and CI improvements are independently reviewable; no PGlite runtime, serialization workaround, database downgrade, policy retirement, numeric rewrite or package split is included.

## Source and evidence

Final executable revision: `4a2d3d3d849fb9a12c80af021e56079bf44a613e`. Subsequent changes only publish documentation and evidence. Local environment: macOS Darwin 25.5.0 arm64, Node v25.9.0, pnpm 11.21.0, SQLite 3.53.0, Docker 29.6.2.

- SDK archive SHA-256: `02aea701edeff0bd22d270ddd28b71765ba569bcd6d6fcf8b3aaef6464ca19bb`; 1,003,009 compressed bytes and 5,026,578 installed production bytes. Package implementation is unchanged by this feature.
- Final [raw SQLite measurements](evidence/sqlite-measurement.json): SHA-256 `066d2d19d2391b4f4f7954f38b89cc571e18de5ceb70df033e93ffb5619aa741`; clean source before/after at the final executable revision.
- Full paired qualification at `b87180c722e49e883dc61445c5d700778f29d28c`: `.artifacts/key-121/paired-001/manifest.json`, SHA-256 `25ba1b1f870eed2fac2c114d3a602f0d20a60381c6fb39388a742cd034bd7063`. SQLite 430 tests and native PostgreSQL 298 tests passed, including the matching 99 shared cases, PostgreSQL 18.6, PgBouncer 1.25.2, cleanup and evidence retention. Later executable changes only harden measurement evidence and add its tests; paired runner/runtime code is unchanged.
- Exact-archive package consumer at `b87180c722e49e883dc61445c5d700778f29d28c`: `.artifacts/key-121/package-qualification.json`, SHA-256 `6cfe2bbc14b2abcd8c0509dbd5dda9e136073b1e2789c89884d0fdc9f0df9831`; all 12 checks passed, including types, parser asset, Budget/Policy journeys, isolation, closure and process loss.

## Commands and results

| Command                                                                                                                                                                        | Result                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                                                                                                                                               | Passed                                                                                                                                                             |
| `pnpm --filter @keynes/sdk test:performance`                                                                                                                                   | 13 tests passed, including real packed consumer and rejection of a non-SQLite consumer                                                                             |
| `pnpm exec vitest run scripts/repository-organization.test.ts scripts/run-sqlite-postgres.test.ts packages/sdk/test/system/run-local.test.ts --maxWorkers=1`                   | 92 passed                                                                                                                                                          |
| `pnpm --filter @keynes/sdk test:package:unit`                                                                                                                                  | 22 passed                                                                                                                                                          |
| `pnpm test:pr`                                                                                                                                                                 | Passed at final executable revision: generation, repository/classification, runner, source tests, formatting, lint, types and dependency boundaries; 528 SDK tests |
| `pnpm test:sqlite-postgres -- --output .artifacts/key-121/paired-001`                                                                                                          | Passed at paired revision above                                                                                                                                    |
| `pnpm --config.node-linker=hoisted --filter @keynes/sdk pack --pack-destination "$PWD/.artifacts/key-121/package"`                                                             | Passed                                                                                                                                                             |
| `pnpm --filter @keynes/sdk exec node test/package/qualify.ts --archive .artifacts/key-121/package/keynes-sdk-0.0.0.tgz --output .artifacts/key-121/package-qualification.json` | Passed                                                                                                                                                             |
| `pnpm --filter @keynes/sdk measure:package -- --archive .artifacts/key-121/package/keynes-sdk-0.0.0.tgz --output .artifacts/key-121/measurement-003.json`                      | Passed all existing limits; final run made after other validation finished                                                                                         |

## Measurements and limits

Final p95: cached offline installation 369.65 ms, full startup 62.04 ms, parser initialization 5.90 ms, public creation 1.87 ms, first request 0.37 ms, steady request 1.44 ms, shutdown 0.05 ms. Sampled startup peak RSS p95 was 85,082,112 bytes. The measured 100-request batch completed at 1,435 requests/second. This batch excludes settlement and warmups; it is not capacity qualification.

All original archive, installed-size, ready-RSS and latency limits remain enforced. New observations add no thresholds. The 1 ms in-process sampler observed two points per cold process on this host and can miss synchronous allocation spikes; the retained peak is not an OS peak-RSS guarantee. Offline installs use an isolated prefilled store and exclude network downloads, archive copying and consumer compilation. Schema v2 adds required observations without rewriting historical v1 evidence.

## Reviews and failures

Specification analysis mapped FR-001/002/003 to T004-T006, FR-004 to T007-T009 and FR-005 to T001/T003; all success criteria map to T010/T011. No blocking coverage or constitutional finding remained within the user-approved maintenance boundary. The checklist passed before implementation. No extension hooks were installed.

Read-only simplicity review retained existing measurement/report helpers and found no additional abstraction necessary. Correctness review added rejection of nonfinite sizes, throughput overflow and archive changes during measurement, and normalizes records again before writing. Failing checks were observed before implementing the measurement fields and CI changes. Focused checks then passed.

The first manual pack command omitted the repository's hoisted-linker override and failed before creating an archive; the corrected command passed. Measurement attempts 001 and 002 remain locally retained; attempt 003 is the final isolated observation. No failed attempt is used as acceptance.

## Roadmap and preserved migration

[PR #61](https://github.com/keynes-dev/keynes/pull/61) is closed unmerged. The remote branch remains at `aa3bba840a59086db55bf50aac19fe245225d7a8`; [historical acceptance](https://github.com/keynes-dev/keynes/blob/aa3bba840a59086db55bf50aac19fe245225d7a8/docs/features/key-109-run-local-on-postgresql-procedures-with-pglite/acceptance.md) remains unchanged. Required CI run 35483464795 passed; its API reported zero artifacts. PR metadata and logs were retained in the original worktree's `.artifacts/key-109/` alongside the historical attempts.

KEY-109 is canceled and readback confirms it blocks no issues. Obsolete blockers were removed from KEY-96, KEY-80 and KEY-114; all other technical dependencies were preserved. Only removal of blocking edges occurred, so this change introduces no dependency cycle. Active accounting, integration, package/release issues, both Local projects, their affected milestones and the Local initiative now reflect SQLite/PostgreSQL. KEY-116/117/118 remain required for Local; Cloud policy configuration/editor and independent research keep their prior ownership.

## Evidence boundaries

Final GitHub required checks are recorded in the PR. The standalone native CI command was NOT RUN locally; the broader full paired lane passed. Complete hosted Node/OS matrix, final KEY-87/88 operating envelope and release archive qualification, npm publication, managed Hosted readiness and full Embedded recovery remain NOT RUN. KEY-113 owns the governing-document amendment, KEY-114 owns managed Policy retirement and KEY-96 owns the package split. This maintenance acceptance does not deliver those features.
