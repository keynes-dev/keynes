# Embedded transaction contract

This contract defines how application database code calls Keynes in the supported embedded PostgreSQL preview. The five public SQL functions remain the normative boundary.

## Supported functions

| Operation            | Function                                      | Permission             |
| -------------------- | --------------------------------------------- | ---------------------- |
| Define Resource type | `keynes.define_resource_type(jsonb) -> jsonb` | `define_resource_type` |
| Create root Budget   | `keynes.create_budget(jsonb) -> jsonb`        | `create_root_budget`   |
| Request child Budget | `keynes.request(jsonb) -> jsonb`              | `request_budget`       |
| Settle Budget        | `keynes.settle(jsonb) -> jsonb`               | `settle_budget`        |
| Read Budget          | `keynes.get_budget(jsonb) -> jsonb`           | `read_budget`          |

No table, private function, arbitrary SQL executor, transaction helper, database handle, or application-table integration is a Keynes public contract.

## Caller obligations

The application must:

1. check out one database connection;
2. begin the transaction itself;
3. set the declared tenant and principal with transaction-local settings;
4. issue a parameterized call to one supported Keynes function on that connection;
5. treat a returned approval and child identity as pending;
6. write its application row or outbox record on the same connection;
7. commit or roll back the transaction itself;
8. start external work only from committed application state; and
9. retry only with an application decision and the same command identity when exact replay is intended.

The one-role/one-principal preview trusts application code to assert the installed tenant and principal. These settings are not end-user authentication and do not qualify hostile-role isolation.

## Keynes obligations

Keynes must:

- execute inside the transaction and snapshot supplied by the caller;
- use its installed procedures for validation, permission checks, locking, conservation, replay, accounting, settlement, history, and structured errors;
- avoid `BEGIN`, `COMMIT`, `ROLLBACK`, savepoint, connection acquisition, reconnection, or transaction retry;
- avoid reading, joining, validating, or mutating application tables;
- leave no authority state when the caller rolls back; and
- return the stored result for an exact command replay after commit.

The SQL function result does not claim that the surrounding transaction committed. Keynes exposes no commit status.

## Reference statement sequence

```sql
BEGIN;

SELECT
  set_config('keynes.tenant_id', $1, true),
  set_config('keynes.principal_id', $2, true);

SELECT keynes.request($3::jsonb) AS response;

-- Application-owned insert, only after an approved response.
INSERT INTO application_outbox
  (outbox_id, command_id, child_budget_id, payload)
VALUES ($4, $5, $6, $7::jsonb);

COMMIT;
```

`$1` through `$7` are driver parameters. An application error after the Keynes call must roll back the transaction. The application must not interpolate an operation name or SQL fragment from user input.

## Result handling

The function returns the existing authority wire envelope. A successful request result can be approved or denied. A denial is an authoritative result, not a database failure. The application inserts no authorized-work outbox row for a denial.

An authority error such as `unauthorized`, `invalid_command`, `command_conflict`, or `budget_not_active` uses the existing structured error contract. Driver or transaction errors remain driver errors. The application decides whether the surrounding transaction can continue or must roll back.

## Visibility rules

| Point in time                                           | Creating transaction                | Another session or outbox worker |
| ------------------------------------------------------- | ----------------------------------- | -------------------------------- |
| After approved request and outbox insert, before commit | Sees child and outbox row           | Sees neither                     |
| After commit                                            | Sees committed child and outbox row | Sees both                        |
| After rollback                                          | Sees no surviving state             | Sees neither                     |

The application must not send provider requests, publish messages, or start workers between approval and commit. The application-owned outbox is the handoff from committed database state to external effects.

## Replay and conflict

- Exact replay after commit uses the same tenant, operation, command ID, and canonical input. Keynes returns the stored result with `replayed: true` and creates no duplicate Budget or history entry.
- Reuse of the command ID with a different operation or canonical input returns `command_conflict` and changes neither Keynes nor application state.
- A command rolled back with its transaction has no stored result. Reusing its ID later is a new execution, not replay.
- The application outbox needs its own idempotency rule. Keynes replay does not deduplicate application rows or external effects.

## Contention

The supported profile uses PostgreSQL `READ COMMITTED`. Existing authority locks serialize conflicting Budget requests, settlement, and exact replay across independent connections. Acceptance must observe real blocking with `pg_blocking_pids`; elapsed time alone is not proof.

## Invalid compositions

These flows are outside the contract:

- passing a pool that may choose another connection for each statement;
- calling Keynes in one database and writing the application row in another;
- treating an external provider call as part of the PostgreSQL transaction;
- asking Keynes to query an application table;
- starting work from an uncommitted child Budget;
- giving Keynes ownership of the application transaction; or
- inferring self-hosted, managed, recovery, security, or production support from this preview.
