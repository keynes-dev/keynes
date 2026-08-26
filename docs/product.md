# Keynes: Runtime economics for agents

> **Status:** Packaged local mode currently runs on private, in-memory PGlite. FEAT-0006 also implements a private loopback service over native PostgreSQL. Replacing PGlite with an in-memory TypeScript ledger is planned, not implemented. PostgreSQL installation, Policy, public remote access, self-hosted packaging, managed Cloud, recovery, security qualification, and production support remain unproved. The [architecture](architecture.md) separates current evidence from the target design.

## Thesis

Agents make choices that affect cost, speed, quality, and risk. They decide how much to investigate, which tools to use, when to retry, and when to ask for help. Businesses need a clear way to give agents operating limits without burying them in prompts or scattering them through application code.

Keynes makes those limits explicit. An application defines the Resource types it governs. A Budget holds quantities of those Resources and the Policies that constrain requests. A team, workflow, or agent requests Resources from a Budget. Keynes either denies the request or reserves the Resources and returns a child Budget. The application does the work, then settles the Budget once it knows what was used.

```text
Budget -> request -> child Budget -> settle -> evidence
```

## Budgets and Resources

Before a Budget can hold a Resource, the application defines an immutable Resource type. The type has a stable identity, an application-defined name and unit, and one Keynes-defined accounting behavior. Defining a type creates no quantity and grants no permission to spend.

An authorized root allocation creates quantity for selected Resource types. A root holds only those allocations. It does not declare every type the application may use. By default, a Budget funds its own children. It can delegate only Resources it holds, and a child can re-delegate only what remains in that child.

```ts
const result = await supportBudget.request({
  usdCents: 25,
  searchQueries: 2,
});

if (result.status === "approved") {
  await runWorkflow(result.budget);
} else {
  handleDenial(result.reasons);
}
```

The request names the exact quantities the child will receive. Keynes does not revise the request. If the application wants different quantities after a denial, it sends another request.

An approval is one atomic change. Keynes evaluates the parent's Policies, checks availability, reserves the Resources, creates the child, and records the result together. A failure changes no Budget state.

Each public call has a command identity. Retrying the same command returns the original result. Reusing that identity with different input is an error. Two separate `request(...)` calls remain separate requests even when their bodies match. Keynes never deduplicates legitimate work by request-body digest alone.

Keynes may later add explicit subtree issuance and same-database multi-source funding without changing the parent-funded default. Cross-database composition is invalid. Each extension needs separate permission, conservation, settlement, replay, recovery, and deployment-comparison evidence before release.

## Policies

A Policy constrains how many Resources a Budget may grant. It can read the requested Resources, the parent Budget's available Resources, and one fixed context object supplied by the application. It returns ceilings and stable reasons for one or more Resources.

The TypeScript builder is the normal way to write a Policy. It knows the available Resources and the expected context fields. It rejects unsupported expressions and compiles the Policy to a restricted PostgreSQL-style query. Advanced users may write SQL directly, but only within the same supported subset. This product design does not choose final builder method names or future connection options.

Local mode parses the query and evaluates it in TypeScript. PostgreSQL validates and runs the generated SQL against inputs provided by Keynes. Both paths must agree on Resource limits, denials, integer and null behavior, ordering, aggregation, unsupported SQL, context validation, deterministic functions, revisions, digests, recorded context, and replay.

A Policy cannot read application tables directly. The application reads its business data and passes a fixed context object with the request. For example, it might supply a ticket priority, customer tier, or workflow risk class. Keynes validates the declared fields and types and records the exact context used for the decision. Secrets do not belong in Policy context, and context does not pass to the child.

An application using embedded PostgreSQL may read business facts and call Keynes inside the same caller-owned transaction. This gives the facts and the Budget request one transaction snapshot without giving the Policy access to application tables. A replay returns the recorded result and context; it does not query application tables again.

