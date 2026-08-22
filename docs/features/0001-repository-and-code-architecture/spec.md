# Feature specification: Repository and code architecture

**Feature ID**: `FEAT-0001`
**Feature branch**: `feat/0001-repository-and-code-architecture`
**Roadmap stage**: `Repository baseline`

**Created**: August 21, 2026

**Status**: Draft

**Input**: User description: "Complete epic 000-repository-and-code-architecture from docs/roadmap.md using subagents and the Spec Kit workflow. Stop and ask questions before making architectural decisions."

## Clarifications

### Session August 21, 2026

- Q: Should the repository baseline use seven Spec Kit features or one feature with seven independently gated deliverables? -> A: Use one feature with seven independently gated deliverables.
- Q: Which runtime architecture should FEAT-0001 scaffold? -> A: Earlier answers selected a broader database-native and multi-language topology. Later answers superseded that topology with TypeScript as the sole SDK and Cloud language.
- Q: What version-pinning policy should the workspace use? -> A: Pin exact patch versions for development and CI, and document supported runtime compatibility as explicit version ranges.
- Q: Must contributors switch to the repository's exact Node.js patch? -> A: No. Support Node.js 24 through 26 for contributors, keep Node.js 24.19.0 as the default and primary CI version, and keep pnpm pinned to 11.21.0.
- Q: Which workspace tooling profile should FEAT-0001 establish? -> A: Use pnpm as the contributor entry point and Turborepo for the task graph.
- Q: What is the final approved FEAT-0001 scope? -> A: This answer supersedes all earlier repository-topology and scaffolding answers. Create only `packages/contracts/`, `packages/database/`, `packages/sdk/`, `packages/cloud/`, `scripts/`, and `docs/`. Use a lean TypeScript workspace with pnpm, Turborepo, the stable TypeScript 7 native compiler through `tsc --noEmit`, Oxlint, Oxfmt, Vitest, and native pnpm and Turborepo dependency enforcement. Keep tests colocated. Do not create a distribution placeholder, dedicated tooling workspaces, an evidence promotion system, top-level test-lane directories, or executable skeletons for future test lanes.
- Q: How should unavailable future verification lanes be represented? -> A: Leave them unscaffolded and explicitly `NOT RUN` in the roadmap until a later approved stage defines and executes them.
- Q: Who owns the repository and which remaining implementation defaults apply? -> A: Add `.github/CODEOWNERS` with `* @shubsharan`. Use private provisional workspace names `@keynes/sdk` and `@keynes/cloud`, `ubuntu-24.04` CI, and Node 24 native TypeScript execution for future root scripts without an extra runner.
- Q: Where should Turborepo workspaces live? -> A: Nest every Turborepo package under `packages/`. Move the two current workspaces to `packages/sdk/` and `packages/cloud/`; treat `packages/` as a namespace, not another ownership boundary.
- Q: Should contracts and database sources also live under `packages/`? -> A: Yes. Put all product-code ownership areas under `packages/`: `packages/contracts/`, `packages/database/`, `packages/sdk/`, and `packages/cloud/`. Keep repository automation in `scripts/` and documentation in `docs/`. Only SDK and Cloud are pnpm and Turborepo workspaces.
- Q: Should FEAT-0001 retain custom dependency, structure, and toolchain scripts and their tests? -> A: No. Let workspace manifests declare package access, let pnpm enforce tool versions and reject dependency cycles, and use `turbo boundaries` for source-import validation. Keep `scripts/` empty of implementation until a later stage has automation that native tools cannot express.

## User scenarios and testing

### User story 1 - Navigate the repository layout (Priority: P1)

As a contributor, I can locate each approved repository area and understand its ownership before adding Keynes functionality.

**Why this priority**: Every later feature depends on putting work in the correct owned area.

**Independent test**: Inspect a fresh checkout and confirm that each approved ownership area exists, has documented ownership, and claims no implemented Keynes behavior.

**Acceptance scenarios**:

