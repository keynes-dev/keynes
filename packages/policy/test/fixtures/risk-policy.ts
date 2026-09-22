import type { Policy, PolicyOutput } from "@keynes/sdk";

export type RiskAssessment =
  | {
      readonly kind: "available";
      readonly risk: "low" | "high";
      readonly confidence: number;
    }
  | { readonly kind: "unavailable"; readonly code: string };

export function riskPolicy(
  assessment: RiskAssessment,
  fallback?: PolicyOutput<"usdCents">,
): Policy<"usdCents", "usdCents"> {
  return (proposal) => {
    if (assessment.kind === "unavailable")
      return (
        fallback ?? {
          kind: "failed",
          code: "assessment_unavailable",
        }
      );
    if (assessment.risk === "high" || assessment.confidence < 0.9)
      return { kind: "review_required", code: "risk_review_required" };
    return { kind: "prepared", request: proposal };
  };
}