When several Policies return ceilings for the same Resource, the lowest ceiling wins. A zero ceiling denies a positive request. No rows means no added constraint. Invalid or unsupported SQL, invalid context, a nondeterministic function, an execution limit, or an invalid result fails the request. Keynes does not turn a Policy error into an approval or a domain denial.

A child does not inherit Policies from its parent. Omitting `policies` has the same canonical meaning as `policies: []`. A child without local Policies is still limited by the Resources it received and by Keynes's conservation, availability, accounting, and settlement rules.

## Settlement

An approved Budget is both permission to spend and an accounting scope. Keynes does not execute, track, or retry application work. The application can use a child Budget for local work, provider calls, more child Budgets, or any combination its workflow needs.

The application owns execution, provider idempotency, and recovery from ambiguous provider responses. Command replay prevents duplicate Budget creation. It cannot make provider calls or other application effects idempotent.

Every Budget settles its own direct usage:

```ts
await childBudget.settle({
  usdCents: 19,
  searchQueries: 2,
});
```

Settlement accepts usage only. Keynes derives the Budget's `settling` or `settled` state from usage completeness and descendant state. Business outcomes stay in application-owned evidence and never enter the settlement command.

Keynes derives subtree usage from settled descendants. A Budget with unsettled descendants is `settling`. It seals direct usage, rejects new child requests, lets existing descendants finish, and keeps their Resources reserved. It becomes `settled` when every blocker resolves.

Missing usage stays unresolved. Known use above the accepted request becomes an isolated deficit on that child. Keynes never records missing usage as zero or charges an ancestor to conceal an overage.

Timers, callbacks, monitoring adapters, and reconciliation workflows deliver usage evidence to the application code that owns the Budget. A stable Budget identifier locates state; it does not grant permission to inspect or settle that state.

## What the numbers mean

Applications name Resources in their own vocabulary and count them in non-negative safe-integer units. Each Resource type has one accounting behavior:

- **Consumable** Resources consume recorded usage permanently and return any amount known to be unused.
- **Reusable** Resources remain reserved while a descendant is active and return in full after the relevant subtree settles.

The application, or a future adapter, enforces external limits and validates usage. The Resource declaration does neither. Settlement records known usage, missing evidence, and overage the same way for both accounting behaviors.

## One product across local and PostgreSQL deployments

Keynes exposes one Budget workflow through the TypeScript SDK. The local ledger and PostgreSQL implement that behavior separately. Shared black-box tests keep the customer-visible commands, results, errors, replay behavior, accounting rules, and evidence format aligned.

```text
Shared Budget behavior
|
+-- Local runtime
|   `-- In-memory TypeScript ledger
|
`-- PostgreSQL runtime
    +-- Installed in the application's database
    +-- Self-hosted behind the Keynes service
    `-- Keynes Cloud
