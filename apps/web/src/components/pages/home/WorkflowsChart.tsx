import { defineChart } from "@tanstack/charts";
import { areaY } from "@tanstack/charts/area";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { decorative } from "@tanstack/charts/mark/decorative";
import { ruleX, ruleY } from "@tanstack/charts/rule";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { text } from "@tanstack/charts/text";
import { tooltip } from "@tanstack/charts/tooltip";
import { curveStepAfter } from "d3-shape";

import {
  CHART_TOOLTIP_CLASS,
  type ChartConfig,
  chartTheme,
} from "@/components/ui/chart";
import {
  buildWorkflowWaterfall,
  WORKFLOW_RESERVED,
  WORKFLOW_RETURNED,
  WORKFLOW_USED,
} from "@/lib/charts";

import { ChartFrame, HOW_IT_WORKS_CHART_HEIGHT } from "./ChartFrame";

const chartConfig = {
  cumulative: {
    label: "Observed usage",
    color: "var(--chart-2)",
  },
  held: {
    label: "Held but unspent",
    color: "var(--chart-4)",
  },
  reserved: {
    label: "Reserved envelope",
    color: "var(--chart-accent)",
  },
} satisfies ChartConfig;

const waterfallData = buildWorkflowWaterfall().map((point) => ({
  ...point,
  held: Math.max(WORKFLOW_RESERVED - point.cumulative, 0),
}));

const curve = d3Curve(curveStepAfter);
const legendItems = ["cumulative", "held"] as const;
const settleStep = waterfallData.at(-1)?.step ?? "settle";

const definition = defineChart(
  {
    marks: [
      areaY(waterfallData, {
        id: "cumulative",
        x: "step",
        y1: 0,
        y2: "cumulative",
        fill: chartConfig.cumulative.color,
        fillOpacity: 0.35,
        stroke: chartConfig.cumulative.color,
        strokeWidth: 1.5,
        curve,
      }),
      areaY(waterfallData, {
        id: "held",
        x: "step",
        y1: "cumulative",
        y2: "reserved",
        fill: chartConfig.held.color,
        fillOpacity: 0.25,
        stroke: chartConfig.held.color,
        strokeWidth: 1,
        curve,
      }),
      ruleY([WORKFLOW_RESERVED], {
        id: "reserved-rule",
        stroke: chartConfig.reserved.color,
        strokeDasharray: "4 4",
      }),
      ruleX([settleStep], {
        id: "settle-rule",
        stroke: chartConfig.reserved.color,
        strokeDasharray: "4 4",
      }),
      decorative(
        text(
          [{ step: settleStep, value: WORKFLOW_RESERVED, label: "reserved" }],
          {
            id: "reserved-label",
            x: "step",
            y: "value",
            text: "label",
            fill: "var(--muted-foreground)",
            fontSize: 10,
            anchor: "end",
            dx: -4,
            dy: 8,
          },
        ),
      ),
      decorative(
        text(
          [
            {
              step: settleStep,
              value: WORKFLOW_RESERVED,
              label: `${WORKFLOW_RETURNED} returned`,
            },
          ],
          {
            id: "returned-label",
            x: "step",
            y: "value",
            text: "label",
            fill: chartConfig.reserved.color,
            fontSize: 10,
            anchor: "end",
            dx: -4,
            dy: 22,
          },
        ),
      ),
    ],
    scales: {
      x: {
        scale: () => scalePoint<string>().padding(0.12),
        axis: {
          line: false,
          ticks: { size: 0 },
          tickLabels: { fontSize: 11, thin: false },
        },
      },
      y: {
        scale: scaleLinear().domain([0, WORKFLOW_RESERVED]),
        axis: {
          line: false,
          ticks: {
            size: 0,
            format: (value) => value.toLocaleString(),
          },
          tickLabels: { fontSize: 11 },
          label: "tokens",
        },
      },
    },
    margin: { top: 8, right: 12, bottom: 30, left: 44 },
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
          title: point.datum.step,
          rows: legendItems.map((key) => ({
            label: chartConfig[key].label,
            value:
              key === "cumulative"
                ? `${point.datum.cumulative.toLocaleString()} used`
                : `${point.datum.held.toLocaleString()} held`,
            color: chartConfig[key].color,
          })),
        };
      },
    },
  },
);

export function WorkflowsChart() {
  return (
    <ChartFrame
      ariaLabel="Workflow token usage and held reservation"
      config={chartConfig}
      definition={definition}
      height={HOW_IT_WORKS_CHART_HEIGHT}
      lead={`support-workflow · reserved ${WORKFLOW_RESERVED.toLocaleString()} tokens`}
      legendItems={legendItems}
      note={`used ${WORKFLOW_USED.toLocaleString()} · returned ${WORKFLOW_RETURNED} to parent at settle`}
    />
  );
}
