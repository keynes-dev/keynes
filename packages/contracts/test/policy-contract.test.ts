import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { canonicalizePolicyCommand } from "../contract-tests/index.ts";
import policySchema from "../generated/policy-schema.json" with { type: "json" };
import type {
  BudgetHistory,
  ErrorEnvelope,
  RequestApproved,
  RequestBudgetCommand,
} from "../generated/types.ts";
import { canonicalJson } from "../src/index.ts";

const digest = "a".repeat(64);
const resourceTypeId = "10000000-0000-0000-0000-000000000001";
const rootBudgetId = "20000000-0000-0000-0000-000000000001";
const childBudgetId = "30000000-0000-0000-0000-000000000001";

const ajv = new Ajv2020({ strict: true });
ajv.addKeyword({
  keyword: "maxUtf8Bytes",
  type: "string",
  schemaType: "number",
  validate: (limit: number, value: string) =>
    new TextEncoder().encode(value).byteLength <= limit,
});
ajv.addKeyword({
  keyword: "maxCanonicalUtf8Bytes",
  type: "object",
  schemaType: "number",
  validate: (limit: number, value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).byteLength <= limit,
});
ajv.addSchema(policySchema, policySchema.$id);

describe("neutral Policy contract", () => {
  it("declares the complete versioned Policy definition", () => {
    const definition = policySchema.$defs.PolicyDefinitionV1;

    expect(definition).toMatchObject({
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { const: "keynes.policy" },
        name: { type: "string" },
        revision: { type: "integer" },
        inputResources: { type: "array" },
        outputResources: { type: "array" },
        contextSchema: { type: "array" },
        reasons: { type: "array" },
        programVersion: { const: "keynes-policy-program/v1" },
        queryProfileVersion: { const: "keynes-policy-query/v1" },
        validatorVersion: { const: "keynes-policy-validator/v1" },
        limitsVersion: { const: "keynes-policy-limits/v1" },
        policyProfileDigest: { $ref: "#/$defs/Digest" },
        program: { $ref: "#/$defs/PolicyProgramV1" },
        canonicalSql: { type: "string" },
        sourceDigest: { $ref: "#/$defs/Digest" },
        definitionDigest: { $ref: "#/$defs/Digest" },
      },
    });
    expect(definition.required).toEqual(
      expect.arrayContaining([
        "kind",
        "name",
        "revision",
        "inputResources",
        "outputResources",
        "contextSchema",
        "reasons",
        "programVersion",
        "queryProfileVersion",
        "validatorVersion",
        "limitsVersion",
        "policyProfileDigest",
        "program",
        "canonicalSql",
        "sourceDigest",
        "definitionDigest",
      ]),
    );
  });

  it("accepts the canonical empty Policy set and rejects a non-null schema digest", () => {
    const validate = validator("PolicySetV1");

    expect(
      validate({
        definitions: [],
        contextSchemaDigest: null,
        setDigest: digest,
      }),
      JSON.stringify(validate.errors),
    ).toBe(true);
    expect(
      validate({
        definitions: [],
        contextSchemaDigest: digest,
        setDigest: digest,
      }),
    ).toBe(false);
  });

  it("accepts only neutral Policy scalar context values", () => {
    const validate = validator("PolicyContextV1");

    expect(
      validate({
        customer_tier: "standard",
        manual_review: false,
        retry_count: 2,
        risk_class: null,
      }),
      JSON.stringify(validate.errors),
    ).toBe(true);
    expect(validate({ nested: { secret: "not-a-scalar" } })).toBe(false);
    expect(validate({ unsafe_integer: Number.MAX_SAFE_INTEGER + 1 })).toBe(
      false,
    );
    expect(validate({ oversized_text: "😀".repeat(65) })).toBe(false);
    expect(validate({ oversized_context: "x".repeat(8192) })).toBe(false);
  });

  it("enforces the text profile on every Policy text value", () => {
    const validate = validator("PolicyNodeV1");
    const operand = {
      kind: "text_literal",
      value: "tier",
      valueType: "text",
      nullable: false,
    };

    expect(validate({ ...operand, value: "😀".repeat(65) })).toBe(false);
    expect(
      validate({
        kind: "text_in",
        operand,
        values: ["forbidden\u0000member"],
        valueType: "boolean",
        nullable: false,
      }),
    ).toBe(false);
  });

  it("accepts canonical decision evidence", () => {
    const validate = validator("PolicyEvidenceV1");
    const evidence = {
      context: { customer_tier: "standard", risk_class: null },
      policies: [
        {
          name: "request_limit",
          revision: 3,
          sourceDigest: digest,
          definitionDigest: digest,
          rows: [
            {
              resource: "model_tokens",
              ceiling: 40,
              reason: "customer_tier_limit",
            },
          ],
        },
      ],
      effectiveCeilings: [
        {
          resourceTypeId,
          ceiling: 40,
          reasons: [
            {
              policyName: "request_limit",
              policyRevision: 3,
              reason: "customer_tier_limit",
            },
          ],
        },
      ],
      decision: "denied",
    };

    expect(validate(evidence), JSON.stringify(validate.errors)).toBe(true);
  });

  it("accepts the Policy denial reason without weakening the legacy variant", () => {
    const validate = validator("PolicyCeilingReasonV1");

    expect(
      validate({
        code: "policy_ceiling",
        resourceTypeId,
        requested: 50,
        ceiling: 40,
        policyName: "request_limit",
        policyRevision: 3,
        reason: "customer_tier_limit",
      }),
      JSON.stringify(validate.errors),
    ).toBe(true);
    expect(
      validate({
        code: "insufficient_available",
        resourceTypeId,
        requested: 50,
        available: 40,
      }),
    ).toBe(false);
  });

  it.each([
    {
      definition: "InvalidPolicyErrorEnvelope",
      value: {
        kind: "error",
        code: "invalid_policy",
        details: {
          operation: "createBudget",
          policyName: "request_limit",
          policyRevision: 3,
          path: "/policies/0/program",
          rule: "unsupported_node",
        },
      },
    },
    {
      definition: "InvalidPolicyContextErrorEnvelope",
      value: {
        kind: "error",
        code: "invalid_policy_context",
        details: {
          operation: "requestBudget",
          path: "/context/customer_tier",
          rule: "required",
        },
      },
    },
    {
      definition: "PolicyEvaluationFailedErrorEnvelope",
      value: {
        kind: "error",
        code: "policy_evaluation_failed",
        details: {
          operation: "requestBudget",
          policyName: "request_limit",
          policyRevision: 3,
          category: "numeric_precision",
        },
      },
    },
  ])("accepts and sanitizes $definition", ({ definition, value }) => {
    const validate = validator(definition);
    expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    expect(
      validate({
        ...value,
        details: { ...value.details, privateValue: "must-not-escape" },
      }),
    ).toBe(false);
  });
});

