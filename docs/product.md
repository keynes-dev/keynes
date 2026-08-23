# Keynes: Runtime economics for agents

> **Status:** This document describes the product Keynes intends to become. The runtime, Policy sandbox, deployment packages, and cross-host conformance evidence do not exist yet. The [architecture](architecture.md) defines the runtime boundaries and release gates.

## Thesis

Agents make choices that affect cost, speed, quality, and risk. They decide how much to investigate, which tools to use, when to retry, and when to ask for help. Businesses need to give agents real operating authority without burying it in prompts or scattering limits through application code.

Keynes makes that authority explicit. An application publishes the Resource types it governs. A Budget holds quantities of those Resources and the Policies that control how an agent may spend them. A team, workflow, or agent requests Resources from a Budget. Keynes either denies the request or reserves the Resources and returns a child Budget. The application does the work, then settles the Budget once it knows what was used.

The product loop is simple:

```text
Budget -> request -> child Budget -> settle -> evidence
```

## Budgets

Before a Budget can hold a Resource, the application publishes an immutable Resource type. The type has a stable identity, an application-defined name and unit, and one Keynes-defined accounting behavior. Publishing a type creates no quantity and grants no spending authority.

An authorized root allocation creates quantity for selected Resource types. A root holds only those allocations. It does not declare every type the application may use. By default, a Budget funds its own children. It can delegate only Resources it holds, and a child can re-delegate only what remains in that child.

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

The request names the exact quantities the child will receive. Keynes does not revise the request. If the application wants different quantities after a denial, it sends another request.

An approval is one atomic change. Keynes evaluates the parent's Policies, checks availability, reserves the Resources, creates the child, and records the result together.

The local SDK assigns an internal command identity to each call and reuses it when it retries that invocation. Two separate `request(...)` calls are two requests, even when their bodies match. Application developers do not create idempotency keys for process-scoped Budget operations. Durable PostgreSQL and Cloud operations use durable command identities when retries may cross invocation or process boundaries.

Keynes may later add two explicit ways to create or combine authority without changing this default. Authorized subtree issuance would create quantity for an existing Resource type inside one child subtree under a separate issuer permission. Same-database multi-source funding would keep one structural parent while taking ordered contributions from other authorized Budgets. Cross-database composition is invalid. Keynes will add each extension only after it has evidence for authorization, conservation, settlement, replay, recovery, and conformance.

## Resource policies

A Resource Policy constrains how many Resources a Budget may receive. It compares a request with a small immutable context record and returns ceilings for one or more Resources.

Policies are complete, read-only PostgreSQL `SELECT` statements. They use familiar SQL without receiving general database access. Keynes exposes command-scoped views of the requested Resources, application-supplied context, and the parent Budget's available holdings. A Policy cannot inspect Keynes storage, application tables, secrets, history, or unrelated requests.

The TypeScript SDK includes a typed relational builder. It compiles to the same SQL Policy format that the database validates and runs. Advanced users and non-TypeScript applications can publish raw SQL through the public database interface. Keynes applies the same validation and sandbox to both forms.

For example, a support Budget can limit lower-priority work to 25 cents and two searches:

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

Context contains the application's claims about the current request. Every Policy sees the same immutable snapshot. Keynes checks that the fields and types match the Policy declarations, then records the canonical context with the decision evidence. Secrets do not belong in Policy context. Context does not pass to the child.

Policies constrain Resources. The application remains responsible for ticket eligibility, actor permissions, task meaning, fallback behavior, and external side effects unless one of those facts determines a Resource ceiling.

When several Policies return ceilings for the same Resource, the lowest ceiling wins. A zero ceiling denies a positive request. No rows means no added constraint. Invalid SQL, an execution limit, or an invalid result fails the request. Keynes does not turn a Policy error into an approval or denial.

A child does not inherit Policies from its parent. Omitting `policies` has the same canonical meaning as `policies: []`. A child without local Policies is still limited by the Resources it received and by Keynes's conservation, availability, accounting, and settlement rules.

## Settlement

An approved Budget is both spending authority and an accounting scope. Keynes does not execute, track, or retry application work. The application can use a child Budget for local work, provider calls, more child Budgets, or any combination its workflow needs.

The application owns execution, provider idempotency, and recovery from ambiguous provider responses. Request idempotency prevents duplicate Budget creation. It cannot make provider calls or other application effects idempotent.

Every Budget settles its own direct usage:

```ts
await childBudget.settle({
  usage: {
    usdCents: 19,
    searchQueries: 2,
  },
});
```

Settlement accepts usage only. Keynes derives the Budget's `settling` or `settled` state from usage completeness and descendant state. Business outcomes stay in application-owned evidence and never enter the settlement command.

