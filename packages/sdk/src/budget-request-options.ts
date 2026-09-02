import type {
  CreateBudgetCommand,
  PolicyContextV1,
  RequestBudgetCommand,
} from "./generated/types.js";
import { canonicalResourceName } from "./resources.js";
import { KeynesSdkError } from "./sdk-errors.js";

export function attachedPolicyDefinitions(
  options: readonly unknown[],
): CreatePolicyDefinitions | undefined {
  if (options.length === 0) return undefined;
  const option = options[0];
  if (options.length !== 1 || !isRecord(option)) {
    throw invalidConfiguration("options", "unsupported");
  }
  const unknownField = Object.keys(option).find(
    (field) => field !== "policies",
  );
  if (unknownField !== undefined) {
    throw invalidConfiguration(unknownField, "unsupported");
  }
  return policyDefinitions(option.policies, "policies");
}

type CreatePolicyDefinitions = NonNullable<CreateBudgetCommand["policies"]>;

export function prepareRequestPolicyOptions(
  options: readonly unknown[],
): Pick<RequestBudgetCommand, "context" | "childPolicies"> {
  if (options.length === 0) return {};
  const option = options[0];
  if (options.length !== 1 || !isRecord(option)) {
    throw invalidConfiguration("options", "unsupported");
  }
  const unknownField = Object.keys(option).find(
    (field) => field !== "context" && field !== "childPolicies",
  );
  if (unknownField !== undefined) {
    throw invalidConfiguration(unknownField, "unsupported");
  }
  const context =
    "context" in option ? canonicalContext(option.context) : undefined;
  const childPolicies =
    "childPolicies" in option
      ? policyDefinitions(option.childPolicies, "childPolicies")
      : undefined;
  return {
    ...(context === undefined ? {} : { context }),
    ...(childPolicies === undefined ? {} : { childPolicies }),
  };
}

function policyDefinitions(
  value: unknown,
  field: "policies" | "childPolicies",
): CreatePolicyDefinitions | undefined {
  if (!isRecord(value) || !Array.isArray(value.definitions)) {
    throw invalidConfiguration(field, "unsupported");
  }
  if (value.definitions.length === 0) {
    if (!isCanonicalEmptyPolicySet(value)) {
      throw invalidConfiguration(field, "unsupported");
    }
    return undefined;
  }
  if (value.definitions.length > 16) {
    throw invalidConfiguration(field, "unsupported");
  }
  return structuredClone(value.definitions) as CreatePolicyDefinitions;
}

function canonicalContext(value: unknown): PolicyContextV1 {
  if (!isRecord(value)) {
    throw invalidConfiguration("context", "unsupported");
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, member]) => [
      canonicalResourceName(key),
      structuredClone(member),
    ]),
  ) as PolicyContextV1;
}

function isCanonicalEmptyPolicySet(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const fields = Object.keys(value);
  if (
    fields.length !== 3 ||
    !fields.includes("definitions") ||
    !fields.includes("contextSchemaDigest") ||
    !fields.includes("setDigest")
  ) {
    return false;
  }
  return (
    Array.isArray(value.definitions) &&
    value.definitions.length === 0 &&
    value.contextSchemaDigest === null &&
    typeof value.setDigest === "string"
  );
}

function invalidConfiguration(
  field: string,
  reason: "missing" | "unknown" | "unsupported",
): KeynesSdkError<"invalid_configuration"> {
  return new KeynesSdkError("invalid_configuration", { field, reason });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
