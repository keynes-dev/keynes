# Keynes implementation roadmap

> **Status:** This roadmap defines the target implementation sequence. Unless a section records completed evidence, every stage, feature, exit gate, runtime check, security check, performance measurement, packaging check, and conformance check is **NOT RUN**.

This roadmap turns the target [product](product.md) and [architecture](architecture.md) into dependency-ordered implementation work. It uses evidence gates instead of calendar promises. A feature is complete only when its deliverable exists and its acceptance evidence passes. A stage is complete only when all of its features and its exit gate pass.

The implementation preserves one product loop:

```text
Budget -> request -> child Budget -> settle -> evidence
```

Features receive globally unique, four-digit numbers when Spec Kit starts them. Stages do not have numbers, branches, templates, or separate artifacts. They group related features around one outcome and exit gate.

After that baseline, Keynes follows one evidence path:

```text
repository baseline
  -> executable database and platform gate
  -> local workflow preview and product-value gate
  -> one selected durable-profile preview
  -> explicit release contract and production qualification
```

A preview can produce real integration evidence, but it claims only the hosts and capabilities that passed their gates. A preview does not claim production readiness. Each stage coordinates a delivery decision and its evidence. The code ownership boundaries in the architecture remain unchanged.

## Repository baseline

**Status:** **COMPLETE**

**Outcome:** Establish a lean TypeScript and SQL repository, explicit ownership, basic dependency rules, and one local and CI engineering baseline before implementing Keynes behavior.

**Dependencies:** None.

This stage creates structure and proof that the structure works. It does not implement Resource, Budget, Policy, settlement, database authority, SDK, or Cloud behavior.

### [FEAT-0001: Repository and code architecture](features/0001-repository-and-code-architecture/spec.md)

#### Repository layout

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

#### TypeScript workspace bootstrap

**Status:** **COMPLETE**

**Deliverable:** Add a root `package.json`, `pnpm-workspace.yaml`, Turborepo configuration, a committed pnpm lockfile, and exact Node.js and pnpm contributor pins. The workspace discovers the private `packages/sdk/` and `packages/cloud/` shells without creating a package for contracts, database sources, scripts, or verification.

**Acceptance evidence:** A clean checkout installs from lockfiles, discovers both workspaces, type-checks both nonfunctional shells through Turborepo, leaves the lockfile unchanged, and fails clearly when a required tool version is unsupported.

#### Module ownership boundaries

**Status:** **COMPLETE**

**Deliverable:** Record the code architecture in repository-owned ADRs and boundary READMEs. `packages/contracts/` owns logical interface sources; `packages/database/` owns the future database core and later PostgreSQL distribution; `packages/sdk/` owns the TypeScript call surface and private PGlite lifecycle; `packages/cloud/` owns managed transport and operations; `scripts/` owns repository automation; and `docs/` owns product, architecture, sequencing, and decisions. `packages/` is only a code namespace.

**Acceptance evidence:** An architecture review maps every deliverable component from `architecture.md` to exactly one primary code boundary, identifies its public entry points and private internals, and finds no unowned semantic responsibility or competing Budget implementation.

#### Dependency direction enforcement

**Status:** **COMPLETE**

**Deliverable:** Define and enforce a small acyclic dependency graph. Workspace manifests declare package access, pnpm rejects dependency cycles, and Turborepo rejects undeclared or cross-package imports. The SDK, Cloud service, and future database implementation may consume contracts; production workspaces never import from `scripts/`, owner-local tests, or each other's private internals.

**Acceptance evidence:** `pnpm check:deps` runs Turborepo's native boundary check, the workspace configuration rejects dependency cycles, and package manifests are the explicit authority for package access.

#### Root engineering commands

**Status:** **COMPLETE**

**Deliverable:** Provide root commands for format, lint, type-check, test, dependency checks, and complete local verification. Turborepo orders workspace work; Oxfmt, Oxlint, `tsc`, and Vitest perform the owner-local checks. This stage does not define an emitted build artifact or module format.

**Acceptance evidence:** Each command succeeds on a clean checkout and reports the expected pinned tool. Native tool failures preserve a nonzero aggregate exit.

#### Colocated test baseline

