export const POSTGRESQL_BUDGET_AGGREGATE =
  "packages/postgresql/test/system/budget.test.ts";

export const REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS = {
  "packages/postgresql/test/integration/installation.test.ts": [
    "native PostgreSQL installation installs a fresh target atomically",
    "native PostgreSQL installation returns an exact no-op result without changing installed state",
    "native PostgreSQL installation installs the additive Resource-bound Budget and remote access migrations",
    "native PostgreSQL installation moves Resource provenance to the defining command",
    "native PostgreSQL installation rejects an unsupported PostgreSQL version before mutation",
    "native PostgreSQL installation rejects an operator without installation privilege before mutation",
    "native PostgreSQL installation rejects missing prepared owner, execution, administration, and application roles",
    "native PostgreSQL installation rejects role login and database privilege contract violations",
    "native PostgreSQL installation rejects an application role with membership in any privileged role",
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
  "packages/postgresql/test/integration/recheck.test.ts": [
    "PostgreSQL exact recheck and application-role permissions rechecks the exact graph read-only",
    "PostgreSQL exact recheck and application-role permissions grants the definition wrapper only to the runtime role",
    "PostgreSQL exact recheck and application-role permissions rejects a missing definition receipt reference during exact recheck",
    "PostgreSQL exact recheck and application-role permissions rejects a missing unique definition receipt index during exact recheck",
    "PostgreSQL exact recheck and application-role permissions checks the server, checksums, contract, and complete object inventory",
    "PostgreSQL exact recheck and application-role permissions rejects an otherwise exact target that lacks the final migration",
    "PostgreSQL exact recheck and application-role permissions checks owners, bodies, languages, security, and fixed search paths",
    "PostgreSQL exact recheck and application-role permissions checks bootstrap permissions and schema and function ACLs",
    "PostgreSQL exact recheck and application-role permissions allows the application role to call exactly the nine remote functions",
    "PostgreSQL exact recheck and application-role permissions denies private and unsupported function access without changing state",
  ],
  "packages/postgresql/test/system/installation.test.ts": [
    "PostgreSQL installation installs explicit principal permission records",
    "PostgreSQL installation installs a nullable unique private definition receipt reference",
    "PostgreSQL installation installs the current graph and rechecks it without changes",
    "PostgreSQL installation rejects a contract digest mismatch before installation",
    "PostgreSQL installation rejects migration byte drift before applying it",
    "PostgreSQL installation rejects an installed-object mismatch after fresh migration",
    "PostgreSQL installation rolls back '0001-storage' atomically when its final statement fails",
    "PostgreSQL installation rolls back '0002-budget' atomically when its final statement fails",
    "PostgreSQL installation rolls back '0003-public' atomically when its final statement fails",
    "PostgreSQL installation rolls back '0004-policy' atomically when its final statement fails",
    "PostgreSQL installation rolls back '0005-resource-bound-budget' atomically when its final statement fails",
    "PostgreSQL installation rolls back '0006-remote-access' atomically when its final statement fails",
    "PostgreSQL installation rolls back '0007-resource-definitions' atomically when its final statement fails",
  ],
  "packages/postgresql/test/system/contention.test.ts": [
    "native PostgreSQL contention orders opposite-input batch overlap with conflict=false",
    "native PostgreSQL contention orders opposite-input batch overlap with conflict=true",
    "native PostgreSQL contention preserves original Resource evidence when a batch waits behind singleton",
    "native PostgreSQL contention preserves original Resource evidence when a batch waits behind raw creation",
    "native PostgreSQL contention replays one definition receipt when same-command contenders wait for commit",
    "native PostgreSQL contention funds at most one sibling after proving the second request waits",
    "native PostgreSQL contention rejects a request that waits behind a committed settlement seal",
    "native PostgreSQL contention orders a waiting settlement after the committed request",
    "native PostgreSQL contention returns the stored result when a matching command waits for commit",
    "native PostgreSQL contention converges concurrent absent-name roots on one Resource",
    "native PostgreSQL contention returns root Resources in canonical name order despite opposite standalone UUID order",
  ],
  "packages/postgresql/test/system/embedded-transactions.test.ts": [
    "embedded PostgreSQL caller-owned transactions keeps definition binding, consumption, and application work inside caller commit",
    "embedded PostgreSQL caller-owned transactions keeps definition binding, consumption, and application work inside caller rollback",
    "embedded PostgreSQL caller-owned transactions propagates Resource serialization failure to the caller and rolls back application work",
    "embedded PostgreSQL caller-owned transactions commits an approved request and application outbox row together",
    "embedded PostgreSQL caller-owned transactions leaves neither Budget state nor outbox state after explicit rollback",
    "embedded PostgreSQL caller-owned transactions rolls back Keynes when the application write fails after approval",
    "embedded PostgreSQL caller-owned transactions commits a denial without creating application work",
    "embedded PostgreSQL caller-owned transactions returns invalid_command for malformed input without opening application work",
    "embedded PostgreSQL caller-owned transactions uses the caller-owned transaction lifecycle",
    "embedded PostgreSQL caller-owned transactions rolls back a Resource-bound root with caller-owned application work",
    "embedded PostgreSQL caller-owned transactions preserves the original definition provenance for later definition",
    "embedded PostgreSQL caller-owned transactions keeps a pending child and outbox row invisible to another session",
    "embedded PostgreSQL caller-owned transactions makes the child and outbox row visible after the caller commits",
    "embedded PostgreSQL caller-owned transactions leaves neither child nor outbox row visible after the caller rolls back",
    "embedded PostgreSQL caller-owned transactions allows a rolled-back command identity to be reused and committed",
    "embedded PostgreSQL caller-owned transactions returns the committed result when another session replays exactly",
    "embedded PostgreSQL caller-owned transactions rejects conflicting command reuse without changing committed state",
  ],
  "packages/postgresql/test/integration/remote-identity.test.ts": [
    "remote PostgreSQL installation and administration installs and rechecks the complete remote procedure contract without changing state",
    "remote PostgreSQL installation and administration gives the runtime role only remote procedures and no private authority",
    "remote PostgreSQL installation and administration keeps owner, execution, administration, and runtime roles distinct",
    "remote PostgreSQL installation and administration records OID and name mappings without credential secrets",
    "remote PostgreSQL installation and administration lets the private administration role manage metadata but not run Budget calls",
    "remote PostgreSQL installation and administration exposes bounded credential audit without table access",
    "remote PostgreSQL installation and administration rejects 'INHERIT' candidates for registration and rotation",
    "remote PostgreSQL installation and administration rejects 'ownerRole membership' candidates for registration and rotation",
    "remote PostgreSQL installation and administration rejects 'executionRole membership' candidates for registration and rotation",
    "remote PostgreSQL installation and administration rejects 'administrationRole membership' candidates for registration and rotation",
    "remote PostgreSQL installation and administration rejects registration over a mapping occupied by another identity",
    "remote PostgreSQL installation and administration rejects rotation onto an occupied mapped role",
    "remote PostgreSQL installation and administration makes remote privilege and schema CREATE drift fail exact recheck",
    "remote PostgreSQL installation and administration rejects unsafe enabled mappings during exact recheck",
  ],
  "packages/postgresql/test/system/remote-connections.test.ts": [
    "remote PostgreSQL connection profiles derives the same identity through the direct profile",
    "remote PostgreSQL connection profiles derives the same identity through the session-pool profile",
    "remote PostgreSQL connection profiles derives the same identity through the transaction-pool profile",
    "remote PostgreSQL connection profiles proves the runner routes through the requested PgBouncer modes",
    "remote PostgreSQL connection profiles clears transaction-local identity after a direct call",
    "remote PostgreSQL connection profiles clears transaction-local identity after a session-pool call",
    "remote PostgreSQL connection profiles clears transaction-local identity after a transaction-pool call",
    "remote PostgreSQL connection profiles rejects the native plaintext endpoint when verified TLS is required",
    "remote PostgreSQL connection profiles fails closed when the database is unavailable",
  ],
  "packages/postgresql/test/system/remote-budget.test.ts": [
    "remote PostgreSQL Budget authority creates from a binding after producer close using another same-tenant creation-only principal",
    "remote PostgreSQL Budget authority retains the KEY-78 Remote zero-allocation refusal for binding creation",
    "remote PostgreSQL Budget authority requires current definition permission for exact Remote replay and fresh commands",
    "remote PostgreSQL Budget authority defines Resources through authenticated Remote calls with exact reuse and replay",
    "remote PostgreSQL Budget authority rejects malformed Remote definition batches without partial authority state",
    "remote PostgreSQL Budget authority completes one remote create, request, inspect, and settlement loop",
    "remote PostgreSQL Budget authority enforces a generated Policy through canonical remote Resources",
  ],
  "packages/postgresql/test/system/remote-recovery.test.ts": [
    "remote PostgreSQL recovery and bounded reads recovers a lost definition response and retains its receipt after ledger expiry",
    "remote PostgreSQL recovery and bounded reads keeps failed definitions as known failures without a successful receipt",
    "remote PostgreSQL recovery and bounded reads reports semantic compatibility before any mutation",
    "remote PostgreSQL recovery and bounded reads recovers a committed response without adding a command or history entry",
    "remote PostgreSQL recovery and bounded reads recovers a committed mutation after its transport response is lost",
    "remote PostgreSQL recovery and bounded reads returns known-failure and expired recovery states without mutation",
    "remote PostgreSQL recovery and bounded reads reports an in-flight mutation as unresolved without changing authority state",
    "remote PostgreSQL recovery and bounded reads converges concurrent exact retries on one committed mutation",
    "remote PostgreSQL recovery and bounded reads reopens a Budget only for the mapped tenant and exact Resource binding",
    "remote PostgreSQL recovery and bounded reads paginates one bounded history snapshot with expiring single-use cursors",
  ],
  "packages/postgresql/test/system/remote-security.test.ts": [
    "remote PostgreSQL identity and security rejects foreign tenant and unknown bindings with the same private-safe error",
    "remote PostgreSQL identity and security rejects a binding from another installation despite matching tenant and Resource names",
    "remote PostgreSQL identity and security derives tenant and principal from the authenticated role on every call",
    "remote PostgreSQL identity and security scopes overlapping Resource names and operation keys to each authenticated tenant",
    "remote PostgreSQL identity and security checks enabled mappings again on an already-open session",
    "remote PostgreSQL identity and security validates the exact input shape of all nine wrappers before mutation",
    "remote PostgreSQL identity and security returns authorization-safe errors before validating an unmapped caller",
    "remote PostgreSQL identity and security rejects a recreated login until an operator explicitly registers the stale name and new OID",
    "remote PostgreSQL identity and security rotates mappings atomically and disables the old pooled credential",
    "remote PostgreSQL identity and security revokes an existing session and records no reusable credential",
    "remote PostgreSQL identity and security keeps a revoked credential terminal when registration is retried",
    "remote PostgreSQL identity and security denies private objects, canonical procedures, role assumption, and public SQL creation",
  ],
  "packages/postgresql/test/system/policy-request.test.ts": [
    "PostgreSQL governed Policy requests approves within the Policy ceiling and records canonical evidence",
    "PostgreSQL governed Policy requests denies above the Policy ceiling without reserving or creating a child",
    "PostgreSQL governed Policy requests evaluates requested, availability, and Context through the installed request path",
    "PostgreSQL governed Policy requests uses available Resources when they are the Policy ceiling",
    "PostgreSQL governed Policy requests enforces Policies for a contract-valid non-RFC request command UUID",
    "PostgreSQL governed Policy requests preserves root Policies created with a contract-valid non-RFC UUID",
    "PostgreSQL governed Policy requests attaches only the explicit child Policy set and evaluates it on the next request",
    "PostgreSQL governed Policy requests rejects a root Policy declaration outside the receiving Budget holdings",
    "PostgreSQL governed Policy requests rejects a child Policy declaration outside the receiving child holdings",
    "PostgreSQL governed Policy requests approves an ungoverned parent request with child Policies without parent Policy evidence",
    "PostgreSQL governed Policy requests preserves exact no-Policy request bytes and canonical root history",
    "PostgreSQL governed Policy requests orders effective ceilings and tied reasons by canonical text, not Resource UUID",
    "PostgreSQL governed Policy requests keeps governed state pending until the caller commits",
    "PostgreSQL governed Policy requests rolls back governed evidence, reservation, child, history, and command identity",
    "PostgreSQL governed Policy requests locks an unrequested declared availability holding in Resource UUID order",
  ],
  "packages/postgresql/test/system/policy-runtime.test.ts": [
    "PostgreSQL Policy runtime behavior executes every shared runtime test program through the installed renderer",
    "PostgreSQL Policy runtime behavior keeps nested boolean rendering linear",
  ],
  "packages/postgresql/test/system/policy-replay.test.ts": [
    "PostgreSQL governed Policy replay returns the exact stored result, evidence, and Context",
    "PostgreSQL governed Policy replay ignores changed availability, an external fact, and an unrelated Policy revision",
    "PostgreSQL governed Policy replay rejects command identity reuse with changed Context without changing state",
    "PostgreSQL governed Policy replay rejects command identity reuse with changed child Policies without changing state",
    "PostgreSQL governed Policy replay returns before reading the parent Policy snapshot or invoking the evaluator",
  ],
  "packages/postgresql/test/system/policy-security.test.ts": [
    "PostgreSQL Policy security rejects a malformed durable program with a sanitized invalid_policy error and no state",
    "PostgreSQL Policy security rejects a direct durable aggregate in the first CASE condition",
    "PostgreSQL Policy security rejects a direct durable aggregate in the later CASE condition",
    "PostgreSQL Policy security rejects a direct durable aggregate in the first CASE result",
    "PostgreSQL Policy security rejects a direct durable aggregate in the later CASE result",
    "PostgreSQL Policy security rejects a direct durable aggregate in the CASE else result",
    "PostgreSQL Policy security rejects a direct durable aggregate in the nested second coalesce argument",
    "PostgreSQL Policy security rejects a direct durable aggregate in the nested later coalesce argument",
    "PostgreSQL Policy security accepts a direct durable aggregate in first coalesce argument",
    "PostgreSQL Policy security accepts a direct durable aggregate in least",
    "PostgreSQL Policy security accepts a direct durable aggregate in greatest",
    "PostgreSQL Policy security rejects canonical SQL that does not match the durable program without executing it",
    "PostgreSQL Policy security rejects a noncanonical Policy name before mutation",
    "PostgreSQL Policy security rejects an invalid Policy revision before mutation",
    "PostgreSQL Policy security rejects a noncanonical Policy reason before mutation",
    "PostgreSQL Policy security rejects duplicate Policy names before mutation",
    "PostgreSQL Policy security rejects Policy output Resources outside its declared input Resources",
    "PostgreSQL Policy security rejects a context reference outside the Policy contextSchema",
    "PostgreSQL Policy security rejects a Policy canonical source over the per-Policy byte limit",
    "PostgreSQL Policy security rejects a Policy set over the aggregate canonical source byte limit",
    "PostgreSQL Policy security filters requested and available rows to each Policy input declaration",
    "PostgreSQL Policy security rejects duplicate result Resources as invalid_result",
    "PostgreSQL Policy security pins every security-definer search path to trusted schemas with pg_temp last",
    "PostgreSQL Policy security prevents the application role from reading or invoking private Policy authority",
    "PostgreSQL Policy security rejects an emitted requested input Resource outside outputResources",
    "PostgreSQL Policy security maps generated-query failure to stable sanitized details and rolls back",
    "PostgreSQL Policy security maps generated numeric overflow to arithmetic_overflow and rolls back",
    "PostgreSQL Policy security maps aggregate transition overflow to arithmetic_overflow and rolls back",
    "PostgreSQL Policy security rejects noncanonical decimal literal precision before evaluation",
    "PostgreSQL Policy security rejects a contextSchema member with non-object",
    "PostgreSQL Policy security rejects a contextSchema member with array",
    "PostgreSQL Policy security rejects a contextSchema member with extra key",
    "PostgreSQL Policy security rejects a contextSchema member with invalid name",
    "PostgreSQL Policy security rejects a contextSchema member with invalid type",
    "PostgreSQL Policy security rejects a contextSchema member with invalid nullability",
    "PostgreSQL Policy security rejects a contextSchema member with duplicate name",
    "PostgreSQL Policy security accepts contextSchema names in canonical C byte order",
    "PostgreSQL Policy security returns invalid_command for malformed createBudget identifiers",
    "PostgreSQL Policy security returns invalid_command for malformed requestBudget identifiers",
    "PostgreSQL Policy security rejects negative integer Policy context before evaluation and rolls back",
    "PostgreSQL Policy security rolls back the complete governed command at after_command_binding",
    "PostgreSQL Policy security rolls back the complete governed command at before_policy_evaluation",
    "PostgreSQL Policy security rolls back the complete governed command at after_policy_evaluation",
    "PostgreSQL Policy security rolls back the complete governed command at after_policy_evidence",
    "PostgreSQL Policy security rolls back the complete governed command at after_domain_mutation",
    "PostgreSQL Policy security rolls back the complete governed command at after_history_insertion",
    "PostgreSQL Policy security rolls back the complete governed command at after_result_storage",
  ],
  "packages/postgresql/test/system/rollback.test.ts": [
    "PostgreSQL Resource-bound root authorization and rollback removes failed definition receipts and bound-root effects while retaining older bindings",
    "PostgreSQL Resource-bound root authorization and rollback requires definition then root-allocation permission",
    "PostgreSQL Resource-bound root authorization and rollback rolls back an inserted Resource at its private checkpoint",
    "PostgreSQL Resource-bound root authorization and rollback rejects a malformed root projection without committing authority state",
  ],
} as const;

export const REMOTE_MODES = [
  "direct",
  "session-pool",
  "transaction-pool",
] as const;
export type RemoteMode = (typeof REMOTE_MODES)[number];
export interface RemoteSelection {
  readonly kind: "remote";
  readonly modes: readonly RemoteMode[];
}

export function validateRemoteSelection(value: unknown): RemoteSelection {
  if (
    typeof value !== "object" ||
    value === null ||
    !("kind" in value) ||
    value.kind !== "remote" ||
    !("modes" in value) ||
    !Array.isArray(value.modes) ||
    value.modes.length === 0 ||
    new Set(value.modes).size !== value.modes.length ||
    !value.modes.every((mode: unknown) =>
      REMOTE_MODES.some((known) => known === mode),
    )
  )
    throw new Error("Invalid remote selection");
  const modes = value.modes;
  return {
    kind: "remote",
    modes: REMOTE_MODES.filter((mode) => modes.includes(mode)),
  };
}

export function remoteScenarioInventory(
  selection: RemoteSelection,
): Readonly<Record<string, readonly string[]>> {
  const { modes } = validateRemoteSelection(selection);
  const files = [
    "packages/postgresql/test/integration/installation.test.ts",
    "packages/postgresql/test/integration/recheck.test.ts",
    "packages/postgresql/test/integration/remote-identity.test.ts",
    "packages/postgresql/test/system/remote-budget.test.ts",
    "packages/postgresql/test/system/remote-recovery.test.ts",
    "packages/postgresql/test/system/remote-security.test.ts",
  ] as const;
  const connectionFile =
    "packages/postgresql/test/system/remote-connections.test.ts";
  const connections: string[] = REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[
    connectionFile
  ].filter((name) => {
    if (
      name.endsWith(
        "proves the runner routes through the requested PgBouncer modes",
      )
    )
      return modes.length === 3;
    return REMOTE_MODES.every(
      (mode) => !name.includes(` ${mode} `) || modes.includes(mode),
    );
  });
  if (modes.length !== 3)
    for (const mode of modes)
      if (mode !== "direct")
        connections.push(
          `remote PostgreSQL connection profiles proves the runner routes through the ${mode} mode`,
        );
  return {
    [POSTGRESQL_BUDGET_AGGREGATE]: [],
    ...Object.fromEntries(
      files.map((file) => [file, REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[file]]),
    ),
    [connectionFile]: connections,
  };
}

export interface EmbeddedSelection {
  readonly kind: "embedded";
}
export type NativeSelection = RemoteSelection | EmbeddedSelection;
export function selectedScenarioInventory(
  selection: NativeSelection,
): Readonly<Record<string, readonly string[]>> {
  return selection.kind === "remote"
    ? remoteScenarioInventory(selection)
    : {
        [POSTGRESQL_BUDGET_AGGREGATE]: [],
        "packages/postgresql/test/system/embedded-transactions.test.ts":
          REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[
            "packages/postgresql/test/system/embedded-transactions.test.ts"
          ],
      };
}

export function validateNativeSelection(value: unknown): NativeSelection {
  if (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "embedded" &&
    !("modes" in value) &&
    !("installed" in value)
  )
    return { kind: "embedded" };
  return validateRemoteSelection(value);
}
