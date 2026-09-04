# Implementation Plan: Portable Policy evaluation

**Linear issue**: `KEY-54` | **Branch**: `feat/0012-portable-policy-evaluation` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `docs/features/key-54-portable-policy-evaluation/spec.md`

## Summary

Add immutable, Budget-local Policies that constrain exact Resource requests in
both local SQLite and embedded PostgreSQL. Kysely is the normal typed authoring
surface and raw SQL is the advanced escape hatch. Both paths compile to SQL and
parameters, pass through the PostgreSQL 18 parser from pinned
`libpg-query@18.1.4`, and normalize into one versioned `PolicyProgramV1`.

One machine-readable semantics profile defines the program's node types, type
rules, null behavior, bounded-decimal behavior, work costs, and canonical test
vectors. The v1 local backend interprets the program inside its existing SQLite
transaction. The v1 PostgreSQL backend validates it, renders allowlisted SQL
over parameterized request, availability, and context inputs, and evaluates it
inside `keynes_internal.apply_command`. Neither Kysely's operation tree, the
PostgreSQL parser tree, submitted SQL text, nor either backend representation is
durable or directly executable Policy authority.

The SDK also moves to a schema-first functional API. `defineResources` creates
one frozen Resource schema, and `createKeynes({ resources })` opens a ready local
runtime. Public `Keynes` and `Budget` names are readonly branded interfaces
implemented by frozen closure-backed handles. They retain method calls while
hiding runtime and Budget identity. They are not public classes.

## Technical Context

**Language/Version**: TypeScript 7.0.2 on Node.js 24 and 26; PostgreSQL 18.6 SQL/PLpgSQL
**Primary Dependencies**: `kysely@0.29.5` for typed query construction and compilation; `libpg-query@18.1.4` for the PostgreSQL 18 WASM parser; `decimal.js@10.6.0` for the bounded local decimal profile; existing `node:sqlite`, `pg@8.23.0`, AJV, canonical JSON, and generated contracts
**Storage**: Private process-owned in-memory SQLite for local Budgets; PostgreSQL 18.6 `keynes_internal` storage for durable Budgets; no Policy registry or second authority
**Testing**: Vitest unit/conformance/package suites; compile-only public API fixtures; shared local/PostgreSQL Policy corpus; native PostgreSQL system tests; private Cloud regression; packed SDK and PostgreSQL qualification; hosted Node.js 24/26 matrix
**Target Platform**: ESM TypeScript SDK on supported Node.js 24/26 Linux, macOS, and Windows hosts; embedded PostgreSQL 18.6
**Project Type**: pnpm/Turbo TypeScript monorepo with generated contracts, SDK library, PostgreSQL installer/runtime, and private Cloud service
**Performance Goals**: Reject over-limit programs before evaluation; bound each Policy to 65,536 estimated operations; retain the established SDK package measurement method and report parser initialization, archive/install size, ready RSS, cold creation, first request, steady request, and shutdown without inventing a readiness claim
**Constraints**: One statement and a published deterministic PostgreSQL-style profile; schema-first Resource typing; no public `Keynes` or `Budget` constructor; no ambient database access; no execution of submitted SQL; exact local/PostgreSQL numeric and null parity; fail closed; caller-owned PostgreSQL transactions; no remote Policy transport; parser WASM must be present in the packed SDK and load on all six supported hosts
**Scale/Scope**: At most 16 Policies per Budget, 64 input/output Resources per Policy, 32 context fields, 512 program nodes, 16 KiB source per Policy, 64 result rows, and 50 or more cross-runtime acceptance cases

## Constitution Check

_Pre-research gate: PASS. Post-design re-check: PASS._

- **One source of truth per Budget — PASS**: A local Budget remains one private
  SQLite row owned by `SqliteCommandExecutor`; a durable Budget remains one
  PostgreSQL authority row owned by `keynes_internal.apply_command`. Policy sets
  are immutable values stored inline with their Budget. No SDK, parser, service,
  or registry owns committed Budget state.
- **Effect boundary — PASS**: Policy reads only Keynes-provided request,
  availability, and application-supplied context values and returns ceilings.
  Applications continue to own business-data reads, context construction,
  external work, idempotency, retries, observation, outcomes, and fallback.
- **Policy and security — PASS**: Kysely and raw SQL share one parser, closed
  validator, normalizer, and limits profile. Unknown relations, functions,
  operators, statements, parser nodes, or versions fail closed. Submitted SQL
  never executes. PostgreSQL renders SQL only from validated program nodes;
  local evaluation receives no SQLite handle. Context forbids secrets and is
  recorded for replay.
