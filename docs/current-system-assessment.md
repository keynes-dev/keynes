# Current-system assessment

> **Status:** Discovery snapshot. This document records behavior and evidence at
> `fb0ca4f50417c76d7f1833f93c46980cc40689ba` on September 3, 2026. It does
> not approve a new product contract, allocate a feature, or promote older
> evidence to the current revision.

## Purpose

This assessment answers four questions before Keynes resumes feature planning:

1. What behavior exists on current `main`?
2. What public and durable contracts does that behavior expose?
3. Which contradictions or gaps can be observed without choosing a new design?
4. Which questions require a product decision before code changes?

The next phase must validate each observation against current code, a focused
test, or an exact command. Historical pull request comments remain inputs, not
verdicts.

## Evidence labels

This document uses four evidence labels:

- **Current source** means code or generated contracts at `fb0ca4f` establish
  the stated behavior.
- **Current provider-free** means a command passed in the clean assessment
  worktree at `fb0ca4f`.
- **Retained** means an accepted record proves the claim only at its recorded
  revision.
- **NOT RUN** means this assessment produced no evidence for that lane.

## Current system

Keynes has one TypeScript SDK and two Budget authorities. `createKeynes()`
opens a private in-memory SQLite authority. `createKeynes({ databaseUrl })`
opens a bounded pool to one PostgreSQL authority. Embedded PostgreSQL callers
install the same canonical database procedures but call them inside a
caller-owned transaction instead of using the SDK pool.

```text
TypeScript application
|
+-- createKeynes()
|   `-- private node:sqlite authority
|
+-- createKeynes({ databaseUrl })
|   `-- verified-TLS pool -> eight remote PostgreSQL procedures
|
`-- application-owned PostgreSQL client
    `-- five canonical procedures in the caller's transaction
```

The SDK exposes `Budget` as the only stateful governance object. Resource
schemas and Policies are frozen authoring values. Private Resource identities,
Budget identifiers, command identifiers, executors, database handles, and
tenant identifiers do not cross the package-root API.

## Behavior by area