describe("Policy command canonicalization", () => {
  it("omits explicit empty root and child Policy sets without mutating input", () => {
    const create = {
      commandId: rootBudgetId,
      resources: [{ resourceTypeId, amount: 100 }],
      policies: [],
    };
    const request = {
      commandId: childBudgetId,
      parentBudgetId: rootBudgetId,
      resources: [{ resourceTypeId, amount: 40 }],
      childPolicies: [],
    };

    expect(canonicalizePolicyCommand(create)).toBe(
      `{"commandId":"${rootBudgetId}","resources":[{"amount":100,"resourceTypeId":"${resourceTypeId}"}]}`,
    );
    expect(canonicalizePolicyCommand(request)).toBe(
      `{"commandId":"${childBudgetId}","parentBudgetId":"${rootBudgetId}","resources":[{"amount":40,"resourceTypeId":"${resourceTypeId}"}]}`,
    );
    expect(create).toHaveProperty("policies", []);
    expect(request).toHaveProperty("childPolicies", []);
  });

  it("rejects context on the no-Policy command path", () => {
    expect(() =>
      canonicalizePolicyCommand({
        commandId: childBudgetId,
        parentBudgetId: rootBudgetId,
        resources: [{ resourceTypeId, amount: 40 }],
        context: {},
      }),
    ).toThrow(/context.*no.policy/i);
  });
});

