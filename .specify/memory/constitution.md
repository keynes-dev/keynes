<!--
Sync Impact Report
- Version change: 11.0.0 -> 12.0.0
- Rationale: adopt customer-owned evaluation and separate SQLite/PostgreSQL accounting implementations.
- Modified principles: I, one authority per Budget; II, customer evaluation ownership; III, application-owned policies and database-enforced requests; IV, shared behavior across separate engines.
- Added sections: none.
- Removed requirements: managed SQL Policy registration, compilation and evaluation; mandatory PGlite and one PostgreSQL implementation.
- Migration impact: KEY-114 owns breaking Policy retirement; KEY-96 owns package separation. Current managed Policy behavior remains until replaced. Fresh installs only; no automatic upgrade promise.
- Preserved: exact accounting, fixed funding, permissions, settlement, deterministic replay, native verification and revision-scoped evidence.
- Later work: KEY-122 governs cross-authority amendments; KEY-123/124 own durability/delegation; KEY-125 owns later shared HTTP evaluation outside accounting.
- Managed templates and commands: unchanged.
- Follow-up TODOs: none.
-->

# Keynes Constitution

## Core principles

### I. One source of truth per Budget

Each Budget MUST be stored and changed in exactly one authority. Private in-memory Node SQLite MUST implement first Local preview; PostgreSQL procedures MUST implement Hosted and Embedded. Engine-specific accounting implementations MUST live outside the SDK and share command contracts and conformance scenarios. A shared TypeScript engine MUST NOT be a prerequisite. SDKs, services and integrations MUST NOT reproduce business transitions or write private state directly.

[ADR-0013](../../docs/adr/0013-application-owned-policies.md) supersedes the PGlite and one-implementation requirements of ADR-0012. Current source still combines SQLite and managed Policy tooling with the SDK. KEY-114 owns managed Policy retirement and KEY-96 owns package separation. This amendment MUST NOT be reported as runtime implementation or qualification.

A command MUST publish one complete result atomically or change no state.
Resource conservation, availability, settlement, exact replay, conflicting
command reuse, missing usage, overage, and unresolved work MUST retain one
unambiguous meaning. Keynes MUST NOT copy a live Budget between deployments or
write it to two places. Public SDK configuration MUST select exactly one access
path. A remote access path MUST authenticate and resolve to exactly one trusted
Budget authority. Missing, invalid, or incompatible remote configuration MUST
fail and MUST NOT select local state, another service, or another database.

### II. Application-owned effects

Keynes MUST govern Resource limits and accounting without taking ownership of
application work. Applications own workflow validity, request construction,
policy evaluation, evaluation failures, recomputation, effect execution, provider idempotency and retries, usage
observation, business outcomes, fallback behavior, and analysis. An approved
child Budget permits only its Resource envelope; it MUST NOT be represented as
proof that external work ran or succeeded. Keynes MUST NOT invent, dispatch,
retry, reorder, or substitute application behavior.

This boundary keeps Budget decisions composable with any application workflow
and prevents a command retry from duplicating external work.

### III. Application-owned policies, database-enforced requests

Customers MAY evaluate policy in any language, including SQL, to produce a typed Keynes request or reject an operation. Keynes MUST validate submitted requests and atomically enforce permissions, Budget constraints, available quantities, allocation, settlement and replay. A valid request MAY still be denied. Caller-supplied decision evidence MUST NOT be treated as proof that a policy executed or as permission to allocate.

The adopted allocation boundary MUST NOT require database-managed Policy registration, compilation or evaluation, a Policy result type, callback signature or transaction manager. Optional application helpers MAY define typed interfaces. Customers MUST own evaluation, input validation, failures, fallback, transactions, parameter selection and recomputation. Keynes command replay MUST return the recorded outcome without rerunning customer policy or external work.

