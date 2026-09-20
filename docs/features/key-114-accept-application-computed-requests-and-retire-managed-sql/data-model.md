# Data model

Proposed changes only; implementation NOT RUN.

| Entity            | Retained ownership and invariant                         | Change                                           |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------ |
| Resource          | Immutable tenant definition; no quantity                 | None                                             |
| Budget/membership | Fixed funding, exact members, parent and lifecycle       | Remove stored Policy attachments                 |
| Journal/usage     | Exact movements, consumption/return/release and deficits | None                                             |
| Command           | Canonical identity/digest and complete outcome           | Bind normalized decision evidence                |
| History           | Ordered committed lineage events                         | Add caller evidence to request approval/denial   |
| Remote operation  | Existing identity/recovery receipt                       | Preserve recovery and known-failure semantics    |
| Installation      | Exact baseline/profile/contract/procedure compatibility  | Remove Policy identity and advance compatibility |

Evidence is not a new entity with its own lifecycle or table. Store it on the existing request result and history only, not on Budget rows. Its bounds and canonicalization are defined in [the contract](contracts/requests.md).

A valid request commits either denial plus history/result or a child plus grant/history/result. Invalid/unauthorized calls have no canonical allocation effects; existing admitted remote failure receipts may remain. Exact replay adds nothing. Changed canonical input conflicts. Transaction failure or caller rollback removes all provisional effects, including evidence and receipts. Ordinary settlement remains unchanged.

Remove Policy catalog/descriptor/binding state, SQLite `policies_json`, PostgreSQL `budgets.policies`, evaluator data and Policy result/ceiling variants from the new runtime. Historical databases are rejected, never rewritten. Fresh Local remains in-memory and unrecoverable after exit.
