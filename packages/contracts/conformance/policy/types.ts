import type {
  PolicyContextV1,
  PolicyProgramV1,
  PolicyResultRowV1,
} from "../../generated/policy-types.ts";

export interface PolicyRuntimeConformanceCase {
  readonly name: string;
  readonly category:
    | "property"
    | "numeric"
    | "null"
    | "ordering"
    | "aggregation";
  readonly program: PolicyProgramV1;
  readonly input: {
    readonly requested: readonly PolicyResourceValue[];
    readonly available: readonly PolicyResourceValue[];
    readonly context: Readonly<PolicyContextV1>;
    readonly outputResources: readonly string[];
    readonly reasons: readonly string[];
  };
  readonly expected:
    | readonly PolicyResultRowV1[]
    | { readonly error: "arithmetic_overflow" };
}

interface PolicyResourceValue {
  readonly resource: string;
  readonly amount: number;
}
