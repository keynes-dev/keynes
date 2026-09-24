# Keynes: Runtime economics for agents

> **Status:** Adopted product direction. SQLite Local and PostgreSQL enforce
> accounting while customers compute requests and may attach bounded caller
> evidence. Managed SQL Policies are retired, and applications select separate
> runtime packages explicitly. Retained evidence proves only its recorded
> revision and verification lane.

## Thesis

Agents make choices that affect cost, speed, quality, and risk. They decide how
much to investigate, which tools to use, when to retry, and when to ask for
help. Businesses need a clear way to give agents operating limits without
scattering those limits through prompts and application code.

**Applications decide what work is worth doing. Keynes enforces the quantity
they are allowed to use.** Customers compute a typed request or reject an
operation. A Budget owns Resource quantities and may grant some to a child.
Keynes validates the request and atomically checks Budget authority, constraints
and available quantity. A valid request may still be denied. The application
does the work and reports usage; Keynes settles the accounting and returns
unused quantity.

```text
Budget -> request -> child Budget -> settle -> evidence
```

Keynes governs authority to use a quantity. It does not own the money, provider
quota, seat, token, or other external asset represented by that quantity.

## Product model

A Resource names a countable quantity. A Budget is the only public stateful
governance object: it owns a fixed Resource membership and quantity, can fund
child Budgets, and settles reported use. Defining a Resource creates no
quantity, and existing Budgets cannot receive top-ups or new members.

The permanent [accounting reference](reference/accounting.md) defines Resource
identity, Budget membership and funding, requests, the quantity journal, usage,
deficits, settlement, inspection and history. The
[command reference](reference/commands.md) defines validation, authorization,
atomicity, denials, replay and operation recovery. Those references own the
detailed rules shared by every deployment mode.

## Application-owned decisions

Customers decide what work is worth doing. A customer Policy can return a typed
request or stop the operation before Keynes sees it. It can run in application
code, customer SQL, or a customer service. Optional Policy middleware and
helpers remain customer-owned tooling rather than an allocation prerequisite.

Keynes receives the final Resource envelope and independently checks permission,
Budget state and live quantity. Caller-supplied decision evidence is bounded and
replay-bound, but it grants no authority and does not prove that evaluation ran.
Replay never reruns customer logic or an external effect. Customers own policy
definitions, inputs, parameter selection, failures, fallback, recomputation,
application transactions and provider recovery.

This boundary lets applications change decision logic without changing the
accounting authority. [ADR-0002](adr/0002-application-owned-policies.md) records
the governing decision. The [Policy package](../packages/policy/README.md) owns
its public helpers, and the [SDK package](../packages/sdk/README.md) owns
TypeScript request shapes.

## Deployment choices

Keynes is one resource-governance product with three deployment modes. Each mode
implements the same Budget contract: Resource definitions, requests, settlement,
replay, inspection, accounting, and history have the same public meaning.

| Mode     | Where a Budget lives                                 | What it is for                                            | Mode-specific capability                                                          |
| -------- | ---------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Local    | Private in-memory Node SQLite in one process         | Fast, isolated development and disposable work            | Requires no service or database setup; state ends with the process                |
| Hosted   | A PostgreSQL authority separate from the application | Durable shared governance across applications and workers | The operator manages durable access, credentials, capacity, recovery, and support |
| Embedded | The application's PostgreSQL installation            | Governance that must commit with application data         | The application calls canonical procedures inside its own transaction             |

The Hosted operator owns service administration without changing Budget
behavior. No mode automatically moves a live Budget to another authority.

The [architecture](architecture.md#deployment-ownership) owns package, access,
and connection details for these modes. The [SDK](../packages/sdk/README.md),
[Node SQLite](../packages/node-sqlite/README.md), and
[PostgreSQL](../packages/postgres/README.md) guides own their current APIs and
limits.

### Shared behavior and mode-specific capabilities

A change to Budget semantics belongs in the shared contract. That includes
Resource accounting, request validation, quantity transfers, settlement, replay,
and history. It must retain the same meaning in Local, Hosted, and Embedded.

A capability may be mode-specific when it changes how an application reaches or
operates Keynes without changing a Budget command's meaning. Local can favor
private, disposable execution. Hosted can add operation and administration
capabilities such as managed credentials, monitoring, backups, and recovery.
Embedded can compose a Keynes command with application writes in one PostgreSQL
transaction. These capabilities must not create a separate accounting model.

## Product ownership

Keynes owns Resource identity, Budget identity and lineage, quantity ownership,
request validation, atomic allocation, replay, lifecycle, settlement, deficit
evidence, chronological history and the supported SDK/procedure contracts.
Database enforcement applies to supported calls regardless of which application
language uses them.

Customers own workflow validity, evaluation logic and hosting, assessment
validation, failures, fallback, parameter selection, recomputation, application
transactions, external work, provider retries, usage observations and business
outcomes. Released quantity does not perform a refund or restore provider quota.

Customers control their deployments. Keynes does not promise to prevent an owner
bypassing controls they administer. Supported SQL access remains available to
different application languages; TypeScript remains the only supported SDK.

## Developer setup and remote onboarding

Current setup supports manual declarations and `keynes install --config <path>`
for fresh PostgreSQL installation and exact recheck. Catalog generation,
preview, deployment, and compatibility remain adopted targets rather than
available commands. The [Developer CLI](architecture.md#developer-cli) and
package guides own the current mechanics.

## Policy tooling and release scope

Keynes no longer ships or executes managed Policy definitions. Applications
evaluate their own rules and may attach bounded caller evidence to an ordinary
request. Evidence is retained for replay and history, but it is neither
authorization nor proof that evaluation ran.

The optional [Policy package](../packages/policy/README.md) owns typed
parameters, local snapshots, configurable Policy helpers, portable records and
fixture-based regression tools. These are Local-preview capabilities, not
allocation prerequisites. A workflow may construct requests directly, and
optional helpers do not impose a policy language or transaction manager.

## Later durability and delegation

Later work requires a detailed cross-authority accounting ADR before adding
durable Node Local recovery or PostgreSQL-to-local delegation with active
partial surrender and final reconciliation. Workers, workflows and steps
continue to use one Budget model.

This is direction for later work, not a distributed protocol defined here.
Current fixed funding and one authority per Budget remain in force until the
governing amendment. First Local stays ephemeral and its toolkit gates remain
unchanged.

## Product commitments

- Budget remains the only public stateful governance object. Defining Resources
  creates no quantity.
- Database validation, permissions, fixed funding, exact accounting, settlement
  and deterministic replay remain mandatory. A valid request may be denied;
  customer evidence proves neither evaluation nor authority.
- There is no database-managed Policy registration/compiler/evaluator. Customer
  logic and optional tooling remain separate from allocation.
- First Local uses private in-memory Node SQLite; PostgreSQL owns
  Hosted/Embedded accounting through supported procedures. Separate runtime
  packages share canonical contracts and conformance scenarios from the private
  database source owner.
- Numeric range, decimals and rounding must be justified by product needs during
  runtime design. PostgreSQL numeric behavior is not a universal policy-language
  requirement; this documentation changes no numerical semantics.
- The active PostgreSQL baseline supports fresh install and exact read-only
  reinstall. Incompatible installations require recreation, not automatic
  upgrades or state migration.
- Historical specifications and evidence remain revision-scoped. Reconcile
  conflicting active artifacts when resumed. Target adoption is distinct from
  implementation and exact-revision qualification.
