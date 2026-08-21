# Keynes — Runtime economics for agents

> **Status:** This document defines the target product. The runtime, Policy
> sandbox, deployment packages, and cross-host conformance evidence are not yet
> implemented or qualified. The [architecture](architecture.md) defines the
> corresponding runtime boundaries and release gates.

## Thesis

Agents make decisions that affect cost, speed, quality, and risk. They decide
how deeply to investigate, which tools to use, when to retry, and when to ask
for help. A business needs those decisions to remain within real operating
authority without hiding the authority in prompts or scattering limits across
application code.

Keynes makes that authority explicit. An application publishes the Resource
types it governs, and a Budget holds quantities of those Resources together with
the Policies that constrain how they can be spent. Any team, workflow, or agent
can request Resources from a Budget. Keynes responds atomically: it either
denies the request, or reserves the Resources and returns a new child Budget.
The application does its work and settles the Budget when it can confirm the
Resource usage.

The product loop is:

```text
Budget -> request -> child Budget -> settle -> evidence
```

## Budgets

Before a Budget can hold a Resource, the application publishes its immutable
type. A Resource type has a stable identity, an application-defined name and
unit, and one Keynes-defined accounting behavior. Publishing a type creates no
quantity and grants no spending authority.

An authorized root allocation creates quantity for selected published Resource
types. A root holds only those allocations; it does not declare every type the
application may ever use. The default request path funds a child from its
structural parent. A Budget can delegate only Resources it holds, and a child
can re-delegate only its own remaining holdings.

```ts
const result = await supportBudget.request({
  resources: {
    usdCents: 25,
    searchQueries: 2,
  },
});

if (result.status === "approved") {
  await runWorkflow(result.budget);
} else {
  handleDenial(result.reasons);
}
```

The request names the exact Resource envelope the child Budget will receive from
its parent. The application decides what to do with responses and constructs
another request if it wants another envelope.

A successful request is an atomic transition: Keynes evaluates the parent
Budget's Policies, checks availability, reserves the Resources, creates the
child, and records the result.

The local SDK assigns an internal command identity to each call and reuses it if
it must retry that same invocation. Two separate `request(...)` calls remain two
separate requests, even when their bodies are identical. Application developers
do not create idempotency keys for process-scoped Budget operations. Durable
PostgreSQL and Cloud operations use durable command identities when a retry may
cross an invocation or process boundary.

The Resource type boundary supports two explicit extensions without changing
this default path. Keynes qualifies authorized subtree issuance first. It
creates quantity for an existing Resource type only within one child subtree and
under a separate issuer permission. Same-database multi-source funding follows,
keeping one structural parent while ordered contributions come from other
authorized Budgets. Cross-database composition is invalid. Each extension enters
the product only after its authorization, conservation, settlement, replay,
recovery, and conformance evidence is complete.

## Resource Policies

A Resource Policy is a narrow, declarative constraint on a Budget's requests. It
compares a Resource request with a small immutable context record and produces
ceilings on Resources held by that Budget.

Policies are complete, read-only PostgreSQL `SELECT` statements. They use
familiar SQL, but they do not receive general database access. Keynes exposes
only command-scoped views of the requested Resources, application-supplied
context, and the parent Budget's available holdings. Policies cannot inspect
Keynes storage, application tables, secrets, history, or unrelated requests.

The generated SDKs provide a typed relational builder as the default authoring
experience. It compiles to the same SQL Policy envelope that the database
validates and executes. Advanced users can publish raw SQL as an explicit
lower-level escape hatch; it receives the same validation and sandboxing.

For example, a support Budget can limit lower-priority work to 25 cents and two
searches:

```sql
WITH request_facts AS (
  SELECT MAX(CASE WHEN resource_name = 'search_queries' THEN amount END)
    AS search_queries
  FROM keynes_policy_request
),
context_facts AS (
  SELECT MAX(CASE WHEN field_name = 'priority' THEN text_value END)
    AS priority
  FROM keynes_policy_context
)
SELECT 'usd_cents' AS resource_name,
       25 AS ceiling,
       'low_priority_limit' AS reason
FROM request_facts, context_facts
WHERE search_queries > 0
  AND priority NOT IN ('high', 'urgent')
UNION ALL
SELECT 'search_queries',
       2,
       'low_priority_limit'
FROM request_facts, context_facts
WHERE search_queries > 0
  AND priority NOT IN ('high', 'urgent');
```

Context contains application assertions that govern the current request. Every
Policy sees the same immutable snapshot. Keynes validates the exact fields and
types declared by those Policies and records the canonical context in decision
evidence. Secrets do not belong in Policy context. Policies are not inherited by
child Budgets.

Policies constrain Resources. Things like ticket eligibility, actor permissions,
task meaning, fallback behavior, and external side effects belong to the
application, unless they determine a Resource ceiling.

When several Policies return ceilings, their ceilings intersect by Resource. The
lowest ceiling wins. A zero ceiling denies a positive request for that Resource.
Returning no rows adds no constraint. Invalid SQL, an execution limit, or an
invalid result fails the request rather than becoming an approval or denial.

Child Policies never propagate from the parent. Omitting `policies` means the
same canonical empty local Policy set as `policies: []`. The Policy-free child
is still limited by the exact Resources it received, Resource conservation,
availability, accounting, and settlement.

## Settlement

An approved Budget is an authority and accounting scope. Keynes does not
execute, track, or retry application-level effects. The application may use the
child Budget's Resources for local work, provider calls, further child Budgets,
or any combination its workflow requires.

