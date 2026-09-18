# Local runtime contract

## Public compatibility

Retain current `createKeynes({ resources })`, returned typed handles, Resource definition, Budget operations and `close()` call shapes. This feature changes the private engine only. Do not expose PGlite, a database path, a connection, runtime factory selection or engine-specific options. Remote configuration never falls back to Local.

Canonical command inputs/results/errors continue to come from `packages/contracts` and the generated client. No new schema inventory is introduced. Future product APIs are not silently added.

## Private procedure transport

The existing `CommandExecutor.execute(operation, input)` remains the boundary. Resolve operation names through a fixed canonical mapping, never caller-supplied SQL. Serialize input as JSON, bind it to `$1::jsonb`, set private tenant/principal context within the same owned transaction, and call the installed target:

| Operation         | Canonical target            |
| ----------------- | --------------------------- |
| validateResources | keynes.validate_resources   |
| defineResources   | keynes.define_resources     |
| defineResource    | keynes.define_resource_type |
| createBudget      | keynes.create_budget        |
| requestBudget     | keynes.request              |
| settleBudget      | keynes.settle               |
| getBudget         | keynes.get_budget           |

Use existing generated response validation and public errors. Unexpected row counts, installation drift, invalid engine responses and close failures must fail explicitly. Test checkpoint/response-loss controls remain private test capabilities, not new public runtime options.

## Installation identity

Load the baseline, manifest and generated record from canonical inputs. Verify exact bytes/digests and installed objects/functions, ledger and command identity. Exact recheck performs no repair or writes. Drift, partial installation or unsupported execution aborts and cleans up the Local instance.

Native install.ts will enforce PostgreSQL 18.3 and its roles/access profile after the coordinated generator/image/SDK identity update. Local host metadata records its actual engine version separately; it must not assert native profile qualification. Distinct host checks are permitted, distinct business SQL is not. If a shared canonical fix is necessary, it applies to both engines and requires both-engine tests. Do not strip unsupported statements or replace Policy semantics only for Local.

## Lifecycle and isolation

Reuse runtime.ts admission/drain semantics. Await PGlite creation, installation and configured definitions before exposing the client. Reject new commands once close begins; finish accepted operations and then close once. Preserve the current bounded exact-replay retry after a known lost committed response. Initialization/operation/shutdown failure must not strand owned resources or suppress cleanup errors.

Test two independently initialized instances, interleaved operations, foreign bindings/handles, concurrent close calls, queued failures, partial initialization failures and calls after close. No Local result proves native caller transaction ownership or native role isolation.

## Policy ownership

Kysely/raw SQL authoring continues through the existing pinned parser and normalizer. Preserve source rejection and inference tests. Execute compiled validation, numeric rules, context checks and Policy decisions in canonical SQL. Migrate evaluator assertions to real database-backed cases before removing TypeScript runtime evaluation. Keep compiler dependencies still used by authoring validation.