1. **Given** a fresh checkout, **When** I inspect the repository structure, **Then** `packages/contracts/`, `packages/database/`, `packages/sdk/`, `packages/cloud/`, `scripts/`, and `docs/` are present.
2. **Given** an approved ownership area, **When** I inspect its README, **Then** its owner, responsibility, and nonfunctional state are clear; only the `packages/sdk/` and `packages/cloud/` workspaces also require private manifests.
3. **Given** the completed scaffold, **When** I inspect top-level directories, **Then** no distribution placeholder, dedicated tooling workspace, or empty test-lane directory exists.

---

### User story 2 - Bootstrap the TypeScript workspace (Priority: P2)

As a contributor starting from a clean checkout, I can install pinned dependencies, discover every workspace, and run consistent root commands without provider credentials.

**Why this priority**: The repository layout is useful only when contributors can reproduce it from committed inputs.

**Independent test**: Start from a clean checkout and run bootstrap, type-check, lint, format-check, test, dependency-check, and complete verification commands.

**Acceptance scenarios**:

1. **Given** supported tools and no provider credentials, **When** bootstrap and verification run, **Then** every TypeScript workspace is discovered and each nonfunctional shell type-checks.
2. **Given** an unsupported required tool version, **When** bootstrap begins, **Then** it fails with an actionable version diagnostic.
3. **Given** the committed lockfile, **When** a clean installation runs, **Then** it completes without rewriting the lockfile.

---

### User story 3 - Understand ownership and dependency direction (Priority: P3)

As a maintainer, I can trace each approved architecture area to one owner and understand which repository dependencies are allowed.

**Why this priority**: Clear ownership and simple dependency rules prevent later work from introducing competing implementations or hidden coupling.

**Independent test**: Review the ownership map and workspace manifests, then run the native pnpm and Turborepo dependency checks.

**Acceptance scenarios**:

1. **Given** an approved repository area, **When** I review the ownership map, **Then** it has exactly one primary owner and a documented responsibility.
2. **Given** a workspace import or dependency, **When** `turbo boundaries` runs, **Then** the relationship is declared by the importing package or fails with an actionable diagnostic.
3. **Given** an undeclared workspace dependency or dependency cycle, **When** the repository check runs, **Then** verification fails.

---

### User story 4 - Keep tests with their owners (Priority: P4)

As a contributor, I can find a package's tests beside the code that owns them and run all current tests from the root.

**Why this priority**: Colocation keeps the initial repository small and makes test ownership obvious.

**Independent test**: Run the root test command and confirm Vitest discovers the colocated tests in each implemented TypeScript workspace.

**Acceptance scenarios**:

1. **Given** a TypeScript workspace or repository script with testable logic, **When** I inspect it, **Then** its tests are colocated with the owning code.
2. **Given** a clean checkout, **When** the root test command runs, **Then** all current colocated Vitest tests run without credentials or external services.
3. **Given** a future test lane that FEAT-0001 cannot run, **When** I inspect the scaffold, **Then** no empty directory or success-shaped test represents it.

---

### User story 5 - Trust the local and CI baseline (Priority: P5)

As a contributor, I can run one provider-free local verification command whose required checks match continuous integration.

**Why this priority**: A shared baseline prevents local success from diverging from continuous integration.

**Independent test**: Run the complete local command and inspect the CI workflow for the same verification entry point.

**Acceptance scenarios**:

1. **Given** a clean checkout and no credentials, **When** complete verification runs, **Then** formatting, linting, type checking, dependency checks, and tests pass.
2. **Given** a failure in a required check, **When** local or continuous verification runs, **Then** the overall command fails and identifies the responsible check.
3. **Given** an unavailable future provider, security, compatibility, packaging, fault, or performance lane, **When** FEAT-0001 completes, **Then** the roadmap still reports that lane as `NOT RUN` rather than passed.

### Edge cases

