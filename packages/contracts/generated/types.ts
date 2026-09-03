// Generated from @keynes/contracts. Do not edit.

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
 * via the `definition` "Amount".
 */
export type Amount = number;
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
 * via the `definition` "RequestDenialReason".
 */
export type RequestDenialReason =
  | AvailabilityDenialReason
  | PolicyCeilingReasonV1;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PolicyScalarV1".
 */
export type PolicyScalarV1 = string | boolean | number | null;
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
 * via the `definition` "PolicyDigest".
 */
export type PolicyDigest = string;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "JoinNodeV1".
 */
export type JoinNodeV1 = InnerJoinNodeV1 | CrossJoinNodeV1;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ExpressionNodeV1".
 */
export type ExpressionNodeV1 =
  | DecimalLiteralNodeV1
  | TextLiteralNodeV1
  | BooleanLiteralNodeV1
  | NullLiteralNodeV1
  | ReferenceNodeV1
  | UnaryNumericNodeV1
  | BinaryNumericNodeV1
  | ComparisonNodeV1
  | TextInNodeV1
  | IsNullNodeV1
  | BooleanBinaryNodeV1
  | BooleanNotNodeV1
  | CaseNodeV1
  | VariadicNodeV1
  | NumericFunctionNodeV1
  | ScaleFunctionNodeV1
  | PowerNodeV1
  | AggregateNodeV1;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RequestBudgetResult".
 */
export type RequestBudgetResult = RequestApproved | RequestDenied;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "OperationName".
 */
export type OperationName =
  | "defineResource"
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
      details: {
        resourceTypeId: Uuid;
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
        clientDigest: Digest;
        installedDigest: Digest;
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
    }
  | InvalidPolicyErrorEnvelope
  | InvalidPolicyContextErrorEnvelope
  | PolicyEvaluationFailedErrorEnvelope;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "CanonicalIdentifier".
 */
export type CanonicalIdentifier = string;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PolicyNodeV1".
 */
export type PolicyNodeV1 =
  | SelectNodeV1
  | InnerJoinNodeV1
  | CrossJoinNodeV1
  | DecimalLiteralNodeV1
  | TextLiteralNodeV1
  | BooleanLiteralNodeV1
  | NullLiteralNodeV1
  | ReferenceNodeV1
  | UnaryNumericNodeV1
  | BinaryNumericNodeV1
  | ComparisonNodeV1
  | TextInNodeV1
  | IsNullNodeV1
  | BooleanBinaryNodeV1
  | BooleanNotNodeV1
  | CaseNodeV1
  | VariadicNodeV1
  | NumericFunctionNodeV1
  | ScaleFunctionNodeV1
  | PowerNodeV1
  | AggregateNodeV1;
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PolicySetV1".
 */
export type PolicySetV1 =
  | {
      /**
       * @maxItems 0
       */
      definitions: [];
      contextSchemaDigest: null;
      setDigest: string;
    }
  | {
      /**
       * @minItems 1
       * @maxItems 16
       */
      definitions: [PolicyDefinitionV1, ...PolicyDefinitionV1[]];
      contextSchemaDigest: string;
      setDigest: string;
    };
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PolicyErrorEnvelopeV1".
 */
export type PolicyErrorEnvelopeV1 =
  | InvalidPolicyErrorEnvelope
  | InvalidPolicyContextErrorEnvelope
  | PolicyEvaluationFailedErrorEnvelope;

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
 * via the `definition` "PolicyCeilingReasonV1".
 */
