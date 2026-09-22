// Generated from @keynes/database. Do not edit.

/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "Uuid".
 */
export type Uuid = string;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "Digest".
 */
export type Digest = string;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "Sha256Digest".
 */
export type Sha256Digest = string;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "Amount".
 */
export type Amount = number;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PositiveAmount".
 */
export type PositiveAmount = number;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "LineageBudgetId".
 */
export type LineageBudgetId = number;
/**
 * @minItems 1
 *
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ResourceEnvelope".
 */
export type ResourceEnvelope = [ResourceAmount, ...ResourceAmount[]];
/**
 * @minItems 1
 *
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RootResourceEnvelope".
 */
export type RootResourceEnvelope = [RootResourceInput, ...RootResourceInput[]];
/**
 * @minItems 1
 *
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "UsageEnvelope".
 */
export type UsageEnvelope = [UsageAmount, ...UsageAmount[]];
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "LineageCause".
 */
export type LineageCause =
  | {
      kind: "command";
    }
  | {
      kind: "automatic_finalization";
      eventSequence: number;
    };
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "InspectionMovement".
 */
export type InspectionMovement =
  | InitialAllocationMovement
  | TransferMovement
  | ConsumptionOrReleaseMovement;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RequestDenialReason".
 */
export type RequestDenialReason = AvailabilityDenialReason;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BudgetHistoryEntry".
 */
export type BudgetHistoryEntry =
  | BudgetCreatedHistoryEntry
  | RequestApprovedHistoryEntry
  | RequestDeniedHistoryEntry
  | BudgetSettlementRecordedHistoryEntry;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RequestBudgetResult".
 */
export type RequestBudgetResult = RequestApproved | RequestDenied;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "OperationKey".
 */
export type OperationKey = string;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BudgetReference".
 */
export type BudgetReference = string;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "HistoryCursor".
 */
export type HistoryCursor = string;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteMutationName".
 */
export type RemoteMutationName =
  | "defineResources"
  | "createBudget"
  | "requestBudget"
  | "settleBudget";
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteProcedureName".
 */
export type RemoteProcedureName =
  | "defineResources"
  | "validateResources"
  | "createBudget"
  | "requestBudget"
  | "settleBudget"
  | "getBudget"
  | "getBudgetHistoryPage"
  | "openBudget"
  | "recoverOperation"
  | "getCompatibility";
/**
 * @minItems 1
 * @maxItems 64
 *
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteResourceEnvelope".
 */
export type RemoteResourceEnvelope = [
  RemoteResourceAmount,
  ...RemoteResourceAmount[],
];
/**
 * @minItems 1
 * @maxItems 64
 *
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteUsageEnvelope".
 */
export type RemoteUsageEnvelope = [RemoteUsageAmount, ...RemoteUsageAmount[]];
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteRequestDenialReason".
 */
export type RemoteRequestDenialReason = RemoteAvailabilityDenialReason;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteInspectionMovement".
 */
export type RemoteInspectionMovement =
  | RemoteInitialAllocationMovement
  | RemoteTransferMovement
  | RemoteConsumptionOrReleaseMovement;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteBudgetHistoryEntry".
 */
export type RemoteBudgetHistoryEntry =
  | RemoteBudgetCreatedHistoryEntry
  | RemoteRequestApprovedHistoryEntry
  | RemoteRequestDeniedHistoryEntry
  | RemoteBudgetSettlementHistoryEntry;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteRequestBudgetResult".
 */
export type RemoteRequestBudgetResult =
  | RemoteRequestApprovedResult
  | RemoteRequestDeniedResult;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteMutationResult".
 */
export type RemoteMutationResult =
  | RemoteDefineResourcesResult
  | RemoteCreateBudgetResult
  | RemoteRequestBudgetResult
  | RemoteSettleBudgetResult;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ResourceBindingReference".
 */
export type ResourceBindingReference = string;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RecoveredCommittedOperation".
 */
export type RecoveredCommittedOperation =
  | RecoveredCommittedDefineResources
  | RecoveredCommittedCreateBudget
  | RecoveredCommittedRequestBudget
  | RecoveredCommittedSettleBudget;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteDefinitiveErrorEnvelope".
 */
