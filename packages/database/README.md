# Database

- **Owner:** `@shubsharan`
- **Functional status:** private canonical source and shared conformance suite

## Responsibility

`packages/database/` owns the ordered command contract and separate SQLite/PostgreSQL accounting sources. [`contract.json`](contract.json) and [`schema.json`](schema.json) are hand-authored inputs. The package is private and used only by repository build and test tasks.

## Allowed and public edges

`src/sqlite/` owns SQLite accounting and `postgres/migrations/` owns the authored PostgreSQL baseline. Consumers generate or stage selected copies in their own directories. The contract source is the build-time generator input. Its checked-in consumers under `generated/` are the digest and test-only schema types; generated product files live with their owners.

A consumer must not infer the contract from private database tables or SDK implementation details.

## Private internals

Production code must not import this package. Owner-local generator scripts and tests may declare it as a development dependency.

## Change procedure

1. Change `contract.json` or `schema.json` and treat the edit as a shared interface change.
2. Update the engine implementations independently: `src/sqlite/` owns SQLite behavior and `postgres/migrations/` owns PostgreSQL behavior.
3. Put shared behavior coverage in `contract-tests/scenarios/`; keep engine, transport, locking and permission coverage with the owning runtime.
4. Run `pnpm generate` and review every generated consumer and digest change.
5. Run the repository checks selected by `docs/testing.md`, added by this migration.

Generated TypeScript types, validators, PostgreSQL wrappers, installation metadata and digests derive from these inputs. Do not hand-edit generated files.

## Contract and test boundaries

The generated schema defines wire structure. The [accounting reference](../../docs/reference/accounting.md) explains the domain meaning; the [command reference](../../docs/reference/commands.md) explains validation, atomicity and replay. Runtime packages own connection and lifecycle behavior, and the SDK owns TypeScript adaptation.

Contract scenarios are the cross-engine semantic suite. Passing a SQLite scenario does not prove PostgreSQL locking, grants, transport behavior or installation compatibility. Passing a PostgreSQL scenario does not make this private package a supported consumer API.
