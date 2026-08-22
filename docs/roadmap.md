# Keynes implementation roadmap

> **Status:** This roadmap defines the target implementation sequence. Unless a section records completed evidence, every epic, feature, exit gate, runtime check, security check, performance measurement, packaging check, and conformance check is **NOT RUN**.

This roadmap turns the target [product](product.md) and [architecture](architecture.md) into dependency-ordered implementation work. It uses evidence gates instead of calendar promises. A feature is complete only when its deliverable exists and its acceptance evidence passes. An epic is complete only when all of its features and its exit gate pass.

The implementation preserves one product loop:

```text
Budget -> request -> child Budget -> settle -> evidence
```

The numbering is globally unique and sortable. Each epic owns one hundred-number band, and every feature uses the same `XXX-kebab-case-name` format as its epic. The `000` band establishes the repository and code architecture before contract or product functionality begins.

## `000-repository-and-code-architecture`

**Status:** **COMPLETE**

**Outcome:** Establish a lean TypeScript and SQL repository, explicit ownership, basic dependency rules, and one local and CI engineering baseline before implementing Keynes behavior.

**Dependencies:** None.

This epic creates structure and proof that the structure works. It does not implement Resource, Budget, Policy, settlement, database authority, SDK, or Cloud behavior.

### Features

#### `001-repository-layout`

**Status:** **COMPLETE**

**Deliverable:** Create the six code and documentation ownership areas below. Add a short README to each area and a private placeholder manifest only where a TypeScript workspace requires one. Add a minimal root `.gitignore` and the approved Apache-2.0 `LICENSE`; root configuration and `.github/` infrastructure do not become additional ownership areas.

```text
packages/       # Namespace for product code; not an ownership boundary
├── contracts/  # Future logical contracts and canonical fixtures
├── database/   # Future authority SQL, migrations, and distribution
├── sdk/        # Sole TypeScript SDK and private local PGlite adapter
└── cloud/      # Private TypeScript Cloud service
scripts/    # Root-owned repository automation
docs/       # Product, architecture, roadmap, ADRs, and guides
```

**Acceptance evidence:** Repository inspection confirms that all six areas exist, each has one documented owner and responsibility, package manifests are private, generated and dependency outputs are ignored, the license is Apache-2.0, and no placeholder claims implemented behavior.

#### `002-typescript-workspace-bootstrap`

**Status:** **COMPLETE**

**Deliverable:** Add a root `package.json`, `pnpm-workspace.yaml`, Turborepo configuration, a committed pnpm lockfile, and exact Node.js and pnpm contributor pins. The workspace discovers the private `packages/sdk/` and `packages/cloud/` shells without creating a package for contracts, database sources, scripts, or verification.

**Acceptance evidence:** A clean checkout installs from lockfiles, discovers both workspaces, type-checks both nonfunctional shells through Turborepo, leaves the lockfile unchanged, and fails clearly when a required tool version is unsupported.

#### `003-module-ownership-boundaries`

**Status:** **COMPLETE**

**Deliverable:** Record the code architecture in repository-owned ADRs and boundary READMEs. `packages/contracts/` owns logical interface sources; `packages/database/` owns the future authority core and later PostgreSQL distribution; `packages/sdk/` owns the TypeScript call surface and private PGlite lifecycle; `packages/cloud/` owns managed transport and operations; `scripts/` owns repository automation; and `docs/` owns product, architecture, sequencing, and decisions. `packages/` is only a code namespace.

**Acceptance evidence:** An architecture review maps every deliverable component from `architecture.md` to exactly one primary code boundary, identifies its public entry points and private internals, and finds no unowned semantic responsibility or competing Budget implementation.

#### `004-dependency-direction-enforcement`

**Status:** **COMPLETE**

**Deliverable:** Define and enforce a small acyclic dependency graph. Workspace manifests declare package access, pnpm rejects dependency cycles, and Turborepo rejects undeclared or cross-package imports. The SDK, Cloud service, and future database implementation may consume contracts; production workspaces never import from `scripts/`, owner-local tests, or each other's private internals.

**Acceptance evidence:** `pnpm check:deps` runs Turborepo's native boundary check, the workspace configuration rejects dependency cycles, and package manifests are the explicit authority for package access.

