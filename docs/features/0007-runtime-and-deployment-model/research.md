# Research: Runtime and deployment model

## Decision 1: Separate local and durable implementations

**Decision**: Keep `Keynes.create({ mode: "local" })`, replace its PGlite implementation in a later feature with an in-memory TypeScript ledger, and keep PostgreSQL as the only durable implementation.

**Rationale**: Local mode benefits from zero infrastructure, quick startup, smaller installation and memory costs, and process-scoped isolation. Durable deployments benefit from PostgreSQL transactions, concurrency, permissions, migrations, recovery tooling, and adjacency to application data. One implementation cannot optimize for both without shipping a database runtime locally.

**Alternatives considered**:

- Keep PGlite permanently. Rejected because local mode does not need SQL storage, migration startup, or a WebAssembly PostgreSQL footprint.
- Make the product PostgreSQL-only. Rejected because it removes the lowest-friction evaluation and test path.
- Define a generic storage adapter. Rejected because it turns one deliberate second implementation into an unsupported database ecosystem and weakens the testable semantic boundary.

## Decision 2: Keep one Budget in one place

**Decision**: A Budget lives in one local ledger or one PostgreSQL database. Deployment is explicit. Keynes does not copy a live Budget, write it to two places, infer a deployment from credentials, or fall back to local state.

**Rationale**: Conservation, replay, settlement, and concurrency require one committed history. Hidden migration or fallback can approve work from stale state or create two valid-looking histories.

## Decision 3: Offer three PostgreSQL operating models

**Decision**: Durable Keynes can be installed in an application's PostgreSQL database, operated by a customer behind the Keynes service, or operated by Keynes as managed Cloud. The same service code is the basis for the latter two models.

**Rationale**: Embedded installation gives applications same-transaction composition. A separate self-hosted service gives customers isolation and operational control. Managed Cloud removes database and service operations from the customer. Applications that use another primary database can still call either remote service model.

**Current evidence limit**: FEAT-0006 proves one private loopback service against native PostgreSQL. It does not prove a public remote product, installable distribution, self-hosted packaging, or managed Cloud.

## Decision 4: Compare behavior, not implementation

**Decision**: Run the same black-box Budget examples against the local ledger and native PostgreSQL. Compare results, errors, replay flags, history, and final Budget state. Keep lifecycle, transaction, security, recovery, packaging, and operations tests deployment-specific.

**Rationale**: The implementations will use different state mechanisms. Structural similarity would not prove that customers observe the same accounting behavior.

## Decision 5: Use one restricted query format for Policy

**Decision**: Make a restricted PostgreSQL-style query the public stored Policy format. The TypeScript builder compiles to it, advanced users may author it directly, local mode evaluates its parsed form, and PostgreSQL validates and executes generated SQL against Keynes-provided inputs.

**Rationale**: SQL expresses filtering, aggregation, ordering, null behavior, and arithmetic well. One restricted format lets both deployments share semantics without exposing general database access. The parser's internal syntax tree remains private so the implementation can evolve.

**Application-data boundary**: The application reads business data and sends a fixed, validated context object. A Policy cannot query application tables. In an embedded deployment, application reads and the Keynes call may occur in the same caller-owned PostgreSQL transaction.

## Decision 6: Use Apache-2.0 for the open core

**Decision**: Apply Apache-2.0 metadata to the repository root, SDK, and Cloud package. Keep Budget correctness, contracts, migrations, SDK behavior, and basic self-hosting open.

**Rationale**: The repository already contains the Apache-2.0 license text. A permissive open core reduces adoption friction while leaving hosting, upgrades, recovery, administration, enterprise controls, compliance work, and support as services Keynes may sell.

**Deferred**: Prices, billing units, plan names, unimplemented enterprise features, and future proprietary package locations.
