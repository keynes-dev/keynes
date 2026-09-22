# Implementation plan: Compose application policies into Budget requests

**Branch**: `key-117-compose-application-policies-into-budget-requests` | **Date**: 2026-09-21 | **Spec**: [spec.md](spec.md)

## Summary

Add one optional, per-call Policy to the SDK's Budget request path and expose the same preparation without allocation. The SDK captures the proposal, invokes customer code once and validates its `PolicyResult`. Only a prepared final request reaches the existing SQLite or PostgreSQL authority. Plain requests keep their current contract.

Consolidate KEY-116 under an optional `@keynes/policy` package for configurable-Policy construction, snapshots, records and `minimumCeilings`. The SDK owns only callback and result types and cannot depend on toolkit schema, Zod or provider code.

This is a documentation plan. Implementation, runtime tests, provider execution, archive qualification and publication are `NOT RUN`.

## Technical context

**Language/version**: TypeScript 7.0.2, ESM, Node.js >=24.

**Primary dependencies**: SDK core uses no new dependency. The optional toolkit reuses Ajv 8.20.0, canonicalize 4.0.0, json-schema-to-ts 3.1.1 and optional Zod 4.6.5 from KEY-116.

**Storage**: None added. Applications retain Policy records, parameter snapshots, assessments and recoverable submission attempts. Existing SQLite and PostgreSQL authorities remain unchanged.

**Testing**: Existing Vitest, SDK Local tests, native PostgreSQL system runner, type consumers and package-isolation helpers.

**Target platform**: Node applications. No browser or hosted evaluator qualification.

**Performance goals**: One Policy invocation per fresh decision. No Policy invocation during command replay. No latency claim for customer code or providers.

**Constraints**: Policy-free compatibility; one callback per call; immutable captured proposal; strict final envelope validation; no policy plus Remote operation key; no hidden retry, persistence or transaction management.

## Constitution check

Pre-research and post-design checks PASS against constitution 13.0.0.

| Gate                            | Result and planned proof                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| I: one authority                | PASS. Policy preparation changes no Budget state; existing commands remain the only accounting authority.              |
| II: application-owned effects   | PASS. Customer code owns rules, facts, providers, fallback and external work.                                          |
| III: optional Policy middleware | PASS. One optional SDK callback runs before command submission; direct requests and supported SQL access remain valid. |
| IV: deployment consistency      | PASS. The SDK prepares one engine-neutral final envelope; Local and native PostgreSQL exercise the same outcomes.      |
| V: test-first evidence          | PASS. Every behavioral phase begins with an observed failing check and ends with revision-scoped evidence.             |
| Privacy and recovery            | PASS. Nothing is captured implicitly; replay submits a retained command without rerunning Policy.                      |

No exception is required. ADR-0014 and the 13.0.0 amendment resolve the former prohibition on callbacks in the allocation API.

## Project structure

Planned source paths:

```text
packages/sdk/src/
  policy.ts                 # Policy and PolicyResult contracts plus shared preparation
  budget.ts                 # Local request and prepareRequest entry points
  remote/public-types.ts    # Remote request and prepareRequest contracts
  remote/result-mapping.ts  # Remote wrapper integration

packages/policy/            # renamed private KEY-116 workspace
  src/parameters.ts
  src/snapshot.ts
  src/configure.ts           # configured-Policy construction and records
  src/ceilings.ts
  src/zod.ts
```

Existing SDK public and package-compatibility tests own callback behavior, operation admission, typing and Local integration. PostgreSQL system tests own Remote replay and transaction boundaries. Toolkit tests own configuration, snapshots, records, assessment fixtures and archive isolation.

## Design

### SDK request preparation

`Budget.request(resources, { policy })` and `Budget.prepareRequest(resources, { policy })` call one shared preparation function. The proposal is captured before invoking customer code. A Policy returns `prepared`, `rejected`, `review_required` or `failed`. The SDK captures and validates that result before exposing it or submitting its final request.

Policy-free `request(resources, options?)` retains its current return and proposal-key inference. Policy-enabled request results distinguish non-submission from allocation approval or denial. Their child Budget Resource type comes from the Policy's declared final Resource vocabulary, because the Policy may change membership.

Remote options reject `policy` plus `operationKey` before proposal capture or callback invocation. `prepareRequest` accepts Policy but no operation key. Recovery persists the final request, evidence, target and key before calling ordinary `request` without Policy.

### Lifecycle and authority

The public SDK wrapper admits the operation before reading caller-controlled proposal or Policy properties. An admitted asynchronous Policy participates in close draining. Calls after close reject asynchronously before inspecting input. Policy failures remain Policy failures; allocation errors and denials keep their existing meanings.

Policy runs before the database command and outside engine-owned locks. Borrowed PostgreSQL callers still own their transaction. The SDK sends no callback, assessment or Policy result to SQLite or PostgreSQL.

### Optional toolkit

Plain Policies use SDK types directly. `@keynes/policy` preserves KEY-116 declarations and snapshot bytes and adds a configured-Policy constructor. Without an explicit snapshot it selects and validates declaration initials once. With an explicit snapshot it restores against the trusted declaration before returning the callback.

The toolkit may create a portable Policy record containing caller-selected JSON, parameter identities and the captured result. It never captures arbitrary closure state, credentials or raw thrown values. `minimumCeilings` only computes independent minima. Customer code explicitly decides whether to reject or construct reduced quantities.

The recorded-assessment fixture defines a typed available or unavailable answer. Policy code owns the response to either state. No Jev package, provider adapter or credential boundary is added.

## Delivery sequence

1. Lock SDK callback/result types and policy-free compatibility with failing consumer and lifecycle checks.
2. Implement shared preparation, then integrate it into Local request and explicit preview.
3. Add Remote preparation, recovery rules and native transaction/replay coverage.
4. Move KEY-116 into the optional toolkit and add configured Policies, records, ceilings and recorded-assessment fixtures.
5. Qualify source behavior and installed SDK/toolkit archives, then reconcile every requirement at one revision.

Each phase ends with a read-only Ponytail review, evaluation of its findings, relevant verification and a local commit before the next phase. One feature remains one PR.

## Verification

[quickstart.md](quickstart.md) separates provider-free, Local, native and archive lanes. [contracts/toolkit.md](contracts/toolkit.md) owns the proposed public contract. [data-model.md](data-model.md) defines results and retained data. Existing full gates remain required where the implementation touches their behavior.

## Complexity tracking

No constitutional exception, Policy registry, workflow engine, provider framework, database migration or persistence manager is planned.
