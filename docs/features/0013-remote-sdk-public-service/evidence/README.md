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
