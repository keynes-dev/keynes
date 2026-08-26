# Repository scripts

- **Owner:** `@shubsharan`
- **Status:** Repository infrastructure and FEAT-0002 contract generation
- **Package status:** Root-owned and non-publishable
- **Functional status:** FEAT-0002 generator implemented

## Responsibility

`scripts/` owns repository automation that the workspace tools do not express. `feature-identity.mjs` checks the shared `FEAT-XXXX`, branch, and `docs/features/` identity used by Spec Kit. `generate-contracts.ts` reads the FEAT-0002 contract and migration inputs, then writes only the declared generated consumers.

pnpm owns workspace membership, declared dependencies, toolchain enforcement, and cycle rejection. Turborepo validates package boundaries.

This area does not own Keynes runtime behavior.

## Allowed and public edges

Root `package.json` commands are the contributor-facing edge. Use `pnpm generate` to update consumers, `pnpm generate:check` to check drift, and `pnpm test:generator` to run the focused generator tests.

Production workspaces must never import `scripts/`. The directory is not a pnpm
workspace, published package, runtime dependency, or alternate authority.

## Private internals

Generator implementation details and owner-local tests remain private.

## Source policy

Prefer pnpm and Turborepo configuration when they express a repository rule directly. TypeScript scripts use Node 24 native execution in ESM mode with erasable syntax only. Keep focused tests beside meaningful script logic.

## Deferred work

The FEAT-0002 generator is not a runtime package or a second source of Budget semantics. Distribution tooling, cross-host conformance, security, compatibility, packaging, broad fault campaigns, performance, and evidence promotion remain `NOT RUN`.
