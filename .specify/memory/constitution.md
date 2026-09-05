<!--
Sync Impact Report
- Version change: 8.0.0 -> 8.0.1
- Rationale: KEY-92 terminology clarification; engineering requirements are unchanged.
- Modified principle: III, canonical Policy behavior test corpus wording only.
- Modified section: Delivery and evidence gates, cross-backend Policy behavior tests wording only.
- Added sections: none
- Removed sections: none
- Migration impact: no runtime or governance behavior changes; existing evidence remains valid for its original revision.
- Managed templates and commands: unchanged; read the constitution at runtime.
- Follow-up TODOs: none
-->

# Keynes Constitution

## Core principles

### I. One source of truth per Budget

Each Budget MUST be stored and changed in exactly one place. The process-local
SQLite runtime MUST own the committed state and state transitions for a local Budget.
The `keynes.*` PostgreSQL procedures MUST own the committed state and state
transitions for a durable Budget. SDKs, services, and integrations MUST NOT
reproduce those transitions outside the selected implementation or write its
private state directly.

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
Policy context, effect execution, provider idempotency and retries, usage
observation, business outcomes, fallback behavior, and analysis. An approved
child Budget permits only its Resource envelope; it MUST NOT be represented as
proof that external work ran or succeeded. Keynes MUST NOT invent, dispatch,
retry, reorder, or substitute application behavior.

This boundary keeps Budget decisions composable with any application workflow
and prevents a command retry from duplicating external work.

### III. Restricted, fail-closed Policies

A Policy MUST be optional, local to one Budget, deterministic, read-only, and
limited to Resource ceilings. Its public format MUST be a restricted
PostgreSQL-style query over the requested Resources, the parent Budget's
available Resources, and one fixed context object supplied by the application.
It MUST NOT access Keynes private storage, application tables, secrets,
history, or unrelated requests.

The TypeScript SDK MUST use Kysely as the normal Policy authoring path and MUST
also accept advanced raw SQL within the same supported profile. Kysely-compiled
SQL and raw SQL MUST pass through one pinned PostgreSQL parser, validator, and
normalizer into a versioned Keynes Policy program. Policy evaluation MUST occur
inside the selected Budget authority's atomic command, and Keynes MUST NOT trust
an application-supplied Policy decision. Keynes MUST define one versioned
semantics contract for that program. Deployments MAY use one shared evaluator
or deployment-native backends when each backend enforces the same contract and
passes the canonical Policy behavior test corpus. Kysely's operation tree, the parser's
syntax tree, and backend-specific representations are not public or durable
contracts.

Invalid SQL, forbidden access, nondeterministic behavior, an execution-limit
failure, invalid context, or an invalid result MUST fail the request. None may
become an approval or denial. Keynes MUST record the exact context used for a
decision, and replay MUST NOT query application data again. Policy context MUST
be free of secrets.

### IV. Consistent behavior across deployments

The in-memory SQLite runtime and PostgreSQL MUST implement the same Budget commands,
results, errors, replay behavior, accounting rules, and evidence format. The
generated TypeScript client MUST depend on a deployment-neutral command
boundary. Local lifecycle code, PostgreSQL procedure clients, and remote
transport clients MAY differ in storage, authentication, transactions,
concurrency controls, recovery, and operations, but they MUST NOT change the
public meaning of a Budget command.

Every shared Budget example MUST run as a black-box comparison against the
in-memory SQLite runtime and native PostgreSQL. Results, errors, replay flags, history,
and final Budget state MUST agree. Separate suites MUST cover local lifecycle
and memory, PostgreSQL concurrency and transactions, remote authentication and
tenant isolation, recovery, packaging, and managed operations. A pass in one
deployment MUST NOT be reported as evidence for another.

Subtree issuance, multi-source funding, or another Resource path MUST use an
explicit contract and pass its own permission, conservation, recovery, replay,
and deployment comparison gates before release.

### V. Evidence-first, test-first delivery

Every behavioral change MUST begin with an automated test that is observed
failing for the expected reason before implementation begins. The default
verification lane MUST be deterministic and provider-free. Networked, paid,
managed-provider, fault, and benchmark lanes MUST remain explicit and, where
they can spend money or mutate external state, separately authorized.

Specs and plans MUST define measurable acceptance evidence, including security,
recovery, migration, compatibility, shared behavior, deployment-specific, and
performance evidence when those qualities are in scope. A result that was not
executed MUST remain marked `NOT RUN`. Release or readiness claims MUST cite
retained evidence from the exact source revision, artifact, dependency versions,
host, and attempt that produced it.

## Product constraints

- `Budget` MUST remain the only public stateful governance object. Defining a
  Resource type creates no quantity or permission to spend.
- An ordinary request MUST name one exact Resource envelope and be funded
  entirely by its structural parent. It MUST atomically return a denial or
  reserve Resources and create one child Budget.
- Policies MUST remain optional and local to the Budget that declares them.
  Request context MUST be immutable, typed, application-supplied, recorded as
  evidence, and absent from child inheritance.
- Settlement MUST record direct known usage and derive subtree state without
  silently treating missing evidence as zero or charging ancestors to hide a
  child deficit.
- Public contracts MUST preserve exact values, stable identities, canonical
  serialization, explicit error families, and idempotent command replay.
- Secrets MUST NOT appear in Policy context, committed fixtures, generated
  artifacts, logs, prompts, or retained evidence.
- Local mode MUST run privately inside one Node.js process, expose no persistence
  or database handle, and lose its state when the process exits.
- PostgreSQL MUST be the only durable database implementation. It MAY be
  installed in an application's database, reached directly by the SDK in a
  customer-operated deployment, or operated by Keynes as managed Cloud.
- Supporting MySQL, SQLite, or another durable database implementation requires
  a later constitution amendment and its own behavior, migration, concurrency,
  security, recovery, packaging, and operations evidence.
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
  landed prerequisites. Each shared behavior feature MUST own passing SQLite
  and native PostgreSQL evidence before acceptance. Linear content MUST NOT
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
- A Policy change MUST name changes to context, Kysely compilation, raw-SQL
  parsing, Policy-program normalization, the shared semantic definition, every
  selected execution backend, cross-backend Policy behavior tests, evidence, and replay.
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
hidden external effects, fail-open Policy behavior, unsupported deployment
equivalence, and claims that exceed retained evidence. Governance review does
not replace technical judgment: every rule and exception MUST be justified by
the concrete correctness, security, operability, or product risk it controls.

**Version**: 8.0.1 | **Ratified**: 2026-08-21 | **Last Amended**: 2026-09-04