The application owns execution, provider idempotency, and recovery from
ambiguous provider responses. Request idempotency prevents duplicate Budget
creation; it does not make application effects idempotent.

Every Budget settles its own direct usage:

```ts
await childBudget.settle({
  usage: {
    usdCents: 19,
    searchQueries: 2,
  },
});
```

Settlement accepts usage only. Keynes derives whether the Budget is `settling`
or `settled` from usage completeness and descendant state. Business outcomes
remain in application-owned evidence and never enter the settlement command.

Keynes derives subtree usage from settled descendants. A Budget with unsettled
descendants is `settling`. In this stage, it seals direct usage, rejects new
child requests, allows existing descendants to finish, and retains their
Resources. It becomes `settled` when every blocker resolves.

Missing usage remains unresolved. Known use above the accepted request becomes
an isolated deficit on that child. Keynes never silently records missing usage
as zero or debits an ancestor to hide an overage.

Timers, callbacks, monitoring adapters, and reconciliation workflows deliver
usage evidence to application code that owns the Budget. Local state disappears
with its `Keynes.local()` runtime. Durable deployments can reload a Budget by
its stable identifier, but the identifier only locates state; the caller's
database role or Cloud identity authorizes settlement. A downstream reporter
does not decide that a Budget is ready to settle.

## Honest authority and accounting

Applications name Resources in their own vocabulary and count them in
non-negative safe-integer units. A published Resource type declares one
accounting behavior:

- **Consumable** Resources permanently consume recorded usage and return any
  reliably unused amount.
- **Reusable** Resources remain held while a descendant is active and return in
  full after the relevant subtree settles.

External enforcement and usage validation belong to the application (or a future
adapter), not the Resource declaration. Settlement records known usage, missing
evidence, and overage uniformly for both Resource behaviors.

## One model, three deployments

Keynes implements Budget authority once in a PostgreSQL authority core. The same
versioned procedures, Policy environment, and evidence model run in three
supported hosts. SDKs and the public SQL interface call that core; they do not
reimplement Budget transitions.

**Local PGlite** is the zero-service TypeScript experience. `Keynes.local()`
starts a private, in-memory PGlite database inside the application process. It
requires no Keynes account, network service, database installation, daemon, or
platform-specific native library. Process exit discards every local Budget,
descendant, command result, and event. File-backed local persistence is not a
supported deployment.

**Customer PostgreSQL** installs the same authority core in a customer-owned
database. Applications can use generated TypeScript, Python, or Go SDKs, or the
versioned `keynes_v1` SQL API. This deployment keeps Budget data under customer
control and lets an application commit an approved request with its own job or
outbox row in one transaction. An approval inside that transaction remains
provisional until commit and cannot authorize external work before then.

**Keynes Cloud** runs the authority core on managed PostgreSQL behind an
authenticated service. Keynes owns tenant routing, upgrades, recovery, and high
availability. Clients never receive database credentials or arbitrary SQL
access. Cloud is the hosted choice when Budget authority must be durable and
remotely accessible without customer-operated PostgreSQL.

Customer PostgreSQL and Cloud persist Budget identities, command results, and
evidence. They can reload an authorized Budget and resolve a lost response by
replaying the same durable command identity. Local, customer PostgreSQL, and
Cloud keep the same Budget workflow even though their lifecycle, security, and
operational responsibilities differ.

## Product boundary

The application owns workflow validity, request construction, context
assertions, effects, provider retries, usage observation, outcomes, fallback
behavior, and analysis of completed evidence.

Keynes owns immutable Resource type identity, Budget identity and lineage,
Resource conservation and availability, canonical Resource Policy evaluation,
atomic child creation, idempotent command replay, settlement state, direct and
subtree accounting, unresolved usage, isolated deficits, canonical evidence, and
the public database and SDK contracts.

Keynes does not own study design, scoring, statistics, recommendations, or
application operating decisions. An application-owned harness may consume Keynes
evidence, but that harness is not part of the Keynes runtime or product
contract.

## Product commitments

- Budget is the only public stateful governance object.
- Resource types are immutable definitions published separately from quantity;
  publication creates no authority.
- An authorized root allocation creates quantity for selected published Resource
  types. Ordinary requests cannot create quantity.
- A request proposes one exact Resource envelope and atomically creates one
  child Budget or returns a denial. The structural parent funds every scalar
  request.
- Policies are optional, narrow Resource constraints evaluated by the database
  that holds the Budget.
- Policies are read-only SQL over a small, immutable command view. Typed SDK
  builders are the default authoring path, and raw SQL is the lower-level escape
  hatch.
- Request context is one typed, immutable, application-asserted record and does
  not flow into the child.
- Child Policies are optional, local to the child, and never propagate from the
  parent.
- Keynes never changes a request or executes, tracks, or retries application
  effects.
- Every Budget settles direct usage, while Keynes derives subtree accounting.
- Missing usage and overage remain visible instead of becoming accounting
  fiction.
- One PostgreSQL authority core defines Budget behavior in local PGlite,
  customer-owned PostgreSQL, and managed Keynes Cloud.
- Local authority is private and process-scoped. Customer PostgreSQL and Cloud
  provide durable, reloadable authority with explicit authorization and recovery
  responsibilities.
- Customer PostgreSQL can commit Budget authority with application-owned rows
  without moving application effects into Keynes.
- Keynes qualifies subtree issuance before same-database multi-source funding.
  Both use explicit contracts and preserve the parent-funded default.
- Product expansion follows conformance evidence and demonstrated workflow
  value.