| Area                                   | Current behavior                                                                                                                                                                                                                                                                                                                                                                                                                  | Owner and evidence                                                                                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resource definition and identity       | `defineResources(...)` validates, copies, sorts, digests, and freezes a typed schema. It creates no authority state. `createBudget(...)` sends each allocated definition with its amount. SQLite and PostgreSQL reuse an exact tenant-wide definition or reject a conflict, and issue a private UUID for a missing definition. The embedded contract also exposes `defineResource`; the remote contract does not.                 | `packages/sdk/src/resources.ts:50`, `packages/sdk/src/keynes.ts:228`, `packages/contracts/contract.json:3`, `packages/postgresql/migrations/0005-resource-bound-budget.sql:562`                                         |
| Quantity introduction and conservation | Root creation introduces quantity directly into root holdings. No table stores unattached quantity. A child receives only quantities requested from its parent. Consumable descendants charge known usage up to their allocation. Reusable descendants reserve their allocation while active and return it after settlement. Overage remains an isolated child deficit.                                                           | `docs/product.md:15`, `packages/sdk/src/local/sqlite-command-executor.ts:792`, `packages/postgresql/migrations/0004-policy.sql:2121`                                                                                    |
| Budget creation and parentage          | A root has no parent, points to itself as root, and starts at depth zero. An approved request creates one child with the requesting Budget as parent. Internal root and child IDs are command UUIDs. Remote callers receive separate opaque `kbr_v1_` references.                                                                                                                                                                 | `packages/sdk/src/local/sqlite-command-executor.ts:306`, `packages/sdk/src/remote/references.ts:13`, `packages/postgresql/migrations/0006-remote-access.sql:153`                                                        |
| Policies and requests                  | Kysely and raw SQL authoring compile to one normalized, versioned Policy form. The selected authority evaluates a parent's Policies inside the request transaction. A denial creates no child but records reasons and Policy evidence. Child Policies are explicit and do not inherit. Policy errors abort instead of becoming approvals or domain denials.                                                                       | `packages/sdk/src/policy/authoring.ts:69`, `packages/sdk/src/policy/evaluate.ts:87`, `packages/postgresql/migrations/0004-policy.sql:1839`, `packages/sdk/src/budget-request-options.ts:28`                             |
| Settlement and history                 | Settlement records nonempty, partial direct usage. Known usage is monotonic and conflicting restatements fail. The authority derives `active`, `settling`, or `settled` from direct usage and descendants. Local `inspect()` returns the complete root-lineage history. Remote inspection reads a frozen terminal sequence through bounded, single-use pages.                                                                     | `packages/sdk/src/local/sqlite-command-executor.ts:660`, `packages/sdk/src/local/sqlite-command-executor.ts:778`, `packages/sdk/src/remote/budget.ts:123`, `packages/postgresql/migrations/0006-remote-access.sql:1013` |
| Local SQLite                           | Each local factory call creates one private `:memory:` database with one internal tenant and principal holding all five permissions. One runtime queue serializes admitted calls, and each mutation uses `BEGIN IMMEDIATE`. Closing drains admitted work, rejects new work, and destroys all state. Local callers cannot supply identity, persistence, a transaction, a reference, or an operation key.                           | `packages/sdk/src/local/runtime.ts:22`, `packages/sdk/src/local/sqlite-store.ts:50`, `packages/sdk/src/local/sqlite-store.ts:151`                                                                                       |
| Embedded PostgreSQL                    | `@keynes/postgresql` installs migrations `0001` through `0006`. Canonical procedures own durable Resource, Budget, Policy, replay, and history state. An embedded caller can compose a procedure call with application writes in one caller-owned transaction. The installer accepts only a fresh database or an exact installed graph.                                                                                           | `packages/postgresql/migrations/manifest.json:1`, `packages/postgresql/src/installer/install.ts:76`, `docs/architecture.md:120`                                                                                         |
| Remote SDK                             | The SDK accepts exactly one `postgresql:` URL, requires one `sslmode=verify-full`, constructs a verified TLS configuration, checks exact compatibility, and invokes only eight generated remote procedures. Remote handles add Budget references, reopen, bounded history, retry, and operation recovery. There is no HTTP data path or fallback authority.                                                                       | `packages/sdk/src/remote/connection-options.ts:35`, `packages/sdk/src/remote/postgresql-command-executor.ts:103`, `packages/contracts/contract.json:45`                                                                 |
| Permissions and tenant isolation       | The canonical operations use `define_resource_type`, `create_root_budget`, `request_budget`, `settle_budget`, and `read_budget`. Current `createBudget` metadata requires both definition and root permissions. Remote wrappers derive tenant and principal from a protected `session_user` mapping. Unknown or cross-tenant references return a safe authorization error.                                                        | `packages/contracts/contract.json:3`, `packages/postgresql/migrations/0006-remote-access.sql:118`, `packages/postgresql/migrations/0006-remote-access.sql:185`                                                          |
| Replay and recovery                    | SQLite stores canonical command input and results in the same authority transaction. Remote PostgreSQL adds a tenant-scoped operation ledger around the canonical command. Exact reuse returns the recorded result; changed input returns `command_conflict`. The SDK generates operation keys by default and accepts a caller key for crash recovery. Recovery returns `committed`, `known_failure`, `unresolved`, or `expired`. | `packages/sdk/src/local/sqlite-command-executor.ts:193`, `packages/postgresql/migrations/0006-remote-access.sql:794`, `packages/sdk/src/remote/references.ts:59`                                                        |
| Packaging and qualification            | `@keynes/sdk` is a private ESM package with one root export and supports Node 24 and 26. `@keynes/postgresql` is a private CLI package with no JavaScript import surface and supports Node 24 through 26. PR CI runs the provider-free `test:pr` gate. Native PostgreSQL and SDK archive workflows are manual.                                                                                                                    | `packages/sdk/package.json`, `packages/postgresql/package.json`, `.github/workflows/ci.yml:1`, `.github/workflows/postgresql-system.yml:1`, `.github/workflows/sdk-package.yml:1`                                       |

## Public and durable contracts

The package-root SDK exports these application-facing capabilities:

- `createKeynes()` and `createKeynes({ databaseUrl })`
- `defineResources(...)`
- Policy authoring through `definePolicy`, `definePolicySql`, `policySet`, and
  `policyValue`