export interface PolicyCeilingReasonV1 {
  code: "policy_ceiling";
  resourceTypeId: string;
  requested: number;
  ceiling: number;
  policyName: string;
  policyRevision: number;
  reason: string;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BudgetCreatedHistoryEntry".
 */
export interface BudgetCreatedHistoryEntry {
  kind: "budget_created";
  entryId: Uuid;
  sequence: Amount;
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
  commandId: Uuid;
  subjectBudgetId: Uuid;
  parentBudgetId: Uuid;
  childBudgetId: Uuid;
  resources: ResourceEnvelope;
  policyEvidence?: PolicyEvidenceV1;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PolicyEvidenceV1".
 */
export interface PolicyEvidenceV1 {
  context: PolicyContextV1;
  /**
   * @minItems 1
   * @maxItems 16
   */
  policies: [
    {
      name: string;
      revision: number;
      sourceDigest: string;
      definitionDigest: string;
      /**
       * @maxItems 64
       */
      rows: PolicyResultRowV1[];
    },
    ...{
      name: string;
      revision: number;
      sourceDigest: string;
      definitionDigest: string;
      /**
       * @maxItems 64
       */
      rows: PolicyResultRowV1[];
    }[],
  ];
  /**
   * @maxItems 64
   */
  effectiveCeilings: {
    resourceTypeId: string;
    ceiling: number;
    /**
     * @minItems 1
     * @maxItems 16
     */
    reasons: [
      {
        policyName: string;
        policyRevision: number;
        reason: string;
      },
      ...{
        policyName: string;
        policyRevision: number;
        reason: string;
      }[],
    ];
  }[];
  decision: "approved" | "denied";
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PolicyContextV1".
 */
export interface PolicyContextV1 {
  [k: string]: PolicyScalarV1;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PolicyResultRowV1".
 */
export interface PolicyResultRowV1 {
  resource: string;
  ceiling: number;
  reason: string;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "RequestDeniedHistoryEntry".
 */
export interface RequestDeniedHistoryEntry {
  kind: "request_denied";
  entryId: Uuid;
  sequence: Amount;
  commandId: Uuid;
  subjectBudgetId: Uuid;
  parentBudgetId: Uuid;
  /**
   * @minItems 1
   */
  reasons: [RequestDenialReason, ...RequestDenialReason[]];
  policyEvidence?: PolicyEvidenceV1;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BudgetSettlementRecordedHistoryEntry".
 */
export interface BudgetSettlementRecordedHistoryEntry {
  kind: "budget_settlement_recorded";
  entryId: Uuid;
  sequence: Amount;
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
  resources: RootResourceEnvelope;
  /**
   * @maxItems 16
   */
  policies?: PolicyDefinitionV1[];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PolicyDefinitionV1".
 */
export interface PolicyDefinitionV1 {
  kind: "keynes.policy";
  name: string;
  revision: number;
  /**
   * @minItems 1
   * @maxItems 64
   */
  inputResources: [string, ...string[]];
  /**
   * @minItems 1
   * @maxItems 64
   */
  outputResources: [string, ...string[]];
  /**
   * @maxItems 32
   */
  contextSchema: PolicyContextFieldV1[];
  /**
   * @minItems 1
   * @maxItems 64
   */
  reasons: [string, ...string[]];
  programVersion: "keynes-policy-program/v1";
  queryProfileVersion: "keynes-policy-query/v1";
  validatorVersion: "keynes-policy-validator/v1";
  limitsVersion: "keynes-policy-limits/v1";
  policyProfileDigest: PolicyDigest;
  program: SelectNodeV1;
  canonicalSql: string;
  sourceDigest: PolicyDigest;
  definitionDigest: PolicyDigest;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PolicyContextFieldV1".
 */
export interface PolicyContextFieldV1 {
  name: string;
  type: "text" | "boolean" | "integer";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "SelectNodeV1".
 *
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PolicyProgramV1".
 */
export interface SelectNodeV1 {
  kind: "select";
  availabilityJoin: JoinNodeV1;
  resource: ExpressionNodeV1;
  ceiling: ExpressionNodeV1;
  reason: ExpressionNodeV1;
  where: ExpressionNodeV1 | null;
  /**
   * @maxItems 32
   */
  groupBy: ExpressionNodeV1[];
  orderBy: ["resource", "reason", "ceiling"];
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "InnerJoinNodeV1".
 */
export interface InnerJoinNodeV1 {
  kind: "inner_join";
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "CrossJoinNodeV1".
 */
export interface CrossJoinNodeV1 {
  kind: "cross_join";
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "DecimalLiteralNodeV1".
 */
export interface DecimalLiteralNodeV1 {
  kind: "decimal_literal";
  value: string;
  valueType: "numeric";
  nullable: false;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "TextLiteralNodeV1".
 */
export interface TextLiteralNodeV1 {
  kind: "text_literal";
  value: string;
  valueType: "text";
  nullable: false;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BooleanLiteralNodeV1".
 */
export interface BooleanLiteralNodeV1 {
  kind: "boolean_literal";
  value: boolean;
  valueType: "boolean";
  nullable: false;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "NullLiteralNodeV1".
 */
export interface NullLiteralNodeV1 {
  kind: "null_literal";
  value: null;
  valueType: "numeric" | "text" | "boolean";
  nullable: true;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ReferenceNodeV1".
 */
export interface ReferenceNodeV1 {
  kind: "reference";
  source: "requested" | "available" | "context";
  field: string;
  valueType: "numeric" | "text" | "boolean";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "UnaryNumericNodeV1".
 */
export interface UnaryNumericNodeV1 {
  kind: "unary_numeric";
  operator: "+" | "-";
  operand: ExpressionNodeV1;
  valueType: "numeric";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BinaryNumericNodeV1".
 */
export interface BinaryNumericNodeV1 {
  kind: "binary_numeric";
  operator: "+" | "-" | "*" | "/" | "%";
  left: ExpressionNodeV1;
  right: ExpressionNodeV1;
  valueType: "numeric";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ComparisonNodeV1".
 */
export interface ComparisonNodeV1 {
  kind: "comparison";
  operator: "=" | "<>" | "<" | "<=" | ">" | ">=";
  left: ExpressionNodeV1;
  right: ExpressionNodeV1;
  valueType: "boolean";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "TextInNodeV1".
 */
export interface TextInNodeV1 {
  kind: "text_in";
  operand: ExpressionNodeV1;
  /**
   * @minItems 1
   * @maxItems 64
   */
  values: [string, ...string[]];
  valueType: "boolean";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "IsNullNodeV1".
 */
export interface IsNullNodeV1 {
  kind: "is_null";
  operator: "is_null" | "is_not_null";
  operand: ExpressionNodeV1;
  valueType: "boolean";
  nullable: false;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BooleanBinaryNodeV1".
 */
export interface BooleanBinaryNodeV1 {
  kind: "boolean_binary";
  operator: "and" | "or";
  left: ExpressionNodeV1;
  right: ExpressionNodeV1;
  valueType: "boolean";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "BooleanNotNodeV1".
 */
export interface BooleanNotNodeV1 {
  kind: "boolean_not";
  operand: ExpressionNodeV1;
  valueType: "boolean";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "CaseNodeV1".
 */
export interface CaseNodeV1 {
  kind: "case";
  /**
   * @minItems 1
   * @maxItems 32
   */
  branches: [
    {
      when: ExpressionNodeV1;
      then: ExpressionNodeV1;
    },
    ...{
      when: ExpressionNodeV1;
      then: ExpressionNodeV1;
    }[],
  ];
  else: ExpressionNodeV1;
  valueType: "numeric" | "text" | "boolean";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "VariadicNodeV1".
 */
export interface VariadicNodeV1 {
  kind: "variadic";
  function: "coalesce" | "least" | "greatest";
  /**
   * @minItems 1
   * @maxItems 64
   */
  arguments: [ExpressionNodeV1, ...ExpressionNodeV1[]];
  valueType: "numeric" | "text" | "boolean";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "NumericFunctionNodeV1".
 */
export interface NumericFunctionNodeV1 {
  kind: "numeric_function";
  function: "abs" | "ceil" | "floor" | "sqrt";
  operand: ExpressionNodeV1;
  valueType: "numeric";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "ScaleFunctionNodeV1".
 */
export interface ScaleFunctionNodeV1 {
  kind: "scale_function";
  function: "round" | "trunc";
  operand: ExpressionNodeV1;
  scale: number;
  valueType: "numeric";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PowerNodeV1".
 */
export interface PowerNodeV1 {
  kind: "power";
  base: ExpressionNodeV1;
  exponent: number;
  valueType: "numeric";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "AggregateNodeV1".
 */
export interface AggregateNodeV1 {
  kind: "aggregate";
  function: "sum" | "avg" | "min" | "max" | "count";
  operand: ExpressionNodeV1;
  valueType: "numeric";
  nullable: boolean;
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
  context?: PolicyContextV1;
  /**
   * @maxItems 16
   */
  childPolicies?: PolicyDefinitionV1[];
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
  policyEvidence?: PolicyEvidenceV1;
  replayed: boolean;
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
  policyEvidence?: PolicyEvidenceV1;
  replayed: boolean;
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
  budget: BudgetProjection;
  history: BudgetHistory;
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
 * via the `definition` "InvalidPolicyErrorEnvelope".
 */
export interface InvalidPolicyErrorEnvelope {
  kind: "error";
  code: "invalid_policy";
  details: {
    operation: "createBudget" | "requestBudget";
    policyName?: string;
    policyRevision?: number;
    path: string;
    rule: string;
  };
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "InvalidPolicyContextErrorEnvelope".
 */
export interface InvalidPolicyContextErrorEnvelope {
  kind: "error";
  code: "invalid_policy_context";
  details: {
    operation: "requestBudget";
    path: string;
    rule:
      | "required"
      | "additionalProperties"
      | "type"
      | "null"
      | "encoding"
      | "limit";
  };
}
/**
 * This interface was referenced by `KeynesBudgetContract`'s JSON-Schema
 * via the `definition` "PolicyEvaluationFailedErrorEnvelope".
 */
export interface PolicyEvaluationFailedErrorEnvelope {
  kind: "error";
  code: "policy_evaluation_failed";
  details: {
    operation: "requestBudget";
    policyName: string;
    policyRevision: number;
    category:
      | "limit_exceeded"
      | "arithmetic_overflow"
      | "numeric_domain"
      | "numeric_precision"
      | "invalid_result"
      | "execution_failed";
  };
}