Customer ownership permits evaluation inside an application, a customer-operated service or later Keynes Cloud hosting. It MUST NOT require a separate evaluator per app. KEY-125 owns versioned HTTP evaluation shared across applications, outside authoritative Budget accounting. Initial hosting MUST remain evaluation-only; mandatory evaluation-and-submission is deferred. KEY-125 MUST NOT become a first Local or first Cloud release gate.

Structured model assessments MAY inform customer decisions. Customers MUST validate assessments and own provider failures and fallback before constructing requests. Production model-provider integration MUST NOT be required for Local or Cloud; KEY-115 owns independent exploration.

KEY-116 JSON Schema-based typed parameters and local snapshots, KEY-117 optional definitions/composition/prepared requests/evaluation records, and KEY-118 fixture regression utilities MUST be delivered for Local preview. Policy use MUST remain optional per workflow. KEY-119 persisted parameters and KEY-120 a schema-driven editor MUST be delivered for Cloud. Shared helper contracts MUST remain optional tooling contracts, not a mandatory policy language.

### IV. Consistent behavior across deployments

SQLite and PostgreSQL MUST preserve the same public commands, results, errors, accounting rules, replay and evidence meaning through separate implementations. Generated clients MUST depend on the deployment-neutral command boundary. Storage, authentication, transactions, concurrency, recovery and operations MAY differ without changing a Budget command's meaning.

Shared Budget scenarios MUST run as black-box comparisons against SQLite and native PostgreSQL. Results, errors, replay flags, history and final state MUST agree. Relevant PRs MUST retain Local/native correctness, fail-closed applicability classification and required-check enforcement. Native checks MUST retain concurrency, rollback, permissions, tenant isolation, remote authentication/recovery and caller-owned transactions. Existing managed Policy checks MUST remain until KEY-114 replaces their contracts and tests. Package, pooler, Local lifecycle/memory, recovery and managed-operation qualification MUST remain explicit and revision-scoped. A pass in one deployment MUST NOT qualify another.

Replenishment, subtree issuance, multi-source funding, or another path that
changes creation-only funding MUST require a later constitutional amendment
before specification or implementation. KEY-122 owns the detailed cross-authority accounting ADR and governing amendment. KEY-123 owns later durable Node Local recovery. KEY-124 owns PostgreSQL-to-local delegation, active partial surrender and final reconciliation required for Cloud. Workers, workflows and steps MUST use one Budget model. This direction MUST NOT imply that first Local supports that protocol. Any amended model MUST define its own
permission, conservation, recovery, replay, and deployment comparison evidence.

### V. Evidence-first, test-first delivery

Every behavioral change MUST begin with an automated test that is observed
failing for the expected reason before implementation begins. The default
verification lane MUST be deterministic and provider-free. Networked, paid,
managed-provider, fault, and benchmark lanes MUST remain explicit and, where
they can spend money or mutate external state, separately authorized.

Routine PR checks MUST report test and process failures in sanitized logs. Successful
PR runs need not upload artifacts; failures MAY retain sanitized diagnostics. An
artifact-upload failure MUST NOT replace the original test failure. Full qualification
MUST retain exact-revision evidence when supporting package or deployment claims.
Retries or passing assertion counts MUST NOT conceal a failing test process.

Specs and plans MUST define measurable acceptance evidence, including security,
recovery, migration, compatibility, shared behavior, deployment-specific, and
performance evidence when those qualities are in scope. A result that was not
executed MUST remain marked `NOT RUN`. Release or readiness claims MUST cite
retained evidence from the exact source revision, artifact, dependency versions,
host, and attempt that produced it.

## Product constraints

- `Budget` MUST remain the only public stateful governance object. Defining a
  Resource type creates no quantity or permission to spend.
- Root creation MUST introduce the tree's complete funding. Child creation MUST
  transfer its complete grant from its structural parent. Existing Budgets MUST
  NOT receive replenishment, top-ups, or additional grants. The selected database
  authority MUST enforce this for SDK and supported direct database callers.