- An approved ownership area exists without an owner or responsibility.
- A workspace is omitted from discovery or depends on an undeclared workspace.
- A test imports a package that its workspace manifest does not declare.
- A placeholder compiles but accidentally exposes or claims Keynes behavior.
- A colocated test is not discovered by the root task graph.
- Turborepo task-output caching is accidentally enabled.
- A credential, provider dependency, or externally mutating action enters the default verification command.

## Requirements

### Functional requirements

- **FR-001**: The repository MUST contain `packages/contracts/`, `packages/database/`, `packages/sdk/`, `packages/cloud/`, `scripts/`, and `docs/` as its approved code and documentation ownership areas. `packages/` MUST group all product code without becoming an additional boundary. Only `packages/sdk/` and `packages/cloud/` MUST participate in pnpm and Turborepo. Root configuration and `.github/` infrastructure MUST NOT be treated as additional product or code boundaries.
- **FR-002**: FEAT-0001 MUST NOT create a generator, generated-output system, distribution placeholder, dedicated verification workspace, top-level test-lane directories, or executable skeletons for unavailable future lanes. Contract generation begins in the executable authority stage when real inputs exist.
- **FR-003**: Every approved ownership area MUST include a short ownership README. Only the `packages/sdk/` and `packages/cloud/` workspaces MUST include private placeholder manifests. These files MUST identify responsibility, dependency direction, and nonfunctional state.
- **FR-004**: Repository-owned architecture documentation MUST map every FEAT-0001 area to exactly one primary owner and describe its public and private edges without defining Keynes runtime behavior.
- **FR-005**: The root MUST provide `package.json`, `pnpm-workspace.yaml`, a committed pnpm lockfile, contributor support for Node.js 24 through 26, a Node.js 24.19.0 default and primary CI pin, and an exact pnpm 11.21.0 pin. PostgreSQL and PGlite versions MUST be deferred to their implementation and qualification stages.
- **FR-006**: The workspace MUST use pnpm as its contributor-facing command surface and Turborepo as its cross-workspace task graph.
- **FR-007**: Root entry points MUST cover bootstrap, type checking, linting, format checking, testing, dependency checking, and complete provider-free verification. FEAT-0001 MUST NOT invent an emitted build artifact.
- **FR-008**: TypeScript type checking MUST use the stable TypeScript 7 native compiler through `tsc --noEmit`, linting MUST use Oxlint, formatting MUST use Oxfmt, and tests MUST use Vitest.
- **FR-009**: Tests MUST be colocated with the TypeScript workspace or repository script that owns the tested behavior and MUST NOT require a shared top-level test directory.
- **FR-010**: Workspace manifests MUST declare package access, pnpm MUST reject dependency cycles, and Turborepo MUST reject undeclared or cross-package imports with actionable diagnostics. Changes to declared workspace access remain architecture-reviewed changes.
- **FR-011**: The default local and continuous verification commands MUST be deterministic, provider-free, credential-free, and blocking for formatting, linting, type checking, dependency checks, and current colocated tests.
- **FR-012**: Continuous integration MUST use the same required checks as local verification, pin its external actions and dependencies, and keep Turborepo task-output caching disabled throughout FEAT-0001.
- **FR-013**: Unavailable future provider, security, fault, compatibility, packaging, and performance work MUST remain unscaffolded and `NOT RUN` in the roadmap until a later approved stage defines and executes it.
- **FR-014**: Every placeholder and baseline result MUST state that FEAT-0001 implements no Resource, Budget, Policy, settlement, authority, SDK runtime, local embedded runtime, or Cloud behavior.
- **FR-015**: TypeScript MUST be the sole SDK and Cloud service language. FEAT-0001 MUST NOT create or reserve Python or Go directories, workspaces, modules, toolchains, generated outputs, tests, matrices, or package identities.
- **FR-016**: Architectural choices not fixed by the product, architecture, roadmap, constitution, or explicit user clarification MUST receive user approval before entering the implementation plan or codebase.
- **FR-017**: Root repository infrastructure MUST include a `.gitignore` for dependency, Turbo, test, report, and generated build outputs, an Apache-2.0 `LICENSE`, `.github/CODEOWNERS` assigning `* @shubsharan`, and a least-privilege GitHub Actions verification workflow.

