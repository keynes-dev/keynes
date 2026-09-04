# Keynes API contract

This document defines the five public operations for KEY-43. The generated TypeScript client is the caller API. Each method validates input, invokes exactly one installed `keynes.*(jsonb) -> jsonb` function, validates its output, returns a valid domain result, or throws a generated `KeynesError` for an expected error. Unexpected database or process failures have an unknown outcome until command replay resolves them.

The procedure caller, PGlite handle, transaction, tenant, and principal are package-private host concerns. They are not command fields and are not exported from the SDK entry point.

## Generated caller shape

```ts
interface KeynesClient {
  defineResource(
    input: DefineResourceTypeCommand,
  ): Promise<DefineResourceTypeResult>;
  createBudget(input: CreateBudgetCommand): Promise<CreateBudgetResult>;
  requestBudget(input: RequestBudgetCommand): Promise<RequestBudgetResult>;
  settleBudget(input: SettleBudgetCommand): Promise<SettleBudgetResult>;
  getBudget(input: GetBudgetQuery): Promise<GetBudgetResult>;
}
```

The concrete five-method implementation, types, validators, procedure names, and error mappings are generated. Caller input amounts remain ordinary `number` values and are checked at runtime. Validated identifiers may be branded in generated return types only when generated constructors provide the caller path.

## Ordered operations

| Method           | Installed target              | Permission             | Replay   | Evidence                                                   |
| ---------------- | ----------------------------- | ---------------------- | -------- | ---------------------------------------------------------- |
| `defineResource` | `keynes.define_resource_type` | `define_resource_type` | Required | Definition evidence in stored result                       |
| `createBudget`   | `keynes.create_budget`        | `create_root_budget`   | Required | One root-lineage history entry                             |
| `requestBudget`  | `keynes.request`              | `request_budget`       | Required | One approval or denial history entry                       |
| `settleBudget`   | `keynes.settle`               | `settle_budget`        | Required | One settlement history entry, including exact no-op repeat |
| `getBudget`      | `keynes.get_budget`           | `read_budget`          | N/A      | Reads one Budget and its complete root-lineage history     |

The five permissions are independent. Provider-free fixtures prove both directions for request and settlement. Permission to request does not permit settlement, and permission to settle does not permit requests.

## Shared values

```ts
type AccountingBehavior = "consumable" | "reusable";
type BudgetLifecycle = "active" | "settling" | "settled";

interface ResourceAmount {
  resourceTypeId: string; // canonical lowercase UUID
  amount: number; // safe non-negative integer
}

interface UsageAmount {
  resourceTypeId: string;
  amount: number | null; // null means unresolved, never zero
}
```

Resource envelopes are non-empty and unique by `resourceTypeId`. The database sorts them by `resourceTypeId` before comparison, digesting, results, reasons, and evidence. All objects reject unknown fields.

## Mutating operations

### `defineResource`

```ts
interface DefineResourceTypeCommand {
  commandId: string;
  definition: {
    canonicalName: string;
    unit: string;
    accountingBehavior: AccountingBehavior;
  };
}

interface DefineResourceTypeResult {
  kind: "defined";
  resourceType: ResourceTypeProjection;
  definitionEvidence: {
    kind: "resource_type_defined";
    commandId: string;
    principalId: string;
    definitionDigest: string;
  };
  replayed: boolean;
}
```

The first definition creates an immutable Resource type and no quantity. A later command with a different command ID and the exact canonical definition returns the same Resource type and original definition evidence with `replayed: false`; it creates no new public history family. A changed definition under the same canonical name throws `resource_type_conflict`. An exact retry of the same command returns the stored result with `replayed: true` at the SDK mapping layer.

Definition evidence lives in the definition result and replay ledger. Budget history contains only Budget-lineage evidence, so KEY-43 creates no unreachable Resource history stream.

### `createBudget`

