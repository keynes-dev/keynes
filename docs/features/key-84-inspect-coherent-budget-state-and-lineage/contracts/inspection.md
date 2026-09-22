# Coherent inspection contract

Proposed contract for [KEY-84](../spec.md). No executable types, SQL or runtime changes have been made. Canonical wire definitions belong to `packages/database/schema.json` and `contract.json`; generated copies are not authored inputs.

## Usage

```ts
const snapshot = await child.inspect();
const ownEvents = snapshot.history.entries.filter(
  (event) => event.subject === snapshot.budget.lineageId,
);
for (const event of snapshot.history.entries) {
  for (const [index, movement] of event.movements.entries()) {
    display(event.sequence, index, movement.reason, movement.amount);
  }
}
const [first, second] = await Promise.all([child.inspect(), child.inspect()]);
```

Each result is complete at its own observation. Different calls may observe different committed states. A child receives its own state and its whole root tree's history, including siblings. The caller manages no cursor or snapshot lifetime.

## Public type sketch

These are documentation signatures. Existing event-specific fields remain intact.

```ts
type LineageBudgetId = number;
type MovementPath =
  | {
      readonly reason: "initial_allocation";
      readonly from: null;
      readonly to: LineageBudgetId;
    }
  | {
      readonly reason: "child_grant" | "settlement_return";
      readonly from: LineageBudgetId;
      readonly to: LineageBudgetId;
    }
  | {
      readonly reason: "consumption" | "root_release";
      readonly from: LineageBudgetId;
      readonly to: null;
    };
type BudgetMovement<Names extends string> = MovementPath & {
  readonly resource: Names;
  readonly amount: number;
};
type LineageEvidence<Names extends string> = {
  readonly subject: LineageBudgetId;
  readonly cause:
    | { readonly kind: "command" }
    | {
        readonly kind: "automatic_finalization";
        readonly eventSequence: number;
      };
  readonly movements: readonly BudgetMovement<Names>[];
};
interface BudgetInspectionState<
  Names extends string,
> extends BudgetState<Names> {
  readonly lineageId: LineageBudgetId;
  readonly parentLineageId: LineageBudgetId | null;
}
// BudgetSnapshot.budget becomes BudgetInspectionState<Names>.
// Each existing BudgetHistoryEntry variant includes LineageEvidence<HistoryNames>.
// request_approved additionally includes parent: LineageBudgetId;
// its existing subject identifies the new child.
// Budget.inspect(): Promise<BudgetSnapshot<Names, HistoryNames>> stays unchanged.
```

Keep `BudgetState` used by settlement results unchanged. Inspection adds identity to its own projection, rather than forcing creation/settlement/recovery results to look up history. Unknown Resource names fail validation; a child's state uses Names and tree history uses HistoryNames. Freeze movements and nested causes with the existing result-freezing discipline.

Lineage IDs are positive safe integer creation-event sequences, scoped to the known root tree. A root uses its `budget_created` sequence; a child uses its `request_approved` sequence. Existing event `sequence` is its stable root-relative identity. A movement is identified by `(event.sequence, index)` using its zero-based index in the deterministically ordered movements array. IDs from unrelated trees may be equal and MUST NOT be compared as global identities. None can reopen a Budget, authorize access or expose a private UUID, command ID, operation key or credential.

For initial allocation, a null source means outside the tree. A null destination means consumed for consumption and outside the tree for root release. The reason-discriminated union preserves these distinctions without nested endpoint objects.

## Movement and causality rules

Runtime projection attaches actual journal rows, never reconstructed amounts, to existing history events using tenant, root, command and subject:

| Movement           | Owning event and subject                             |
| ------------------ | ---------------------------------------------------- |
| initial_allocation | budget_created; subject is destination root          |
| child_grant        | request_approved; subject is destination child       |
| consumption        | budget_settlement_recorded; subject is source Budget |
| settlement_return  | budget_settlement_recorded; subject is source child  |
| root_release       | budget_settlement_recorded; subject is source root   |

Each row has exactly one owner. Sort an event's movements by canonical Resource name using bytewise order, then reason using bytewise order. KEY-80 admits at most one movement per event, Resource and reason; tests must prove that invariant, including cascades, rather than silently merge duplicates. This is deterministic display order within an atomic command, not an independent execution clock.

The initiating event has cause `command`. Later settlement events from the same command identify automatic ancestor finalization and reference the initiating settlement event's sequence. Use the recorded command/event relation; empty newlyKnown is not proof of automatic finalization. Preserve target then nearest ancestor through root ordering. Finalization without a movement still emits its existing event. A denied request has no movement; zero membership creates none. A repeated settlement under a fresh command retains existing recorded-event behavior but no duplicate terminal movement. Exact replay adds neither events nor movements.

Allocated, available and committed keep KEY-80 meaning. Usage and deficit stay separate from quantity movements. Decision evidence remains the original bounded caller assertion, including arbitrary caller keys, and must not be interpreted as movement/cause metadata. No accounting arithmetic or journal association lives in the SDK.

## Coherent read boundary

SQLite enriches the existing synchronous private `#getBudget` read under runtime admission. Load ordered history and needed journal facts once; derive creation/event lookups per read. No new public transaction, database handle or persistence.

