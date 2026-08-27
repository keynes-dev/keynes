import { Decimal } from "decimal.js";

import { POLICY_NUMERIC_PROFILE } from "../generated/policy-profile.js";

const Decimal38 = Decimal.clone({
  precision: POLICY_NUMERIC_PROFILE.precision,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -100,
  toExpPos: 100,
});

const numericUpperBound = new Decimal38(10).pow(
  POLICY_NUMERIC_PROFILE.precision - POLICY_NUMERIC_PROFILE.scale,
);

export type PolicyDecimal = Decimal;

export type NumericFailureCategory =
  | "arithmetic_overflow"
  | "numeric_domain"
  | "numeric_precision";

export class PolicyNumericError extends Error {
  readonly category: NumericFailureCategory;

  constructor(category: NumericFailureCategory) {
    super(category);
    this.name = "PolicyNumericError";
    this.category = category;
  }
}

export function decimalFrom(
  value: Decimal.Value,
  category: NumericFailureCategory = "numeric_precision",
): PolicyDecimal {
  return decimalBoundary(new Decimal38(value), category);
}

export function decimalBoundary(
  value: PolicyDecimal,
  category: NumericFailureCategory = "arithmetic_overflow",
): PolicyDecimal {
  if (!value.isFinite()) {
    throw new PolicyNumericError(category);
  }

  const rounded = value.toDecimalPlaces(
    POLICY_NUMERIC_PROFILE.scale,
    Decimal.ROUND_HALF_UP,
  );
  if (rounded.abs().greaterThanOrEqualTo(numericUpperBound)) {
    throw new PolicyNumericError(category);
  }
  return rounded.isZero() ? new Decimal38(0) : rounded;
}

export function decimalCanonical(value: PolicyDecimal): string {
  return value.toFixed(POLICY_NUMERIC_PROFILE.scale);
}

export function decimalTrunc(
  value: PolicyDecimal,
  scale: number,
): PolicyDecimal {
  return decimalBoundary(value.toDecimalPlaces(scale, Decimal.ROUND_DOWN));
}

export function isPolicyDecimal(value: unknown): value is PolicyDecimal {
  return Decimal.isDecimal(value);
}
