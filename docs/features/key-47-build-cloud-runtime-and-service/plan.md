# Implementation plan: Build cloud runtime and service

**Linear issue**: `KEY-47` | **Branch**: `feat/0006-cloud-runtime-service` | **Date**: August 25, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `docs/features/key-47-build-cloud-runtime-and-service/spec.md`

## Summary

Implement one private loopback HTTP service in `packages/cloud/` with Node's built-in HTTP server and one `pg.Pool`. A controlled bearer-token registry maps each request to one tenant and principal. The service opens one transaction, sets that identity transaction-locally, and invokes one allowlisted `keynes.*` procedure. PostgreSQL remains the only Budget authority and stores replayable command results.

Extend the contract generator with one Cloud-owned procedure manifest derived from `packages/contracts/contract.json`. Do not import the SDK, copy its client, create a shared runtime workspace, or add a second idempotency store. Use the existing command identifier as the operation identifier within the authenticated tenant. Exercise the actual service and a pinned native PostgreSQL container through a child-process acceptance runner that proves lifecycle, isolation, restart durability, committed-response loss, exact and conflicting replay, permission denial, installation mismatch, and explicit database unavailability.

## Technical context

**Language/Version**: TypeScript 7.0.2 on Node.js 24-26 ESM
**Primary Dependencies**: Node.js `node:http` and `node:crypto`; `pg@8.23.0`; existing pnpm 11.21.0, Vitest 4.1.11, contract generator, and pinned PostgreSQL 18.6 image
**Storage**: One writable native PostgreSQL authority home using the existing migration graph, procedure schema, command ledger, Budget tables, and history
**Testing**: Vitest service tests; generator drift tests; one provider-free Docker and child-process acceptance runner over loopback HTTP; unchanged local SDK and native core suites
**Target Platform**: Private Node.js service on the contributor host; loopback HTTP and a pinned Linux PostgreSQL container for KEY-47 acceptance
**Project Type**: Private TypeScript service workspace with a native PostgreSQL authority
**Performance Goals**: No throughput or latency qualification in this feature; every request and process step has a bounded test timeout
**Constraints**: One authority home; no SDK import; no framework; no automatic operation retry; no caller-selected tenant, principal, or database; no raw token, database URL, password, or command body in retained evidence; no routing, Policy, public SDK, managed provider, failover, or production claim
**Scale/Scope**: One private endpoint, five existing database operations, two tenants, controlled principals, one service process at a time, one PostgreSQL container, and one retained acceptance record

## Constitution check

_Gate result before research: PASS. Re-checked after Phase 1 design: PASS._

- **Singular authority - PASS**: `packages/database/migrations/` remains the only hand-authored Budget semantic source. Cloud sets authenticated transaction context and invokes generated allowlisted procedure statements. The existing procedures continue to own validation, permissions, conservation, atomicity, replay, settlement, unresolved state, and history. Cloud adds no authority table or transition.
- **Effect boundary - PASS**: The service transports Budget commands and returns authority results. Test fixtures do not execute application work. Applications still own workflow validity, external effects, provider idempotency and retry, usage observation, outcomes, and fallback behavior.
- **Policy and security - PASS**: Policy is N/A because KEY-47 neither publishes nor evaluates one. Authentication hashes an opaque bearer token and resolves only configured tenant and principal identity. PostgreSQL rechecks permission and tenant scope. The execution role can execute only the five generated procedures and read installation metadata needed at startup; it cannot write private tables or inspect another tenant's state. Missing or ambiguous identity fails before database dispatch. Tokens and database credentials are excluded from logs and evidence.
- **One cross-runtime contract - PASS**: The logical command, result, error, migration, and procedure contracts do not change. `scripts/generate-contracts.ts` adds one Cloud-owned manifest from the same operation source and contract digest. Local SDK behavior remains unchanged. KEY-47 compares the declared canonical lifecycle and replay outcomes across accepted local/core evidence and the actual Cloud path; final public Cloud protocol compatibility remains `NOT RUN`.
- **Evidence-first delivery - PASS**: Generator, HTTP authentication/envelope, startup verification, native lifecycle, isolation, permission, restart, response-loss, concurrent replay, conflict, and database-unavailability tests are written and observed failing before implementation. `pnpm verify` stays provider-free and Docker-free. `pnpm test:cloud` is a separate provider-free native lane that uses only loopback networking and the pinned PostgreSQL image, writes a non-overwriting record, and spends no managed-provider money. Managed, paid, live, security, recovery, benchmark, and production lanes remain `NOT RUN`.

No constitutional exception is required.

## Design

### Generate the Cloud procedure edge

Extend `scripts/generate-contracts.ts` to emit `packages/cloud/src/generated/procedures.ts`. The file contains the contract digest and an exhaustive operation map derived from `packages/contracts/contract.json`: operation name, schema-qualified target, static parameterized SQL statement, permission, and replay flag. Generator drift detection owns the file. Cloud hand-written code imports this manifest; it does not parse repository source at runtime.

