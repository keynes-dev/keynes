export const POSTGRESQL_BUDGET_AGGREGATE =
  "packages/postgres/test/system/budget.test.ts";

export const REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS = {
  "packages/postgres/test/system/packed-walkthrough.test.ts": [
    "packed PostgreSQL walkthrough settles and reopens through the selected archives over verified TLS",
  ],
  "packages/postgres/test/system/cli-installation.test.ts": [
    "packed keynes installation CLI installs and rechecks an exact target without changing authority",
    "packed keynes installation CLI refuses a partial target without repair and emits sanitized errors",
    "packed keynes installation CLI refuses 'migration drift' without changing authority",
    "packed keynes installation CLI refuses 'profile mismatch' without changing authority",
  ],
  [POSTGRESQL_BUDGET_AGGREGATE]: [
    "direct runtime validation rejects malformed validateResources envelopes without state changes",
    "direct runtime validation rejects malformed defineResources envelopes without state changes",
    "direct runtime validation rejects malformed defineResource envelopes without state changes",
    "direct runtime validation rejects malformed createBudget envelopes without state changes",
    "direct runtime validation rejects malformed requestBudget envelopes without state changes",
    "direct runtime validation rejects malformed settleBudget envelopes without state changes",
    "direct runtime validation rejects malformed getBudget envelopes without state changes",
    "direct runtime validation rejects invalid names, quantities and evidence without changing existing authority",
    "command replay replays reordered definitions and amounts with the original result",
    "command replay rejects omitted explicit-zero membership under the same command identity",
    "command replay creates independent roots for new identities and replays the original result after settlement",
  ],
  "packages/postgres/test/integration/installation.test.ts": [
    "native PostgreSQL installation installs a fresh target atomically",
    "native PostgreSQL installation returns an exact no-op result without changing installed state",
    "native PostgreSQL installation serializes two installers racing on one empty target",
    "native PostgreSQL installation records one contract-bearing baseline migration",
    "native PostgreSQL installation moves Resource provenance to the defining command",
    "native PostgreSQL installation rejects an unsupported PostgreSQL version before mutation",
    "native PostgreSQL installation rejects an operator without installation privilege before mutation",
    "native PostgreSQL installation rejects missing prepared owner, execution, administration, and application roles",
    "native PostgreSQL installation rejects role login and database privilege contract violations",
    "native PostgreSQL installation rejects an application role with membership in any privileged role",
    "native PostgreSQL installation rejects an incompatible partial target without repairing it",
    "native PostgreSQL installation classifies two empty Keynes schemas as incompatible live state",
    "native PostgreSQL installation rejects a historical migration ledger without changing the target",
    "native PostgreSQL installation rejects a migration-byte mismatch without changing the target",
    "native PostgreSQL installation rejects a migration contract-digest mismatch",
    "native PostgreSQL installation rejects a contract mismatch without changing the target",
    "native PostgreSQL installation rolls back the baseline after an injected failure",
    "native PostgreSQL installation preserves installation and rollback failures together",
    "native PostgreSQL installation rejects a changed live function body during exact recheck",
    "native PostgreSQL installation rejects changed live function security properties",
    "native PostgreSQL installation rejects live object, permission, ownership, and ACL drift",
  ],
  "packages/postgres/test/integration/recheck.test.ts": [
    "PostgreSQL exact recheck and application-role permissions rechecks the exact baseline read-only",
    "PostgreSQL exact recheck and application-role permissions rejects an identity missing a required column before reading it",
    "PostgreSQL exact recheck and application-role permissions rejects a profile-mismatched target without changing it",
    "PostgreSQL exact recheck and application-role permissions grants configured creation wrappers only to the runtime role",
    "PostgreSQL exact recheck and application-role permissions rejects a missing definition receipt reference during exact recheck",
    "PostgreSQL exact recheck and application-role permissions rejects a missing unique definition receipt index during exact recheck",
    "PostgreSQL exact recheck and application-role permissions checks the server, checksums, contract, and complete object inventory",
    "PostgreSQL exact recheck and application-role permissions rejects an otherwise exact target that lacks the baseline ledger row",
    "PostgreSQL exact recheck and application-role permissions checks owners, bodies, languages, security, and fixed search paths",
    "PostgreSQL exact recheck and application-role permissions checks bootstrap permissions and schema and function ACLs",
    "PostgreSQL exact recheck and application-role permissions allows the application role to call exactly the ten remote functions",
    "PostgreSQL exact recheck and application-role permissions denies private and unsupported function access without changing state",
  ],
  "packages/postgres/test/system/installation.test.ts": [
    "PostgreSQL installation installs explicit principal permission records",
    "PostgreSQL installation installs a nullable unique private definition receipt reference",
    "PostgreSQL installation installs one baseline and rechecks it without changes",
    "PostgreSQL installation installs the reduced identity and leaves its exact reinstall read-only",
    "PostgreSQL installation rejects a contract digest mismatch before installation",
    "PostgreSQL installation rejects migration byte drift before applying it",
    "PostgreSQL installation rejects an installed-object mismatch after fresh migration",
    "PostgreSQL installation rolls back '0001-baseline' atomically when its final statement fails",
  ],
  "packages/postgres/test/system/contention.test.ts": [
    "native PostgreSQL contention replays an exact configured root with explicit zero membership after waiting for commit",
    "native PostgreSQL contention rejects a conflicting configured root after waiting for commit without duplicate allowances",

    "native PostgreSQL contention orders opposite-input batch overlap with conflict=false",
    "native PostgreSQL contention orders opposite-input batch overlap with conflict=true",
    "native PostgreSQL contention preserves original Resource evidence when a batch waits behind singleton",
    "native PostgreSQL contention preserves original Resource evidence when a batch waits behind raw creation",
    "native PostgreSQL contention replays one definition receipt when same-command contenders wait for commit",
    "native PostgreSQL contention funds at most one sibling after proving the second request waits",
    "native PostgreSQL contention rejects a request that waits behind a committed settlement seal",
    "native PostgreSQL contention orders a waiting settlement after the committed request",
    "native PostgreSQL contention returns the stored result when a matching command waits for commit",
    "native PostgreSQL contention replays matching evidence and rejects changed evidence when contenders wait",
    "native PostgreSQL contention creates concurrent configured roots on one catalog Resource",
    "native PostgreSQL contention returns root Resources in canonical name order despite opposite standalone UUID order",
  ],
  "packages/postgres/test/system/embedded-transactions.test.ts": [
    "public borrowed PostgreSQL adapter uses the supplied Client in session-context autocommit without owning its lifecycle",
    "public borrowed PostgreSQL adapter uses the supplied PoolClient in session-context autocommit without owning its lifecycle",
    "public borrowed PostgreSQL adapter keeps public Budget handles and application outbox provisional until caller commit",
    "public borrowed PostgreSQL adapter keeps public Budget handles and application outbox provisional until caller rollback",
    "public borrowed PostgreSQL adapter leaves public Budget rollback and failed application writes to the caller without retry",
    "public borrowed PostgreSQL adapter refuses missing caller context without repairing it or closing the connection",
    "public borrowed PostgreSQL adapter refuses wrong tenant caller context without repairing it or closing the connection",
    "public borrowed PostgreSQL adapter refuses wrong principal caller context without repairing it or closing the connection",
    "public borrowed PostgreSQL adapter drains admitted public work on close and rejects late calls without closing the connection",
    "embedded PostgreSQL caller-owned transactions keeps catalog provisioning, consumption, and application work inside caller commit",
    "embedded PostgreSQL caller-owned transactions keeps catalog provisioning, consumption, and application work inside caller rollback",
    "embedded PostgreSQL caller-owned transactions propagates Resource serialization failure to the caller and rolls back application work",
    "embedded PostgreSQL caller-owned transactions commits an approved request and application outbox row together",
    "embedded PostgreSQL caller-owned transactions leaves neither Budget state nor outbox state after explicit rollback",
    "embedded PostgreSQL caller-owned transactions rolls back Keynes when the application write fails after approval",
    "embedded PostgreSQL caller-owned transactions commits a denial without creating application work",
    "embedded PostgreSQL caller-owned transactions returns invalid_command for malformed input without opening application work",
    "embedded PostgreSQL caller-owned transactions uses the caller-owned transaction lifecycle",
    "embedded PostgreSQL caller-owned transactions rolls back a configured root with caller-owned application work",
    "embedded PostgreSQL caller-owned transactions runs a customer SQL decision and ordinary request in one caller rollback",
    "embedded PostgreSQL caller-owned transactions preserves the original definition provenance for later definition",
    "embedded PostgreSQL caller-owned transactions keeps a pending child and outbox row invisible to another session",
    "embedded PostgreSQL caller-owned transactions makes the child and outbox row visible after the caller commits",
    "embedded PostgreSQL caller-owned transactions leaves neither child nor outbox row visible after the caller rolls back",
    "embedded PostgreSQL caller-owned transactions rolls back approved evidence, history, and caller outbox together",
    "embedded PostgreSQL caller-owned transactions allows a rolled-back command identity to be reused and committed",
    "embedded PostgreSQL caller-owned transactions returns the committed result when another session replays exactly",
    "embedded PostgreSQL caller-owned transactions rejects conflicting command reuse without changing committed state",
  ],
  "packages/postgres/test/integration/remote-identity.test.ts": [
    "remote PostgreSQL installation and administration installs and rechecks the complete remote procedure contract without changing state",
    "remote PostgreSQL installation and administration reports generation-four compatibility and grants configured validation and recovery only to the runtime role",
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
  "packages/postgres/test/system/remote-connections.test.ts": [
    "remote PostgreSQL connection profiles derives the same identity through the direct profile",
    "remote PostgreSQL connection profiles derives the same identity through the session-pool profile",
    "remote PostgreSQL connection profiles derives the same identity through the transaction-pool profile",
    "remote PostgreSQL connection profiles proves the runner routes through the requested PgBouncer modes",
    "remote PostgreSQL connection profiles clears transaction-local identity after a direct call",
    "remote PostgreSQL connection profiles clears transaction-local identity after a session-pool call",
    "remote PostgreSQL connection profiles clears transaction-local identity after a transaction-pool call",
    "remote PostgreSQL connection profiles rejects the native TLS endpoint without its trusted root",
    "remote PostgreSQL connection profiles rejects the plaintext session-pool endpoint when verified TLS is required",
    "remote PostgreSQL connection profiles rejects the plaintext transaction-pool endpoint when verified TLS is required",
    "remote PostgreSQL connection profiles fails closed when the database is unavailable",
  ],
  "packages/postgres/test/system/remote-budget.test.ts": [
    "public owned PostgreSQL adapter executes the public lifecycle over verified TLS and closes its owned pool",
    "public owned PostgreSQL adapter projects all public history kinds without internal identity fields",
    "public owned PostgreSQL adapter reopens with read permission after creation permission is revoked",
    "remote PostgreSQL Budget authority creates from declarations after producer close using another same-tenant creation-only principal",
    "remote PostgreSQL Budget authority accepts mixed-zero and all-zero Remote roots without changing catalog definitions",
    "remote PostgreSQL Budget authority requires current definition permission for exact Remote replay and fresh commands",
    "remote PostgreSQL Budget authority defines Resources through authenticated Remote calls with exact reuse and replay",
    "remote PostgreSQL Budget authority rejects malformed Remote definition batches without partial authority state",
    "remote PostgreSQL Budget authority completes one remote create, request, inspect, and settlement loop",
  ],
  "packages/postgres/test/system/remote-recovery.test.ts": [
    "remote PostgreSQL recovery and bounded reads recovers a lost configured creation only after current authorization and selected-definition validation",

    "remote PostgreSQL recovery and bounded reads recovers a lost definition response and retains its receipt after ledger expiry",
    "remote PostgreSQL recovery and bounded reads keeps failed definitions as known failures without a successful receipt",
    "remote PostgreSQL recovery and bounded reads reports semantic compatibility before any mutation",
    "remote PostgreSQL recovery and bounded reads recovers a committed response without adding a command or history entry",
    "remote PostgreSQL recovery and bounded reads replays request evidence and conflicts when its caller decision changes",
    "remote PostgreSQL recovery and bounded reads recovers a committed mutation after its transport response is lost",
    "remote PostgreSQL recovery and bounded reads returns known-failure and expired recovery states without mutation",
    "remote PostgreSQL recovery and bounded reads reports an in-flight mutation as unresolved without changing authority state",
    "remote PostgreSQL recovery and bounded reads converges concurrent exact retries on one committed mutation",
    "remote PostgreSQL recovery and bounded reads reopens a Budget only for the mapped tenant and exact Resource binding",
    "remote PostgreSQL recovery and bounded reads paginates one bounded history snapshot with expiring single-use cursors",
  ],
  "packages/postgres/test/system/remote-security.test.ts": [
    "remote PostgreSQL identity and security validates configured declarations with creation permission and no authority writes",
    "remote PostgreSQL identity and security validates configured catalogs under mapped identity without foreign disclosure",
    "remote PostgreSQL identity and security rejects configured catalog validation without creation permission before reading declarations",
    "remote PostgreSQL identity and security grants configured validation only through the authenticated runtime wrapper",
    "remote PostgreSQL identity and security rejects foreign tenant and unknown configured catalogs with the same private-safe error",
    "remote PostgreSQL identity and security creates against the current installation catalog without importing another installation's Resource identity",
    "remote PostgreSQL identity and security derives tenant and principal from the authenticated role on every call",
    "remote PostgreSQL identity and security scopes overlapping Resource names and operation keys to each authenticated tenant",
    "remote PostgreSQL identity and security checks current request permission before replaying caller evidence",
    "remote PostgreSQL identity and security checks enabled mappings again on an already-open session",
    "remote PostgreSQL identity and security validates the exact input shape of all ten wrappers before mutation",
    "remote PostgreSQL identity and security returns authorization-safe errors before validating an unmapped caller",
    "remote PostgreSQL identity and security rejects a recreated login until an operator explicitly registers the stale name and new OID",
    "remote PostgreSQL identity and security rotates mappings atomically and disables the old pooled credential",
    "remote PostgreSQL identity and security revokes an existing session and records no reusable credential",
    "remote PostgreSQL identity and security keeps a revoked credential terminal when registration is retried",
    "remote PostgreSQL identity and security denies private objects, canonical procedures, role assumption, and public SQL creation",
    "remote PostgreSQL identity and security pins every security-definer search path to trusted schemas with pg_temp last",
  ],
  "packages/postgres/test/system/rollback.test.ts": [
    "PostgreSQL configured root authorization and rollback rolls back an injected partial configured creation without changing unrelated state",

    "PostgreSQL configured root authorization and rollback removes failed definition receipts and configured-root effects while retaining catalog definitions",
    "PostgreSQL configured root authorization and rollback requires a configured catalog and root-allocation permission",
    "PostgreSQL configured root authorization and rollback rolls back a configured root at its private checkpoint",
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
    "packages/postgres/test/integration/installation.test.ts",
    "packages/postgres/test/integration/recheck.test.ts",
    "packages/postgres/test/integration/remote-identity.test.ts",
    "packages/postgres/test/system/remote-budget.test.ts",
    "packages/postgres/test/system/remote-recovery.test.ts",
    "packages/postgres/test/system/remote-security.test.ts",
  ] as const;
  const connectionFile =
    "packages/postgres/test/system/remote-connections.test.ts";
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
    [POSTGRESQL_BUDGET_AGGREGATE]:
      REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[POSTGRESQL_BUDGET_AGGREGATE],
    ...Object.fromEntries(
      files.map((file) => [file, REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[file]]),
    ),
    [connectionFile]: connections,
  };
}