- **Consistent behavior across deployments — PASS**: The same program, command
  schema, fixtures, decisions, evidence, and error families apply to local and
  PostgreSQL. One generated semantic registry owns node typing, null, numeric,
  work-limit, and canonical-vector rules. The TypeScript interpreter and
  PostgreSQL validator/renderer are deployment-native backends derived from
  that definition and tested differentially. The no-Policy corpus and private
  Cloud rejection lane constrain blast radius.
- **Evidence-first delivery — PASS**: Tasks must add and observe failing Kysely,
  raw-SQL, parser, validator, numeric, evaluator, transaction, replay, Cloud,
  package, and comparison tests before implementation. Provider-free repository
  gates run first. Native PostgreSQL, package, hosted, benchmark, and other lanes
  remain separate and exact-revision scoped; an unexecuted lane is `NOT RUN`.

No constitutional exception is required. Adding established authoring, parser,
and decimal dependencies is an explicit product choice, not an exception to a
dependency-free rule.

## Design Decisions

### Functional values and capability handles

`defineResources`, `definePolicy`, `definePolicySql`, and `policySet` are pure
functions that return frozen values. `createKeynes({ resources })` returns a
readonly `Keynes<Names>` interface whose methods close over the private runtime.
Approved Budgets are readonly `Budget<Names, Context, Reasons>` interfaces whose
methods close over that runtime and one private Budget ID. The implementation
freezes every handle and uses unexported `unique symbol` brands for nominal
TypeScript identity.

This is not a flat API. Callers still use `keynes.createBudget(...)` and
`budget.request(...)` because those methods bind hidden authority. Public
classes add constructor and prototype semantics without improving that
authority. They also add `this` binding hazards and force asynchronous creation
through a static factory anyway. `Keynes` implements `AsyncDisposable` through
the returned object, so both `await using` and explicit `close()` remain valid.

The Resource schema is complete before the runtime opens. This gives Policy and
Budget calls one exact Resource-name union and prevents a half-configured public
session. Remote access is outside KEY-54. Embedded PostgreSQL remains a
separate caller-owned transaction boundary. Error subclasses remain classes
because they extend the JavaScript `Error` protocol. Concrete internal resource
owners may use classes when that implementation is clearer.

### One Kysely-facing authoring model

`definePolicy` receives a callback with a cold Kysely PostgreSQL database typed
with only `requested_resources`, `available_resources`, and the definition's
`policy_context`, plus Kysely's `sql` template. It accepts a typed
`SelectQueryBuilder` with the exact result columns. Kysely compiles the query
without opening a connection. The `sql` template covers expressions the fluent
query API cannot express.

`definePolicySql` accepts a raw SQL string plus explicitly supplied parameter
values for callers who need complete textual control. Normal `${value}`
substitutions in Kysely remain parameters. Unsafe dynamic identifiers or text
from `sql.raw`, `sql.id`, `sql.ref`, and `sql.table` gain no trust: their compiled
SQL is parsed and rejected unless it fits the same fixed Policy profile.

### Kysely compiles; PostgreSQL parses

Kysely's operation nodes are compilation internals, not an arbitrary-SQL parser
and not a stable Keynes contract. Keynes compiles either authoring form to
PostgreSQL SQL and parameters, then invokes the pinned PG18 build of
`libpg-query`. The parser adapter converts recognized PostgreSQL nodes to an
internal candidate; the independent validator resolves names and types,
enforces the allowlist and limits, and emits `PolicyProgramV1`.

The implementation must not translate Kysely operation nodes directly. This
single textual convergence point proves that equivalent Kysely and raw SQL have
identical acceptance, normalization, canonical SQL, program, and digests.

### One semantic definition, deployment-native execution

`packages/contracts/policy-profile.json` is the authoritative machine-readable
definition of each `PolicyProgramV1` node's fields, input and output types, null
rules, numeric boundaries, work cost, canonical form, and PostgreSQL rendering
identity. Generation emits the mechanically expressible TypeScript types,
guards, exhaustive dispatch metadata, PostgreSQL validation/rendering metadata,
and canonical vectors. Backend code consumes those generated registries rather
than restating an allowlist.

Not every execution algorithm is sensibly data-generated. The local interpreter
and PostgreSQL renderer remain small deployment-native backends, but adding or
changing a program node must fail generation or conformance unless both backends
declare handling and pass the same canonical vectors. This is one semantic
definition with two execution backends, not two independently specified
languages.

