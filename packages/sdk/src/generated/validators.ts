// Generated from contracts/. Do not edit.

import type {
  DefineResourceTypeResult,
  DefineResourcesResult,
  ValidateResourcesResult,
  CreateBudgetResult,
  RequestBudgetResult,
  SettleBudgetResult,
  GetBudgetResult,
  RemoteDefineResourcesResult,
  RemoteCreateBudgetResult,
  RemoteRequestBudgetResult,
  RemoteSettleBudgetResult,
  RemoteGetBudgetResult,
  GetBudgetHistoryPageResult,
  OpenBudgetResult,
  RecoverOperationResult,
  GetCompatibilityResult,
  ErrorEnvelope,
  RemoteErrorEnvelope,
} from "./types.js";

export interface ValidationIssue {
  readonly path: string;
  readonly rule: string;
}

type Schema = {
  readonly $ref?: string;
  readonly type?: string;
  readonly const?: unknown;
  readonly enum?: readonly unknown[];
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly maxUtf8Bytes?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly maxProperties?: number;
  readonly maxCanonicalUtf8Bytes?: number;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | Schema;
  readonly propertyNames?: Schema;
  readonly properties?: Readonly<Record<string, Schema>>;
  readonly items?: Schema;
  readonly oneOf?: readonly Schema[];
};

