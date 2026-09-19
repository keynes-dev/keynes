# Research: Local canonical PostgreSQL execution

Research identifies implementation choices and tests; it does not qualify PGlite. Current source inspection used merged KEY-76 revision `70beb79`. All runtime observations below remain NOT RUN.

## Engine and installation

**Decision**: Use pinned `@electric-sql/pglite` 0.5.8 as the first compatibility candidate. Install the unchanged baseline and observe its actual PostgreSQL version before selecting Local compatibility metadata.

**Rationale**: The [official release](https://github.com/electric-sql/pglite/releases/tag/@electric-sql%2Fpglite@0.5.8) and [tagged manifest](https://raw.githubusercontent.com/electric-sql/pglite/@electric-sql/pglite@0.5.8/packages/pglite/package.json) identify the candidate. The [official API](https://pglite.dev/docs/api) provides ephemeral memory construction, parameterized queries, multi-statement execution, transactions and close. These APIs fit the existing private owner, but documentation does not prove Keynes compatibility.

**Alternatives considered**: Keeping SQLite duplicates rules. Using native PostgreSQL for Local loses private zero-service execution. The starting installer requires server_version_num 180006 and a native installation profile. The user explicitly chose native PostgreSQL 18.3 alignment. Update exact expectations to 180003 together with the profile generator, container digest, SDK identity and qualification fixtures; do not widen or skip version checks. Version alignment does not prove roles, catalogs or installation orchestration are interchangeable.

Compatibility must exercise PL/pgSQL, SECURITY DEFINER/search_path, catalog/object checks, transaction-local set_config, UUID/hash operations, JSONB, numeric exactness, C collation, custom SQLSTATE/subtransactions, locks and every installed command. The baseline disables check_function_bodies during installation, so DDL success alone is insufficient. PGlite's [single connection](https://pglite.dev/docs/multi-tab-worker) cannot prove native contention or role/caller transaction guarantees.

## User-directed version alignment

**Decision**: Native PostgreSQL targets 18.3 to match the pinned PGlite engine. Verify actual versions before acceptance and preserve all currently implemented functionality through shared/native tests. The [PGlite 0.5.8 submodule reference](https://api.github.com/repos/electric-sql/pglite/contents/postgres-pglite?ref=%40electric-sql%2Fpglite%400.5.8) points to `b133782cd759f08b3aeb263b80a963b39c7b7af1`; its [configure.ac](https://github.com/electric-sql/postgres-pglite/blob/b133782cd759f08b3aeb263b80a963b39c7b7af1/configure.ac#L19) declares PostgreSQL 18.3. This verifies source intent, not the installed binary.

**Rationale**: This is explicit user direction received during planning. Starting references include packages/postgresql/scripts/generate.ts, generated/installation-record.json, test/system/run.ts, test/qualification/external-profile.ts, external-target.ts, external-record.ts, packages/sdk/src/remote/postgresql-command-executor.ts and their fixtures. Regenerate generated records rather than editing them manually. Resolve and pin the official postgres:18.3 image digest during implementation.

**Alternatives considered**: Retaining 18.6 would contradict the new instruction. Relaxing exact version acceptance would hide mismatches. No in-place database downgrade or rewrite of historical 18.6 acceptance is included.

## Reuse and ownership

**Decision**: Keep the generated deployment-neutral CommandExecutor and runtime.ts queue. Replace only the private host; use transaction-local private tenant/principal context and canonical procedure targets.

**Rationale**: runtime.ts already rejects admission after closing, drains accepted work and shares a close promise. Native support/procedure-caller.ts demonstrates context and query mapping, while support/migrations.ts demonstrates canonical asset loading and transactional installation. Extract reusable production code instead of importing test support. The remote executor carries unrelated network/pool/error semantics.

**Alternatives considered**: A public adapter framework or the KEY-96 package split adds scope. Recreating Budget or Policy logic in a PGlite adapter defeats the issue. Native caller-owned transaction APIs remain unchanged.

## SQL distribution

**Decision**: SDK build emits its own baseline/manifest/identity assets from packages/postgresql canonical inputs and checks exact bytes. Runtime uses packaged assets, not repository-relative sibling files.

**Rationale**: Current PostgreSQL package exports no runtime API, and the SDK distribution inventory accepts only declared files. A repository-only path would pass source tests and fail a clean consumer. Build-generated distribution assets are not another authored SQL source.

**Alternatives considered**: Hand-copied migrations drift; private workspace runtime imports break archives; publishing new adapter packages belongs to KEY-96.

## Policy and current behavior

**Decision**: Preserve authoring/parser/normalization and current shared scenarios. Delete SQLite's TypeScript evaluator only after database behavior passes. Retain decimal.js because policy/validate.ts imports it for authoring validation.

**Rationale**: The current Local executor calls policy/evaluate.ts. Canonical SQL owns the replacement evaluation, while compiler input validation is a separate responsibility. Future independent Policy APIs and accounting redesign are not acceptance targets here.

**Alternatives considered**: A compiler rewrite or blindly deleting every evaluator-adjacent dependency would change unrelated behavior.

## Measurements and acceptance boundaries

**Decision**: Extend the existing explicit measure.ts/measure-worker.mjs machinery with a truthful engine-aware observation mode and completed-command throughput. The user explicitly requests a fresh SQLite-versus-PGlite comparison, so capture the unchanged SQLite archive before replacement and compare it with the final PGlite archive using the same method. Use the [qualification contract](contracts/qualification.md#sqlite-versus-pglite-comparison) for size, installation-time and runtime metrics, Policy/no-Policy workloads, raw samples and absolute/percentage deltas. Retain existing legacy-limit outcomes separately. Run the first measurements through the compatibility host before changing the default, and repeat on the final packed candidate.

**Rationale**: Existing tooling hardcodes node:sqlite, a 1 MiB archive ceiling, 35 MiB installed ceiling, 512 MiB ready RSS, 3000 ms cold create, 250 ms first request and 100 ms steady request thresholds. Those are not fresh PGlite qualification. This feature requires costs to be measured, while KEY-87 owns the complete envelope and KEY-88 final archive acceptance. No historical ceiling is silently relaxed or presented as passed.

**Alternatives considered**: Copying historic PGlite numbers is invalid. Making old SQLite ceilings a new PGlite promise would invent scope. Removing measurement failures to get a green result is unacceptable.

## CI transition

**Decision**: Preserve current required context names and script entrypoints during this replacement, with truthful engine fields and documentation. Replace execution, not hosted enforcement identity.

**Rationale**: CI already runs Local in Repository and tests and native source correctness under the historical SQLite and PostgreSQL behavior tests name. No need to duplicate Local in the native job. Preserve classification failure behavior and full qualification evidence retention. Live settings and candidate results must still be verified before acceptance.

**Alternatives considered**: Renaming checks in YAML alone risks bypass or permanently pending protection. A coordinated later rename can require both names before removing the legacy one.
