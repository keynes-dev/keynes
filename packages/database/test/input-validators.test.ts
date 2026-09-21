import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadContract } from "../src/index.ts";
import { renderValidators } from "../src/generation/render.ts";
import {
  validateCreateBudgetCommandIssues,
  validateOpenBudgetQueryIssues,
  validateRemoteRequestBudgetCommandIssues,
} from "../generated/validators.ts";

describe("generated own-property validation", () => {
  const packageRoot = fileURLToPath(new URL("../", import.meta.url));
  const definitions = {
    NamedDefinitions: {
      type: "object",
      propertyNames: { type: "string", pattern: "^[a-z][A-Za-z0-9]*$" },
      additionalProperties: {
        type: "object",
        required: ["unit", "accountingBehavior"],
        properties: {
          unit: { type: "string", minLength: 1 },
          accountingBehavior: { enum: ["consumable", "reusable"] },
        },
        additionalProperties: false,
      },
    },
  };
  const source = renderValidators(
    definitions,
    loadContract(packageRoot).source,
  );
  const validate: unknown = new Function(
    `${stripTypeScriptTypes(source).replaceAll("export ", "")}\nreturn validateDefinition;`,
  )();
  if (typeof validate !== "function")
    throw new Error("Missing generated validator");
  const valid = { unit: "token", accountingBehavior: "consumable" };

  it.each(Object.entries(valid))(
    "rejects inherited required %s",
    (field, value) => {
      const entry = Object.assign(
        Object.create({ [field]: value }),
        Object.fromEntries(
          Object.entries(valid).filter(([name]) => name !== field),
        ),
      );
      expect(validate("NamedDefinitions", { modelTokens: entry })).toEqual([
        { path: `/modelTokens/${field}`, rule: "required" },
      ]);
    },
  );

  it("rejects an unknown own constructor field even when undefined", () => {
    expect(
      validate("NamedDefinitions", {
        modelTokens: { ...valid, constructor: undefined },
      }),
    ).toEqual([
      { path: "/modelTokens/constructor", rule: "additionalProperties" },
    ]);
  });

  it.each(["constructor", "toString"])(
    "validates malformed named %s entries",
    (name) => {
      expect(validate("NamedDefinitions", { [name]: undefined })).toEqual([
        { path: `/${name}`, rule: "type" },
      ]);
    },
  );

  it.each(["constructor", "toString"])(
    "rejects invalid behavior for named %s entries",
    (name) => {
      expect(
        validate("NamedDefinitions", {
          [name]: { ...valid, accountingBehavior: "invalid" },
        }),
      ).toEqual([{ path: `/${name}/accountingBehavior`, rule: "enum" }]);
    },
  );

  it("accepts valid prototype-like Resource names", () => {
    expect(
      validate("NamedDefinitions", { constructor: valid, toString: valid }),
    ).toEqual([]);
  });
});

describe("runtime input validators", () => {
  it("sorts validation issues independently of property insertion order", () => {
    const common = {
      commandId: "NOT-A-UUID",
      resources: [],
    };
    const first = { zeta: true, ...common, alpha: true };
    const second = { alpha: true, ...common, zeta: true };
    const expected = [
      { path: "/alpha", rule: "additionalProperties" },
      { path: "/amounts", rule: "required" },
      { path: "/commandId", rule: "pattern" },
      { path: "/definitions", rule: "required" },
      { path: "/resources", rule: "additionalProperties" },
      { path: "/zeta", rule: "additionalProperties" },
    ];

    expect(validateCreateBudgetCommandIssues(first)).toEqual(expected);
    expect(validateCreateBudgetCommandIssues(second)).toEqual(expected);
  });

  it("rejects retired Resource-source fields", () => {
    expect(
      validateCreateBudgetCommandIssues({
        commandId: "20000000-0000-0000-0000-000000000001",
        definitions: {
          modelTokens: { unit: "token", accountingBehavior: "consumable" },
        },
        amounts: { modelTokens: 1 },
        resources: [],
        allocation: { modelTokens: 1 },
      }),
    ).toEqual([
      { path: "/allocation", rule: "additionalProperties" },
      { path: "/resources", rule: "additionalProperties" },
    ]);
  });
});

it("enforces bounded remote inputs", () => {
  const operationKey = `kop_v1_${"a".repeat(43)}`;
  const budgetReference = `kbr_v1_${"b".repeat(43)}`;
  const request = {
    operationKey,
    parentBudgetReference: budgetReference,
    resources: [{ resource: "model_tokens", amount: 1 }],
  };
  const definitions = Array.from({ length: 65 }, (_, index) => ({
    canonicalName: `resource_${index}`,
    unit: "token",
    accountingBehavior: "consumable",
  }));

  expect(
    validateOpenBudgetQueryIssues({
      budgetReference,
      expectedResources: definitions,
    }),
  ).toContainEqual({ path: "/expectedResources", rule: "maxItems" });
  expect(
    validateRemoteRequestBudgetCommandIssues({
      ...request,
      context: { Invalid: true },
    }),
  ).toContainEqual({ path: "/context", rule: "additionalProperties" });
});
