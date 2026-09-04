# Phase 0 research: Define repository and code architecture

This document records the architecture decisions approved for KEY-44. The feature establishes a small repository foundation and no Keynes product behavior.

## D001 — Spec Kit delivery unit

**Decision**: Use one KEY-44 Spec Kit cycle. The seven included deliverables remain separately traceable through focused checks in one exit workflow.

**Rationale**: The features form one clean-checkout repository baseline. Separate branches and duplicate evidence bundles would add coordination without isolating meaningful product behavior.

**Alternatives considered**: Seven independent Spec Kit cycles and branches.

## D002 — Runtime topology to scaffold

**Decision**: Reserve one PostgreSQL SQL/PL/pgSQL database boundary, one TypeScript SDK with private local PGlite, and one private TypeScript Cloud service. TypeScript is the sole SDK and Cloud service language.

**Rationale**: One application language minimizes the public and internal surface while preserving one future database implementation of Budget behavior.

**Alternatives considered**: Go or Python SDKs, a Go Cloud service, a shared Go transition kernel, and placeholder directories for future languages.

## D003 — Lean repository taxonomy

**Decision**: Use `packages/contracts/`, `packages/database/`, `packages/sdk/`, `packages/cloud/`, `scripts/`, and `docs/` as the six code and documentation ownership areas. `packages/` is a non-owning namespace for all product code. Only `packages/sdk/` and `packages/cloud/` are pnpm workspaces. Tests remain colocated with their owner. Root configuration, `.gitignore`, `LICENSE`, and `.github/` are supporting repository infrastructure rather than additional product boundaries.

**Rationale**: Each ownership area has a current purpose. One `packages/` namespace gives all product code a predictable home without making every source boundary a publishable or runnable package. Repository automation and documentation remain visibly separate.

**Alternatives considered**: Flat root code areas, nesting only pnpm workspaces, `sdks/typescript/`, `services/cloud/`, `database/core/`, `distribution/postgresql/`, dedicated code-generation and verification workspaces, and top-level test suites.

## D004 — Workspace orchestration and quality tools

**Decision**: Use pnpm as the contributor-facing command surface and Turborepo for the `packages/sdk/` and `packages/cloud/` task graph. Use TypeScript 7.0.2 through `tsc --noEmit`, Oxlint 1.79.0, Oxfmt 0.64.0, and Vitest 4.1.11. Disable local, CI, and remote Turborepo task-output caching for every KEY-44 task. Use `turbo boundaries` for source-import validation, workspace manifests for declared package access, and pnpm's native workspace-cycle rejection.

**Rationale**: Turborepo preserves the requested explicit task graph. The Oxc tools and Vitest provide one small TypeScript quality stack, while disabling the cache avoids modeling incomplete inputs and outputs before real builds exist. Native workspace enforcement avoids maintaining a second import parser and its fixtures. The stable TypeScript 7 package uses the Go-native compiler behind the `tsc` command; the retired `tsgo` preview name is not part of the stack.

**Alternatives considered**: Native pnpm orchestration, ESLint and Prettier, dependency-cruiser, a repository-owned import parser, Oxlint's experimental type-check mode, and `@typescript/native-preview`.

## D005 — Toolchain pins

**Decision**: Support Node.js 24 through 26 for contributors while keeping Node.js 24.19.0 as the repository default and primary CI version. Pin pnpm 11.21.0, Turbo 2.10.11, TypeScript 7.0.2, Oxlint 1.79.0, Oxfmt 0.64.0, and Vitest 4.1.11 in the lockfile. Defer PostgreSQL and PGlite version selection to their implementation and qualification stages.

**Rationale**: The supported Node.js range avoids requiring contributors to replace a compatible machine-wide runtime. The default Node.js version and exact repository-tool pins keep the clean-checkout CI baseline repeatable. Database packages and host qualification belong to the features that implement and test them.

**Alternatives considered**: Floating development ranges, prerelease tools, and installing database runtimes during repository bootstrap.

## D006 — Ownership and dependency directions

**Decision**: `packages/contracts/` owns future logical interfaces. `packages/database/` is the only future owner of authoritative SQL and migrations. `packages/sdk/` owns the public TypeScript surface and private PGlite lifecycle. `packages/cloud/` owns the private managed service. `scripts/` owns repository automation. `docs/` owns product, architecture, sequencing, and decisions.

