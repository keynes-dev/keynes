# Architecture contract: Portable Policy evaluation

## Selected design

Policy is an immutable value attached inline to a Budget. It has no publication, activation, lookup, inheritance, or mutable lifecycle. `Budget` remains the only public stateful governance object.

The durable artifact is a closed `PolicyProgramV1`. Kysely queries and raw source compile to PostgreSQL SQL plus parameters, then converge at the same PostgreSQL 18 parser, validator, and canonicalizer. One machine-readable semantic registry defines the program nodes, typing, null and numeric rules, work costs, canonical forms, backend declarations, and conformance vectors. The v1 local backend interprets the program in TypeScript. The v1 PostgreSQL backend validates it, generates SQL from allowlisted templates, and executes only that generated SQL inside the existing authority transaction. Submitted SQL text is never executed.

This design was selected from two independent candidates and revised after the authoring and evaluator boundaries were challenged. The inline-set candidate remains the base because it adds the least state and public vocabulary. Established libraries replace bespoke infrastructure: Kysely provides the typed database-facing API, `libpg-query` provides the PostgreSQL parser, and decimal.js provides bounded local decimal behavior. Keynes owns one semantic registry, the normalized program, the deployment-native backends, and authority integration. The library ASTs and backend representations are non-authoritative and private.

Policy evaluation occurs inside the transaction that owns the Budget decision. Keynes never accepts an application-supplied Policy result. A shared executable evaluator remains a compatible future architecture if its PostgreSQL deployment can preserve caller-owned transactions and justify its extension, provider, version, security, and operational burden.

## Public type sketch

```ts
type PolicyScalar = string | boolean | number | null;

interface PolicyDatabase<ContextRow> {
  readonly requested_resources: {
    readonly resource: string;
    readonly amount: number;
  };
  readonly available_resources: {
    readonly resource: string;
    readonly amount: number;
  };
  readonly policy_context: ContextRow;
}

interface PolicyQueryRow {
  readonly resource: string;
  readonly ceiling: string | number;
  readonly reason: string;
}

interface PolicyAuthoring<ContextRow> {
  readonly db: Kysely<PolicyDatabase<ContextRow>>;
  readonly sql: Sql;
}

interface PolicyDefinition<Names extends string, Context> {
  readonly kind: "keynes.policy";
  readonly name: string;
  readonly revision: number;
  readonly queryProfileVersion: "keynes-policy-query/v1";
  readonly validatorVersion: "keynes-policy-validator/v1";
  readonly limitsVersion: "keynes-policy-limits/v1";
  readonly policyProfileDigest: string;
  readonly canonicalSql: string;
  readonly sourceDigest: string;
  readonly definitionDigest: string;
  // The versioned program and declarations are readonly serialized fields.
  // Phantom Names and Context retain authoring and Budget inference.
}

interface PolicySet<Names extends string, Context> {
  readonly definitions: readonly PolicyDefinition<Names, Context>[];
  readonly contextSchemaDigest: string;
  readonly setDigest: string;
}

function definePolicy<
  const Inputs extends readonly string[],
  const Outputs extends readonly Inputs[number][],
  const Schema extends PolicyContextSchema,
  const Reasons extends readonly string[],
>(
  definition: PolicyInput<Inputs, Outputs, Schema, Reasons> & {
    readonly query: (
      authoring: PolicyAuthoring<InferPolicyContextRow<Schema>>,
    ) => SelectQueryBuilder<
      PolicyDatabase<InferPolicyContextRow<Schema>>,
      keyof PolicyDatabase<InferPolicyContextRow<Schema>>,
      PolicyQueryRow
    >;
  },
): PolicyDefinition<Inputs[number], InferPolicyContext<Schema>>;

function definePolicySql<
  const Inputs extends readonly string[],
  const Outputs extends readonly Inputs[number][],
  const Schema extends PolicyContextSchema,
  const Reasons extends readonly string[],
>(
  definition: PolicyInput<Inputs, Outputs, Schema, Reasons> & {
    readonly sql: string;
    readonly parameters?: readonly PolicyScalar[];
  },
): PolicyDefinition<Inputs[number], InferPolicyContext<Schema>>;

function policySet<const Names extends string, const Context>(
  ...definitions: readonly PolicyDefinition<Names, Context>[]
): PolicySet<Names, Context>;

class Keynes {
  createBudget<Resources, Context = NoPolicyContext>(
    resources: Resources,
    options?: {
      readonly policies?: PolicySet<Extract<keyof Resources, string>, Context>;
    },
  ): Promise<Budget<Extract<keyof Resources, string>, Context>>;
}

class Budget<Names extends string, Context = NoPolicyContext> {
  request<Resources, ChildContext = NoPolicyContext>(
    resources: ExactResourceAmounts<Names, Resources>,
    ...options: RequestOptions<Context, Names, ChildContext>
  ): Promise<
    BudgetRequestResult<Extract<keyof Resources, Names>, ChildContext>
  >;
}
```

`RequestOptions` requires exact `context` when the parent Budget is governed, rejects context when it is not, and optionally accepts the complete `policies` set for an approved child. Runtime validation remains authoritative. Resource keys use the existing lower-camel-case SDK convention and canonicalize to lowercase snake case in artifacts and SQL.

