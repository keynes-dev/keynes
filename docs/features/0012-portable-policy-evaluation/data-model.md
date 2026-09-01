# Data model: Portable Policy evaluation

## Resource schema

A frozen SDK value created before a local runtime opens. It carries the exact
Resource-name union through Policy authoring, root Budget creation, requests,
settlement, and inspection.

| Field         | Type                 | Rules                                                          |
| ------------- | -------------------- | -------------------------------------------------------------- |
| `definitions` | Resource definitions | Exact lower-camel-case names with unit and accounting behavior |
| `digest`      | digest               | Canonical identity for the complete definition set             |

The schema owns no database connection or installed Resource IDs.
`createKeynes({ resources })` installs the complete schema or closes the failed
runtime before returning. A session cannot add Resource definitions after it
opens.

## Runtime capability handles

`Keynes<Names>` and `Budget<Names, Context, Reasons>` are public readonly
interface types, not durable records. The SDK returns frozen method-bearing
objects:

- A Keynes handle closes over one private runtime session and owns admission,
  command identity, retry, and shutdown.
- A Budget handle closes over that runtime and one private Budget ID. It stores
  no allocation, availability, Policy result, usage, history, or lifecycle
  snapshot.

The interfaces use unexported TypeScript brands. The method closures provide
runtime authority. Neither handle serializes identity or exposes a constructor,
executor, database handle, Resource ID, Budget ID, or command ID.

## Policy definition

An immutable value produced by either authoring path and accepted identically by both runtimes.

| Field                 | Type                     | Rules                                                                      |
| --------------------- | ------------------------ | -------------------------------------------------------------------------- |
| `name`                | canonical identifier     | Lowercase ASCII, 1-63 bytes                                                |
| `revision`            | positive safe integer    | Application-selected; evidence, not mutable activation state               |
| `inputResources`      | canonical Resource names | Sorted, unique, 1-64; every name belongs to the attached Budget            |
| `outputResources`     | canonical Resource names | Sorted, unique, non-empty subset of inputs                                 |
| `contextSchema`       | ordered fields           | Exact shared schema; text, boolean, safe integer, and explicit nullability |
| `reasons`             | canonical identifiers    | Sorted, unique, non-empty; every result reason is declared                 |
| `programVersion`      | constant                 | `keynes-policy-program/v1`                                                 |
| `queryProfileVersion` | constant                 | `keynes-policy-query/v1`                                                   |
| `validatorVersion`    | constant                 | `keynes-policy-validator/v1`                                               |
| `limitsVersion`       | constant                 | `keynes-policy-limits/v1`                                                  |
| `policyProfileDigest` | digest                   | Exact machine-readable semantics registry used to normalize the program    |
| `program`             | `PolicyProgramV1`        | Closed JSON program; at most 512 nodes and depth 32                        |
| `canonicalSql`        | string                   | Canonical printer output; at most 16 KiB UTF-8                             |
| `sourceDigest`        | digest                   | Hash of canonical SQL, not original whitespace                             |
| `definitionDigest`    | digest                   | Hash of the complete versioned definition excluding the digest field       |

The original raw SQL, Kysely operation tree, parser AST, and submitted parameter vector are not stored. Parameters normalize into typed literal program nodes. The canonical program and SQL are deeply immutable. A material semantic or declaration change produces a different definition digest.

## Policy set

The complete Policy value attached to one Budget.

| Field                 | Type                       | Rules                                                        |
| --------------------- | -------------------------- | ------------------------------------------------------------ |
| `definitions`         | ordered Policy definitions | 0-16, sorted by name, revision, then definition digest       |
| `contextSchemaDigest` | digest or null             | All non-empty members must have the same exact schema digest |
| `setDigest`           | digest                     | Hash of the canonical ordered definitions                    |

An empty set is canonical `[]` internally and omitted from legacy-compatible wire bodies and Budget output. Duplicate names in one set are invalid. A set is copied into a child only when the creating request explicitly supplies it; parent membership is never inherited.

## Context schema and context

The schema declares at most 32 lower-camel-case authoring keys, each canonicalized to a lowercase snake-case key. Durable artifacts use canonical keys.

| Scalar        | Wire value                                                      | Evaluation value |
| ------------- | --------------------------------------------------------------- | ---------------- |
| `text`        | well-formed JSON string without U+0000, at most 256 UTF-8 bytes | text             |
| `boolean`     | JSON boolean                                                    | SQL boolean      |
| `integer`     | JSON integer from 0 through 9,007,199,254,740,991               | exact decimal    |
| nullable form | the declared scalar or JSON null                                | SQL null         |

A request context must have every declared field and no undeclared field. Its canonical JSON encoding is at most 8,192 UTF-8 bytes. The authority freezes one detached value for evaluation and evidence. It does not add context to the child Budget projection.

## Policy program

`PolicyProgramV1` is a discriminated union defined by the authoritative profile manifest. The same manifest generates exhaustive declarations and canonical vectors for both execution backends. The program contains:

