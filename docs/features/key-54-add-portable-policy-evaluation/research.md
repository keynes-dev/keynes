# Research: Add portable Policy evaluation

## Closed Policy program

**Decision**: Kysely-compiled and raw-SQL source pass through the same PostgreSQL 18 parser into one versioned, JSON-serializable `PolicyProgramV1`. The program is durable semantics. Canonical SQL is stored as evidence, but submitted SQL text is never executable input.

**Rationale**: Policy evaluation must occur inside the selected Budget authority's atomic command. A closed program gives every execution backend one bounded language without making a parser library AST or backend representation public. PostgreSQL can reject unknown nodes and emit only fixed, allowlisted templates, while another backend can evaluate the same program without trusting application-computed ceilings.

**Alternatives considered**:

- Execute validated source text in PostgreSQL: rejected because `SECURITY DEFINER`, catalog visibility, built-ins, role privileges, and name resolution leave ambient capability that an allowlist should remove.
- Evaluate in TypeScript and pass ceilings to PostgreSQL: rejected because application or service output would authorize a durable reservation outside the caller-owned database transaction.

## One semantic definition with deployment-native execution

**Decision**: Define `PolicyProgramV1` semantics once in the machine-readable `packages/contracts/policy-profile.json`. Generate the mechanically expressible node types, guards, exhaustive backend declarations, PostgreSQL rendering identities, work costs, and canonical vectors from that registry. For v1, use a TypeScript interpreter inside the local SQLite transaction and a PostgreSQL validator/generated-SQL backend inside `keynes_internal.apply_command`.

**Rationale**: This preserves the two product properties that matter: local mode stays private and daemon-free, and embedded PostgreSQL remains authoritative inside a caller-owned transaction. The backends are not separate semantic specifications. A new or changed node cannot ship unless generation finds declarations for both backends and both produce the same result across the canonical and property-generated corpus.

**Alternatives considered**:

- Run one TypeScript evaluator outside both databases: rejected because PostgreSQL would have to trust caller-supplied ceilings or the embedded SQL path would stop being directly composable inside the application's transaction.
- Run PostgreSQL in both deployments: rejected for v1 because it restores the local database runtime and footprint that KEY-50 removed. The accepted PGlite preview measured 771,928,064 bytes ready RSS, while the corrected SQLite preview measured 56,217,600 bytes under the same hosted evidence model.
- Compile one native or WebAssembly evaluator for Node.js and PostgreSQL: deferred, not rejected. It preserves transaction-local authority, but the PostgreSQL target requires an extension binary, provider allowlisting, server ABI and version packaging, upgrades, and a separate security and compatibility matrix. Reconsider it if parity drift or the sustained cost of two backends outweighs that operational burden, or if the product deliberately requires a Keynes-controlled service or custom extension.
- Handwrite two allowlists and semantics tables: rejected because differential tests can detect output drift but cannot make duplicated definitions disappear. The semantic registry and generated exhaustive declarations remove that avoidable source of drift.

## Kysely authoring and raw escape hatches

**Decision**: Pin `kysely@0.29.5` as the normal typed authoring dependency. Supply a cold PostgreSQL-dialect Kysely instance typed with only the three virtual Policy inputs. Accept the resulting `SelectQueryBuilder` and compile it without a connection. Also expose `definePolicySql` for a direct SQL string and parameters. Kysely's `sql` template remains available inside the typed path for expression-level escape hatches.

**Rationale**: Kysely carries Resource, context, and result types through the SDK and remains useful if Keynes later exposes adopter tables or views as typed inputs. Its raw SQL recipe deliberately supports dropping down to SQL wherever the query API is insufficient. That is the right abstraction boundary for a database-first SDK. Normal substitutions are parameters, while `sql.raw`, dynamic identifiers, and direct raw source remain untrusted and must pass the same Keynes validator.

**Alternatives considered**:

- Maintain a Keynes-specific typed builder: rejected because it duplicates established query-builder ergonomics, narrows expression support, and cannot participate naturally in a future typed adopter schema.
- Expose only raw SQL: rejected because it gives up compile-time relation, column, context, and output-shape assistance for the common path.
- Treat Kysely's operation-node tree as the program: rejected because it is a library-internal compilation representation, raw fragments remain opaque within it, and it would make Kysely internals a durable cross-runtime contract.

