# Inspection architecture and arena synthesis

## Problem and grounding

At source `3a3b252fb550a8cb4163bba6be29ee93682fadef`, Local SDK inspect admits one synchronous runtime getBudget and projects the result. The private SQLite queue prevents supported mutations from interleaving that read. Direct PostgreSQL get_budget constructs state and root history in its final expression using STABLE state helpers. Preserve and qualify that path; one wire call alone is not proof that arbitrary PLpgSQL queries share a snapshot.

Owned remote inspect in `packages/sdk/src/remote/result-mapping.ts` calls getBudget, then independently starts getBudgetHistoryPage. A commit between these calls creates mixed state/history. The SQL page function deduplicates cursor rows by tenant/stream/next/terminal and deletes them on use. Same-head readers can receive the same single-use token. These are source-traced defects, not reproduced failing tests yet.

KEY-80 already derives quantities from the journal and records each automatic ancestor finalization as an existing settlement event. History covers the entire root tree. Public SDK projection strips event subjects and command relationships; neither wire history nor public history exposes movement rows. Journal query UUID order is not chronology. The existing root event sequence supplies chronology and creation identity.

Current remote role setup authenticates identity but the history-page path lacks a separate read_budget permission check. Every new capture and continuation must check that operation permission, as direct getBudget does. The existing remote JSON projector is VOLATILE, strips private identity and may lazily create Budget references. It cannot be relabeled STABLE or reused unchanged for pure inspection capture.

KEY-80 is Done in live Linear with PR #68; its merge 208873c and KEY-96 merge 3c47555 are ancestors of the planning baseline. KEY-80 acceptance retains revision-specific passing evidence, not proof of KEY-84. Latest main also includes KEY-117; optional policy preparation stays unchanged.

## Usage and shape

The [contract](contracts/inspection.md) contains caller-first examples and the derived types/signatures. The [plan](plan.md) maps modules. One inspect call hides coherence, cursor lifetime and protocol details. New inspection-only state identifies the target; existing event variants retain their payload and gain subject, cause and movements. No new public stateful object or transport type is exposed.

## Decisions

### Freeze target state and fence immutable history

Decision: capture target projection and terminal root sequence in one SQL statement. Store this small per-reader record; later pages use immutable evidence below that fence.

Rationale: the repository already guarantees immutable history, journal and Resource definitions. A snapshot fence reuses those facts and avoids copying complete history for every reader. Read-only STABLE helpers must cover every nested mutable read in the capture. Later mapping can use immutable definitions/creation relations, but never current state or lazy reference creation.

Alternatives considered: copying complete history per reader makes later reads simple but adds proportional storage, whole-history capture work, quotas and new limits. Holding a transaction across pages needs a pinned pooled connection and abandoned-reader cleanup. Both hide the same public complexity at greater operational cost.

PostgreSQL documents that STABLE functions use the calling statement's snapshot while VOLATILE functions may acquire fresh snapshots for their queries. At READ COMMITTED, successive statements can observe different commits; caller-owned transactions also see their own prior writes. These rules inform the design but do not replace native tests. [Function volatility](https://www.postgresql.org/docs/18/xfunc-volatility.html), [transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html).

### Repeatable per-reader offsets

Decision: unique random observation token plus canonical page sequence, fixed 30-minute TTL and current permission checks. Continuations never consume or refresh read state. Preserve existing 256-event page, 128-page SDK and 30-second deadline bounds.

Rationale: root events have a transactional contiguous sequence. Valid aligned positions can be checked without another cursor registry. Cleanup uses bounded expired-row selection with SKIP LOCKED. No mutation lock or long-lived connection is needed.

Alternatives considered: preissue one token row per page; sign a public payload containing state; refresh/delete tokens on use. Each adds state or protocol machinery without improving the required independent repeatable observation.

### Root-relative evidence identities

Decision: use Budget creation sequence, existing event sequence and event-local movement array index. Runtime joins by command plus subject attach journal rows exactly once. Automatic ancestor events reference the initiating event.

Rationale: root history already contains the required identity and causal facts. Resource-name mapping remains typed and private UUIDs stay private. Only inspection results need these fields; changing shared mutation projections would spread read-only metadata work to unrelated commands.

Alternatives considered: publish raw UUIDs, create a second reference registry, or add an encoded movement-ID string. None is needed to distinguish subjects and effects within the known root tree.

### Preserve current scope where adopted docs drift

Decision: no allows/createChildren field. Live KEY-79 is canceled and explicitly says no implementation is planned. Searches found no such field in schema, SQL, SQLite or SDK state. Older product/architecture references remain broader than the runtime and are not evidence that controls can simply be projected.

Decision: do not claim an existing serialized-response byte cap. Only page count, page size and SDK deadline were verified in the source. Native tests measure response growth; this feature does not invent a new payload limit or global observation quota.

## Synthesis decision

Two structurally distinct candidates were completed in separate temporary directories, with no worktrees or repository implementation. A froze target state plus a history fence. B materialized a complete immutable observation and used preissued cursor rows. Both were read in full and screened for shallow interfaces, leaked transport types, temporal decomposition and pass-through layers.

| Rubric, each 0-5                        | Parent A | Parent B | Independent judge A | Independent judge B |
| --------------------------------------- | -------: | -------: | ------------------: | ------------------: |
| Coherent capture and caller ownership   |        4 |        5 |                   4 |                   5 |
| Independent continuations and cleanup   |        4 |        4 |                   4 |                   4 |
| Movement/causal evidence and identity   |        4 |        4 |                   4 |                   4 |
| Small interface and canonical ownership |        5 |        2 |                   4 |                   2 |
| Concrete evidence strategy              |        3 |        3 |                   3 |                   3 |
| Total                                   |       20 |       18 |                  19 |                  18 |

Selected A. Parent and judge agree on the base; the parent gave an extra point for avoiding duplicated history. Grafted B's deterministic event-local movement ordering, target/parent diagnostic identity, explicit pure projection boundary and strict page sequence validation. Rejected B's full-history copies, 16 MiB payload cap, 32-reader quota, 60-second replacement TTL and per-page token rows. These costs follow from materialization, not the issue's needs. No dropouts. The subsequent Ponytail review removed the explicit ordinal field in favor of the array index and replaced nested endpoints with reason-discriminated Budget IDs or null.

The judge identified and synthesis resolved: invented controls, unverified byte caps/index reuse, missing exact cursor grammar, mutable/lazy projection dependencies, generated SQLite paths, operation permission checks and compatibility scope. Inspection-specific projections keep mutation/recovery result revisions unchanged; only remote history-page revision advances, with canonical digest and semantic/minimum generation changes. No second lifecycle or task list was added. A subsequent read-only verification found no design blocker and required explicitly updating both schema and the SQL hard-coded cursor validator; that requirement is now in the contract and tasks.

## Tradeoffs accepted

- Repeat the small frozen target projection on every page to keep one response shape.
- Re-project immutable event facts to avoid storing a copy of root history per reader.
- Scope IDs to the root tree rather than imply global identity or loading capability.
- Use fixed TTL and opportunistic cleanup without promising a global arrival-rate cap or deletion SLA.

## Risks and next implementation step

Native query plans must show the cost of page/effect joins and creation lookup; add only an index justified by that query. No existing tenant/command journal index is assumed. A future change that makes history, Resource definitions or command relations mutable must revisit the fence invariant before shipping.

After implementation is authorized, start with the focused failing snapshot and lineage tests in tasks.md. The architecture checkpoint is the user's explicit stop. No implementation body or test has been written; runtime acceptance remains NOT RUN.
