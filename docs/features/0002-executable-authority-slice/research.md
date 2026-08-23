# Research: Executable Budget lifecycle

This record resolves the technical choices needed to plan FEAT-0002. Each choice stays narrower than a general contract platform or a second Budget implementation.

## R1. Execution subject

**Decision**: Run the installed PostgreSQL module in private, process-scoped, in-memory `@electric-sql/pglite@0.5.5`. The SDK-owned client serializes procedure calls and exposes no database path, socket, or raw connection.

**Rationale**: PGlite runs PostgreSQL in-process and exposes SQL, transactions, and typed query APIs, so the provider-free test can call real installed procedures rather than mocks ([PGlite API](https://pglite.dev/docs/api), [package](https://www.npmjs.com/package/%40electric-sql/pglite)). Its single-connection execution model is appropriate for a deterministic local subject but cannot qualify native multi-connection contention.

**Alternatives considered**: A TypeScript implementation of Budget transitions would duplicate the database rules. Docker PostgreSQL would add a service prerequisite to the provider-free lane. Native PostgreSQL remains a later qualification host.

## R2. Contract source and generation

**Decision**: Keep one JSON Schema 2020-12 contract source. Pin `json-schema-to-typescript@15.0.4` for static TypeScript shapes, Ajv 8.20.0 standalone ESM for generated runtime validation, `canonicalize@4.0.0` for RFC 8785 contract identity, and a narrow Keynes emitter for SQL boundary validation and wrappers.

**Rationale**: Ajv supports JSON Schema 2020-12 and can emit standalone validators with no runtime Ajv dependency ([Ajv JSON Schema](https://ajv.js.org/json-schema.html), [standalone validation](https://ajv.js.org/standalone.html)). RFC 8785 defines deterministic JSON canonicalization for cryptographic hashing ([RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html)). Static TypeScript types cannot encode every numeric or structural constraint, so generated runtime and SQL validators remain authoritative at their boundaries.

The SQL emitter supports only the schema features used by this contract and fails generation on every unsupported keyword. It is not a general JSON Schema compiler.

The contract digest identifies the exact logical contract. Folder names, filenames, TypeScript symbols, and the initial SQL schema do not repeat a version label. If two incompatible contracts must coexist, the later feature introduces a separate SQL namespace and compatibility window then.

**Alternatives considered**: Handwritten types drift from the source. Runtime Ajv adds an avoidable production dependency. Version-labeled folders and type names reserve compatibility machinery before a second contract exists. A general contract compiler and catalog are outside this slice.

## R3. Public and private interface

**Decision**: Generate `defineResource`, `createBudget`, `requestBudget`, `settleBudget`, and `getBudget` on `KeynesClient` over a private `ProcedureCaller.call(procedure, input)` boundary. Each installed target uses `keynes.<operation>(jsonb) -> jsonb`. `getBudget` returns one Budget projection and the complete history for its root lineage from one database transaction snapshot. The public contract exposes Budget history. Private storage may use internal event records. The public client validates unknown input and output, checks the contract digest, and transports values. It never decides a Budget transition.

**Rationale**: Named methods give callers discoverable, typed operations while one small procedure caller keeps host concerns below the contract. A real PGlite caller and a fake mapping-test caller share procedure shape, not Budget logic. The combined read keeps the Budget projection and its evidence on one snapshot. FEAT-0002 accepts an unpaginated history; a later feature adds pagination only when measured lineage size or adopter evidence requires it.

**Alternatives considered**: Exporting raw SQL leaks installation details. Adding a public `Keynes.local()` freezes product API before the platform gate. Per-operation handwritten adapters invite drift. A version-labeled client name describes implementation history rather than what the caller uses.

## R4. Database transaction kernel and accounting

**Decision**: Each mutating public wrapper delegates to `keynes_internal.apply_command`. It validates and normalizes, checks the current principal's permission, resolves replay, locks the affected parent or lineage rows, runs an operation handler, stores the canonical result and evidence, and returns. Budget mutations append lineage events. Resource definition retains its evidence in the stored definition result. The caller-owned database transaction commits or rolls back the entire action.

Persist base facts only: allocations, direct usage observations, lineage, commands, and events. Derive availability, commitments, subtree observed usage, unresolved amounts, parent charge, and deficits recursively. An open consumable child commits its full allocation; when settled it charges only known use up to allocation and returns unused quantity. A reusable child commits its full allocation while active and returns it all when the subtree settles. Observed overage remains on the child as a deficit and is never charged upward.

**Rationale**: PostgreSQL row locks last until transaction end and block conflicting writers, providing the future native-host serialization primitive ([explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)). Transactions make intermediate mutations invisible and roll them back together ([transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)). PGlite acceptance proves the SQL path, not native lock contention.

**Alternatives considered**: Synchronized counters create multiple facts that can drift. Event sourcing would make evidence drive state, contrary to the specification. Client-side transitions duplicate the database rules.

## R5. Replay, canonicalization, and digests

**Decision**: Canonical command identity is a lowercase PostgreSQL-compatible UUID string. For each create operation, its `commandId` is also the new opaque entity identity. The command ledger binds tenant, operation, target, canonical command body, body digest, and canonical result. Exact retries return the stored result. Any changed binding returns `command_conflict`.

Use separate identities for separate concerns:

- contract source: RFC 8785 canonical bytes plus SHA-256;
- command body: database-normalized JSON plus built-in PostgreSQL `sha256(bytea)`;
- migration: exact migration bytes plus SHA-256 in the migration manifest;
- generated file: exact emitted bytes plus SHA-256 in the generation record.

**Rationale**: Reusing the command UUID as the created object ID is deterministic across hosts, keeps public IDs opaque, and avoids random-result divergence. PostgreSQL supplies SHA-256 directly, so `pgcrypto` is unnecessary ([binary string functions](https://www.postgresql.org/docs/current/functions-binarystring.html)). PostgreSQL `jsonb` has already collapsed duplicate object keys before a procedure receives the value, so this plan rejects unknown and invalid fields but makes no impossible duplicate-key claim ([JSON types](https://www.postgresql.org/docs/current/datatype-json.html)).

**Alternatives considered**: One global digest conflates semantic, operational, and evidence identities. Random database IDs complicate later cross-host comparison. A PGlite crypto extension adds weight without need.

## R6. Migration graph

**Decision**: Use three ordered fresh-install migrations: hand-authored storage, hand-authored Budget behavior, then generated public wrappers and validators. `packages/database/migrations/manifest.json` is the sole hand-authored graph and order source. Generation reads it and emits an installation record with byte checksums, the contract digest, and expected target names. The local installer applies and records each migration transactionally, stores the digest on the contract-bearing migration row, verifies every target as `jsonb -> jsonb`, and rejects mismatches.

**Rationale**: Storage and semantic procedures change for domain reasons; public generated boundaries change with the contract. Separating them keeps review and checksums meaningful without inventing a broad migration framework.

**Alternatives considered**: A generated graph creates a hidden second source for migration order. One generated monolith hides semantic edits. One file per function adds temporal and review noise. Upgrade, downgrade, and rolling deployment qualification are later work.

## R7. Authorization and security seam

**Decision**: Public commands never accept a principal or tenant override. Installed `SECURITY DEFINER` wrappers use a fixed safe `search_path` and resolve the effective fixture principal through private transaction context set only by the local client. Database permissions remain distinct: `define_resource_type`, `create_root_budget`, `request_budget`, `settle_budget`, and `read_budget`.

**Rationale**: PostgreSQL warns that `SECURITY DEFINER` functions need a trusted `search_path` and restricted execution privileges ([CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)). The private fixture seam proves authorization branches without pretending to provide hostile-host role isolation.

**Alternatives considered**: A principal field in commands would let callers claim an identity and its permissions. Permanent global fixture state would leak between tests. Full role and tenant qualification belongs to the platform gate.

## R8. Faults, tests, and evidence

**Decision**: Declare narrow transaction checkpoints after replay binding, domain mutation, command-result storage, and event insertion. Tests select a checkpoint through a private transaction-local setting; public operations contain no fault field and no public grant exposes the seam. Acceptance assertions use public results and reads, not private table inspection. Setup may install migrations, fixture permissions, or the private checkpoint.

**Rationale**: These checkpoints prove that the one transaction removes partial domain state, result, and evidence. They do not constitute a broad fault campaign. A fake procedure caller is sufficient only for generated method-to-procedure mapping; lifecycle acceptance always uses PGlite and installed SQL.

**Alternatives considered**: A public failpoint would widen the contract. Private-table acceptance assertions could pass while projections are broken. Process termination and storage-corruption campaigns are separate lanes.

## R9. Canonical input domains

**Decision**: Use these contract boundary rules:

- IDs and command IDs: canonical lowercase UUID text;
- Resource canonical names: ASCII lower snake case, 1–63 characters, matching `^[a-z][a-z0-9_]{0,62}$`;
- units: 1–64 UTF-8 characters, no leading/trailing whitespace or control characters;
- amounts: integers from 0 through `9007199254740991`;
- Resource envelopes: non-empty, unique by `resourceTypeId`, canonically sorted by that ID;
- object schemas: all required fields explicit and `additionalProperties: false`;
- result variants: discriminated by required `kind` values.

**Rationale**: The rules are small enough to enforce identically in generated TypeScript validation and SQL. Sorting envelopes makes denial reasons, results, and evidence stable without making input field order meaningful.

**Alternatives considered**: Unicode identifier normalization is a larger cross-runtime contract. Caller-provided array order is not semantic. Optional-field bags allow invalid tagged states.

## R10. Dependency and workspace placement

**Decision**: Add PGlite as the only new production dependency of the existing private `@keynes/sdk` workspace. Add generator libraries and Node types at the root as pinned development dependencies. Keep `packages/contracts` and `packages/database` outside the pnpm workspace. Root scripts generate the contract, and SDK tests install the database.

**Rationale**: This preserves FEAT-0001 ownership boundaries and avoids shallow packages whose only role would be storing schema or SQL files. The runtime owns only the local database engine; generated standalone validation has no runtime compiler dependency.

**Alternatives considered**: New contract and database workspaces add package boundaries without independent runtime APIs. Floating versions make clean generation irreproducible.