export type RemoteDefinitiveErrorEnvelope =
  | RemoteInvalidCommandErrorEnvelope
  | RemoteUnauthorizedErrorEnvelope
  | RemoteDefinitiveDomainErrorEnvelope
  | ResourceBindingMismatchErrorEnvelope
  | CompatibilityErrorEnvelope
  | RemoteLimitExceededErrorEnvelope;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RecoverOperationResult".
 */
export type RecoverOperationResult =
  | RecoveredCommittedOperation
  | RecoveredKnownFailure
  | UnresolvedOperation
  | ExpiredOperation;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteErrorEnvelope".
 */
export type RemoteErrorEnvelope =
  | RemoteDefinitiveErrorEnvelope
  | RemoteSimpleErrorEnvelope
  | RemoteRetryableErrorEnvelope
  | RemoteTimeoutErrorEnvelope
  | UncertainOutcomeErrorEnvelope;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "OperationName".
 */
export type OperationName =
  | "defineResource"
  | "defineResources"
  | "validateResources"
  | "createBudget"
  | "requestBudget"
  | "settleBudget"
  | "getBudget";
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PermissionName".
 */
export type PermissionName =
  | "define_resource_type"
  | "create_root_budget"
  | "request_budget"
  | "settle_budget"
  | "read_budget";
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ErrorEnvelope".
 */
export type ErrorEnvelope =
  | {
      kind: "error";
      code: "invalid_command";
      details: {
        operation: OperationName;
        /**
         * @minItems 1
         */
        issues: [ValidationIssue, ...ValidationIssue[]];
      };
    }
  | {
      kind: "error";
      code: "unauthorized";
      details: {
        operation: OperationName;
        requiredPermission: PermissionName;
      };
    }
  | {
      kind: "error";
      code: "command_conflict";
      details: {
        commandId: Uuid;
        existingOperation: OperationName;
        attemptedOperation: OperationName;
      };
    }
  | {
      kind: "error";
      code: "resource_type_conflict";
      details: {
        canonicalName: string;
        existingDefinitionDigest: Digest;
        attemptedDefinitionDigest: Digest;
      };
    }
  | {
      kind: "error";
      code: "resource_type_not_found";
      details:
        | {
            resourceTypeId: Uuid;
          }
        | {
            canonicalName: string;
          };
    }
  | {
      kind: "error";
      code: "budget_not_found";
      details: {
        budgetId: Uuid;
      };
    }
  | {
      kind: "error";
      code: "budget_not_active";
      details: {
        budgetId: Uuid;
        lifecycle: "active" | "settling" | "settled";
      };
    }
  | {
      kind: "error";
      code: "usage_conflict";
      details: {
        budgetId: Uuid;
        resourceTypeId: Uuid;
        existing: Amount;
        attempted: Amount;
      };
    }
  | {
      kind: "error";
      code: "arithmetic_error";
      details: {
        operation: OperationName;
        resourceTypeId: Uuid;
      };
    }
  | {
      kind: "error";
      code: "contract_mismatch";
      details: {
        clientDigest: Sha256Digest;
        installedDigest: Sha256Digest;
      };
    }
  | {
      kind: "error";
      code: "installation_drift";
      details: {
        migrationId: string;
        expectedChecksum: Digest;
        actualChecksum: Digest;
      };
    };

