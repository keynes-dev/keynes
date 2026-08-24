# Quickstart: Contributor validation

> **Status: VERIFIED LOCALLY; PRIOR BASELINE VERIFIED IN CI.** The current `packages/` layout passes with the exact FEAT-0001 toolchain locally. The prior committed baseline passed in GitHub Actions; CI for the uncommitted namespace and native-enforcement amendment is `NOT RUN`. No Keynes runtime behavior exists.

## Scope

FEAT-0001 creates a lean repository baseline with these ownership areas:

```text
packages/
├── contracts/
├── database/
├── sdk/
└── cloud/
scripts/
docs/
```

`packages/` contains all product code but is not itself an ownership boundary. Only `packages/sdk/` and `packages/cloud/` are TypeScript workspaces using pnpm and Turborepo. pnpm and Turborepo provide toolchain and dependency enforcement; FEAT-0001 adds no custom checker implementation. Tests stay with the workspace that owns them.

FEAT-0001 does not create a generator, generated-output system, distribution placeholder, evidence aggregation or promotion system, top-level test-lane directories, or executable skeletons for future lanes. It does not start PostgreSQL or PGlite, connect to Cloud, expose an SDK API, or implement Resource, Budget, Policy, settlement, authority, local embedded, or Cloud behavior.

## Prerequisites

Use Node.js 24, 25, or 26 and pnpm 11.21.0. The repository and primary CI default to Node.js 24.19.0, but contributors do not need to replace another supported Node.js installation. PostgreSQL and PGlite versions are deferred to their implementation stages. The default workflow does not require a database package, running database, provider account, credential, or network service.

Start from a clean checkout. Bootstrap and validation must leave tracked source and lockfiles unchanged.

The root `.gitignore` must keep dependency installs, Turbo state, test, and report output, and generated build output out of source status. The repository must contain the standard Apache-2.0 `LICENSE` and a pinned, least-privilege GitHub Actions workflow.

## Root workflow

Bootstrap the pnpm workspace from its committed lockfile:

```sh
pnpm bootstrap
```

Bootstrap must discover every TypeScript workspace, install without changing the lockfile, reject unsupported Node.js or pnpm versions with an actionable message, and require no provider credentials.

Run the focused checks while developing:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm check:deps
```

Turborepo schedules workspace tasks. The stable TypeScript 7 native compiler type-checks through `tsc --noEmit`, Oxlint checks lint rules, Oxfmt checks formatting, and Vitest runs colocated tests. The dependency command runs `turbo boundaries`; workspace manifests declare package access and pnpm rejects workspace dependency cycles.

A successful run proves only the nonfunctional repository shell. It does not qualify SDK, database-authority, local-runtime, distribution, or Cloud behavior.

Run the complete blocking baseline:

```sh
pnpm verify
```

The complete command must run formatting, linting, type checking, dependency checks, and current colocated tests. It must use no credentials, provider access, remote task-output cache, or success-shaped fallback. Any required check failure must make the command fail.

## Dependency validation

The native workspace configuration divides responsibility explicitly:

- `pnpm-workspace.yaml` declares workspace membership and rejects cycles;
- each workspace manifest declares the packages that workspace may access; and
- `turbo boundaries` rejects imports outside the package or absent from its declared dependencies.

FEAT-0001 maintains no duplicate dependency parser, fixtures, or script tests.

## Continuous integration

The workflow in `.github/workflows/ci.yml` runs the same required checks as `pnpm verify` from a clean checkout. It pins external actions and dependencies, uses least privilege, and makes lockfile changes or required-check failures visible. FEAT-0001 satisfied this requirement for commit `c1b61f37ced971b02ddc31b9ce8d171b09a5748b` in [Verify run 32539891232](https://github.com/shubsharan/keynes/actions/runs/32539891232).

CI status and command output are sufficient proof for this repository baseline. The later all-code `packages/` amendment currently has local verification only; its next CI run remains `NOT RUN` until the change is committed and pushed. FEAT-0001 does not aggregate results into a separate schema, attempt directory, or promoted evidence tree.

## Future work

Provider-backed, security, fault-injection, compatibility, packaging, conformance, and performance work is unavailable in FEAT-0001. It has no command, empty top-level directory, or executable skeleton here. The roadmap must keep each unavailable lane explicitly `NOT RUN` until a later approved stage defines and executes it.

## Clean-checkout exit expectation

The local FEAT-0001 baseline passed when bootstrap succeeded from committed inputs, both TypeScript workspaces type-checked, all required local checks passed, native dependency enforcement passed, and the lockfile remained unchanged. The earlier committed baseline passed CI; this native-enforcement amendment requires its own CI run after commit. The final review confirmed that FEAT-0001 added zero Keynes functional behavior.
