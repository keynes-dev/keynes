# FEAT-0013 evidence

No FEAT-0013 runtime evidence is accepted yet.

Retain only exact-revision records required by [the acceptance contract](../contracts/acceptance-record.md). Keep local archives and unsuccessful attempts under ignored `.artifacts/` paths. Provider-free repository, native PostgreSQL, SDK package, authorized remote-database, self-hosted, managed, recovery, security, fault, benchmark, and production lanes remain separate.

FEAT-0014 owns the accepted Resource-bound local and PostgreSQL prerequisite evidence. FEAT-0013 planning does not qualify direct PostgreSQL access, TLS, credentials, private administration, operation recovery, remote reopen, remote package consumers, providers, Cloud retirement, or production behavior. Those claims remain `NOT RUN`.

## Prerequisite baseline

FEAT-0013 baseline revision `c5b4659ff722e590dc52187bb7c0a38138f7da65` contains FEAT-0014 merge `09eba82d868759375144b14b5971a7a257f0a9e6` and validates the canonical FEAT-0013 identity without rerunning the allocation hook.

- `pnpm check:feature-identity` and `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`: passed and resolved the existing FEAT-0013 branch and feature directory.
- `CI=true pnpm test:unit`: passed 48 contract, 44 Cloud, 29 PostgreSQL, and 244 SDK unit and conformance tests.
- `pnpm test:system:postgresql -- --output .artifacts/acceptance/feat0013-baseline-c5b4659.json`: passed in a clean detached checkout, 159 tests across 29 suites on PostgreSQL 18.6. Archive SHA-256: `fa294976c1106bad4f03ba7905db144fc6b0197cf80a35b6272edae4e09fe71b`. Contract digest: `cb9e2a1744efb693b83daeaf7dea92673518cf9d3809b19688355a7a73ec78c5`.
- Two ambient-checkout runs failed during the native test stage and produced no accepted record. Their run IDs were `856c56a0-6440-494a-b48a-4ed440fe8b14` and `1c4ad688-1bed-4f98-b90f-9ef2bfc9a789`; only the clean exact-revision result above qualifies the prerequisite baseline.
- Phase 1 Ponytail review removed the duplicate evidence block from the task ledger and kept this file as the single evidence owner.

This baseline proves only the inherited local and embedded PostgreSQL contract. Every FEAT-0013 remote and operational claim remains `NOT RUN`.

## Phase 2: contract and installation foundations

The Phase 2 implementation was qualified in the FEAT-0013 working tree before its phase-boundary commit. The exact committed-revision rerun is retained separately below rather than treating working-tree evidence as release evidence.

- Generated contract SHA-256: `85b6193ade401110325fb22569c52c72f298d52effd4e52dcc518cf10ea46a5b`.
- Generated remote-procedure SHA-256: `77c9b438a027f181c5dc5b6997c91be8c4b8e2927e1f9ed9578d3cab0c3d3d43`.
- Generated policy-profile SHA-256: `e24288a917bc812465bd78271f5d2771d63aae73bc55b6efb126abbef7830128`.
- Migration `0006-remote-access.sql` SHA-256: `e1b295ef1a1dcb7a00958b87f01382c597301324f6b70eab6b77022a6a855918`; complete migration-set SHA-256: `e4fd733d8cf4bfad1604d4d392504f3d924b76eb053ebcb931903457fbfd2e65`.
- Generated SDK validator SHA-256: `741add7396a38dd3eb5c4fd0af8a1e82d97f39ac8f90611c7f4cd4fae6d3dbea`.
- The contract test lane was first observed failing in three expected assertions covering public-error separation, recovery correlation, and bounded history-page limits. The later generator-mismatch attempt was invalid because the generated dispatcher was temporarily absent and is not accepted as red evidence.
- The initial native PostgreSQL implementation lane ran 25 tests: 5 passed and 20 failed because the remote migration and runtime authority were not implemented. This is the accepted PostgreSQL red boundary for T010-T013.
- `CI=true pnpm check:repo`: passed formatting, lint, type, generated-source, and repository-boundary checks; boundary analysis covered 229 files with no violations.
- Focused contract generation and conformance: passed 51 contract tests. The three generated SDK validator behavior assertions moved to the SDK-owned lane and passed there; the complete SDK unit lane passed 210 tests.
- Focused PostgreSQL 18.6 adversarial installation, identity, recovery, and security lane: passed 34 tests across four files. PostgreSQL unit tests passed 29 tests.
- PostgreSQL runner unit tests: passed 15 tests, including cleanup and portable permission assertions for the PgBouncer workspace.
- `pnpm test:system:postgresql`: passed 196 tests across 18 files on PostgreSQL 18.6. The run exercised real direct, session-pooler, and transaction-pooler connections using the pinned `edoburu/pgbouncer@sha256:7d7a27d9e90985cab5cf42256f5c13a3120baa4b055b69df37beb272b89b2340` image.
- The Phase 2 adversarial review's identity, privilege, recovery-lock, history-cursor, role-recreation, and pooler-cleanup findings were repaired and rechecked. The required read-only Ponytail review then removed the unused pool fixture and run identifier, simplified remote connection ownership, and replaced six generated string rewrites with direct schema-keyword support.

