# ADR-0001: Adopt lean repository boundaries

- **Date:** 2026-08-21
- **Status:** Accepted
- **Decider:** `@shubsharan`
- **Tags:** repository, ownership, TypeScript, monorepo

## Context and problem statement

Keynes needs repository ownership and a repeatable engineering baseline before
runtime work begins. The target architecture includes contracts, one PostgreSQL
authority core, one TypeScript SDK with local PGlite support, and one private
TypeScript Cloud service. Creating a package, distribution, or verification
workspace for every future deliverable would add empty boundaries and could
make unimplemented behavior appear qualified.

Epic 000 must establish useful ownership without implementing Keynes behavior,
selecting database versions, generating contracts, packaging PostgreSQL, or
claiming cross-host evidence.

## Decision drivers

- Keep the repository understandable from a clean checkout.
- Preserve one future database authority and prevent adapter-owned semantics.
- Give current code and documentation exactly one accountable owner.
- Support two TypeScript workspaces without inventing publication units.
- Add future boundaries only when their owning epic has real artifacts.

## Considered options

1. Use six lean, top-level ownership areas with two private workspaces.
2. Create nested SDK, service, authority-core, distribution, code-generation,
   verification, and test-lane packages immediately.
3. Keep all future sources in one undifferentiated root workspace.

## Decision outcome

Chosen option: **Use six lean, top-level ownership areas with two private
workspaces.** The repository uses `contracts/`, `database/`, `sdk/`, `cloud/`,
`scripts/`, and `docs/`. `@shubsharan` owns every path. Root manifests, tool
configuration, `.gitignore`, `LICENSE`, and `.github/` support these areas but do
not become another product boundary.

Only `sdk/` and `cloud/` are pnpm workspaces. Their provisional private names are
`@keynes/sdk` and `@keynes/cloud`; these names make no publication promise.
Tests stay beside their owner. The repository uses pnpm as its contributor
command surface and Turborepo only to schedule the two workspaces.

### Ownership and public edges

| Area | Responsibility | Allowed or public edge |
| --- | --- | --- |
| `contracts/` | Versioned logical interfaces and canonical fixtures | Approved versioned contract sources and fixtures |
| `database/` | Authority SQL, migrations, private storage, and later PostgreSQL distribution | Versioned public procedures and contract-defined protocols |
| `sdk/` | Public TypeScript SDK and private local PGlite adapter | Future package exports derived from shared contracts |
| `cloud/` | Private TypeScript Cloud service | Future contract-defined authenticated Cloud protocol |
| `scripts/` | Repository checks and later contract generation | Root contributor commands |
| `docs/` | Product, architecture, roadmap, ADRs, and guides | Source-of-truth documents and accepted decisions |

The future dependency graph remains acyclic. `sdk/` and `cloud/` may consume
public contract artifacts and invoke only versioned public database procedures
or protocols. They do not import one another, private database storage,
`scripts/`, or owner-local tests. Scripts may inspect repository sources for
validation, but production code never depends on scripts. Documentation may
reference every area but is not an executable runtime contract.

### Private internals and source policy

Each area owns its internal representation. Database tables, locks, transaction
mechanics, and operational overlays remain private to `database/`. Local PGlite
lifecycle and transport adapters remain private to `sdk/`. Authentication,
routing, pooling, retries, and recovery mechanics remain private to `cloud/`.
Checker implementations and invalid fixtures remain private to `scripts/`.

Logical contracts are authored and versioned under `contracts/`. Authoritative
SQL, PL/pgSQL, and the migration graph remain under `database/`. TypeScript is
the only SDK and Cloud service language. Generated outputs must derive from
approved contract and database sources when Epic 100 introduces generation.

## Consequences

### Positive consequences

- A contributor can identify responsibility and dependency direction from the
  top-level tree.
- The two current TypeScript workspaces share one small, exact-pinned toolchain.
- Empty packages and test lanes cannot imply unsupported behavior or evidence.
- Later epics can add real artifacts inside an already-owned area.

### Negative consequences

- Some ownership areas contain only documentation until their implementation
  epic begins.
- Root-owned checks enforce the initial dependency graph without a dedicated
  architecture-analysis package.
- Publication, database packaging, and host qualification require later
  decisions and cannot be inferred from the initial tree.

## Pros and cons of the options

### Six lean, top-level ownership areas

- Preserves explicit ownership and the future authority boundary with only two
  current workspaces.
- Keeps tests and automation close to their owner.
- Leaves some areas source-only until their implementation epic begins.

### Expanded package and verification hierarchy

- Mirrors the eventual deliverable list in the initial tree.
- Creates empty publication, distribution, generation, and qualification
  boundaries before real artifacts exist.
- Adds orchestration and dependency policy that Epic 000 cannot meaningfully
  verify.

### One undifferentiated root workspace

- Minimizes the initial directory count.
- Obscures ownership of contracts, authority SQL, adapters, service code, and
  documentation.
- Makes later extraction and dependency enforcement more disruptive.

## Deferred work

Epic 100 owns contract generation and generated-output drift checks. Epic 500
owns PostgreSQL distribution packaging under `database/`. Epic 700 owns a root
cross-host conformance area after local PGlite, customer PostgreSQL, and managed
Cloud are real. Security, compatibility, fault, packaging, performance, and
evidence-promotion lanes remain unscaffolded and `NOT RUN` until an approved
owning epic defines and executes them.

Epic 000 implements no Resource, Budget, Policy, settlement, authority, SDK
runtime, local embedded runtime, or Cloud behavior.

## Links

- [Product thesis](../product.md)
- [Runtime architecture](../architecture.md)
- [Implementation roadmap](../roadmap.md)
- [Epic 000 specification](../../specs/000-repository-and-code-architecture/spec.md)