Production workspaces do not import `scripts/`, owner-local tests, each other's private internals, or private database storage. Workspace manifests declare package access, pnpm rejects cycles, and Turborepo validates imports against the declared package graph.

**Rationale**: The graph protects the singular future authority without adding a framework or package solely to express six boundaries.

**Alternatives considered**: dependency-cruiser, a dedicated verification package, and unenforced README-only rules.

## D007 — Generation is deferred

**Decision**: KEY-44 creates no generator, synthetic contract, generated output, digest format, or drift check. The executable database stage introduces generation under `scripts/` when contract and database inputs exist.

**Rationale**: A generator without real inputs would test scaffolding rather than the contract system Keynes will actually ship.

**Alternatives considered**: A private code-generation workspace and a synthetic seed generator in KEY-44.

## D008 — Tests and future qualification lanes

**Decision**: Add only colocated Vitest smoke tests for the two nonfunctional workspaces. Do not create empty conformance, security, compatibility, fault, packaging, or performance suites. Those lanes remain `NOT RUN` until an owning roadmap feature has meaningful behavior and artifacts to test.

**Rationale**: Empty adapters and passing skeletons resemble qualification without proving anything. Owner-local tests keep current failures close to the code that causes them.

**Alternatives considered**: Nine executable skeleton lanes and permanent top-level test directories created before their hosts exist.

## D009 — Verification results

**Decision**: Use command exit status, native diagnostics, GitHub Actions checks, and ordinary CI artifacts. KEY-44 creates no evidence-attempt schema, semantic digest, current-attempt pointer, or tracked promotion hierarchy.

**Rationale**: Commit-bound CI results are sufficient for repository scaffolding. A custom evidence product would exceed the nonfunctional code it verifies.

**Alternatives considered**: Per-feature promoted bundles, immutable attempt directories, custom result schemas, and externally attested assets.

## D010 — Continuous integration and cache trust

**Decision**: Use GitHub Actions with one fixed Linux x64 runner for pull requests. Pin third-party actions to full commit SHAs, grant read-only permissions by default, and do not use `pull_request_target` for untrusted code. CI may cache the pnpm download store from trusted refs but not Turborepo task outputs.

**Rationale**: This is the smallest provider-free CI path that mirrors local verification and avoids unsigned executable cache output becoming an input.

**Alternatives considered**: Multi-OS blocking CI, remote Turbo caching, and external build attestations.

## D011 — Repository license and publication

**Decision**: Use Apache-2.0 for the repository. Keep the `packages/sdk/` and `packages/cloud/` shells private and non-publishable in KEY-44. Do not invent a copyright holder, public npm coordinate, module-format promise, or browser-support claim.

**Rationale**: Apache-2.0 supplies a permissive license and explicit patent grant. Publication decisions need real package qualification and namespace checks.

**Alternatives considered**: MIT, no outbound license, and reserving a public npm identity before release work begins.

KEY-44 retains the standard Apache-2.0 text in the root `LICENSE` file.

## D012 — Deferred repository governance

**Decision**: Defer dedicated secret scanning, dependency-license enforcement, SBOM generation, advisory lookup, PostgreSQL distribution packaging, contract generation, cross-host conformance, and evidence promotion to the roadmap features that own real dependencies, artifacts, hosts, or release claims.

**Rationale**: These controls become valuable when there is something material to inspect or qualify. KEY-44 keeps CI credential-free and contains no product runtime or release artifact.

**Alternatives considered**: Gitleaks, a custom SPDX policy engine, Syft, OSV, distribution placeholders, and provider-free skeletons in KEY-44.

## Pending user decisions

None. Any newly discovered architecture decision must return to the user before entering implementation.

## D013 — Final repository implementation defaults

**Decision**: Assign all repository paths to `@shubsharan` in `.github/CODEOWNERS`. Name the two private, non-publishable workspaces `@keynes/sdk` and `@keynes/cloud`; these names make no registry or publication promise. Use `ubuntu-24.04` for the Linux x64 CI job. KEY-44 adds no root TypeScript implementation. Future root `.ts` scripts use Node 24 native type stripping in ESM mode with erasable syntax and no TypeScript runner or emitted build step.

**Rationale**: These choices keep ownership explicit and the toolchain small while preserving the approved two-workspace topology. Native pnpm and Turborepo checks replace custom dependency fixtures.

**Alternatives considered**: Unassigned ownership, a GitHub team, different private package identifiers, a floating CI label, and adding `tsx` or an emitted script build.
