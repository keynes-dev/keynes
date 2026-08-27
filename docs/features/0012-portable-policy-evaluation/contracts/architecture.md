# Architecture contract: Portable Policy evaluation

## Selected design

Policy is an immutable value attached inline to a Budget. It has no publication, activation, lookup, inheritance, or mutable lifecycle. A `Budget` is a readonly capability handle bound to private runtime state and one private Budget identity. It contains no cached accounting state.

The durable artifact is a closed `PolicyProgramV1`. Kysely queries and raw source compile to PostgreSQL SQL plus parameters, then converge at the same PostgreSQL 18 parser, validator, and canonicalizer. One machine-readable semantic registry defines the program nodes, typing, null and numeric rules, work costs, canonical forms, backend declarations, and conformance vectors. The v1 local backend interprets the program in TypeScript. The v1 PostgreSQL backend validates it, generates SQL from allowlisted templates, and executes only that generated SQL inside the existing authority transaction. Submitted SQL text is never executed.

This design was selected from two independent candidates and revised after the authoring and evaluator boundaries were challenged. The inline-set candidate remains the base because it adds the least state and public vocabulary. Established libraries replace bespoke infrastructure: Kysely provides the typed database-facing API, `libpg-query` provides the PostgreSQL parser, and decimal.js provides bounded local decimal behavior. Keynes owns one semantic registry, the normalized program, the deployment-native backends, and authority integration. The library ASTs and backend representations are non-authoritative and private.

Policy evaluation occurs inside the transaction that owns the Budget decision. Keynes never accepts an application-supplied Policy result. A shared executable evaluator remains a compatible future architecture if its PostgreSQL deployment can preserve caller-owned transactions and justify its extension, provider, version, security, and operational burden.

## Public type sketch

```ts
type PolicyScalar = string | boolean | number | null;

declare const keynesBrand: unique symbol;
declare const budgetBrand: unique symbol;
declare const policyDefinitionBrand: unique symbol;

interface ResourceDefinition {
  readonly unit: string;
  readonly accountingBehavior: "consumable" | "reusable";
}

type ResourceDefinitions = Readonly<Record<string, ResourceDefinition>>;

interface ResourceSchema<Definitions extends ResourceDefinitions> {
  readonly definitions: Definitions;
  readonly digest: string;
}

function defineResources<const Definitions extends ResourceDefinitions>(
  definitions: Definitions,
): ResourceSchema<Definitions>;

type ResourceName<Schema extends ResourceSchema<ResourceDefinitions>> = Extract<
  keyof Schema["definitions"],
  string
>;

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

interface PolicyDefinition<
  Names extends string,
  Context,
  Reasons extends string,
> {
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
  readonly [policyDefinitionBrand]: {
    readonly names: Names;
    readonly context: Context;
    readonly reasons: Reasons;
  };
  // The versioned program and declarations are readonly serialized fields.
}

interface PolicySet<Names extends string, Context, Reasons extends string> {
  readonly definitions: readonly PolicyDefinition<Names, Context, Reasons>[];
  readonly contextSchemaDigest: string;
  readonly setDigest: string;
}

type AnyPolicyDefinition = PolicyDefinition<string, unknown, string>;
type AnyPolicySet = PolicySet<string, unknown, string>;

function definePolicy<
  const Resources extends ResourceSchema<ResourceDefinitions>,
  const Inputs extends readonly ResourceName<Resources>[],
  const Outputs extends readonly Inputs[number][],
  const Schema extends PolicyContextSchema,
  const Reasons extends readonly string[],
>(
  resources: Resources,
  definition: PolicyInput<Inputs, Outputs, Schema, Reasons> & {
    readonly query: (
      authoring: PolicyAuthoring<InferPolicyContextRow<Schema>>,
    ) => SelectQueryBuilder<
      PolicyDatabase<InferPolicyContextRow<Schema>>,
      keyof PolicyDatabase<InferPolicyContextRow<Schema>>,
      PolicyQueryRow
    >;
  },
): PolicyDefinition<
  Inputs[number],
  InferPolicyContext<Schema>,
  Reasons[number]
>;

function definePolicySql<
  const Resources extends ResourceSchema<ResourceDefinitions>,
  const Inputs extends readonly ResourceName<Resources>[],
  const Outputs extends readonly Inputs[number][],
  const Schema extends PolicyContextSchema,
  const Reasons extends readonly string[],
>(
  resources: Resources,
  definition: PolicyInput<Inputs, Outputs, Schema, Reasons> & {
    readonly sql: string;
    readonly parameters?: readonly PolicyScalar[];
  },
): PolicyDefinition<
  Inputs[number],
  InferPolicyContext<Schema>,
  Reasons[number]
>;

function policySet<const Policies extends readonly AnyPolicyDefinition[]>(
  ...definitions: Policies & RequireOneExactContextSchema<Policies>
): PolicySet<
  PolicyNames<Policies[number]>,
  PolicyContext<Policies[number]>,
  PolicyReasons<Policies[number]>
>;

interface Keynes<Names extends string> extends AsyncDisposable {
  readonly [keynesBrand]: void;
  createBudget<
    const Resources extends ResourceAmounts<Names>,
    const Policies extends AnyPolicySet | undefined = undefined,
  >(
    resources: ExactResourceAmounts<Names, Resources>,
    ...options: AttachPolicyArguments<Extract<keyof Resources, Names>, Policies>
  ): Promise<
    Budget<
      Extract<keyof Resources, Names>,
      ContextOfPolicySet<Policies>,
      ReasonsOfPolicySet<Policies>
    >
  >;
  close(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
}

interface Budget<
  Names extends string,
  Context = NoPolicyContext,
  Reasons extends string = never,
> {
  readonly [budgetBrand]: void;
  request<
    const Resources extends ResourceAmounts<Names>,
    const ChildPolicies extends AnyPolicySet | undefined = undefined,
  >(
    resources: ExactResourceAmounts<Names, Resources>,
    ...options: RequestOptions<
      Context,
      Extract<keyof Resources, Names>,
      ChildPolicies
    >
  ): Promise<
    BudgetRequestResult<
      Extract<keyof Resources, Names>,
      Reasons,
      ContextOfPolicySet<ChildPolicies>,
      ReasonsOfPolicySet<ChildPolicies>
    >
  >;
  settle(usage: ExactResourceUsage<Names>): Promise<Settlement<Names>>;
  inspect(): Promise<BudgetSnapshot<Names>>;
}

function createKeynes<
  const Schema extends ResourceSchema<ResourceDefinitions>,
>(options: {
  readonly resources: Schema;
}): Promise<Keynes<Extract<keyof Schema["definitions"], string>>>;
```