- Settlement returns MAY restore parent availability but MUST NOT increase the
  tree's initial funding. Per root tree and Resource, initial root funding MUST
  equal live quantity plus consumed quantity plus released quantity. Reported
  overage MUST remain deficit evidence, not additional authorized quantity.
- Zero-valued membership and all-zero roots MUST remain valid. An all-zero root
  MUST NOT later acquire funding. Insufficient availability MUST cause request
  denial rather than automatic settlement or inferred usage completion.
- Resource definitions MAY be reused across independent roots. New roots MUST
  NOT replenish, reopen, or receive automatic balance migration from old roots.
  Creating a root MUST NOT require unrelated roots to be settled first.
- An ordinary request MUST name one exact Resource envelope and be funded
  entirely by its structural parent. It MUST atomically return a denial or
  reserve Resources and create one child Budget.
- Application policies MUST remain optional. Submitted decision evidence MUST remain caller-supplied evidence, not a database assertion of policy execution or inherited Budget authority.
- Settlement MUST record direct known usage and derive subtree state without
  silently treating missing evidence as zero or charging ancestors to hide a
  child deficit.
- Public contracts MUST preserve exact values, stable identities, canonical
  serialization, explicit error families, and idempotent command replay.
- Secrets MUST NOT appear in submitted decision evidence, committed fixtures, generated
  artifacts, logs, prompts, or retained evidence.
- First Local preview MUST run privately in Node SQLite, expose no persistence or database handle, and lose state on process exit. It MUST NOT promise browser support, multi-process coordination or caller-owned PostgreSQL transactions. Later durability requires KEY-122's governing amendment and KEY-123's acceptance.
- PostgreSQL MUST remain the only durable database implementation under this contract. It MAY be
  installed in an application's database, reached directly by the SDK in a
  customer-operated deployment, or operated by Keynes as managed Cloud.
- Supporting MySQL, SQLite, or another durable database implementation requires
  a later constitution amendment and its own behavior, migration, concurrency,
  security, recovery, packaging, and operations evidence.
- Common command contracts MUST have one source owner. Engine-specific SQLite and PostgreSQL accounting implementations MUST remain outside the SDK; KEY-96 owns package boundaries without duplicating canonical contracts.
- The SDK MUST carry types and perform actions without accounting rules, Policy compiler code or database drivers. Explicit, separately installable runtimes MUST own engine behavior. Application policy tooling MUST remain separate from allocation.
- Numeric range, decimal and rounding requirements MUST be justified by product needs during runtime design. PostgreSQL numeric behavior MUST NOT define a universal policy language. Exact accounting, deterministic replay and explicit invalid-input errors MUST remain; this amendment changes no numerical semantics.
- Supported SQL access MUST remain usable from different application languages without committing to another SDK. Customers control their deployments; guarantees apply to supported operations and MUST NOT promise to prevent owner bypass.

- Adapters MUST NOT commit, roll back or close caller-owned connections, replace
  the supplied connection, or retry a fragment of an application transaction.
  Results within that transaction MUST remain provisional until caller commit.
- TypeScript MUST remain the only supported SDK until a later product and
  architecture decision adds another language.
- `docs/product.md` owns the product thesis and commitments;
  `docs/architecture.md` owns runtime semantics and boundaries; accepted ADRs
  own architectural decisions; and Linear projects and issues own implementation
  order, current status, priority, assignment, dependencies, and current issue
  disposition. Feature artifacts MUST refine product and architecture without
  silently redefining them, and MUST own their detailed implementation contracts,
  tasks, and retained exact-revision evidence.

## Delivery and evidence gates

- Every feature specification MUST define independently testable user value,
  boundary and failure scenarios, measurable outcomes, and any application
  effect, Budget behavior, Policy, contract, deployment, or evidence
  implications. A non-applicable concern MUST be marked `N/A` with a concrete
  rationale.