The typed query uses ordinary Kysely methods over only the three virtual Policy tables and returns exactly `resource`, `ceiling`, and `reason`. Kysely's `sql` template may fill expression-level gaps. Direct raw SQL is a peer authoring path. Neither path can expand runtime authority: compiled SQL and parameters pass through the same parser and closed validator.

## Module ownership

| Owner                        | Responsibility                                                                                                                                                 | Must not own                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/contracts`         | Authoritative semantic registry; program/profile versions; generated node, backend, work-limit, and vector metadata; wire schema; canonical fixtures           | Runtime transactions or database access           |
| `packages/sdk/src/policy`    | Kysely compilation, PG18 parser adapter, closed validation, normalization, canonical SQL, digests, context validation, and the generated-profile local backend | Budget commit, PostgreSQL access, Cloud routing   |
| `packages/sdk/src/keynes.ts` | Public overloads, type inference, ergonomic Resource key mapping                                                                                               | Policy semantics or storage                       |
| `SqliteCommandExecutor`      | Local replay, snapshot, Policy call, reservation, result/history, commit/rollback                                                                              | General Policy SQL execution                      |
| `packages/postgresql`        | Generated-profile durable backend, snapshot locks, renderer, generated-SQL evaluation, evidence, installation/recheck                                          | Application-table reads or transaction lifecycle  |
| `apps/cloud`                 | Authentication, transport, transaction ownership for existing no-Policy calls, Policy-field rejection                                                          | Policy parsing, evaluation, evidence, or fallback |

No production source imports another Keynes workspace. The contracts build generates backend metadata and canonical vectors for publication into their owning packages. Tests may consume conformance fixtures through existing dev-only edges.

## Local flow

```text
Budget.request
  -> generated command validation
  -> SqliteCommandExecutor BEGIN IMMEDIATE
  -> authorization and canonical command binding
  -> exact replay return
  -> parent and Resource snapshot
  -> context and child Policy-set validation
  -> pure TypeScript Policy evaluation
  -> result validation and ceiling merge
  -> denial evidence OR exact reservation plus child
  -> history and stored command result
  -> COMMIT
```

The interpreter receives detached requested, availability, and context values. It has no database handle. Its failure aborts the transaction. Local async calls remain serialized through the existing runtime tail.

## PostgreSQL flow

```text
caller-owned transaction
  -> keynes.request(jsonb)
  -> keynes_internal.apply_command
  -> authorization and canonical command binding
  -> exact replay return
  -> canonical parent/holding locks and input snapshot
  -> structural Policy/context validation
  -> renderer emits SQL from PolicyProgramV1
  -> EXECUTE generated SQL USING three JSON inputs
  -> result validation and ceiling merge
  -> denial evidence OR exact reservation plus child
  -> history and stored command result
  -> caller commits or rolls back
```

The public wrapper remains `SECURITY DEFINER`, has a fixed trusted `search_path` ending in `pg_temp`, and retains revoked `PUBLIC` execution. The application role cannot call `keynes_internal` or read its relations. Every emitted relation, operator, function signature, cast, collation, and result column is fixed by the profile manifest. Policy values are parameters or safely quoted literals, never identifiers.

## Snapshot and locks

A Policy may read availability only for its declared input Resources. PostgreSQL locks the union of requested holdings and all active Policy input holdings in canonical Resource UUID order before constructing any Policy input. Every active Policy then receives one immutable snapshot. Local mode observes the same logical snapshot under its serialized write transaction.

Policy evaluation occurs after exact replay and before any reservation or child insertion. One Policy cannot observe another Policy's intermediate result. A Policy failure aborts the complete request.

## Compatibility and migrations

No-Policy calls omit every new field in canonical commands, results, and history. The five public procedure names and permission names do not change. Empty Policy-set input normalizes to omission.

The first three PostgreSQL migrations remain immutable. `0004-policy.sql` adds inline Policy storage, Policy helpers, affected function replacements, the current contract binding, and secure definer settings. The generator stops rewriting historical `0003`. Fresh installation applies the complete graph; a predecessor graph is incompatible and unchanged. This is not an upgrade path.

## Acceptance seams

- Generation fails when any accepted program node lacks a TypeScript handler declaration, PostgreSQL validation/rendering declaration, work cost, or canonical vector.
- The canonical node vectors and property-generated valid programs run through both backends, and every status, value, null, error, and work-limit result must match.
- One fixture has Kysely and raw SQL produce identical program, canonical SQL, and digests.
- One fixture uses Kysely's `sql` template for multiplication and rounding, then proves the same accepted program as direct raw SQL.
- One rejection corpus covers every unhandled PostgreSQL parser-node kind and unsafe Kysely raw-identifier path.
- One local replay test injects an evaluator spy and observes zero calls.
- One PostgreSQL malicious-artifact test proves submitted SQL bytes never reach `EXECUTE`.
- One contention test reads an unrequested but declared availability Resource and proves canonical lock ordering.
- One rollback matrix injects failure before and after evaluation, evidence, reservation, child insertion, result storage, and history.
- One Cloud test submits each prohibited Policy field and observes rejection before a database call.
- The unchanged no-Policy corpus compares old command, result, history, and replay JSON.
- Acceptance records bind the exact semantic-profile digest and both backend artifact digests so a pass cannot qualify changed semantics or changed executable code.