- `Keynes.createBudget(...)`
- `Budget.request(...)`, `Budget.settle(...)`, and `Budget.inspect()`
- remote `openBudget(...)`, `recoverOperation(...)`, `BudgetReference`, and
  `OperationKey`

`packages/contracts/contract.json`, `packages/contracts/schema.json`, and
`packages/contracts/policy-profile.json` own the generated wire contract. The
generated SDK validators and PostgreSQL procedure metadata carry their digests.
PostgreSQL migrations own durable table and procedure behavior. PostgreSQL is
the only durable database implementation.

The SDK and PostgreSQL package are still private and unpublished. Self-hosted
operations and Keynes Cloud remain product directions, not delivered services.

## Observations for validation

These observations are not accepted issue dispositions. Phase 3 must reproduce
each one, reject it, or mark it inconclusive.

| ID      | Initial classification | Current observation                                                                                                                                                                                                                                                                                        | Why it matters                                                                                                                      |
| ------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| OBS-001 | Product decision       | The product says applications define Resource types separately from quantity, but the public SDK has no authority-backed definition call. Both local and remote `createBudget(schema, allocation)` send definitions and amounts together. Embedded PostgreSQL alone exposes a separate definition command. | The next API cannot be inferred from current code. It needs an explicit Resource registration, binding, and compatibility decision. |
| OBS-002 | Product decision       | Current `createBudget` metadata requires `define_resource_type` and `create_root_budget` for every root, including exact reuse.                                                                                                                                                                            | Permission behavior depends on whether definition is an independent operation or part of root creation.                             |
| OBS-003 | Candidate defect       | The shared `Amount` schema permits zero. Local and embedded root creation accept it. `remote_apply` rejects a root amount less than or equal to zero. A remote recovery test uses zero as an intended failure.                                                                                             | Local, embedded, and remote modes do not implement one root-allocation contract.                                                    |
| OBS-004 | Candidate defect       | Several Promise-returning local methods validate inputs before runtime admission. Invalid input can throw synchronously and can take precedence over `runtime_closed`.                                                                                                                                     | The runtime does not consistently deliver asynchronous errors or lifecycle ordering described by the architecture.                  |
| OBS-005 | Candidate defect       | The installer grants its configured `applicationRole` only the eight remote wrappers and exact recheck rejects extra canonical grants. Embedded system tests create another role and grant the five canonical procedures outside the installer.                                                            | The documented embedded transaction path has no installer-owned, exact-recheck-compatible application role.                         |
| OBS-006 | Candidate defect       | A Budget handle carries one Policy context and reason type, while `inspect()` returns root-lineage history from ancestors and descendants that may use different Policy types. Projection casts every history entry to the inspecting handle's Policy types.                                               | Runtime history can contradict the public TypeScript type for heterogeneous Policy trees.                                           |
| OBS-007 | Candidate defect       | `resource_not_defined` runtime errors include `operation`, but the exported `KeynesSdkErrorDetails` type declares only `resource`.                                                                                                                                                                         | Consumers cannot type-check a field that public tests expect at runtime.                                                            |
| OBS-008 | Design debt            | `ResourceDefinitionError` and `DefinedResource` remain public exports but have no production use after atomic Resource-bound root creation replaced the earlier workflow.                                                                                                                                  | The public package contains concepts with no current behavior. Compatibility intent is unknown.                                     |
| OBS-009 | Evidence gap           | `registerRemoteContractTests` defines six shared remote scenarios and is exported, but no test calls it. FEAT-0013 task T025 is checked off and SC-002 claims shared local and remote outcomes.                                                                                                            | Native PostgreSQL tests cover remote behavior, but the claimed provider-free shared remote corpus does not run.                     |
| OBS-010 | Stale evidence summary | The FEAT-0012 roadmap and tasks name accepted revision `ea621cc` with 302 provider-free and 132 PostgreSQL tests. The retained acceptance JSON names `77b721d` with 304 and 136.                                                                                                                           | The human-readable delivery summary disagrees with its durable evidence record.                                                     |
| OBS-011 | Roadmap drift          | Current `main` assigns FEAT-0015 as the positive-TLS owner but contains no FEAT-0015 feature directory or roadmap row. An unmerged remote branch carries that identity with no roadmap stage.                                                                                                              | Current `main` names an allocated feature that its own feature manifest and roadmap do not own.                                     |
| OBS-012 | Repository gate gap    | The root format command includes FEAT-0012 and selected ADRs but omits FEAT-0013, FEAT-0014, ADR 0003, and ADR 0007.                                                                                                                                                                                       | Current normative documents can drift outside the repository format gate.                                                           |
| OBS-013 | Evidence wording drift | The retained FEAT-0013 PostgreSQL record says the administration role has five private administration functions. The installer owns six targets: register, rotate, enable or disable, revoke, inspect, and audit.                                                                                          | The descriptive evidence inventory does not match the qualified implementation.                                                     |
| OBS-014 | Evidence gap           | Local history is unbounded and local accounting traverses descendants recursively. No retained stress evidence states a supported tree depth or history volume.                                                                                                                                            | The preview has no proved operating boundary for large Budget trees.                                                                |

