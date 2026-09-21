# Implementation Plan: Declare typed policy parameters

**Branch**: `key-116-declare-typed-policy-parameters` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-116-declare-typed-policy-parameters/spec.md`

## Summary

Define a small, provider-free parameter contract outside the SDK and database runtimes. Literal JSON Schema declarations retain inferred types, explicit initial values produce immutable snapshots, and overrides replace whole parameter values. A separate Zod adapter accepts only declarations whose checks survive portable conversion.

Implementation is proceeding phase by phase; acceptance records executed checks and remaining NOT RUN lanes. [Research](research.md), [data model](data-model.md), [interface contract](contracts/parameters.md), [validation guide](quickstart.md) and [tasks](tasks.md) own the proposed implementation. [Acceptance](acceptance.md) separates planning checks from future feature evidence.

## Technical Context

**Language/Version**: TypeScript 7.0.2, Node.js >=24, pnpm 11.21.0, matching the repository.

**Primary Dependencies**: Reuse Ajv 8.20.0 and canonicalize 4.0.0 already pinned in this repository. Add json-schema-to-ts for schema-derived types and Zod 4 only for the optional authoring adapter and its tests during implementation. Pin exact compatible releases in the lockfile.

**Storage**: In-memory immutable JSON values. Applications may serialize fixtures; the helper performs no I/O or persistence.

**Testing**: Existing Vitest and TypeScript tools; runtime negative cases and compile-only consumer assertions.

**Target Platform**: Node.js >=24. JSON payloads are portable; browser support and other SDKs are not promised.

**Project Type**: Private source library consumed later by KEY-117's optional tooling distribution.

**Performance Goals**: No network/database work and no validation-time mutation. No throughput or latency claim; no benchmark machinery.

**Constraints**: Fixed draft-07 profile, strict validation, no implicit defaults/coercion, deterministic identities, no SDK or runtime dependency on this library.

**Scale/Scope**: One declaration map and one effective value map per snapshot. No registry, watcher, provider adapter, configuration precedence stack or automatic cache.

## Constitution Check

Pre-research gate: PASS against constitution 12.0.0. The specification supplies independently testable configuration behavior without changing Budget commands or authority. KEY-113 is Done and its governing PR [#63](https://github.com/keynes-dev/keynes/pull/63) is landed. The base `dc58120` also includes package separation in [#65](https://github.com/keynes-dev/keynes/pull/65).

| Gate                               | Design and evidence obligation                                                                                                     | Post-design |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| One Budget authority               | No Budget reads/writes. Local stays private Node SQLite; Hosted/Embedded stay PostgreSQL.                                          | PASS        |
| Application effects and evaluation | Application owns facts, parameter selection, evaluation, failures, retries and transactions. The library only validates values.    | PASS        |
| Optional tooling                   | No SDK/runtime import, mandatory policy callback or request format change. KEY-117 owns distribution.                              | PASS        |
| Shared command meaning             | Commands, replay, permissions, accounting and decision evidence are unchanged. A snapshot digest is not permission or attestation. | PASS        |
| Evidence-first delivery            | Each behavior starts with an observed failing test, then implementation. Planning-only validation needs no behavioral test.        | PASS        |
| Security and portability           | Strict JSON boundaries, sanitized error paths, defensive copies and versioned content identities. Fixtures contain no secrets.     | PASS        |
| One issue and PR                   | Exact Linear branch and explicit directory; phases stay in tasks.md. No phase issues or stack.                                     | PASS        |

Post-design gate: PASS. No constitutional exception. Shared Budget conformance is N/A to feature semantics because no command or runtime behavior changes. Future implementation still runs repository provider-free checks; native PostgreSQL and package qualification are NOT RUN and cannot be inferred from them. If implementation touches shared commands or either runtime, revise scope and add Local/native failing tests before that change.

## Project Structure

### Documentation (this feature)

`docs/features/key-116-declare-typed-policy-parameters/` contains spec.md, plan.md, research.md, data-model.md, contracts/parameters.md, quickstart.md, tasks.md, acceptance.md and checklists/requirements.md.

### Source Code (repository root)

Source layout:

```text
packages/policy-parameters/
  package.json
  tsconfig.json
  src/index.ts
  src/parameters.ts
  src/schema.ts
  src/snapshot.ts
  src/zod.ts
  test/core-consumer.test.ts
  test/parameters.test.ts
  test/snapshot.test.ts
  test/zod.test.ts
  test/types.ts
  test/fixtures/snapshot.json
  README.md
```

**Structure Decision**: A private `@keynes/policy-parameters` workspace owns this application contract. It depends on no Keynes database, SDK or runtime package. Its core source export excludes Zod; a separate `/zod` source export owns conversion. Use Zod as an optional peer plus a development dependency, and prove core consumption without it. KEY-117 chooses the installable tooling package and archive exports; KEY-116 does not introduce a separately published parameter product. The existing workspace glob discovers the private source package. Include its tests/typecheck in the existing Turbo flow rather than inventing a runner.

## Delivery and verification

Implement in the phases in tasks.md, with failing behavior checks before the corresponding implementation. Keep Zod conversion acceptance distinct from JSON Schema validation; passing conversion alone cannot prove parity. Snapshot fixture tests exercise fresh processes and exact canonical bytes.

Planning checks: stock Spec Kit prerequisites and integrity, feature-only formatting, repository organization tests and `git diff --check`. Feature acceptance after implementation: private-package tests and typecheck, `pnpm test:pr`, a core-only consumer without Zod, and frozen dependency install. Retain exact revision, command outcomes, dependency versions, host, attempt and fixture hashes in acceptance.md. KEY-117/KEY-88 own distribution/archive qualification, not these source tests.

## Complexity Tracking

No violations or exceptions. Ajv handles validation, canonicalize handles canonical JSON, and json-schema-to-ts handles schema-derived types. Do not write replacements. The only custom schema traversal restricts the supported profile and rejects lossy authoring; it is not a validation engine.
