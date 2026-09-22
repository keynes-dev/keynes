# Data Model: Command-Result Lookup

## Operation receipt

The existing tenant-scoped receipt remains the only durable lookup source.

| Field                      | Meaning                                      | Rule                                                                   |
| -------------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| Tenant                     | Authenticated receipt owner                  | Must match the current caller before disclosure                        |
| Operation key              | Caller-owned command identity                | Valid Keynes operation-key format                                      |
| Canonical input and digest | Replay identity                              | Same key plus changed command, target, resources or evidence conflicts |
| Operation                  | Recorded low-level command                   | Preserved for committed projection                                     |
| Status                     | `unresolved`, `committed` or `known_failure` | Mutation-owned; lookup never changes it                                |
| Response                   | Recorded result or definitive error          | Returned only for terminal receipts                                    |
| Expiry                     | Receipt lookup lifetime                      | Remains 30 days                                                        |

## Operation result

| Kind            | Source state                                             | Payload                            | Meaning                                          |
| --------------- | -------------------------------------------------------- | ---------------------------------- | ------------------------------------------------ |
| `committed`     | Terminal successful command, including allocation denial | key, operation and recorded result | The command has a recorded result                |
| `known_failure` | Terminal definitive command error                        | key and recorded error             | The command has a recorded failure               |
| `unresolved`    | Receipt is in flight or its lock is held                 | key and optional retry hint        | A result is currently unavailable                |
| `not_found`     | No receipt for tenant plus key                           | key                                | No receipt exists at lookup time                 |
| `expired`       | Receipt exists and expiry has passed                     | key                                | The retained receipt is past its lookup lifetime |

`not_found` and `expired` are observations. Neither proves that another process cannot later submit or complete a command under the key.

## State transitions

Lookup has no transitions. Mutation procedures own `unresolved` to `committed` or `known_failure`. Expiry changes the lookup projection without deleting or changing the receipt. Exact mutation replay remains independent of lookup projection and keeps its existing behavior.
