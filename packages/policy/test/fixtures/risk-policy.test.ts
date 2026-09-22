import { expect, it } from "vitest";

import { riskPolicy } from "./risk-policy.ts";

it("prepares a request from one recorded available assessment", () => {
  const policy = riskPolicy({
    kind: "available",
    risk: "low",
    confidence: 0.96,
  });

  expect(policy({ usdCents: 1250 })).toEqual({
    kind: "prepared",
    request: { usdCents: 1250 },
  });
});

it("keeps an unavailable assessment distinct from a negative answer", () => {
  const policy = riskPolicy({
    kind: "unavailable",
    code: "assessment_unavailable",
  });

  expect(policy({ usdCents: 1250 })).toEqual({
    kind: "failed",
    code: "assessment_unavailable",
  });
});

it("uses a caller-provided fallback only when the assessment is unavailable", () => {
  const policy = riskPolicy(
    { kind: "unavailable", code: "assessment_unavailable" },
    { kind: "review_required", code: "manual_review" },
  );

  expect(policy({ usdCents: 1250 })).toEqual({
    kind: "review_required",
    code: "manual_review",
  });
});
