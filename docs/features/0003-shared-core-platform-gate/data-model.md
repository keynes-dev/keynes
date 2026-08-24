# Data model: Shared core platform gate

FEAT-0003 adds no product entity, table, public value, or durable evidence store. It installs and observes the FEAT-0002 model on two engines.

Test-only values live for one process:

| Value | Rule |
| --- | --- |
| Host | `pglite` or `postgresql` |
| Case | Existing test name or native contention case name |
| Observation | Returned JSON, a declared test-control failure, or an unexpected failure |
| Backend PID | Native process ID used only to prove one transaction blocks another |
| Run ID | Random UUID used as the owned container name and diagnostic identity |
| Image digest | Exact native image digest declared by the platform runner |

A paired call passes when both engines return deeply equal JSON or the same declared test-control failure. Any skip, one-sided result, or unexpected failure fails the case.

Credentials, connection strings, driver error objects, and private table contents are not qualification values and must not enter retained diagnostics.
