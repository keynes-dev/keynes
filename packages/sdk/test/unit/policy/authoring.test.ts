import { describe, expect, it } from "vitest";

import {
  definePolicy,
  definePolicySql,
  defineResources,
  policySet,
} from "../../../src/index.js";

const INPUTS = ["usdCents", "searchQueries"] as const;
const OUTPUTS = ["usdCents", "searchQueries"] as const;
const REASONS = ["capacity_limit"] as const;

const resources = defineResources({
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  searchQueries: { unit: "query", accountingBehavior: "consumable" },
});

describe("Policy authoring", () => {
  it("normalizes Kysely callbacks, Kysely sql, raw SQL, and parameters to one definition", () => {
    const kysely = definePolicy(resources, {
      ...declarations(7),
      query: ({ db }) =>
        db
          .selectFrom("requested_resources as requested")
          .innerJoin("available_resources as available", (join) =>
            join.onRef("available.resource", "=", "requested.resource"),
          )
          .crossJoin("policy_context as context")
          .select(({ eb }) => [
            "requested.resource as resource",
            eb
              .fn<number>("round", [eb("available.amount", "*", 0.75)])
              .as("ceiling"),
            eb.val("capacity_limit").as("reason"),
          ]),
    });
    const kyselySql = definePolicy(resources, {
      ...declarations(7),
      query: ({ db, sql }) =>
        db
          .selectFrom("requested_resources as requested")
          .innerJoin("available_resources as available", (join) =>
            join.onRef("available.resource", "=", "requested.resource"),
          )
          .crossJoin("policy_context as context")
          .select(({ eb }) => [
            "requested.resource as resource",
            sql<number>`round(${eb.ref("available.amount")} * ${0.75})`.as(
              "ceiling",
            ),
            sql<string>`${"capacity_limit"}`.as("reason"),
          ]),
    });
    const raw = definePolicySql(resources, {
      ...declarations(7),
      sql: `
        /* spelling and layout are not identity */
        SELECT requested.resource AS resource,
               round(available.amount * 0.75) AS ceiling,
               'capacity_limit' AS reason
          FROM requested_resources AS requested
          INNER JOIN available_resources AS available USING (resource)
          CROSS JOIN policy_context AS context;
      `,
    });
    const parameterized = definePolicySql(resources, {
      ...declarations(7),
      sql: `SELECT requested.resource AS resource,
                   round(available.amount * $1) AS ceiling,
                   $2 AS reason
              FROM requested_resources AS requested
              INNER JOIN available_resources AS available USING (resource)
              CROSS JOIN policy_context AS context`,
      parameters: [0.75, "capacity_limit"],
    });

    for (const definition of [kyselySql, raw, parameterized]) {
      expect(definition.revision).toBe(7);
      expect(definition.program).toEqual(kysely.program);
      expect(definition.canonicalSql).toBe(kysely.canonicalSql);
      expect(definition.sourceDigest).toBe(kysely.sourceDigest);
      expect(definition.definitionDigest).toBe(kysely.definitionDigest);
    }
    expect(kysely.canonicalSql).not.toContain("/*");
    expect(kysely.canonicalSql).not.toMatch(/\$[12]/);
    expect(kysely.canonicalSql).toMatch(
      /order by resource asc, reason asc, ceiling asc\n$/,
    );
    expect(kysely.sourceDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(kysely.definitionDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(parameterized).not.toHaveProperty("parameters");
  });

  it("includes the revision in definition identity but not source identity", () => {
    const first = definePolicySql(resources, {
      ...declarations(7),
      sql: RAW_POLICY_SQL,
    });
    const next = definePolicySql(resources, {
      ...declarations(8),
      sql: RAW_POLICY_SQL,
    });

    expect(next.revision).toBe(8);
    expect(next.program).toEqual(first.program);
    expect(next.canonicalSql).toBe(first.canonicalSql);
    expect(next.sourceDigest).toBe(first.sourceDigest);
    expect(next.definitionDigest).not.toBe(first.definitionDigest);
  });

  it("deeply freezes Policy definitions and sets", () => {
    const definition = definePolicySql(resources, {
      ...declarations(7),
      sql: RAW_POLICY_SQL,
    });
    const definitions = policySet(definition);

    expectDeeplyFrozen(definition);
    expectDeeplyFrozen(definitions);
    expect(definitions.definitions).toEqual([definition]);
    expect(definitions.contextSchemaDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(definitions.setDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

const RAW_POLICY_SQL = `
  SELECT requested.resource AS resource,
         round(available.amount * 0.75) AS ceiling,
         'capacity_limit' AS reason
    FROM requested_resources AS requested
    INNER JOIN available_resources AS available USING (resource)
    CROSS JOIN policy_context AS context
`;

function declarations(revision: number) {
  return {
    name: "capacity_limit",
    revision,
    inputs: INPUTS,
    outputs: OUTPUTS,
    context: {},
    reasons: REASONS,
  };
}

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const member of Object.values(value)) expectDeeplyFrozen(member);
}
