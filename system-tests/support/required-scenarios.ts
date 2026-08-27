export const REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS = {
  "packages/postgresql/test/unit/installation.native.test.ts": [
    "native PostgreSQL installation installs a fresh target atomically",
    "native PostgreSQL installation returns an exact no-op result without changing installed state",
    "native PostgreSQL installation rejects an unsupported PostgreSQL version before mutation",
    "native PostgreSQL installation rejects an operator without installation privilege before mutation",
    "native PostgreSQL installation rejects missing owner and application roles",
    "native PostgreSQL installation rejects role login and database privilege contract violations",
    "native PostgreSQL installation rejects an application role with inherited owner-role access",
    "native PostgreSQL installation rejects an incompatible partial target without repairing it",
    "native PostgreSQL installation classifies two empty Keynes schemas as incompatible live state",
    "native PostgreSQL installation rejects a migration-byte mismatch without changing the target",
    "native PostgreSQL installation rejects a migration contract-digest mismatch",
    "native PostgreSQL installation rejects a contract mismatch without changing the target",
    "native PostgreSQL installation rolls back every migration after an injected failure",
    "native PostgreSQL installation rejects a changed live function body during exact recheck",
    "native PostgreSQL installation rejects changed live function security properties",
    "native PostgreSQL installation rejects live object, permission, ownership, and ACL drift",
  ],
  "packages/postgresql/test/unit/recheck.native.test.ts": [
    "PostgreSQL exact recheck and application-role conformance rechecks the exact graph read-only",
    "PostgreSQL exact recheck and application-role conformance checks the server, checksums, contract, and complete object inventory",
    "PostgreSQL exact recheck and application-role conformance checks owners, bodies, languages, security, and fixed search paths",
    "PostgreSQL exact recheck and application-role conformance checks bootstrap permissions and schema and function ACLs",
    "PostgreSQL exact recheck and application-role conformance allows the application role to call exactly the five public functions",
    "PostgreSQL exact recheck and application-role conformance denies private and unsupported function access without changing state",
  ],
  "system-tests/postgresql/budget-lifecycle.test.ts": [
    "Budget lifecycle defines a Resource type without creating Budget quantity",
    "Budget lifecycle preserves definition identity and distinguishes replay from redefinition",
    "Budget lifecycle returns canonical Resource definition errors",
    "Budget lifecycle completes one funded child lifecycle and reads its root-lineage history",
  ],
  "system-tests/postgresql/installation.test.ts": [
    "PostgreSQL installation installs explicit principal permission records",
    "PostgreSQL installation installs the current graph and rechecks it without changes",
    "PostgreSQL installation rejects a contract digest mismatch before installation",
    "PostgreSQL installation rejects migration byte drift before applying it",
    "PostgreSQL installation rejects an installed-object mismatch after fresh migration",
    "PostgreSQL installation rolls back '0001-storage' atomically when its final statement fails",
    "PostgreSQL installation rolls back '0002-budget' atomically when its final statement fails",
    "PostgreSQL installation rolls back '0003-public' atomically when its final statement fails",
  ],
  "system-tests/postgresql/contention.native.test.ts": [
    "native PostgreSQL contention funds at most one sibling after proving the second request waits",
    "native PostgreSQL contention rejects a request that waits behind a committed settlement seal",
    "native PostgreSQL contention orders a waiting settlement after the committed request",
    "native PostgreSQL contention returns the stored result when a matching command waits for commit",
  ],
  "system-tests/postgresql/embedded-transactions.native.test.ts": [
    "embedded PostgreSQL caller-owned transactions commits an approved request and application outbox row together",
    "embedded PostgreSQL caller-owned transactions leaves neither Budget state nor outbox state after explicit rollback",
    "embedded PostgreSQL caller-owned transactions rolls back Keynes when the application write fails after approval",
    "embedded PostgreSQL caller-owned transactions commits a denial without creating application work",
    "embedded PostgreSQL caller-owned transactions returns invalid_command for malformed input without opening application work",
    "embedded PostgreSQL caller-owned transactions uses the caller-owned transaction lifecycle",
    "embedded PostgreSQL caller-owned transactions keeps a pending child and outbox row invisible to another session",
    "embedded PostgreSQL caller-owned transactions makes the child and outbox row visible after the caller commits",
    "embedded PostgreSQL caller-owned transactions leaves neither child nor outbox row visible after the caller rolls back",
    "embedded PostgreSQL caller-owned transactions allows a rolled-back command identity to be reused and committed",
    "embedded PostgreSQL caller-owned transactions returns the committed result when another session replays exactly",
    "embedded PostgreSQL caller-owned transactions rejects conflicting command reuse without changing committed state",
  ],
  "system-tests/postgresql/replay.test.ts": [
    "command replay recovers all four canonical results across principals without duplicate history",
    "command replay replays a structurally equal command across principals despite object key order",
    "command replay recovers Resource definition after its committed response is lost",
    "command replay recovers root allocation after its committed response is lost",
    "command replay recovers an approved request after its committed response is lost",
    "command replay recovers settlement after its committed response is lost",
    "command replay rejects changed bodies for each mutation, including across principals",
    "command replay rejects reuse by a different operation",
    "command replay rejects reuse against a different target",
  ],
  "system-tests/postgresql/request-denial.test.ts": [
    "Budget request denial denies one unavailable Resource without changing the parent",
    "Budget request denial denies a multi-Resource envelope without reserving its fundable part",
    "Budget request denial conserves 100 sibling overlaps through public serialization, not multi-connection contention",
    "Budget request denial rejects malformed, duplicate, and caller-selected funding envelopes",
    "Budget request denial rejects a Resource type that has not been defined before evaluating funding",
    "Budget request denial rejects a request after its parent becomes inactive",
    "Budget request denial keeps request, settlement, and read permissions independent",
  ],
  "system-tests/postgresql/rollback.test.ts": [
    "command rollback rolls back Resource definition checkpoints",
    "command rollback rolls back root allocation facts, result, and history",
    "command rollback rolls back child reservation, result, and history",
    "command rollback rolls back usage, result, and settlement history",
  ],
  "system-tests/postgresql/settlement.test.ts": [
    "Budget settlement keeps a sealed parent settling until its open descendant settles",
    "Budget settlement resolves missing usage and records an exact known repeat as a no-op",
    "Budget settlement returns a reusable child allocation in full after settlement",
    "Budget settlement isolates child overage without charging its parent or sibling",
    "Budget settlement bounds settled nested charges before returning them to an ancestor",
    "Budget settlement settles a subset while keeping an omitted Resource unresolved",
    "Budget settlement sorts multiple isolated deficits by Resource identity",
    "Budget settlement rejects derived arithmetic overflow without committing settlement",
  ],
} as const;

export const REQUIRED_PROVIDER_FREE_SQLITE_SCENARIOS = {
  "system-tests/support/provider-free-sqlite.test.ts": [
    ...REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[
      "system-tests/postgresql/budget-lifecycle.test.ts"
    ],
    ...REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[
      "system-tests/postgresql/replay.test.ts"
    ],
    ...REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[
      "system-tests/postgresql/request-denial.test.ts"
    ],
    ...REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[
      "system-tests/postgresql/rollback.test.ts"
    ],
    ...REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[
      "system-tests/postgresql/settlement.test.ts"
    ],
  ],
} as const;
