import type { ResourceAmounts } from "./budget.js";
import { captureJson, isRecord } from "./request-serialization.js";

const POLICY_CODE = /^[a-z][a-z0-9_]{0,63}$/;

export type Policy<ProposalNames extends string, FinalNames extends string> = (
  proposal: ResourceAmounts<ProposalNames>,
) => PolicyOutput<FinalNames> | Promise<PolicyOutput<FinalNames>>;

export type PolicyOutput<Names extends string> =
  | {
      readonly kind: "prepared";
      readonly request: ResourceAmounts<Names>;
    }
  | {
      readonly kind: "rejected";
      readonly code: string;
    }
  | {
      readonly kind: "review_required";
      readonly code: string;
    }
  | {
      readonly kind: "failed";
      readonly code: string;
    };

export type PolicyResult<Names extends string = string> = PolicyOutput<Names>;

export type PolicyRequestResult<Names extends string, Allocation> =
  | {
      readonly status: "not_submitted";
      readonly policy: Exclude<
        PolicyResult<Names>,
        { readonly kind: "prepared" }
      >;
    }
  | {
      readonly status: "submitted";
      readonly policy: Extract<
        PolicyResult<Names>,
        { readonly kind: "prepared" }
      >;
      readonly allocation: Allocation;
    };

export function preparePolicy<
  ProposalNames extends string,
  const FinalNames extends string,
>(
  proposal: ResourceAmounts<ProposalNames>,
  resourceNames: readonly FinalNames[],
  policy: Policy<ProposalNames, FinalNames>,
): Promise<PolicyResult<FinalNames>>;
export function preparePolicy(
  proposal: unknown,
  resourceNames: readonly string[],
  policy: unknown,
): Promise<PolicyResult>;
export async function preparePolicy(
  proposal: unknown,
  resourceNames: readonly string[],
  policy: unknown,
): Promise<PolicyResult> {
  const allowedResources = new Set(resourceNames);
  let capturedProposal: ResourceAmounts;
  try {
    capturedProposal = captureResources(proposal, allowedResources, false);
  } catch (error: unknown) {
    if (error instanceof PolicyValidationError)
      return failed("invalid_policy_proposal");
    throw error;
  }
  if (typeof policy !== "function") return failed("invalid_policy");

  let output: unknown;
  try {
    output = await policy(capturedProposal);
  } catch {
    return failed("policy_failed");
  }
  try {
    return capturePolicyOutput(output, allowedResources);
  } catch (error: unknown) {
    if (error instanceof PolicyValidationError)
      return failed("invalid_policy_output");
    throw error;
  }
}

function capturePolicyOutput(
  output: unknown,
  allowedResources: ReadonlySet<string>,
): PolicyResult {
  const captured = capturePolicyValue(output);
  if (!isRecord(captured)) invalid();
  const fields = Object.keys(captured);
  const kind = captured.kind;
  if (typeof kind !== "string") invalid();

  if (kind === "prepared") {
    requireFields(fields, ["kind", "request"]);
    return Object.freeze({
      kind,
      request: captureResources(captured.request, allowedResources, true),
    });
  }
  if (kind === "rejected" || kind === "review_required" || kind === "failed") {
    requireFields(fields, ["kind", "code"]);
    const code = captured.code;
    if (typeof code !== "string" || !POLICY_CODE.test(code)) invalid();
    return Object.freeze({ kind, code });
  }
  invalid();
}

function captureResources(
  value: unknown,
  allowedResources: ReadonlySet<string>,
  requireResource: boolean,
): ResourceAmounts {
  const captured = capturePolicyValue(value);
  if (!isRecord(captured)) invalid();
  const entries: [string, number][] = [];
  for (const [resource, amount] of Object.entries(captured)) {
    if (!allowedResources.has(resource)) invalid();
    if (
      typeof amount !== "number" ||
      !Number.isSafeInteger(amount) ||
      amount < 0
    )
      invalid();
    entries.push([resource, amount]);
  }
  if (requireResource && entries.length === 0) invalid();
  return Object.freeze(Object.fromEntries(entries));
}

function capturePolicyValue(value: unknown): unknown {
  return captureJson(value, () => new PolicyValidationError());
}

function requireFields(
  fields: readonly string[],
  expected: readonly string[],
): void {
  if (
    fields.length !== expected.length ||
    fields.some((name) => !expected.includes(name))
  )
    invalid();
}

function failed(code: string): PolicyResult {
  return Object.freeze({ kind: "failed", code });
}

function invalid(): never {
  throw new PolicyValidationError();
}

class PolicyValidationError extends Error {}