## Decisions required before allocation

Current code cannot settle these questions. Product and architecture documents
must answer them before a new implementation feature is allocated:

1. Can an application register Resource definitions independently?
2. What typed, quantity-free value does registration return?
3. Does root Budget creation accept only resolved Resources?
4. Does every quantity exist only as a Budget holding?
5. Does initial root funding introduce quantity directly into the new Budget?
6. Do child Budgets receive quantity only from another Budget through
   `request(...)`?
7. Which permissions govern definition, initial funding, delegation, settlement,
   and inspection?
8. How does remote reopen reconstruct and validate the typed Resource binding?
9. Does the current public API have a compatibility obligation?

## Current evidence

The assessment worktree was clean before and after these commands. The first
attempt used unsupported Node `25.9.0` and stopped during the engine check before
tests ran. The successful commands used Node `24.19.0` and pnpm `11.21.0`.

| Lane                      | Revision  | Result                                                                                                                                                                            |
| ------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CI=true pnpm check:repo` | `fb0ca4f` | Passed. Feature identity, generation, formatting, lint, types, and dependency boundaries passed with 19 existing lint warnings and no errors.                                     |
| `CI=true pnpm test:unit`  | `fb0ca4f` | Passed. Contracts 51, PostgreSQL tooling and qualification units 76, SDK unit and conformance tests 341.                                                                          |
| `CI=true pnpm test:pr`    | `fb0ca4f` | Passed. It reran the 468 package tests and also passed 8 feature-identity tests, 8 repository-organization tests, generation, formatting, lint, types, and dependency boundaries. |

Retained evidence remains useful but stays bound to older revisions:

- FEAT-0014 retains combined acceptance at
  `b25a491de6831fc8f3b014ffdf15ab73b236029a` and native PostgreSQL evidence at
  `1b0563616d17299d9a5c57e1fbe7523d4f6e4b68`.
- FEAT-0013 retains SDK and PostgreSQL package evidence, 203 PostgreSQL 18.6
  tests across 39 suites, and the hosted Node 24 and 26 matrix at
  `52da617be4f77ef5913955e397c3bc6ff2423ae6`.

Current `main` descends from those revisions, but qualification and package-test
code changed after `52da617`. The retained results are not exact-current-main
proof.

## NOT RUN at the assessment revision

This assessment did not run these lanes at `fb0ca4f`:

- native PostgreSQL 18.6 system qualification;
- SDK or PostgreSQL packed-archive qualification;
- hosted Node and operating-system consumers;
- positive certificate-chain and hostname qualification;
- an authorized external provider or public network;
- PgBouncer downstream TLS;
- other PostgreSQL versions or providers;
- migration upgrade, downgrade, rolling deployment, or uninstall;
- backup restoration, failover, or disaster recovery;
- broad hostile-role security, fault, capacity, or performance campaigns;
- self-hosted operations, managed Cloud, registry publication, support, or
  production readiness.

## Phase 3 handoff

The [current issue register](current-issue-register.md) combines these
observations with unresolved comments from PRs #23 through #30. Each row cites
one current witness, classifies the result, names the user impact and proposed
owner, and records its dependencies. No row inherits a verdict from a
historical review.