#### `005-root-engineering-commands`

**Status:** **COMPLETE**

**Deliverable:** Provide root commands for format, lint, type-check, test, dependency checks, and complete local verification. Turborepo orders workspace work; Oxfmt, Oxlint, `tsc`, and Vitest perform the owner-local checks. Epic 000 does not define an emitted build artifact or module format.

**Acceptance evidence:** Each command succeeds on a clean checkout and reports the expected pinned tool. Native tool failures preserve a nonzero aggregate exit.

#### `006-colocated-test-baseline`

**Status:** **COMPLETE**

**Deliverable:** Keep tests beside the workspace or script that owns the checked behavior. Epic 000 adds only Vitest smoke tests for the two nonfunctional TypeScript shells because it contains no custom script behavior. Do not create empty conformance, security, performance, compatibility, packaging, or fault-injection suites.

**Acceptance evidence:** Vitest discovers one honest smoke test for each shell, and no test claims Keynes runtime, host, security, compatibility, or performance coverage.

#### `007-quality-and-ci-baseline`

**Status:** **COMPLETE**

**Deliverable:** Run frozen installation, formatting, linting, type checking, owner-local tests, and dependency checks in continuous integration. Pin CI actions, grant least privilege, and keep the workflow credential-free.

**Acceptance evidence:** The same aggregate command passes locally and in CI from a clean checkout, lockfile drift is visible, every required failure blocks the workflow, and no credentials, database, PGlite runtime, or provider are required.

