import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  sql,
} from "kysely";
import type { Compilable, Sql } from "kysely";

import { POLICY_FUNCTION_SIGNATURES } from "../generated/policy-profile.js";
import type {
  PolicyProgramV1,
  PolicyScalarV1,
} from "../generated/policy-types.js";
import { normalizePolicy } from "./normalize.js";
import { parsePolicySql } from "./parse.js";
import { fail, type PolicyNormalizationScope } from "./validate.js";

export type { PolicyNormalizationScope } from "./validate.js";

export interface PolicyDatabase<ContextRow> {
  readonly requested_resources: {
    readonly resource: string;
    readonly amount: number;
  };
  readonly available_resources: {
    readonly resource: string;
    readonly amount: number;
  };
  readonly policy_context: ContextRow;
}

export interface PolicyQueryRow {
  readonly resource: string;
  readonly ceiling: string | number;
  readonly reason: string;
}

export interface PolicyAuthoring<ContextRow> {
  readonly db: Kysely<PolicyDatabase<ContextRow>>;
  readonly sql: Sql;
}

export function compilePolicyQuery<ContextRow>(
  query: (authoring: PolicyAuthoring<ContextRow>) => Compilable<PolicyQueryRow>,
  scope: PolicyNormalizationScope,
): PolicyProgramV1 {
  const identifiers = policyIdentifiers(scope);
  const db = new Kysely<PolicyDatabase<ContextRow>>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (database) => new PostgresIntrospector(database),
      createQueryCompiler: () => new PolicyQueryCompiler(identifiers),
    },
  });
  const compiled = query({ db, sql }).compile();
  return compilePolicySql(
    compiled.sql,
    compiled.parameters.map(requirePolicyScalar),
    scope,
  );
}

class PolicyQueryCompiler extends PostgresQueryCompiler {
  readonly #identifiers: ReadonlySet<string>;

  constructor(identifiers: ReadonlySet<string>) {
    super();
    this.#identifiers = identifiers;
  }

  protected override sanitizeIdentifier(identifier: string): string {
    if (
      !/^[a-z][a-z0-9_]{0,62}$/.test(identifier) ||
      !this.#identifiers.has(identifier)
    ) {
      fail("/source", "identifier");
    }
    return identifier;
  }

  protected override getLeftIdentifierWrapper(): string {
    return "";
  }

  protected override getRightIdentifierWrapper(): string {
    return "";
  }
}

function policyIdentifiers(
  scope: PolicyNormalizationScope,
): ReadonlySet<string> {
  return new Set([
    "requested_resources",
    "available_resources",
    "policy_context",
    "requested",
    "available",
    "context",
    "resource",
    "amount",
    "ceiling",
    "reason",
    ...scope.contextSchema.map(({ name }) => name),
    ...POLICY_FUNCTION_SIGNATURES.flatMap(({ names }) => names),
  ]);
}

export function compilePolicySql(
  source: string,
  parameters: readonly PolicyScalarV1[],
  scope: PolicyNormalizationScope,
): PolicyProgramV1 {
  return normalizePolicy(parsePolicySql(source, parameters), scope);
}

function requirePolicyScalar(value: unknown): PolicyScalarV1 {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  throw new TypeError("Policy parameters must be finite scalar values");
}
