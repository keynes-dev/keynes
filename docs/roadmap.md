# Keynes implementation roadmap

This roadmap groups completed features and planned feature candidates into unnumbered stages. A planned candidate has no feature ID or artifacts until Spec Kit starts it. Spec Kit may split a candidate, combine adjacent candidates, or refine its boundary.

The [product](product.md) owns product semantics. The [architecture](architecture.md) owns runtime boundaries and release invariants. The [workflow](workflow.md) and [ADR 0002](adr/0002-feature-identity-and-roadmap-stages.md) define feature identity and delivery. Each feature table is the only source for delivery state.

## Repository baseline

This stage establishes the repository shape, ownership rules, engineering commands, and provider-free verification.

| Feature                                                                                         | Purpose                                                                                      | Depends on | Status   |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- | -------- |
| [0001 Repository and code architecture](features/0001-repository-and-code-architecture/spec.md) | Establish ownership, workspace structure, dependency checks, and provider-free verification. | None       | Complete |

## Executable database and platform gate

This stage proves the database-owned Budget lifecycle and runs the same core on PGlite and native PostgreSQL.

| Feature                                                                              | Purpose                                                                                                                                | Depends on                  | Status   |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------- |
| [0002 Executable Budget lifecycle](features/0002-executable-authority-slice/spec.md) | Run Resource definition, root allocation, requests, settlement, and Budget history through generated clients and installed procedures. | Repository baseline         | Complete |
| [0003 Shared core platform gate](features/0003-shared-core-platform-gate/spec.md)    | Run the same migrations, procedures, fixtures, and contention cases on PGlite and PostgreSQL.                                          | Executable Budget lifecycle | Complete |

## Local workflow preview

This stage turns the database core into an installable local product and tests whether it provides value in an outside team's workflow.

| Feature                                                               | Purpose                                                                                                                                                                                      | Depends on                  | Status      |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------- |
| [0004 Local runtime and SDK](features/0004-local-runtime-sdk/spec.md) | Add `Keynes.create({ mode: "local" })` with a private process-scoped PGlite runtime and the complete TypeScript Budget loop. Expose no database handle, daemon, account, or network service. | Shared core platform gate   | Complete    |
| Local preview qualification                                           | Prove runtime isolation, replay safety, shutdown behavior, packaged asset loading, supported build environments, package size, memory, startup, and latency.                                 | Local runtime and SDK       | Not started |
| Adopter workflow evidence                                             | Have one outside team use approval, denial, usage, settlement, and evidence review in a named workflow. Record whether the team keeps the integration.                                       | Local preview qualification | Not started |

On August 24, 2026, FEAT-0004 passed `pnpm --filter @keynes/sdk test`, `pnpm generate:check`, `pnpm verify`, and `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`. These provider-free checks cover the source-workspace TypeScript facade, its private in-memory PGlite runtime, and the unchanged generated contract boundary. Emitted-package assets, package installation, supported environment qualification, package size, startup, memory, latency, shutdown qualification, native PostgreSQL facade behavior, managed providers, paid services, fault campaigns, and adopter use remain `NOT RUN`.

## Selected durable-profile preview

This stage uses adopter evidence to select and qualify either customer PostgreSQL or managed Cloud for the validated workflow.

| Feature                         | Purpose                                                                                                                                                                  | Depends on                      | Status      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ----------- |
| Durable profile selection       | Choose customer PostgreSQL or managed Cloud from the adopter's durability need, trust boundary, transaction requirements, and support constraints.                       | Adopter workflow evidence       | Not started |
| Selected profile feasibility    | Test the selected profile's highest-risk security, transaction, fencing, checkpoint, and recovery assumptions before packaging it.                                       | Durable profile selection       | Not started |
| Selected profile implementation | Package the shared database core for the selected profile without moving Budget or Policy authority into an adapter.                                                     | Selected profile feasibility    | Not started |
| Durable preview qualification   | Pass semantic, security, recovery, installation or deployment, replay, upgrade, rollback, footprint, and latency checks. Confirm that the adopter keeps the integration. | Selected profile implementation | Not started |

## Production release

This stage decides the supported release set and qualifies every host, package, capability, and interface included in it.

| Feature                       | Purpose                                                                                                                                                                                | Depends on                                | Status      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------- |
| Release contract decision     | Accept an ADR that retains the current all-host contract or defines a narrower supported host and package set.                                                                         | Durable preview qualification             | Not started |
| Remaining deployment profile  | Implement and qualify the unselected customer PostgreSQL or managed Cloud profile if the accepted release contract includes it.                                                        | Release contract decision                 | Not started |
| SQL-only PostgreSQL extension | Generate the extension from the migration graph and prove equivalence with bundle installation if the accepted release contract includes it.                                           | Release contract decision                 | Not started |
| Policy and public interfaces  | Complete raw-SQL and typed Policy authoring, publication and activation, sandboxing, stable reads and errors, the SDK, compatibility behavior, and any accepted advisory explanations. | Release contract decision                 | Not started |
| Production qualification      | Run the complete cross-host semantic, security, concurrency, recovery, compatibility, packaging, performance, upgrade, backup, and operational suites.                                 | All work required by the release contract | Not started |

## Conditional growth

This stage contains feature candidates that enter the delivery sequence only when adopter or operating evidence establishes a need.

| Feature                        | Purpose                                                                                                                                                            | Depends on                                  | Status      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ----------- |
| Operational and analysis tools | Add a specific diagnostic, analysis, routing, or operational tool when repeated use identifies the need.                                                           | Usage evidence                              | Not started |
| Subtree issuance               | Allow authorized Resource creation within a child subtree while preserving conservation, settlement, replay, recovery, compatibility, and host conformance.        | Adopter need                                | Not started |
| Multi-source funding           | Allow ordered contributions from several Budgets in one database while preserving one structural parent and atomicity. Cross-database composition remains invalid. | Qualified subtree issuance and adopter need | Not started |