- one fixed select statement;
- fixed requested, availability, and context inputs;
- one allowed availability join and one context cross join;
- typed literals and references, including normalized positional parameters;
- checked unary signs and decimal `+`, `-`, `*`, `/`, and `%`;
- comparisons, `IS NULL`, `IN`, `AND`, `OR`, and `NOT`;
- `CASE`;
- `coalesce`, `least`, and `greatest`;
- `abs`, `ceil`, `floor`, `round`, `trunc`, `sqrt`, and bounded integral `power`;
- `sum`, `avg`, `min`, `max`, and `count`;
- optional filter, grouping, and canonical output ordering; and
- exact `resource`, `ceiling`, and `reason` projections.

Every node carries an inferred scalar type and nullability. Numeric nodes carry the `numeric(38,18)` profile and explicit normalization boundary. Normalization removes spelling differences but preserves expression operand order. Unknown nodes, functions, operators, relations, fields, and versions are invalid.

## Policy input snapshot

One immutable evaluation input constructed after replay handling and holding locks.

| Field       | Contents                                              | Bound                |
| ----------- | ----------------------------------------------------- | -------------------- |
| `requested` | Current requested Resource canonical name and amount  | 1-64 rows            |
| `available` | Parent availability for active Policy input Resources | 1-64 rows per Policy |
| `context`   | One validated canonical context record                | 32 fields and 8 KiB  |

PostgreSQL locks the union of requested holdings and every active Policy input holding in Resource identity order before constructing the snapshot. Local mode receives the same logical values under its serialized `BEGIN IMMEDIATE` transaction.

## Policy result row

| Field      | Type                    | Rules                                               |
| ---------- | ----------------------- | --------------------------------------------------- |
| `resource` | canonical Resource name | Declared output and present in the current request  |
| `ceiling`  | safe integer            | Non-null, integral, 0 through 9,007,199,254,740,991 |
| `reason`   | canonical identifier    | Declared by the Policy                              |

One Policy may return at most one row per Resource and 64 rows total. A missing row adds no constraint. A duplicate, null, negative, fractional, overflowed, undeclared, unrequested, or excess row is a Policy evaluation error.

## Policy decision evidence

Governed approved and denied commands store one evidence value.

| Field               | Contents                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `context`           | Exact canonical context used                                                                         |
| `policies`          | Ordered name, revision, source digest, definition digest, and validated rows for every active Policy |
| `effectiveCeilings` | Lowest ceiling for each constrained requested Resource and every tied winning reason                 |
| `decision`          | `approved` or `denied`                                                                               |

Evidence excludes original SQL spelling, evaluator stack traces, database identifiers, and context values from error messages. It is returned on exact replay without Policy lookup or evaluation.

## Request denial reason

Existing `insufficient_available` reasons remain unchanged. Add `policy_ceiling`:

| Field            | Type                          |
| ---------------- | ----------------------------- |
| `code`           | `policy_ceiling`              |
| `resourceTypeId` | Resource UUID on the wire     |
| `requested`      | safe integer                  |
| `ceiling`        | safe integer                  |
| `policyName`     | canonical identifier          |
| `policyRevision` | positive safe integer         |
| `reason`         | declared canonical identifier |

If several Policies tie for the lowest ceiling, retain every tied reason. Combined denial reasons sort by canonical Resource name, reason code, Policy name, revision, and reason. Availability and Policy reasons may both appear when both constraints fail.

## Errors

| Code                       | Meaning                                                                                     | State transition |
| -------------------------- | ------------------------------------------------------------------------------------------- | ---------------- |
| `invalid_policy`           | Invalid definition, set, version, digest, schema, source, program, or unsupported construct | None             |
| `invalid_policy_context`   | Missing, extra, mistyped, null-invalid, malformed, or over-limit context                    | None             |
| `policy_evaluation_failed` | Work bound, arithmetic, generated execution, or result validation failure                   | None             |

Error details contain stable Policy identity and rule/category fields. They never echo source or context values. Connection, serialization, and database failures are not broadly converted into Policy errors.

## Budget storage

The public Budget projection does not add Policy or context fields. Private storage adds one complete Policy-set value:

| Runtime    | Representation                                       | Ownership                                                   |
| ---------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| Local      | Canonical JSON text on the private SQLite Budget row | One `SqliteCommandExecutor` transaction                     |
| PostgreSQL | Validated `jsonb` on `keynes_internal.budgets`       | `keynes_internal.apply_command` in caller-owned transaction |

The empty set is the default. No Policy table, mutable revision pointer, activation state, or separate store exists.

## State transitions

### Root creation

```text
validated command
  -> exact replay: stored result
  -> validate complete Policy set
  -> create root with immutable Policy set
  -> record existing creation result/history atomically
```

### Governed request

```text
validated command
  -> authorize and bind command
  -> exact replay: stored result and evidence
  -> lock parent and relevant holdings
  -> validate child Policy set and parent context
  -> freeze inputs and evaluate every parent Policy
     -> error: roll back all command state
     -> valid ceilings
        -> denied: record evidence; no child or holding change
        -> approved: reserve exact amounts; create child with explicit set; record evidence
```

Policy context never becomes child state. Parent Policies never become child Policies. Settlement does not reevaluate Policy.