### Constitutional requirements

- **Authority and invariants**: FEAT-0001 implements no Budget transition. The `packages/database/` area records ownership only; it contains no functional migration, procedure, or authority behavior.
- **Application boundary**: FEAT-0001 executes no application effects. Test and repository-check scripts are engineering operations only.
- **Policy and security**: Policy execution and security qualification are out of scope. No empty suite or placeholder result may imply that either ran.
- **Contracts and hosts**: Public Keynes schemas, procedures, migrations, SDK behavior, local embedded behavior, and host conformance are out of scope.
- **Evidence classification**: Local command output and CI status prove only the repository baseline. Unavailable future lanes remain `NOT RUN`; FEAT-0001 creates no evidence aggregation or promotion system.

### Key entities

- **Repository area**: One of the six approved code and documentation directories with a documented owner and responsibility. Root infrastructure is not another repository area.
- **Workspace boundary**: A TypeScript package or executable shell discovered by pnpm and scheduled by Turborepo.
- **Dependency rule**: A documented directional relationship between repository areas or workspaces that the repository check can allow or reject.
- **Colocated test**: A Vitest test stored with the code or script that owns the behavior under test.
- **Verification baseline**: The provider-free set of quality, dependency, and current test checks shared by local development and CI.

## Success criteria

### Measurable outcomes

- **SC-001**: All six approved ownership areas exist, and each has one documented owner, responsibility, and source policy.
- **SC-002**: A clean checkout installs from the committed lockfile, discovers every TypeScript workspace, and runs every required root command without credentials or lockfile changes.
- **SC-003**: The dependency check accepts every declared relationship, Turborepo rejects undeclared or cross-package imports, and pnpm rejects workspace dependency cycles.
- **SC-004**: The root test command discovers all current colocated Vitest tests, with no empty top-level test-lane directories or vacuous future-lane passes.
- **SC-005**: Local verification and CI run the same required formatting, linting, type-checking, dependency, and test checks, and any required check failure blocks the overall result.
- **SC-006**: Inspection of all FEAT-0001 source and command surfaces finds zero implemented Keynes functional behaviors and zero claims that unavailable future lanes passed.
- **SC-007**: Root inspection finds the Apache-2.0 license, required ignore patterns, and a pinned least-privilege CI workflow, with generated local state absent from source status.

## Assumptions

- FEAT-0001 uses one Spec Kit cycle. Its seven roadmap deliverables remain separately traceable, but the approved lean implementation does not create one feature or evidence subsystem per deliverable.
- The final user clarifications supersede the earlier broad topology and defer generation until the executable authority stage. The reconciled planning artifacts use this lean scope.
- TypeScript is the only SDK and Cloud service language. PostgreSQL SQL/PL/pgSQL and private local PGlite are future runtime concerns, not behavior implemented by this feature.
- Contributors may use Node.js 24 through 26 without changing their machine-wide Node.js installation. `.node-version` keeps Node.js 24.19.0 as the default and primary CI version, while pnpm remains pinned to 11.21.0.
- pnpm is the contributor-facing command surface, and Turborepo schedules the cross-workspace task graph. Task-output caching remains disabled in FEAT-0001.
- The approved TypeScript quality tools are the stable TypeScript 7 native compiler through `tsc --noEmit`, Oxlint, Oxfmt, and Vitest. pnpm and Turborepo enforce the initial dependency rules without custom checker code.
- Tests remain with their owning workspace or script. Future conformance, security, fault, compatibility, packaging, and performance lanes require later approved designs and remain `NOT RUN` until executed.
- This feature creates only nonfunctional shells and repository engineering proof. All Keynes product behavior remains out of scope.
