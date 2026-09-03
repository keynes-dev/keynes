import { describe, expect, it } from "vitest";

import {
  createKeynes,
  definePolicySql,
  defineResources,
  policySet,
  policyValue,
  type PolicyDefinition,
  type PolicySet,
} from "../../../src/index.js";

const resources = defineResources({
  tokens: { unit: "token", accountingBehavior: "consumable" },
});

const orderingResources = defineResources({
  a0thing: { unit: "token", accountingBehavior: "consumable" },
  aThing: { unit: "token", accountingBehavior: "consumable" },
});

const contextSchema = {
  limit: policyValue.integer(),
  segment: policyValue.text(),
};

type TestContext = {
  readonly limit: number;
  readonly segment: string;
};

const CONTEXT = {
  limit: 6,
  segment: "standard",
} as const;

const contextLimit = ceilingPolicy({
  name: "context_limit",
  revision: 3,
  reason: "tier_limit",
  ceiling: "least(available.amount, context.limit)",
});

const inputSensitiveLimit = ceilingPolicy({
  name: "input_sensitive_limit",
  revision: 1,
  reason: "input_sensitive_limit",
  ceiling: "least(requested.amount + context.limit, available.amount)",
});

describe("local governed Budget requests", () => {
  it("evaluates requested, availability, and Context through the public Budget path", async () => {
    const { keynes, root } = await openGoverned(policySet(inputSensitiveLimit));
    try {
      const result = await root.request(
        { tokens: 4 },
        { context: { limit: 2, segment: "standard" } },
      );

      if (result.status !== "approved") {
        throw new Error("expected input-sensitive Policy approval");
      }
      expect(result.policyEvidence).toEqual({
        context: { limit: 2, segment: "standard" },
        policies: [
          {
            name: "input_sensitive_limit",
            revision: 1,
            sourceDigest: inputSensitiveLimit.sourceDigest,
            definitionDigest: inputSensitiveLimit.definitionDigest,
            rows: [
              {
                resource: "tokens",
                ceiling: 6,
                reason: "input_sensitive_limit",
              },
            ],
          },
        ],
        effectiveCeilings: [
          {
            resource: "tokens",
            ceiling: 6,
            reasons: [
              {
                policyName: "input_sensitive_limit",
                policyRevision: 1,
                reason: "input_sensitive_limit",
              },
            ],
          },
        ],
        decision: "approved",
      });
    } finally {
      await keynes.close();
    }
  });

  it("uses available Resources when they are the Policy ceiling", async () => {
    const { keynes, root } = await openGoverned(
      policySet(inputSensitiveLimit),
      5,
    );
    try {
      const result = await root.request(
        { tokens: 4 },
        { context: { limit: 2, segment: "standard" } },
      );

      if (result.status !== "approved") {
        throw new Error("expected availability-bound Policy approval");
      }
      expect(result.policyEvidence).toMatchObject({
        effectiveCeilings: [{ resource: "tokens", ceiling: 5 }],
      });
      await expect(root.inspect()).resolves.toMatchObject({
        budget: {
          resources: [{ allocated: 5, available: 1, committed: 4 }],
        },
      });
    } finally {
      await keynes.close();
    }
  });

  it("approves atomically and reserves the exact requested quantity", async () => {
    const { keynes, root } = await openGoverned(policySet(contextLimit));
    try {
      const result = await root.request({ tokens: 4 }, { context: CONTEXT });

      expect(result).toMatchObject({
        status: "approved",
        policyEvidence: { decision: "approved" },
      });
      if (result.status !== "approved") {
        throw new Error("expected governed approval");
      }
      await expect(result.budget.inspect()).resolves.toMatchObject({
        budget: {
          depth: 1,
          resources: [
            {
              resource: "tokens",
              allocated: 4,
              available: 4,
              committed: 0,
            },
          ],
        },
      });
      await expect(root.inspect()).resolves.toMatchObject({
        budget: {
          resources: [
            {
              resource: "tokens",
              allocated: 10,
              available: 6,
              committed: 4,
            },
          ],
        },
        history: {
          entries: [
            { kind: "budget_created", sequence: 1 },
            {
              kind: "request_approved",
              sequence: 2,
              resources: [{ resource: "tokens", amount: 4 }],
              policyEvidence: { decision: "approved" },
            },
          ],
        },
      });
    } finally {
      await keynes.close();
    }
  });

  it("denies above the Policy ceiling without changing holdings", async () => {
    const { keynes, root } = await openGoverned(policySet(contextLimit));
    try {
      const result = await root.request({ tokens: 7 }, { context: CONTEXT });

      expect(result).toEqual(
        expect.objectContaining({
          status: "denied",
          reasons: [
            {
              code: "policy_ceiling",
              resource: "tokens",
              requested: 7,
              ceiling: 6,
              policyName: "context_limit",
              policyRevision: 3,
              reason: "tier_limit",
            },
          ],
          policyEvidence: expect.objectContaining({ decision: "denied" }),
        }),
      );
      await expect(root.inspect()).resolves.toMatchObject({
        budget: {
          resources: [
            {
              resource: "tokens",
              allocated: 10,
              available: 10,
              committed: 0,
            },
          ],
        },
        history: {
          entries: [
            { kind: "budget_created", sequence: 1 },
            {
              kind: "request_denied",
              sequence: 2,
              reasons: [
                {
                  code: "policy_ceiling",
                  resource: "tokens",
                  requested: 7,
                  ceiling: 6,
                  policyName: "context_limit",
                  policyRevision: 3,
                  reason: "tier_limit",
                },
              ],
              policyEvidence: { decision: "denied" },
            },
          ],
        },
      });
    } finally {
      await keynes.close();
    }
  });

  it("detaches and records the exact canonical context", async () => {
    const { keynes, root } = await openGoverned(policySet(contextLimit));
    try {
      const context = { limit: 6, segment: "standard" };
      const pending = root.request({ tokens: 4 }, { context });
      context.limit = 1;
      context.segment = "mutated";

      const result = await pending;
      expect(result).toMatchObject({
        status: "approved",
        policyEvidence: { context: CONTEXT, decision: "approved" },
      });
      const snapshot = await root.inspect();
      expect(snapshot.history.entries[1]).toMatchObject({
        kind: "request_approved",
        policyEvidence: { context: CONTEXT, decision: "approved" },
      });
      expect(snapshot.budget).not.toHaveProperty("context");
    } finally {
      await keynes.close();
    }
  });

  it("uses the lowest ceiling and retains every tied Policy reason", async () => {
    const first = ceilingPolicy({
      name: "first_cap",
      revision: 1,
      reason: "first_limit",
      ceiling: "least(context.limit, 5)",
    });
    const second = ceilingPolicy({
      name: "second_cap",
      revision: 2,
      reason: "second_limit",
      ceiling: "least(context.limit, 5)",
    });
    const wide = ceilingPolicy({
      name: "wide_cap",
      revision: 1,
      reason: "wide_limit",
      ceiling: "least(context.limit, 8)",
    });
    const { keynes, root } = await openGoverned(policySet(first, second, wide));
    try {
      const result = await root.request(
        { tokens: 6 },
        { context: { limit: 10, segment: "standard" } },
      );

      expect(result).toMatchObject({
        status: "denied",
        reasons: [
          {
            code: "policy_ceiling",
            resource: "tokens",
            requested: 6,
            ceiling: 5,
            policyName: "first_cap",
            policyRevision: 1,
            reason: "first_limit",
          },
          {
            code: "policy_ceiling",
            resource: "tokens",
            requested: 6,
            ceiling: 5,
            policyName: "second_cap",
            policyRevision: 2,
            reason: "second_limit",
          },
        ],
        policyEvidence: {
          effectiveCeilings: [
            {
              resource: "tokens",
              ceiling: 5,
              reasons: [
                {
                  policyName: "first_cap",
                  policyRevision: 1,
                  reason: "first_limit",
                },
                {
                  policyName: "second_cap",
                  policyRevision: 2,
                  reason: "second_limit",
                },
              ],
            },
          ],
          decision: "denied",
        },
      });
    } finally {
      await keynes.close();
    }
  });

  it("orders Policy evidence and Resources by PostgreSQL C bytes", async () => {
    const policyUnderscore = orderingPolicy(
      orderingResources,
      "policy_",
      "reason_",
    );
    const policyDigit = orderingPolicy(orderingResources, "policy0", "reason0");
    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(
        orderingResources,
        { a0thing: 10, aThing: 10 },
        { policies: policySet(policyUnderscore, policyDigit) },
      );
      const result = await root.request(
        { a0thing: 1, aThing: 1 },
        { context: CONTEXT },
      );
      if (result.status !== "approved") {
        throw new Error("expected governed approval");
      }

      expect(result.policyEvidence.policies.map(({ name }) => name)).toEqual([
        "policy0",
        "policy_",
      ]);
      expect(
        result.policyEvidence.effectiveCeilings.map(({ resource }) => resource),
      ).toEqual(["a0thing", "aThing"]);
      expect(
        result.policyEvidence.effectiveCeilings[0]?.reasons.map(
          ({ policyName, reason }) => [policyName, reason],
        ),
      ).toEqual([
        ["policy0", "reason0"],
        ["policy_", "reason_"],
      ]);
    } finally {
      await keynes.close();
    }
  });

  it("returns identical canonical evidence in the result and history", async () => {
    const { keynes, root } = await openGoverned(policySet(contextLimit));
    try {
      const result = await root.request({ tokens: 4 }, { context: CONTEXT });
      const expectedEvidence = {
        context: CONTEXT,
        policies: [
          {
            name: "context_limit",
            revision: 3,
            sourceDigest: contextLimit.sourceDigest,
            definitionDigest: contextLimit.definitionDigest,
            rows: [
              {
                resource: "tokens",
                ceiling: 6,
                reason: "tier_limit",
              },
            ],
          },
        ],
        effectiveCeilings: [
          {
            resource: "tokens",
            ceiling: 6,
            reasons: [
              {
                policyName: "context_limit",
                policyRevision: 3,
                reason: "tier_limit",
              },
            ],
          },
        ],
        decision: "approved",
      } as const;

      expect(result).toMatchObject({ policyEvidence: expectedEvidence });
      const historyEntry = (await root.inspect()).history.entries[1];
      expect(historyEntry).toMatchObject({ policyEvidence: expectedEvidence });
      expect(requiredProperty(historyEntry, "policyEvidence")).toEqual(
        requiredProperty(result, "policyEvidence"),
      );
    } finally {
      await keynes.close();
    }
  });

  it("attaches only explicitly supplied child Policies", async () => {
    const { keynes, root } = await openGoverned(policySet(contextLimit));
    try {
      const omitted = await root.request({ tokens: 1 }, { context: CONTEXT });
      const explicitEmpty = await root.request(
        { tokens: 1 },
        { context: CONTEXT, childPolicies: policySet() },
      );
      const governed = await root.request(
        { tokens: 1 },
        { context: CONTEXT, childPolicies: policySet(contextLimit) },
      );

      for (const result of [omitted, explicitEmpty]) {
        expect(result.status).toBe("approved");
        if (result.status !== "approved") continue;
        await expect(
          result.budget.request({ tokens: 1 }),
        ).resolves.toMatchObject({ status: "approved" });
      }

      expect(governed.status).toBe("approved");
      if (governed.status !== "approved") return;
      await expect(
        governed.budget.request({ tokens: 1 }, { context: CONTEXT }),
      ).resolves.toMatchObject({ status: "approved" });
    } finally {
      await keynes.close();
    }
  });

  it("attaches child Policies from an ungoverned Budget", async () => {
    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(resources, { tokens: 10 });
      const result = await root.request(
        { tokens: 10 },
        { childPolicies: policySet(contextLimit) },
      );
      expect(result.status).toBe("approved");
      if (result.status !== "approved") {
        throw new Error("expected ungoverned approval");
      }

      await expect(
        result.budget.request({ tokens: 7 }, { context: CONTEXT }),
      ).resolves.toMatchObject({
        status: "denied",
        reasons: [
          {
            code: "policy_ceiling",
            policyName: "context_limit",
            reason: "tier_limit",
          },
        ],
      });
    } finally {
      await keynes.close();
    }
  });

  it("rejects the legacy request key and names invalid child Policies", async () => {
    const { keynes, root } = await openGoverned(policySet(contextLimit));
    try {
      expect(() =>
        Reflect.apply(root.request, undefined, [
          { tokens: 1 },
          { context: CONTEXT, policies: policySet(contextLimit) },
        ]),
      ).toThrowError(
        expect.objectContaining({
          code: "invalid_configuration",
          details: { field: "policies", reason: "unsupported" },
        }),
      );
      expect(() =>
        Reflect.apply(root.request, undefined, [
          { tokens: 1 },
          { context: CONTEXT, childPolicies: {} },
        ]),
      ).toThrowError(
        expect.objectContaining({
          code: "invalid_configuration",
          details: { field: "childPolicies", reason: "unsupported" },
        }),
      );
    } finally {
      await keynes.close();
    }
  });

  it("does not inherit parent Policies into an approved child", async () => {
    const { keynes, root } = await openGoverned(policySet(contextLimit));
    try {
      const parentResult = await root.request(
        { tokens: 4 },
        { context: CONTEXT },
      );
      if (parentResult.status !== "approved") {
        throw new Error("expected governed approval");
      }

      const childResult = await parentResult.budget.request({ tokens: 1 });
      expect(childResult.status).toBe("approved");
      const entries = (await parentResult.budget.inspect()).history.entries;
      expect(entries[2]).toEqual({
        kind: "request_approved",
        sequence: 3,
        resources: [{ resource: "tokens", amount: 1 }],
      });
    } finally {
      await keynes.close();
    }
  });

  it("rolls back when any parent Policy evaluation fails", async () => {
    const safe = ceilingPolicy({
      name: "a_safe_cap",
      revision: 1,
      reason: "safe_limit",
      ceiling: "context.limit",
    });
    const divisionByZero = ceilingPolicy({
      name: "z_division_by_zero",
      revision: 1,
      reason: "unreachable_limit",
      ceiling: "requested.amount / (available.amount - available.amount)",
    });
    const { keynes, root } = await openGoverned(
      policySet(safe, divisionByZero),
    );
    try {
      await expect(
        root.request({ tokens: 4 }, { context: CONTEXT }),
      ).rejects.toMatchObject({
        code: "policy_evaluation_failed",
        details: {
          operation: "requestBudget",
          policyName: "z_division_by_zero",
          policyRevision: 1,
          category: "numeric_domain",
        },
      });
      await expect(root.inspect()).resolves.toMatchObject({
        budget: {
          resources: [
            {
              resource: "tokens",
              allocated: 10,
              available: 10,
              committed: 0,
            },
          ],
        },
        history: {
          entries: [{ kind: "budget_created", sequence: 1 }],
        },
      });
    } finally {
      await keynes.close();
    }
  });
});

