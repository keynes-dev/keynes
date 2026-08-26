# Research: PostgreSQL transaction integration

## Use a dedicated PostgreSQL distribution

**Decision**: Turn `packages/database` into the `@keynes/postgresql` workspace. Its packed archive contains the canonical SQL bytes, manifest, generated installation record, installer, README, and license.

**Rationale**: `packages/database` already owns migrations, private storage, and installation assets. FEAT-0008 deliberately removed those assets from the local SDK package. A real database distribution gives adopters one executable install and exact-recheck boundary without putting durable deployment mechanics back into `@keynes/sdk` or borrowing Cloud-specific provisioning code.

**Alternatives considered**:

- Putting the CLI and migrations under `@keynes/sdk` was rejected because local mode must remain independent of PostgreSQL assets and dependencies.
- Shipping raw SQL alone was rejected because it cannot enforce the exact version, role contract, no-op recheck, or drift diagnosis.
- PostgreSQL extension packaging was rejected because the specification defers it.

## Keep direct SQL as the embedded transaction contract

**Decision**: Application code calls the five existing `keynes.*(jsonb) -> jsonb` functions through its checked-out database client. FEAT-0009 adds no `Keynes.create()` mode and no generated TypeScript transaction binding.

**Rationale**: Direct SQL proves the feature's unique product value with no competing transaction abstraction. The application visibly owns `BEGIN`, its business reads, the Keynes call, the outbox write, `COMMIT`, and `ROLLBACK`. The existing private transaction caller already proves that Keynes needs only a supplied query-capable connection. A public adapter would add package and lifecycle questions before the normative SQL flow is accepted.

**Alternatives considered**:

- A public `@keynes/sdk/postgres` subpath was deferred. It may later wrap the accepted SQL contract, but it is not needed for the complete request-and-outbox proof.
- A PostgreSQL option on `Keynes.create()` was rejected because runtime selection and embedded transaction ownership are separate architecture axes.
- An SDK-owned callback such as `keynes.transaction()` was rejected because the application must own the transaction and application writes.

## Treat the one application role as a trusted identity asserter

**Decision**: Support one existing application database role and one bootstrap `(tenantId, principalId)` with the five current Keynes permissions. Application code sets those two values transaction-locally before the public call. The preview states that these values are trusted application assertions, not database authentication.

**Rationale**: PostgreSQL custom settings can be set by ordinary application code. Role defaults do not turn `keynes.tenant_id` and `keynes.principal_id` into an authentication boundary. A role-to-principal registry would affect the existing multi-tenant Cloud service and add an authorization system beyond the combined installation and transaction slice. The narrow preview can still enforce database-object least privilege and PostgreSQL's existing logical permission checks while reporting security qualification as `NOT RUN`.

**Alternatives considered**:

- Binding `session_user` to a private principal table was deferred until embedded multi-role or hostile-role isolation is in scope.
- Allowing several application roles or principals was rejected because the feature needs one complete adopter path, not an account-provisioning system.
- Treating the custom settings as authenticated identity was rejected because PostgreSQL does not provide that guarantee.

## Install the complete fresh profile in one transaction

**Decision**: Recognize three target states: `absent`, `exact`, and `incompatible`. Apply the complete migration graph, bootstrap permissions, installation identity, ownership, and ACLs in one transaction only from `absent`. Run read-only recheck for `exact`. Reject every other state without repair.

**Rationale**: FEAT-0009 supports no predecessor or upgrade path. Committing one migration at a time would permit a later failure to leave a partial graph, while resuming or reconciling that graph would create undeclared upgrade behavior. PostgreSQL transactional DDL lets the fresh preview publish one complete authority or no authority.

**Alternatives considered**:

- Resuming missing migrations was rejected because a partial graph is an incompatibility, not a supported install state.
- `ON CONFLICT DO NOTHING` reconciliation for bootstrap permissions was rejected because it can hide changed configuration.
- Creating or dropping adopter roles was rejected. The operator prepares roles outside the installer, and the installer requires no `CREATEROLE` or `CREATEDB` privilege.

## Use a stable owner and narrow application ACLs