const definitions: Readonly<Record<string, Schema>> = {
  Uuid: {
    type: "string",
    pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
  },
  Digest: {
    type: "string",
    pattern: "^[a-z][a-z0-9_-]*:[0-9a-f]{64}$",
  },
  Sha256Digest: {
    type: "string",
    pattern: "^[0-9a-f]{64}$",
  },
  Amount: {
    type: "integer",
    minimum: 0,
    maximum: 9007199254740991,
  },
  LineageBudgetId: {
    type: "integer",
    minimum: 1,
    maximum: 9007199254740991,
  },
  ResourceAmount: {
    type: "object",
    additionalProperties: false,
    required: ["resourceTypeId", "amount"],
    properties: {
      resourceTypeId: {
        $ref: "#/$defs/Uuid",
      },
      amount: {
        $ref: "#/$defs/Amount",
      },
    },
  },
  ResourceEnvelope: {
    type: "array",
    minItems: 1,
    uniqueItems: true,
    items: {
      $ref: "#/$defs/ResourceAmount",
    },
  },
  ResourceDefinition: {
    type: "object",
    additionalProperties: false,
    required: ["canonicalName", "unit", "accountingBehavior"],
    properties: {
      canonicalName: {
        type: "string",
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      unit: {
        type: "string",
        minLength: 1,
        maxLength: 64,
        pattern: "^(?!\\s)(?!.*\\s$)[^\\u0000-\\u001f\\u007f]+$",
      },
      accountingBehavior: {
        type: "string",
        enum: ["consumable", "reusable"],
      },
    },
  },
  ResourceTypeProjection: {
    type: "object",
    additionalProperties: false,
    required: [
      "resourceTypeId",
      "canonicalName",
      "unit",
      "accountingBehavior",
      "definitionDigest",
    ],
    properties: {
      resourceTypeId: {
        $ref: "#/$defs/Uuid",
      },
      canonicalName: {
        type: "string",
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      unit: {
        type: "string",
        minLength: 1,
        maxLength: 64,
      },
      accountingBehavior: {
        type: "string",
        enum: ["consumable", "reusable"],
      },
      definitionDigest: {
        $ref: "#/$defs/Digest",
      },
    },
  },
  BudgetResourceProjection: {
    type: "object",
    additionalProperties: false,
    required: [
      "resourceType",
      "allocated",
      "available",
      "committed",
      "directUsage",
      "subtreeObservedUsage",
      "unresolved",
      "deficit",
    ],
    properties: {
      resourceType: {
        $ref: "#/$defs/ResourceTypeProjection",
      },
      allocated: {
        $ref: "#/$defs/Amount",
      },
      available: {
        $ref: "#/$defs/Amount",
      },
      committed: {
        $ref: "#/$defs/Amount",
      },
      directUsage: {
        oneOf: [
          {
            $ref: "#/$defs/Amount",
          },
          {
            type: "null",
          },
        ],
      },
      subtreeObservedUsage: {
        $ref: "#/$defs/Amount",
      },
      unresolved: {
        type: "boolean",
      },
      deficit: {
        $ref: "#/$defs/Amount",
      },
    },
  },
  BudgetProjection: {
    type: "object",
    additionalProperties: false,
    required: [
      "budgetId",
      "parentBudgetId",
      "rootBudgetId",
      "depth",
      "lifecycle",
      "resources",
    ],
    properties: {
      budgetId: {
        $ref: "#/$defs/Uuid",
      },
      parentBudgetId: {
        oneOf: [
          {
            $ref: "#/$defs/Uuid",
          },
          {
            type: "null",
          },
        ],
      },
      rootBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      depth: {
        $ref: "#/$defs/Amount",
      },
      lifecycle: {
        type: "string",
        enum: ["active", "settling", "settled"],
      },
      resources: {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: {
          $ref: "#/$defs/BudgetResourceProjection",
        },
      },
    },
  },
  BudgetInspectionState: {
    type: "object",
    additionalProperties: false,
    required: [
      "budgetId",
      "parentBudgetId",
      "rootBudgetId",
      "lineageId",
      "parentLineageId",
      "depth",
      "lifecycle",
      "resources",
    ],
    properties: {
      budgetId: {
        $ref: "#/$defs/Uuid",
      },
      parentBudgetId: {
        oneOf: [
          {
            $ref: "#/$defs/Uuid",
          },
          {
            type: "null",
          },
        ],
      },
      rootBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      lineageId: {
        $ref: "#/$defs/LineageBudgetId",
      },
      parentLineageId: {
        oneOf: [
          {
            $ref: "#/$defs/LineageBudgetId",
          },
          {
            type: "null",
          },
        ],
      },
      depth: {
        $ref: "#/$defs/Amount",
      },
      lifecycle: {
        type: "string",
        enum: ["active", "settling", "settled"],
      },
      resources: {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: {
          $ref: "#/$defs/BudgetResourceProjection",
        },
      },
    },
  },
  AvailabilityDenialReason: {
    type: "object",
    additionalProperties: false,
    required: ["code", "resourceTypeId", "requested", "available"],
    properties: {
      code: {
        const: "insufficient_available",
      },
      resourceTypeId: {
        $ref: "#/$defs/Uuid",
      },
      requested: {
        $ref: "#/$defs/Amount",
      },
      available: {
        $ref: "#/$defs/Amount",
      },
    },
  },
  RequestDenialReason: {
    oneOf: [
      {
        $ref: "#/$defs/AvailabilityDenialReason",
      },
    ],
  },
  BudgetCreatedHistoryEntry: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "entryId",
      "sequence",
      "commandId",
      "subjectBudgetId",
      "rootBudgetId",
      "resources",
    ],
    properties: {
      kind: {
        const: "budget_created",
      },
      entryId: {
        $ref: "#/$defs/Uuid",
      },
      sequence: {
        $ref: "#/$defs/Amount",
      },
      commandId: {
        $ref: "#/$defs/Uuid",
      },
      subjectBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      rootBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      resources: {
        $ref: "#/$defs/ResourceEnvelope",
      },
    },
  },
  RequestApprovedHistoryEntry: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "entryId",
      "sequence",
      "commandId",
      "subjectBudgetId",
      "parentBudgetId",
      "childBudgetId",
      "resources",
    ],
    properties: {
      kind: {
        const: "request_approved",
      },
      entryId: {
        $ref: "#/$defs/Uuid",
      },
      sequence: {
        $ref: "#/$defs/Amount",
      },
      commandId: {
        $ref: "#/$defs/Uuid",
      },
      subjectBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      parentBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      childBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      resources: {
        $ref: "#/$defs/ResourceEnvelope",
      },
      decisionEvidence: {
        $ref: "#/$defs/DecisionEvidence",
      },
    },
  },
  RequestDeniedHistoryEntry: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "entryId",
      "sequence",
      "commandId",
      "subjectBudgetId",
      "parentBudgetId",
      "reasons",
    ],
    properties: {
      kind: {
        const: "request_denied",
      },
      entryId: {
        $ref: "#/$defs/Uuid",
      },
      sequence: {
        $ref: "#/$defs/Amount",
      },
      commandId: {
        $ref: "#/$defs/Uuid",
      },
      subjectBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      parentBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      reasons: {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: {
          $ref: "#/$defs/RequestDenialReason",
        },
      },
      decisionEvidence: {
        $ref: "#/$defs/DecisionEvidence",
      },
    },
  },
  BudgetSettlementRecordedHistoryEntry: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "entryId",
      "sequence",
      "commandId",
      "subjectBudgetId",
      "budgetId",
      "newlyKnown",
      "unresolvedResourceTypeIds",
      "lifecycle",
      "isolatedDeficits",
    ],
    properties: {
      kind: {
        const: "budget_settlement_recorded",
      },
      entryId: {
        $ref: "#/$defs/Uuid",
      },
      sequence: {
        $ref: "#/$defs/Amount",
      },
      commandId: {
        $ref: "#/$defs/Uuid",
      },
      subjectBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      budgetId: {
        $ref: "#/$defs/Uuid",
      },
      newlyKnown: {
        type: "array",
        uniqueItems: true,
        items: {
          $ref: "#/$defs/ResourceAmount",
        },
      },
      unresolvedResourceTypeIds: {
        type: "array",
        uniqueItems: true,
        items: {
          $ref: "#/$defs/Uuid",
        },
      },
      lifecycle: {
        enum: ["settling", "settled"],
      },
      isolatedDeficits: {
        type: "array",
        uniqueItems: true,
        items: {
          $ref: "#/$defs/ResourceAmount",
        },
      },
    },
  },
  BudgetHistoryEntry: {
    oneOf: [
      {
        $ref: "#/$defs/BudgetCreatedHistoryEntry",
      },
      {
        $ref: "#/$defs/RequestApprovedHistoryEntry",
      },
      {
        $ref: "#/$defs/RequestDeniedHistoryEntry",
      },
      {
        $ref: "#/$defs/BudgetSettlementRecordedHistoryEntry",
      },
    ],
  },
  BudgetHistory: {
    type: "object",
    additionalProperties: false,
    required: ["rootBudgetId", "entries"],
    properties: {
      rootBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      entries: {
        type: "array",
        items: {
          $ref: "#/$defs/BudgetHistoryEntry",
        },
      },
    },
  },
  DefineResourceTypeResult: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "resourceType", "definitionEvidence", "replayed"],
    properties: {
      kind: {
        const: "defined",
      },
      resourceType: {
        $ref: "#/$defs/ResourceTypeProjection",
      },
      definitionEvidence: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "commandId", "principalId", "definitionDigest"],
        properties: {
          kind: {
            const: "resource_type_defined",
          },
          commandId: {
            $ref: "#/$defs/Uuid",
          },
          principalId: {
            $ref: "#/$defs/Uuid",
          },
          definitionDigest: {
            $ref: "#/$defs/Digest",
          },
        },
      },
      replayed: {
        type: "boolean",
      },
    },
  },
  CreateBudgetResult: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "budget", "replayed"],
    properties: {
      kind: {
        const: "created",
      },
      budget: {
        $ref: "#/$defs/BudgetProjection",
      },
      replayed: {
        type: "boolean",
      },
    },
  },
  RequestApproved: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "commandId",
      "parentBudgetId",
      "childBudgetId",
      "resources",
      "replayed",
    ],
    properties: {
      kind: {
        const: "approved",
      },
      commandId: {
        $ref: "#/$defs/Uuid",
      },
      parentBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      childBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      resources: {
        $ref: "#/$defs/ResourceEnvelope",
      },
      replayed: {
        type: "boolean",
      },
      decisionEvidence: {
        $ref: "#/$defs/DecisionEvidence",
      },
    },
  },
  RequestDenied: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "commandId", "parentBudgetId", "reasons", "replayed"],
    properties: {
      kind: {
        const: "denied",
      },
      commandId: {
        $ref: "#/$defs/Uuid",
      },
      parentBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      reasons: {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: {
          $ref: "#/$defs/RequestDenialReason",
        },
      },
      replayed: {
        type: "boolean",
      },
      decisionEvidence: {
        $ref: "#/$defs/DecisionEvidence",
      },
    },
  },
  RequestBudgetResult: {
    oneOf: [
      {
        $ref: "#/$defs/RequestApproved",
      },
      {
        $ref: "#/$defs/RequestDenied",
      },
    ],
  },
  SettleBudgetResult: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "budget",
      "newlyKnown",
      "unresolvedResourceTypeIds",
      "replayed",
    ],
    properties: {
      kind: {
        enum: ["settling", "settled"],
      },
      budget: {
        $ref: "#/$defs/BudgetProjection",
      },
      newlyKnown: {
        type: "array",
        uniqueItems: true,
        items: {
          $ref: "#/$defs/ResourceAmount",
        },
      },
      unresolvedResourceTypeIds: {
        type: "array",
        uniqueItems: true,
        items: {
          $ref: "#/$defs/Uuid",
        },
      },
      replayed: {
        type: "boolean",
      },
    },
  },
  GetBudgetResult: {
    type: "object",
    additionalProperties: false,
    required: ["budget", "history"],
    properties: {
      budget: {
        $ref: "#/$defs/BudgetInspectionState",
      },
      history: {
        $ref: "#/$defs/BudgetHistory",
      },
    },
  },
  OperationKey: {
    type: "string",
    pattern: "^kop_v1_[A-Za-z0-9_-]{43}$",
  },
  BudgetReference: {
    type: "string",
    pattern: "^kbr_v1_[A-Za-z0-9_-]{43}$",
  },
  HistoryCursor: {
    type: "string",
    maxLength: 56,
    pattern: "^khc_v2_[0-9a-f]{32}_[1-9][0-9]{0,15}$",
  },
  RemoteMutationName: {
    enum: ["defineResources", "createBudget", "requestBudget", "settleBudget"],
  },
  RemoteProcedureName: {
    enum: [
      "defineResources",
      "validateResources",
      "createBudget",
      "requestBudget",
      "settleBudget",
      "getBudget",
      "getBudgetHistoryPage",
      "openBudget",
      "recoverOperation",
      "getCompatibility",
    ],
  },
  RemoteResourceAmount: {
    type: "object",
    additionalProperties: false,
    required: ["resource", "amount"],
    properties: {
      resource: {
        type: "string",
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      amount: {
        $ref: "#/$defs/Amount",
      },
    },
  },
  RemoteResourceEnvelope: {
    type: "array",
    minItems: 1,
    maxItems: 64,
    uniqueItems: true,
    items: {
      $ref: "#/$defs/RemoteResourceAmount",
    },
  },
  RemoteBudgetResourceProjection: {
    type: "object",
    additionalProperties: false,
    required: [
      "resource",
      "allocated",
      "available",
      "committed",
      "directUsage",
      "subtreeObservedUsage",
      "unresolved",
      "deficit",
    ],
    properties: {
      resource: {
        $ref: "#/$defs/ResourceDefinition",
      },
      allocated: {
        $ref: "#/$defs/Amount",
      },
      available: {
        $ref: "#/$defs/Amount",
      },
      committed: {
        $ref: "#/$defs/Amount",
      },
      directUsage: {
        oneOf: [
          {
            $ref: "#/$defs/Amount",
          },
          {
            type: "null",
          },
        ],
      },
      subtreeObservedUsage: {
        $ref: "#/$defs/Amount",
      },
      unresolved: {
        type: "boolean",
      },
      deficit: {
        $ref: "#/$defs/Amount",
      },
    },
  },
  RemoteBudgetProjection: {
    type: "object",
    additionalProperties: false,
    required: [
      "budgetReference",
      "parentBudgetReference",
      "rootBudgetReference",
      "depth",
      "lifecycle",
      "resources",
    ],
    properties: {
      budgetReference: {
        $ref: "#/$defs/BudgetReference",
      },
      parentBudgetReference: {
        oneOf: [
          {
            $ref: "#/$defs/BudgetReference",
          },
          {
            type: "null",
          },
        ],
      },
      rootBudgetReference: {
        $ref: "#/$defs/BudgetReference",
      },
      depth: {
        $ref: "#/$defs/Amount",
      },
      lifecycle: {
        type: "string",
        enum: ["active", "settling", "settled"],
      },
      resources: {
        type: "array",
        minItems: 1,
        maxItems: 64,
        uniqueItems: true,
        items: {
          $ref: "#/$defs/RemoteBudgetResourceProjection",
        },
      },
    },
  },
  RemoteBudgetInspectionProjection: {
    type: "object",
    additionalProperties: false,
    required: [
      "budgetReference",
      "lineageId",
      "parentLineageId",
      "depth",
      "lifecycle",
      "resources",
    ],
    properties: {
      budgetReference: {
        $ref: "#/$defs/BudgetReference",
      },
      lineageId: {
        $ref: "#/$defs/LineageBudgetId",
      },
      parentLineageId: {
        oneOf: [
          {
            $ref: "#/$defs/LineageBudgetId",
          },
          {
            type: "null",
          },
        ],
      },
      depth: {
        $ref: "#/$defs/Amount",
      },
      lifecycle: {
        type: "string",
        enum: ["active", "settling", "settled"],
      },
      resources: {
        type: "array",
        minItems: 1,
        maxItems: 64,
        uniqueItems: true,
        items: {
          $ref: "#/$defs/RemoteBudgetResourceProjection",
        },
      },
    },
  },
  RemoteAvailabilityDenialReason: {
    type: "object",
    additionalProperties: false,
    required: ["code", "resource", "requested", "available"],
    properties: {
      code: {
        const: "insufficient_available",
      },
      resource: {
        type: "string",
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      requested: {
        $ref: "#/$defs/Amount",
      },
      available: {
        $ref: "#/$defs/Amount",
      },
    },
  },
  RemoteRequestDenialReason: {
    oneOf: [
      {
        $ref: "#/$defs/RemoteAvailabilityDenialReason",
      },
    ],
  },
  RemoteBudgetCreatedHistoryEntry: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "sequence", "resources"],
    properties: {
      kind: {
        const: "budget_created",
      },
      sequence: {
        $ref: "#/$defs/Amount",
      },
      resources: {
        $ref: "#/$defs/RemoteResourceEnvelope",
      },
    },
  },
  RemoteRequestApprovedHistoryEntry: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "sequence", "resources"],
    properties: {
      kind: {
        const: "request_approved",
      },
      sequence: {
        $ref: "#/$defs/Amount",
      },
      resources: {
        $ref: "#/$defs/RemoteResourceEnvelope",
      },
      decisionEvidence: {
        $ref: "#/$defs/DecisionEvidence",
      },
    },
  },
  RemoteRequestDeniedHistoryEntry: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "sequence", "reasons"],
    properties: {
      kind: {
        const: "request_denied",
      },
      sequence: {
        $ref: "#/$defs/Amount",
      },
      reasons: {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: {
          $ref: "#/$defs/RemoteRequestDenialReason",
        },
      },
      decisionEvidence: {
        $ref: "#/$defs/DecisionEvidence",
      },
    },
  },
  RemoteBudgetSettlementHistoryEntry: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "sequence",
      "newlyKnown",
      "unresolvedResources",
      "lifecycle",
      "isolatedDeficits",
    ],
    properties: {
      kind: {
        const: "budget_settlement_recorded",
      },
      sequence: {
        $ref: "#/$defs/Amount",
      },
      newlyKnown: {
        type: "array",
        uniqueItems: true,
        items: {
          $ref: "#/$defs/RemoteResourceAmount",
        },
      },
      unresolvedResources: {
        type: "array",
        uniqueItems: true,
        items: {
          type: "string",
          pattern: "^[a-z][a-z0-9_]{0,62}$",
        },
      },
      lifecycle: {
        enum: ["settling", "settled"],
      },
      isolatedDeficits: {
        type: "array",
        uniqueItems: true,
        items: {
          $ref: "#/$defs/RemoteResourceAmount",
        },
      },
    },
  },
  RemoteBudgetHistoryEntry: {
    oneOf: [
      {
        $ref: "#/$defs/RemoteBudgetCreatedHistoryEntry",
      },
      {
        $ref: "#/$defs/RemoteRequestApprovedHistoryEntry",
      },
      {
        $ref: "#/$defs/RemoteRequestDeniedHistoryEntry",
      },
      {
        $ref: "#/$defs/RemoteBudgetSettlementHistoryEntry",
      },
    ],
  },
  RemoteCreateBudgetResult: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "budget", "replayed"],
    properties: {
      kind: {
        const: "created",
      },
      budget: {
        $ref: "#/$defs/RemoteBudgetProjection",
      },
      replayed: {
        type: "boolean",
      },
    },
  },
  RemoteRequestApprovedResult: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "parentBudgetReference",
      "childBudgetReference",
      "resources",
      "replayed",
    ],
    properties: {
      kind: {
        const: "approved",
      },
      parentBudgetReference: {
        $ref: "#/$defs/BudgetReference",
      },
      childBudgetReference: {
        $ref: "#/$defs/BudgetReference",
      },
      resources: {
        $ref: "#/$defs/RemoteResourceEnvelope",
      },
      replayed: {
        type: "boolean",
      },
      decisionEvidence: {
        $ref: "#/$defs/DecisionEvidence",
      },
    },
  },
  RemoteRequestDeniedResult: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "parentBudgetReference", "reasons", "replayed"],
    properties: {
      kind: {
        const: "denied",
      },
      parentBudgetReference: {
        $ref: "#/$defs/BudgetReference",
      },
      reasons: {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: {
          $ref: "#/$defs/RemoteRequestDenialReason",
        },
      },
      replayed: {
        type: "boolean",
      },
      decisionEvidence: {
        $ref: "#/$defs/DecisionEvidence",
      },
    },
  },
  RemoteRequestBudgetResult: {
    oneOf: [
      {
        $ref: "#/$defs/RemoteRequestApprovedResult",
      },
      {
        $ref: "#/$defs/RemoteRequestDeniedResult",
      },
    ],
  },
  RemoteSettleBudgetResult: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "budget",
      "newlyKnown",
      "unresolvedResources",
      "replayed",
    ],
    properties: {
      kind: {
        enum: ["settling", "settled"],
      },
      budget: {
        $ref: "#/$defs/RemoteBudgetProjection",
      },
      newlyKnown: {
        type: "array",
        uniqueItems: true,
        items: {
          $ref: "#/$defs/RemoteResourceAmount",
        },
      },
      unresolvedResources: {
        type: "array",
        uniqueItems: true,
        items: {
          type: "string",
          pattern: "^[a-z][a-z0-9_]{0,62}$",
        },
      },
      replayed: {
        type: "boolean",
      },
    },
  },
  RemoteGetBudgetResult: {
    type: "object",
    additionalProperties: false,
    required: ["budget"],
    properties: {
      budget: {
        $ref: "#/$defs/RemoteBudgetProjection",
      },
    },
  },
  GetBudgetHistoryPageResult: {
    type: "object",
    additionalProperties: false,
    required: ["budgetReference", "budget", "entries", "nextCursor"],
    properties: {
      budgetReference: {
        $ref: "#/$defs/BudgetReference",
      },
      budget: {
        $ref: "#/$defs/RemoteBudgetInspectionProjection",
      },
      entries: {
        type: "array",
        maxItems: 256,
        items: {
          $ref: "#/$defs/RemoteBudgetHistoryEntry",
        },
      },
      nextCursor: {
        oneOf: [
          {
            $ref: "#/$defs/HistoryCursor",
          },
          {
            type: "null",
          },
        ],
      },
    },
  },
  OpenBudgetResult: {
    type: "object",
    additionalProperties: false,
    required: ["budgetReference", "budget"],
    properties: {
      budgetReference: {
        $ref: "#/$defs/BudgetReference",
      },
      budget: {
        $ref: "#/$defs/RemoteBudgetProjection",
      },
    },
  },
  RecoveredCommittedDefineResources: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operationKey", "operation", "result"],
    properties: {
      kind: {
        const: "committed",
      },
      operationKey: {
        $ref: "#/$defs/OperationKey",
      },
      operation: {
        const: "defineResources",
      },
      result: {
        $ref: "#/$defs/RemoteDefineResourcesResult",
      },
    },
  },
  RecoveredCommittedCreateBudget: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operationKey", "operation", "result"],
    properties: {
      kind: {
        const: "committed",
      },
      operationKey: {
        $ref: "#/$defs/OperationKey",
      },
      operation: {
        const: "createBudget",
      },
      result: {
        $ref: "#/$defs/RemoteCreateBudgetResult",
      },
    },
  },
  RecoveredCommittedRequestBudget: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operationKey", "operation", "result"],
    properties: {
      kind: {
        const: "committed",
      },
      operationKey: {
        $ref: "#/$defs/OperationKey",
      },
      operation: {
        const: "requestBudget",
      },
      result: {
        $ref: "#/$defs/RemoteRequestBudgetResult",
      },
    },
  },
  RecoveredCommittedSettleBudget: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operationKey", "operation", "result"],
    properties: {
      kind: {
        const: "committed",
      },
      operationKey: {
        $ref: "#/$defs/OperationKey",
      },
      operation: {
        const: "settleBudget",
      },
      result: {
        $ref: "#/$defs/RemoteSettleBudgetResult",
      },
    },
  },
  RecoveredCommittedOperation: {
    oneOf: [
      {
        $ref: "#/$defs/RecoveredCommittedDefineResources",
      },
      {
        $ref: "#/$defs/RecoveredCommittedCreateBudget",
      },
      {
        $ref: "#/$defs/RecoveredCommittedRequestBudget",
      },
      {
        $ref: "#/$defs/RecoveredCommittedSettleBudget",
      },
    ],
  },
  RecoveredKnownFailure: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operationKey", "error"],
    properties: {
      kind: {
        const: "known_failure",
      },
      operationKey: {
        $ref: "#/$defs/OperationKey",
      },
      error: {
        $ref: "#/$defs/RemoteDefinitiveErrorEnvelope",
      },
    },
  },
  UnresolvedOperation: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operationKey"],
    properties: {
      kind: {
        const: "unresolved",
      },
      operationKey: {
        $ref: "#/$defs/OperationKey",
      },
      retryAfterMilliseconds: {
        type: "integer",
        minimum: 0,
        maximum: 9007199254740991,
      },
    },
  },
  ExpiredOperation: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operationKey"],
    properties: {
      kind: {
        const: "expired",
      },
      operationKey: {
        $ref: "#/$defs/OperationKey",
      },
    },
  },
  RecoverOperationResult: {
    oneOf: [
      {
        $ref: "#/$defs/RecoveredCommittedOperation",
      },
      {
        $ref: "#/$defs/RecoveredKnownFailure",
      },
      {
        $ref: "#/$defs/UnresolvedOperation",
      },
      {
        $ref: "#/$defs/ExpiredOperation",
      },
    ],
  },
  RemoteProcedureCapability: {
    type: "object",
    additionalProperties: false,
    required: ["name", "target", "revision"],
    properties: {
      name: {
        $ref: "#/$defs/RemoteProcedureName",
      },
      target: {
        type: "string",
        pattern: "^keynes\\.remote_[a-z_]+$",
      },
      revision: {
        type: "integer",
        minimum: 1,
        maximum: 9007199254740991,
      },
    },
  },
  GetCompatibilityResult: {
    type: "object",
    additionalProperties: false,
    required: [
      "installationId",
      "contractDigest",
      "remoteProceduresDigest",
      "semanticGeneration",
      "minimumSdkGeneration",
      "procedures",
    ],
    properties: {
      installationId: {
        type: "string",
        minLength: 1,
        maxLength: 128,
      },
      contractDigest: {
        $ref: "#/$defs/Sha256Digest",
      },
      remoteProceduresDigest: {
        $ref: "#/$defs/Sha256Digest",
      },
      semanticGeneration: {
        type: "integer",
        minimum: 1,
        maximum: 9007199254740991,
      },
      minimumSdkGeneration: {
        type: "integer",
        minimum: 1,
        maximum: 9007199254740991,
      },
      procedures: {
        type: "array",
        minItems: 10,
        maxItems: 10,
        uniqueItems: true,
        items: {
          $ref: "#/$defs/RemoteProcedureCapability",
        },
      },
    },
  },
  EmptyRemoteErrorDetails: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  RemoteSimpleErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        enum: [
          "invalid_configuration",
          "tls_error",
          "authentication_failed",
          "client_closed",
          "unknown",
        ],
      },
      details: {
        $ref: "#/$defs/EmptyRemoteErrorDetails",
      },
    },
  },
  RemoteInvalidCommandErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "invalid_command",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "issues"],
        properties: {
          operation: {
            $ref: "#/$defs/RemoteProcedureName",
          },
          issues: {
            type: "array",
            minItems: 1,
            uniqueItems: true,
            items: {
              $ref: "#/$defs/ValidationIssue",
            },
          },
        },
      },
    },
  },
  RemoteUnauthorizedErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "unauthorized",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "requiredPermission"],
        properties: {
          operation: {
            $ref: "#/$defs/RemoteProcedureName",
          },
          requiredPermission: {
            const: "remote_access",
          },
        },
      },
    },
  },
  RemoteDefinitiveDomainErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        enum: [
          "command_conflict",
          "resource_type_conflict",
          "resource_type_not_found",
          "budget_not_found",
          "budget_not_active",
          "usage_conflict",
          "arithmetic_error",
        ],
      },
      details: {
        $ref: "#/$defs/EmptyRemoteErrorDetails",
      },
    },
  },
  ResourceBindingMismatchErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "resource_binding_mismatch",
      },
      details: {
        $ref: "#/$defs/EmptyRemoteErrorDetails",
      },
    },
  },
  CompatibilityErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "compatibility_error",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["category"],
        properties: {
          category: {
            enum: [
              "installation",
              "command_contract",
              "remote_procedures",
              "sdk_generation",
            ],
          },
        },
      },
    },
  },
  RemoteLimitExceededErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "limit_exceeded",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["limit", "maximum"],
        properties: {
          limit: {
            enum: [
              "pool_size",
              "waiting_callers",
              "history_page",
              "inspection_pages",
            ],
          },
          maximum: {
            type: "integer",
            minimum: 1,
            maximum: 9007199254740991,
          },
        },
      },
    },
  },
  RemoteRetryableErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        enum: ["rate_limited", "unavailable"],
      },
      details: {
        type: "object",
        additionalProperties: false,
        properties: {
          retryAfterMilliseconds: {
            type: "integer",
            minimum: 0,
            maximum: 9007199254740991,
          },
        },
      },
    },
  },
  RemoteTimeoutErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "timeout",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation"],
        properties: {
          operation: {
            $ref: "#/$defs/RemoteProcedureName",
          },
          operationKey: {
            $ref: "#/$defs/OperationKey",
          },
        },
      },
    },
  },
  UncertainOutcomeErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "uncertain_outcome",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "operationKey"],
        properties: {
          operation: {
            $ref: "#/$defs/RemoteMutationName",
          },
          operationKey: {
            $ref: "#/$defs/OperationKey",
          },
        },
      },
    },
  },
  RemoteDefinitiveErrorEnvelope: {
    oneOf: [
      {
        $ref: "#/$defs/RemoteInvalidCommandErrorEnvelope",
      },
      {
        $ref: "#/$defs/RemoteUnauthorizedErrorEnvelope",
      },
      {
        $ref: "#/$defs/RemoteDefinitiveDomainErrorEnvelope",
      },
      {
        $ref: "#/$defs/ResourceBindingMismatchErrorEnvelope",
      },
      {
        $ref: "#/$defs/CompatibilityErrorEnvelope",
      },
      {
        $ref: "#/$defs/RemoteLimitExceededErrorEnvelope",
      },
    ],
  },
  RemoteErrorEnvelope: {
    oneOf: [
      {
        $ref: "#/$defs/RemoteDefinitiveErrorEnvelope",
      },
      {
        $ref: "#/$defs/RemoteSimpleErrorEnvelope",
      },
      {
        $ref: "#/$defs/RemoteRetryableErrorEnvelope",
      },
      {
        $ref: "#/$defs/RemoteTimeoutErrorEnvelope",
      },
      {
        $ref: "#/$defs/UncertainOutcomeErrorEnvelope",
      },
    ],
  },
  OperationName: {
    enum: [
      "defineResource",
      "defineResources",
      "validateResources",
      "createBudget",
      "requestBudget",
      "settleBudget",
      "getBudget",
    ],
  },
  PermissionName: {
    enum: [
      "define_resource_type",
      "create_root_budget",
      "request_budget",
      "settle_budget",
      "read_budget",
    ],
  },
  ValidationIssue: {
    type: "object",
    additionalProperties: false,
    required: ["path", "rule"],
    properties: {
      path: {
        type: "string",
      },
      rule: {
        type: "string",
      },
    },
  },
  ErrorEnvelope: {
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "details"],
        properties: {
          kind: {
            const: "error",
          },
          code: {
            const: "invalid_command",
          },
          details: {
            type: "object",
            additionalProperties: false,
            required: ["operation", "issues"],
            properties: {
              operation: {
                $ref: "#/$defs/OperationName",
              },
              issues: {
                type: "array",
                minItems: 1,
                uniqueItems: true,
                items: {
                  $ref: "#/$defs/ValidationIssue",
                },
              },
            },
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "details"],
        properties: {
          kind: {
            const: "error",
          },
          code: {
            const: "unauthorized",
          },
          details: {
            type: "object",
            additionalProperties: false,
            required: ["operation", "requiredPermission"],
            properties: {
              operation: {
                $ref: "#/$defs/OperationName",
              },
              requiredPermission: {
                $ref: "#/$defs/PermissionName",
              },
            },
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "details"],
        properties: {
          kind: {
            const: "error",
          },
          code: {
            const: "command_conflict",
          },
          details: {
            type: "object",
            additionalProperties: false,
            required: ["commandId", "existingOperation", "attemptedOperation"],
            properties: {
              commandId: {
                $ref: "#/$defs/Uuid",
              },
              existingOperation: {
                $ref: "#/$defs/OperationName",
              },
              attemptedOperation: {
                $ref: "#/$defs/OperationName",
              },
            },
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "details"],
        properties: {
          kind: {
            const: "error",
          },
          code: {
            const: "resource_type_conflict",
          },
          details: {
            type: "object",
            additionalProperties: false,
            required: [
              "canonicalName",
              "existingDefinitionDigest",
              "attemptedDefinitionDigest",
            ],
            properties: {
              canonicalName: {
                type: "string",
                pattern: "^[a-z][a-z0-9_]{0,62}$",
              },
              existingDefinitionDigest: {
                $ref: "#/$defs/Digest",
              },
              attemptedDefinitionDigest: {
                $ref: "#/$defs/Digest",
              },
            },
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "details"],
        properties: {
          kind: {
            const: "error",
          },
          code: {
            const: "resource_type_not_found",
          },
          details: {
            oneOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["resourceTypeId"],
                properties: {
                  resourceTypeId: {
                    $ref: "#/$defs/Uuid",
                  },
                },
              },
              {
                type: "object",
                additionalProperties: false,
                required: ["canonicalName"],
                properties: {
                  canonicalName: {
                    type: "string",
                    pattern: "^[a-z][a-z0-9_]{0,62}$",
                  },
                },
              },
            ],
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "details"],
        properties: {
          kind: {
            const: "error",
          },
          code: {
            const: "budget_not_found",
          },
          details: {
            type: "object",
            additionalProperties: false,
            required: ["budgetId"],
            properties: {
              budgetId: {
                $ref: "#/$defs/Uuid",
              },
            },
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "details"],
        properties: {
          kind: {
            const: "error",
          },
          code: {
            const: "budget_not_active",
          },
          details: {
            type: "object",
            additionalProperties: false,
            required: ["budgetId", "lifecycle"],
            properties: {
              budgetId: {
                $ref: "#/$defs/Uuid",
              },
              lifecycle: {
                enum: ["active", "settling", "settled"],
              },
            },
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "details"],
        properties: {
          kind: {
            const: "error",
          },
          code: {
            const: "usage_conflict",
          },
          details: {
            type: "object",
            additionalProperties: false,
            required: ["budgetId", "resourceTypeId", "existing", "attempted"],
            properties: {
              budgetId: {
                $ref: "#/$defs/Uuid",
              },
              resourceTypeId: {
                $ref: "#/$defs/Uuid",
              },
              existing: {
                $ref: "#/$defs/Amount",
              },
              attempted: {
                $ref: "#/$defs/Amount",
              },
            },
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "details"],
        properties: {
          kind: {
            const: "error",
          },
          code: {
            const: "arithmetic_error",
          },
          details: {
            type: "object",
            additionalProperties: false,
            required: ["operation", "resourceTypeId"],
            properties: {
              operation: {
                $ref: "#/$defs/OperationName",
              },
              resourceTypeId: {
                $ref: "#/$defs/Uuid",
              },
            },
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "details"],
        properties: {
          kind: {
            const: "error",
          },
          code: {
            const: "contract_mismatch",
          },
          details: {
            type: "object",
            additionalProperties: false,
            required: ["clientDigest", "installedDigest"],
            properties: {
              clientDigest: {
                $ref: "#/$defs/Sha256Digest",
              },
              installedDigest: {
                $ref: "#/$defs/Sha256Digest",
              },
            },
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "code", "details"],
        properties: {
          kind: {
            const: "error",
          },
          code: {
            const: "installation_drift",
          },
          details: {
            type: "object",
            additionalProperties: false,
            required: ["migrationId", "expectedChecksum", "actualChecksum"],
            properties: {
              migrationId: {
                type: "string",
                minLength: 1,
              },
              expectedChecksum: {
                $ref: "#/$defs/Digest",
              },
              actualChecksum: {
                $ref: "#/$defs/Digest",
              },
            },
          },
        },
      },
    ],
  },
  ResourceBindingReference: {
    type: "string",
    pattern: "^krs_v1_[A-Za-z0-9_-]{43}$",
  },
  DefinedResourceMember: {
    type: "object",
    additionalProperties: false,
    required: ["key", "resourceType", "definitionEvidence"],
    properties: {
      key: {
        type: "string",
        pattern: "^[a-z][A-Za-z0-9]*$",
      },
      resourceType: {
        $ref: "#/$defs/ResourceTypeProjection",
      },
      definitionEvidence: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "commandId", "principalId", "definitionDigest"],
        properties: {
          kind: {
            const: "resource_type_defined",
          },
          commandId: {
            $ref: "#/$defs/Uuid",
          },
          principalId: {
            $ref: "#/$defs/Uuid",
          },
          definitionDigest: {
            $ref: "#/$defs/Digest",
          },
        },
      },
    },
  },
  DefineResourcesResult: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "bindingReference", "resources", "replayed"],
    properties: {
      kind: {
        const: "defined",
      },
      bindingReference: {
        $ref: "#/$defs/ResourceBindingReference",
      },
      resources: {
        type: "array",
        minItems: 1,
        items: {
          $ref: "#/$defs/DefinedResourceMember",
        },
      },
      replayed: {
        type: "boolean",
      },
    },
  },
  RemoteDefineResourcesResult: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "bindingReference", "resources", "replayed"],
    properties: {
      kind: {
        const: "defined",
      },
      bindingReference: {
        $ref: "#/$defs/ResourceBindingReference",
      },
      resources: {
        type: "array",
        minItems: 1,
        items: {
          $ref: "#/$defs/DefinedResourceMember",
        },
      },
      replayed: {
        type: "boolean",
      },
    },
  },
  ValidateResourcesResult: {
    type: "object",
    additionalProperties: false,
    required: ["valid"],
    properties: {
      valid: {
        const: true,
      },
    },
  },
  DecisionEvidence: {
    type: "object",
    additionalProperties: {
      oneOf: [
        {
          type: "string",
          maxUtf8Bytes: 256,
          pattern: "^[^\\u0000\\ud800-\\udfff]*$",
        },
        {
          type: "boolean",
        },
        {
          type: "null",
        },
        {
          $ref: "#/$defs/Amount",
        },
      ],
    },
    propertyNames: {
      type: "string",
      pattern: "^[a-z][a-z0-9_]{0,62}$",
    },
    maxProperties: 32,
    maxCanonicalUtf8Bytes: 8192,
  },
};