Both backends evaluate inside the transaction that owns the Budget decision.
The local interpreter runs inside `BEGIN IMMEDIATE`; the PostgreSQL backend runs
inside `keynes_internal.apply_command` and the caller-owned transaction. Keynes
never accepts an application-computed ceiling as authority.

### Why v1 does not use one executable evaluator

A TypeScript evaluator outside PostgreSQL would require the durable authority to
trust caller-supplied ceilings or would remove direct SQL composition from the
embedded deployment. Running PostgreSQL in local mode would restore the PGlite
footprint that the SQLite runtime removed. A native or WebAssembly core loaded
by both Node.js and PostgreSQL could preserve transaction-local authority, but
the PostgreSQL half would require an extension binary, provider allowlisting,
ABI and server-version packaging, upgrades, and another security matrix. That
is a valid future design, not a prohibited one.

Reconsider the shared executable core if differential failures or the sustained
cost of changing two backends exceeds the extension and provider-support burden,
or if the product deliberately requires a Keynes-controlled service or custom
PostgreSQL extension. The versioned program and semantics profile preserve that
migration path.

### Expressive deterministic numeric profile

The profile uses a bounded decimal value rather than limiting users to addition
and subtraction. It includes unary signs, `+`, `-`, `*`, `/`, `%`, comparisons,
`abs`, `ceil`, `floor`, `round`, `trunc`, `sqrt`, and bounded integral `power`,
plus `sum`, `avg`, `min`, `max`, and `count`. Every numeric node normalizes to
the published `numeric(38,18)` profile. Division by zero, invalid roots or
powers, precision overflow, a non-integral final ceiling, and a final value
outside the safe-integer Resource range are evaluation errors.

Local evaluation uses a cloned, immutable `decimal.js` constructor configured
for 38 significant digits, 18 fractional digits at program boundaries, and
PostgreSQL-compatible half-away-from-zero rounding. PostgreSQL rendering uses
explicit `numeric(38,18)` casts at the same boundaries. Double-precision,
trigonometric, logarithmic, exponential, random, time, locale-sensitive, and
user-defined functions remain outside v1 because host-dependent floating-point
behavior would break portable evidence. Expanding the function allowlist later
versions the profile; it does not require replacing Kysely or the parser.

### Closed runtime authority

`PolicyProgramV1` is JSON-serializable and fully validated in both runtimes.
Canonical SQL is evidence generated from the program; original SQL and parser
trees are discarded. The PostgreSQL renderer never interpolates submitted SQL,
identifiers, or function names. It emits only fixed profile fragments and binds
request, availability, context, and literal values as parameters.

## Project Structure

### Documentation (this feature)

```text
docs/features/key-54-portable-policy-evaluation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── acceptance-record.md
    ├── architecture.md
    ├── command-contract.md
    └── policy-query-profile.md
```

### Source Code (repository root)

```text
packages/contracts/
├── src/model.ts
├── src/generation.ts
├── generated/                         # generated TS and PostgreSQL metadata
├── conformance/
├── policy-profile.json                # authoritative semantic registry
└── test/

packages/sdk/
├── package.json                     # pinned Kysely, parser, decimal deps
├── src/index.ts
├── src/resources.ts                 # frozen Resource schema and type carrier
├── src/keynes.ts                    # factory and public Keynes interface
├── src/budget.ts                    # private closure-backed Budget factory
├── src/local/runtime.ts             # process-local state and lifecycle
├── src/policy/                      # new authoring and local backend
│   ├── authoring.ts
│   ├── compile.ts
│   ├── parse.ts
│   ├── normalize.ts
│   ├── validate.ts
│   ├── decimal.ts
│   ├── evaluate.ts
│   └── canonicalize.ts
├── src/local/sqlite-command-executor.ts
└── test/
    ├── unit/policy/
    ├── conformance/
    ├── package/
    └── performance/

packages/postgresql/
├── migrations/0004-policy.sql       # new immutable migration
├── scripts/generate.ts
├── src/installer/
└── test/
    ├── unit/
    ├── integration/
    ├── package/
    └── system/

apps/cloud/
├── src/service.ts
└── test/
```

**Structure Decision**: Keep the authoritative semantic registry, neutral
versions, generated backend metadata, and canonical vectors in contracts; keep
Policy authoring and the local backend in the SDK; and keep the durable backend
and transaction in PostgreSQL. Cloud receives only explicit Policy-field
rejection. No new workspace or stateful Policy service is needed.

