# Keynes: Runtime economics for agents

> **Status:** Adopted product direction. SQLite Local and PostgreSQL enforce accounting while customers compute requests and may attach bounded caller evidence. Managed SQL Policies are retired, and applications select separate runtime packages explicitly. [Linear](https://linear.app/keynes) owns delivery and roadmap status; retained evidence proves only its recorded revision and verification lane.

## Thesis

Agents make choices that affect cost, speed, quality, and risk. They decide how
much to investigate, which tools to use, when to retry, and when to ask for help.
Businesses need a clear way to give agents operating limits without scattering
those limits through prompts and application code.

**Applications decide what work is worth doing. Keynes enforces the quantity they are allowed to use.** Customers compute a typed request or reject an operation. A Budget owns Resource quantities and may grant some to a child. Keynes validates the request and atomically checks Budget authority, constraints and available quantity. A valid request may still be denied. The application does the work and reports usage; Keynes settles the accounting and returns unused quantity.

```text
Budget -> request -> child Budget -> settle -> evidence
```

Keynes governs authority to use a quantity. It does not own the money, provider
quota, seat, token, or other external asset represented by that quantity.

## Product model

A Resource names a countable quantity. A Budget is the only public stateful governance object: it owns a fixed Resource membership and quantity, can fund child Budgets, and settles reported use. Defining a Resource creates no quantity, and existing Budgets cannot receive top-ups or new members.

The permanent [accounting reference](reference/accounting.md) defines Resource identity, Budget membership and funding, requests, the quantity journal, usage, deficits, settlement, inspection and history. The [command reference](reference/commands.md) defines validation, authorization, atomicity, denials, replay and operation recovery. Those references own the detailed rules shared by every deployment mode.

## Application-owned decisions

Customers decide what work is worth doing. A customer Policy can return a typed request or stop the operation before Keynes sees it. It can run in application code, customer SQL, a customer service or later Keynes Cloud. Optional Policy middleware and helpers remain customer-owned tooling rather than an allocation prerequisite.

Keynes receives the final Resource envelope and independently checks permission, Budget state and live quantity. Caller-supplied decision evidence is bounded and replay-bound, but it grants no authority and does not prove that evaluation ran. Replay never reruns customer logic or an external effect. Customers own policy definitions, inputs, parameter selection, failures, fallback, recomputation, application transactions and provider recovery.

This boundary lets applications change decision logic without changing the accounting authority. [ADR-0013](adr/0013-application-owned-policies.md) records the governing decision; [ADR-0014](adr/0014-policy-middleware-in-budget-requests.md) and [ADR-0015](adr/0015-direct-policy-decisions-and-command-result-lookup.md) define the optional request integration. The [Policy package](../packages/policy/README.md) owns its public helpers, and the [SDK package](../packages/sdk/README.md) owns TypeScript request shapes.

## Deployment choices

Keynes is one resource-governance product with three deployment modes. Each
mode implements the same Budget contract: Resource definitions,
requests, settlement, replay, inspection, accounting, and history have the
same public meaning.

| Mode     | Where a Budget lives                                 | What it is for                                            | Mode-specific capability                                                          |
| -------- | ---------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Local    | Private in-memory Node SQLite in one process         | Fast, isolated development and disposable work            | Requires no service or database setup; state ends with the process                |
| Hosted   | A PostgreSQL authority separate from the application | Durable shared governance across applications and workers | The operator manages durable access, credentials, capacity, recovery, and support |
| Embedded | The application's PostgreSQL installation            | Governance that must commit with application data         | The application calls canonical procedures inside its own transaction             |

Hosted may be customer-operated or managed by Keynes. Those choices change who
operates the service; they do not change Budget behavior. No mode automatically
moves a live Budget to another authority.

The SDK uses separate SQLite and PostgreSQL runtime packages with shared command contracts and conformance scenarios. Select `nodeSqlite()` from `@keynes/node-sqlite` for Local, or `postgres(...)` from `@keynes/postgres` for an owned remote connection or a borrowed PostgreSQL client. The SDK itself contains no engine or database driver. Borrowed clients expose the basic Budget API; owned remote clients also provide durable references, reopening, and `getOperationResult`.

`getOperationResult` reads a command receipt. It can report `committed`, `known_failure`, `unresolved`, `not_found`, or `expired`. The read never retries, allocates, invokes Policy, or creates a replacement key. A missing or expired receipt does not prove that a delayed command cannot arrive.

First Local is ephemeral and process-owned. It exposes no persistence or database handle and promises no browser support, multi-process coordination or caller-owned PostgreSQL transactions. PostgreSQL remains the durable implementation under this contract. The Hosted SDK currently connects directly to PostgreSQL, with no HTTP Budget service or fallback to local state.

Keynes TypeScript packages support Node.js 24 and later. The package engine
range does not exclude an intermediate or end-of-life major. Production
deployments should use a release that the Node.js project still supports.
Keynes compatibility does not provide Node.js security maintenance.

PostgreSQL supports two access surfaces: direct procedures for trusted Embedded callers and constrained remote wrappers that derive identity from the authenticated login role. The current installation command uses one fixed preview profile; it does not expose an access-profile selector. Borrowed SDK use requires the existing direct grants and caller context.

`remote` names an access surface, not a fourth product mode or public IAM product. Hosted delivery, whether customer-operated or managed by Keynes, needs its own security, recovery and operational evidence.

### Shared behavior and mode-specific capabilities

A change to Budget semantics belongs in the shared contract. That includes
Resource accounting, request validation, quantity transfers, settlement, replay,
and history. It must retain the same meaning in Local, Hosted, and Embedded.

A capability may be mode-specific when it changes how an application reaches
or operates Keynes without changing a Budget command's meaning. Local can favor
private, disposable execution. Hosted can add operation and administration
capabilities such as managed credentials, monitoring, backups, and recovery.
Embedded can compose a Keynes command with application writes in one PostgreSQL
transaction. These capabilities must not create a separate accounting model.

## Product ownership

Keynes owns Resource identity, Budget identity and lineage, quantity ownership, request validation, atomic allocation, replay, lifecycle, settlement, deficit evidence, chronological history and the supported SDK/procedure contracts. Database enforcement applies to supported calls regardless of which application language uses them.

Customers own workflow validity, evaluation logic and hosting, assessment validation, failures, fallback, parameter selection, recomputation, application transactions, external work, provider retries, usage observations and business outcomes. Released quantity does not perform a refund or restore provider quota.

Customers control their deployments. Keynes does not promise to prevent an owner bypassing controls they administer. Supported SQL access remains available to different application languages; TypeScript remains the only supported SDK.

## Developer setup and remote onboarding

The separate `@keynes/cli` application provides `keynes install --config <path>` for fresh PostgreSQL installation and exact recheck. Using the SDK does not require developer tools. Catalog type generation, definition preview/deployment and catalog compatibility checks remain KEY-108 work.

The remote catalog supplies application-specific Resource declarations. Optional application policy tooling owns its own typed interfaces and configuration.
Generated bindings can be committed for offline editing and reproducible builds.
Keynes generates the SDK's own command types from its central contracts during
its build. Neither kind of generated type grants database permissions.

Schema synchronization has explicit direction. Catalog reads generate local
bindings; authorized definition deployment creates missing immutable definitions
or reuses exact matches. Conflicts fail without overwriting existing definitions.
Ordinary initialization never deploys definitions. Database upgrades are separate
from catalog deployment and require a migration contract beyond the clean baseline.

Catalog capabilities are adopted targets, not available commands. KEY-96 establishes the installation CLI boundary; KEY-108 owns the remaining remote developer workflow. Manual declarations remain supported. Baseline Hosted continuity and complete developer onboarding
retain separate acceptance, and both are required for the Hosted product experience.

## Policy tooling and release scope

Keynes no longer ships or executes managed Policy definitions. Applications evaluate their own rules and may attach bounded caller evidence to an ordinary request. Evidence is retained for replay and history, but it is neither authorization nor proof that evaluation ran. The following roadmap issues cover optional customer-owned tooling and do not add a Policy runtime to allocation:

- [KEY-116](https://linear.app/keynes/issue/KEY-116) supplies JSON Schema-based typed parameter declarations and local snapshots.
- [KEY-117](https://linear.app/keynes/issue/KEY-117) supplied optional per-request Policy middleware plus configurable-policy and record helpers. [KEY-126](https://linear.app/keynes/issue/KEY-126) removed its separate preparation API. The [Policy package](../packages/policy/README.md) owns the current contract.
- [KEY-118](https://linear.app/keynes/issue/KEY-118) supplies fixture-based regression utilities.

These are required Local-preview capabilities, not allocation prerequisites. A workflow may construct requests directly. The SDK callback remains optional per request, and optional helpers do not impose a policy language or transaction manager on allocation.

[KEY-119](https://linear.app/keynes/issue/KEY-119) persisted parameters and [KEY-120](https://linear.app/keynes/issue/KEY-120) a schema-driven editor are required Cloud capabilities. Configuration, evaluation tooling and allocation have separate owners. [KEY-115](https://linear.app/keynes/issue/KEY-115) explores model judgments independently; no production provider integration is required for Local or Cloud.

[KEY-125](https://linear.app/keynes/issue/KEY-125) owns later versioned HTTP evaluation shared across applications, including Keynes Cloud hosting of customer-owned logic. Initial hosting evaluates only and stays outside authoritative Budget accounting. Mandatory evaluation-and-submission is deferred. This work adds no first Local or first Cloud gate.

## Later durability and delegation

[KEY-122](https://linear.app/keynes/issue/KEY-122) owns the detailed cross-authority accounting ADR and governing amendments. [KEY-123](https://linear.app/keynes/issue/KEY-123) adds durable Node Local recovery later. [KEY-124](https://linear.app/keynes/issue/KEY-124) delivers PostgreSQL-to-local delegation, active partial surrender and final reconciliation as required Cloud capabilities. Workers, workflows and steps use one Budget model.

This is direction for later work, not a distributed protocol defined here. Current fixed funding and one authority per Budget remain in force until the governing amendment. First Local stays ephemeral and its toolkit gates remain unchanged. [Linear](https://linear.app/keynes) owns current sequence and status; this document defines product commitments.

## Product commitments

- Budget remains the only public stateful governance object. Defining Resources creates no quantity.
- Database validation, permissions, fixed funding, exact accounting, settlement and deterministic replay remain mandatory. A valid request may be denied; customer evidence proves neither evaluation nor authority.
- There is no database-managed Policy registration/compiler/evaluator.
  Customer logic and optional tooling remain separate from allocation.
- First Local uses private in-memory Node SQLite; PostgreSQL owns Hosted/Embedded accounting through supported procedures. Separate runtime packages share canonical contracts and conformance scenarios from the private database source owner.
- Numeric range, decimals and rounding must be justified by product needs during runtime design. PostgreSQL numeric behavior is not a universal policy-language requirement; this documentation changes no numerical semantics.
- The active PostgreSQL baseline supports fresh install and exact read-only reinstall. Incompatible installations require recreation, not automatic upgrades or state migration.
- Historical specifications and evidence remain revision-scoped. Reconcile conflicting active artifacts when resumed. Target adoption is distinct from implementation and exact-revision qualification.