**Exit gate:** A clean checkout bootstraps and type-checks every workspace, enforces the basic dependency rules, and passes Oxfmt, Oxlint, `tsc`, Vitest, and the same Turborepo aggregate locally and in CI. No Keynes functional behavior, generated contract system, PostgreSQL package, cross-host suite, or evidence-promotion system is present. **PASSED**. The local portion passed on August 21, 2026 with Node.js 24.19.0 and pnpm 11.21.0. The GitHub Actions portion passed for commit `c1b61f37ced971b02ddc31b9ce8d171b09a5748b` in [Verify run 32539891232](https://github.com/shubsharan/keynes/actions/runs/32539891232). The later move of all product-code boundaries under `packages/` passed frozen bootstrap and the full local baseline on August 21, 2026. CI for that uncommitted amendment is **NOT RUN**.

## `100-contract-foundation`

**Status:** **NOT RUN**

**Outcome:** Establish the versioned sources from which every database host, the public SQL interface, the TypeScript SDK, and conformance fixtures are derived.

**Dependencies:** `000-repository-and-code-architecture`.

### Features

#### `101-versioned-json-contracts`

**Status:** **NOT RUN**

**Deliverable:** Versioned JSON Schema 2020-12 documents for Resource types, Budgets, commands, results, errors, events, Policy envelopes, and public read projections. The schemas define safe integers, required fields, tagged unions, normalized identifiers, canonical key ordering, and digest domain separation.

**Acceptance evidence:** Valid and invalid fixture suites prove every schema boundary, unknown fields fail explicitly, equivalent values canonicalize identically, and the TypeScript SDK and public SQL interface preserve exact values through round trips.

#### `102-procedure-manifest`

**Status:** **NOT RUN**

**Deliverable:** A versioned manifest that binds each public operation to its SQL name, input and output contracts, authorization class, transaction behavior, replay behavior, and stable result or error families.

**Acceptance evidence:** Automated checks prove that every public procedure, generated wrapper, TypeScript SDK operation, and fixture references one manifest entry and that no manifest operation lacks an implementation target.

#### `103-authority-migration-graph`

**Status:** **NOT RUN**

**Deliverable:** One ordered migration graph for `keynes_internal`, the versioned `keynes_v1` interface, public read views, roles, Policy dependencies, and migration metadata.

**Acceptance evidence:** Fresh installation and forward migration succeed on every supported PostgreSQL and PGlite version, object digests match the graph, and immutable command or event meaning is never rewritten.

#### `104-contract-generation`

**Status:** **NOT RUN**

**Deliverable:** Root-owned scripts under `scripts/` reproducibly generate TypeScript types and runtime validators, PostgreSQL wrappers, SQL API documentation, public object manifests, and canonical conformance fixtures. Generation is build-time automation, not a published package or production dependency.

**Acceptance evidence:** A clean regeneration produces no diff, generated artifacts embed the expected contract digest, and the TypeScript SDK and database wrappers pass the same generated valid and invalid cases.

#### `105-conformance-case-contract`

**Status:** **NOT RUN**

**Deliverable:** Define the host-neutral case format, canonical comparison rules, and host-adapter contract. Store canonical fixtures with their owning contracts; each later host epic implements and tests its adapter beside that host.

**Acceptance evidence:** Contract tests prove that cases identify canonical inputs and expected outputs and that comparison excludes row identifiers, query plans, timestamps, and operational metadata. No empty cross-host suite or host result is created.

**Exit gate:** Generated artifacts, installed database objects, canonical fixtures, and embedded digests agree exactly. The case and adapter contracts are ready for each real host without claiming cross-host execution. **NOT RUN**.

## `200-authority-core`

**Status:** **NOT RUN**

**Outcome:** Implement the default parent-funded Budget lifecycle once in the PostgreSQL authority core.

**Dependencies:** `100-contract-foundation`.

### Features

#### `201-resource-type-publication`

**Status:** **NOT RUN**

**Deliverable:** `keynes_v1.publish_resource_type` publishes an immutable, tenant-scoped Resource type with stable identity, canonical name, application-defined unit, accounting behavior, and definition digest. Publication creates no quantity or Budget authority.

**Acceptance evidence:** Fixtures prove idempotent republication, conflicting-definition rejection, tenant-scoped names, immutable definitions, safe-integer boundaries, and the absence of quantity changes.

#### `202-root-budget-allocation`

**Status:** **NOT RUN**

**Deliverable:** `keynes_v1.create_budget` creates an authorized root Budget containing quantities of selected published Resource types, independently from Resource publication permission.

**Acceptance evidence:** Tests prove authorization separation, rejection of unpublished Resource types, support for strict subsets of published types, arithmetic bounds, replay, rollback, and canonical creation evidence.

#### `203-scalar-resource-request`

**Status:** **NOT RUN**

**Deliverable:** `keynes_v1.request` atomically denies a request or reserves one exact Resource envelope from the structural parent and creates one child Budget. The default contract contains no issuance source or funding legs.

**Acceptance evidence:** Tests prove exact-envelope behavior, availability checks, parent locking, sibling serialization, no partial reservation, local child Policies defaulting canonically to an empty set, and rejection of unsupported source, funding-leg, and issuance fields without mutation.

#### `204-settlement-accounting`

**Status:** **NOT RUN**

**Deliverable:** `keynes_v1.settle` records monotone direct usage, seals direct requests, derives subtree usage and lifecycle, returns reusable Resources at the correct boundary, preserves unresolved usage, and records isolated deficits.

**Acceptance evidence:** Tests cover nested settlement, open descendants, consumable depletion, reusable release, missing usage, later resolution, overage, conflicting known usage, and rollback at every failure point.

#### `205-command-replay`

**Status:** **NOT RUN**

**Deliverable:** Canonical command identities and body digests bind a command to its tenant or local runtime, target, operation, and committed result.

**Acceptance evidence:** Tests prove exact replay, conflicting command reuse, invocation-scoped local retries, durable retry across process boundaries, and resolution of a committed response lost after commit.

#### `206-canonical-evidence`

**Status:** **NOT RUN**

**Deliverable:** An ordered immutable event ledger records Resource publication and Budget transitions without treating traces, timestamps, query plans, or infrastructure metadata as semantic inputs.

**Acceptance evidence:** Fixtures prove stable ordering, canonical payloads and digests, complete transition coverage, replay consistency, and unchanged evidence after failed or rolled-back commands.

#### `207-public-reads-and-errors`

**Status:** **NOT RUN**

**Deliverable:** `keynes_v1.get_budget`, `keynes_v1.list_events`, public read projections, valid domain results, and generated structured errors expose stable logical state without private storage details.

**Acceptance evidence:** Tests prove projection consistency, authorization checks, stable result and error codes, explicit unknown transport outcomes, arithmetic failures, and independence from host-specific database or transport text.

**Exit gate:** Conservation, concurrency, settlement, replay, rollback, overflow, and evidence invariants pass against the authority core. **NOT RUN**.

## `300-policy-system`

**Status:** **NOT RUN**

**Outcome:** Add deterministic Resource Policy authoring and execution without granting Policies access to general database state or application workflow decisions.

**Dependencies:** `100-contract-foundation` and `200-authority-core`.

### Features

#### `301-policy-contract`

**Status:** **NOT RUN**

**Deliverable:** An immutable Policy envelope defines stable identity, typed context and Resource schemas, one read-only SQL query, stable reason codes, Policy view and SQL profile versions, and a source digest.

**Acceptance evidence:** Fixtures prove canonical publication inputs, immutable versions, explicit schema validation, deterministic reason representation, and revalidation when any bound version or digest changes.

#### `302-command-scoped-policy-views`

**Status:** **NOT RUN**

**Deliverable:** `keynes_policy_request`, `keynes_policy_context`, and `keynes_policy_budget` expose only the exact request Resources, immutable typed context, and parent holdings required for one decision.

**Acceptance evidence:** Tests prove snapshot consistency, required context validation, no context propagation to children, and denial of access to base tables, catalogs, history, unrelated requests, application tables, and secrets.

#### `303-sql-policy-sandbox`

**Status:** **NOT RUN**

**Deliverable:** Publication and execution enforce one read-only `SELECT`, allowlisted views, functions, operators, casts, and collations, deterministic behavior, dependency binding, resource limits, and fail-closed errors.

**Acceptance evidence:** Adversarial suites cover DML, DDL, recursive SQL, catalog access, extension loading, nondeterministic functions, unsafe casts, excessive work, excessive output, malformed results, and sandbox dependency drift on every host.

#### `304-policy-publication-and-activation`

**Status:** **NOT RUN**

**Deliverable:** `keynes_v1.publish_policy` validates immutable candidates, and `keynes_v1.activate_policy` replaces the complete active set only when the expected Policy revision matches.

**Acceptance evidence:** Tests prove publication is separate from activation, concurrent revision conflicts fail without mutation, multiple Policies intersect by Resource, stable reasons are ordered canonically, and Policy errors never become denials.

#### `305-typed-policy-builder`

**Status:** **NOT RUN**

**Deliverable:** The generated TypeScript SDK provides a typed relational builder over declared Resource and context fields while retaining raw SQL as an explicit lower-level escape hatch.

**Acceptance evidence:** Compile-time fixtures prove field and type safety, and runtime fixtures prove builder-generated SQL and equivalent raw SQL produce the same canonical Policy envelope and authoritative result.

#### `306-request-explanation`

**Status:** **NOT RUN**

**Deliverable:** `keynes_v1.explain_request` reports validation, observed Budget and Policy revisions, availability, ceilings, and stable reasons without reserving Resources or producing reusable authority.

**Acceptance evidence:** Tests prove explanation is advisory, creates no command identity or evidence, cannot be supplied as approval, observes one transaction snapshot, and can differ safely from a later committed request.

**Exit gate:** Typed and raw SQL Policies produce canonical-equivalent results, while escape attempts, invalid results, dependency drift, and resource exhaustion fail safely on every host. **NOT RUN**.

## `400-local-pglite`

**Status:** **NOT RUN**

**Outcome:** Deliver the zero-service TypeScript experience through a private, process-scoped PGlite authority.

**Dependencies:** `100-contract-foundation`, `200-authority-core`, and `300-policy-system`.

### Features

#### `401-private-pglite-runtime`

**Status:** **NOT RUN**

**Deliverable:** `Keynes.local()` creates one private in-memory PGlite instance, migrates it before use, exposes no database handle, opens no network port, and requires no account, daemon, native Keynes library, or separately installed database.

**Acceptance evidence:** Tests prove isolation between runtimes, fresh migration at startup, complete state loss at process exit, and rejection of file paths or caller-owned connections.

#### `402-typescript-budget-api`

**Status:** **NOT RUN**

**Deliverable:** A typed TypeScript API exposes Resource publication, root creation, `budget.request(...)`, approved child Budget handles, `budget.settle(...)`, Policy management, and evidence reads without database vocabulary in the happy path.

**Acceptance evidence:** Type and runtime tests prove exact Resource names and safe integers, approved and denied result narrowing, child-local Policies, settlement through the authorized Budget handle, and no generic identifier-only local settlement API.

#### `403-local-lifecycle-and-serialization`

**Status:** **NOT RUN**

**Deliverable:** The SDK serializes mutations, generates one command identity per public invocation, and reuses it only for a transparent retry of that invocation.

**Acceptance evidence:** Concurrent-call tests prove deterministic mutation order, separate identical calls remain distinct, retries do not duplicate children, closing a runtime rejects later use, and no local identifier rehydrates authority in another runtime.

#### `404-local-package-assets`

**Status:** **NOT RUN**

**Deliverable:** The npm package contains the TypeScript SDK, pinned PGlite and WebAssembly assets, signed migration bundle, contracts, and required generated artifacts.

**Acceptance evidence:** Package inspection proves the expected assets and digests are present, installation needs no postinstall daemon or native Keynes binary, supported bundlers load the assets, and unsupported environments fail explicitly.

#### `405-local-runtime-qualification`

**Status:** **NOT RUN**

**Deliverable:** A repeatable benchmark and compatibility suite measures package download and installed size, loaded memory, runtime creation, first request, steady-state throughput, and procedure overhead from released artifacts.

**Acceptance evidence:** Retained results identify exact package, PGlite, WebAssembly, Node.js, operating-system, and architecture versions. Documentation makes no footprint or latency claim beyond those measurements.

**Exit gate:** The complete Budget and Policy workflow passes locally, unsupported persistence inputs are rejected, lifecycle behavior is proven, and every footprint or performance claim has retained measurements. **NOT RUN**.

## `500-customer-postgresql`

**Status:** **NOT RUN**

**Outcome:** Deliver durable customer-owned Budget authority through supported PostgreSQL installation and transaction composition.

**Dependencies:** `100-contract-foundation`, `200-authority-core`, and `300-policy-system`.

### Features

#### `501-signed-bundle-installer`

**Status:** **NOT RUN**

**Deliverable:** An installer verifies artifact signatures, migration and contract digests, PostgreSQL compatibility, build options, required privileges, and owned-object drift before applying the canonical bundle under an installation lock. This feature creates the PostgreSQL distribution area under `packages/database/`; Epic 000 does not scaffold it.

**Acceptance evidence:** Installation tests cover fresh setup, interrupted setup, privilege failures, incompatible versions, altered artifacts, concurrent installers, drift detection, and post-install object digest verification.

#### `502-generated-extension-distribution`

**Status:** **NOT RUN**

**Deliverable:** A generated non-relocatable SQL-only extension maps each extension version to exactly one canonical migration-graph version and fixed Keynes schemas.

**Acceptance evidence:** Bundle and extension installations produce the same public object manifest, roles, procedures, views, canonical fixtures, and upgrade outcomes without hand-maintained extension SQL.

#### `503-role-and-tenant-security`

**Status:** **NOT RUN**

**Deliverable:** Separate owner, Resource publisher, root allocator, executor, reader, and Policy administrator roles bind authenticated principals to tenants inside every public operation.

**Acceptance evidence:** Tests prove least privilege, tenant isolation, fixed `search_path`, schema-qualified `SECURITY DEFINER` behavior, private-schema denial, cross-tenant identifier rejection, and separation of publication, allocation, execution, reading, and Policy authority.

#### `504-transaction-composition`

**Status:** **NOT RUN**

**Deliverable:** The generated TypeScript adapter supports SDK-owned and caller-owned transactions, including atomic request plus application job or outbox insertion. An approved child remains pending until the caller-owned transaction commits.

**Acceptance evidence:** Tests prove commit and rollback behavior, request-plus-outbox atomicity, lost-response replay, prevention of pre-commit external use through SDK types, and no ownership of the application's connection pool.

#### `505-public-views-and-diagnostics`

**Status:** **NOT RUN**

**Deliverable:** Tenant-scoped `keynes_v1` views expose stable Resource, Budget, Policy, command, and event projections for joins, audit, diagnostics, BI, and change-data capture. Diagnostic views expose operations without private rows or secrets.

**Acceptance evidence:** Tests prove projection correctness, tenant isolation, reader permissions, stable view compatibility, private-field omission, replica labeling, and acceptable measured query cost.

#### `506-upgrades-drift-and-recovery`

**Status:** **NOT RUN**

**Deliverable:** Expand-contract migrations support explicit compatibility windows, detect drift, export signed checkpoints, fence former writers, and require reconciliation after restore or potentially lossy failover.

**Acceptance evidence:** Tests cover every supported starting version, old and new public schemas in parallel, prohibited destructive contraction, drifted installations, backup restore, new authority epochs, mutation blocking in `recovery_required`, and unresolved evidence after an unreconstructable interval.

**Exit gate:** Bundle and extension installations have identical public objects and semantics. Role isolation, direct SQL use, transaction rollback, compatibility windows, upgrades, drift handling, and operator recovery pass. **NOT RUN**.

## `600-managed-cloud`

**Status:** **NOT RUN**

**Outcome:** Deliver hosted durable authority without duplicating Budget accounting or Policy evaluation outside PostgreSQL.

**Dependencies:** `100-contract-foundation`, `200-authority-core`, `300-policy-system`, and the durable-host contracts established by `500-customer-postgresql`.

### Features

#### `601-versioned-rpc-transport`

**Status:** **NOT RUN**

**Deliverable:** A private TypeScript service maps authenticated TypeScript SDK requests to the shared procedures and returns generated structured results and errors.

**Acceptance evidence:** Contract tests prove protocol negotiation, request validation, canonical body preservation, stable error translation, no arbitrary client SQL, and no alternate Budget transition logic in the service.

#### `602-authentication-and-tenant-routing`

**Status:** **NOT RUN**

**Deliverable:** Cloud authenticates applications and authorizes tenant access, Resource publication, root allocation, Budget commands, Policy administration, and reads before invoking the authority core.

**Acceptance evidence:** Security tests prove tenant isolation, authorization-class separation, forged identifier rejection, credential rotation, rate and size limits, auditability, and database-role enforcement beneath the service boundary.

#### `603-lineage-home-routing`

**Status:** **NOT RUN**

**Deliverable:** Each durable Budget lineage has one writable home database, and Cloud routes every mutation using fenced placement metadata checked again inside the authority transaction.

**Acceptance evidence:** Tests prove correct routing, stale-router rejection, one-writer behavior, lineage movement, hot-parent contention, read-replica labeling, and rejection of default commands that attempt cross-lineage authority composition.

#### `604-durable-idempotency-and-retries`

**Status:** **NOT RUN**

**Deliverable:** Durable caller keys and command identities bind the tenant, target, operation, canonical body digest, and committed result across network and process boundaries.

**Acceptance evidence:** Fault-injection tests cover safe transaction retries, dropped responses before and after commit, repeated caller keys, body conflicts, service restarts, concurrent retries, and exact committed-result replay.

#### `605-authority-fencing-and-recovery`

**Status:** **NOT RUN**

**Deliverable:** Monotone authority epochs, external fencing records, immutable recovery checkpoints, writer promotion, and fail-closed reconciliation protect durable authority during failover and restore.

**Acceptance evidence:** Forced-failure tests prove stale writers cannot mutate, promotions change epochs before routing, restored databases reject mutations, reconciliation uses evidence outside the restored failure domain, and irrecoverable gaps remain frozen or unresolved.

#### `606-cloud-observability-and-operations`

**Status:** **NOT RUN**

**Deliverable:** Cloud supplies metrics, tracing, administrative APIs, backup, rolling migration, incident response, vulnerability response, and support procedures without making telemetry part of canonical semantics.

**Acceptance evidence:** Operational exercises cover alerts, checkpoint lag, lock waits, Policy failures, deficits, migration state, backup restoration, credential and artifact rotation, incident containment, rolling deployment, and secret-free telemetry.

**Exit gate:** Multi-instance Cloud operation passes tenant isolation, replay, routing, fencing, failover, restore, rolling deployment, security operations, and incident-response qualification. **NOT RUN**.

## `700-v1-release-qualification`

**Status:** **NOT RUN**

**Outcome:** Qualify the complete V1 across the TypeScript SDK, public SQL interface, supported hosts, installation forms, and operational profiles.

**Dependencies:** `000-repository-and-code-architecture` through `600-managed-cloud`.

### Features

#### `701-cross-host-semantic-conformance`

**Status:** **NOT RUN**

**Deliverable:** Create `tests/conformance/` after the real host adapters exist, then run the shared semantic corpus against local PGlite, bundle-installed customer PostgreSQL, extension-installed customer PostgreSQL, and managed Cloud.

**Acceptance evidence:** Canonical results, events, errors, reasons, blockers, and digests match across all four paths for Resource publication, root creation, request, Policy, settlement, replay, rollback, and unsupported inputs.

#### `702-policy-security-qualification`

**Status:** **NOT RUN**

**Deliverable:** A threat-driven Policy suite qualifies validation, dependency binding, deterministic execution, view isolation, and resource limits for every host.

**Acceptance evidence:** Retained adversarial results cover syntax and semantic escapes, forbidden objects and functions, nondeterminism, malformed results, timeout, recursion, memory, row, and byte limits, plus fail-closed behavior under host failure.

#### `703-concurrency-and-recovery-qualification`

**Status:** **NOT RUN**

**Deliverable:** A fault and concurrency suite qualifies sibling reservations, lock ordering, retries, authority placement, failover, and recovery.

**Acceptance evidence:** Retained runs cover true concurrent callers, hot parents, deadlock and serialization handling, stale writers, replica reads, lineage movement, process crashes, point-in-time restore, evidence gaps, and recovery fencing.

#### `704-contract-and-sdk-compatibility`

**Status:** **NOT RUN**

**Deliverable:** Compatibility suites qualify public SQL schemas, the TypeScript SDK, validators, wrappers, contract digests, and supported coexistence windows.

**Acceptance evidence:** Supported old and new clients preserve their declared meaning, incompatible digests fail explicitly, additive changes remain compatible, breaking changes use a new public schema, and direct SQL and SDK callers observe the same committed results.

#### `705-packaging-and-performance`

**Status:** **NOT RUN**

**Deliverable:** Released artifacts are tested and measured across the supported PostgreSQL, PGlite, Node.js, operating-system, architecture, and managed-provider matrix.

**Acceptance evidence:** Retained measurements cover download and installed size, memory, startup, first request, throughput, contention, procedure and public-view overhead, installation, upgrade, and lock time for the exact released artifacts.

#### `706-operational-release-readiness`

**Status:** **NOT RUN**

**Deliverable:** Release procedures define supported versions, artifact signing, software bills of materials, vulnerability response, migration, backup, recovery, incident response, customer responsibilities, and support boundaries.

**Acceptance evidence:** Reviewed operational exercises and release records prove authentication, tenant isolation, key rotation, backup restoration, recovery reconciliation, rolling migration, incident handling, artifact provenance, and support escalation without forking the authority core.

**Exit gate:** No host claims compatibility, security, performance, or production readiness until its corresponding evidence is retained and reviewed. V1 releases only when all required host, TypeScript SDK, public SQL, package, and operational evidence passes. **NOT RUN**.

## `800-subtree-issuance`

**Status:** **NOT RUN**

**Outcome:** Introduce authorized quantity issuance within one child subtree without changing the scalar parent-funded request.

**Dependencies:** `700-v1-release-qualification`.

### Features

#### `801-versioned-issuance-contract`

**Status:** **NOT RUN**

**Deliverable:** A separate versioned command introduces subtree issuance without adding optional issuance fields to the v1 scalar request shape.

**Acceptance evidence:** Contract tests prove old callers retain exact parent-funded semantics, unsupported versions fail explicitly, and the TypeScript SDK exposes issuance only when the installed contract supports it.

#### `802-issuer-authorization`

**Status:** **NOT RUN**

**Deliverable:** Issuer permission binds the authorized principal, existing Resource type, target subtree, quantity, scope, and lifetime independently from ordinary executor and root allocator authority.

**Acceptance evidence:** Tests prove least privilege, tenant and subtree isolation, published-type requirements, arithmetic bounds, replay, and rejection of unauthorized or ambiguous issuance without mutation.

#### `803-issuance-accounting-and-recovery`

**Status:** **NOT RUN**

**Deliverable:** Issued quantity retains explicit provenance and participates in conservation, request, settlement, evidence, replay, authority epochs, and recovery reconciliation.

**Acceptance evidence:** Tests cover nested delegation, consumable and reusable behavior, unresolved usage, deficits, lost responses, failover, restore, and prevention of silent reissuance after evidence loss.

#### `804-issuance-conformance`

**Status:** **NOT RUN**

**Deliverable:** The shared corpus and migrations cover issuance on every supported host, the TypeScript SDK, and the public SQL interface.

**Acceptance evidence:** Supported hosts produce matching canonical outcomes, while v1 and unsupported hosts reject issuance fields and commands without changing Resource types, Budgets, commands, or evidence.

**Exit gate:** Issuance has complete authorization, conservation, settlement, replay, migration, recovery, and cross-host evidence before release. **NOT RUN**.

## `900-multi-source-funding`

**Status:** **NOT RUN**

**Outcome:** Add same-database multi-source funding while preserving one structural parent and the scalar parent-funded default.

**Dependencies:** `800-subtree-issuance`.

### Features

#### `901-versioned-funding-contract`

**Status:** **NOT RUN**

**Deliverable:** A separate versioned command adds ordered funding legs while retaining one structural parent and leaving the scalar v1 request unchanged.

**Acceptance evidence:** Contract tests prove deterministic leg ordering, exact Resource envelopes, explicit versions, old-caller compatibility, and rejection by installations that do not advertise the capability.

#### `902-source-authorization-and-policy-isolation`

**Status:** **NOT RUN**

**Deliverable:** Every contributing Budget is independently authorized, locked, checked for availability, and evaluated under its own local Policies and immutable command snapshot.

**Acceptance evidence:** Tests prove tenant and lineage rules, source permission, Policy isolation, expected revisions, deterministic lock ordering, and no inference of authority from a Budget identifier.

#### `903-atomic-funding-and-provenance`

**Status:** **NOT RUN**

**Deliverable:** The authority core reserves all ordered contributions and creates the child in one transaction while retaining funding, settlement, replay, and evidence provenance.

**Acceptance evidence:** Tests cover full commit, rollback of every leg, concurrent source changes, replay, consumable and reusable settlement, unresolved usage, deficits, and canonical per-source evidence.

#### `904-cross-database-rejection`

**Status:** **NOT RUN**

**Deliverable:** Validation rejects any funding plan whose structural parent or contributing Budget does not belong to the same authority database and compatible authority epoch.

**Acceptance evidence:** Routing and database tests prove rejection occurs before locks or mutation, no partial reservation or evidence is written, and Cloud never simulates cross-database atomicity through service orchestration.

#### `905-funding-compatibility-and-conformance`

**Status:** **NOT RUN**

**Deliverable:** Generated contracts, the TypeScript SDK, migrations, shared fixtures, and operational procedures qualify multi-source funding without changing scalar requests for callers that do not adopt it.

**Acceptance evidence:** All supported hosts produce matching canonical results under concurrency, failure, replay, migration, settlement, and recovery, while legacy clients continue to observe the original parent-funded behavior.

**Exit gate:** Atomicity, authorization, Policy isolation, replay, settlement, provenance, recovery, migration, compatibility, and cross-database rejection have executable evidence before release. **NOT RUN**.

## Roadmap rules

- Keep `Budget` as the only public stateful governance object.
- Keep Resource publication separate from quantity creation and root allocation.
- Keep the default request exact, scalar, and entirely funded by its structural parent.
- Keep Policies optional, local to one Budget, deterministic, read-only, and limited to Resource ceilings.
- Keep request context immutable, typed, application-asserted, recorded as evidence, and absent from child inheritance.
- Keep application effects, provider retries, usage observation, outcomes, and fallback behavior outside Keynes.
- Keep missing usage and overage visible through unresolved accounting and isolated deficits.
- Treat PGlite, customer PostgreSQL, and managed Cloud as hosts of one PostgreSQL authority core, not independent semantic implementations.
- Introduce subtree issuance before multi-source funding, and introduce both through explicit versioned contracts.
- Complete `000-repository-and-code-architecture` before starting contract, authority, Policy, SDK, deployment, or Cloud functionality.
- Mark an epic complete only when every feature and its exit gate pass with retained executable evidence.
- Use dependency and evidence status instead of invented dates, staffing estimates, or unsupported readiness claims.
