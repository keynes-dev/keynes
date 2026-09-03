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

| Feature                                                                               | Purpose                                                                                                                                                                                      | Depends on                | Status   |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------- |
| [0004 Local runtime and SDK](features/0004-local-runtime-sdk/spec.md)                 | Add `Keynes.create({ mode: "local" })` with a private process-scoped PGlite runtime and the complete TypeScript Budget loop. Expose no database handle, daemon, account, or network service. | Shared core platform gate | Complete |
| [0005 Local preview qualification](features/0005-local-preview-qualification/spec.md) | Prove runtime isolation, replay safety, shutdown behavior, packaged asset loading, supported build environments, package size, memory, startup, and latency.                                 | Local runtime and SDK     | Complete |

On August 24, 2026, FEAT-0004 passed `pnpm --filter @keynes/sdk test`, `pnpm generate:check`, `pnpm verify`, and `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`. These provider-free checks cover the source-workspace TypeScript facade, its private in-memory PGlite runtime, and the unchanged generated contract boundary. Emitted-package assets, package installation, supported environment qualification, package size, startup, memory, latency, shutdown qualification, managed providers, paid services, and fault campaigns remain `NOT RUN`.

On August 25, 2026, [FEAT-0005 hosted run 32886316983](https://github.com/shubsharan/keynes/actions/runs/32886316983) passed for exact commit `714268c950e2f243755725bbe248add88977f6d5` and archive SHA-256 `86c099f7ea666edd58c3947199651aad07e2563621d23e01d619ab3efd098b84`. The same 28,943-byte archive and 25,576,559-byte production install passed clean-consumer qualification on Node.js 24 and 26 across Linux x64, macOS arm64, and Windows x64. On the Linux x64 Node.js 24 reference runner, ready-runtime RSS p95 was 771,928,064 bytes against the temporary 1 GiB ceiling; cold creation, first request, and steady request p95 values were 2,576.488, 22.174, and 9.847 milliseconds. [GitHub issue #6](https://github.com/shubsharan/keynes/issues/6) owns reducing RSS to 512 MiB p95, with 384 MiB as the stretch target. Registry publication, browsers, bundlers, CommonJS, Bun, Deno, other architectures, Cloud, managed providers, security, recovery, production suitability, paid services, and fault campaigns beyond the declared lifecycle cases remain `NOT RUN`.

FEAT-0003 through FEAT-0005 tested PGlite. Those runs remain valid evidence for the code and packages they exercised. They do not test the future SQLite runtime and must not be used to qualify it.

## Private remote service foundation

This stage proves the existing private service and native PostgreSQL path without claiming a public, self-hosted, or managed product.

| Feature                                                                       | Purpose                                                                                                                                                   | Depends on                  | Status   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------- |
| [0006 Cloud runtime and service](features/0006-cloud-runtime-service/spec.md) | Run the complete remote Budget loop through one authenticated service and one PostgreSQL database. Prove tenant isolation and exact replay after restart. | Local preview qualification | Complete |

On August 25, 2026, FEAT-0006 passed `pnpm verify`, the 54-test PGlite and native PostgreSQL platform suite, and the nine-scenario native Cloud run for exact source revision `1fa83d1adf3e5c37adaaccdb4afdb7c037b6fb1a` and contract digest `0453c8e661a77bc053254c67b1fb90bf19309bc8af5f5190ecf38c5f205720d6`. The retained record is `docs/features/0006-cloud-runtime-service/evidence/cloud-1fa83d1.json`. It proves two-tenant lifecycle and permission isolation, service and client restart, committed-response loss and exact replay, concurrent replay and conflict handling, cross-tenant operation isolation, explicit database unavailability with pool recovery, limited-role denial, and startup refusal for empty, incompatible, checksum-drifted, or publicly executable authorities. One earlier same-revision platform attempt hit two existing five-second PGlite test timeouts; the immediate clean rerun passed all 54 tests.

This evidence covers only the private loopback service and provider-free PostgreSQL database. Managed-provider deployment, paid infrastructure, external identity, live exposure, TLS, Policy, the final public SDK and protocol compatibility, self-hosted packaging, backup restoration, recovery, failover, multi-region behavior, performance and benchmark qualification, security qualification, incident operations, managed Cloud readiness, and production readiness remain `NOT RUN`.

## Runtime and deployment model

This feature records the move to a local in-memory SQLite runtime, PostgreSQL durable deployments, a portable Policy query format, the open-core license, and the implementation sequence. It also simplified the then-current pre-release facade to `Keynes.create()`; it did not replace PGlite or implement remote discovery.

| Feature                                                                                 | Purpose                                                                                                                             | Depends on                | Status   |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------- |
| [0007 Runtime and deployment model](features/0007-runtime-and-deployment-model/spec.md) | Align governance, product, architecture, roadmap, templates, and license metadata around the approved runtime and deployment model. | Cloud runtime and service | Complete |

On August 25, 2026, FEAT-0007 passed its focused SDK tests, feature-identity, prerequisite, formatting, repository, unit, pull-request, package-qualification, stale-claim, historical-artifact, and whitespace checks in the feature worktree. Those checks prove the zero-argument facade against the current PGlite engine, its packed consumers, and repository agreement. They do not prove the future SQLite engine, PostgreSQL installation, Policy, public remote access, self-hosted packaging, managed Cloud, recovery, security, or production support.

## Implementation sequence

| Order | Feature candidate                                                                              | Purpose                                                                                                                                                           | Depends on                         | Status      |
| ----- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------- |
| 1     | [SQLite local runtime](features/0008-sqlite-local-runtime/spec.md)                             | Replace PGlite with a private process-owned `node:sqlite` in-memory database while preserving the complete public Budget API and behavior.                        | Runtime and deployment model       | Complete    |
| 2     | [PostgreSQL transaction integration](features/0009-postgresql-transaction-integration/spec.md) | Install and qualify one supported embedded PostgreSQL profile with exact recheck, incompatible-target rejection, and caller-owned atomic application composition. | SQLite local runtime               | Complete    |
| 3     | [Portable Policy evaluation](features/0012-portable-policy-evaluation/spec.md)                 | Implement Kysely and raw-SQL authoring, one parser and semantics profile, transaction-local local/PostgreSQL backends, and differential conformance.              | PostgreSQL transaction integration | Complete    |
| 4     | [Resource-bound Budget creation](features/0014-resource-bound-budget/spec.md)                  | Separate SDK connection setup from atomic Resource binding and root Budget creation while preserving one typed local and PostgreSQL contract.                     | Portable Policy evaluation         | Complete    |
| 5     | [Remote PostgreSQL SDK](features/0013-remote-sdk-public-service/spec.md)                       | Connect the server-side TypeScript SDK directly to one PostgreSQL authority through verified TLS, role-bound identity, and versioned procedures.                  | Resource-bound Budget creation     | In progress |
| 6     | Self-hosted deployment                                                                         | Package and qualify customer-operated PostgreSQL, credential administration, and supported connection profiles.                                                   | Remote PostgreSQL SDK              | Not started |
| 7     | Managed Cloud                                                                                  | Operate the same PostgreSQL contract with Keynes-owned hosting, credentials, upgrades, recovery, administration, and support.                                     | Self-hosted deployment             | Not started |
| 8     | Release support                                                                                | Define supported versions, capabilities, interfaces, compatibility windows, upgrade policy, and support boundaries across deployments.                            | Managed Cloud                      | Not started |
| 9     | Production testing                                                                             | Run the complete semantic, security, concurrency, recovery, compatibility, packaging, performance, upgrade, backup, and operational qualification.                | Release support                    | Not started |

`PostgreSQL transaction integration` is complete for its supported PostgreSQL 18.6 preview boundary and has feature identity FEAT-0009. Repaired revision `7edb1ee723c39b10c0dc864673fb9cb1f5d00b3e` passed the Docker-free PR lane, all 85 fixed provider-free PostgreSQL scenarios, and all 9 Cloud native blast-radius scenarios. A direct adopter walkthrough on older revision `75fb60cf6e4df399b3c71ac28173e0ce769a42e7` completed install, exact recheck, application-role request, and outbox commit in 195 milliseconds after database and role preparation. The timed walkthrough was `NOT RUN` after the later configuration, migration-asset-loading, and CLI-entrypoint changes.

`Portable Policy evaluation` is complete as FEAT-0012. Accepted source revision `ea621cc567d30e5c685fc40cd907f308e16489bc` supports schema-first handles, Kysely and raw-SQL authoring, generated portable semantics, local and PostgreSQL evaluation, fail-closed rollback, canonical evidence, and exact governed replay. The exact provider-free gates passed 302 tests; the SDK and PostgreSQL archives passed 17 and 21 package tests; PostgreSQL 18.6 passed 132 system scenarios; and private Cloud passed 9 no-Policy scenarios. The hosted Node.js 24/26 matrix, public remote Policy, providers, recovery, and production readiness remain `NOT RUN`.

`Resource-bound Budget creation` is complete as FEAT-0014. Accepted source revision `b25a491de6831fc8f3b014ffdf15ab73b236029a` lets one local connection create independent typed roots by atomically reconciling the allocated Resource definitions, quantities, optional Policies, replay record, and history. PostgreSQL migration `0005-resource-bound-budget` implements the same command while preserving migrations `0001` through `0004`. The exact SDK and PostgreSQL archives passed 20 and 21 package tests; PostgreSQL 18.6 passed 159 scenarios; and the private Cloud regression passed 9 no-Policy scenarios. The [acceptance record](features/0014-resource-bound-budget/evidence/acceptance.json) keeps those lanes separate from unexecuted deployment claims. FEAT-0014 merged as `09eba82d868759375144b14b5971a7a257f0a9e6`; FEAT-0013 is now in progress on its refreshed canonical branch and will add immutable migration `0006-remote-access.sql`. All later incomplete candidates remain unnumbered and `Not started`.

## Standalone repository work

Standalone Spec Kit work can maintain the repository without changing the product sequence.

| Feature                                                                       | Purpose                                                                                                                                  | Depends on                         | Status      |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------- |
| [0010 Repository organization](features/0010-repository-organization/spec.md) | Organize products, tooling, package tests, system tests, commands, and new evidence by responsibility without changing product behavior. | PostgreSQL transaction integration | Complete    |
| [0011 Idiomatic monorepo](features/0011-idiomatic-monorepo/spec.md)           | Put deployable applications, real packages, owner-local tests, orchestration scripts, and durable evidence under honest owners.          | Repository organization            | In progress |

### SQLite local runtime

FEAT-0008 delivered the private SQLite runtime behind the earlier pre-release facade. FEAT-0014 now separates local connection setup from Resource-bound root creation:

```ts
const resources = defineResources({
  tokens: { unit: "token", accountingBehavior: "consumable" },
});
const keynes = await createKeynes();
const root = await keynes.createBudget(resources, { tokens: 1000 });
```

The runtime preserves `createBudget`, `Budget.request`, `settle`, `inspect`, `close`, structured error details, replay behavior, and close behavior. `Keynes` and `Budget` are now readonly interface types implemented by frozen closure-backed handles. FEAT-0008 required the runtime to:

- implement the five current operations in `SqliteCommandExecutor` over a private `node:sqlite` in-memory database;
- run the existing lifecycle, denial, settlement, replay, history, rollback, isolation, malformed-input, and close tests against it;
- compare SQLite with native PostgreSQL through the platform test;
- prove a failed command changes no state;
- prove concurrent sibling requests cannot overspend a parent Budget;
- prove exact replay and conflicting command reuse;
- remove `@electric-sql/pglite`, the PGlite adapter, and local migration startup;
- stop copying PostgreSQL migrations into the SDK package;
- keep the PostgreSQL migrations, native tests, Cloud package, and FEAT-0006 code;
- update package qualification so it no longer stages a PGlite archive;
- requalify Node.js 24 and 26 on Linux, macOS, and Windows;
- measure package size, install size, memory, startup, request latency, and shutdown again; and
- require ready memory below the existing 512 MiB target.

On August 26, 2026, review-remediated revision `a33761aac041083dfdc932efc434a60f345870af` passed the provider-free gates, the 44-test SQLite/PostgreSQL platform lane, and [hosted Local Preview run 32963676499](https://github.com/shubsharan/keynes/actions/runs/32963676499). One 23,426-byte self-contained SDK archive passed clean ESM consumers on Node.js 24 and 26 across Linux x64, macOS arm64, and Windows x64. On the Linux x64 Node.js 24 reference runner, absolute ready RSS p95 was 56,217,600 bytes, cold creation p95 was 1.178 milliseconds, first request p95 was 0.781 milliseconds, steady request p95 was 2.967 milliseconds, and shutdown p95 was 0.159 milliseconds. Every declared preview limit passed. Earlier hosted records remain historical evidence for their exact revisions, but their RSS-growth and warmed-creation measurements do not qualify these two requirements.

Policy, persistence, browsers, bundlers, CommonJS, Node.js 25, Bun, Deno, custom Node.js builds, undeclared architectures, provider qualification, paid services, security qualification, recovery, upgrades, backup restoration, self-hosted operations, managed Cloud, registry release, adopter use, broader fault campaigns, and production operations remain `NOT RUN`.

### PostgreSQL transaction integration

Combine transaction integration and installation support into one embedded preview. Declare PostgreSQL 18.6 as the sole supported profile, install the canonical migrations into one clean database, and prove:

- the installer privileges, application-role grants, supported functions, contract identity, migration identities, and support limits are explicit;
- clean installation and exact recheck succeed without changing state;
- an application role can call only supported Keynes functions;
- caller-owned database code can call the supported SQL boundary inside its existing transaction;
- optional generated TypeScript bindings do not own transaction lifecycle;
- a Budget request and an application outbox row commit or roll back together;
- application code cannot use a pending Budget before commit;
- replay after commit returns the original result without creating another Budget; and
- an unsupported release, insufficient privilege, or incompatible target fails without leaving a usable authority; incompatible targets include partial, modified, or contract-mismatched state.

This feature supports fresh installation and exact recheck only. Keynes has no released predecessor, so upgrades, downgrades, rolling deployment, broad provider support, recovery support, extension packaging, and production readiness remain out of scope.

### Portable Policy evaluation

FEAT-0012 implements the Kysely authoring adapter, PostgreSQL parser adapter, Policy-program normalizer, authoritative machine-readable semantics profile, generated backend declarations, local backend, and PostgreSQL backend together. Evaluation stays inside the selected Budget authority's atomic command. Keynes does not trust application-computed decisions. The comparison covers:

- Resource limits and denial reasons;
- bounded-decimal, final-integer, and null behavior;
- ordering and aggregation;
- unsupported SQL;
- context validation;
- deterministic function restrictions;
- Policy revisions and digests; and
- recorded context and replay behavior; and
- generated node vectors and property-generated programs across both backends.

Kysely output and raw SQL must pass through the same parser, validator, and normalizer into one versioned Policy program. One semantic registry owns the program rules; deployment-native execution is the v1 choice, not a permanent ban on a shared executable core. The feature does not choose another durable database or give Policies direct access to application tables.

At its accepted revision, this feature also replaced the pre-release class
facade with a schema-first functional API. FEAT-0014 later separated connection
setup from Resource binding: `defineResources(...)` returns a frozen type
carrier, `createKeynes()` returns a readonly local capability, and
`createBudget(schema, allocation, options?)` binds each root. Approved requests
return readonly Budget capabilities. The SDK keeps method calls but exports no
constructible `Keynes` or `Budget` class and no compatibility alias.

## Conditional growth

This stage contains optional capabilities. Product direction can promote a candidate into the delivery sequence without an adopter trial or external validation gate.

| Feature                                 | Purpose                                                                                                                                                                          | Depends on            | Status      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------- |
| Operational and analysis tools          | Add diagnostics or analysis required by the supported product.                                                                                                                   | Remote PostgreSQL SDK | Not started |
| Subtree issuance                        | Allow authorized Resource creation within a child subtree while preserving conservation, settlement, replay, recovery, compatibility, and deployment comparison.                 | Production testing    | Not started |
| Multi-source funding                    | Allow ordered contributions from several Budgets in one PostgreSQL database while preserving one structural parent and atomicity. Cross-database composition remains invalid.    | Subtree issuance      | Not started |
| Another durable database implementation | Reconsider MySQL, SQLite, or another durable store only after a constitution amendment and a complete concurrency, migration, security, recovery, packaging, and support design. | Production testing    | Not started |
