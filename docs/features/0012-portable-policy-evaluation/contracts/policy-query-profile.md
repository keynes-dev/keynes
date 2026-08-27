# Contract: Keynes Policy query profile v1

## Identity

| Contract      | Value                        |
| ------------- | ---------------------------- |
| Program       | `keynes-policy-program/v1`   |
| Query profile | `keynes-policy-query/v1`     |
| Validator     | `keynes-policy-validator/v1` |
| Limits        | `keynes-policy-limits/v1`    |

These identifiers are part of every Policy definition and its digest. An implementation rejects an unknown identifier. A later language or limit expansion requires a new version and cross-runtime qualification.

`packages/contracts/policy-profile.json` is the authoritative machine-readable semantic definition for these identities. It defines every program node's fields, type rules, null behavior, numeric boundaries, work cost, canonical form, backend declarations, and canonical vectors. Generated TypeScript and PostgreSQL metadata must agree with its digest. Neither backend may maintain a separate semantic allowlist.

Kysely is the normal typed authoring surface. Direct raw SQL and Kysely's `sql` template are supported escape hatches. Kysely compiles; it does not define the accepted language. Both paths produce PostgreSQL SQL plus a positional parameter vector and pass through the same pinned PostgreSQL 18 parser and this profile.

## Inputs

The query may read only:

- `requested_resources AS requested`: current requested canonical Resource name and non-negative safe-integer amount, filtered to the Policy's declared inputs;
- `available_resources AS available`: parent canonical Resource name and available non-negative safe-integer amount for the Policy's declared inputs; and
- `policy_context AS context`: exactly one row with the declared canonical context fields.

No name resolves to a database relation. Runtimes construct these logical inputs from detached values. PostgreSQL passes them as JSON parameters to renderer-owned fixed relation templates.

## Statement shape

The profile accepts exactly one `SELECT` and one optional trailing semicolon. Multiple statements are invalid. Comments are accepted as syntax trivia and discarded. The normalized shape is:

```sql
SELECT <resource-expression> AS resource,
       <numeric-expression> AS ceiling,
       <reason-expression> AS reason
FROM requested_resources AS requested
<availability-join>
CROSS JOIN policy_context AS context
[WHERE <boolean-expression>]
[GROUP BY <group-expression-list>]
[ORDER BY resource ASC, reason ASC, ceiling ASC]
```

`<availability-join>` is exactly one of:

```sql
INNER JOIN available_resources AS available USING (resource)
CROSS JOIN available_resources AS available
```

The inner join handles same-Resource rules. The cross join permits bounded aggregation over other declared availability Resources. No relation may appear twice. `ORDER BY` may be omitted in submitted source; canonical SQL includes the exact output order. Any different explicit ordering is invalid.

## Expressions

Allowed constructs are:

- bounded decimal, valid text, boolean, and null literals;
- declared column references;
- parentheses;
- unary `+` and `-` and checked decimal `+`, `-`, `*`, `/`, and `%`;
- `=`, `<>`, `<`, `<=`, `>`, and `>=` for compatible numeric values;
- `=` and `<>` for text and boolean values;
- text `IN` over a non-empty literal list;
- `IS NULL`, `IS NOT NULL`, `AND`, `OR`, and `NOT`;
- searched `CASE` with type-compatible branches;
- `coalesce`, `least`, and `greatest`;
- `abs`, `ceil`, `floor`, `round`, `trunc`, `sqrt`, and bounded integral `power`;
- `sum`, `avg`, `min`, `max`, and `count` with ordinary grouping rules; and
- positional parameters whose complete scalar value vector accompanies the submitted query.

Function names, arity, argument types, return types, null behavior, and PostgreSQL 18.6 signatures are allowlisted in `packages/contracts/policy-profile.json`. Every numeric expression is normalized at the published `numeric(38,18)` boundary. `round` and `trunc` accept an optional literal scale from 0 through 18. `power` accepts a literal integer exponent from 0 through 18. Unknown or implicit casts are invalid. Double precision, concatenation, pattern matching, case conversion, date/time, JSON functions, trigonometric, logarithmic, exponential, random, user functions, windows, and scalar subqueries are not in v1.

## Rejected syntax

The parser and validator reject:

- schema-qualified or quoted identifiers;
- `*` projections;
- `WITH`, subqueries, self joins, set operations, `DISTINCT`, `HAVING`, `LIMIT`, and `OFFSET`;
- DML, DDL, transaction, session, copy, explain, and procedural statements;
- casts outside renderer-owned exact casts;
- arbitrary relations, functions, operators, collations, or order expressions;
- unbound, repeated-with-conflicting-type, non-scalar, or excess positional parameters;
- dollar-quoted text, escape strings, or more than one statement.

This list describes common invalid forms. The allowlist is authoritative; an unlisted construct is invalid even when it is not named here.

Line and block comments are accepted as syntax trivia and omitted from the canonical program and SQL. They cannot contain parameters or affect Policy identity.

## Types and nulls

