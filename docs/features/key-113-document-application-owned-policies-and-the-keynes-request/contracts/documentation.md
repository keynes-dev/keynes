# Documentation contract

This contract defines what readers must be able to establish from the finished documentation. It does not define a new runtime API. The governing edits described here are not yet implemented.

## Required ownership statements

| Concern          | Required statement                                                                                                                                           | Planned owner                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Evaluation       | Customer computes a typed request or rejects; customer owns failures, fallback, transactions and recomputation.                                              | Product and architecture       |
| Allocation       | Database validates and enforces permissions, Budget constraints and available exact quantities atomically. Valid requests may still be denied.               | Architecture and constitution  |
| Evidence         | Caller records do not prove evaluation ran and do not grant authority.                                                                                       | All governing docs             |
| Replay           | Exact command retry returns the recorded outcome without reevaluating policy or external work; changed input conflicts.                                      | Architecture                   |
| Optional helpers | No mandatory Policy result, callback, transaction manager or database-managed Policy lifecycle. Helpers may define typed interfaces.                         | Product and architecture       |
| Hosting          | Customer ownership permits app-local, customer-service and later Keynes Cloud execution. KEY-125 initially evaluates only, outside authoritative accounting. | Product and architecture       |
| Migration        | KEY-114 retires managed Policies; KEY-96 separates packages. Fresh installs only, no automatic database upgrades.                                            | ADR, workflow and package docs |
| Deployment       | Ephemeral Node SQLite Local and PostgreSQL Hosted/Embedded with separate engine accounting outside SDK and shared command contracts/scenarios.               | All governing docs             |

## Example acceptance

Use one small allowance rule in ordinary code and customer SQL, with the same facts and parameters. For example, an allowed operation requests 25 units of a declared `usdCents` Resource when the customer's selected limit is at least 25. Both examples must produce the exact same Resource/quantity data. Below that limit, both must reject before submission. These numbers illustrate a rule; they do not establish rounding or numeric-range requirements.

Keep request construction separate from the schematic submission step. State that code is conceptual target usage until KEY-114 defines the exported shape. Do not present a newly invented request wrapper, type name or callback as a shipping SDK interface. A SQL result can supply values for a request without being a Keynes-registered SQL Policy. Customer queries may read customer data under customer permissions; that does not open Keynes private tables.

Also demonstrate or explain:

- With only 10 units available, the valid 25-unit request is denied by Keynes.
- A customer rejection does not submit an allocation command; any separate customer record is not Keynes denial evidence.
- A missing/malformed structured assessment or provider failure triggers customer-owned rejection or explicit fallback before submission, never implicit approval.
- The customer may evaluate before its transaction, inside its PostgreSQL transaction, or through a service. It owns staleness, retries and recomputation; cross-database atomicity is not implied.
- An exact committed command replay does not query customer tables or invoke a model. Availability changes do not rewrite its recorded outcome.
- Decision evidence and optional prepared requests do not bypass current Budget permission or quantity checks.

Release commitments and later owners follow [FR-008, FR-009 and FR-016/017](../spec.md#functional-requirements).

## Supersession and current behavior

The new ADR must identify the precise superseded managed Policy and PGlite requirements described in research. Add forward notices without rewriting historical decision bodies. Current SDK Policy helpers and installer instructions remain labeled current implementation. Target sections cannot assert that Policy retirement, new runtime packages or qualification already ship.

The first Local boundary must exclude durability, a database handle, browser support, multi-process coordination and caller-owned PostgreSQL transactions. SQL access from other application languages does not promise another SDK. Customers can bypass controls they own; guarantees apply to supported operations. Exact accounting, conservation, deterministic replay and invalid-input errors remain mandatory.
