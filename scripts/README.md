# Repository scripts

- **Owner:** `@shubsharan`
- **Status:** Nonfunctional repository infrastructure
- **Package status:** Root-owned and non-publishable
- **Functional status:** Repository engineering only in Epic 000

## Responsibility

`scripts/` owns repository automation. In Epic 000, that means small checks for
the approved structure, toolchain, workspace declarations, dependency
directions, and cycles. Epic 100 may add contract generation here when real
contract and database inputs exist.

This area does not own Keynes runtime behavior.

## Allowed and public edges

Root `package.json` commands are the contributor-facing edge. Scripts may read
repository manifests and source structure to validate them. Later generators
may read approved contract and database inputs under their owning epic.

Production workspaces must never import `scripts/`. The directory is not a pnpm
workspace, published package, runtime dependency, or alternate authority.

## Private internals

Checker implementations, controlled invalid fixtures, diagnostics, and
owner-local tests remain private implementation details. Invalid fixtures are
test data and must stay outside ordinary type, lint, format, and test discovery.

## Source policy

Use Node 24 native TypeScript execution in ESM mode with erasable syntax only.
Keep focused Vitest tests next to repository-owned checks. Prefer direct,
actionable diagnostics and a narrow syntax parser over a general dependency
analysis framework.

## Deferred work

Contract generation, generated-output drift checks, distribution tooling,
cross-host conformance, security, compatibility, packaging, fault, performance,
and evidence-promotion systems belong to later roadmap epics. Epic 000 creates
no placeholder implementation for them.