export interface KeynesBudgetContract {
  [k: string]: unknown;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ResourceAmount".
 */
export interface ResourceAmount {
  resourceTypeId: Uuid;
  amount: Amount;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RootResourceInput".
 */
export interface RootResourceInput {
  definition: ResourceDefinition;
  amount: Amount;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ResourceDefinition".
 */
export interface ResourceDefinition {
  canonicalName: string;
  unit: string;
  accountingBehavior: "consumable" | "reusable";
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "UsageAmount".
 */
export interface UsageAmount {
  resourceTypeId: Uuid;
  amount: Amount | null;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ResourceTypeProjection".
 */
export interface ResourceTypeProjection {
  resourceTypeId: Uuid;
  canonicalName: string;
  unit: string;
  accountingBehavior: "consumable" | "reusable";
  definitionDigest: Digest;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BudgetResourceProjection".
 */
export interface BudgetResourceProjection {
  resourceType: ResourceTypeProjection;
  allocated: Amount;
  available: Amount;
  committed: Amount;
  directUsage: Amount | null;
  subtreeObservedUsage: Amount;
  unresolved: boolean;
  deficit: Amount;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BudgetProjection".
 */
export interface BudgetProjection {
  budgetId: Uuid;
  parentBudgetId: Uuid | null;
  rootBudgetId: Uuid;
  depth: Amount;
  lifecycle: "active" | "settling" | "settled";
  /**
   * @minItems 1
   */
  resources: [BudgetResourceProjection, ...BudgetResourceProjection[]];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BudgetInspectionState".
 */
export interface BudgetInspectionState {
  budgetId: Uuid;
  parentBudgetId: Uuid | null;
  rootBudgetId: Uuid;
  lineageId: LineageBudgetId;
  parentLineageId: LineageBudgetId | null;
  depth: Amount;
  lifecycle: "active" | "settling" | "settled";
  /**
   * @minItems 1
   */
  resources: [BudgetResourceProjection, ...BudgetResourceProjection[]];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "InitialAllocationMovement".
 */
export interface InitialAllocationMovement {
  reason: "initial_allocation";
  resourceTypeId: Uuid;
  amount: PositiveAmount;
  from: null;
  to: LineageBudgetId;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "TransferMovement".
 */
export interface TransferMovement {
  reason: "child_grant" | "settlement_return";
  resourceTypeId: Uuid;
  amount: PositiveAmount;
  from: LineageBudgetId;
  to: LineageBudgetId;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ConsumptionOrReleaseMovement".
 */
export interface ConsumptionOrReleaseMovement {
  reason: "consumption" | "root_release";
  resourceTypeId: Uuid;
  amount: PositiveAmount;
  from: LineageBudgetId;
  to: null;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "LineageEvidence".
 */
export interface LineageEvidence {
  subject: LineageBudgetId;
  cause: LineageCause;
  movements: InspectionMovement[];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "AvailabilityDenialReason".
 */
export interface AvailabilityDenialReason {
  code: "insufficient_available";
  resourceTypeId: Uuid;
  requested: Amount;
  available: Amount;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BudgetCreatedHistoryEntry".
 */
export interface BudgetCreatedHistoryEntry {
  kind: "budget_created";
  entryId: Uuid;
  sequence: Amount;
  subject: LineageBudgetId;
  cause: LineageCause;
  movements: InspectionMovement[];
  commandId: Uuid;
  subjectBudgetId: Uuid;
  rootBudgetId: Uuid;
  resources: ResourceEnvelope;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RequestApprovedHistoryEntry".
 */
export interface RequestApprovedHistoryEntry {
  kind: "request_approved";
  entryId: Uuid;
  sequence: Amount;
  subject: LineageBudgetId;
  parent: LineageBudgetId;
  cause: LineageCause;
  movements: InspectionMovement[];
  commandId: Uuid;
  subjectBudgetId: Uuid;
  parentBudgetId: Uuid;
  childBudgetId: Uuid;
  resources: ResourceEnvelope;
  decisionEvidence?: DecisionEvidence;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "DecisionEvidence".
 */
export interface DecisionEvidence {
  [k: string]: string | boolean | null | Amount;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RequestDeniedHistoryEntry".
 */
export interface RequestDeniedHistoryEntry {
  kind: "request_denied";
  entryId: Uuid;
  sequence: Amount;
  subject: LineageBudgetId;
  cause: LineageCause;
  movements: InspectionMovement[];
  commandId: Uuid;
  subjectBudgetId: Uuid;
  parentBudgetId: Uuid;
  /**
   * @minItems 1
   */
  reasons: [RequestDenialReason, ...RequestDenialReason[]];
  decisionEvidence?: DecisionEvidence;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BudgetSettlementRecordedHistoryEntry".
 */
export interface BudgetSettlementRecordedHistoryEntry {
  kind: "budget_settlement_recorded";
  entryId: Uuid;
  sequence: Amount;
  subject: LineageBudgetId;
  cause: LineageCause;
  movements: InspectionMovement[];
  commandId: Uuid;
  subjectBudgetId: Uuid;
  budgetId: Uuid;
  newlyKnown: ResourceAmount[];
  unresolvedResourceTypeIds: Uuid[];
  lifecycle: "settling" | "settled";
  isolatedDeficits: ResourceAmount[];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BudgetHistory".
 */
export interface BudgetHistory {
  rootBudgetId: Uuid;
  entries: BudgetHistoryEntry[];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "DefineResourceTypeCommand".
 */
export interface DefineResourceTypeCommand {
  commandId: Uuid;
  definition: ResourceDefinition;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "DefineResourceTypeResult".
 */
export interface DefineResourceTypeResult {
  kind: "defined";
  resourceType: ResourceTypeProjection;
  definitionEvidence: {
    kind: "resource_type_defined";
    commandId: Uuid;
    principalId: Uuid;
    definitionDigest: Digest;
  };
  replayed: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "CreateBudgetCommand".
 */
export interface CreateBudgetCommand {
  commandId: Uuid;
  definitions: ResourceDefinitions;
  amounts: ResourceAllocation;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ResourceDefinitions".
 */
export interface ResourceDefinitions {
  [k: string]: {
    unit: string;
    accountingBehavior: "consumable" | "reusable";
  };
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ResourceAllocation".
 */
export interface ResourceAllocation {
  [k: string]: Amount;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "CreateBudgetResult".
 */
export interface CreateBudgetResult {
  kind: "created";
  budget: BudgetProjection;
  replayed: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RequestBudgetCommand".
 */
export interface RequestBudgetCommand {
  commandId: Uuid;
  parentBudgetId: Uuid;
  resources: ResourceEnvelope;
  decisionEvidence?: DecisionEvidence;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RequestApproved".
 */
export interface RequestApproved {
  kind: "approved";
  commandId: Uuid;
  parentBudgetId: Uuid;
  childBudgetId: Uuid;
  resources: ResourceEnvelope;
  replayed: boolean;
  decisionEvidence?: DecisionEvidence;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RequestDenied".
 */
export interface RequestDenied {
  kind: "denied";
  commandId: Uuid;
  parentBudgetId: Uuid;
  /**
   * @minItems 1
   */
  reasons: [RequestDenialReason, ...RequestDenialReason[]];
  replayed: boolean;
  decisionEvidence?: DecisionEvidence;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "SettleBudgetCommand".
 */
export interface SettleBudgetCommand {
  commandId: Uuid;
  budgetId: Uuid;
  usage: UsageEnvelope;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "SettleBudgetResult".
 */
export interface SettleBudgetResult {
  kind: "settling" | "settled";
  budget: BudgetProjection;
  newlyKnown: ResourceAmount[];
  unresolvedResourceTypeIds: Uuid[];
  replayed: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "GetBudgetQuery".
 */
export interface GetBudgetQuery {
  budgetId: Uuid;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "GetBudgetResult".
 */
export interface GetBudgetResult {
  budget: BudgetInspectionState;
  history: BudgetHistory;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteResourceAmount".
 */
export interface RemoteResourceAmount {
  resource: string;
  amount: Amount;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteUsageAmount".
 */
export interface RemoteUsageAmount {
  resource: string;
  amount: Amount | null;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteBudgetResourceProjection".
 */
export interface RemoteBudgetResourceProjection {
  resource: ResourceDefinition;
  allocated: Amount;
  available: Amount;
  committed: Amount;
  directUsage: Amount | null;
  subtreeObservedUsage: Amount;
  unresolved: boolean;
  deficit: Amount;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteBudgetProjection".
 */
export interface RemoteBudgetProjection {
  budgetReference: BudgetReference;
  parentBudgetReference: BudgetReference | null;
  rootBudgetReference: BudgetReference;
  depth: Amount;
  lifecycle: "active" | "settling" | "settled";
  /**
   * @minItems 1
   * @maxItems 64
   */
  resources: [
    RemoteBudgetResourceProjection,
    ...RemoteBudgetResourceProjection[],
  ];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteBudgetInspectionProjection".
 */
export interface RemoteBudgetInspectionProjection {
  budgetReference: BudgetReference;
  lineageId: LineageBudgetId;
  parentLineageId: LineageBudgetId | null;
  depth: Amount;
  lifecycle: "active" | "settling" | "settled";
  /**
   * @minItems 1
   * @maxItems 64
   */
  resources: [
    RemoteBudgetResourceProjection,
    ...RemoteBudgetResourceProjection[],
  ];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteAvailabilityDenialReason".
 */
export interface RemoteAvailabilityDenialReason {
  code: "insufficient_available";
  resource: string;
  requested: Amount;
  available: Amount;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteInitialAllocationMovement".
 */
export interface RemoteInitialAllocationMovement {
  reason: "initial_allocation";
  resource: string;
  amount: PositiveAmount;
  from: null;
  to: LineageBudgetId;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteTransferMovement".
 */
export interface RemoteTransferMovement {
  reason: "child_grant" | "settlement_return";
  resource: string;
  amount: PositiveAmount;
  from: LineageBudgetId;
  to: LineageBudgetId;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteConsumptionOrReleaseMovement".
 */
export interface RemoteConsumptionOrReleaseMovement {
  reason: "consumption" | "root_release";
  resource: string;
  amount: PositiveAmount;
  from: LineageBudgetId;
  to: null;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteBudgetCreatedHistoryEntry".
 */
export interface RemoteBudgetCreatedHistoryEntry {
  kind: "budget_created";
  sequence: Amount;
  subject: LineageBudgetId;
  cause: LineageCause;
  movements: RemoteInspectionMovement[];
  resources: RemoteResourceEnvelope;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteRequestApprovedHistoryEntry".
 */
export interface RemoteRequestApprovedHistoryEntry {
  kind: "request_approved";
  sequence: Amount;
  subject: LineageBudgetId;
  parent: LineageBudgetId;
  cause: LineageCause;
  movements: RemoteInspectionMovement[];
  resources: RemoteResourceEnvelope;
  decisionEvidence?: DecisionEvidence;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteRequestDeniedHistoryEntry".
 */
export interface RemoteRequestDeniedHistoryEntry {
  kind: "request_denied";
  sequence: Amount;
  subject: LineageBudgetId;
  cause: LineageCause;
  movements: RemoteInspectionMovement[];
  /**
   * @minItems 1
   */
  reasons: [RemoteRequestDenialReason, ...RemoteRequestDenialReason[]];
  decisionEvidence?: DecisionEvidence;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteBudgetSettlementHistoryEntry".
 */
export interface RemoteBudgetSettlementHistoryEntry {
  kind: "budget_settlement_recorded";
  sequence: Amount;
  subject: LineageBudgetId;
  cause: LineageCause;
  movements: RemoteInspectionMovement[];
  newlyKnown: RemoteResourceAmount[];
  unresolvedResources: string[];
  lifecycle: "settling" | "settled";
  isolatedDeficits: RemoteResourceAmount[];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteCreateBudgetCommand".
 */
export interface RemoteCreateBudgetCommand {
  operationKey: OperationKey;
  definitions: ResourceDefinitions;
  amounts: ResourceAllocation;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteCreateBudgetResult".
 */
export interface RemoteCreateBudgetResult {
  kind: "created";
  budget: RemoteBudgetProjection;
  replayed: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteRequestBudgetCommand".
 */
export interface RemoteRequestBudgetCommand {
  operationKey: OperationKey;
  parentBudgetReference: BudgetReference;
  resources: RemoteResourceEnvelope;
  decisionEvidence?: DecisionEvidence;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteRequestApprovedResult".
 */
export interface RemoteRequestApprovedResult {
  kind: "approved";
  parentBudgetReference: BudgetReference;
  childBudgetReference: BudgetReference;
  resources: RemoteResourceEnvelope;
  replayed: boolean;
  decisionEvidence?: DecisionEvidence;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteRequestDeniedResult".
 */
export interface RemoteRequestDeniedResult {
  kind: "denied";
  parentBudgetReference: BudgetReference;
  /**
   * @minItems 1
   */
  reasons: [RemoteRequestDenialReason, ...RemoteRequestDenialReason[]];
  replayed: boolean;
  decisionEvidence?: DecisionEvidence;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteSettleBudgetCommand".
 */
export interface RemoteSettleBudgetCommand {
  operationKey: OperationKey;
  budgetReference: BudgetReference;
  usage: RemoteUsageEnvelope;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteSettleBudgetResult".
 */
export interface RemoteSettleBudgetResult {
  kind: "settling" | "settled";
  budget: RemoteBudgetProjection;
  newlyKnown: RemoteResourceAmount[];
  unresolvedResources: string[];
  replayed: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteGetBudgetQuery".
 */
export interface RemoteGetBudgetQuery {
  budgetReference: BudgetReference;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteGetBudgetResult".
 */
export interface RemoteGetBudgetResult {
  budget: RemoteBudgetProjection;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "GetBudgetHistoryPageQuery".
 */
export interface GetBudgetHistoryPageQuery {
  budgetReference: BudgetReference;
  cursor?: HistoryCursor;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "GetBudgetHistoryPageResult".
 */
export interface GetBudgetHistoryPageResult {
  budgetReference: BudgetReference;
  budget: RemoteBudgetInspectionProjection;
  /**
   * @maxItems 256
   */
  entries: RemoteBudgetHistoryEntry[];
  nextCursor: HistoryCursor | null;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "OpenBudgetQuery".
 */
export interface OpenBudgetQuery {
  budgetReference: BudgetReference;
  /**
   * @minItems 1
   * @maxItems 64
   */
  expectedResources: [ResourceDefinition, ...ResourceDefinition[]];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "OpenBudgetResult".
 */
export interface OpenBudgetResult {
  budgetReference: BudgetReference;
  budget: RemoteBudgetProjection;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RecoverOperationQuery".
 */
export interface RecoverOperationQuery {
  operationKey: OperationKey;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteDefineResourcesResult".
 */
export interface RemoteDefineResourcesResult {
  kind: "defined";
  bindingReference: ResourceBindingReference;
  /**
   * @minItems 1
   */
  resources: [DefinedResourceMember, ...DefinedResourceMember[]];
  replayed: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "DefinedResourceMember".
 */
export interface DefinedResourceMember {
  key: string;
  resourceType: ResourceTypeProjection;
  definitionEvidence: {
    kind: "resource_type_defined";
    commandId: Uuid;
    principalId: Uuid;
    definitionDigest: Digest;
  };
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RecoveredCommittedDefineResources".
 */
export interface RecoveredCommittedDefineResources {
  kind: "committed";
  operationKey: OperationKey;
  operation: "defineResources";
  result: RemoteDefineResourcesResult;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RecoveredCommittedCreateBudget".
 */
export interface RecoveredCommittedCreateBudget {
  kind: "committed";
  operationKey: OperationKey;
  operation: "createBudget";
  result: RemoteCreateBudgetResult;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RecoveredCommittedRequestBudget".
 */
export interface RecoveredCommittedRequestBudget {
  kind: "committed";
  operationKey: OperationKey;
  operation: "requestBudget";
  result: RemoteRequestBudgetResult;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RecoveredCommittedSettleBudget".
 */
export interface RecoveredCommittedSettleBudget {
  kind: "committed";
  operationKey: OperationKey;
  operation: "settleBudget";
  result: RemoteSettleBudgetResult;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RecoveredKnownFailure".
 */
export interface RecoveredKnownFailure {
  kind: "known_failure";
  operationKey: OperationKey;
  error: RemoteDefinitiveErrorEnvelope;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteInvalidCommandErrorEnvelope".
 */
export interface RemoteInvalidCommandErrorEnvelope {
  kind: "error";
  code: "invalid_command";
  details: {
    operation: RemoteProcedureName;
    /**
     * @minItems 1
     */
    issues: [ValidationIssue, ...ValidationIssue[]];
  };
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ValidationIssue".
 */
export interface ValidationIssue {
  path: string;
  rule: string;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteUnauthorizedErrorEnvelope".
 */
export interface RemoteUnauthorizedErrorEnvelope {
  kind: "error";
  code: "unauthorized";
  details: {
    operation: RemoteProcedureName;
    requiredPermission: "remote_access";
  };
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteDefinitiveDomainErrorEnvelope".
 */
export interface RemoteDefinitiveDomainErrorEnvelope {
  kind: "error";
  code:
    | "command_conflict"
    | "resource_type_conflict"
    | "resource_type_not_found"
    | "budget_not_found"
    | "budget_not_active"
    | "usage_conflict"
    | "arithmetic_error";
  details: EmptyRemoteErrorDetails;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "EmptyRemoteErrorDetails".
 */
export interface EmptyRemoteErrorDetails {}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ResourceBindingMismatchErrorEnvelope".
 */
export interface ResourceBindingMismatchErrorEnvelope {
  kind: "error";
  code: "resource_binding_mismatch";
  details: EmptyRemoteErrorDetails;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "CompatibilityErrorEnvelope".
 */
export interface CompatibilityErrorEnvelope {
  kind: "error";
  code: "compatibility_error";
  details: {
    category:
      | "installation"
      | "command_contract"
      | "remote_procedures"
      | "sdk_generation";
  };
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteLimitExceededErrorEnvelope".
 */
export interface RemoteLimitExceededErrorEnvelope {
  kind: "error";
  code: "limit_exceeded";
  details: {
    limit:
      | "pool_size"
      | "waiting_callers"
      | "history_page"
      | "inspection_pages";
    maximum: number;
  };
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "UnresolvedOperation".
 */
export interface UnresolvedOperation {
  kind: "unresolved";
  operationKey: OperationKey;
  retryAfterMilliseconds?: number;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ExpiredOperation".
 */
export interface ExpiredOperation {
  kind: "expired";
  operationKey: OperationKey;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "GetCompatibilityQuery".
 */
export interface GetCompatibilityQuery {}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteProcedureCapability".
 */
export interface RemoteProcedureCapability {
  name: RemoteProcedureName;
  target: string;
  revision: number;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "GetCompatibilityResult".
 */
export interface GetCompatibilityResult {
  installationId: string;
  contractDigest: Sha256Digest;
  remoteProceduresDigest: Sha256Digest;
  semanticGeneration: number;
  minimumSdkGeneration: number;
  /**
   * @minItems 10
   * @maxItems 10
   */
  procedures: [
    RemoteProcedureCapability,
    RemoteProcedureCapability,
    RemoteProcedureCapability,
    RemoteProcedureCapability,
    RemoteProcedureCapability,
    RemoteProcedureCapability,
    RemoteProcedureCapability,
    RemoteProcedureCapability,
    RemoteProcedureCapability,
    RemoteProcedureCapability,
  ];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteSimpleErrorEnvelope".
 */
export interface RemoteSimpleErrorEnvelope {
  kind: "error";
  code:
    | "invalid_configuration"
    | "tls_error"
    | "authentication_failed"
    | "client_closed"
    | "unknown";
  details: EmptyRemoteErrorDetails;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteRetryableErrorEnvelope".
 */
export interface RemoteRetryableErrorEnvelope {
  kind: "error";
  code: "rate_limited" | "unavailable";
  details: {
    retryAfterMilliseconds?: number;
  };
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteTimeoutErrorEnvelope".
 */
export interface RemoteTimeoutErrorEnvelope {
  kind: "error";
  code: "timeout";
  details: {
    operation: RemoteProcedureName;
    operationKey?: OperationKey;
  };
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "UncertainOutcomeErrorEnvelope".
 */
export interface UncertainOutcomeErrorEnvelope {
  kind: "error";
  code: "uncertain_outcome";
  details: {
    operation: RemoteMutationName;
    operationKey: OperationKey;
  };
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "DefineResourcesCommand".
 */
export interface DefineResourcesCommand {
  commandId: Uuid;
  definitions: ResourceDefinitions;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "DefineResourcesResult".
 */
export interface DefineResourcesResult {
  kind: "defined";
  bindingReference: ResourceBindingReference;
  /**
   * @minItems 1
   */
  resources: [DefinedResourceMember, ...DefinedResourceMember[]];
  replayed: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RemoteDefineResourcesCommand".
 */
export interface RemoteDefineResourcesCommand {
  operationKey: OperationKey;
  definitions: ResourceDefinitions;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ValidateResourcesQuery".
 */
export interface ValidateResourcesQuery {
  definitions: ResourceDefinitions;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ValidateResourcesResult".
 */
export interface ValidateResourcesResult {
  valid: true;
}