**Status:** **COMPLETE**

**Deliverable:** Keep tests beside the workspace or script that owns the checked behavior. FEAT-0001 adds only Vitest smoke tests for the two nonfunctional TypeScript shells because it contains no custom script behavior. Do not create empty conformance, security, performance, compatibility, packaging, or fault-injection suites.

**Acceptance evidence:** Vitest discovers one honest smoke test for each shell, and no test claims Keynes runtime, host, security, compatibility, or performance coverage.

#### Quality and CI baseline

**Status:** **COMPLETE**

**Deliverable:** Run frozen installation, formatting, linting, type checking, owner-local tests, and dependency checks in continuous integration. Pin CI actions, grant least privilege, and keep the workflow credential-free.

**Acceptance evidence:** The same aggregate command passes locally and in CI from a clean checkout, lockfile drift is visible, every required failure blocks the workflow, and no credentials, database, PGlite runtime, or provider are required.

**Exit gate:** A clean checkout bootstraps and type-checks every workspace, enforces the basic dependency rules, and passes Oxfmt, Oxlint, `tsc`, Vitest, and the same Turborepo aggregate locally and in CI. No Keynes functional behavior, generated contract system, PostgreSQL package, cross-host suite, or evidence-promotion system is present. **PASSED**. The local portion passed on August 21, 2026 with Node.js 24.19.0 and pnpm 11.21.0. The GitHub Actions portion passed for commit `c1b61f37ced971b02ddc31b9ce8d171b09a5748b` in [Verify run 32539891232](https://github.com/shubsharan/keynes/actions/runs/32539891232). The later move of all product-code boundaries under `packages/` passed frozen bootstrap and the full local baseline on August 21, 2026. CI for that uncommitted amendment is **NOT RUN**.

## Executable database and platform gate

**Status:** **IN PROGRESS**

**Outcome:** Prove the smallest complete Budget lifecycle and the risky PostgreSQL and PGlite assumptions before packaging a public product.

**Dependencies:** Repository baseline.

This stage is a feasibility gate. It builds only the contracts and generated artifacts consumed by the executable slice. It does not build a general contract catalog, a released npm package, a customer installer, or a Cloud service.

### Features

#### [FEAT-0002: Executable Budget lifecycle](features/0002-executable-authority-slice/spec.md)

**Status:** **COMPLETE (PROVIDER-FREE)**

**Deliverable:** Define and implement one complete Budget lifecycle for Resource type definition, root allocation, exact parent-funded request, settlement, and `get_budget`. The read returns one Budget projection and its complete root-lineage history from the same transaction snapshot. One contract generates the TypeScript types and validators, PostgreSQL wrappers, migration metadata, expected target names, and digest consumed by the real procedures. Test fixtures remain direct inputs. Every mutation uses the same transaction path for validation, command replay, canonical results, transition evidence, and rollback.

**Acceptance evidence:** Every generated consumer identifies the same source and semantic digest, and every ordered operation resolves to a real procedure and generated client method. A clean regeneration produces no diff. Valid and invalid fixtures cover safe integers, normalized identifiers, tagged results, unknown fields, and canonical encoding. Behavioral tests cover definition conflicts, allocation authorization, conservation, sibling requests, exact approval and denial, arithmetic limits, nested settlement, consumable depletion, reusable release, open descendants, missing usage, later resolution, overage, conflicting known usage, and rollback at every failure point. Retry-after-commit tests resolve a lost response for every mutating procedure. No unused value family, wrapper, metadata copy, or procedure target is created.

**Observed evidence:** On August 23, 2026, `pnpm test:generator` passed 15 tests, and `pnpm --filter @keynes/sdk test` passed 40 tests. `pnpm generate:check` found no generated drift, and `pnpm verify` passed all six repository tasks. The generated five-method client completed the installed PGlite lifecycle. The database procedures own Budget semantics. Native PostgreSQL concurrency, roles, recovery, cross-host equivalence, packaging, Cloud, security, performance, paid services, and managed providers remain **NOT RUN**.

#### Policy platform feasibility

**Status:** **NOT RUN**

**Deliverable:** Implement the smallest public raw-SQL Policy lifecycle needed to test the platform. It includes immutable publication, compare-and-swap activation, command-scoped views, dependency binding, deterministic allowlists, bounded execution, and fail-closed results. Policy remains optional for each Budget.

**Acceptance evidence:** Tests cover concurrent Policy revision conflicts, dependency or validator drift, request-versus-activation concurrency, catalog and base-table access, DML, DDL, recursion, nondeterministic functions, unsafe casts, extension loading, excessive work and output, malformed results, and host failure. Policy errors never become approvals or denials. Fixture seeding does not replace the public publication and activation path.

#### Shared core platform gate

**Status:** **NOT RUN**

**Deliverable:** Run the same migrations, constraints, procedures, Policy environment, and canonical fixtures without semantic forks in private in-memory PGlite and native PostgreSQL. Build a non-released package artifact when a package measurement requires one.

**Acceptance evidence:** Both engines produce the same canonical values, results, errors, history entries, reasons, and digests for the complete slice. Native PostgreSQL tests prove real concurrent requests, request-versus-settlement locking, migration behavior, and the minimum role isolation required by the Policy sandbox. Retained measurements identify the exact artifact, Node.js, PGlite, WebAssembly, operating system, and processor architecture. The feature specification declares maximum package size, loaded RSS, runtime creation time, first-request latency, and steady-state latency before measurements run.

**Exit gate:** The database core passes unchanged on PGlite and native PostgreSQL within the predeclared footprint and latency limits. The gate records separate database and Policy decisions. A database failure stops the PostgreSQL and PGlite design. A Policy failure stops Policy support. Keynes may continue as a scalar Budget product only after the product and architecture explicitly adopt that narrower scope. **NOT RUN**.

## Local workflow preview

**Status:** **NOT RUN**

**Outcome:** Package the private local runtime and prove that one outside team keeps Keynes in a real workflow.

**Dependencies:** Executable database and platform gate.

This stage is the first product-value gate. It does not create durable Budget identity, customer PostgreSQL support, Cloud support, or a production-readiness claim.

### Features

#### Local runtime and SDK

**Status:** **NOT RUN**

**Deliverable:** `Keynes.local()` creates one private process-scoped PGlite database, migrates it before use, and exposes Resource type definition, root creation, `budget.request(...)`, settlement through authorized Budget handles, and evidence reads through the TypeScript SDK. It exposes no database handle, file path, caller-owned connection, network port, account, daemon, or native Keynes library. If the adopter needs Policy authoring, add only the typed relational builder operations required for its declared rule.

**Acceptance evidence:** Tests prove isolation between runtimes, deterministic mutation order, one command identity per public invocation, transparent retry without duplicate children, complete state loss at process exit, authorized-handle settlement, exact result narrowing, clean shutdown, and explicit failure after shutdown. Package inspection proves that supported bundlers load the pinned PGlite, WebAssembly, migration, contract, and generated assets. Any typed Policy operations reject unknown fields and invalid operations, embed compiler and source digests, emit canonical SQL, and match the equivalent raw SQL Policy. The public publication and activation path remains authoritative.

#### Adopter workflow evidence

**Status:** **NOT RUN**

**Deliverable:** A team outside the implementation team integrates the released preview into one named workflow. Before the trial, record the workflow owner, the observation period or sample, required approval and denial cases, the usage source, the settlement completion rule, the evidence review task, the maximum integration burden, and the adopter's continuation criterion.

**Acceptance evidence:** Retained runs show that the application requests an exact Resource envelope, responds to Keynes's authoritative result, owns any external effect, settles observed usage, and uses Keynes evidence in a real operating decision. The adopter confirms the predeclared continuation criterion. Record separate conclusions for accounting value and Policy value so optional Policy value does not stand in for accounting value.

**Exit gate:** The local packaged artifact stays within the limits established by the executable database and platform gate. The adopter keeps the integration under the predeclared criterion and demonstrates value from the request, settlement, and evidence loop. If this gate fails, do not start durable deployment work. **NOT RUN**.

## Selected durable-profile preview

**Status:** **NOT RUN**

**Outcome:** Select and qualify one durable deployment profile because the validated workflow needs it.

**Dependencies:** Local workflow preview.

This stage implements either customer PostgreSQL or managed Cloud. It does not implement both by default. The unselected profile remains **NOT RUN** and receives no compatibility, security, recovery, or readiness claim.

### Features

#### Durable profile selection

**Status:** **NOT RUN**

**Deliverable:** Record the adopter's durability requirement and select customer PostgreSQL or managed Cloud. Customer PostgreSQL requires evidence for customer data control, direct SQL, or atomic composition with application rows. Managed Cloud requires evidence for a hosted authority that the adopter will use instead of operating PostgreSQL.

**Acceptance evidence:** The decision names the adopter, workload, trust boundary, persistence need, integration constraint, expected support boundary, and profile-specific risk that can overturn the selection. If neither profile has a concrete need, the roadmap remains at the local preview.

#### Selected profile feasibility

**Status:** **NOT RUN**

**Deliverable:** Test the selected profile's security and transaction boundary before building its full package. The customer PostgreSQL branch tests bundle installation, principal and tenant role binding, caller-owned transactions, request plus application-row atomicity, drift, checkpoints, restore, and former-writer fencing. The managed Cloud branch tests authentication, tenant routing, one writable home per lineage, in-transaction epoch checks, stale-writer fencing, external checkpoints, restore into `recovery_required`, and unresolved evidence gaps.

**Acceptance evidence:** The selected branch passes its highest-risk security, transaction, and recovery cases with the adopter's environment or a faithful substitute. A failed case blocks profile packaging. The test does not defer an authority epoch, former-writer fence, fail-closed restore, external checkpoint, or unresolved-gap rule that protects durable authority.

#### Selected profile preview

**Status:** **NOT RUN**

**Deliverable:** Package the shared database core and generated interfaces for the selected durable profile. Customer PostgreSQL uses the signed migration bundle first. The SQL-only extension remains unimplemented unless the release contract later requires it. Managed Cloud starts with the smallest topology that satisfies the selected claim and keeps Budget transitions and Policy evaluation inside PostgreSQL.

**Acceptance evidence:** The selected profile passes the shared semantic corpus, its host-specific security and recovery suite, installation or deployment tests, lost-response replay, upgrade and rollback checks, and retained footprint and latency measurements. The same adopter completes the local workflow against the durable preview and chooses to keep it.

**Exit gate:** One durable profile has retained semantic, security, recovery, packaging, performance, and adopter evidence for its bounded preview claim. The other profile and any untested packaging form remain **NOT RUN**. The preview does not claim general production readiness. **NOT RUN**.

## Release contract and production qualification

**Status:** **NOT RUN**

**Outcome:** Resolve the release scope explicitly, complete every required host and package, and qualify the first production release without making claims broader than the evidence.

**Dependencies:** Selected durable-profile preview.

The current architecture requires local PGlite, bundle-installed customer PostgreSQL, extension-installed customer PostgreSQL, and managed Cloud to pass before a semantic change ships. A narrower release requires an accepted ADR that changes that rule. A roadmap edit or successful preview cannot change it by implication.

### Features

#### Release contract decision

**Status:** **NOT RUN**

**Deliverable:** Accept an ADR that either retains the current all-host and all-package release contract or defines release conformance over an explicit claimed-host and claimed-package set. Reconcile the product, architecture, and roadmap with that decision before release implementation continues.

**Acceptance evidence:** The accepted documents agree on the supported hosts, packaging forms, product capabilities, trust boundaries, conformance matrix, compatibility promise, and meaning of a production release. Every omitted profile or package is named as unsupported rather than left ambiguous.

#### Required host and package completion

**Status:** **NOT RUN**

**Deliverable:** Complete only the hosts and packaging forms required by the accepted release contract. If the current architecture remains unchanged, this includes local PGlite, the customer PostgreSQL bundle, the generated SQL-only extension, and managed Cloud. Every implementation calls the same database core and generated public contract.

**Acceptance evidence:** Each required path passes installation or deployment, upgrade, drift, role and tenant isolation, transaction composition when applicable, replay, recovery, and compatibility checks. Object and semantic digests match. No host adapter contains alternate Budget accounting or Policy evaluation.

#### Policy and public interface completion

**Status:** **NOT RUN**

**Deliverable:** Complete the typed Policy builder, raw-SQL Policy path, public SQL interface, TypeScript SDK, stable reads and errors, compatibility windows, and any advisory `explain_request` capability included by the accepted release contract.

**Acceptance evidence:** Builder-generated and raw SQL Policies pass the same database validation and produce canonical-equivalent results. Old and new supported clients preserve their declared meaning. Incompatible digests fail explicitly. Direct SQL and SDK callers observe the same committed results. Advisory explanations create no authority and cannot be used as approval.

#### Release qualification

**Status:** **NOT RUN**

**Deliverable:** Run the complete semantic, Policy-security, concurrency, recovery, compatibility, packaging, performance, and operational suites against every required host and package.

**Acceptance evidence:** Retained runs cover canonical results and history entries, sandbox attacks, true concurrent callers, settlement contention, lost responses, stale writers, failover, point-in-time restore, unresolved evidence, migrations, package contents, memory, startup, latency, upgrades, backup restoration, artifact provenance, vulnerability response, incident handling, and support responsibilities for the exact release artifacts.

**Exit gate:** Keynes releases only when every host, package, capability, SDK, SQL interface, security boundary, and operational claim in the accepted release contract has retained evidence. No untested profile contributes to a release claim. **NOT RUN**.

## Conditional growth

The items in this section are not scheduled stages. They do not block release only when the release contract decision omits them. Under the current architecture, the second durable profile and the SQL-only extension remain release requirements and move into required host and package completion. Move an item into a roadmap stage only after its entry evidence exists.

- **Second durable profile:** If the release contract decision permits a profile-scoped release, add the unselected customer PostgreSQL or managed Cloud profile when a named adopter has a non-substitutable need. Apply the full host-specific semantic, security, recovery, packaging, and operational gates.
- **Alternative PostgreSQL packaging:** If the release contract decision permits a package-scoped release, add the SQL-only extension when customer distribution or policy requires extension lifecycle management. Generate it from the canonical migration graph and prove bundle equivalence.
- **Operational and analysis tools:** Add broader diagnostics, BI and change-data-capture guidance, lineage movement, routing scale, or operational automation when repeated support or workload evidence identifies a specific need.
- **Subtree issuance:** Add a separate command only after an adopter needs authorized quantity creation within a child subtree. Prove authorization, conservation, settlement, replay, recovery, compatibility, and host conformance.
- **Multi-source funding:** Start only after subtree issuance qualifies and an adopter needs ordered contributions from several Budgets in one Keynes database. Preserve one structural parent, require same-database atomicity, and reject cross-database composition.

## Roadmap rules

- Keep `Budget` as the only public stateful governance object.
- Keep Resource type definition separate from quantity creation and root allocation.
- Keep the default request exact, scalar, and entirely funded by its structural parent.
- Use one generated semantic source for every contract consumed by an executable slice. Do not generate unused consumers or maintain handwritten alternatives.
- Apply validation, replay, canonical results, transition evidence, and rollback to every mutating procedure in one transaction shell.
- Keep Policies optional, local to one Budget, deterministic, read-only, and limited to Resource ceilings.
- Keep request context immutable, typed, application-asserted, recorded as evidence, and absent from child inheritance.
- Keep application effects, provider retries, usage observation, outcomes, and fallback behavior outside Keynes.
- Keep missing usage and overage visible through unresolved accounting and isolated deficits.
- Treat PGlite, customer PostgreSQL, and managed Cloud as hosts of one PostgreSQL database core, not independent semantic implementations.
- Use native PostgreSQL for contention, roles, recovery, and deployment claims that PGlite cannot prove.
- Attach Policy-security evidence to each implemented host. Do not require an unimplemented host to pass a gate.
- Predeclare performance limits and adopter pass criteria before collecting the evidence used to advance the roadmap.
- Keep preview, compatibility, security, performance, and production-readiness claims no broader than the retained evidence.
- Introduce subtree issuance before multi-source funding. Introduce both through explicit public contracts.
- Mark a stage complete only when every feature and its exit gate pass with retained executable evidence.
- Use dependency and evidence status instead of invented dates, staffing estimates, or unsupported readiness claims.
