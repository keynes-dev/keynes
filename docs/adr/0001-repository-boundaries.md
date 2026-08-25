# ADR-0001: Adopt lean repository boundaries

- **Date:** 2026-08-21
- **Status:** Accepted
- **Amended:** 2026-08-21 - group all product code under `packages/`
- **Amended:** 2026-08-25 - remove the customer-owned PostgreSQL distribution requirement
- **Decider:** `@shubsharan`
- **Tags:** repository, ownership, TypeScript, monorepo

## Context and problem statement

Keynes needs repository ownership and a repeatable engineering baseline before runtime work begins. The target architecture includes contracts, one PostgreSQL database core, one TypeScript SDK with local PGlite support, and one private TypeScript Cloud service. Creating a package, distribution, or verification workspace for every future deliverable would add empty boundaries and could make unimplemented behavior appear qualified.

FEAT-0001 must establish useful ownership without implementing Keynes behavior, selecting database versions, generating contracts, packaging PostgreSQL, or claiming cross-runtime evidence.

## Decision drivers

- Keep the repository understandable from a clean checkout.
- Preserve one future database authority and prevent adapter-owned semantics.
- Give current code and documentation exactly one accountable owner.
- Support two TypeScript workspaces without inventing publication units.
- Add future boundaries only when their owning stage has real artifacts.

## Considered options

1. Use six lean ownership areas, nesting all four product-code areas under a non-owning `packages/` namespace.
2. Nest only the SDK and Cloud workspaces under `packages/`, while keeping contracts and database sources at the root.
3. Create nested database, distribution, code-generation, verification, and test-lane packages immediately.
4. Keep all future sources in one undifferentiated root workspace.

## Decision outcome

Chosen option: **Use six lean ownership areas with all product code nested under `packages/`.** The repository uses `packages/contracts/`, `packages/database/`, `packages/sdk/`, `packages/cloud/`, `scripts/`, and `docs/`. `packages/` is a physical namespace, not a seventh ownership boundary. `@shubsharan` owns every path. Root manifests, tool configuration, `.gitignore`, `LICENSE`, and `.github/` support these areas but do not become another product boundary.

Only `packages/sdk/` and `packages/cloud/` are pnpm workspaces. Their provisional private names are `@keynes/sdk` and `@keynes/cloud`; these names make no publication promise. Tests stay beside their owner. The repository uses pnpm as its contributor command surface and Turborepo only to schedule the two workspaces.

### Ownership and public edges

| Area | Responsibility | Allowed or public edge |
| --- | --- | --- |
| `packages/contracts/` | Logical interfaces and canonical fixtures | Approved contract sources and fixtures |
| `packages/database/` | Database SQL, migrations, private storage, and runtime installation assets | Database procedures and contract-defined protocols |
| `packages/sdk/` | Public TypeScript SDK and private local PGlite adapter | Future package exports derived from shared contracts |
| `packages/cloud/` | Private TypeScript Cloud service | Future contract-defined authenticated Cloud protocol |
| `scripts/` | Later contract generation and repository automation not covered by native tools | Root contributor commands |
| `docs/` | Product, architecture, roadmap, ADRs, and guides | Source-of-truth documents and accepted decisions |

The future dependency graph remains acyclic. `packages/sdk/` and `packages/cloud/` may consume contract artifacts and invoke only contract-defined database procedures or protocols. They do not import one another, private database storage, `scripts/`, or owner-local tests. Workspace manifests declare package access, pnpm rejects dependency cycles, and Turborepo checks that source imports stay within declared package boundaries. Production code never depends on scripts. Documentation may reference every area but is not an executable runtime contract.

### Private internals and source policy

Each area owns its internal representation. Database tables, locks, transaction mechanics, and operational overlays remain private to `packages/database/`. Local PGlite lifecycle and transport adapters remain private to `packages/sdk/`. Authentication, routing, pooling, retries, and recovery mechanics remain private to `packages/cloud/`. Future generator implementations remain private to `scripts/`.

Logical contracts are authored under `packages/contracts/` and identified by their digests. Authoritative SQL, PL/pgSQL, and the migration graph remain under `packages/database/`. TypeScript is the only SDK and Cloud service language. Generated outputs must derive from approved contract and database sources when the executable database stage introduces generation.

## Consequences

### Positive consequences

- A contributor can identify responsibility and dependency direction from the repository tree.
- The two current TypeScript workspaces share one small toolchain, with an exact default for CI and a bounded Node.js contributor range.
- Empty packages and test lanes cannot imply unsupported behavior or evidence.
- Later stages can add real artifacts inside an already-owned area.

### Negative consequences

- Some ownership areas contain only documentation until their implementation stage begins.
- Root-owned checks enforce the initial dependency graph without a dedicated architecture-analysis package.
- Publication, Cloud packaging, and runtime qualification require later decisions and cannot be inferred from the initial tree.

## Pros and cons of the options

### Six lean ownership areas under three root containers

- Preserves explicit ownership and the future database boundary with only two current workspaces.
- Groups all product code under one predictable namespace without adding a new behavioral boundary.
- Keeps tests and automation close to their owner.
- Leaves some areas source-only until their implementation stage begins.

### Workspaces-only package namespace

- Separates installable workspaces from source-only code at the directory level.
- Leaves product code split between the root and `packages/` without a semantic benefit.

### Expanded package and verification hierarchy

- Mirrors the eventual deliverable list in the initial tree.
- Creates empty publication, distribution, generation, and qualification boundaries before real artifacts exist.
- Adds orchestration and dependency policy that FEAT-0001 cannot meaningfully verify.

### One undifferentiated root workspace

- Minimizes the initial directory count.
- Obscures ownership of contracts, database SQL, adapters, service code, and documentation.
- Makes later extraction and dependency enforcement more disruptive.

## Deferred work

The executable database stage owns contract generation and generated-output drift checks. Cloud implementation owns managed PostgreSQL installation under `packages/database/` and `packages/cloud/`. Cross-runtime conformance appears after local PGlite and managed Cloud are real. Customer-owned PostgreSQL distribution is not a product requirement. Security, compatibility, fault, packaging, performance, and evidence-promotion lanes remain unscaffolded and `NOT RUN` until an approved owning stage defines and executes them.

FEAT-0001 implements no Resource, Budget, Policy, settlement, authority, SDK runtime, local embedded runtime, or Cloud behavior.

## Links

- [Product thesis](../product.md)
- [Runtime architecture](../architecture.md)
- [Implementation roadmap](../roadmap.md)
- [Feature 0001 specification](../features/0001-repository-and-code-architecture/spec.md)
