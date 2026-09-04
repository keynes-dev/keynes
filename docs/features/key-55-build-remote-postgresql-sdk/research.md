# Research: Build remote PostgreSQL SDK

## Direct PostgreSQL is the remote data path

**Decision**: The SDK connects directly to the PostgreSQL authority named by `databaseUrl`. KEY-55 adds no HTTP Budget protocol.

**Rationale**: PostgreSQL already owns durable transactions, permissions, replay, Policy evaluation, and history. An HTTP data plane would duplicate protocol versioning, error projection, retry ownership, limits, and procedure routing for no current browser or mobile client.

**Alternatives considered**: Keep `apps/cloud` as the public service; add a generic endpoint; support both HTTP and PostgreSQL. Each adds a second contract or caller-controlled routing.

## One factory selects the connection

**Decision**: The accepted SDK forms are `createKeynes()` and `createKeynes({ databaseUrl })`. Resource definitions do not select the connection.

**Rationale**: One factory keeps connection lifecycle separate from durable Resource authority. KEY-56 makes root creation bind Resources atomically for both local and PostgreSQL paths.

**Alternatives considered**: Separate local and remote factories; a deployment-mode discriminator; retain `createKeynes({ resources })`. Each exposes deployment mechanics or prevents reopening an existing authority before a Resource schema is known.

## Parse and normalize the database URL once

**Decision**: Accept one literal PostgreSQL URL with a closed parameter set. Require exactly one `sslmode=verify-full`. Normalize it into one pool configuration and do not pass the raw connection string beside a separate SSL object.

**Rationale**: PostgreSQL URL parsers and drivers can give URL parameters precedence over programmatic TLS settings. One normalization boundary makes the effective host, identity, TLS, timeout, and pool settings inspectable before connection.

**Alternatives considered**: Pass `connectionString` directly; accept arbitrary libpq parameters; merge caller TLS objects. These allow ambiguous or weaker effective settings.

## TLS profile

**Decision**: Require TLS 1.2 or newer, certificate-chain verification, and hostname verification for every remote TCP connection. Trust comes from effective process roots or an explicitly supported root certificate path. The first profile uses PostgreSQL `SSLRequest` negotiation.

**Rationale**: A database password and Budget data must never cross plaintext or an unauthenticated endpoint. TLS 1.2 is the minimum profile supported across the declared PostgreSQL and Node.js environments.

**Alternatives considered**: `sslmode=require`, disabled hostname checks, caller-selected certificate hostnames, mutual TLS, and direct TLS negotiation. The first three weaken verification. Mutual TLS and direct negotiation have no current requirement.

## Database roles bind remote identity

**Decision**: PostgreSQL authenticates a scoped `LOGIN` role. A protected mapping binds the role's OID and name to one tenant principal. Remote wrappers use `session_user`, validate the mapping, assume a restricted execution role, and invoke the canonical core procedure. Separate private admin procedures create, rotate, disable, revoke, and audit credentials.

**Rationale**: Identity must come from the authenticated database session, not a caller field. Recording both OID and role name detects deletion and recreation. Separate runtime, execution, owner, and admin roles prevent SDK credentials from reaching tables or administration.

**Alternatives considered**: Trust transaction-local tenant settings; map only by role name; make the installer a credential CLI; expose admin calls through the SDK. Each weakens identity binding or expands public authority.

## Procedure and semantic compatibility

**Decision**: Generated metadata names required remote procedures and semantic identities. The SDK checks installation, command contract, Policy profile, and required capabilities before mutation. Operational and evidence settings remain outside semantic identity. Broad multi-generation windows belong to Release Support.

**Rationale**: The SDK must reject incompatible meaning before changing a Budget without treating pool sizes, quotas, or evidence configuration as semantic differences.

**Alternatives considered**: One catch-all compatibility digest; best-effort procedure probing; implement rolling upgrades now. These either reject valid deployments, fail too late, or pull a later release problem into KEY-55.

## Distinct recovery and lookup values

**Decision**: `OperationKey` identifies one command attempt for replay and recovery. `BudgetReference` identifies one durable Budget for remote reopen. Both are opaque, versioned values with separate validation and authorization.

**Rationale**: Recovery retention and Budget lifetime differ. Separate types prevent an operation key from becoming an accidental permanent lookup capability.

**Alternatives considered**: Rebrand the creating operation key as the Budget reference; expose internal UUIDs. Both couple public meaning to private storage.

## Explicit read-only recovery

**Decision**: Add a read-only recovery procedure and SDK method. It returns committed, known-failure, unresolved, or expired state. The SDK exports a pure operation-key factory so an application can persist the key before dispatch. Mutation retries reuse that key only for uncertain retryable outcomes, with bounded attempts and a total deadline.

**Rationale**: Resubmitting an unknown command body after process restart is not reliable recovery. A read path can resolve response loss without repeating a transition.

**Alternatives considered**: Retry once; retry every transient error; require command resubmission. Fixed counts ignore deadlines, broad retry hides definitive outcomes, and resubmission requires state the new process may not have.

## Preserve inspection behavior

**Decision**: Keep the current `inspect()` public result. PostgreSQL supplies bounded ordered history pages, and the remote executor assembles them internally before projecting the existing snapshot.

**Rationale**: Splitting history into a new public method would break the local API and is not required to bound database work.

**Alternatives considered**: Make `inspect()` current-state-only; return a public cursor. Both create a shared API change outside the remote feature.

## Layered limits and safe errors

**Decision**: Keep semantic limits in the canonical contract. Name transport, operational, quota, and evidence limits separately. Project database and driver failures into stable SDK categories with safe structured details and an unknown fallback.

**Rationale**: Deployments may tune pools, timeouts, and quotas without changing Budget meaning. Public errors need enough detail for action without exposing SQL, credentials, stack traces, or private identifiers.

**Alternatives considered**: One exact limits identity; pass through database errors; close the error union with no fallback. These confuse compatibility, leak internals, or break on new server failures.

## Retire the private service last

**Decision**: Preserve KEY-47 records. Move the useful isolation, replay, restart-equivalent, and database-unavailable assertions to direct PostgreSQL tests, then remove `apps/cloud` from active generation and qualification.

**Rationale**: Historical evidence is revision-scoped. Deleting the service first would discard useful assertions before the new owner exists.

**Alternatives considered**: Delete immediately; retain both paths indefinitely. One creates a coverage gap, and the other keeps an unowned protocol alive.