Phase 2 proves generated procedure agreement, installation and exact recheck, least-privilege PostgreSQL wrappers, private administration, recovery classification, bounded history paging, and real direct/session/transaction pooler execution in the native harness. Only fail-closed TLS rejection was exercised. Positive TLS, PgBouncer downstream TLS, an authorized external remote database, hosted workflows, Cloud retirement, package-consumer acceptance, and production behavior remain `NOT RUN`.

### Exact-revision qualification

Revision `4145b43e059c895583c4df794bcae3a7092adfef` contains the Phase 2 implementation commit `20df3708c455fd7280e7902977c720bd184f836e` and the fixed acceptance inventory for the real PgBouncer mode proof.

- `CI=true pnpm check:repo`: passed at `20df3708c455fd7280e7902977c720bd184f836e`; generation, formatting, lint, type checks, and dependency boundaries were green. The source changed only by adding the already-passing pooler-mode scenario to the acceptance inventory before the retained native run below.
- `CI=true pnpm test:unit`: passed 51 contract, 44 Cloud, 29 PostgreSQL, and 247 SDK unit and conformance tests at `20df3708c455fd7280e7902977c720bd184f836e`.
- The first retained native attempt at `20df3708c455fd7280e7902977c720bd184f836e` refused publication after all tests ran because the new real-PgBouncer mode assertion was absent from the fixed scenario inventory. The runner unit lane passed 15 tests after that inventory was repaired.
- `pnpm test:system:postgresql -- --output .artifacts/acceptance/feat0013-phase2-4145b43.json`: passed 196 tests and 37 report suites on PostgreSQL 18.6. The retained record names source revision `4145b43e059c895583c4df794bcae3a7092adfef` with `cleanBefore: true` and `cleanAfter: true`.
- PostgreSQL package archive SHA-256: `b5d54c188d0d9f8681531c67d4ae59b70167a9ae253d587d20062f5734c8f8b3`. Installation-record SHA-256: `97671214484be4fd69ef2cdbf52e2e50ab1e696d555888512af9890b58ad77db`. Local acceptance-record SHA-256: `75580d1324dadf404041b13e897b14e16113e554cb2492bef3720eb108421850`.
- The record explicitly leaves other PostgreSQL versions, managed providers, upgrade/downgrade, rolling deployment, extension packaging, backup/recovery, failover, security qualification, fault campaign, benchmark, self-hosted, managed Cloud, and production readiness `NOT RUN`.

The exact record above remains valid only for revision `4145b43e059c895583c4df794bcae3a7092adfef`. Phase 3 corrected the authored compatibility schema to distinguish raw SHA-256 values from prefixed Resource digests. That source correction changes the contract and migration-set identities even though the bytes of `0006-remote-access.sql` are unchanged. Therefore the Phase 2 contract, validator, installation-record, and migration-set identities are superseded for current-source claims and must not qualify Phase 3 or later revisions.

## Phase 3: durable remote Budget loop

