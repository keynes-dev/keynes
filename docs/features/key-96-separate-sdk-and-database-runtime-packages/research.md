# Research: KEY-96

Inspected source revision: `74fce43`. This is source research, not runtime or archive qualification. Research agents independently traced packaging/generation and PostgreSQL/CLI ownership; their recommendations were checked against current source.

## One private database source owner

**Decision**: Move `packages/contracts` to private `packages/database`. Move SQLite executor/store sources under `src/sqlite/` and canonical PostgreSQL baseline/generation under `postgres/`. Keep canonical schemas, command descriptors, digest generation and engine-independent shared scenarios in this owner.

**Rationale**: `packages/contracts/contract.json`, `schema.json`, `src/load.ts` and generation already own command identity. SQLite currently lives in `packages/sdk/src/local/sqlite-command-executor.ts` and `sqlite-store.ts`; SQL lives in `packages/postgresql/migrations/0001-baseline.sql`. Moving these preserves one authored contract and separate accounting implementations.

**Alternatives considered**: A second contracts owner duplicates definitions. A shared TypeScript accounting engine changes SQL ownership and exceeds this issue. Leaving engine source in SDK fails the requested boundary.

## Build outputs, not a private runtime dependency

**Decision**: Reuse current TypeScript build/staging and `applyGeneratedOutputs`. Each distribution generates or stages its own selected outputs from the database owner and never writes another consumer workspace. Production manifests and emitted JS/declarations cannot reference the private owner or testkit. Generated assets are derived copies, not authored SQL sources.

**Rationale**: `packages/sdk/scripts/production-modules.ts` currently lists SQLite and PostgreSQL integration modules. SDK packaging bundles `pg` and its transitive modules. `packages/postgresql/scripts/generate.ts` computes the baseline receipt from canonical SQL. Existing exact allowlists and staged `dist` replacement can enforce the new boundaries without a bundler.

**Alternatives considered**: Subpath exports do not remove production dependencies. Publishing database internals adds an unwanted distribution. Hand-maintained SQL copies drift.

## Validation relocation

**Decision**: Split generator products by purpose. Runtime input validators belong to database source and adapter output. SDK output contains public types, invocation and response validation only. Move definition/name/quantity/evidence checks from SDK helpers into runtime request validation; keep mechanical serialization and unknown-alias errors in SDK.

**Rationale**: `packages/sdk/scripts/render.ts` emits input validation in both generated clients. `resources.ts`, `resource-binding.ts` and `decision-evidence.ts` mix encoding with name, envelope and evidence validation. SQLite already calls input validation at its command boundary. PostgreSQL direct and remote procedures independently validate input. Merely moving files would leave semantic rules in the SDK.

**Alternatives considered**: Removing all checks loses malformed-response protection and can coerce invalid input into valid JSON. Keeping generated input validators violates the thin SDK requirement. Preserve existing error-family mapping at the public boundary without duplicating validation rules.

## Exact construction and capability selection

**Decision**: Cold `nodeSqlite()` and overloaded `postgres({ databaseUrl })` / `postgres({ connection })` descriptors feed `createKeynes({ resources, runtime })`. Local and Embedded return the existing basic Keynes/Budget capabilities; owned remote returns current RemoteKeynes/RemoteBudget capabilities. Keep remote `openBudget` as implemented, not the separately planned `loadBudget` behavior.

**Rationale**: `packages/sdk/src/keynes.ts` currently branches on databaseUrl and defaults to Local. Existing local/remote handles and generated clients can remain SDK-owned while adapters acquire resources and dispatch commands. One small generated discriminated runtime contract suffices for these three supported paths; it is not an adapter registration/plugin API.

**Alternatives considered**: An implicit default conceals installation choice. A runtime factory that opens before createKeynes complicates failure cleanup. A custom adapter framework has no required consumer.

## Borrowed PostgreSQL context

**Decision**: Accept an already connected `pg.Client` or checked-out `PoolClient`. The application supplies its existing trusted Embedded role and session or transaction-local `keynes.tenant_id` / `keynes.principal_id`. The adapter makes one direct procedure call per command and performs no context writes, transaction control, connection release, replacement or retries. Reject pools as borrowed connections.

**Rationale**: Baseline `context()` reads these settings and checks principal permissions. Session settings permit atomic autocommit; transaction-local settings preserve application transaction ownership. `packages/postgresql/test/system/support/procedure-caller.ts` already demonstrates direct calls. The current transaction fixture lacks a `validate_resources` grant, which the public constructor will need. The installed remote application role must not gain direct Embedded grants.

**Alternatives considered**: Setting local context inside each adapter call fails under autocommit. Requiring tenant/principal options and managing transactions would take ownership from applications. A query-only structural interface admits pools and cannot guarantee one session. Full Embedded recovery remains KEY-11.

## Installation application

**Decision**: Rename the public PostgreSQL distribution to `@keynes/postgres`; export runtime from its root and `install`, `parseInstallationConfig`, `InstallationError` and associated types from `/install`. `install` already performs exact recheck, so do not add another public recheck command/API. Move CLI interaction to `apps/cli/src/cli.ts` as `keynes install --config <path>`.

**Rationale**: Current `@keynes/postgresql` exports no library API and ships `keynes-postgresql`. Its `install` owns its connections and transactions. Its internal `recheckInstallation({client,config})` starts/commits a transaction, so exposing that borrowed-client helper would violate ownership. Keep it private. The CLI needs no schema or accounting implementation.

**Alternatives considered**: Publishing the existing source exports indiscriminately exposes unsafe borrowed recheck. A new CLI framework or old executable shim adds no required behavior. Catalog commands and upgrades are separate work.

## Qualification and workflow integration

**Decision**: Extend existing package-test helpers and runners for the four consumer combinations. Retain root correctness/feedback commands and required check names. Add explicit adapter/CLI pack commands and one `pnpm test:package:split` acceptance command, described in quickstart as planned. Update existing SDK measurement to install and identify both SDK and SQLite archives.

**Rationale**: `packages/sdk/test/package/qualify.ts` currently assumes one SDK archive and bundled drivers. Measurement in `packages/sdk/test/performance/measure.ts` also installs one archive. `scripts/run-sqlite-postgres.ts`, repository organization assertions and package CI contain old paths. `pnpm-workspace.yaml` currently excludes apps; root formatting excludes apps. All must change with the relocation. Reuse `packages/testkit` archive, package, process and report helpers.

**Alternatives considered**: A second qualification framework duplicates existing mechanics. Routine PR CI should not absorb explicit package qualification. Historical KEY-114/KEY-121 evidence is not evidence for these new archives.