Direct PostgreSQL `get_budget` reads the target projection, root history, movement joins and lineage keys in one final SQL SELECT with read-only STABLE helpers. Preserve validation and permission checks. Read-only caller transactions must work without cursor writes or reference minting. Caller-owned uncommitted work remains provisional; adapter code never begins, changes isolation, commits, rolls back, substitutes or closes the caller connection. Stronger-isolation failures propagate for whole-transaction retry by the caller.

Remote inspection starts with the existing generated `getBudgetHistoryPage` operation without cursor. It no longer calls remote `getBudget` first. Capture target state, creation identity and terminal root-history sequence in ONE SQL statement using STABLE helpers. Persist the captured state and terminal fence; page only immutable history and movement rows attached to events at or below that fence. New mutations cannot alter that observation. Immutable Resource definitions and recorded command/event relations may be read later without admitting newer events.

Use an inspection-specific remote page projection containing target `budgetReference`, lineageId, parentLineageId, depth, lifecycle and Resource projections. Do not require parent/root loading references. Capture Resource descriptors and lineage keys through read-only joins; do not call the existing lazy reference-creating `remote_project_json_v0006` from the snapshot expression. Remote history projection preserves the new metadata and maps only known authority fields. Caller decisionEvidence is copied as data, not recursively rewritten by identity-key names.

The internal page result is one shape on every page:

```ts
interface CapturedHistoryPage {
  readonly budgetReference: string;
  readonly budget: RemoteBudgetInspectionProjection;
  readonly entries: readonly RemoteBudgetHistoryEntry[];
  readonly nextCursor: string | null;
}
declare function getBudgetHistoryPage(
  query: GetBudgetHistoryPageQuery,
): Promise<CapturedHistoryPage>;
```

`RemoteBudgetInspectionProjection` is generated protocol data, not a public SDK export. Each page repeats the frozen target projection. SDK validation checks the target, identical captured projection, strict contiguous event sequence, page bounds and progress before publishing one frozen result. Preserve existing remote mismatch/error conventions. Map inspection metadata directly; do not replace it with the existing PRIVATE_UUID placeholders. Existing projection-only remote getBudget/openBudget and mutation commands keep their semantics.

## Independent repeatable continuations

Replace `remote_history_cursors` with one private observation row per fresh multi-page capture: random token, tenant, principal, exact target Budget, root stream, captured projection, terminal sequence and absolute expiry. Independent calls always get different tokens. A single-page capture can return directly without retaining a row.

The opaque cursor uses a versioned encoding of the random observation token and next sequence. Define canonical ASCII `khc_v2_<32 lowercase hex random characters>_<positive decimal sequence>`. The grammar is `^khc_v2_[0-9a-f]{32}_[1-9][0-9]{0,15}$`, at most 56 ASCII characters; leading zeroes, signs, fractions and exponent notation are invalid. Update both schema HistoryCursor and the hard-coded SQL remote_validate_input_v0006 cursor validation, including replacement of the old table CHECK. Tokens use existing cryptographic randomness; they contain no private Budget identity. Parse without loose integer coercion, require a safe integer `s`, `(s - 1) % 256 === 0`, `s >= 257`, and `s <= terminal_sequence`. Page positions are repeatable read offsets, not consumable capabilities; jumping to another valid page of the same authorized observation is allowed. Return null after the terminal page. Repeating any issued token/position returns identical entries and nextCursor.

Every capture and continuation checks authenticated remote identity, current read permission and target authorization. Row lookup additionally matches tenant, principal and exact target, even for siblings sharing a stream. Do not disclose protected rows before these checks. Invalid syntax, unknown/expired token, wrong authorized target or principal mismatch returns sanitized invalid_command; authentication, tenant or read-permission failure returns the existing sanitized unauthorized error. Failed use never invalidates a valid reader. Revocation completed before a page call must be respected; an already executing statement follows PostgreSQL snapshot visibility.

Use fixed 30-minute expiry from capture; reads never extend or consume it. Cleanup deletes at most 256 expired observations per remote paging call, using an expiry index and `FOR UPDATE SKIP LOCKED` on the selected metadata rows to avoid competing cleanup readers blocking each other. Never take Budget, history-stream or journal mutation locks, and never delete unexpired rows when another reader completes. Expired rows are inaccessible immediately but physical deletion is opportunistic; this is not a wall-clock deletion SLA or a bound on capture arrival rate.

Retain 256 events per page, 128 pages per SDK inspection and its 30-second deadline. More than 128 required pages or a deadline expiry fails without a partial successful result. No new payload-size cap, tenant quota, background worker or global read lock is introduced. Measure page projection at the existing event bound; KEY-87 owns the broader operating envelope.

## Compatibility and failure boundaries

Advance remote semantic/minimum SDK generation from 5 to 6 and history-page procedure revision from 3 to 4. Update canonical schemas for enriched direct inspection and remote page results, generator expectations, SQL inventory and derived installation identities through existing generation. Do not silently accept a pre-feature page as coherent. Keep mutation replay input/result meaning unchanged.

Fresh install and an exact matching reinstall remain supported. Older, drifted and profile-mismatched baselines fail closed; there is no historical result conversion or automatic migration. Permissions protect snapshot metadata; ordinary application roles cannot read or mutate its private table. Projection/capture failure publishes no partial success. New read metadata is disposable and never becomes quantity authority.
