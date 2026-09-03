# Implementation plan: Remote PostgreSQL SDK

**Feature ID**: `FEAT-0013` | **Branch**: `feat/0013-remote-sdk-public-service` | **Date**: 2026-09-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `docs/features/0013-remote-sdk-public-service/spec.md`

## Summary

Add direct PostgreSQL access to the server-side TypeScript SDK from the completed FEAT-0014 Resource-bound Budget creation baseline. The SDK will normalize one strict `databaseUrl`, own a `pg` pool, check procedure compatibility, and project generated requests and results through the existing Keynes and Budget handles. PostgreSQL will authenticate scoped roles, derive one principal, and remain the only owner of durable Budget state, replay, recovery, and history.

FEAT-0013 adds remote-only Budget references, reopen, and read-only operation recovery while preserving the current `inspect()` result. It replaces active `apps/cloud` coverage only after equivalent direct PostgreSQL assertions pass. This plan creates no HTTP Budget protocol.

## Technical context

**Language/version**: TypeScript 7.0.2 on Node.js 24 and 26; SQL and PL/pgSQL on PostgreSQL 18.6
**Primary dependencies**: existing generated contract pipeline, `pg` 8.23.x, `pg-connection-string`, Node.js TLS; both PostgreSQL libraries become declared SDK runtime and packed-production dependencies
**Storage**: private in-memory SQLite for local Budgets; PostgreSQL for every remote Budget
**Testing**: Vitest, shared contract conformance, native PostgreSQL system tests, packed SDK consumers, hosted Node.js matrix
**Target platform**: trusted server-side Node.js on declared Linux, macOS, and Windows profiles; PostgreSQL 18.6 direct, session pooler, and transaction pooler profiles
**Project type**: monorepo library plus PostgreSQL installation package
**Performance goals**: publish bounded connect, acquire, command, retry, history-page, and shutdown limits before acceptance; performance qualification beyond those safety bounds remains `NOT RUN`
**Constraints**: strict TLS, no HTTP data path, no fallback, no SDK replay ledger, no public arbitrary SQL, no local reopen, no change to the public `inspect()` result
**Scale/scope**: one TypeScript SDK, one PostgreSQL server profile, two tenants in isolation tests, and histories spanning at least three internal pages

## Constitution check

### Before design

- **One source of truth per Budget**: Pass. PostgreSQL owns all remote state and transitions. The SDK holds connection and handle state only.
- **Effect boundary**: Pass. Applications retain external work, provider retry, observation, outcomes, and fallback choices.
- **Policy and security**: Pass. Existing Policy semantics remain generated and fail closed. PostgreSQL authentication, protected principal mapping, remote wrapper ACLs, TLS, and secret exclusion define the remote boundary.
- **Consistent behavior across deployments**: Pass. Shared conformance covers semantic parity; direct and pooled PostgreSQL, remote security, recovery, packaging, and hosted compatibility keep separate tests.
- **Evidence-first delivery**: Pass. Each behavioral task writes and observes a failing test before implementation. Managed, provider, hostile-role, recovery-drill, fault, benchmark, and production claims stay in separate authorized lanes or remain `NOT RUN`.

### After design

The design preserves the same conclusions. No constitutional exception is required. FEAT-0014 owns the shared Resource-binding API; FEAT-0013 does not duplicate that work.

## Prerequisite gate

Do not implement any FEAT-0013 source task until all of these conditions hold on `main`:

1. FEAT-0014 is merged on `main`, and T001 records its accepted revision.
2. Its accepted implementation provides `createKeynes()` for local connection setup and atomic Resource binding during root creation.
3. Shared local and native PostgreSQL conformance passes for root creation, Policy binding, replay, settlement, and current `inspect()` behavior.
4. Its public SDK types and generated contracts are the baseline consumed by this plan.

FEAT-0014 owns its branch, specification, plan, tasks, review, evidence, and merge. FEAT-0013 remains planning-only until its canonical branch is refreshed from that merge and T001 through T004 close the gate.

## Design

### Public SDK boundary

`packages/sdk/src/keynes.ts` keeps one `createKeynes` factory. The zero-argument overload comes from FEAT-0014. FEAT-0013 adds the `{ databaseUrl }` overload and returns a remote-capable Keynes handle. Shared Budget methods continue to use the generated client and public projection code.

Remote-only types live in focused SDK modules and exports. `BudgetReference` is not an alias for `OperationKey`. Remote reopen checks expected Resource types through PostgreSQL before constructing a handle. `Budget.inspect()` keeps its existing result; the remote executor obtains current state and bounded history pages internally.

### Connection and TLS ownership

A new remote connection module parses the URL once with `pg-connection-string`, validates the closed parameter set, and builds one `pg.PoolConfig`. It requires `sslmode=verify-full`, TLS 1.2 or newer, chain verification, and hostname verification. It rejects unsafe or ambiguous inputs before constructing `pg.Pool`.

The remote executor owns acquire, transaction, statement, retry, and shutdown boundaries. It supports only the connection profiles proved by native tests. The SDK never accepts a caller pool or raw database handle in this feature.

### Contract and procedure ownership

`packages/contracts` remains the authored neutral owner for operation names, public inputs and results, error categories, semantic identities, and conformance cases. Generation adds remote procedure metadata and validators. `packages/postgresql` owns migrations, remote wrappers, credential administration, installation checks, and native tests.

Remote wrappers derive identity from `session_user`, validate an enabled role mapping by OID and name, set transaction-local Keynes identity, assume a restricted execution role, and invoke the canonical core procedure. They do not reproduce Budget or Policy rules.

Private administrative procedures own credential create, rotate, disable, enable, revoke, and audit operations. The public SDK does not expose them. Installer and recheck logic verify their ownership, grants, function properties, and object identities.

### Recovery and retry

Generated contracts add a read-only recovery result. PostgreSQL returns committed, known failure, unresolved, or expired status for an authorized `OperationKey`. Recovery creates no command or history entry. The SDK exports a synchronous operation-key factory, and every remote mutation accepts a caller-created key before dispatch. SDK-generated keys remain the convenience default, but they do not promise recovery after the originating process loses the key.

The SDK classifies only uncertain transaction, connection, load, and availability failures as retryable. It preserves the operation key across bounded attempts and a total deadline. Definitive validation, authorization, Policy, denial, conflict, settlement, and compatibility results return without retry.

### Compatibility, limits, and errors

Compatibility checks name installation, command contract, Policy profile, semantic generation, procedure revision, and minimum SDK generation. Operational pool settings, quotas, and evidence profiles remain outside semantic identity. Release Support owns broader rolling-generation policy.

Public remote errors reuse existing domain errors where meaning matches and add SDK-owned configuration, TLS, authentication, compatibility, timeout, uncertain, closed, and unknown categories. The projection layer allowlists safe detail fields and never returns raw driver or database messages.

## Project structure

Extend `packages/contracts`, `packages/postgresql`, and `packages/sdk`. Remove `apps/cloud` only in the final replacement phase. [tasks.md](tasks.md) names every source and test path. Add no workspace, service, public package, or generic storage layer.

## Verification

Run these provider-free gates during implementation:

```sh
CI=true pnpm check:repo
CI=true pnpm test:unit
CI=true pnpm test:pr
pnpm test:system:postgresql
pnpm pack:sdk
pnpm test:package:sdk -- --archive <exact-archive>
pnpm pack:postgresql
pnpm test:package:postgresql -- --archive <exact-archive>
```

Dispatch hosted package compatibility only for the accepted revision. Run an authorized remote-database lane only after the user approves the external endpoint and credential scope. Record unavailable lanes as `NOT RUN`.