```ts
interface CreateBudgetCommand {
  commandId: string;
  resources: ResourceAmount[];
}

interface CreateBudgetResult {
  kind: "created";
  budget: BudgetProjection;
  replayed: boolean;
}
```

The command ID becomes the root Budget ID. Every Resource type must already exist. The allocation is authorized independently from definition and creates exactly the supplied quantities atomically.

### `requestBudget`

```ts
interface RequestBudgetCommand {
  commandId: string;
  parentBudgetId: string;
  resources: ResourceAmount[];
}

type RequestBudgetResult = RequestApproved | RequestDenied;

interface RequestApproved {
  kind: "approved";
  commandId: string;
  parentBudgetId: string;
  childBudgetId: string;
  resources: ResourceAmount[];
  replayed: boolean;
}

interface RequestDenied {
  kind: "denied";
  commandId: string;
  parentBudgetId: string;
  reasons: RequestDenialReason[];
  replayed: boolean;
}

interface RequestDenialReason {
  code: "insufficient_available";
  resourceTypeId: string;
  requested: number;
  available: number;
}
```

The command ID becomes the child Budget ID only on approval. The request names no funding source. Its structural parent is the sole source. The procedure locks and evaluates the entire sorted envelope. If any amount is unavailable, it reserves nothing and returns all insufficient Resources sorted by `resourceTypeId`. A denial is a valid committed result and one lineage history entry, not an error.

An inactive parent, a Resource type that has not been defined, a malformed envelope, an unsupported field, arithmetic overflow, or failed authorization is an error rather than a denial.

### `settleBudget`

```ts
interface SettleBudgetCommand {
  commandId: string;
  budgetId: string;
  usage: UsageAmount[];
}

interface SettleBudgetResult {
  kind: "settling" | "settled";
  budget: BudgetProjection;
  newlyKnown: ResourceAmount[];
  unresolvedResourceTypeIds: string[];
  replayed: boolean;
}
```

The usage array contains a non-empty, unique subset of the Budget's allocated Resource types. Omitted Resource types remain unresolved, and `null` explicitly preserves missing evidence for an included type. The first valid command seals the Budget against new children. Later commands may supply an omitted type or replace `null` with a known amount. A new command that repeats a known value commits a no-op settlement result and evidence; a changed known value throws `usage_conflict`. No command may return a known value to `null`.

`settled` means all usage in the subtree is known and all descendants are settled. Otherwise the result is `settling`. Known overage is preserved in `subtreeObservedUsage` and creates an isolated deficit based on bounded child charges; it does not debit an ancestor or sibling.

## Read operations

### `getBudget`

```ts
interface GetBudgetQuery {
  budgetId: string;
}

interface GetBudgetResult {
  budget: BudgetProjection;
  history: BudgetHistory;
}

interface ResourceTypeProjection {
  resourceTypeId: string;
  canonicalName: string;
  unit: string;
  accountingBehavior: AccountingBehavior;
  definitionDigest: string;
}

interface BudgetResourceProjection {
  resourceType: ResourceTypeProjection;
  allocated: number;
  available: number;
  committed: number;
  directUsage: number | null;
  subtreeObservedUsage: number;
  unresolved: boolean;
  deficit: number;
}

interface BudgetProjection {
  budgetId: string;
  parentBudgetId: string | null;
  rootBudgetId: string;
  depth: number;
  lifecycle: BudgetLifecycle;
  resources: BudgetResourceProjection[];
}

interface BudgetHistory {
  rootBudgetId: string;
  entries: BudgetHistoryEntry[];
}

type BudgetHistoryEntry =
  | BudgetCreatedHistoryEntry
  | RequestApprovedHistoryEntry
  | RequestDeniedHistoryEntry
  | BudgetSettlementRecordedHistoryEntry;
```

Resources are sorted by `resourceTypeId`. `subtreeObservedUsage` reports observation and includes overage. `committed` and `available` use bounded parent-accounting rules. A single field never represents both concepts.