The Phase 3 implementation is qualified in the FEAT-0013 working tree below. T026 and exact-revision acceptance remain open until the implementation boundary is committed and the clean-revision commands are rerun.

- Current contract SHA-256: `774ebb89c8eddfd758abe7c125ad526017bcf53ae23ae2af96ae8c7ed139bb27`.
- Current remote-procedure SHA-256: `77c9b438a027f181c5dc5b6997c91be8c4b8e2927e1f9ed9578d3cab0c3d3d43`.
- Current policy-profile SHA-256: `e24288a917bc812465bd78271f5d2771d63aae73bc55b6efb126abbef7830128`.
- Migration `0006-remote-access.sql` SHA-256 remains `e1b295ef1a1dcb7a00958b87f01382c597301324f6b70eab6b77022a6a855918`; the corrected migration-set SHA-256 is `9f75b75918842333d5fe5ca744db180098e6d2b0ba8b9f8197c46ad374af144a`.
- Current generated SDK validator SHA-256: `2d026f56d5f4c8e8e1fa675b628f20b4546d4a443134cf7135f65ae2a19c3dfd`; current installation-record file SHA-256: `bb672963840bfabbede1f9232adeffcb80603fbc1c6c76967cc97747ee1ec043`.
- T017 and T019 were first executed after their concurrently authored implementation existed, so their initial runs were green and no failing-test claim is made. T018 produced an accepted red boundary of 7 failures and 1 pass when raw SHA-256 compatibility values did not satisfy the incorrectly prefixed digest schema, then a second accepted close-race boundary of 1 failure and 7 passes. Both moved green after the schema and bounded-close repairs.
- The initial T020 native full-loop failures were test-fixture expectation errors: the fixture expected a local projection shape and combined availability and Policy denials. They are not accepted as production red evidence. The corrected scenario uses the public remote projection and an allocation that isolates the intended Policy decision.
- The Phase 3 adversarial regressions produced 7 expected failures and 6 passes for response binding, reference checks, in-flight inspection deadlines, and stable page-limit errors. The PostgreSQL URL, acquisition-timeout, and recoverable idle-client follow-up produced 6 expected failures and 48 passes, plus one focused mutation-classification failure. After repair, the combined URL, executor, and public-facade lane passed 69 tests across 3 files.
- `pnpm --filter @keynes/sdk test:conformance`: passed 39 tests across the existing local SQLite conformance host and the generated remote-client executor adapter. The Phase 3 remote adapter proves validation, invocation, and safe error composition; the stateful reopen and recovery scenarios remain Phase 4 work and are not claimed here.
- `pnpm --filter @keynes/sdk test`: passed 318 unit and conformance tests across 23 files.
- `pnpm test:system:postgresql`: passed 198 tests across 19 files on PostgreSQL 18.6, including the real remote create, request, inspect, settle, Policy approval, Policy denial, canonical ordering, compatibility, pooler, identity, and security paths.
- `CI=true pnpm test:unit`: passed 51 contract, 44 Cloud, 29 PostgreSQL, and 318 SDK unit and conformance tests.
- `CI=true pnpm check:repo`: passed generation, formatting, lint, type checks, dependency checks, and boundaries; boundary analysis covered 237 files with no violations. Lint reported 18 pre-existing warnings and no errors.
- The required read-only Phase 3 Ponytail review identified 25 removable lines. The accepted simplifications removed a Phase 4 `openBudget` assertion from the Phase 3 native loop, replaced a manual URL-character scan with one regular expression, and removed executor degradation bookkeeping that did not change admission or error projection. The focused SDK lane and all 198 native PostgreSQL tests passed after those deletions.

This working-tree evidence proves the single `createKeynes({ databaseUrl })` entrypoint, fail-closed URL normalization, generated procedure dispatch, bounded pool and close behavior, exact Budget response binding, and the shared create/request/inspect/settle loop through native PostgreSQL. Positive TLS, PgBouncer downstream TLS, stateful SDK reopen and recovery, caller-owned operation keys, package consumers, hosted workflows, an authorized external remote database, Cloud retirement, self-hosted and managed operations, and production behavior remain `NOT RUN`.
