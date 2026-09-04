/**
 * Illustrative chart data for the landing page.
 * Numeric series extracted from the former ASCII diagrams.
 */

export interface HeroResourceRow {
  name: string;
  reserved: number;
  available: number;
  display: string;
}

export const heroResourcesData: HeroResourceRow[] = [
  { name: "tokens", reserved: 4, available: 6, display: "6,500" },
  { name: "toolCalls", reserved: 6, available: 4, display: "4" },
  { name: "retries", reserved: 7, available: 3, display: "3" },
  { name: "escalations", reserved: 8, available: 2, display: "2" },
];

export const BUDGET_RESOURCE_KEYS = ["tokens", "toolCalls", "retries"] as const;

export type BudgetResourceKey = (typeof BUDGET_RESOURCE_KEYS)[number];

export type BudgetResources = Record<BudgetResourceKey, number>;

/** Delegation levels, from the org envelope down to a single run. */
export const BUDGET_SCOPES = ["org", "team", "workflow", "run"] as const;

export type BudgetScope = (typeof BUDGET_SCOPES)[number];

export interface BudgetLevel {
  scope: BudgetScope;
  name: string;
  resources: BudgetResources;
}

/** Each level reserves a slice of the level above it; the run funds the steps. */
export const budgetCascade: BudgetLevel[] = [
  {
    scope: "org",
    name: "acme",
    resources: { tokens: 96_000, toolCalls: 320, retries: 80 },
  },
  {
    scope: "team",
    name: "support",
    resources: { tokens: 24_000, toolCalls: 96, retries: 24 },
  },
  {
    scope: "workflow",
    name: "ticket-triage",
    resources: { tokens: 8_000, toolCalls: 32, retries: 8 },
  },
  {
    scope: "run",
    name: "run #4812",
    resources: { tokens: 2_400, toolCalls: 9, retries: 3 },
  },
];

export function budgetLevel(scope: BudgetScope): BudgetLevel {
  const level = budgetCascade.find((entry) => entry.scope === scope);
  if (!level) {
    throw new Error(`budgetCascade is missing the ${scope} level`);
  }
  return level;
}

/** Share of the parent's tokens a level holds, as a whole percent. */
export function budgetTokenShare(
  level: BudgetLevel,
  parent: BudgetLevel,
): number {
  return Math.round((level.resources.tokens / parent.resources.tokens) * 100);
}

export interface BudgetStepRequest {
  name: string;
  requested: BudgetResources;
}

/**
 * The run's steps in execution order. `escalate` fits on tokens and retries but
 * asks for more toolCalls than the run still holds.
 */
export const budgetStepRequests: BudgetStepRequest[] = [
  { name: "classify", requested: { tokens: 180, toolCalls: 1, retries: 0 } },
  { name: "search", requested: { tokens: 640, toolCalls: 4, retries: 1 } },
  { name: "draft", requested: { tokens: 900, toolCalls: 2, retries: 1 } },
  { name: "escalate", requested: { tokens: 400, toolCalls: 3, retries: 1 } },
];

export interface BudgetStepDecision extends BudgetStepRequest {
  accepted: boolean;
  shortfall: BudgetResourceKey[];
}

export interface BudgetSettlement {
  steps: BudgetStepDecision[];
  /** What the run still holds once every step has been decided. */
  unreserved: BudgetResources;
}

/** Resources the request asks for beyond what the parent still holds. */
export function shortfallKeys(
  requested: BudgetResources,
  available: BudgetResources,
): BudgetResourceKey[] {
  return BUDGET_RESOURCE_KEYS.filter((key) => requested[key] > available[key]);
}

function reserve(
  available: BudgetResources,
  requested: BudgetResources,
): BudgetResources {
  const next = { ...available };
  for (const key of BUDGET_RESOURCE_KEYS) {
    next[key] = available[key] - requested[key];
  }
  return next;
}

/**
 * Walks the steps in order against the run's Budget. A step either reserves
 * every Resource it asked for or is denied whole, reserving nothing.
 */
export function settleBudgetSteps(
  available: BudgetResources,
  requests: BudgetStepRequest[],
): BudgetSettlement {
  let unreserved = available;

  const steps = requests.map((request) => {
    const shortfall = shortfallKeys(request.requested, unreserved);
    if (shortfall.length > 0) {
      return { ...request, accepted: false, shortfall };
    }
    unreserved = reserve(unreserved, request.requested);
    return { ...request, accepted: true, shortfall };
  });

  return { steps, unreserved };
}

const CEILING_MAX = 2_500;

export interface PolicyCeiling {
  name: string;
  ceiling: number;
  binds?: boolean;
}

export const policiesData: PolicyCeiling[] = [
  { name: "seat_policy", ceiling: 2_500 },
  { name: "tier_policy", ceiling: 2_200 },
  { name: "budget_policy", ceiling: 1_800 },
  { name: "risk_policy", ceiling: 1_000, binds: true },
];

export const POLICY_REQUEST_TOKENS = 1_800;
export const POLICY_BINDING_CEILING = 1_000;

export { CEILING_MAX };

export interface WorkflowStep {
  name: string;
  tokens: number;
}

export const workflowsData: WorkflowStep[] = [
  { name: "classify", tokens: 180 },
  { name: "search x2", tokens: 640 },
  { name: "draft", tokens: 400 },
  { name: "escalate", tokens: 80 },
];

export const WORKFLOW_RESERVED = 1_500;
export const WORKFLOW_USED = 1_300;
export const WORKFLOW_RETURNED = 200;