**Decision**: Require a pre-existing `keynes_owner NOLOGIN` role, an operator allowed to assume it, and one pre-existing application role. `keynes_owner` owns both Keynes schemas and every object. The application role gets `USAGE` on `keynes` and `EXECUTE` on the five supported functions, with no `keynes_internal` access.

**Rationale**: A stable no-login owner separates deployment authority from application execution. PostgreSQL makes a function's owner and `search_path` security properties because `SECURITY DEFINER` executes with owner privileges. PostgreSQL also grants new functions to `PUBLIC` by default, so the migrations must revoke that access inside the same transaction and grant execution explicitly. See the PostgreSQL 18 documentation for [privileges](https://www.postgresql.org/docs/18/ddl-priv.html) and [safe `SECURITY DEFINER` functions](https://www.postgresql.org/docs/18/sql-createfunction.html).

The installer does not revoke database-wide `PUBLIC` privileges. An embedded application database may have unrelated users and schemas, and Keynes should change only its owned schemas and functions.

**Alternatives considered**:

- Running the application as the database or schema owner was rejected because it bypasses the public function boundary.
- Granting the application role read access to `schema_migrations` was rejected because privileged recheck belongs to the operator.
- Reusing the Cloud service role contract was rejected because Cloud needs startup checks and multi-tenant service behavior that embedded application code does not.

## Recheck the live installation, not only the ledger

**Decision**: Store the chosen owner role, application role, tenant, and principal after applying canonical bytes. Exact recheck reads the server and migration ledger, then checks the required object inventory, ownership, function properties, bootstrap permissions, and ACLs in a read-only transaction.

**Rationale**: Matching migration rows and public signatures cannot detect a changed function body, owner, `SECURITY DEFINER` flag, `search_path`, unexpected object, or ACL. Source checksums prove which SQL the installer ran. Direct live checks diagnose which required fact changed without maintaining a second catalog hash.

The stored role and bootstrap identities bind exact recheck to the original configuration. A mismatch fails recheck and does not trigger repair.

**Alternatives considered**:

- Checking only `schema_migrations` was rejected because it does not prove live objects.
- Hashing normalized PostgreSQL catalogs was rejected because direct checks already cover the required facts and produce better diagnostics.
- Comparing private table contents was rejected because recheck concerns installation structure, not Budget state.

## Extend the existing native lane

**Decision**: Keep `pnpm test:platform` as the single native PostgreSQL command. Add optional `--output <record.json>` support, packed-distribution installation tests, embedded role and transaction scenarios, and a fixed scenario inventory. Acceptance requires `pnpm test:pr` and a recorded platform pass for the same clean commit.

**Rationale**: The current runner already owns the exact PostgreSQL 18.6 image, generated credential, loopback port, version check, child tests, and cleanup. Another runner would duplicate those guarantees and split native evidence. The Docker-free pull-request lane remains unchanged.

**Alternatives considered**:

- A second `test:postgres` command was rejected because the existing lane already compares SQLite and PostgreSQL and exercises real contention.
- Adding Docker to `pnpm test:pr` was rejected because the repository deliberately keeps provider-free native qualification separate from default verification.
- Using a managed provider was rejected because credentials, cost, provider behavior, and authorization are outside this feature.

## Retain a secret-free exact-attempt record

**Decision**: When `--output` is supplied, the platform runner refuses overwrite and wraps Vitest's passing JSON report with the clean revision, archive and installation identities, exact image and server version, role facts, and explicit `NOT RUN` lanes.

**Rationale**: A test exit code does not preserve which package, database profile, grants, or scenarios produced the claim. Vitest already records test names and outcomes. A small envelope adds the provenance that the test runner does not know. The runner writes the record only after every required test and cleanup pass.

**Alternatives considered**:

- Recording credentials, URLs, SQL, command bodies, or private rows was rejected because evidence must remain safe to retain.
- Treating a dirty-worktree record as acceptance was rejected because it cannot bind the outcome to one source revision.
- Inferring recovery, security, provider, or production support from the provider-free run was rejected. Those lanes remain `NOT RUN`.