function ceilingPolicy<const Reason extends string>(definition: {
  readonly name: string;
  readonly revision: number;
  readonly reason: Reason;
  readonly ceiling: string;
}): PolicyDefinition<"tokens", TestContext, Reason> {
  return definePolicySql(resources, {
    name: definition.name,
    revision: definition.revision,
    inputs: ["tokens"],
    outputs: ["tokens"],
    context: contextSchema,
    reasons: [definition.reason],
    sql: `
      SELECT requested.resource AS resource,
             ${definition.ceiling} AS ceiling,
             '${definition.reason}' AS reason
        FROM requested_resources AS requested
        INNER JOIN available_resources AS available USING (resource)
        CROSS JOIN policy_context AS context
    `,
  });
}

function orderingPolicy<const Name extends string, const Reason extends string>(
  orderedResources: typeof orderingResources,
  name: Name,
  reason: Reason,
) {
  return definePolicySql(orderedResources, {
    name,
    revision: 1,
    inputs: ["a0thing", "aThing"],
    outputs: ["a0thing", "aThing"],
    context: contextSchema,
    reasons: [reason],
    sql: `
      SELECT requested.resource AS resource,
             available.amount AS ceiling,
             '${reason}' AS reason
        FROM requested_resources AS requested
        INNER JOIN available_resources AS available USING (resource)
        CROSS JOIN policy_context AS context
    `,
  });
}

async function openGoverned<Reasons extends string>(
  policies: PolicySet<"tokens", TestContext, Reasons>,
  initialTokens = 10,
) {
  const keynes = await createKeynes();
  try {
    const root = await keynes.createBudget(
      resources,
      { tokens: initialTokens },
      { policies },
    );
    return { keynes, root };
  } catch (error: unknown) {
    await keynes.close();
    throw error;
  }
}

function requiredProperty(value: unknown, property: string): unknown {
  if (!isRecord(value) || !(property in value)) {
    throw new Error(`expected ${property}`);
  }
  return value[property];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
