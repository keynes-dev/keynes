# Quickstart: Contributor validation

> **Status: IMPLEMENTED LOCALLY - CI NOT RUN.** The commands in this guide were
> verified locally with the exact Epic 000 toolchain. The committed GitHub
> Actions workflow has not run for these uncommitted changes, and no Keynes
> runtime behavior exists.

## Scope

Epic 000 creates a lean repository baseline with these top-level areas:

```text
contracts/
database/
sdk/
cloud/
scripts/
docs/
```

The TypeScript workspaces use pnpm and Turborepo. Repository scripts provide
small dependency and version checks without forming a dedicated tooling
workspace. Tests stay with the workspace or script that owns them.

Epic 000 does not create a generator, generated-output system, distribution
placeholder, evidence aggregation or promotion system, top-level test-lane
directories, or executable skeletons for future lanes. It does not start
PostgreSQL or PGlite, connect to Cloud, expose an SDK API, or implement
Resource, Budget, Policy, settlement, authority, local embedded, or Cloud
behavior.

## Prerequisites

Use Node.js 24.19.0 and pnpm 11.21.0. PostgreSQL and PGlite versions are deferred
to their implementation epics. The default workflow does not require a database
package, running database, provider account, credential, or network service.

Start from a clean checkout. Bootstrap and validation must leave tracked source
and lockfiles unchanged.

The root `.gitignore` must keep dependency installs, Turbo state, test, and report
output, and generated build output out of source status. The repository must
contain the standard Apache-2.0 `LICENSE` and a pinned, least-privilege GitHub
Actions workflow.

## Root workflow

Bootstrap the pnpm workspace from its committed lockfile:

```sh
pnpm bootstrap
```

Bootstrap must discover every TypeScript workspace, install without changing
the lockfile, reject unsupported Node.js or pnpm versions with an actionable
message, and require no provider credentials.

Run the focused checks while developing:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm check:deps
```

Turborepo schedules workspace tasks. The stable TypeScript 7 native compiler
type-checks through `tsc --noEmit`, Oxlint checks lint rules, Oxfmt checks
formatting, and Vitest runs colocated tests. The dependency command runs the
small repository-owned checks from `scripts/`.

A successful run proves only the nonfunctional repository shell. It does not
qualify SDK, database-authority, local-runtime, distribution, or Cloud behavior.

Run the complete blocking baseline:

```sh
pnpm verify
```

The complete command must run formatting, linting, type checking, dependency
checks, and current colocated tests. It must use no credentials,
provider access, remote task-output cache, or success-shaped fallback. Any
required check failure must make the command fail.

## Dependency-check validation

The repository-owned dependency check must reject:

- an undeclared workspace dependency;
- a dependency in a documented forbidden direction; and
- a dependency cycle.

Its colocated Vitest tests may use controlled fixtures under `scripts/`. The
fixtures must not require contributors to edit production source. Each invalid
fixture passes only when the checker exits unsuccessfully for the expected
reason; valid fixtures must pass.

## Continuous integration

The workflow in `.github/workflows/verify.yml` runs the same required checks as
`pnpm verify` from a clean checkout. It pins external actions and dependencies,
uses least privilege, and makes lockfile changes or required-check failures
visible. The workflow itself remains `NOT RUN` until these changes are committed
and pushed to GitHub.

CI status and command output are sufficient proof for this repository baseline.
Epic 000 does not aggregate results into a separate schema, attempt directory,
or promoted evidence tree.

## Future work

Provider-backed, security, fault-injection, compatibility, packaging,
conformance, and performance work is unavailable in Epic 000. It has no command,
empty top-level directory, or executable skeleton here. The roadmap must keep
each unavailable lane explicitly `NOT RUN` until a later approved epic defines
and executes it.

## Clean-checkout exit expectation

The local Epic 000 baseline passed when bootstrap succeeded from committed
inputs, both TypeScript workspaces type-checked, all required local checks
passed, dependency fixtures behaved as specified, and the lockfile remained
unchanged. Epic completion still requires a successful run of the committed CI
workflow. The final review must also confirm that Epic 000 added zero Keynes
functional behavior.
