# Repository scripts

- **Owner:** `@shubsharan`
- **Status:** Nonfunctional repository infrastructure
- **Package status:** Root-owned and non-publishable
- **Functional status:** Repository engineering only in FEAT-0001

## Responsibility

`scripts/` owns repository automation that cannot be expressed by the native
workspace tools. `feature-identity.mjs` owns the shared `FEAT-XXXX`, branch,
and `docs/features/` identity used by Spec Kit. The repository baseline needs
no duplicate dependency checker: pnpm owns
workspace membership, declared dependencies, toolchain enforcement, and cycle
rejection, while Turborepo validates package boundaries. The executable authority stage may add
contract generation here when real contract and database inputs exist.

This area does not own Keynes runtime behavior.

## Allowed and public edges

Root `package.json` commands are the contributor-facing edge. Later generators
may read approved contract and database inputs under their owning stage.

Production workspaces must never import `scripts/`. The directory is not a pnpm
workspace, published package, runtime dependency, or alternate authority.

## Private internals

Future generator implementations and their owner-local tests remain private
implementation details.

## Source policy

Prefer pnpm and Turborepo configuration over custom code when they express the
required repository rule directly. Future TypeScript scripts use Node 24 native
execution in ESM mode with erasable syntax only, with focused tests beside any
meaningful script logic.

## Deferred work

Contract generation, generated-output drift checks, distribution tooling,
cross-host conformance, security, compatibility, packaging, fault, performance,
and evidence-promotion systems belong to later roadmap stages. FEAT-0001 creates
no placeholder implementation for them.