## Delivery Sequence

1. **Contract and failing fixtures**: Extend neutral command/result schemas,
   profile manifest, canonical examples, Policy errors, evidence, compile-only
   factory and handle fixtures, and at least 50 Kysely/raw/local/PostgreSQL
   comparison fixtures. Record expected failures before production changes.
2. **Authoring convergence**: Add pinned dependencies, create the cold typed
   Kysely database, compile Kysely and raw inputs, parse both with the PG18
   WASM adapter, and prove identical candidate trees for equivalent source.
3. **Program semantics**: Make the profile manifest the semantic source for
   type/null inference, decimal boundaries, work costs, canonical program/SQL,
   digests, and vectors. Generate exhaustive TypeScript and PostgreSQL backend
   registries. Generation must fail when a node lacks either backend declaration;
   the differential corpus must fail when their results differ.
4. **Local authority**: Store immutable sets inline, integrate context and
   evaluation after replay inside `BEGIN IMMEDIATE`, merge ceilings, record
   denials/evidence, and prove rollback, child non-inheritance, and unchanged
   no-Policy bytes.
5. **PostgreSQL authority**: Append `0004-policy.sql`; add generated-profile
   program validation, fixed rendering, parameterized evaluation, canonical locks,
   result checks, evidence, replay, rollback, role/security attacks, installer
   verification, and caller-owned transaction coverage.
6. **Boundary and artifact qualification**: Reject Policy fields in private
   Cloud before database access. Build and test extracted SDK/PostgreSQL
   archives, including WASM asset loading and the real executable/import paths.
   Run the six-host SDK matrix and retain exact revision/artifact measurements.
7. **Evidence and docs**: Run provider-free gates, authorized native/package/
   hosted lanes, update the quickstart and acceptance record, and preserve every
   unsupported or unexecuted lane as `NOT RUN`.

## Verification Plan

- Provider-free: `CI=true pnpm check:repo`, `CI=true pnpm test:unit`, and
  `CI=true pnpm test:pr`.
- Focused source: SDK Policy unit/conformance suites, contracts generation and
  canonical fixtures, compile-only API fixtures, PostgreSQL unit/integration
  suites, and Cloud unit tests. API fixtures cover exact Resource names, exact
  governed Context, child Policy inference, forbidden public construction,
  destructured method calls, `AsyncDisposable`, and hidden wire identifiers.
- Package: `pnpm test:package:sdk`, `pnpm measure:package:sdk`, and
  `pnpm test:package:postgresql`, using extracted archives and verifying the
  parser WASM is included and loaded without workspace fallbacks.
- Native: `pnpm test:system:postgresql` against a clean PostgreSQL 18.6 database
  and `pnpm test:system:cloud` for Policy rejection plus no-Policy regression.
- Hosted: one exact SDK archive on Node.js 24 and 26 across Linux x64, macOS
  arm64, and Windows x64. Record archive/install size, ready RSS, initialization,
  first/steady request, shutdown, and parser initialization separately.
- Security: rejected multi-statements, DDL/DML, catalog/application/
  private relation access, unsafe Kysely raw identifiers, unsupported functions,
  parameter-shape attacks, parser-node corpus gaps, malformed programs, comment
  identity invariance, role bypass attempts, and proof that submitted SQL bytes
  never reach `EXECUTE`.
- Semantic conformance: generated node-level vectors for every accepted node,
  operator, function, null edge, decimal boundary, work cost, and failure;
  property-generated programs evaluated through both backends; and mutation
  checks proving that an omitted backend handler or divergent rule fails.
- Transaction/replay: evaluator failure before every mutation, generated-query
  failure, denial commit, reservation/child/evidence rollback, exact replay with
  zero parser/evaluator calls, conflict reuse, and concurrent declared-input
  lock ordering.

Planning does not execute or qualify runtime behavior. Until implementation and
exact-revision records exist, local/PostgreSQL Policy parity, parser packaging,
numeric parity, native security, package/host compatibility, performance, and
all remote or production claims remain `NOT RUN`.

## Complexity Tracking

No constitutional violations. The three production dependencies remove bespoke
query-builder, SQL-parser, and decimal-semantics implementations. Their package,
WASM initialization, compatibility, and supply-chain costs are explicit
qualification subjects rather than hidden complexity. Deployment-native
execution duplicates a small amount of backend code; the generated semantic
registry, exhaustive declarations, canonical vectors, and differential tests
prevent that code from becoming two semantic authorities.