- Every feature specification MUST link to one Linear issue. Linear owns its
  identifier and title. Use its exact `gitBranchName` when preparing the branch.
  Spec Kit resolves an explicitly selected feature directory using its stock
  checkout-local pointer; no custom identity schema or synchronization is required.
  Feature specifications MUST NOT duplicate mutable lifecycle status, priority,
  assignment, or project sequencing from Linear.
- Linear issues MAY summarize engineering work and link to accepted evidence,
  but detailed Spec Kit tasks and retained exact-revision evidence MUST remain
  in the repository. A mutable field MUST have only one owner.
- Each feature MUST complete its Spec Kit lifecycle on one Linear-generated
  branch and normally one independently accepted PR. Internal phases MUST stay
  in tasks.md and MUST NOT require sub-issue publication or PR stacks. Analysis MUST verify one acceptance outcome and
  landed prerequisites. Each shared behavior feature MUST own passing Local
  and native PostgreSQL evidence before acceptance, using the transition rules
  in principle IV. Linear content MUST NOT
  copy tasks, requirements, checkpoints, completion counts, or evidence.
- Every implementation plan MUST pass the Constitution Check before research
  and again after design. It MUST identify where each affected Budget is stored,
  application-owned effects, Policy and security boundaries, shared command
  implications, and exact verification lanes.
- Every task list for a behavioral change MUST order failing behavioral tests
  before the corresponding implementation. Documentation-only,
  generated-output, or mechanical changes MAY use focused validation, but the
  task list MUST state why no behavioral test applies.
- A runtime or deployment change MUST name the shared behavior examples and the
  deployment-specific lifecycle, transaction, security, recovery, packaging, or
  managed-operations tests that apply.
- A policy-related change MUST distinguish optional application tooling from allocation, identify input validation and evaluation failure ownership, and cover evidence and replay. KEY-114 MUST account for removing Kysely/raw-SQL compilation, database Policy definitions/evaluation, generated contracts and affected tests without weakening accounting or permissions.

- Provider-free verification MUST pass before any authorized live, paid, or
  externally mutating validation. Authorization MUST bind the exact plan,
  inputs, credential boundary, spend or mutation ceiling, and retained artifact
  location.
- Reviews MUST distinguish proposed, implemented, verified, failed, skipped, and
  `NOT RUN` states. Evidence MUST identify the relevant contract and artifact
  digests, tool versions, host, and explicit attempt when reproducibility
  depends on them.
- Any constitutional exception MUST be documented in the plan's Complexity
  Tracking section with the violated rule, why the exception is necessary, the
  simpler compliant alternative that was rejected, and a removal or migration
  path.

## Governance

This constitution supersedes conflicting repository practices and feature-local
guidance. An amendment MUST document its rationale and migration impact, update
the Sync Impact Report, update affected repository guidance, and pass relevant
validation. Keep generated Spec Kit commands, scripts, and templates upstream-managed;
do not propagate constitutional amendments by editing those files. If customization
becomes necessary, use supported preset composition. Product principles remain
in this constitution and are checked by stock planning and analysis commands.

Constitution versions follow semantic versioning. A MAJOR version removes or
redefines a governing principle incompatibly; a MINOR version adds a principle,
section, or materially stronger obligation; and a PATCH version clarifies
wording without changing required behavior. The ratification date records the
first accepted constitution, while the last-amended date changes with every
approved amendment.

Every feature plan and review MUST verify constitutional compliance. Reviewers
MUST reject unexplained violations, more than one source of truth for a Budget,
hidden external effects, trusted caller decisions that bypass enforcement, unsupported deployment
equivalence, and claims that exceed retained evidence. Governance review does
not replace technical judgment: every rule and exception MUST be justified by
the concrete correctness, security, operability, or product risk it controls.

**Version**: 12.0.0 | **Ratified**: 2026-08-21 | **Last Amended**: 2026-09-19
