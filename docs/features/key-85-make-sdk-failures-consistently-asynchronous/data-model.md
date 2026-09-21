# KEY-85 lifecycle model

This design changes transient call handling only. Budget, Resource, command, movement and history schemas remain unchanged. No migration or durable store is introduced.

## Basic runtime session

SQLite and borrowed PostgreSQL sessions own `open`, `closing` and `closed` states, an ordered Promise tail and one retained close Promise.

| State/event                               | Result                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Open, call arrives                        | Reserve its place before inspecting input; capture synchronously; schedule execution after prior admitted work |
| Open, close called                        | Set closing immediately; retain a Promise that drains all reserved calls                                       |
| Closing or closed, call arrives           | Return a rejected Promise with `runtime_closed`; do not touch input or dispatch                                |
| Reserved call fails preparation           | Reject that call, dispatch nothing, and release its queue position                                             |
| Reserved call succeeds or fails execution | Settle its own Promise; later calls and close can continue                                                     |
| Drain finishes                            | SQLite closes its private connection; borrowed PostgreSQL performs no connection cleanup                       |
| Cleanup finishes or fails                 | Mark closed; settle the retained close Promise with the cleanup outcome                                        |
| Close/disposal repeated                   | Reuse the retained outcome and perform no additional cleanup                                                   |

An ordinary operation failure does not become a cleanup failure. The caller owns handling its returned rejection. Internal queue bookkeeping must handle rejection without suppressing the caller's error.

## Admitted call and snapshot

One reserved result links the call to the runtime drain. Preparation captures definitions, quantities, usage, evidence and applicable options before invocation returns. Execution receives only that snapshot. It may produce the existing result or reject with the established error. Capture failures never invoke the command client.

Reentrant close during preparation includes the reservation. Reentrant new calls observe the current runtime state. Preparation does not await the queue or execute accounting; only the queued continuation does that. A rejected call does not introduce a command record or history entry.

## Owned PostgreSQL session

The existing executor remains the sole lifecycle state owner. A session assertion reads that state before SDK input handling and rejects closed calls with `client_closed`. Each later procedure independently enters the existing executor admission set. Close uses the existing deadline and uncertainty behavior; no new session-wide queue, reservation, retry token or durable record is introduced.

Snapshots outlive individual remote attempts and preserve command identity. They do not prove a mutation committed. Existing recovery and uncertainty results retain that meaning.

## Authority and connection ownership

SQLite state belongs to the private in-memory connection. PostgreSQL state belongs to the selected database. Borrowed connections remain owned by the application; successful SDK results remain provisional until its commit, and caller rollback removes those changes. Admission grants no database permission and creates no quantity.
