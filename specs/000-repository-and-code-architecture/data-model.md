# Phase 1 data model: Repository and code architecture

Epic 000 creates repository engineering structure, not Keynes product data. Its
small model exists only to make ownership and verification unambiguous.

## Repository boundary

A repository boundary is a directory with one responsibility and one documented
owner.

### Fields

- `path`: One of `contracts/`, `database/`, `sdk/`, `cloud/`, `scripts/`, or
  `docs/`.
- `owner`: `@shubsharan`, the repository code owner responsible for changes in
  the boundary.
- `responsibility`: A short statement of what belongs in the boundary.
- `public_edges`: Files or entry points that other boundaries may use.
- `private_edges`: Files that other boundaries must not import or modify.
- `functional_status`: Fixed to `nonfunctional` for Epic 000 placeholders.

### Rules

- Every path has exactly one primary owner and responsibility.
- Public and private edges do not overlap.
- Placeholder documentation does not claim implemented Keynes behavior.
- New top-level boundaries require an explicit architecture decision.

## Root infrastructure

Root infrastructure supports the ownership areas without becoming another
product boundary.

### Required files

- Root package, pnpm workspace, lockfile, Turborepo, TypeScript, Oxlint, Oxfmt,
  and Vitest configuration.
- `.gitignore` entries for dependency installs, Turbo state, test and report
  output, and generated build output.
- The Apache-2.0 `LICENSE` text.
- `.github/CODEOWNERS` assigning all repository paths to `@shubsharan`.
- A least-privilege GitHub Actions workflow that runs the root verification
  command.

### Rules

- Root infrastructure contains no Keynes runtime behavior.
- The CI workflow uses pinned action commits and no credentials.
- Generated local state does not appear as untracked or modified source.

## Workspace

A workspace is a TypeScript package that participates in pnpm and Turborepo.

### Fields

- `path`: Either `sdk/` or `cloud/` in Epic 000.
- `manifest`: The workspace's private `package.json`.
- `tasks`: The workspace commands exposed to Turborepo.
- `dependencies`: Declared external and workspace dependencies.

### Rules

- Every workspace is private and non-publishable in Epic 000.
- The root pnpm workspace discovers every workspace from a clean checkout.
- Turborepo task-output caching remains disabled throughout Epic 000.
- Production code does not depend on `scripts/`.

## Dependency rule

A dependency rule states which boundary may consume another boundary and through
which public edge.

### Required rules

- `database/` is the only future owner of authoritative Budget transitions.
- `sdk/` and `cloud/` may use only versioned public database procedures or
  protocols; neither may access private database storage.
- `sdk/` and `cloud/` do not import one another.
- Runtime code never imports repository scripts or tests.

Each rule has a stable diagnostic code so a failed check explains the exact
boundary violation.

## Check result

A check result is the ordinary outcome reported by a root command or CI job.

### Fields

- `check_id`: Stable check name.
- `status`: `passed`, `failed`, `skipped`, or `not_run`.
- `tool_version`: Exact tool version when the result depends on a tool.
- `message`: Actionable human-readable outcome.

### Rules

- Required Epic 000 checks must pass before the epic is complete.
- A skipped or unrun check is never reported as passed.
- Future runtime, conformance, security, compatibility, fault, packaging, and
  performance work remains `NOT RUN` until its owning roadmap feature executes
  meaningful tests.
- GitHub Actions logs and check results are sufficient for Epic 000; the epic
  defines no custom evidence schema or repository promotion protocol.
