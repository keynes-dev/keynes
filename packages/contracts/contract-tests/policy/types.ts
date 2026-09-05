import type {
  PolicyContextV1,
  PolicyProgramV1,
  PolicyResultRowV1,
} from "../../generated/policy-types.ts";

export type PolicyTestCategory =
  | "kysely"
  | "kysely_sql"
  | "raw_sql"
  | "canonical_vector"
  | "numeric"
  | "null"
  | "ordering"
  | "aggregation"
  | "property"
  | "limit"
  | "mutation";

export interface PolicyTestCase {
  readonly name: string;
  readonly category: PolicyTestCategory;
  readonly source?: string;
  readonly parameters?: readonly (string | boolean | number | null)[];
  readonly evaluationInput?: PolicySourceTestInput;
  readonly expected: unknown;
}

export interface PolicySourceTestInput {
  readonly requested: readonly PolicyResourceValue[];
  readonly available: readonly PolicyResourceValue[];
  readonly context: Readonly<PolicyContextV1>;
}

export interface PolicyRuntimeTestCase {
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

export interface PolicyResourceValue {
  readonly resource: string;
  readonly amount: number;
}
