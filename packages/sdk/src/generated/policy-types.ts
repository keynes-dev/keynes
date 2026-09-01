// Generated from packages/contracts/policy-profile.json. Do not edit.

/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "Digest".
 */
export type Digest = string;
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "Uuid".
 */
export type Uuid = string;
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "Amount".
 */
export type Amount = number;
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "CanonicalIdentifier".
 */
export type CanonicalIdentifier = string;
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "PolicyScalarV1".
 */
export type PolicyScalarV1 = string | boolean | number | null;
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "JoinNodeV1".
 */
export type JoinNodeV1 = InnerJoinNodeV1 | CrossJoinNodeV1;
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "PolicyNodeV1".
 */
export type PolicyNodeV1 =
  | PolicyProgramV1
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "PolicySetV1".
 */
export type PolicySetV1 =
  | {
      /**
       * @maxItems 0
       */
      definitions: [];
      contextSchemaDigest: null;
      setDigest: Digest;
    }
  | {
      /**
       * @minItems 1
       * @maxItems 16
       */
      definitions: [PolicyDefinitionV1, ...PolicyDefinitionV1[]];
      contextSchemaDigest: Digest;
      setDigest: Digest;
    };
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "PolicyErrorEnvelopeV1".
 */
export type PolicyErrorEnvelopeV1 =
  | InvalidPolicyErrorEnvelope
  | InvalidPolicyContextErrorEnvelope
  | PolicyEvaluationFailedErrorEnvelope;

export interface KeynesPolicyContract {
  [k: string]: unknown;
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "PolicyContextV1".
 */
export interface PolicyContextV1 {
  [k: string]: PolicyScalarV1;
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "PolicyContextFieldV1".
 */
export interface PolicyContextFieldV1 {
  name: CanonicalIdentifier;
  type: "text" | "boolean" | "integer";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "PolicyResultRowV1".
 */
export interface PolicyResultRowV1 {
  resource: CanonicalIdentifier;
  ceiling: Amount;
  reason: CanonicalIdentifier;
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "SelectNodeV1".
 *
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "PolicyProgramV1".
 */
export interface PolicyProgramV1 {
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "InnerJoinNodeV1".
 */
export interface InnerJoinNodeV1 {
  kind: "inner_join";
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "CrossJoinNodeV1".
 */
export interface CrossJoinNodeV1 {
  kind: "cross_join";
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "DecimalLiteralNodeV1".
 */
export interface DecimalLiteralNodeV1 {
  kind: "decimal_literal";
  value: string;
  valueType: "numeric";
  nullable: false;
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "TextLiteralNodeV1".
 */
export interface TextLiteralNodeV1 {
  kind: "text_literal";
  value: string;
  valueType: "text";
  nullable: false;
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "BooleanLiteralNodeV1".
 */
export interface BooleanLiteralNodeV1 {
  kind: "boolean_literal";
  value: boolean;
  valueType: "boolean";
  nullable: false;
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "NullLiteralNodeV1".
 */
export interface NullLiteralNodeV1 {
  kind: "null_literal";
  value: null;
  valueType: "numeric" | "text" | "boolean";
  nullable: true;
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "BooleanNotNodeV1".
 */
export interface BooleanNotNodeV1 {
  kind: "boolean_not";
  operand: ExpressionNodeV1;
  valueType: "boolean";
  nullable: boolean;
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "PolicyDefinitionV1".
 */
export interface PolicyDefinitionV1 {
  kind: "keynes.policy";
  name: CanonicalIdentifier;
  revision: number;
  /**
   * @minItems 1
   * @maxItems 64
   */
  inputResources: [CanonicalIdentifier, ...CanonicalIdentifier[]];
  /**
   * @minItems 1
   * @maxItems 64
   */
  outputResources: [CanonicalIdentifier, ...CanonicalIdentifier[]];
  /**
   * @maxItems 32
   */
  contextSchema: PolicyContextFieldV1[];
  /**
   * @minItems 1
   * @maxItems 64
   */
  reasons: [CanonicalIdentifier, ...CanonicalIdentifier[]];
  programVersion: "keynes-policy-program/v1";
  queryProfileVersion: "keynes-policy-query/v1";
  validatorVersion: "keynes-policy-validator/v1";
  limitsVersion: "keynes-policy-limits/v1";
  policyProfileDigest: Digest;
  program: PolicyProgramV1;
  canonicalSql: string;
  sourceDigest: Digest;
  definitionDigest: Digest;
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
      name: CanonicalIdentifier;
      revision: number;
      sourceDigest: Digest;
      definitionDigest: Digest;
      /**
       * @maxItems 64
       */
      rows: PolicyResultRowV1[];
    },
    ...{
      name: CanonicalIdentifier;
      revision: number;
      sourceDigest: Digest;
      definitionDigest: Digest;
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
    resourceTypeId: Uuid;
    ceiling: Amount;
    /**
     * @minItems 1
     * @maxItems 16
     */
    reasons: [
      {
        policyName: CanonicalIdentifier;
        policyRevision: number;
        reason: CanonicalIdentifier;
      },
      ...{
        policyName: CanonicalIdentifier;
        policyRevision: number;
        reason: CanonicalIdentifier;
      }[],
    ];
  }[];
  decision: "approved" | "denied";
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "PolicyCeilingReasonV1".
 */
export interface PolicyCeilingReasonV1 {
  code: "policy_ceiling";
  resourceTypeId: Uuid;
  requested: Amount;
  ceiling: Amount;
  policyName: CanonicalIdentifier;
  policyRevision: number;
  reason: CanonicalIdentifier;
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "InvalidPolicyErrorEnvelope".
 */
export interface InvalidPolicyErrorEnvelope {
  kind: "error";
  code: "invalid_policy";
  details: {
    operation: "createBudget" | "requestBudget";
    policyName?: CanonicalIdentifier;
    policyRevision?: number;
    path: string;
    rule: string;
  };
}
/**
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
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
 * This interface was referenced by `KeynesPolicyContract`'s JSON-Schema
 * via the `definition` "PolicyEvaluationFailedErrorEnvelope".
 */
export interface PolicyEvaluationFailedErrorEnvelope {
  kind: "error";
  code: "policy_evaluation_failed";
  details: {
    operation: "requestBudget";
    policyName: CanonicalIdentifier;
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