export interface WorkflowWaterfallPoint {
  step: string;
  cumulative: number;
  reserved: number;
}

export function buildWorkflowWaterfall(): WorkflowWaterfallPoint[] {
  let cumulative = 0;
  const points: WorkflowWaterfallPoint[] = [
    {
      step: "reserve",
      cumulative: 0,
      reserved: WORKFLOW_RESERVED,
    },
  ];

  for (const step of workflowsData) {
    cumulative += step.tokens;
    points.push({
      step: step.name,
      cumulative,
      reserved: WORKFLOW_RESERVED,
    });
  }

  points.push({
    step: "settle",
    cumulative: WORKFLOW_USED,
    reserved: WORKFLOW_RESERVED,
  });

  return points;
}

export interface EvalVariant {
  id: string;
  label: string;
  p50: number;
  deniedRate: number;
}

export const evalVariants: EvalVariant[] = [
  { id: "v1", label: "v1 prompt only", p50: 1_240, deniedRate: 0 },
  { id: "v2", label: "v2 policy ceilings", p50: 980, deniedRate: 6 },
  { id: "v3", label: "v3 tighter ceilings", p50: 820, deniedRate: 14 },
];

export const EVAL_P50_MIN = 760;
export const EVAL_P50_MAX = 1_300;
export const EVAL_DENIED_MAX = 16;

/* ---------------- efficient frontier ---------------- */

export const VERTEX_T = 350;
export const VERTEX_Q = 76;
export const CURVE_C = 6.5;
export const UPPER_RISE = 18;
export const LOWER_DROP = 15;
export const T_MAX = 3_000;
export const KNEE_T = 1_200;
export const LOOSE_T = 1_600;

export function spendFor(offset: number): number {
  return VERTEX_T + CURVE_C * offset * offset;
}

export function offsetAt(tokens: number): number {
  return Math.sqrt((tokens - VERTEX_T) / CURVE_C);
}

export function upperAt(tokens: number): number {
  return VERTEX_Q + offsetAt(tokens);
}

export function lowerAt(tokens: number): number {
  return VERTEX_Q - offsetAt(tokens);
}

export interface FrontierPoint {
  tokens: number;
  resolved: number;
}

export interface FrontierSeries {
  upper: FrontierPoint[];
  lower: FrontierPoint[];
  measuredRuns: FrontierPoint[];
  knee: FrontierPoint;
  ungoverned: FrontierPoint;
}

function armPoints(span: number, sign: 1 | -1): FrontierPoint[] {
  const points: FrontierPoint[] = [];
  for (let i = 0; i <= 100; i++) {
    const v = (span * i) / 100;
    points.push({
      tokens: spendFor(v),
      resolved: VERTEX_Q + sign * v,
    });
  }
  return points;
}

const MEASURED_RUNS: [number, number][] = [
  [800, 82],
  [1_400, 86],
  [2_000, 90],
  [900, 69],
  [1_400, 65],
];

export function buildFrontierSeries(): FrontierSeries {
  return {
    upper: armPoints(UPPER_RISE, 1),
    lower: armPoints(LOWER_DROP, -1),
    measuredRuns: MEASURED_RUNS.map(([tokens, resolved]) => ({
      tokens,
      resolved,
    })),
    knee: { tokens: KNEE_T, resolved: upperAt(KNEE_T) },
    ungoverned: { tokens: LOOSE_T, resolved: lowerAt(LOOSE_T) },
  };
}

export interface FrontierRow {
  tokens: number;
  upper?: number;
  lower?: number;
  measured?: number;
  knee?: number;
  ungoverned?: number;
}

function upperResolvedAt(tokens: number): number | undefined {
  if (tokens < VERTEX_T) {
    return undefined;
  }
  return upperAt(tokens);
}

function lowerResolvedAt(tokens: number): number | undefined {
  if (tokens < VERTEX_T) {
    return undefined;
  }
  return lowerAt(tokens);
}

export function buildFrontierRows(): FrontierRow[] {
  const series = buildFrontierSeries();
  const byTokens = new Map<number, FrontierRow>();

  for (const point of series.upper) {
    const row = byTokens.get(point.tokens) ?? { tokens: point.tokens };
    row.upper = point.resolved;
    byTokens.set(point.tokens, row);
  }

  for (const point of series.lower) {
    const row = byTokens.get(point.tokens) ?? { tokens: point.tokens };
    row.lower = point.resolved;
    byTokens.set(point.tokens, row);
  }

  for (const point of series.measuredRuns) {
    const row = byTokens.get(point.tokens) ?? { tokens: point.tokens };
    row.measured = point.resolved;
    byTokens.set(point.tokens, row);
  }

  const kneeRow = byTokens.get(series.knee.tokens) ?? {
    tokens: series.knee.tokens,
  };
  kneeRow.knee = series.knee.resolved;
  kneeRow.upper ??= upperResolvedAt(series.knee.tokens);
  byTokens.set(series.knee.tokens, kneeRow);

  const ungovernedRow = byTokens.get(series.ungoverned.tokens) ?? {
    tokens: series.ungoverned.tokens,
  };
  ungovernedRow.ungoverned = series.ungoverned.resolved;
  ungovernedRow.lower ??= lowerResolvedAt(series.ungoverned.tokens);
  byTokens.set(series.ungoverned.tokens, ungovernedRow);

  return [...byTokens.values()].sort(
    (left, right) => left.tokens - right.tokens,
  );
}