function issue(path: string, rule: string): ValidationIssue[] {
  return [{ path, rule }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlainDataObject(value: Record<string, unknown>): boolean {
  if (
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Object.getOwnPropertySymbols(value).length > 0
  )
    return false;
  return Object.getOwnPropertyNames(value).every((name) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    return (
      descriptor !== undefined && descriptor.enumerable && "value" in descriptor
    );
  });
}

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => sameJson(item, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && sameJson(left[key], right[key]),
    )
  );
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function validate(
  schema: Schema,
  value: unknown,
  path: string,
): ValidationIssue[] {
  if (schema.$ref !== undefined) {
    const name = schema.$ref.slice("#/$defs/".length);
    const definition = definitions[name];
    return definition === undefined
      ? issue(path, "unknown-reference")
      : validate(definition, value, path);
  }
  if (schema.oneOf !== undefined) {
    const matches = schema.oneOf.filter(
      (candidate) => validate(candidate, value, path).length === 0,
    );
    return matches.length === 1 ? [] : issue(path, "oneOf");
  }
  if (schema.const !== undefined && !sameJson(value, schema.const))
    return issue(path, "const");
  if (
    schema.enum !== undefined &&
    !schema.enum.some((item) => sameJson(item, value))
  )
    return issue(path, "enum");

  if (schema.type === "object") {
    if (
      !isRecord(value) ||
      (schema.maxCanonicalUtf8Bytes !== undefined && !isPlainDataObject(value))
    )
      return issue(path, "type");
    const properties = schema.properties ?? {};
    const names = Object.keys(value);
    const issues: ValidationIssue[] = [];
    if (
      schema.maxProperties !== undefined &&
      names.length > schema.maxProperties
    )
      issues.push(...issue(path, "maxProperties"));
    for (const name of schema.required ?? []) {
      if (!Object.hasOwn(value, name))
        issues.push(...issue(`${path}/${name}`, "required"));
    }
    for (const name of names) {
      if (
        schema.propertyNames !== undefined &&
        validate(schema.propertyNames, name, `${path}/${name}`).length > 0
      )
        issues.push(...issue(`${path}/${name}`, "propertyNames"));
      if (!Object.hasOwn(properties, name)) {
        if (schema.additionalProperties === false)
          issues.push(...issue(`${path}/${name}`, "additionalProperties"));
        else if (typeof schema.additionalProperties === "object")
          issues.push(
            ...validate(
              schema.additionalProperties,
              value[name],
              `${path}/${name}`,
            ),
          );
      }
    }
    for (const [name, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, name))
        issues.push(...validate(child, value[name], `${path}/${name}`));
    }
    if (
      issues.length === 0 &&
      schema.maxCanonicalUtf8Bytes !== undefined &&
      utf8Length(JSON.stringify(value)) > schema.maxCanonicalUtf8Bytes
    )
      issues.push(...issue(path, "maxCanonicalUtf8Bytes"));
    return issues;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return issue(path, "type");
    const issues: ValidationIssue[] = [];
    if (schema.minItems !== undefined && value.length < schema.minItems)
      issues.push(...issue(path, "minItems"));
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      issues.push(...issue(path, "maxItems"));
    if (schema.uniqueItems === true) {
      if (
        value.some((item, index) =>
          value.slice(0, index).some((candidate) => sameJson(candidate, item)),
        )
      )
        issues.push(...issue(path, "uniqueItems"));
    }
    if (schema.items !== undefined)
      value.forEach((item, index) =>
        issues.push(...validate(schema.items!, item, `${path}/${index}`)),
      );
    return issues;
  }
  if (schema.type === "string") {
    if (typeof value !== "string") return issue(path, "type");
    if (schema.minLength !== undefined && value.length < schema.minLength)
      return issue(path, "minLength");
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      return issue(path, "maxLength");
    if (
      schema.maxUtf8Bytes !== undefined &&
      utf8Length(value) > schema.maxUtf8Bytes
    )
      return issue(path, "maxUtf8Bytes");
    if (
      schema.pattern !== undefined &&
      !new RegExp(schema.pattern, "u").test(value)
    )
      return issue(path, "pattern");
    return [];
  }
  if (schema.type === "integer") {
    if (!Number.isSafeInteger(value)) return issue(path, "type");
    if (schema.minimum !== undefined && Number(value) < schema.minimum)
      return issue(path, "minimum");
    if (schema.maximum !== undefined && Number(value) > schema.maximum)
      return issue(path, "maximum");
    return [];
  }
  if (schema.type === "number")
    return typeof value === "number" && Number.isFinite(value)
      ? []
      : issue(path, "type");
  if (schema.type === "boolean")
    return typeof value === "boolean" ? [] : issue(path, "type");
  if (schema.type === "null") return value === null ? [] : issue(path, "type");
  return schema.type === undefined ? [] : issue(path, "unsupported-type");
}

