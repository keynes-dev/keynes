# Data model: KEY-96

No persisted accounting schema or numerical semantics change. The [architecture](../../architecture.md) and database contract remain authoritative.

| Entity               | Fields and relationships                                                                           | Validation and owner                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Resource declaration | Application alias, unit, accountingBehavior; resolves to immutable canonical name/id/digest        | SDK snapshots/encodes aliases; runtime validates name and definition compatibility; returned identities establish bindings |
| Budget               | Existing identity, parent/root/depth, membership, controls, lifecycle, holdings and history        | Exactly one SQLite or PostgreSQL authority; no state copied between runtimes                                               |
| Command              | Existing operation, commandId or operationKey, normalized input/digest, result and history effects | Database contract defines shape; selected runtime validates and atomically records replay                                  |
| Decision evidence    | Existing bounded caller data attached to requests/results/history                                  | Runtime validates; no policy evaluation or proof of permission                                                             |
| Runtime descriptor   | Discriminant local/remote/embedded, cold initialization function and capability type               | Adapter creates it; SDK requires explicit supported selection; database identities are not descriptor state                |
| Runtime session      | Execution/admission boundary, close state, owned host or borrowed connection                       | Adapter owns open -> closing -> closed and drains admitted work; only owned resources are destroyed                        |
| Installation         | Existing config, profile, baseline checksums and receipt                                           | Private database owns canonical assets; PostgreSQL installation API owns execution and compatibility checks                |
| Archive evidence     | Revision, file/hash per archive, installed paths, versions, host, commands, exit/cleanup results   | Qualification records observations; source inspection is not a passing result                                              |

Budget transitions stay `active -> settling -> settled`, with existing recursive finalization and conservation. No additional Budget state is introduced. Replay returns the recorded outcome without re-evaluating application policy.

A borrowed session closing does not change connection state. The application may continue using its connection and owns transaction commit/rollback; handles returned within an uncommitted transaction are provisional and may no longer identify persisted rows after rollback. Keynes does not track or repair application transaction state.

Runtime initialization validates all configured declarations. Local may populate its new private catalog. PostgreSQL initialization only checks existing definitions and permissions; explicit provisioning remains separate. Unknown SDK aliases fail before identity translation can omit them; canonical validity and quantities are checked by the runtime.
