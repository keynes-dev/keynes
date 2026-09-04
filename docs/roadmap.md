# Keynes implementation roadmap

This roadmap organizes Keynes delivery by the way a user runs the product:
Local, Keynes Cloud Hosted, then Embedded. Each stage contains user-complete
vertical features. Qualification belongs to the feature whose user promise it
proves; it is not a separate feature.

The [product](product.md) owns product semantics. The
[architecture](architecture.md) owns runtime boundaries and release
invariants. The [workflow](workflow.md) and
[ADR 0002](adr/0002-feature-identity-and-roadmap-stages.md) own feature identity
and delivery. A candidate below remains unnumbered until Spec Kit allocates it.

Completed artifacts and retained evidence describe the exact revisions they
qualified. They do not prove the accepted product and architecture target.

## Current delivery sequence

```text
roadmap and evidence reconciliation
  -> Local accountable Budget loop
  -> Local Policy-governed Budget loop
  -> Hosted Budget continuity
  -> Hosted operating contract
  -> Embedded Budget authority
  -> Embedded transaction composition
```

The order is a product sequence. A later stage can reuse qualified semantic
work from an earlier stage, but it must prove its own deployment boundary.

## Stage 1: Local

Local is the first complete product. A Node.js application gets the full Keynes
Budget model from one private in-memory SQLite authority with no account,
network service, or external database.

| Order | Feature candidate                 | User-complete outcome                                                                                                                     | Depends on                          | Status      |
| ----- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------- |
| 1.1   | Local accountable Budget loop     | Define Resources, create and fund Budgets, manage an ungoverned Budget tree, settle it, replay commands, and inspect coherent accounting. | Roadmap and evidence reconciliation | Not started |
| 1.2   | Local Policy-governed Budget loop | Define and bind Policies, make typed governed requests, and inspect correct evidence across a tree whose Budgets use different Policies.  | Local accountable Budget loop       | Not started |

### Local accountable Budget loop

This feature ships the final Resource and ungoverned Budget workflow. A user
can:

- call `keynes.defineResources(...)` independently of Budget creation;
- create a funded or zero-funded root from typed Resource bindings;
- add quantity to an active Budget when `allows.addResources` permits it;
- create ungoverned child Budgets when `allows.request` permits it;
- record consumable and reusable usage, including permanent deficit evidence;
- settle an entire tree without leaving an active or settling descendant;
- replay mutations without duplicating Budgets, movements, or history; and
- inspect one coherent projection and accounting history.

The feature owns the final `addResources`, `request`, `settle`, and
`inspect` Budget interface; immutable Resource membership and `allows`; the
movement journal; usage and deficit evidence; return and release movements; the
`active`, `settling`, and `settled` lifecycle; transactional concurrency in
SQLite; asynchronous SDK error timing; package contents; and the accepted
Node.js `>=24` range.

The exit gate runs the complete ungoverned semantic suite and clean SDK
consumers against one exact archive. Policy, PostgreSQL, recovery, Hosted,
Embedded, and self-hosted claims remain `NOT RUN`.

### Local Policy-governed Budget loop

This feature completes Local. A user can:

- call `keynes.definePolicies(...)` independently of Budget creation;
- attach typed Policy bindings to any new Budget;
- provide Policy-specific namespaced context with a request;
- distinguish Policy denial from Policy evaluation failure; and
- inspect Policy-name-discriminated history across heterogeneous descendants.

The feature owns the SQLite Policy catalog, binding validation, portable Policy
evaluation, canonical evidence, heterogeneous history, and supported tree-depth
and history-volume limits.

The stage exits only when one exact Local archive passes the complete governed
and ungoverned behavior suite, clean-consumer qualification, the declared
Node.js and operating-system matrix, package measurements, lifecycle and replay
fault cases, and the selected scale limits. PostgreSQL and Hosted behavior
remain `NOT RUN`.

## Stage 2: Keynes Cloud Hosted

Keynes Cloud Hosted is the managed durable product. Keynes operates the
PostgreSQL authority, connection path, credentials, recovery, and service
contract. Self-hosted operation is not a prerequisite.

| Order | Feature candidate         | User-complete outcome                                                                                                                                  | Depends on                        | Status      |
| ----- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ----------- |
| 2.1   | Hosted Budget continuity  | Onboard to Keynes Cloud, run the complete Budget workflow across restarts, load by reference, generate catalog types, and recover ambiguous mutations. | Local Policy-governed Budget loop | Not started |
| 2.2   | Hosted operating contract | Rely on declared credential, backup, restore, failover, monitoring, capacity, compatibility, incident, and support behavior.                           | Hosted Budget continuity          | Not started |

### Hosted Budget continuity

This feature owns the clean PostgreSQL `0001-baseline`, the `remote`
installation profile, canonical commands and constrained wrappers,
transactional row locking, role-derived tenant scope, the direct PostgreSQL
SDK, verified TLS, opaque Budget references, `loadBudget(reference)`, ambiguous
operation recovery, generated Resource and Policy catalogs, coherent
inspection, and independent bounded history paging.

