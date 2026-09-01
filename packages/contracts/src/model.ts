import type { PolicyScalarV1 } from "../generated/policy-types.ts";

export type JsonObject = { readonly [key: string]: unknown };

export interface ContractOperation {
  readonly method: string;
  readonly target: string;
  readonly permission: string;
  readonly replay: boolean;
  readonly input: string;
  readonly output: string;
}

export interface ContractSource {
  readonly schema: string;
  readonly operations: readonly ContractOperation[];
}

export interface LoadedContract {
  readonly source: ContractSource;
  readonly schema: JsonObject;
  readonly definitions: JsonObject;
  readonly digest: string;
}

export interface PolicyProfileVersions {
  readonly program: string;
  readonly query: string;
  readonly validator: string;
  readonly limits: string;
}

export interface PolicyNumericProfile {
  readonly precision: number;
  readonly scale: number;
  readonly rounding: string;
  readonly maximumSafeInteger: number;
}

export interface PolicyTextProfile {
  readonly maximumUtf8Bytes: number;
  readonly forbiddenCodePoints: readonly string[];
  readonly comparison: string;
}

export interface PolicyCanonicalJsonProfile {
  readonly scalars: readonly string[];
  readonly arrays: string;
  readonly objectKeys: string;
}

export interface PolicyProfileArity {
  readonly minimum: number;
  readonly maximum: number;
}

export interface PolicyProfileDefault {
  readonly position: number;
  readonly value: PolicyScalarV1;
}

export interface PolicySemanticSignature {
  readonly node: string;
  readonly names: readonly string[];
  readonly sourceArity: PolicyProfileArity;
  readonly normalizedArity: number | "source";
  readonly operandTypes: readonly string[];
  readonly resultTypes: readonly string[];
  readonly nullBehavior: string;
  readonly numericBoundary: string;
  readonly defaults: readonly PolicyProfileDefault[];
  readonly postgresqlSignatures: readonly string[];
}

export interface PolicyProfileInventory {
  readonly nodeOrder: readonly string[];
  readonly operators: readonly PolicySemanticSignature[];
  readonly functions: readonly PolicySemanticSignature[];
}

export type PolicyProfileLimits = Readonly<Record<string, number>>;
export type PolicyNodeCategory = "program" | "join" | "expression";

export interface PolicyNodeBackends {
  readonly typescript: { readonly handler: string };
  readonly postgresql: {
    readonly validator: string;
    readonly renderer: string;
  };
}

export interface PolicyCanonicalVector {
  readonly name: string;
  readonly input: JsonObject;
  readonly expected: JsonObject;
}

export interface PolicyNodeProfile {
  readonly category: PolicyNodeCategory;
  readonly fields: JsonObject;
  readonly typeRule: string;
  readonly nullRule: string;
  readonly decimalBoundary: string;
  readonly canonical: JsonObject;
  readonly work: Readonly<Record<string, number>>;
  readonly backends: PolicyNodeBackends;
  readonly vectors: readonly PolicyCanonicalVector[];
}

export interface PolicyProfileSource {
  readonly schemaVersion: string;
  readonly versions: PolicyProfileVersions;
  readonly numeric: PolicyNumericProfile;
  readonly text: PolicyTextProfile;
  readonly canonicalJson: PolicyCanonicalJsonProfile;
  readonly limits: PolicyProfileLimits;
  readonly inventory: PolicyProfileInventory;
  readonly nodes: Readonly<Record<string, PolicyNodeProfile>>;
}

export interface LoadedPolicyProfile {
  readonly source: PolicyProfileSource;
  readonly digest: string;
  readonly nodeKinds: readonly string[];
}
