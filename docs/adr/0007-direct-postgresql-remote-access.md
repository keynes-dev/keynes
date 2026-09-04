# ADR-0007: Use direct PostgreSQL access for the remote TypeScript SDK

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Keynes maintainers
- **Supersedes in part:** [ADR-0003](0003-sqlite-and-postgresql.md) for remote SDK access

## Context

Before KEY-55, the repository had three implemented paths. The TypeScript SDK ran local Budgets in private SQLite. Embedded adopters called `keynes.*` procedures inside caller-owned PostgreSQL transactions. The private KEY-47 service carried a no-Policy HTTP protocol to PostgreSQL.

The draft KEY-55 design proposed an API key, service discovery, and an HTTPS Budget protocol. That design would add a second public protocol, compatibility boundary, error mapping, retry owner, and limits model around the existing PostgreSQL authority. Keynes has no browser or mobile SDK that requires that data path. Server-side TypeScript applications can use PostgreSQL's authenticated TLS protocol and the same versioned procedures that already own durable Budget behavior.

The earlier local factory bound one Resource schema during connection setup. Durable PostgreSQL needs Resource binding during root creation and reopen, after the SDK has connected to an existing authority. KEY-56 now supplies that shared local and PostgreSQL prerequisite before remote access relies on it.

## Decision

The future TypeScript SDK has one factory with two connection forms:

```ts
createKeynes();
createKeynes({ databaseUrl });
```

The zero-argument form opens private local SQLite. The `databaseUrl` form opens one PostgreSQL authority. Configuration never selects a deployment label, HTTP endpoint, API key, Resource schema, or fallback.

KEY-56 moves Resource binding and root Budget creation out of connection setup and preserves one public creation model across local SQLite and PostgreSQL. KEY-55 consumes that contract; it does not add another Resource-registration path or hide a local API change inside remote transport work.

The remote SDK owns its PostgreSQL pool and calls only supported versioned procedures. PostgreSQL remains the sole durable owner of validation, Policy decisions, conservation, transactions, replay, settlement, history, and recovery records. KEY-55 adds no HTTP Budget data plane and no second replay ledger.

Every remote TCP connection requires TLS 1.2 or newer with certificate-chain and hostname verification. The SDK parses `databaseUrl` once, accepts a closed parameter set, requires exactly one `sslmode=verify-full`, and constructs one normalized pool configuration. It never combines an untrusted raw connection string with separate SSL settings or falls back to plaintext, local SQLite, another endpoint, or another database.

PostgreSQL authenticates a scoped login role. Protected role mappings bind that login to one Keynes principal, and remote procedures derive identity from `session_user`. Separate owner, execution, and administration roles preserve least privilege. Private administrative procedures own credential creation, rotation, and revocation. Ordinary SDK roles cannot invoke them.

The scoped credential remains a PostgreSQL login and can submit SQL through another client. The SDK exposes no general SQL operation or database handle. PostgreSQL grants prevent submitted SQL from gaining unauthorized access to Keynes state, privileged roles, administration, mapped identity, or another tenant. The deployment operator owns database-wide privileges and resource controls. A deployment that prohibits SQL submission must withhold PostgreSQL credentials and adopt a constrained data path through a later architecture decision.

Self-hosted and managed deployments use the same required PostgreSQL procedure and semantic contracts. They require separate operational evidence for credential delivery, TLS termination, poolers, upgrades, backup, recovery, capacity, incident response, and support. A later control plane may provision credentials or deployments, but it does not carry Budget commands or own Budget state.

The private KEY-47 service remains historical evidence. KEY-55 moved the assertions that still matter into direct PostgreSQL coverage and removed `apps/cloud` from active product, generation, and qualification paths. Historical feature documents and retained records remain unchanged.

## Consequences

- The SDK and PostgreSQL procedure contract form the public remote data path.
- Server-side applications receive scoped PostgreSQL credentials and cannot select identity fields or call private tables and administrative procedures.
- Direct PostgreSQL credentials are not RPC-only credentials. Self-hosted customers own database-wide SQL and resource controls; Keynes owns them for managed Cloud.
- Direct and supported pooled connections require separate TLS, session, transaction, identity, and recovery evidence.
- KEY-55 contracts own the exact reference, reopen, inspection, recovery, retry, compatibility, and error shapes within these boundaries.
- The repository retains no active HTTP Budget protocol after replacement coverage passes.

## Rejected alternatives

### Keep the HTTPS Budget service

This path duplicates PostgreSQL authentication, compatibility, retries, limits, error projection, and procedure routing without a current non-PostgreSQL client requirement.

### Add separate local and remote factories

Two factories expose deployment mechanics in the public API and make connection lifecycle harder to explain. One factory can select the authority from the presence of `databaseUrl` without changing Budget semantics.

### Accept an arbitrary endpoint or deployment selector

Caller-selected endpoints and labels create routing and fallback behavior outside the authenticated database authority. A literal PostgreSQL URL identifies one authority and fails closed.

### Reuse an operation key as a Budget reference

Operation recovery and durable Budget lookup are different capabilities. Separate types allow their validation, retention, and authorization rules to evolve independently.

## Links

- [Product direction](../product.md)
- [Runtime architecture](../architecture.md)
- [Planning and workflow](../workflow.md)