function validateDefinition(name: string, value: unknown): ValidationIssue[] {
  const definition = definitions[name];
  const issues =
    definition === undefined
      ? issue("", "unknown-definition")
      : validate(definition, value, "");
  return issues.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.rule.localeCompare(right.rule),
  );
}

export function validateDefineResourceTypeResult(
  value: unknown,
): value is DefineResourceTypeResult {
  return validateDefinition("DefineResourceTypeResult", value).length === 0;
}

export function validateDefineResourcesResult(
  value: unknown,
): value is DefineResourcesResult {
  return validateDefinition("DefineResourcesResult", value).length === 0;
}

export function validateValidateResourcesResult(
  value: unknown,
): value is ValidateResourcesResult {
  return validateDefinition("ValidateResourcesResult", value).length === 0;
}

export function validateCreateBudgetResult(
  value: unknown,
): value is CreateBudgetResult {
  return validateDefinition("CreateBudgetResult", value).length === 0;
}

export function validateRequestBudgetResult(
  value: unknown,
): value is RequestBudgetResult {
  return validateDefinition("RequestBudgetResult", value).length === 0;
}

export function validateSettleBudgetResult(
  value: unknown,
): value is SettleBudgetResult {
  return validateDefinition("SettleBudgetResult", value).length === 0;
}

