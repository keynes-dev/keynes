# Research: Cloud runtime and service

## Decision: implement one real private HTTP boundary

**Decision**: Use Node's built-in `node:http` server with one loopback-only `POST /rpc` endpoint.

**Rationale**: FEAT-0006 must prove authentication at a transport boundary, service-process restart, and a response lost after PostgreSQL commits. An in-process method cannot establish those facts. One endpoint and the standard library provide the needed boundary without choosing a framework or final public protocol.

**Alternatives considered**:

- An in-process service class was rejected because it cannot prove the declared process and transport failures.
- A web framework was rejected because one route needs no framework behavior and the dependency would not reduce implementation risk.
- A final versioned public RPC API was rejected because Policy, compatibility, and the public Cloud SDK remain later roadmap work.

## Decision: generate one Cloud procedure manifest

**Decision**: Extend `scripts/generate-contracts.ts` to emit `packages/cloud/src/generated/procedures.ts` from `packages/contracts/contract.json`.

**Rationale**: The contract manifest already owns the five operation names, targets, permissions, replay flags, input names, and output names. A Cloud-owned generated table can add static parameterized SQL and the contract digest without importing the SDK. PostgreSQL continues to validate command bodies and results.

**Alternatives considered**:

- Importing `packages/sdk/` was rejected by `packages/cloud/README.md` and ADR 0001.
- Copying the generated SDK client, types, and validators was rejected because this private server does not need the SDK's client-side error classes and result shaping.
- Creating `@keynes/contracts` or a shared runtime workspace was rejected because the repository deliberately has only SDK and Cloud workspaces.
- Parsing `packages/contracts/contract.json` at service startup was rejected because production code must not depend on repository source layout.

## Decision: keep installation and host mechanics Cloud-owned

**Decision**: The production service verifies an already installed database. Cloud acceptance owns a small test installer that reads the canonical manifest, installation record, and SQL files with the same digest checks. Do not move or import SDK-private migration or PostgreSQL adapters.

**Rationale**: Migration files, checksums, contract digest, and expected targets remain canonical under `packages/database/`. The SDK installer also depends on SDK-generated errors and its qualified package layout. Moving it would churn the accepted local archive and create a shared runtime abstraction before two implementations demonstrate a stable common seam.

**Alternatives considered**:

- Moving `packages/sdk/src/private/migrations.ts` into a new shared package was rejected as premature ownership expansion.
- Letting the service auto-install on startup was rejected because the limited execution role must not own DDL or private-table writes.
- Duplicating SQL or migration metadata under Cloud was rejected because it would create a second migration graph.

## Decision: use tenant-scoped command identity, not a second replay store

**Decision**: Treat `(authenticated tenant, commandId)` as the durable operation identity. Let `keynes_internal.commands` bind it to operation, target, canonical body, principal, result, and commit in the existing authority transaction.

**Rationale**: The current command ledger already provides atomic result storage, exact replay, concurrent serialization, and same-tenant conflict detection. A service-side idempotency table or cache would duplicate durable result ownership. UUID reuse in another tenant is a distinct operation identity and cannot reveal or replay the original tenant's result.

**Alternatives considered**:

- A global Cloud operation ledger was rejected because the narrowed spec does not require command UUIDs to be globally unique and another store would add binding, migration, and recovery semantics.
- An in-memory replay cache was rejected because it would fail after restart and could disagree with PostgreSQL.
- Automatic service retries were rejected because only the caller knows whether to repeat an application-level request; the database safely classifies an exact command retry.

## Decision: controlled digest authentication with database authorization

**Decision**: Configure SHA-256 digests of opaque bearer tokens mapped to tenant and principal UUIDs. Authenticate before parsing authority fields, then let PostgreSQL recheck the operation permission under transaction-local identity.

**Rationale**: Controlled identities are sufficient to prove the end-to-end boundary without selecting an external identity provider. Digest-only configuration and evidence avoid persisting raw tokens. Database permission checks remain authoritative even if service routing code is wrong.

**Alternatives considered**:

- Caller-supplied tenant or principal fields were rejected because they allow authority selection by untrusted input.
- JWT/JWK or hosted identity integration was rejected because provider choice, rotation, claims, and account administration are outside this feature.
- Service-only authorization was rejected because it would bypass the existing database permission boundary.

## Decision: restrict the execution role and fail startup closed

**Decision**: Revoke public procedure execution, then give the service role only connection, `keynes` schema usage, execute on the five generated procedures, and read-only installation-ledger access. Before listening, compare the installed contract digest and every procedure signature with the generated manifest.

**Rationale**: The service needs to prove it is connected to the expected authority before accepting commands. A separate owner connection installs migrations and test permissions, then closes. The runtime role cannot write or inspect private Budget state directly.

**Alternatives considered**:

- Running with the database owner was rejected because it makes the procedure boundary unenforceable.
- Starting and reporting mismatch on the first request was rejected because the service would advertise readiness before authority compatibility was known.
- Falling back to local state or another connection was rejected by the feature and constitution.

## Decision: use a child-process-only committed-response fault seam

**Decision**: The native runner passes one generated command ID through private process configuration. After that command commits, the child destroys the response socket and exits before sending bytes. The restarted service receives no fault configuration.

**Rationale**: This creates the exact ambiguous transport outcome without exposing a caller-triggerable endpoint, altering database semantics, sleeping through races, or importing the SDK's local fault hook.

**Alternatives considered**:

- A request header was rejected because untrusted callers must not trigger faults.
- Killing the socket at an arbitrary time was rejected because it cannot establish whether commit occurred.
- Throwing inside the transaction was rejected because it proves rollback, not committed-response loss.

## Decision: separate default verification from native acceptance

**Decision**: Keep `pnpm verify` deterministic and Docker-free. Add `pnpm test:cloud -- --output <record.json>` as a separately invoked provider-free native lane using the existing pinned PostgreSQL image and loopback networking.

**Rationale**: Native PostgreSQL and real child processes are required evidence, but Docker availability is not a safe default contributor assumption. The explicit lane spends no money or provider resources and retains the exact environment and scenario results.

**Alternatives considered**:

- Mock-only database tests were rejected because they cannot prove persistence, tenant scoping, replay, or role restrictions.
- Adding Docker to `pnpm verify` was rejected because the repository already keeps native platform qualification separate.
- A managed PostgreSQL provider was rejected because it would require credentials, authorization, cost controls, and a different evidence claim.

## Explicitly deferred

External identity and account provisioning, token rotation, TLS and live exposure, managed-provider deployment, final public Cloud SDK and protocol, automatic network retries, routing, lineage movement, authority epochs, multi-home recovery, backups, failover, Policy, compatibility windows, performance thresholds, security qualification, incident operations, and production readiness remain `NOT RUN`.