```

Each Budget is stored in one place. Keynes never copies a live Budget between deployments, writes it to two places, guesses the deployment from credentials, or falls back to local state.

### Local mode

Local mode runs inside one Node.js process through `Keynes.create({ mode: "local" })`. It needs no account, service, database installation, daemon, or network. The planned in-memory ledger keeps private process-owned state and loses every Resource, Budget, command result, permission, and history entry when the process exits.

PGlite is still the current local implementation. The next implementation feature must replace it without changing the public Budget API or behavior and must requalify package size, install size, supported environments, memory, startup, request latency, and shutdown.

Local mode is for evaluation, tests, local development, short-lived workflows, and applications that do not need a Budget after process exit. It does not provide persistence, multi-process coordination, database transactions, remote access, backup, or recovery.

### Embedded PostgreSQL

An application installs Keynes migrations and procedures into its own PostgreSQL database. The application may call Keynes through the TypeScript SDK or a supported SQL interface. This is the only deployment where a Keynes decision and an application row can commit or roll back in the same caller-owned PostgreSQL transaction.

Embedded PostgreSQL suits teams that already operate PostgreSQL, need atomic composition with an application outbox or business row, and accept responsibility for installation, permissions, upgrades, backups, recovery, and support coordination. Installation and transaction integration are planned and unproved.

### Self-hosted Keynes

The customer runs the Keynes service with a separate PostgreSQL database. The service handles authentication, tenant selection, transport, and connection management. The customer controls data placement and operations but also owns deployment, upgrades, backup, recovery, monitoring, and incident response.

Self-hosting suits customers that need durable remote Budgets and operational control without installing Keynes into an application database. FEAT-0006 is the code basis for this deployment, but self-hosted packaging and operations are unproved.

### Keynes Cloud

Keynes runs the same service and a Keynes-specific PostgreSQL database. Keynes takes responsibility for hosting, upgrades, recovery, administration, and support. The customer uses the remote TypeScript SDK and does not receive database credentials or select a database.

Cloud suits teams that want durable remote Budgets without operating Keynes. The current private service is not managed Cloud. Public access, production identity, recovery, managed operations, support, and production readiness remain unproved.

### Applications that use another database

An application that stores its own data in MySQL, MongoDB, SQLite, or another database can call self-hosted Keynes or Keynes Cloud over the remote SDK. Keynes still stores its own durable Budget data in PostgreSQL. The application reads its business facts and sends the fixed Policy context with the request. A later decision is required before Keynes supports another durable database implementation.

## Open core

Keynes uses Apache-2.0 for the current repository packages. Budget correctness, contracts, PostgreSQL migrations and procedures, TypeScript SDK behavior, and basic self-hosting stay open.

Keynes may charge for hosting, upgrades, recovery, administration, enterprise controls, compliance work, and support. This principle does not define prices, billing units, plan names, or unimplemented enterprise promises.

## Who owns what

The application owns workflow validity, request construction, Policy context, external effects, provider retries, usage observation, outcomes, fallback behavior, and analysis of completed evidence.

Keynes owns Resource type identity, Budget identity and lineage, Resource conservation and availability, Policy evaluation, atomic child creation, idempotent command replay, settlement state, direct and subtree accounting, unresolved usage, isolated deficits, canonical evidence, the TypeScript SDK contract, and the remote service protocol.

Keynes does not design studies, score results, calculate statistics, make recommendations, or make operating decisions for the application. An application-owned harness may consume Keynes evidence, but that harness is outside the Keynes runtime and product contract.

## Product commitments

- Budget is the only public stateful governance object.
- Applications define immutable Resource types separately from quantity. Defining a type creates no permission to spend.
- An authorized root allocation creates quantity for selected Resource types. Ordinary requests cannot create quantity.
- A request proposes exact Resource quantities and atomically creates one child Budget or returns a denial. By default, the structural parent funds the request.
- Policies are optional Resource constraints expressed in one restricted PostgreSQL-style query format.
- The TypeScript builder is the normal Policy authoring path. Raw SQL is an advanced path within the same supported subset.
- Policy inputs are the request, the parent Budget's available Resources, and one fixed, typed, application-supplied context object.
- Policies never read application tables. Keynes records the exact context used and does not query application data during replay.
- Child Policies are optional, local to the child, and never inherited from the parent.
- Keynes never changes a request or executes, tracks, or retries application work.
- Every Budget settles direct usage. Keynes derives subtree accounting.
- Missing usage and overage stay visible.
- Each Budget has one storage location and one committed history.
- The local ledger and PostgreSQL implement the same Budget behavior through separate code and shared black-box tests.
- PostgreSQL is the only durable database implementation.
- Embedded PostgreSQL, self-hosted Keynes, and Keynes Cloud are supported product directions with separate operational and evidence requirements.
- TypeScript is the only supported SDK.
- Deployment is explicit. Keynes never infers it from credentials or silently falls back to local state.
- Supporting another durable database requires a later constitution and product decision.
- Keynes will qualify subtree issuance before same-database multi-source funding. Both use explicit contracts and preserve the parent-funded default.
- Product direction can promote optional capabilities without making external adoption evidence a delivery gate.