The supplied Budget selects both its projection and its root lineage. `getBudget` returns the authorized projection and the complete root-lineage history from one database transaction snapshot. KEY-43 does not paginate this history. Add pagination only when measured lineage size or adopter evidence requires it. Private database records may use event names, but the public result contains only `BudgetHistoryEntry` values.

History entries are closed shapes:

| Entry kind                   | Required logical payload                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `budget_created`             | root Budget ID and exact allocated envelope                                          |
| `request_approved`           | command, parent, child, and exact reserved envelope                                  |
| `request_denied`             | command, parent, and canonical denial reasons                                        |
| `budget_settlement_recorded` | command, Budget, newly known usage, unresolved IDs, lifecycle, and isolated deficits |

Every history entry contains `entryId`, `sequence`, `commandId`, `subjectBudgetId`, and its kind-specific payload. The database derives `entryId` from its internal event identity. Operational timestamps are excluded from logical equality and digests.

## Error contract

Installed functions encode expected errors as a closed wire envelope. The generated SDK validates it and throws a generated `KeynesError` carrying `code` and structured `details`; it never parses transport text.

| Code                      | Stable detail fields                                                     | Applies to                                 |
| ------------------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| `invalid_command`         | `operation`, `issues[]` with stable path and rule                        | Any malformed input or unknown field       |
| `unauthorized`            | `operation`, `requiredPermission`                                        | Any failed installed permission check      |
| `command_conflict`        | `commandId`, `existingOperation`, `attemptedOperation`                   | Changed operation, target, or logical body |
| `resource_type_conflict`  | `canonicalName`, `existingDefinitionDigest`, `attemptedDefinitionDigest` | Changed redefinition                       |
| `resource_type_not_found` | `resourceTypeId`                                                         | Allocation or request                      |
| `budget_not_found`        | `budgetId`                                                               | Request, settle, reads                     |
| `budget_not_active`       | `budgetId`, `lifecycle`                                                  | New request after settlement begins        |
| `usage_conflict`          | `budgetId`, `resourceTypeId`, `existing`, `attempted`                    | Contradicting known usage                  |
| `arithmetic_error`        | `operation`, `resourceTypeId`                                            | Unsafe input or derived overflow           |
| `contract_mismatch`       | `clientDigest`, `installedDigest`                                        | Generated client handshake                 |
| `installation_drift`      | `migrationId`, `expectedChecksum`, `actualChecksum`                      | Local installation                         |

Issue arrays and all multi-Resource details sort first by JSON path, then rule or Resource ID. Permission and command conflicts happen before any Budget mutation. Denial remains reserved for a successfully evaluated but unfundable exact request.

Database constraint failures not deliberately mapped by this table, process termination, and connection loss are not converted to success-shaped values. Their mutation outcome is unknown until the caller retries the same command ID.

## Canonical replay rules

For each mutation, the database constructs the logical command after validation and normalization. It excludes principal, timestamps, replay flags, and other operational metadata. Replay lookup uses `(tenantId, commandId)` and compares:

1. operation;
2. canonical target kind and ID;
3. full canonical logical body;
4. the corresponding body digest as an integrity check.

The initiating principal is recorded but does not partition command uniqueness. Exact replay returns the original canonical domain result and appends no history entry. The SDK overlays `replayed: true`; that flag is excluded from stored-result equality.

## Generated operation binding

The ordered source manifest is the only source for generated method names and installed targets. For each of the five entries, generation emits:

- input, output, history-entry, and error TypeScript types;
- standalone input and output validators;
- one concrete method in `generated/client.ts`;
- SQL input/output validation and the public wrapper;
- an expected target name in the installation record;
- the same contract digest.

Generation fails on an unknown operation, duplicate installed target, undeclared output, unsupported schema keyword, unstable enumeration, or target outside the closed `keynes` allowlist.
