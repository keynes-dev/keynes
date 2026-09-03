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
