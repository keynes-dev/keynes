import { defineChart } from "@tanstack/charts";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { dot } from "@tanstack/charts/dot";
import { lineY } from "@tanstack/charts/line";
import { decorative } from "@tanstack/charts/mark/decorative";
import { ruleX } from "@tanstack/charts/rule";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { text } from "@tanstack/charts/text";
import { tooltip } from "@tanstack/charts/tooltip";
import { curveMonotoneX } from "d3-shape";

import {
  CHART_TOOLTIP_CLASS,
  type ChartConfig,
  chartTheme,
} from "@/components/ui/chart";
import {
  buildFrontierRows,
  KNEE_T,
  lowerAt,
  T_MAX,
  upperAt,
} from "@/lib/charts";

import { ChartFrame } from "./ChartFrame";

const chartConfig = {
  upper: {
    label: "Efficient frontier",
    color: "var(--chart-accent)",
  },
  lower: {
    label: "Dominated",
    color: "var(--chart-3)",
  },
  measured: {
    label: "Measured run",
    color: "var(--chart-4)",
  },
  knee: {
    label: "Ceiling at the knee",
    color: "var(--chart-accent)",
  },
  ungoverned: {
    label: "Ungoverned agents",
    color: "var(--chart-denied)",
  },
} satisfies ChartConfig;

function isLegendItem(key: string): key is keyof typeof chartConfig {
  return key in chartConfig;
}

const frontierData = buildFrontierRows();
const upperData = frontierData.filter(
  (row): row is typeof row & { upper: number } => row.upper != null,
);
const lowerData = frontierData.filter(
  (row): row is typeof row & { lower: number } => row.lower != null,
);
const measuredData = frontierData.filter(
  (row): row is typeof row & { measured: number } => row.measured != null,
);
const kneeData = frontierData.filter(
  (row): row is typeof row & { knee: number } => row.knee != null,
);
const ungovernedData = frontierData.filter(
  (row): row is typeof row & { ungoverned: number } => row.ungoverned != null,
);
const legendItems = [
  "upper",
  "lower",
  "measured",
  "knee",
  "ungoverned",
] as const;

const definition = defineChart(
  {
    marks: [
      lineY(upperData, {
        id: "upper",
        x: "tokens",
        y: "upper",
        stroke: chartConfig.upper.color,
        strokeWidth: 1.5,
        curve: d3Curve(curveMonotoneX),
      }),
      lineY(lowerData, {
        id: "lower",
        x: "tokens",
        y: "lower",
        stroke: chartConfig.lower.color,
        strokeDasharray: "4 4",
        strokeWidth: 1.5,
        curve: d3Curve(curveMonotoneX),
      }),
      dot(measuredData, {
        id: "measured",
        x: "tokens",
        y: "measured",
        key: "tokens",
        fill: chartConfig.measured.color,
        r: 3.5,
      }),
      text(kneeData, {
        id: "knee",
        x: "tokens",
        y: "knee",
        text: () => "★",
        key: "tokens",
        fill: chartConfig.knee.color,
        fontSize: 15,
        anchor: "middle",
        dy: 1,
      }),
      text(ungovernedData, {
        id: "ungoverned",
        x: "tokens",
        y: "ungoverned",
        text: () => "×",
        key: "tokens",
        fill: chartConfig.ungoverned.color,
        fontSize: 18,
        fontWeight: 600,
        anchor: "middle",
        dy: 1,
      }),
      ruleX([KNEE_T], {
        id: "ceiling-rule",
        stroke: chartConfig.knee.color,
        strokeDasharray: "4 4",
      }),
      decorative(
        text([{ tokens: KNEE_T, resolved: 95, label: "ceiling" }], {
          id: "ceiling-label",
          x: "tokens",
          y: "resolved",
          text: "label",
          fill: "var(--muted-foreground)",
          fontSize: 11,
          anchor: "end",
          dx: -4,
          dy: 12,
        }),
      ),
    ],
    scales: {
      x: {
        scale: scaleLinear().domain([0, T_MAX]),
        axis: {
          line: false,
          ticks: {
            size: 0,
            format: (value) => value.toLocaleString(),
          },
          tickLabels: { fontSize: 11 },
        },
      },
      y: {
        scale: scaleLinear().domain([55, 95]),
        grid: true,
        axis: {
          line: false,
          ticks: {
            size: 0,
            format: (value) => `${value}%`,
          },
          tickLabels: { fontSize: 11 },
          label: "% resolved",
        },
      },
    },
    margin: { top: 8, right: 8, bottom: 24, left: 44 },
    theme: chartTheme,
  },
  {
    focus: "group-x",
    svgAnimation: false,
    tooltip: {
      use: tooltip,
      className: CHART_TOOLTIP_CLASS,
      anchor: "group-center",
      sort: "focus",
      content: (points) => {
        const point = points[0];
        if (!point) return { rows: [] };

        return {
          title: `${Number(point.xValue).toLocaleString()} tokens`,
          rows: points.flatMap((candidate) => {
            if (!isLegendItem(candidate.markId)) return [];
            const item = chartConfig[candidate.markId];

            return [
              {
                label: item.label,
                value: `${Math.round(Number(candidate.yValue))}% resolved`,
                color: item.color,
              },
            ];
          }),
        };
      },
    },
  },
);

export function FrontierChart() {
  const kneeResolved = upperAt(KNEE_T);
  const ungovernedTokens =
    frontierData.find((row) => row.ungoverned)?.tokens ?? 0;

  return (
    <ChartFrame
      ariaLabel="Token spend and resolved outcome frontier"
      config={chartConfig}
      definition={definition}
      height={280}
      legendItems={legendItems}
      note={
        <div className="space-y-1 text-left">
          <p>
            ceiling at the knee · {KNEE_T.toLocaleString()} tokens ·{" "}
            {Math.round(kneeResolved)}% resolved
          </p>
          <p>
            ungoverned agents · {ungovernedTokens.toLocaleString()} tokens ·{" "}
            {Math.round(lowerAt(ungovernedTokens))}% resolved
          </p>
          <p className="text-chart-denied">more spend, worse outcomes</p>
        </div>
      }
    />
  );
}