Numeric inputs begin as exact safe integers from 0 through 9,007,199,254,740,991 or bounded decimal literals. Every numeric node produces a `numeric(38,18)` value: at most 20 integer digits and exactly the published 18-digit fractional boundary, rounded half away from zero when reduction is required. Local evaluation uses an immutable decimal.js clone configured for 38 significant digits and `ROUND_HALF_UP`; PostgreSQL emits explicit `numeric(38,18)` casts at the same program-node boundaries. Intermediate negative and fractional values are valid. Division or modulo by zero, a negative square root, an invalid or over-limit power, precision overflow, and a final ceiling that is negative, fractional, or outside the safe-integer Resource range are errors.

`sum` and `avg` use the same decimal boundary after every deterministic aggregate transition and at the final result. `round` follows PostgreSQL numeric half-away-from-zero behavior. `ceil`, `floor`, and `trunc` retain numeric type. Functions that select PostgreSQL `double precision` overloads are invalid even when PostgreSQL could resolve them.

Boolean expressions use PostgreSQL three-valued logic with deterministic left-to-right lazy evaluation. `NOT NULL` is null. `FALSE AND x` is false without evaluating `x`; `TRUE AND NULL` is null; and `NULL AND FALSE` is false. `TRUE OR x` is true without evaluating `x`; `FALSE OR NULL` is null; and `NULL OR TRUE` is true. Errors in a skipped right operand do not occur.

`WHERE` retains only `TRUE`. Comparisons with null return null. `count` returns zero for no inputs; `min` and `max` ignore nulls and return null for no non-null inputs. `coalesce` returns its first non-null input. `least` and `greatest` ignore null arguments and return null only when every argument is null. A null `resource`, `ceiling`, or `reason` result is invalid.

Context text must be well-formed Unicode, must not contain U+0000, and is limited to 256 UTF-8 bytes. The profile permits text equality and literal membership, not locale-sensitive ordering. Resource names and reasons are lowercase ASCII identifiers, so canonical ordering is byte-stable. PostgreSQL uses the `C` collation where text comparison is required.

## Result contract

The result has exactly three named columns:

- `resource`: one declared output Resource that appears in the current request;
- `ceiling`: one non-null safe integer; and
- `reason`: one declared canonical reason.

A Policy returns at most one row per Resource and 64 rows. No row for a Resource means no added constraint. Duplicate, extra, undeclared, unrequested, null, negative, fractional, overflowed, or over-limit output is `policy_evaluation_failed`, not a denial.

When several Policies constrain one Resource, the lowest ceiling wins. All reasons tied at the lowest ceiling are retained. A positive request above an effective ceiling is denied. Keynes never reduces the request to the ceiling.

## Canonicalization and digests

Normalization:

- lowercases keywords and unquoted identifiers;
- canonicalizes SDK Resource/context keys to lowercase snake case;
- removes redundant parentheses;
- resolves every positional parameter to a typed literal node and rejects unused or missing values;
- normalizes `!=` to `<>`;
- normalizes comments away;
- inserts explicit aliases and the canonical final ordering;
- sorts declarations and Policy sets by defined ASCII keys; and
- preserves operand and `CASE` branch order.

The canonical printer emits one UTF-8 SQL form with one newline terminator. `sourceDigest` hashes that canonical SQL. `definitionDigest` hashes the versioned canonical Policy document containing declarations, reasons, context schema, profile identities, program, and canonical SQL. Original whitespace and parser-private nodes are excluded.

Canonical JSON supports null, boolean, safe integer, valid string, array, and sorted-key object only. The TypeScript and PostgreSQL encoders must produce identical bytes for the fixture corpus.

## Backend conformance

Generation rejects a profile node that lacks a TypeScript handler declaration,
PostgreSQL validation and rendering declarations, a work cost, or canonical
vectors. Every canonical vector runs through both backends and compares accepted
type, value, null, error, and work-limit results. Property-generated valid
programs and mutation cases cover compositions beyond the node vectors. A
backend difference is a release-blocking contract failure, not an allowed
deployment variation.

Both backends evaluate inside the transaction that owns the Budget command.
Keynes never accepts an application-computed Policy result as input to the
decision. A later shared executable backend may implement this same contract
without changing the public program when it preserves that authority boundary.

## Limits

| Limit                                          |  Value |
| ---------------------------------------------- | -----: |
| Policies per Budget                            |     16 |
| Declared input Resources per Policy            |     64 |
| Declared output Resources per Policy           |     64 |
| Context fields                                 |     32 |
| Canonical context bytes                        |  8,192 |
| Context text bytes per value                   |    256 |
| Submitted or canonical source bytes per Policy | 16,384 |
| Canonical source bytes per Policy set          | 65,536 |
| Program nodes per Policy                       |    512 |
| Program nesting depth                          |     32 |
| Requested input rows                           |     64 |
| Availability input rows per Policy             |     64 |
| Result rows per Policy                         |     64 |
| Worst-case operations per Policy               | 65,536 |

The profile manifest defines the worst-case operation estimator from node visits, bounded join rows, aggregate transitions, grouping, and output sorting. Both runtimes reject an input whose bound exceeds 65,536 before executing the Policy. Actual wall time is not canonical evidence. PostgreSQL caller/service timeouts are operational fuses and must not be mapped to approval or denial.