describe("legacy no-Policy JSON bytes", () => {
  const command = {
    commandId: childBudgetId,
    parentBudgetId: rootBudgetId,
    resources: [{ resourceTypeId, amount: 40 }],
  } satisfies RequestBudgetCommand;
  const result = {
    kind: "approved",
    commandId: childBudgetId,
    parentBudgetId: rootBudgetId,
    childBudgetId,
    resources: [{ resourceTypeId, amount: 40 }],
    replayed: false,
  } satisfies RequestApproved;
  const history = {
    rootBudgetId,
    entries: [
      {
        kind: "budget_created",
        entryId: "50000000-0000-0000-0000-000000000001",
        sequence: 1,
        commandId: rootBudgetId,
        subjectBudgetId: rootBudgetId,
        rootBudgetId,
        resources: [{ resourceTypeId, amount: 100 }],
      },
      {
        kind: "request_approved",
        entryId: "50000000-0000-0000-0000-000000000002",
        sequence: 2,
        commandId: childBudgetId,
        subjectBudgetId: childBudgetId,
        parentBudgetId: rootBudgetId,
        childBudgetId,
        resources: [{ resourceTypeId, amount: 40 }],
      },
    ],
  } satisfies BudgetHistory;
  const replay = { ...result, replayed: true };
  const error = {
    kind: "error",
    code: "command_conflict",
    details: {
      commandId: childBudgetId,
      existingOperation: "requestBudget",
      attemptedOperation: "requestBudget",
    },
  } satisfies ErrorEnvelope;

  it.each([
    [
      "command",
      canonicalizePolicyCommand(command),
      `{"commandId":"${childBudgetId}","parentBudgetId":"${rootBudgetId}","resources":[{"amount":40,"resourceTypeId":"${resourceTypeId}"}]}`,
    ],
    [
      "result",
      canonicalJson(result),
      `{"childBudgetId":"${childBudgetId}","commandId":"${childBudgetId}","kind":"approved","parentBudgetId":"${rootBudgetId}","replayed":false,"resources":[{"amount":40,"resourceTypeId":"${resourceTypeId}"}]}`,
    ],
    [
      "history",
      canonicalJson(history),
      `{"entries":[{"commandId":"${rootBudgetId}","entryId":"50000000-0000-0000-0000-000000000001","kind":"budget_created","resources":[{"amount":100,"resourceTypeId":"${resourceTypeId}"}],"rootBudgetId":"${rootBudgetId}","sequence":1,"subjectBudgetId":"${rootBudgetId}"},{"childBudgetId":"${childBudgetId}","commandId":"${childBudgetId}","entryId":"50000000-0000-0000-0000-000000000002","kind":"request_approved","parentBudgetId":"${rootBudgetId}","resources":[{"amount":40,"resourceTypeId":"${resourceTypeId}"}],"sequence":2,"subjectBudgetId":"${childBudgetId}"}],"rootBudgetId":"${rootBudgetId}"}`,
    ],
    [
      "replay",
      canonicalJson(replay),
      `{"childBudgetId":"${childBudgetId}","commandId":"${childBudgetId}","kind":"approved","parentBudgetId":"${rootBudgetId}","replayed":true,"resources":[{"amount":40,"resourceTypeId":"${resourceTypeId}"}]}`,
    ],
    [
      "error",
      canonicalJson(error),
      `{"code":"command_conflict","details":{"attemptedOperation":"requestBudget","commandId":"${childBudgetId}","existingOperation":"requestBudget"},"kind":"error"}`,
    ],
  ])("preserves the complete legacy %s bytes", (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

function validator(definition: string): ValidateFunction {
  const validate = ajv.getSchema(`${policySchema.$id}#/$defs/${definition}`);
  expect(validate, `missing Policy schema definition ${definition}`).toBeTypeOf(
    "function",
  );
  if (validate === undefined) {
    throw new Error(`missing Policy schema definition ${definition}`);
  }
  return validate;
}