Do not copy `packages/sdk/src/generated/client.ts` or its validators. The private service accepts only a closed `{ operation, input }` transport envelope, while the named database procedure performs canonical command validation and returns the existing wire envelope. This preserves one semantic validation boundary and avoids making the SDK an internal server dependency.

### Authenticate before authority selection

The private service accepts one bearer token. Startup configuration contains only SHA-256 token digests with their tenant and principal UUIDs. The authentication module hashes the presented token, resolves exactly one record, and returns the bound identity. A missing, malformed, unknown, or ambiguous token fails without dispatch. Transport input cannot contain tenant, principal, connection, or database-location fields.

The controlled digest registry is a KEY-47 test and private-preview mechanism, not a production identity system. External identity integration, token issuance, rotation, account administration, TLS, and public exposure remain deferred.

### Invoke one procedure in one transaction

Cloud owns a small PostgreSQL adapter using one `pg.Pool`. For each accepted request it acquires one client, begins one transaction, sets `keynes.tenant_id` and `keynes.principal_id` with transaction-local `set_config`, executes exactly the generated statement for the selected operation, and commits before the HTTP response is written. Failure rolls back and releases the client. Cloud neither reads nor writes Budget tables.

The existing command `commandId` is the durable operation identifier. Its effective identity is `(authenticated tenant, commandId)`. The database command ledger binds that identity to operation, target, canonical body, principal, stored result, and history. Exact or concurrent retries return the stored result. A changed operation, target, or body within the same tenant returns `command_conflict`. The same UUID in another tenant is a different identity and cannot read or replay the first tenant's result. No global key registry, response cache, or automatic retry is added.

At startup, the service verifies the generated contract digest against the installed migration ledger and verifies every generated procedure signature through PostgreSQL catalogs before listening. Provisioning revokes public procedure execution. The execution role receives read-only access to the migration ledger plus usage and execute rights for the five public procedures. Installation and test identity provisioning use a separate owner connection that is closed before service traffic begins.

### Keep the transport private

Use Node's built-in HTTP server with one `POST /rpc` endpoint as defined in [contracts/private-rpc.md](contracts/private-rpc.md). The endpoint is private and loopback-only in KEY-47. It returns the existing authoritative database wire envelope on successful dispatch and a small transport error envelope for authentication, malformed transport, startup, or database availability failures. It exposes no raw SQL, procedure name, tenant, principal, connection string, fault control, or final public SDK contract.

The service does not retry a database or transport failure. A caller that does not know whether a mutation committed retries the same command. PostgreSQL decides replay or conflict.

### Prove the real process boundary

`packages/cloud/src/private/run-native-acceptance.ts` starts the already pinned PostgreSQL container on an ephemeral loopback port, installs the canonical migration graph with an owner connection, creates two tenant/principal fixtures and a limited execution role, then spawns `packages/cloud/src/main.ts` as a child process. The runner drives the service only through HTTP.

A private child-process-only fault configuration selects one runner-generated command ID. After the procedure transaction commits, the service destroys that response socket and exits before sending bytes. The runner restarts the service without the fault configuration and retries the exact request. This seam is never accepted from an HTTP header or request body.

The runner also restarts the ordinary client driver and service while retaining PostgreSQL, issues concurrent exact retries, attempts same-tenant conflicts and cross-tenant known-ID access, pauses PostgreSQL for a bounded unavailable request, and proves an empty or incompatible database prevents listening. It writes one caller-selected, non-overwriting JSON record containing revision state, contract digest, environment, exact PostgreSQL image, scenario results, and exclusions. It contains no secrets, URLs, or command bodies.

## Project structure

### Documentation for this feature

```text
docs/features/key-47-build-cloud-runtime-and-service/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── private-rpc.md
└── tasks.md
```

### Source code

```text
packages/cloud/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── authentication.ts
    ├── database.ts
    ├── database.test.ts
    ├── main.ts
    ├── service.ts
    ├── service.test.ts
    ├── generated/
    │   └── procedures.ts
    └── private/
        ├── installation.ts
        ├── native-acceptance-child.ts
        ├── run-native-acceptance.ts
        └── service.native.test.ts
packages/contracts/
├── contract.json
└── generated/
    └── contract-digest.json
packages/database/
├── generated/
│   └── installation-record.json
└── migrations/
scripts/
├── generate-contracts.ts
└── generate-contracts.test.ts
```

**Structure decision**: Keep the accepted two-workspace repository. Contract and database sources remain source-only owners. Cloud receives one generated manifest in its own workspace and implements only authentication, transport, pooling, startup verification, and private acceptance mechanics. No new workspace or cross-workspace runtime dependency is introduced.

## Complexity tracking

No constitutional violation or justified extra layer is required.