The feature also delivers one supported Keynes Cloud onboarding path and a
tenant connection that can run the same semantic workflow as Local. The exit
gate runs the complete shared Budget and Policy suite against native PostgreSQL
and the public Hosted path, then proves process restart, concurrent replay,
committed-response loss, TLS, tenant isolation, least privilege, catalog
generation, package installation, and bounded retry and recovery. Self-hosted
and Embedded operation remain `NOT RUN`.

### Hosted operating contract

This feature turns the Hosted data path into a service a customer can depend
on. It owns credential issue, rotation, disablement, and revocation; backup and
restore; failover; monitoring and alerting; capacity and service limits;
version compatibility and upgrades; incident handling; and support boundaries.

PostgreSQL remains the only Budget, accounting, replay, and recovery authority.
The Cloud control plane must not add a second state or replay ledger. The stage
exits when the declared operating behavior passes against one exact source
revision, SDK archive, PostgreSQL package, and deployed Cloud revision.
Self-hosted evidence is not required.

## Stage 3: Embedded

Embedded lets an application use its own PostgreSQL connection and transaction
while Keynes remains authoritative for Budget state and accounting.

| Order | Feature candidate                | User-complete outcome                                                                                                                  | Depends on                | Status      |
| ----- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------- |
| 3.1   | Embedded Budget authority        | Install the `embedded` profile and run the complete Budget workflow through canonical procedures from an application-owned connection. | Hosted operating contract | Not started |
| 3.2   | Embedded transaction composition | Commit or roll back Keynes commands with application rows, then restore and replay without duplicate Keynes or application effects.    | Embedded Budget authority | Not started |

### Embedded Budget authority

This feature owns the packaged PostgreSQL baseline, immutable `embedded`
profile, canonical application-role grants, clean installation, exact recheck,
drift refusal, least privilege, procedure documentation, and generated command
and result types.

The exit gate runs the complete shared Budget and Policy suite through an
application-owned connection. It proves that the embedded role can call the
canonical procedure family and cannot access Keynes internals or the remote
credential-administration surface.

### Embedded transaction composition

This feature proves the reason to embed Keynes in an application database. A
user can run canonical Keynes commands inside an existing transaction and
atomically commit or roll back Budget changes with application rows.

The feature owns request and settlement composition, pending-result behavior,
rollback, crash recovery, backup restoration, and exact replay examples and
evidence. A clean consumer must restore its application-owned database and
replay a persisted command without creating a second Budget, movement, history
entry, or application effect.

The feature does not add an SDK pool, transaction manager, generic repository,
automatic outbox, or self-hosted support promise.

## Issue ownership

The [current issue register](current-issue-register.md) records the assessed
source state. This table assigns each confirmed item to the new delivery
sequence; it does not mark an item repaired before its owning evidence passes.

| Owner                               | Issues and responsibility                                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roadmap and evidence reconciliation | IR-017 corrects the FEAT-0012 summary; IR-018 closes formatting-gate drift; IR-019 corrects the human-owned FEAT-0013 evidence summary without changing the retained body. |
| Local accountable Budget loop       | IR-009, IR-011, IR-014, IR-015, the first semantic implementation of IR-010, Local evidence for IR-021, and the Node.js range and archive proof in IR-022.                 |
| Local Policy-governed Budget loop   | IR-013, IR-020, and complete Local governed evidence for IR-021.                                                                                                           |
| Hosted Budget continuity            | IR-002, IR-003, IR-004, IR-007, IR-016, Hosted parity for IR-010 and IR-013, the `remote` half of IR-012, and Hosted evidence for IR-021.                                  |
| Hosted operating contract           | IR-006 and managed-service evidence for IR-021.                                                                                                                            |
| Embedded Budget authority           | The `embedded` half of IR-012, complete Embedded semantic parity, and Embedded evidence for IR-021.                                                                        |
| Embedded transaction composition    | Application transaction, restore, recovery, and exact-replay evidence.                                                                                                     |

IR-001, IR-005, and IR-008 remain superseded and need no new owner. FEAT-0011
remains standalone repository work and is not a product-sequence dependency.

## Self-hosted design target

Self-hosted is a possible future product, not a current stage, feature,
dependency, or qualification gate. Current design preserves that option through
three constraints:

- Cloud-specific operations cannot enter semantic authority tables or generated
  Budget commands.
- The `remote` installation profile and wrappers must remain deployable outside
  Keynes Cloud.
- Keynes Cloud cannot add a second Budget state or replay ledger.

No current feature packages, qualifies, documents, or supports a customer-run
deployment.

## Implementation sequence

This section is the historical delivery record required by allocated feature
identities. It does not define the current delivery order. `Complete` means the
feature met its accepted contract at its retained revision. `Superseded` means
useful implementation and evidence remain, but the feature's delivery plan is
not an active source of product scope.

