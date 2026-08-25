# Keynes implementation roadmap

This roadmap groups completed features and planned feature candidates into unnumbered stages. A planned candidate has no feature ID or artifacts until Spec Kit starts it. Spec Kit may split a candidate, combine adjacent candidates, or refine its boundary.

This roadmap tracks product construction and qualification. User research, adopter trials, and validation in external teams' systems are outside its delivery gates. Product direction can use that information when available, but its absence does not block a feature.

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

This stage turns the database core into an installable local product and qualifies it in the declared supported environments.

| Feature                                                               | Purpose                                                                                                                                                                                      | Depends on                  | Status      |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------- |
| [0004 Local runtime and SDK](features/0004-local-runtime-sdk/spec.md) | Add `Keynes.create({ mode: "local" })` with a private process-scoped PGlite runtime and the complete TypeScript Budget loop. Expose no database handle, daemon, account, or network service. | Shared core platform gate   | Complete    |
| [0005 Local preview qualification](features/0005-local-preview-qualification/spec.md) | Prove runtime isolation, replay safety, shutdown behavior, packaged asset loading, supported build environments, package size, memory, startup, and latency.                     | Local runtime and SDK       | Complete    |

On August 24, 2026, FEAT-0004 passed `pnpm --filter @keynes/sdk test`, `pnpm generate:check`, `pnpm verify`, and `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`. These provider-free checks cover the source-workspace TypeScript facade, its private in-memory PGlite runtime, and the unchanged generated contract boundary. Emitted-package assets, package installation, supported environment qualification, package size, startup, memory, latency, shutdown qualification, managed providers, paid services, and fault campaigns remain `NOT RUN`.

On August 25, 2026, [FEAT-0005 hosted run 32886316983](https://github.com/shubsharan/keynes/actions/runs/32886316983) passed for exact commit `714268c950e2f243755725bbe248add88977f6d5` and archive SHA-256 `86c099f7ea666edd58c3947199651aad07e2563621d23e01d619ab3efd098b84`. The same 28,943-byte archive and 25,576,559-byte production install passed clean-consumer qualification on Node.js 24 and 26 across Linux x64, macOS arm64, and Windows x64. On the Linux x64 Node.js 24 reference runner, ready-runtime RSS p95 was 771,928,064 bytes against the temporary 1 GiB ceiling; cold creation, first request, and steady request p95 values were 2,576.488, 22.174, and 9.847 milliseconds. [GitHub issue #6](https://github.com/shubsharan/keynes/issues/6) owns reducing RSS to 512 MiB p95, with 384 MiB as the stretch target. Registry publication, browsers, bundlers, CommonJS, Bun, Deno, other architectures, Cloud, managed providers, security, recovery, production suitability, paid services, and fault campaigns beyond the declared lifecycle cases remain `NOT RUN`.

## Hosted Cloud preview

This stage builds and qualifies Keynes Cloud as the durable, hosted product runtime.

| Feature                                                                       | Purpose                                                                                                                                                           | Depends on                     | Status      |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------- |
| [0006 Cloud runtime and service](features/0006-cloud-runtime-service/spec.md) | Run the complete remote Budget loop through one authenticated service and one PostgreSQL database. Prove tenant isolation and exact replay after restart.         | Local preview qualification    | Complete    |
| Public Cloud access                                                           | Define the versioned Cloud protocol and connect the TypeScript SDK to externally authenticated TLS ingress without exposing database selection or local fallback. | Cloud runtime and service      | Next        |
| Policy authoring and execution                                                | Complete raw-SQL and typed Policy authoring, publication and activation, sandboxing, stable reads and errors, compatibility behavior, and explanations.           | Public Cloud access            | Not started |
| Cloud preview qualification                                                   | Pass semantic, Policy security, recovery, deployment, replay, upgrade, rollback, footprint, and latency checks for the hosted runtime.                            | Policy authoring and execution | Not started |

On August 25, 2026, FEAT-0006 passed `pnpm verify`, the 54-test PGlite and native PostgreSQL platform suite, and the nine-scenario native Cloud run for exact source revision `1fa83d1adf3e5c37adaaccdb4afdb7c037b6fb1a` and contract digest `0453c8e661a77bc053254c67b1fb90bf19309bc8af5f5190ecf38c5f205720d6`. The retained record is `artifacts/cloud/feat-0006-1fa83d1.json`. It proves two-tenant lifecycle and permission isolation, service and client restart, committed-response loss and exact replay, concurrent replay and conflict handling, cross-tenant operation isolation, explicit database unavailability with pool recovery, limited-role denial, and startup refusal for empty, incompatible, checksum-drifted, or publicly executable authorities. One earlier same-revision platform attempt hit two existing five-second PGlite test timeouts; the immediate clean rerun passed all 54 tests.

This evidence covers only the private loopback service and provider-free PostgreSQL authority. Managed-provider deployment, paid infrastructure, external identity, live exposure, TLS, Policy, the final public SDK and protocol compatibility, backup restoration, recovery, failover, multi-region behavior, performance and benchmark qualification, security qualification, incident operations, Cloud-preview readiness, and production readiness remain `NOT RUN`.

The smallest missing capability blocking a usable Cloud preview is supported public Cloud access: a versioned protocol and TypeScript SDK path through externally authenticated TLS ingress. `Public Cloud access` is the only promoted next candidate. It has no feature identity until Spec Kit starts it.

## Production release

This stage completes the local and Cloud product contract and qualifies both runtimes for release.

| Feature                  | Purpose                                                                                                                                                    | Depends on                  | Status      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------- |
| Release contract         | Define supported local and Cloud versions, capabilities, interfaces, and compatibility windows.                                                          | Cloud preview qualification | Not started |
| Production qualification | Run the complete cross-runtime semantic, security, concurrency, recovery, compatibility, packaging, performance, upgrade, backup, and operational suites. | Release contract            | Not started |

## Conditional growth

This stage contains optional product capabilities. Product direction can promote a candidate into the delivery sequence without an adopter trial or external validation gate.

| Feature                        | Purpose                                                                                                                                                            | Depends on                                  | Status      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ----------- |
| Operational and analysis tools | Add diagnostics or analysis required by the supported product.                                                                                                      | Cloud runtime and service       | Not started |
| Subtree issuance               | Allow authorized Resource creation within a child subtree while preserving conservation, settlement, replay, recovery, compatibility, and runtime conformance.     | Production qualification        | Not started |
| Multi-source funding           | Allow ordered contributions from several Budgets in one database while preserving one structural parent and atomicity. Cross-database composition remains invalid. | Subtree issuance                | Not started |
