import { describe, expect, test } from "vitest";

import {
  BUDGET_RESOURCE_KEYS,
  budgetCascade,
  budgetLevel,
  budgetStepRequests,
  budgetTokenShare,
  buildFrontierRows,
  settleBudgetSteps,
  buildFrontierSeries,
  buildWorkflowWaterfall,
  evalVariants,
  KNEE_T,
  lowerAt,
  policiesData,
  POLICY_BINDING_CEILING,
  POLICY_REQUEST_TOKENS,
  upperAt,
  VERTEX_Q,
  WORKFLOW_RESERVED,
  WORKFLOW_RETURNED,
  WORKFLOW_USED,
  workflowsData,
} from "./charts";

describe("budgetCascade", () => {
  test("hands every Resource down in strictly smaller slices", () => {
    for (const key of BUDGET_RESOURCE_KEYS) {
      for (let index = 1; index < budgetCascade.length; index++) {
        const level = budgetCascade[index]!;
        const parent = budgetCascade[index - 1]!;

        expect(level.resources[key]).toBeLessThan(parent.resources[key]);
      }
    }
  });

  test("reports each level's token share of its parent", () => {
    expect(budgetTokenShare(budgetLevel("team"), budgetLevel("org"))).toBe(25);
    expect(budgetTokenShare(budgetLevel("workflow"), budgetLevel("team"))).toBe(
      33,
    );
  });

  test("throws when a scope is missing from the cascade", () => {
    // @ts-expect-error -- exercising the runtime guard with an unknown scope
    expect(() => budgetLevel("cluster")).toThrow(/missing the cluster level/);
  });
});

describe("settleBudgetSteps", () => {
  test("accepts the steps that fit and leaves the rest unreserved", () => {
    const run = budgetLevel("run");
    const { steps, unreserved } = settleBudgetSteps(
      run.resources,
      budgetStepRequests,
    );
    const accepted = steps.filter((step) => step.accepted);

    for (const key of BUDGET_RESOURCE_KEYS) {
      const reserved = accepted.reduce(
        (sum, step) => sum + step.requested[key],
        0,
      );

      expect(reserved + unreserved[key]).toBe(run.resources[key]);
    }
  });

  test("denies the whole envelope on the single Resource that falls short", () => {
    const { steps, unreserved } = settleBudgetSteps(
      budgetLevel("run").resources,
      budgetStepRequests,
    );
    const denied = steps.filter((step) => !step.accepted);

    expect(denied).toHaveLength(1);
    expect(denied[0]?.name).toBe("escalate");
    expect(denied[0]?.shortfall).toEqual(["toolCalls"]);
    expect(denied[0]?.requested.tokens).toBeLessThanOrEqual(unreserved.tokens);
    expect(denied[0]?.requested.retries).toBeLessThanOrEqual(
      unreserved.retries,
    );
  });

  test("keeps a denied step from consuming the Resources it asked for", () => {
    const run = budgetLevel("run");
    const withoutDenied = budgetStepRequests.filter(
      (step) => step.name !== "escalate",
    );

    expect(
      settleBudgetSteps(run.resources, budgetStepRequests).unreserved,
    ).toEqual(settleBudgetSteps(run.resources, withoutDenied).unreserved);
  });
});

describe("policiesData", () => {
  test("marks the lowest ceiling as binding", () => {
    const binding = policiesData.find((policy) => policy.binds);

    expect(binding?.ceiling).toBe(POLICY_BINDING_CEILING);
    expect(POLICY_REQUEST_TOKENS).toBeGreaterThan(POLICY_BINDING_CEILING);
  });
});

describe("buildWorkflowWaterfall", () => {
  test("reserves the full envelope then settles to observed usage", () => {
    const points = buildWorkflowWaterfall();
    const settle = points.at(-1);
    const stepTotal = workflowsData.reduce((sum, step) => sum + step.tokens, 0);

    expect(points[0]?.cumulative).toBe(0);
    expect(points[0]?.reserved).toBe(WORKFLOW_RESERVED);
    expect(stepTotal).toBe(WORKFLOW_USED);
    expect(settle?.cumulative).toBe(WORKFLOW_USED);
    expect(WORKFLOW_RESERVED - WORKFLOW_USED).toBe(WORKFLOW_RETURNED);
  });
});

describe("evalVariants", () => {
  test("orders variants along a cost and denial trade-off", () => {
    expect(evalVariants[0]?.deniedRate).toBeLessThan(
      evalVariants[1]?.deniedRate ?? 0,
    );
    expect(evalVariants[1]?.p50).toBeGreaterThan(evalVariants[2]?.p50 ?? 0);
  });
});

describe("buildFrontierSeries", () => {
  test("places the knee on the efficient upper arm", () => {
    const series = buildFrontierSeries();

    expect(series.knee.tokens).toBe(KNEE_T);
    expect(series.knee.resolved).toBeCloseTo(upperAt(KNEE_T), 5);
    expect(series.knee.resolved).toBeGreaterThan(VERTEX_Q);
  });

  test("places ungoverned agents on the dominated lower arm", () => {
    const series = buildFrontierSeries();

    expect(series.ungoverned.resolved).toBeCloseTo(
      lowerAt(series.ungoverned.tokens),
      5,
    );
    expect(series.ungoverned.resolved).toBeLessThan(VERTEX_Q);
  });

  test("samples both arms from the shared vertex", () => {
    const series = buildFrontierSeries();

    expect(series.upper[0]).toEqual({ tokens: 350, resolved: 76 });
    expect(series.lower[0]).toEqual({ tokens: 350, resolved: 76 });
    expect(series.measuredRuns).toHaveLength(5);
  });
});

describe("buildFrontierRows", () => {
  test("merges series onto one row per distinct token value", () => {
    const rows = buildFrontierRows();
    const tokens = rows.map((row) => row.tokens);

    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens[0]).toBe(350);
    expect(tokens.at(-1)).toBeGreaterThan(2_000);
  });

  test("places the knee on the efficient upper arm", () => {
    const rows = buildFrontierRows();
    const kneeRow = rows.find((row) => row.knee != null);

    expect(kneeRow?.tokens).toBe(KNEE_T);
    expect(kneeRow?.knee).toBeCloseTo(upperAt(KNEE_T), 5);
    expect(kneeRow?.upper).toBeCloseTo(upperAt(KNEE_T), 5);
  });

  test("places ungoverned agents on the dominated lower arm", () => {
    const rows = buildFrontierRows();
    const ungovernedRow = rows.find((row) => row.ungoverned != null);

    expect(ungovernedRow).toBeDefined();
    expect(ungovernedRow?.ungoverned).toBeCloseTo(
      lowerAt(ungovernedRow!.tokens),
      5,
    );
    expect(ungovernedRow?.ungoverned).toBeLessThan(VERTEX_Q);
  });

  test("records measured runs on their token rows", () => {
    const rows = buildFrontierRows();
    const measuredRows = rows.filter((row) => row.measured != null);

    expect(measuredRows).toHaveLength(4);
  });
});