| Feature                                                                                             | Historical purpose                                           | Status      |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------- |
| [0001 Repository and code architecture](features/0001-repository-and-code-architecture/spec.md)     | Establish repository ownership and provider-free checks.     | Complete    |
| [0002 Executable Budget lifecycle](features/0002-executable-authority-slice/spec.md)                | Prove the first database-owned Budget lifecycle.             | Complete    |
| [0003 Shared core platform gate](features/0003-shared-core-platform-gate/spec.md)                   | Compare the same core on PGlite and PostgreSQL.              | Complete    |
| [0004 Local runtime and SDK](features/0004-local-runtime-sdk/spec.md)                               | Expose the first private local SDK runtime.                  | Complete    |
| [0005 Local preview qualification](features/0005-local-preview-qualification/spec.md)               | Qualify the first PGlite SDK archive and runtime envelope.   | Complete    |
| [0006 Cloud runtime and service](features/0006-cloud-runtime-service/spec.md)                       | Prove the retired private loopback service.                  | Complete    |
| [0007 Runtime and deployment model](features/0007-runtime-and-deployment-model/spec.md)             | Record the earlier deployment direction.                     | Complete    |
| [0008 SQLite local runtime](features/0008-sqlite-local-runtime/spec.md)                             | Replace PGlite with private in-memory SQLite.                | Complete    |
| [0009 PostgreSQL transaction integration](features/0009-postgresql-transaction-integration/spec.md) | Prove the first embedded PostgreSQL preview.                 | Complete    |
| [0010 Repository organization](features/0010-repository-organization/spec.md)                       | Organize packages, tests, and evidence by responsibility.    | Complete    |
| [0011 Idiomatic monorepo](features/0011-idiomatic-monorepo/spec.md)                                 | Continue standalone repository ownership work.               | In progress |
| [0012 Portable Policy evaluation](features/0012-portable-policy-evaluation/spec.md)                 | Prove the first portable Policy semantics profile.           | Complete    |
| [0013 Remote PostgreSQL SDK](features/0013-remote-sdk-public-service/spec.md)                       | Preserve the direct PostgreSQL SDK implementation and proof. | Superseded  |
| [0014 Resource-bound Budget creation](features/0014-resource-bound-budget/spec.md)                  | Prove Resource-bound root creation in local and PostgreSQL.  | Complete    |

### Historical evidence boundaries

- FEAT-0005 qualified exact revision
  `714268c950e2f243755725bbe248add88977f6d5` and archive SHA-256
  `86c099f7ea666edd58c3947199651aad07e2563621d23e01d619ab3efd098b84`
  on Node.js 24 and 26 across Linux, macOS, and Windows.
- FEAT-0006 qualified its private service at
  `1fa83d1adf3e5c37adaaccdb4afdb7c037b6fb1a`. That evidence does not
  qualify Keynes Cloud Hosted.
- FEAT-0008 qualified its SQLite preview at
  `a33761aac041083dfdc932efc434a60f345870af` on Node.js 24 and 26 across
  Linux, macOS, and Windows. Node.js 25 remained `NOT RUN`.
- FEAT-0009 qualified its repaired PostgreSQL 18.6 preview at
  `7edb1ee723c39b10c0dc864673fb9cb1f5d00b3e` with 85 PostgreSQL and 9
  private Cloud scenarios. Its later timed walkthrough remained `NOT RUN`.
- The authoritative [FEAT-0012 acceptance record](features/0012-portable-policy-evaluation/evidence/policy-acceptance.json)
  names revision `77b721d5cf70b78146e75c37979f109b79a371e9`, 304
  provider-free tests, 136 PostgreSQL scenarios, 17 SDK package tests, and 21
  PostgreSQL package tests. Hosted remote Policy and production claims remained
  `NOT RUN`.
- The [FEAT-0014 acceptance record](features/0014-resource-bound-budget/evidence/acceptance.json)
  names revision `b25a491de6831fc8f3b014ffdf15ab73b236029a`. Its
  exact archives passed 20 SDK and 21 PostgreSQL package tests, and PostgreSQL
  18.6 passed 159 scenarios.
- FEAT-0013 retained implementation evidence at
  `52da617be4f77ef5913955e397c3bc6ff2423ae6`, including 203 PostgreSQL
  scenarios and a Node.js 24 and 26 hosted archive matrix. That implementation
  predates the accepted Resource, Policy, accounting, settlement, loading,
  baseline, and profile contracts, so it is historical evidence rather than an
  active delivery plan.

The off-main `feat/0015-adopt-testcontainers` identity must be reconciled or
retired before related work is allocated. The feature number must not be reused.

## Conditional future work

Product direction can promote a candidate after the three current stages. No
candidate has a feature identity or present delivery commitment.

| Candidate                | Trigger and boundary                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self-hosted Keynes       | Add only after customer demand justifies packaging, qualification, upgrade, recovery, security, and support for customer-operated PostgreSQL.                                    |
| Multi-source funding     | Add ordered contributions from several Budgets in one PostgreSQL authority while preserving one structural parent and atomic accounting. Cross-database funding remains invalid. |
| Another durable database | Reconsider only with a complete concurrency, migration, security, recovery, packaging, and support design.                                                                       |
