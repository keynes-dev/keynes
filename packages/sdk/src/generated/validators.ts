// Generated from contracts/. Do not edit.

import type {
  DefineResourceTypeResult,
  CreateBudgetResult,
  RequestBudgetResult,
  SettleBudgetResult,
  GetBudgetResult,
  ErrorEnvelope,
  OperationName,
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
  readonly minItems?: number;
  readonly uniqueItems?: boolean;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
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
  Amount: {
    type: "integer",
    minimum: 0,
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
  UsageAmount: {
    type: "object",
    additionalProperties: false,
    required: ["resourceTypeId", "amount"],
    properties: {
      resourceTypeId: {
        $ref: "#/$defs/Uuid",
      },
      amount: {
        oneOf: [
          {
            $ref: "#/$defs/Amount",
          },
          {
            type: "null",
          },
        ],
      },
    },
  },
  UsageEnvelope: {
    type: "array",
    minItems: 1,
    uniqueItems: true,
    items: {
      $ref: "#/$defs/UsageAmount",
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
      {
        $ref: "#/$defs/PolicyCeilingReasonV1",
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
      policyEvidence: {
        $ref: "#/$defs/PolicyEvidenceV1",
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
      policyEvidence: {
        $ref: "#/$defs/PolicyEvidenceV1",
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
  DefineResourceTypeCommand: {
    type: "object",
    additionalProperties: false,
    required: ["commandId", "definition"],
    properties: {
      commandId: {
        $ref: "#/$defs/Uuid",
      },
      definition: {
        $ref: "#/$defs/ResourceDefinition",
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
  CreateBudgetCommand: {
    type: "object",
    additionalProperties: false,
    required: ["commandId", "resources"],
    properties: {
      commandId: {
        $ref: "#/$defs/Uuid",
      },
      resources: {
        $ref: "#/$defs/ResourceEnvelope",
      },
      policies: {
        type: "array",
        uniqueItems: true,
        items: {
          $ref: "#/$defs/PolicyDefinitionV1",
        },
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
  RequestBudgetCommand: {
    type: "object",
    additionalProperties: false,
    required: ["commandId", "parentBudgetId", "resources"],
    properties: {
      commandId: {
        $ref: "#/$defs/Uuid",
      },
      parentBudgetId: {
        $ref: "#/$defs/Uuid",
      },
      resources: {
        $ref: "#/$defs/ResourceEnvelope",
      },
      context: {
        $ref: "#/$defs/PolicyContextV1",
      },
      childPolicies: {
        type: "array",
        uniqueItems: true,
        items: {
          $ref: "#/$defs/PolicyDefinitionV1",
        },
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
      policyEvidence: {
        $ref: "#/$defs/PolicyEvidenceV1",
      },
      replayed: {
        type: "boolean",
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
      policyEvidence: {
        $ref: "#/$defs/PolicyEvidenceV1",
      },
      replayed: {
        type: "boolean",
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
  SettleBudgetCommand: {
    type: "object",
    additionalProperties: false,
    required: ["commandId", "budgetId", "usage"],
    properties: {
      commandId: {
        $ref: "#/$defs/Uuid",
      },
      budgetId: {
        $ref: "#/$defs/Uuid",
      },
      usage: {
        $ref: "#/$defs/UsageEnvelope",
      },
    },
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
  GetBudgetQuery: {
    type: "object",
    additionalProperties: false,
    required: ["budgetId"],
    properties: {
      budgetId: {
        $ref: "#/$defs/Uuid",
      },
    },
  },
  GetBudgetResult: {
    type: "object",
    additionalProperties: false,
    required: ["budget", "history"],
    properties: {
      budget: {
        $ref: "#/$defs/BudgetProjection",
      },
      history: {
        $ref: "#/$defs/BudgetHistory",
      },
    },
  },
  OperationName: {
    enum: [
      "defineResource",
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
            type: "object",
            additionalProperties: false,
            required: ["resourceTypeId"],
            properties: {
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
                $ref: "#/$defs/Digest",
              },
              installedDigest: {
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
      {
        $ref: "#/$defs/InvalidPolicyErrorEnvelope",
      },
      {
        $ref: "#/$defs/InvalidPolicyContextErrorEnvelope",
      },
      {
        $ref: "#/$defs/PolicyEvaluationFailedErrorEnvelope",
      },
    ],
  },
  PolicyDigest: {
    type: "string",
    pattern: "^[0-9a-f]{64}$",
  },
  CanonicalIdentifier: {
    type: "string",
    minLength: 1,
    maxLength: 63,
    pattern: "^[a-z][a-z0-9_]{0,62}$",
  },
  PolicyScalarV1: {
    oneOf: [
      {
        type: "string",
        maxLength: 256,
        pattern: "^[^\\u0000]*$",
      },
      {
        type: "boolean",
      },
      {
        type: "integer",
        minimum: 0,
        maximum: 9007199254740991,
      },
      {
        type: "null",
      },
    ],
  },
  PolicyContextV1: {
    type: "object",
  },
  PolicyContextFieldV1: {
    type: "object",
    additionalProperties: false,
    required: ["name", "type", "nullable"],
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      type: {
        enum: ["text", "boolean", "integer"],
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  PolicyResultRowV1: {
    type: "object",
    additionalProperties: false,
    required: ["resource", "ceiling", "reason"],
    properties: {
      resource: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      ceiling: {
        type: "integer",
        minimum: 0,
        maximum: 9007199254740991,
      },
      reason: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
    },
  },
  SelectNodeV1: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "availabilityJoin",
      "resource",
      "ceiling",
      "reason",
      "where",
      "groupBy",
      "orderBy",
    ],
    properties: {
      kind: {
        const: "select",
      },
      availabilityJoin: {
        $ref: "#/$defs/JoinNodeV1",
      },
      resource: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      ceiling: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      reason: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      where: {
        oneOf: [
          {
            $ref: "#/$defs/ExpressionNodeV1",
          },
          {
            type: "null",
          },
        ],
      },
      groupBy: {
        type: "array",
        items: {
          $ref: "#/$defs/ExpressionNodeV1",
        },
      },
      orderBy: {
        const: ["resource", "reason", "ceiling"],
      },
    },
  },
  InnerJoinNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind"],
    properties: {
      kind: {
        const: "inner_join",
      },
    },
  },
  CrossJoinNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind"],
    properties: {
      kind: {
        const: "cross_join",
      },
    },
  },
  DecimalLiteralNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "value", "valueType", "nullable"],
    properties: {
      kind: {
        const: "decimal_literal",
      },
      value: {
        type: "string",
        pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        const: false,
      },
    },
  },
  TextLiteralNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "value", "valueType", "nullable"],
    properties: {
      kind: {
        const: "text_literal",
      },
      value: {
        type: "string",
        pattern: "^[^\\u0000]*$",
        maxLength: 256,
      },
      valueType: {
        const: "text",
      },
      nullable: {
        const: false,
      },
    },
  },
  BooleanLiteralNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "value", "valueType", "nullable"],
    properties: {
      kind: {
        const: "boolean_literal",
      },
      value: {
        type: "boolean",
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        const: false,
      },
    },
  },
  NullLiteralNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "value", "valueType", "nullable"],
    properties: {
      kind: {
        const: "null_literal",
      },
      value: {
        const: null,
      },
      valueType: {
        enum: ["numeric", "text", "boolean"],
      },
      nullable: {
        const: true,
      },
    },
  },
  ReferenceNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "source", "field", "valueType", "nullable"],
    properties: {
      kind: {
        const: "reference",
      },
      source: {
        enum: ["requested", "available", "context"],
      },
      field: {
        type: "string",
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      valueType: {
        enum: ["numeric", "text", "boolean"],
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  UnaryNumericNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operator", "operand", "valueType", "nullable"],
    properties: {
      kind: {
        const: "unary_numeric",
      },
      operator: {
        enum: ["+", "-"],
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  BinaryNumericNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operator", "left", "right", "valueType", "nullable"],
    properties: {
      kind: {
        const: "binary_numeric",
      },
      operator: {
        enum: ["+", "-", "*", "/", "%"],
      },
      left: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      right: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  ComparisonNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operator", "left", "right", "valueType", "nullable"],
    properties: {
      kind: {
        const: "comparison",
      },
      operator: {
        enum: ["=", "<>", "<", "<=", ">", ">="],
      },
      left: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      right: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  TextInNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operand", "values", "valueType", "nullable"],
    properties: {
      kind: {
        const: "text_in",
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      values: {
        type: "array",
        items: {
          type: "string",
          pattern: "^[^\\u0000]*$",
          maxLength: 256,
        },
        minItems: 1,
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  IsNullNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operator", "operand", "valueType", "nullable"],
    properties: {
      kind: {
        const: "is_null",
      },
      operator: {
        enum: ["is_null", "is_not_null"],
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        const: false,
      },
    },
  },
  BooleanBinaryNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operator", "left", "right", "valueType", "nullable"],
    properties: {
      kind: {
        const: "boolean_binary",
      },
      operator: {
        enum: ["and", "or"],
      },
      left: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      right: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  BooleanNotNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operand", "valueType", "nullable"],
    properties: {
      kind: {
        const: "boolean_not",
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  CaseNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "branches", "else", "valueType", "nullable"],
    properties: {
      kind: {
        const: "case",
      },
      branches: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["when", "then"],
          properties: {
            when: {
              $ref: "#/$defs/ExpressionNodeV1",
            },
            then: {
              $ref: "#/$defs/ExpressionNodeV1",
            },
          },
        },
        minItems: 1,
      },
      else: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        enum: ["numeric", "text", "boolean"],
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  VariadicNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "function", "arguments", "valueType", "nullable"],
    properties: {
      kind: {
        const: "variadic",
      },
      function: {
        enum: ["coalesce", "least", "greatest"],
      },
      arguments: {
        type: "array",
        items: {
          $ref: "#/$defs/ExpressionNodeV1",
        },
        minItems: 1,
      },
      valueType: {
        enum: ["numeric", "text", "boolean"],
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  NumericFunctionNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "function", "operand", "valueType", "nullable"],
    properties: {
      kind: {
        const: "numeric_function",
      },
      function: {
        enum: ["abs", "ceil", "floor", "sqrt"],
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  ScaleFunctionNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "function", "operand", "scale", "valueType", "nullable"],
    properties: {
      kind: {
        const: "scale_function",
      },
      function: {
        enum: ["round", "trunc"],
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      scale: {
        type: "integer",
        minimum: 0,
        maximum: 18,
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  PowerNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "base", "exponent", "valueType", "nullable"],
    properties: {
      kind: {
        const: "power",
      },
      base: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      exponent: {
        type: "integer",
        minimum: 0,
        maximum: 18,
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  AggregateNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "function", "operand", "valueType", "nullable"],
    properties: {
      kind: {
        const: "aggregate",
      },
      function: {
        enum: ["sum", "avg", "min", "max", "count"],
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  PolicyNodeV1: {
    oneOf: [
      {
        $ref: "#/$defs/SelectNodeV1",
      },
      {
        $ref: "#/$defs/InnerJoinNodeV1",
      },
      {
        $ref: "#/$defs/CrossJoinNodeV1",
      },
      {
        $ref: "#/$defs/DecimalLiteralNodeV1",
      },
      {
        $ref: "#/$defs/TextLiteralNodeV1",
      },
      {
        $ref: "#/$defs/BooleanLiteralNodeV1",
      },
      {
        $ref: "#/$defs/NullLiteralNodeV1",
      },
      {
        $ref: "#/$defs/ReferenceNodeV1",
      },
      {
        $ref: "#/$defs/UnaryNumericNodeV1",
      },
      {
        $ref: "#/$defs/BinaryNumericNodeV1",
      },
      {
        $ref: "#/$defs/ComparisonNodeV1",
      },
      {
        $ref: "#/$defs/TextInNodeV1",
      },
      {
        $ref: "#/$defs/IsNullNodeV1",
      },
      {
        $ref: "#/$defs/BooleanBinaryNodeV1",
      },
      {
        $ref: "#/$defs/BooleanNotNodeV1",
      },
      {
        $ref: "#/$defs/CaseNodeV1",
      },
      {
        $ref: "#/$defs/VariadicNodeV1",
      },
      {
        $ref: "#/$defs/NumericFunctionNodeV1",
      },
      {
        $ref: "#/$defs/ScaleFunctionNodeV1",
      },
      {
        $ref: "#/$defs/PowerNodeV1",
      },
      {
        $ref: "#/$defs/AggregateNodeV1",
      },
    ],
  },
  ExpressionNodeV1: {
    oneOf: [
      {
        $ref: "#/$defs/DecimalLiteralNodeV1",
      },
      {
        $ref: "#/$defs/TextLiteralNodeV1",
      },
      {
        $ref: "#/$defs/BooleanLiteralNodeV1",
      },
      {
        $ref: "#/$defs/NullLiteralNodeV1",
      },
      {
        $ref: "#/$defs/ReferenceNodeV1",
      },
      {
        $ref: "#/$defs/UnaryNumericNodeV1",
      },
      {
        $ref: "#/$defs/BinaryNumericNodeV1",
      },
      {
        $ref: "#/$defs/ComparisonNodeV1",
      },
      {
        $ref: "#/$defs/TextInNodeV1",
      },
      {
        $ref: "#/$defs/IsNullNodeV1",
      },
      {
        $ref: "#/$defs/BooleanBinaryNodeV1",
      },
      {
        $ref: "#/$defs/BooleanNotNodeV1",
      },
      {
        $ref: "#/$defs/CaseNodeV1",
      },
      {
        $ref: "#/$defs/VariadicNodeV1",
      },
      {
        $ref: "#/$defs/NumericFunctionNodeV1",
      },
      {
        $ref: "#/$defs/ScaleFunctionNodeV1",
      },
      {
        $ref: "#/$defs/PowerNodeV1",
      },
      {
        $ref: "#/$defs/AggregateNodeV1",
      },
    ],
  },
  JoinNodeV1: {
    oneOf: [
      {
        $ref: "#/$defs/InnerJoinNodeV1",
      },
      {
        $ref: "#/$defs/CrossJoinNodeV1",
      },
    ],
  },
  PolicyProgramV1: {
    $ref: "#/$defs/SelectNodeV1",
  },
  PolicyDefinitionV1: {
    type: "object",
  },
  PolicySetV1: {
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["definitions", "contextSchemaDigest", "setDigest"],
        properties: {
          definitions: {
            type: "array",
          },
          contextSchemaDigest: {
            type: "null",
          },
          setDigest: {
            type: "string",
            pattern: "^[0-9a-f]{64}$",
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["definitions", "contextSchemaDigest", "setDigest"],
        properties: {
          definitions: {
            type: "array",
            minItems: 1,
            items: {
              $ref: "#/$defs/PolicyDefinitionV1",
            },
          },
          contextSchemaDigest: {
            type: "string",
            pattern: "^[0-9a-f]{64}$",
          },
          setDigest: {
            type: "string",
            pattern: "^[0-9a-f]{64}$",
          },
        },
      },
    ],
  },
  PolicyEvidenceV1: {
    type: "object",
    additionalProperties: false,
    required: ["context", "policies", "effectiveCeilings", "decision"],
    properties: {
      context: {
        $ref: "#/$defs/PolicyContextV1",
      },
      policies: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "revision",
            "sourceDigest",
            "definitionDigest",
            "rows",
          ],
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 63,
              pattern: "^[a-z][a-z0-9_]{0,62}$",
            },
            revision: {
              type: "integer",
              minimum: 1,
              maximum: 9007199254740991,
            },
            sourceDigest: {
              type: "string",
              pattern: "^[0-9a-f]{64}$",
            },
            definitionDigest: {
              type: "string",
              pattern: "^[0-9a-f]{64}$",
            },
            rows: {
              type: "array",
              items: {
                $ref: "#/$defs/PolicyResultRowV1",
              },
            },
          },
        },
      },
      effectiveCeilings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["resourceTypeId", "ceiling", "reasons"],
          properties: {
            resourceTypeId: {
              type: "string",
              pattern:
                "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            },
            ceiling: {
              type: "integer",
              minimum: 0,
              maximum: 9007199254740991,
            },
            reasons: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["policyName", "policyRevision", "reason"],
                properties: {
                  policyName: {
                    type: "string",
                    minLength: 1,
                    maxLength: 63,
                    pattern: "^[a-z][a-z0-9_]{0,62}$",
                  },
                  policyRevision: {
                    type: "integer",
                    minimum: 1,
                    maximum: 9007199254740991,
                  },
                  reason: {
                    type: "string",
                    minLength: 1,
                    maxLength: 63,
                    pattern: "^[a-z][a-z0-9_]{0,62}$",
                  },
                },
              },
            },
          },
        },
      },
      decision: {
        enum: ["approved", "denied"],
      },
    },
  },
  PolicyCeilingReasonV1: {
    type: "object",
    additionalProperties: false,
    required: [
      "code",
      "resourceTypeId",
      "requested",
      "ceiling",
      "policyName",
      "policyRevision",
      "reason",
    ],
    properties: {
      code: {
        const: "policy_ceiling",
      },
      resourceTypeId: {
        type: "string",
        pattern:
          "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      },
      requested: {
        type: "integer",
        minimum: 0,
        maximum: 9007199254740991,
      },
      ceiling: {
        type: "integer",
        minimum: 0,
        maximum: 9007199254740991,
      },
      policyName: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      policyRevision: {
        type: "integer",
        minimum: 1,
        maximum: 9007199254740991,
      },
      reason: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
    },
  },
  InvalidPolicyErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "invalid_policy",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "path", "rule"],
        properties: {
          operation: {
            enum: ["createBudget", "requestBudget"],
          },
          policyName: {
            type: "string",
            minLength: 1,
            maxLength: 63,
            pattern: "^[a-z][a-z0-9_]{0,62}$",
          },
          policyRevision: {
            type: "integer",
            minimum: 1,
            maximum: 9007199254740991,
          },
          path: {
            type: "string",
            minLength: 1,
          },
          rule: {
            type: "string",
            minLength: 1,
          },
        },
      },
    },
  },
  InvalidPolicyContextErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "invalid_policy_context",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "path", "rule"],
        properties: {
          operation: {
            const: "requestBudget",
          },
          path: {
            type: "string",
            minLength: 1,
          },
          rule: {
            enum: [
              "required",
              "additionalProperties",
              "type",
              "null",
              "encoding",
              "limit",
            ],
          },
        },
      },
    },
  },
  PolicyEvaluationFailedErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "policy_evaluation_failed",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "policyName", "policyRevision", "category"],
        properties: {
          operation: {
            const: "requestBudget",
          },
          policyName: {
            type: "string",
            minLength: 1,
            maxLength: 63,
            pattern: "^[a-z][a-z0-9_]{0,62}$",
          },
          policyRevision: {
            type: "integer",
            minimum: 1,
            maximum: 9007199254740991,
          },
          category: {
            enum: [
              "limit_exceeded",
              "arithmetic_overflow",
              "numeric_domain",
              "numeric_precision",
              "invalid_result",
              "execution_failed",
            ],
          },
        },
      },
    },
  },
  PolicyErrorEnvelopeV1: {
    oneOf: [
      {
        $ref: "#/$defs/InvalidPolicyErrorEnvelope",
      },
      {
        $ref: "#/$defs/InvalidPolicyContextErrorEnvelope",
      },
      {
        $ref: "#/$defs/PolicyEvaluationFailedErrorEnvelope",
      },
    ],
  },
};

function issue(path: string, rule: string): ValidationIssue[] {
  return [{ path, rule }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    if (!isRecord(value)) return issue(path, "type");
    const properties = schema.properties ?? {};
    const issues: ValidationIssue[] = [];
    for (const name of schema.required ?? []) {
      if (!(name in value))
        issues.push(...issue(`${path}/${name}`, "required"));
    }
    if (schema.additionalProperties === false) {
      for (const name of Object.keys(value)) {
        if (!(name in properties))
          issues.push(...issue(`${path}/${name}`, "additionalProperties"));
      }
    }
    for (const [name, child] of Object.entries(properties)) {
      if (name in value)
        issues.push(...validate(child, value[name], `${path}/${name}`));
    }
    return issues;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return issue(path, "type");
    const issues: ValidationIssue[] = [];
    if (schema.minItems !== undefined && value.length < schema.minItems)
      issues.push(...issue(path, "minItems"));
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

export function validateErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return validateDefinition("ErrorEnvelope", value).length === 0;
}

export function validateDefineResourceTypeCommandIssues(
  value: unknown,
): ValidationIssue[] {
  return validateDefinition("DefineResourceTypeCommand", value);
}

export function validateCreateBudgetCommandIssues(
  value: unknown,
): ValidationIssue[] {
  return validateDefinition("CreateBudgetCommand", value);
}

export function validateRequestBudgetCommandIssues(
  value: unknown,
): ValidationIssue[] {
  return validateDefinition("RequestBudgetCommand", value);
}

export function validateSettleBudgetCommandIssues(
  value: unknown,
): ValidationIssue[] {
  return validateDefinition("SettleBudgetCommand", value);
}

export function validateGetBudgetQueryIssues(
  value: unknown,
): ValidationIssue[] {
  return validateDefinition("GetBudgetQuery", value);
}

export function validateOperationInputIssues(
  operation: OperationName,
  value: unknown,
): ValidationIssue[] {
  switch (operation) {
    case "defineResource":
      return validateDefineResourceTypeCommandIssues(value);
    case "createBudget":
      return validateCreateBudgetCommandIssues(value);
    case "requestBudget":
      return validateRequestBudgetCommandIssues(value);
    case "settleBudget":
      return validateSettleBudgetCommandIssues(value);
    case "getBudget":
      return validateGetBudgetQueryIssues(value);
    default: {
      const exhaustive: never = operation;
      throw new Error(`unknown operation: ${exhaustive}`);
    }
  }
}
