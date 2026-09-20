# Keynes: Runtime economics for agents

> **Status:** Adopted target contract. The application-computed request boundary in [ADR-0013](adr/0013-application-owned-policies.md) is implemented: SQLite Local and PostgreSQL enforce accounting while customers compute requests and may attach bounded caller evidence. KEY-114 retired managed SQL Policies; KEY-96 package separation remains a target. [Linear](https://linear.app/keynes) owns delivery and roadmap status; retained evidence proves only its recorded revision and verification lane.

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

## Resources

A Resource is one immutable, tenant-scoped definition for a countable quantity.
The application supplies a canonical name, a unit, and an accounting behavior.
The selected authority issues its stable private identity.

- A `consumable` Resource loses quantity when the application reports use.
- A `reusable` Resource records use as evidence and releases its quantity
  when the owning Budget settles.

`keynes.defineResources({...})` is the independent definition operation. It
accepts a plain TypeScript object and atomically defines or exact-reuses every
entry. It returns one immutable, typed, quantity-free `ResourceBinding`.
Repeating a name with a different definition fails without changing authority
state.

The SDK may export a `ResourceDefinitions` type for `satisfies` checks. It
does not expose a standalone definition helper outside a Keynes authority.

A Resource binding is not a public database identifier or a persisted transport
format. Configured Budget creation does not take a binding per Budget.

Applications configure a client with Resource declarations. Local initialization
establishes a private ephemeral catalog from those declarations. Durable
initialization validates every supplied definition against the persisted tenant
catalog. Missing or conflicting definitions fail; additional persisted Resources
remain compatible. Initialization and Budget creation never persist shared
Resource definitions. Shared definitions require explicit provisioning.

Defining a Resource creates no quantity. Live quantity exists only on Budgets.
Keynes has no tenant Resource pool, inventory account, or unattached balance.

## Application-owned policies

A policy is customer-owned logic that produces a typed Keynes request or rejects an operation. Customers may use ordinary application code, SQL over their own data, or optional policy helpers. Allocation requires no Policy result type, callback signature, or transaction manager.

Customers own evaluation, input validation, parameter selection, failures, fallback, transactions and recomputation. A structured model assessment may inform their decision, but the customer validates it and handles unavailable or malformed responses before constructing a request. An assessment or evaluation record is not Budget authority. Caller-supplied decision evidence is never proof that policy executed.

Customer ownership does not dictate where evaluation runs. It may run inside an application, in a customer-operated service or later in Keynes Cloud. Applications can share one policy deployment. Later hosted evaluation remains outside authoritative accounting and does not restore database-managed Policies.

See the [equivalent application-code and SQL examples](architecture.md#customer-evaluation-and-request-construction) for request construction, rejection and replay boundaries.

### Current request boundary

KEY-114 retired managed SQL Policy authoring, attachment, and evaluation from the runtime and generated contracts. A request can include normalized `decisionEvidence`; it is replay-bound and retained in results and history, but it cannot grant authority or attest to an evaluation. Retired Policy fields are invalid rather than ignored. The [SDK request example](../packages/sdk/README.md#submit-application-computed-requests) shows the supported public shape.

## Budgets

A Budget is the only public stateful governance object. It has immutable
Resource membership, immutable behavior controls, one
structural parent, and one lifecycle.

Every Budget exposes `request`, `settle`, and `inspect`. The immutable
`allows.createChildren` value controls whether an active Budget may request a
child. Omitting `allows` enables child creation. A child chooses its own value;
it does not inherit or receive a subset of its parent's behavior controls.

Disabled operations reject asynchronously with
`budget_operation_not_allowed` and change no state. These controls describe
Budget behavior. They are not caller roles, grants, or an SDK IAM system.
Database authorization remains below the public SDK.

Every public SDK method that returns a Promise reports validation, lifecycle,
and operation failures by rejecting that Promise. It does not throw those
failures synchronously.

## Creation and funding

Configure Resource declarations once, then supply amounts to `createBudget`:

```ts
const resources = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  reviewSeats: { unit: "seat", accountingBehavior: "reusable" },
};

const keynes = await createKeynes({ resources });

const root = await keynes.createBudget({
  usdCents: 1_000,
  reviewSeats: 0,
});
```

The client infers allowed names from its declarations, including when creation
amounts come from a separately declared variable. Unknown names reject at both
development time and runtime. Creation takes an amounts object without an
`initial` field or per-Budget definitions or bindings.

The supplied amount keys establish the root's complete membership. Explicit zero
includes a Resource without a quantity movement; omission excludes it. Adding
declarations to a client never expands Budget membership. A non-empty amounts
object containing only explicit zeros creates a valid all-zero root that cannot
later acquire funding. Empty amounts reject.

Creation validates and resolves the declared Resources without shared definition writes. It creates membership, funding, and the command result atomically or leaves no partial Budget. [KEY-78's specification](features/key-78-create-budgets-from-resource-definitions-or-bindings/spec.md) owns acceptance, and [ADR-0011](adr/0011-configured-resource-declarations.md) records the revised creation decision.

To use PostgreSQL, an operator first provisions the durable catalog with `defineResources`. `createKeynes({ resources, databaseUrl })` then performs read-only compatibility validation. The client can create only from its configured names. Declarations do not grant permission or create catalog rows. Local creation takes amounts only. Remote creation accepts only `{ operationKey? }`; request options carry optional `decisionEvidence` and, remotely, an `operationKey`.

Root creation introduces the tree's complete funding. A child's complete grant
comes from its parent at creation. Existing
Budgets cannot receive top-ups, replenishment, or additional grants. The database
enforces this for every supported caller. Settlement returns can restore parent
availability without increasing the tree's initial funding.

Applications create new roots for new allowances and may reuse the same Resource
definitions. Each root has independent funding, lineage, and accounting. There is
no automatic rollover, balance migration, or reopening of settled roots. Creating
a new root does not require unrelated roots to be settled first. Authorization
to create roots remains the boundary for introducing new allowances; fixed
funding does not impose a shared ceiling across independently created roots.

Insufficient availability causes a request denial, not automatic settlement.
Quantity may still be held by children and return later. Missing usage and
outstanding descendants remain unresolved until the normal settlement rules apply.

## Child Budgets

A request proposes the exact Resources and quantities for one child. Its keys
become the child's complete membership. A key with amount zero belongs to the
child. A parent Resource omitted from the request does not.

The authority validates the submitted request, enforces permissions and Budget constraints, and checks live available quantity. It either records a quantity denial or transfers the requested quantity to a new child; invalid or unauthorized commands reject without allocation.
Approval removes quantity from the parent and gives it to the child in the same
transaction. The authority never creates a visible reservation or partially
created child. That creation grant is the child's complete funding; it may
subdivide owned quantity among its own children and receive their remainders
through settlement. These returns do not increase the original grant.

## Settlement

Every Budget reports its own direct usage. Missing usage remains unresolved.
Overage remains visible as deficit evidence. Keynes does not infer zero, create
negative quantity, or debit an ancestor to hide a deficit.

For a consumable Resource, Keynes consumes owned quantity up to the reported
use and records any excess as deficit. For a reusable Resource, Keynes records
use without consuming quantity. Reusable use above owned quantity also creates
deficit evidence.

A Budget with incomplete direct usage or a non-settled child is
`settling`. Subsequent `settle` calls may report an omitted Resource;
an explicit zero reports that it had no use. The Budget cannot create children,
but existing active descendants continue under their own
behavior controls. A Budget becomes `settled` only after its direct usage
is complete and every child is `settled`. A settled Budget can never have
an active or settling descendant.

The final descendant settlement atomically finalizes every newly unblocked
ancestor. The immediate result describes only the Budget targeted by that
command. `inspect()` and chronological history show later ancestor
finalizations.

Final settlement removes all live quantity from the Budget:

- A non-root Budget returns its complete remainder to its structural parent.
- A root releases its complete remainder outside Keynes governance.

`released` means unused quantity left Keynes governance without being
consumed. It does not mean that Keynes refunded money, restored provider quota,
or performed another external action.

For each root tree and Resource:

```text
initial root funding = live quantity + consumed quantity + released quantity
```

For a completely settled tree, `live = 0`. Transfers inside the tree cancel
from the equation. Reusable use and deficit are evidence, not quantity
movements. Fixed funding bounds authorized quantity, not actual external usage;
applications can report overage, which remains deficit evidence.

## Loading, types, and history

Durable Budgets have opaque `BudgetReference` values. `loadBudget(reference)` sends only that reference. PostgreSQL returns authoritative membership, behavior controls, balances, lifecycle and lineage. Loading never defines, duplicates or overwrites state, and a reference grants no permission.

Catalog generation supplies typed Resource declarations with runtime definition information. Client initialization validates them against the persisted catalog without provisioning. Generated types can become stale; database validation remains authoritative. The target does not generate database-managed Policy bindings or require a Policy catalog. Optional application tooling owns its parameter and helper types.

`inspect()` returns one coherent snapshot and chronological lineage history. Recorded customer decision evidence remains caller-supplied, never a claim that Keynes evaluated a policy. Historical managed Policy records retain their revision-specific meaning.

## Replay and external work

Each mutation has one command identity. Exact retry returns the stored result.
Reusing the identity with different canonical input returns
`command_conflict`. The SDK generates operation keys for ordinary remote
calls. A caller supplies one in `createBudget` options for crash recovery or an
ambiguous remote response. Recovery checks current permission and the selected
catalog before it returns a committed creation result.

Replay covers Keynes state only and never reruns customer policy, queries customer tables or invokes a model. An exact denied command remains that recorded denial even if availability changes. Customers own recomputation and a new attempt under the command identity contract, along with provider idempotency, workflow recovery and external effects.

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

The target uses separate SQLite and PostgreSQL accounting implementations outside the SDK, sharing command contracts and conformance scenarios. A shared TypeScript engine is not a prerequisite. KEY-96 owns explicit runtime selection and exact package exports. Today the combined SDK uses `createKeynes({ resources })` for SQLite Local and `createKeynes({ resources, databaseUrl })` for server access; new runtime distributions are not yet implemented.

First Local is ephemeral and process-owned. It exposes no persistence or database handle and promises no browser support, multi-process coordination or caller-owned PostgreSQL transactions. PostgreSQL remains the durable implementation under this contract. The Hosted SDK currently connects directly to PostgreSQL, with no HTTP Budget service or fallback to local state.

Keynes TypeScript packages support Node.js 24 and later. The package engine
range does not exclude an intermediate or end-of-life major. Production
deployments should use a release that the Node.js project still supports.
Keynes compatibility does not provide Node.js security maintenance.

Every PostgreSQL installation selects one access profile:

- `embedded` grants an application role the canonical procedures used
  inside caller-owned transactions.
- `remote` grants login roles only the constrained Hosted procedures and
  derives Keynes identity from the authenticated PostgreSQL role.

`remote` is an access-profile name, not a fourth product mode. This installation
choice is not a public IAM product. Hosted delivery, whether customer-operated
or managed by Keynes, needs its own packaging, security, recovery, and
operational evidence.

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

The adopted `keynes` CLI lets a developer install and verify Keynes in PostgreSQL,
generate application types from a selected remote catalog, preview and explicitly
deploy Resource definitions, and check compatibility. It is a separate
`@keynes/cli` application; using the SDK does not require installing developer tools.

The remote catalog supplies application-specific Resource declarations. Optional application policy tooling owns its own typed interfaces and configuration.
Generated bindings can be committed for offline editing and reproducible builds.
Keynes generates the SDK's own command types from its central contracts during
its build. Neither kind of generated type grants database permissions.

Schema synchronization has explicit direction. Catalog reads generate local
bindings; authorized definition deployment creates missing immutable definitions
or reuses exact matches. Conflicts fail without overwriting existing definitions.
Ordinary initialization never deploys definitions. Database upgrades are separate
from catalog deployment and require a migration contract beyond the clean baseline.

These capabilities are adopted targets, not available commands. KEY-96 establishes
the CLI boundary; KEY-108 delivers the remote developer workflow. Manual declarations
remain supported. Baseline Hosted continuity and complete developer onboarding
retain separate acceptance, and both are required for the Hosted product experience.

## Policy tooling and release scope

Keynes no longer ships or executes managed Policy definitions. Applications evaluate their own rules and may attach bounded caller evidence to an ordinary request. Evidence is retained for replay and history, but it is neither authorization nor proof that evaluation ran. The following roadmap issues cover optional customer-owned tooling and do not add a Policy runtime to allocation:

- [KEY-116](https://linear.app/keynes/issue/KEY-116) supplies JSON Schema-based typed parameter declarations and local snapshots.
- [KEY-117](https://linear.app/keynes/issue/KEY-117) supplies optional policy definitions, deterministic composition, prepared requests and evaluation records.
- [KEY-118](https://linear.app/keynes/issue/KEY-118) supplies fixture-based regression utilities.

These are required Local-preview capabilities, not allocation prerequisites. A workflow may construct requests directly. Optional helpers can define typed interfaces without imposing a policy language, result type, callback, or transaction manager on allocation.

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
- First Local uses private in-memory Node SQLite; PostgreSQL owns Hosted/Embedded accounting through supported procedures. Separate runtime packages belong to KEY-96, with shared contracts and conformance scenarios.
- Numeric range, decimals and rounding must be justified by product needs during runtime design. PostgreSQL numeric behavior is not a universal policy-language requirement; this documentation changes no numerical semantics.
- The active PostgreSQL baseline supports fresh install and exact read-only reinstall. Incompatible installations require recreation, not automatic upgrades or state migration.
- Historical specifications and evidence remain revision-scoped. Reconcile conflicting active artifacts when resumed. Target adoption is distinct from implementation and exact-revision qualification.