`defineResources` fixes the Resource vocabulary before the runtime opens.
`RequestOptions` requires exact `context` when the parent Budget is governed,
rejects context when it is not, and optionally accepts the complete `policies`
set for an approved child. Runtime validation remains authoritative. Resource
keys use the existing lower-camel-case SDK convention and canonicalize to
lowercase snake case in artifacts and SQL.

The module implements `Keynes` and `Budget` as frozen method-bearing objects.
Arrow-function methods close over the local runtime state and the private Budget
ID, so they remain valid when destructured and cannot be applied to a forged
receiver. The unexported handle brands provide nominal TypeScript identity. No
public constructor, prototype, database handle, Resource ID, Budget ID, or
command ID exists. Embedded PostgreSQL remains separate because the application
owns its transaction.

The typed query uses ordinary Kysely methods over only the three virtual Policy tables and returns exactly `resource`, `ceiling`, and `reason`. Kysely's `sql` template may fill expression-level gaps. Direct raw SQL is a peer authoring path. Neither path can expand runtime authority: compiled SQL and parameters pass through the same parser and closed validator.

## Module ownership

| Owner                               | Responsibility                                                                                                                                                 | Must not own                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/contracts`                | Authoritative semantic registry; program/profile versions; generated node, backend, work-limit, and vector metadata; wire schema; canonical fixtures           | Runtime transactions or database access           |
| `packages/sdk/src/policy`           | Kysely compilation, PG18 parser adapter, closed validation, normalization, canonical SQL, digests, context validation, and the generated-profile local backend | Budget commit, PostgreSQL access, Cloud routing   |
| `packages/sdk/src/resources.ts`     | Frozen Resource schema, canonical Resource key mapping, and Resource-name inference                                                                            | Runtime state or Budget identity                  |
| `packages/sdk/src/keynes.ts`        | `createKeynes`, public `Keynes` interface, and local runtime capability factory                                                                                | Policy semantics or storage                       |
| `packages/sdk/src/budget.ts`        | Public `Budget` interface, private handle factory, and result projection                                                                                       | Transport or committed Budget state               |
| `packages/sdk/src/local/runtime.ts` | Process-local SQLite ownership, serialized calls, lifecycle, and executor dispatch                                                                             | Policy semantics or durable storage               |
| `SqliteCommandExecutor`             | Local replay, snapshot, Policy call, reservation, result/history, commit/rollback                                                                              | General Policy SQL execution                      |
| `packages/postgresql`               | Generated-profile durable backend, snapshot locks, renderer, generated-SQL evaluation, evidence, installation/recheck                                          | Application-table reads or transaction lifecycle  |
| `apps/cloud`                        | Authentication, transport, transaction ownership for existing no-Policy calls, Policy-field rejection                                                          | Policy parsing, evaluation, evidence, or fallback |

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

## Pre-release API change and migrations

FEAT-0012 intentionally replaces `Keynes.create()` followed by
`keynes.defineResources(...)` with `defineResources(...)` followed by
`createKeynes({ resources })`. `Keynes` and `Budget` remain exported as types,
but they stop being public runtime class values. The SDK ships no deprecated
class alias or compatibility overload. No-Policy Budget semantics and wire
bytes remain unchanged after the runtime opens.

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
- Compile-only fixtures prove exact Resource and Context inference, forbidden
  public construction, destructuring-safe methods, and `AsyncDisposable`.
- The unchanged no-Policy corpus compares old command, result, history, and replay JSON.
- Acceptance records bind the exact semantic-profile digest and both backend artifact digests so a pass cannot qualify changed semantics or changed executable code.