export function validateGetBudgetResult(
  value: unknown,
): value is GetBudgetResult {
  return validateDefinition("GetBudgetResult", value).length === 0;
}

export function validateRemoteDefineResourcesResult(
  value: unknown,
): value is RemoteDefineResourcesResult {
  return validateDefinition("RemoteDefineResourcesResult", value).length === 0;
}

export function validateRemoteCreateBudgetResult(
  value: unknown,
): value is RemoteCreateBudgetResult {
  return validateDefinition("RemoteCreateBudgetResult", value).length === 0;
}

export function validateRemoteRequestBudgetResult(
  value: unknown,
): value is RemoteRequestBudgetResult {
  return validateDefinition("RemoteRequestBudgetResult", value).length === 0;
}

export function validateRemoteSettleBudgetResult(
  value: unknown,
): value is RemoteSettleBudgetResult {
  return validateDefinition("RemoteSettleBudgetResult", value).length === 0;
}

export function validateRemoteGetBudgetResult(
  value: unknown,
): value is RemoteGetBudgetResult {
  return validateDefinition("RemoteGetBudgetResult", value).length === 0;
}

export function validateGetBudgetHistoryPageResult(
  value: unknown,
): value is GetBudgetHistoryPageResult {
  return validateDefinition("GetBudgetHistoryPageResult", value).length === 0;
}

export function validateOpenBudgetResult(
  value: unknown,
): value is OpenBudgetResult {
  return validateDefinition("OpenBudgetResult", value).length === 0;
}

export function validateRecoverOperationResult(
  value: unknown,
): value is RecoverOperationResult {
  return validateDefinition("RecoverOperationResult", value).length === 0;
}

export function validateGetCompatibilityResult(
  value: unknown,
): value is GetCompatibilityResult {
  return validateDefinition("GetCompatibilityResult", value).length === 0;
}

export function validateErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return validateDefinition("ErrorEnvelope", value).length === 0;
}

export function validateRemoteErrorEnvelope(
  value: unknown,
): value is RemoteErrorEnvelope {
  return validateDefinition("RemoteErrorEnvelope", value).length === 0;
}