export interface EmbeddedSelection {
  readonly kind: "embedded";
}
export type NativeSelection =
  | RemoteSelection
  | EmbeddedSelection
  | { readonly kind: "ci" };
export function selectedScenarioInventory(
  selection: NativeSelection,
): Readonly<Record<string, readonly string[]>> {
  if (selection.kind === "ci") {
    return {
      ...Object.fromEntries(
        Object.entries(REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS).filter(
          ([file]) =>
            file !== "packages/postgres/test/system/cli-installation.test.ts" &&
            file !== "packages/postgres/test/system/packed-walkthrough.test.ts",
        ),
      ),
      ...remoteScenarioInventory({ kind: "remote", modes: ["direct"] }),
    };
  }
  return selection.kind === "remote"
    ? remoteScenarioInventory(selection)
    : {
        [POSTGRESQL_BUDGET_AGGREGATE]:
          REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[POSTGRESQL_BUDGET_AGGREGATE],
        "packages/postgres/test/system/embedded-transactions.test.ts":
          REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS[
            "packages/postgres/test/system/embedded-transactions.test.ts"
          ],
      };
}

export function validateNativeSelection(value: unknown): NativeSelection {
  if (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value.kind === "embedded" || value.kind === "ci") &&
    !("modes" in value) &&
    !("installed" in value)
  )
    return { kind: value.kind };
  return validateRemoteSelection(value);
}
