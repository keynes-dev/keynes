# Pre-refactor baseline

**Source revision**: `79de721c5f0b8a85074b2d7b338fd583704584a6`
**Captured**: August 26, 2026
**Scope**: Product and generated files matched the source revision. The worktree also contained the KEY-52 documentation and feature pointer.

## Contract and installation identity

- Contract digest: `0453c8e661a77bc053254c67b1fb90bf19309bc8af5f5190ecf38c5f205720d6`
- `0001-storage.sql`: `1f1745d223274d9ddafa253b01ae61cc6e11fe9e65841667123f9914cad470dd`
- `0002-budget.sql`: `464fabeb3119048d1f08c5d387268aede428d92db97513ec9e168b16783c6e6b`
- `0003-public.generated.sql`: `b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753`
- Migration manifest: `74e7408103f82965cf90751a734a73d79cdb00b465a006bee5a373e6f4530ceb`
- Installation record: `a346be3e991fa99a83719442be26efbd532f0ca9919d91266546916047c465bc`

## SDK distribution

- Archive SHA-256: `46d3d67b0c354d776ce39e5ff7841de80fd08da5e59ac4e125adba61d93488d3`
- Export map: package root to `dist/sdk/src/index.js` and `dist/sdk/src/index.d.ts`
- Root values: `KeynesError`, `Budget`, `Keynes`, `KeynesSdkError`, `ResourceDefinitionError`
- Root types: `KeynesClient`, all generated contract types, `AccountingBehavior`, `BudgetRequestDenialReason`, `BudgetRequestResult`, `ResourceAmounts`, `ResourceConfig`, `ResourceConfigs`, `ResourceUsage`, `KeynesSdkErrorCode`, `KeynesSdkErrorDetails`
- Production dependencies: `@keynes/postgresql`
- Archive: package metadata and README plus `dist/sdk/src/{index,keynes,sdk-errors}`, `dist/sdk/src/generated/**`, and `dist/sdk/src/private/{local-runtime,resource-catalog,sqlite-command-executor,test-controls}` JavaScript and declarations

## PostgreSQL distribution

- Archive SHA-256: `baaaf55f27e808e05581ee0f16bcd12f6d0792899e7e814d1ada5ac9e64fd747`
- Package identity: `@keynes/postgresql`
- Executable: `keynes-postgresql`
- Exports: package root and `./private/run-installation`
- Production dependencies: `pg@8.23.0`
- Archive: package metadata, README, license, compiled `cli`, `config`, `install`, and private installation runner, generated installation record, and four migration files

## Cloud production graph

- Production dependencies: `@keynes/postgresql` and `pg@8.23.0`
- Installer coupling: `@keynes/postgresql/private/run-installation`

## Active root commands replaced by KEY-52

- `test:qualification`
- `build:package`
- `pack:package`
- `test:package`
- `qualify:local`
- `test:platform`
- `test:cloud`

`pnpm generate:check` passed before the archive capture.
