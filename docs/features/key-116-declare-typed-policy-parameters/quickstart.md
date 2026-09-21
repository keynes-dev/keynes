# Validation guide: typed policy parameters

This is the implementation acceptance guide. Planned APIs, files and package commands below are NOT RUN and are not available from this planning PR. KEY-117 owns the eventual public import path.

## Prerequisites

Use Node.js >=24, pnpm 11.21.0 and the KEY-116 branch. After implementation, install frozen dependencies and run the private source package through the repository's existing tools:

```sh
pnpm install --frozen-lockfile
pnpm --filter @keynes/policy-parameters test
pnpm --filter @keynes/policy-parameters typecheck
pnpm test:pr
```

No Docker, Cloud credentials or provider account is needed for these feature checks. Record the exact commit, host, dependency versions, command outcomes and fixture hashes in [acceptance.md](acceptance.md).

## Local declaration and typed access

In `packages/policy-parameters/test/parameters.test.ts`, declare a numeric `reviewThreshold` and an enum `reviewMode` using the operations in [the contract](contracts/parameters.md). Supply both initials explicitly, create a snapshot and assert values. In `test/types.ts`, verify inferred numbers and enum alternatives and expected compile errors for unknown names, wrong values and nested mutation. Exercise separate variable inputs, not only object literals. Verify a defaulted optional nested property remains optional in types.

Observe failing cases before implementation: missing initial values, schema defaults that must not fill them, unknown names, wrong values, unsupported dialects/keywords/references and non-JSON inputs. After implementation, the same cases pass by asserting the specified errors and no mutation. Dynamic schemas cannot confer an arbitrary caller-selected type.

## Explicit overrides and fixtures

In `test/snapshot.test.ts`, provision a base, override one whole value and assert the original is unchanged. A partial nested object fails when a required field is absent. Equal-value and empty overrides retain identity. Mutate original input objects after creation and attempt mutations of returned graphs; captured values and identities must stay fixed.

Serialize the fixture in `test/fixtures/snapshot.json`, restore it against the expected declaration and assert canonical bytes and both digests. Run fresh Node child processes from the existing Vitest test to compare canonical output across processes. Reorder object keys and expect equality; change values, schema annotations or array order and expect the relevant identity to change. Changed initials must not affect restoration. Tampered payloads, versions, identities and foreign definitions must reject without repair.

## Optional Zod authoring

In `test/zod.test.ts`, compare accepted Zod descriptors with equivalent normalized raw schemas and run a shared value corpus through Zod and the core validator. Include nested branches and repeated bounds. Negative declarations must cover custom refinements, transforms, defaults, coercion, plain stripping objects, regex flags and unsupported checks.

In `test/parameters.test.ts`, create an isolated temporary core consumer containing only the core files and declared core dependencies, with no Zod package or parent node_modules fallback. Execute declaration/provision/restore and verify that the core type graph also resolves without Zod. Cleanup belongs to the test's normal finally path. This proves source dependency isolation; archive qualification remains KEY-117/KEY-88 work.

## Planning-only checks

These commands apply to this PR:

```sh
SPECIFY_FEATURE_DIRECTORY=docs/features/key-116-declare-typed-policy-parameters .specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
specify integration status --json
pnpm exec oxfmt --check docs/features/key-116-declare-typed-policy-parameters
pnpm test:repository
git diff --check
```

Native PostgreSQL, shared Budget conformance, installed archives, Cloud behavior and performance qualification are NOT RUN. No result here qualifies Local preview publication.
