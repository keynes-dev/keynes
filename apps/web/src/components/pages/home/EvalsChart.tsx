import { defineChart } from "@tanstack/charts";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { dot } from "@tanstack/charts/dot";
import { lineY } from "@tanstack/charts/line";
import { decorative } from "@tanstack/charts/mark/decorative";
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
  EVAL_DENIED_MAX,
  EVAL_P50_MAX,
  EVAL_P50_MIN,
  evalVariants,
} from "@/lib/charts";

import { ChartFrame, HOW_IT_WORKS_CHART_HEIGHT } from "./ChartFrame";

const chartConfig = {
  deniedRate: {
    label: "Variant",
    color: "var(--chart-accent)",
  },
} satisfies ChartConfig;

const evalData = evalVariants.map((variant) => ({
  id: variant.id,
  label: variant.label,
  p50: variant.p50,
  deniedRate: variant.deniedRate,
}));

const definition = defineChart(
  {
    marks: [
      decorative(
        lineY(evalData, {
          id: "denied-trend",
          x: "p50",
          y: "deniedRate",
          stroke: chartConfig.deniedRate.color,
          strokeDasharray: "4 4",
          strokeWidth: 1.5,
          curve: d3Curve(curveMonotoneX),
        }),
      ),
      dot(evalData, {
        id: "deniedRate",
        x: "p50",
        y: "deniedRate",
        key: "id",
        fill: chartConfig.deniedRate.color,
        r: 4,
      }),
      decorative(
        text(evalData, {
          id: "variant-labels",
          x: "p50",
          y: "deniedRate",
          text: "id",
          fill: "var(--foreground)",
          fontSize: 10,
          anchor: "middle",
          dy: -10,
        }),
      ),
    ],
    scales: {
      x: {
        scale: scaleLinear().domain([EVAL_P50_MIN, EVAL_P50_MAX]),
        axis: {
          line: false,
          ticks: {
            size: 0,
            format: (value) => value.toLocaleString(),
          },
          tickLabels: { fontSize: 11 },
          label: "p50 tokens",
        },
      },
      y: {
        scale: scaleLinear().domain([0, EVAL_DENIED_MAX]),
        grid: true,
        axis: {
          line: false,
          ticks: {
            size: 0,
            format: (value) => `${value}%`,
          },
          tickLabels: { fontSize: 11 },
          label: "% denied",
        },
      },
    },
    margin: { top: 18, right: 12, bottom: 30, left: 44 },
    theme: chartTheme,
  },
  {
    focus: "nearest",
    svgAnimation: false,
    tooltip: {
      use: tooltip,
      className: CHART_TOOLTIP_CLASS,
      anchor: "point",
      content: (points) => {
        const point = points[0];
        if (!point) return { rows: [] };

        return {
          title: point.datum.label,
          rows: [
            {
              label: chartConfig.deniedRate.label,
              value: `p50 ${point.datum.p50.toLocaleString()} · denied ${point.datum.deniedRate}%`,
              color: chartConfig.deniedRate.color,
            },
          ],
        };
      },
    },
  },
);

export function EvalsChart() {
  return (
    <ChartFrame
      ariaLabel="Evaluation cost and denial trade-off"
      config={chartConfig}
      definition={definition}
      height={HOW_IT_WORKS_CHART_HEIGHT}
      lead="harness-owned comparison · illustrative settled runs"
      legendItems={["deniedRate"]}
      note="tighter ceilings cost less and deny more"
    />
  );
}