Relevant Kysely references: [raw SQL recipe](https://kysely.dev/docs/recipes/raw-sql) and [`sql` API](https://kysely-org.github.io/kysely-apidoc/interfaces/Sql.html).

## Functional public API with capability handles

**Decision**: Replace public `Keynes` and `Budget` classes with readonly branded
interfaces returned by factories. `defineResources` creates a frozen Resource
schema. `createKeynes({ resources })` returns a ready local handle, and approved
requests return frozen Budget handles. Each method is a closure over private
runtime state and, for a Budget, its private ID. Keep method calls rather than
exposing a flat API. Support both `AsyncDisposable` and explicit `close()`.

**Rationale**: The handles need hidden identity and lifecycle, not constructor
or prototype semantics. Closures provide the actual authority because callers
cannot create methods that reach the private runtime or Budget ID. Unexported
`unique symbol` brands prevent accidental structural substitution in
TypeScript. Arrow-function methods do not depend on `this`. Schema-first
creation gives Resource definitions, Policies, and Budgets one exact
Resource-name union.

**Alternatives considered**:

- Keep final capability classes: rejected because private asynchronous creation
  still needs factories, `instanceof` has no product use, and public classes add
  receiver binding and prototype identity without strengthening authority.
- Expose flat functions with runtime and Budget tokens: rejected because every
  call would expose identity plumbing and allow callers to mix unrelated
  capabilities.
- Preserve `Keynes.create()` and post-open `defineResources()`: rejected because
  compatibility has no value before release, and mutable setup produces a
  half-configured session whose Resource type cannot safely widen in place.
- Replace Error subclasses: rejected because errors participate in the built-in
  JavaScript `Error` protocol and benefit from class identity.

## Pinned PostgreSQL parser

**Decision**: Pin `libpg-query@18.1.4`, the PostgreSQL 18 WASM build, and parse the compiled output of both authoring paths. Adapt recognized parser nodes into a Keynes candidate model, then run an independent closed validator and normalizer. Reject every parser node, field, operator, function, or statement shape that the profile does not enumerate.

**Rationale**: Kysely's `sql` tag constructs a `RawBuilder`; it does not parse arbitrary text into a semantic PostgreSQL AST. Kysely has internal helpers named parsers, but they translate query-builder values and references into operation nodes. `sql.raw()` calls `RawNode.createWithSql` and includes arbitrary text unchanged. A real PostgreSQL parser therefore remains necessary to recognize the language accurately before Keynes applies its much narrower authority allowlist. `libpg-query` uses PostgreSQL's parser compiled to WASM, avoids native builds, and can be pinned to the same PostgreSQL major release as the durable runtime. The SDK package and six-host matrix must qualify the WASM asset and initialization cost.

**Alternatives considered**:

- Write a lexer and Pratt parser: rejected because dependency freedom is not a product rule and a bespoke SQL parser would reproduce subtle PostgreSQL syntax work without providing more user value.
- Pin `pgsql-ast-parser`: rejected because it reimplements PostgreSQL syntax instead of using the parser for the supported database major.
- Parse Kysely queries through operation nodes and only raw SQL through PostgreSQL: rejected because two syntax pipelines could accept, type, normalize, or digest equivalent rules differently.
- Accept everything the PostgreSQL parser accepts: rejected because parsing establishes syntax, not safety, determinism, input authority, bounded work, or portable local semantics.

Relevant parser reference: [`libpg-query` PostgreSQL 18 WASM parser](https://github.com/launchql/libpg-query-node).

## Dependency and package impact

**Decision**: Add exactly three pinned SDK production dependencies: `kysely@0.29.5`, `libpg-query@18.1.4`, and `decimal.js@10.6.0`. Retain their licenses and exact resolved graph in the package evidence. Treat the parser WASM as a required SDK runtime asset, not a development-only file.

**Rationale**: All three packages are MIT-licensed. Kysely and decimal.js have no runtime transitive dependencies; the selected `libpg-query` release uses `@pgsql/types` and ships a WASM parser without `node-gyp`. npm metadata observed during planning reports approximately 1.73 MB, 1.83 MB, and 0.28 MB unpacked respectively. Those figures are dependency metadata, not Keynes package measurements. The existing archive/install-size, RSS, startup, request, and six-host qualification lanes must measure the real packed subject.

**Alternatives considered**:

- Vendor library source or WASM: rejected because it obscures provenance and updates without reducing the code Keynes must qualify.
- Make the parser optional or fetch it on demand: rejected because offline local Policy definition must be deterministic and package-complete.
- Keep package size as an undocumented tradeoff: rejected because the existing SDK qualification already treats archive size, install size, RSS, and startup as explicit evidence.

## Inline immutable Policy sets

**Decision**: Store one complete canonical Policy set inline with each Budget. Do not add Policy publication, activation, registry, lookup, or membership state.

**Rationale**: Policies are immutable, local to one Budget, and never inherited. An inline bounded value directly represents that contract. A registry and join table would introduce cross-Budget identity and lifecycle behavior that the feature does not expose. Command/history evidence remains separate because it records one decision rather than a definition.

**Alternatives considered**:

- Tenant-scoped Policy definitions plus Budget membership: rejected because deduplication does not justify a second lifecycle in this preview.
- Mutable active revisions: rejected because exact replay and Budget-local immutability require the attached definition, not a later lookup.
- New publish/activate procedures: rejected because the feature must add no public database or remote operation.

## One exact context schema per set

**Decision**: Every Policy in a Policy set must declare the same exact context schema. A governed request supplies exactly that one record. Context is forbidden for an ungoverned parent.

**Rationale**: The specification provides one immutable context object to every active Policy. A shared schema makes missing and extra fields unambiguous, gives the SDK one inferred request type, and prevents one Policy from treating another Policy's fields as accidental input. The canonical record is included in command identity and evidence but never in child Budget state.

**Alternatives considered**:

- Merge per-Policy schemas: rejected because optionality and extra-field handling become Policy-order dependent.
- Pass one context object per Policy: rejected because it changes the product contract and complicates evidence.
- Allow context with no Policies: rejected because Keynes should not retain arbitrary application data that cannot affect a decision.

## Expressive numeric profile and deterministic limits

**Decision**: Accept one fixed `SELECT` over `requested_resources`, `available_resources`, and one-row `policy_context`; allow the published joins, filters, `CASE`, grouping, ordering, decimal arithmetic, deterministic numeric functions, comparison, boolean, and aggregate operations. Pin `decimal.js@10.6.0` for local `numeric(38,18)` behavior and fix structural and work limits in `keynes-policy-limits/v1` before implementation.

**Rationale**: An allowlist is easier to reproduce and audit than general SQL, but it does not need to be artificially weak. The v1 numeric profile includes `+`, `-`, `*`, `/`, `%`, unary signs, `abs`, `ceil`, `floor`, `round`, `trunc`, `sqrt`, bounded integral `power`, `sum`, `avg`, `min`, `max`, and `count`. Explicit decimal precision, scale, rounding, invalid-domain rules, and casts let TypeScript and PostgreSQL agree. PostgreSQL notes that many double-precision functions depend on the host C library, so v1 excludes double-precision, trigonometric, logarithmic, and exponential functions rather than pretending they have exact portable behavior. Structural and cardinality limits produce the same accept/error decision on every host. Wall-clock limits remain defense in depth only.

**Alternatives considered**:

- General read-only `SELECT`: rejected because read-only SQL can still inspect metadata or invoke nondeterministic and expensive behavior.
- Denylisted functions and relations: rejected because new database features could silently expand capability.
- Safe-integer addition and subtraction only: rejected because it needlessly weakens SQL authoring and would push ordinary calculations back into application code.
- JavaScript `number` for local evaluation: rejected because binary floating-point and PostgreSQL exact numeric behavior would produce avoidable parity gaps.
- Wall-clock execution as the portable limit: rejected because local and PostgreSQL outcomes could diverge under load.

Relevant PostgreSQL reference: [mathematical functions and operators](https://www.postgresql.org/docs/18/functions-math.html).

## Local TypeScript evaluation

**Decision**: Use a TypeScript `PolicyProgramV1` backend inside the existing SQLite `BEGIN IMMEDIATE` transaction. SQLite remains private storage; it does not execute Policy SQL.

**Rationale**: The supported Node.js range does not expose one uniform `node:sqlite` authorizer, defensive-mode, limit, progress-handler, or interrupt surface. Node.js 24.0 lacks later authorizer and defensive additions, while Node.js 24 and 26 expose no progress or interrupt API. Raw SQLite execution therefore cannot prove the required access and work bounds. A pure interpreter can implement explicit SQL null truth tables, bounded decimal arithmetic, grouping, and deterministic work accounting before mutation.

**Alternatives considered**:

- Execute Policy SQL on the private connection: rejected because `allowExtension: false` is useful but insufficient for query authorization and execution bounds.
- Open another SQLite connection for Policy: rejected because it introduces another snapshot and does not solve sandboxing.
- Evaluate before beginning the request transaction: rejected because availability and Policy evidence must share the reservation snapshot.

Relevant platform references: [Node.js 24.0 `node:sqlite`](https://nodejs.org/download/release/v24.0.0/docs/api/sqlite.html), [current Node.js 24 `node:sqlite`](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), and [SQLite security guidance](https://sqlite.org/security.html).

## PostgreSQL generated-SQL evaluation

**Decision**: Use a PostgreSQL backend that validates the closed program against generated profile metadata, regenerates canonical SQL from fixed templates, verifies source and definition digests, and executes only the generated SQL over parameterized request, availability, and context values inside `keynes_internal.apply_command`.

**Rationale**: PostgreSQL remains the sole durable authority and preserves caller-owned atomic composition. ACLs or a fixed `search_path` alone do not sandbox arbitrary source. The renderer can fully control relations, aliases, functions, operators, casts, collation, parameters, output, and row bounds. Definer functions use trusted schemas with `pg_temp` last, following PostgreSQL guidance, and the installer verifies exact bodies, settings, privileges, and allowlisted immutable built-ins.

**Alternatives considered**:

- Execute submitted text as the definer owner: rejected because it could reach private authority and ambient built-ins.
- Execute as the adopter's application role: rejected because that role may legitimately access application tables.
- Add a dedicated evaluator role and stored function per Policy: rejected because role preparation, DDL lifecycle, dependencies, cleanup, and recheck complexity are unnecessary when the closed program can generate bounded SQL.

Relevant PostgreSQL references: [`CREATE FUNCTION` security guidance](https://www.postgresql.org/docs/18/sql-createfunction.html), [`pg_proc`](https://www.postgresql.org/docs/18/catalog-pg-proc.html), [function volatility](https://www.postgresql.org/docs/18/xfunc-volatility.html), and [`pg_operator`](https://www.postgresql.org/docs/18/catalog-pg-operator.html).

## Replay, denial, and failure order

**Decision**: Validate the command envelope, authorize, bind canonical command input, and return an exact stored replay before semantic Policy/context validation or evaluation. For a new command, Policy errors roll back; Policy ceilings produce committed denials.

**Rationale**: Replay must not observe newer context facts, evaluator versions, availability, or Policy definitions. Context and child Policy sets therefore participate in the canonical body digest. A Policy failure is not a domain decision, so the existing transactional error boundary must remove the command binding, history, holdings, and child. A valid ceiling denial remains inspectable evidence and changes no holding.

**Alternatives considered**:

- Revalidate or reevaluate before replay: rejected because a command could fail under a newer validator instead of returning its original result.
- Store Policy errors as denial history: rejected because it would turn evaluator failure into a governance decision.
- Retry Policy failures automatically: rejected because only the established committed-response-loss case is transparently retried.

## Migration history

**Decision**: Preserve `0001-storage.sql`, `0002-budget.sql`, and `0003-public.generated.sql` byte-for-byte. Append `0004-policy.sql`, bind the current contract digest to it, and make the generator treat `0003` as an immutable historical asset.

**Rationale**: Rewriting the accepted migration bytes provides no upgrade support and erases a useful provenance boundary. The current installer already distinguishes a clean database from an exact target and rejects every other target. Fresh KEY-54 installation can apply all four migrations, while a three-migration installation remains incompatible and unchanged.

**Alternatives considered**:

- Rewrite the private preview graph: rejected because it increases review and provenance risk without changing compatibility.
- Upgrade an existing three-migration installation: rejected because upgrade, resume, repair, and rolling deployment are outside this feature.
- Add a second public procedure namespace: rejected because the five JSONB functions retain their operation meaning for no-Policy callers.

## Cloud exclusion

**Decision**: Keep the same five private Cloud operation names but reject `policies`, `childPolicies`, or `context` on `createBudget` and `requestBudget` before invoking PostgreSQL.

**Rationale**: Expanding the neutral PostgreSQL command schema would otherwise let the current `/rpc` path accept remote Policy submission accidentally. Cloud may enforce its transport capability boundary, but it must not parse, evaluate, store, or reinterpret Policy. Existing no-Policy Cloud behavior remains a blast-radius lane.

**Alternatives considered**:

- Let PostgreSQL accept Policy over private Cloud because the procedure can: rejected because transport availability is a separate product surface.
- Fork the procedure contract for Cloud: rejected because generated operation identity and Budget semantics should remain shared.
- Evaluate in Cloud: rejected because it would duplicate authority.

## Architecture comparison

Two independent designs were compared against authority/security, public API size, portable semantics, repository fit, and evidence coverage. The selected base keeps complete Policy sets inline on Budgets and adds no stateful Policy lifecycle. It grafts the competing design's immutable migration history and makes one generated profile manifest the semantic source for both backends. The final dependency decision favors established libraries: Kysely for typed authoring, the PostgreSQL 18 parser for syntax, and decimal.js for exact local numeric work. Keynes owns the product-specific validator, normalized program, semantic registry, deployment-native backends, and authority integration. A shared executable core remains an explicit future option rather than a constitutional exception.
