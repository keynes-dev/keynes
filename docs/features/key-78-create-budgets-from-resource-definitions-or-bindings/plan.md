# Implementation plan: Create Budgets from Resource definitions or bindings

**Branch**: `key-78-create-budgets-from-resource-definitions-or-bindings` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/spec.md`

## Summary

Configure `createKeynes({ resources })` once, then create roots with
`keynes.createBudget(amounts, options?)`. Supplied keys establish immutable
membership. Zero includes a member without funding. Local startup establishes a
private catalog; durable startup validates every declaration without writes.
Creation resolves existing definitions and commits its Budget, accounting, history,
and replay result in the selected authority.

Retain existing Policy attachment and remote operation keys in the second
argument. Replace positional and per-Budget Resource-source creation throughout
current callers. Preserve explicit provisioning and existing request, settlement,
and recovery behavior. KEY-77 is included at `abd1e18`; the planning base is
`93c4baa`. One KEY-78 PR must own the complete acceptance outcome.

## Technical Context

**Language/Version**: TypeScript 7.0.2 and SQL/PLpgSQL; Node.js >=24 contract. Planning environment has Node.js 26.5.0 and pnpm 11.21.0.

**Primary Dependencies**: Existing node:sqlite, pg 8.23.0, Kysely 0.29.5, pinned Policy parser/profile, generated schema validators. No new runtime dependency.

**Storage**: Private in-memory SQLite and native PostgreSQL 18.6 under the existing preview profile. Reuse catalogs, memberships, accounting, commands, and history.

**Testing**: Vitest 4.1.11, TypeScript consumers, existing paired SQLite/PostgreSQL gate, native security/transaction/recovery suites, SDK package consumer.

**Target Platform**: Existing local and direct PostgreSQL SDK paths and application-owned PostgreSQL transactions under the embedded profile.

**Project Type**: TypeScript library and PostgreSQL package in the existing pnpm workspace.

**Performance Goals**: N/A, no new performance commitment. One batch validation at startup and selected definitions only in each atomic creation command.

**Constraints**: No shared definition writes during startup or creation; fixed funding; fail-closed authority selection; input capture before suspension; asynchronous failures and local close precedence.

**Scale/Scope**: One configured creation contract across SDK, generated contracts, both authorities, shared scenarios, current consumers, and active documentation. Existing Resource and quantity limits apply.

## Constitution Check

Pre-research and post-design checks pass against constitution 9.0.0 as design
checks only. Runtime acceptance remains NOT RUN.

| Gate                               | Design and required evidence                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. One authority and atomic result | Database owns validation, membership, funding, history, replay. SDK holds captured declarations only. Fault tests inspect all affected state.                       |
| II. Application-owned effects      | N/A for external work. Creation and recovery govern quantity only.                                                                                                  |
| III. Restricted Policies           | Existing PolicySet options and context/reason inference remain. Check compatibility against selected members and retain fail-closed evaluation. No Policy redesign. |
| IV. Deployment consistency         | Every shared creation case runs on real SQLite and native PostgreSQL. Native wrappers, tenant isolation, caller transactions, and races have separate evidence.     |
| V. Test-first evidence             | Observe expected failing behavior/type tests before corresponding implementation. Retain exact-candidate commands and outcomes.                                     |
| Fixed funding                      | Zero members remain active and unresolved without funding movements. No top-ups, rollover, or automatic settlement.                                                 |
| Delivery                           | One KEY-78 branch and acceptance outcome. KEY-77 is merged in this checkout. KEY-6 generation and future controls/Policy/loading are not prerequisites.             |
| Compatibility and security         | Regenerate metadata; old client/installations fail compatibility. Authenticated authority context determines tenant and permission.                                 |

No constitutional exception is required. Preserve the current accounting
implementation; target journal conversion, Policy bindings, and reference-only
loading are separately owned work. The architecture's future single-baseline
layout does not authorize rewriting historical migrations in this feature.

## Project Structure

### Documentation for this feature

```text
docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/configured-creation.md
  quickstart.md
```

Design decisions are in [research.md](research.md), entities in
[data-model.md](data-model.md), interfaces in
[contracts/configured-creation.md](contracts/configured-creation.md), and acceptance
instructions in [quickstart.md](quickstart.md). The next tasks command owns
`tasks.md`; this command does not create it.

### Source code at repository root

```text
packages/contracts/
  schema.json, contract.json, src/load.ts
  src/generation/, contract-tests/scenarios/
packages/sdk/
  src/keynes.ts, resources.ts, budget.ts
  src/local/runtime.ts, sqlite-command-executor.ts, sqlite-store.ts
  src/remote/public-types.ts, postgresql-command-executor.ts
  src/generated/, test/unit/, test/contract/, test/package/
packages/postgresql/
  scripts/generate.ts, resource-definitions-migration.ts
  scripts/configured-creation-migration.ts           # planned renderer
  migrations/0008-configured-creation.sql            # planned generated SQL
  migrations/manifest.json
  test/system/, test/package/
packages/testkit/
scripts/run-sqlite-postgres.ts
docs/product.md, docs/architecture.md
docs/adr/0011-configured-resource-declarations.md
```

**Structure Decision**: Extend existing owners. Contract sources and renderers
produce validators, clients, and SQL. Add no catalog service, persisted client
registry, or generic adapter layer. Preserve generated Spec Kit files unchanged.

## Implementation boundaries

1. Specify factory inference, extra-key rejection, exact returned members,
   separate options, startup validation, and new wire shapes through failing tests.
2. Add authorized read-only `validateResources`. Initialize private SQLite
   explicitly; validate durable declarations after the connection handshake.
   Return a client only after success and clean up every failed attempt.
3. Replace creation ResourceSource resolution with selected-definition validation
   in both authorities. Preserve zero memberships, positive funding only, canonical
   replay, caller rollback, and authorization for supported direct callers.
4. Adapt SDK factories, current callers, fixtures, adapters, package examples, and
   active docs. Explicit provisioning cannot widen an existing client's names.
5. Complete paired/native/package acceptance for one candidate and retain results
   under this feature. Do not use KEY-77 evidence to qualify changed behavior.

Each behavioral step starts with an observed failing test. Internal phases remain
in the future tasks artifact, without phase issues or PR stacks.

## Complexity Tracking

None. No violated rule or exception to track.

## Planning evidence boundary

These documents are local-only design artifacts. Runtime implementation, new type
acceptance, paired behavior, native races/rollback/security, and package acceptance
are NOT RUN. Hosted, paid-provider, production-readiness, and performance
qualification are N/A. Extension configuration registers no planning hooks.
