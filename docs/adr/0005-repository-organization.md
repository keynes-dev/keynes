# ADR-0005: Organize the repository by responsibility

- **Date:** 2026-08-26
- **Status:** Superseded by [ADR-0006](0006-idiomatic-monorepo.md)
- **Supersedes:** [ADR-0001](0001-repository-boundaries.md)
- **Decider:** `@shubsharan`
- **Tags:** repository, ownership, TypeScript, packages, tests, evidence

## Context and problem statement

ADR-0001 chose one `packages` namespace when contracts, PostgreSQL, the SDK, and Cloud were mostly planned boundaries. That kept the initial repository small and avoided empty packages and evidence areas.

The repository now contains a shipped local SQLite SDK, an installable PostgreSQL command, a Cloud service, contract generation, package verification, and cross-runtime system tests. Their current locations preserve the order in which they appeared. They no longer state what they do. The SDK owns PostgreSQL adapters and native runners, Cloud imports a private installer path, build scripts sit outside their products, and several commands use generic platform, package, qualification, or local-preview names.

## Decision drivers

- Make responsibility visible from the repository tree.
- Keep exactly one owner for each generated output, production implementation, test lane, and retained record.
- Preserve SDK, PostgreSQL CLI, Cloud wire, Budget, installation, and Node support behavior.
- Remove product dependencies that exist only because test helpers live under the wrong owner.
- Keep historical revision-scoped evidence truthful.
- Avoid compatibility shims, duplicate runners, and package-like workspaces for tooling or tests.

## Decision outcome

Use root `contracts`, `tooling`, `system-tests`, `package-tests`, and `artifacts` owners. Keep exactly three product workspaces: `packages/sdk`, `packages/postgresql`, and `services/cloud`.

The SDK owns its public TypeScript API, generated client, and private SQLite runtime. PostgreSQL owns migrations and a CLI-only installer package. Cloud owns authentication and remote PostgreSQL invocation. No production Keynes package imports another.

Contract tooling owns output routing and writes generated files into their consumers. The deployment-neutral `CommandExecutor` is hand-written and internal to the SDK. Root system-test support owns the shared Budget behavior corpus and packed-artifact helpers. Package tests consume archives; system tests install PostgreSQL through the packed command.

Active commands and new evidence name SDK package, PostgreSQL package, PostgreSQL system, and Cloud system subjects. Historical feature documents, ADR bodies, research, and retained artifacts keep their original vocabulary and paths.

## Public edges

| Owner                 | Supported edge                                              |
| --------------------- | ----------------------------------------------------------- |
| `contracts`           | Canonical sources and fixtures consumed by contract tooling |
| `packages/sdk`        | `@keynes/sdk` package root only                             |
| `packages/postgresql` | `keynes-postgresql` executable only                         |
| `services/cloud`      | Existing authenticated Cloud wire                           |
| `tooling`             | Root contributor commands only                              |
| `package-tests`       | Named package-test commands and records                     |
| `system-tests`        | Named system-test commands and records                      |

## Consequences

### Positive consequences

- A contributor can locate a product, generator, test, or retained result without knowing feature history.
- The SDK production graph uses Node built-ins only; PostgreSQL and Cloud each use `pg` and no Keynes package.
- Published package edges match supported adopter behavior.
- Test names and records state what they prove.

### Negative consequences

- Root TypeScript configuration must cover non-workspace tooling and tests explicitly.
- Moving the shared corpus requires a precise structural allowlist for test-only source edges.
- Portable `dist` promotion cannot guarantee uninterrupted path visibility during two directory renames.
- Existing historical artifact directories remain beside the new structure.

## Rejected alternatives

- Keep all code under `packages`. This preserves history but not current responsibility.
- Make every owner a workspace. This gives tooling and evidence package semantics they do not need.
- Keep PostgreSQL test support in the SDK. This preserves forbidden dependencies and obscures the SDK's shipped purpose.
- Preserve programmatic PostgreSQL exports for Cloud. This turns private installation code into a supported API.
- Add transitional directories, re-export shims, or command aliases. These create two canonical answers during an atomic refactor.
- Create a generic evidence framework. The current lanes have different inputs and exclusions, so one abstraction would expose rather than hide those differences.

## Compatibility note

The generated PostgreSQL migration attribution comment remains byte-identical after the generator moves. This deliberate exception preserves migration checksums and exact installations. It is historical attribution inside an immutable installation artifact, not an active ownership instruction.

## Links

- [Historical feature specification](https://github.com/keynes-dev/keynes/blob/e0e85a511024975312cd8b9221c8e6c817272500/docs/features/0010-repository-organization/spec.md)
- [Historical implementation plan](https://github.com/keynes-dev/keynes/blob/e0e85a511024975312cd8b9221c8e6c817272500/docs/features/0010-repository-organization/plan.md)
- [Runtime architecture](../architecture.md)
- [Workflow](../workflow.md)
