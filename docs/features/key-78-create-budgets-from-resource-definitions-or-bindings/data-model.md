# Data model: configured creation

This design adds no durable client configuration or second catalog. Existing
authority tables and lifecycle remain authoritative.

| Entity                  | Fields and relationships                                            | Rules                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resource declaration    | Public key, unit, accountingBehavior                                | Quantity-free plain object; non-empty batch; existing name/unit/behavior validation. Client captures an immutable copy. No credentials or private IDs. |
| Tenant definition       | Existing identity, tenant, canonical name, unit, behavior, digest   | Immutable authority record. Only explicit provisioning defines or exact-reuses it.                                                                     |
| Configured client       | Captured declaration map, one runtime/executor, existing lifecycle  | Names derive from declarations. No durable row; extra catalog names and subsequent provisioning do not widen it.                                       |
| Validation query        | Non-empty definitions map                                           | Compare every definition in authenticated tenant; return confirmation only. No replay, binding, Budget, or history record.                             |
| Creation command        | Existing identity, selected definitions, amounts, optional Policies | Equal non-empty definition/amount key sets; existing non-negative safe integers. Canonical meaning includes zero membership and effective Policies.    |
| Membership              | Existing Budget-to-Resource rows                                    | Exactly the supplied amount keys; immutable. Zero rows remain visible in inspection and types.                                                         |
| Funding/history         | Existing root initial quantities and creation history               | Positive quantities introduce complete funding. Zero creates no quantity movement.                                                                     |
| Command/recovery result | Scoped identity, normalized digest, stored result/reference         | One committed result per identity. Remote and core records agree on meaning and commit together.                                                       |

## State transitions

Initialization captures declarations, acquires one authority, and establishes the
private catalog or validates the durable catalog. Only success returns an open
client. Failure closes acquired resources without publishing a handle. Local
open -> closing -> closed continues to drain admitted work and reject later calls.

Creation resolves selected members and commits the root, membership, complete
funding, history, and replay result atomically. Failure or caller rollback removes
every effect of that attempt. Previously provisioned definitions and unrelated
roots remain unchanged.

An all-zero root starts active with ordinary unresolved usage. Settlement still
needs explicit usage; zero funding does not supply it. Requests above availability
deny. No later operation introduces funds. New creation identities produce
independent roots without requiring unrelated roots to settle.

Exact replay returns the original stored creation result, even after later Budget
lifecycle changes. Changed amounts, zero membership, or effective Policies conflict.
Key order and unused compatible configuration do not affect replay. Reauthorization
and tenant-scoped definition checks still apply.

## Compatibility

Reuse current storage and add the generated procedure revision described in
[research.md](research.md). No journal conversion, binding transport format,
installed database upgrade, or persisted client registry belongs to this feature.