Keynes derives subtree usage from settled descendants. A Budget with unsettled descendants is `settling`. It seals direct usage, rejects new child requests, lets existing descendants finish, and keeps their Resources reserved. It becomes `settled` when every blocker resolves.

Missing usage stays unresolved. Known use above the accepted request becomes an isolated deficit on that child. Keynes never records missing usage as zero or charges an ancestor to conceal an overage.

Timers, callbacks, monitoring adapters, and reconciliation workflows deliver usage evidence to the application code that owns the Budget. Local state disappears with the embedded runtime. Durable deployments can reload a Budget by its stable identifier, but the identifier only locates state. The caller's database role or Cloud identity authorizes settlement. A downstream reporter cannot decide that a Budget is ready to settle.

## What the numbers mean

Applications name Resources in their own vocabulary and count them in non-negative safe-integer units. Each Resource type has one accounting behavior:

- **Consumable** Resources consume recorded usage permanently and return any amount known to be unused.
- **Reusable** Resources remain reserved while a descendant is active and return in full after the relevant subtree settles.

The application, or a future adapter, enforces external limits and validates usage. The Resource declaration does neither. Settlement records known usage, missing evidence, and overage the same way for both accounting behaviors.

## One model, three deployments

Keynes implements Budget behavior once in a PostgreSQL database core. The same procedures, Policy environment, and evidence model run in all three deployment profiles. The TypeScript SDK and public SQL interface call that core. They do not reimplement Budget changes.

**Local PGlite.** `Keynes.local()` starts a private, in-memory PGlite database inside the application process. It needs no Keynes account, network service, database installation, daemon, or platform-specific native library. Process exit discards every local Budget, descendant, command result, and event. Keynes does not support file-backed local persistence.

**Customer PostgreSQL.** Keynes installs the same database core in a customer-owned database. Applications can use the TypeScript SDK or the public `keynes` SQL API. Non-TypeScript applications use the SQL API. This deployment keeps Budget data under customer control and lets an application commit an approved request with its own job or outbox row in one transaction. An approval inside that transaction remains provisional until commit and cannot authorize external work before then.

**Keynes Cloud.** Keynes runs the database core on managed PostgreSQL behind an authenticated service. Keynes owns tenant routing, upgrades, recovery, and high availability. Applications use the TypeScript SDK. Clients never receive database credentials or arbitrary SQL access. Cloud provides durable, remote Budget authority without customer-operated PostgreSQL.

Customer PostgreSQL and Cloud persist Budget identities, command results, and evidence. They can reload an authorized Budget and resolve a lost response by replaying the same durable command identity. All three deployments keep the same Budget workflow. Their lifecycle, security, and operational responsibilities differ.

## Who owns what

The application owns workflow validity, request construction, context claims, effects, provider retries, usage observation, outcomes, fallback behavior, and analysis of completed evidence.

Keynes owns Resource type identity, Budget identity and lineage, Resource conservation and availability, Policy evaluation, atomic child creation, idempotent command replay, settlement state, direct and subtree accounting, unresolved usage, isolated deficits, canonical evidence, and the public database and TypeScript SDK contracts.

Keynes does not design studies, score results, calculate statistics, make recommendations, or make operating decisions for the application. An application-owned harness may consume Keynes evidence, but that harness is outside the Keynes runtime and product contract.

## Product commitments

- Budget is the only public stateful governance object.
- Resource types are immutable definitions published separately from quantity. Publication creates no authority.
- An authorized root allocation creates quantity for selected Resource types. Ordinary requests cannot create quantity.
- A request proposes exact Resource quantities and atomically creates one child Budget or returns a denial. By default, the structural parent funds the request.
- Policies are optional Resource constraints evaluated by the database that holds the Budget.
- Policies are read-only SQL over a small immutable command view. The typed TypeScript builder is the default authoring path. Raw SQL is the lower-level option for every caller.
- Request context is one typed, immutable, application-asserted record. It does not pass to the child.
- Child Policies are optional, local to the child, and never inherited from the parent.
- Keynes never changes a request or executes, tracks, or retries application work.
- Every Budget settles direct usage. Keynes derives subtree accounting.
- Missing usage and overage stay visible.
- One PostgreSQL database core defines Budget behavior in local PGlite, customer-owned PostgreSQL, and Keynes Cloud.
- TypeScript is the only supported SDK. Non-TypeScript applications use the public SQL interface in customer-owned PostgreSQL.
- Local authority is private, process-scoped, daemon-free, and available only through the TypeScript SDK.
- Customer PostgreSQL and Cloud provide durable, reloadable authority with explicit authorization and recovery responsibilities.
- Customer PostgreSQL can commit Budget authority with application-owned rows without moving application effects into Keynes.
- Keynes will qualify subtree issuance before same-database multi-source funding. Both use explicit contracts and preserve the parent-funded default.
- Keynes expands only after conformance evidence and demonstrated workflow value.
