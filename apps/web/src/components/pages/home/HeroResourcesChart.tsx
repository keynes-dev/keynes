import { defineChart } from "@tanstack/charts";
import { barX } from "@tanstack/charts/bar";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { stack } from "@tanstack/charts/stack";
import { tooltip } from "@tanstack/charts/tooltip";

import {
  CHART_TOOLTIP_CLASS,
  type ChartConfig,
  chartTheme,
} from "@/components/ui/chart";
import { heroResourcesData } from "@/lib/charts";

import {
  BAR_SIZE,
  categoricalChartHeight,
  ChartFrame,
  Y_AXIS_WIDTH,
} from "./ChartFrame";

const chartConfig = {
  reserved: {
    label: "Reserved",
    color: "var(--chart-2)",
  },
  available: {
    label: "Available",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const series = ["reserved", "available"] as const;
const RESOURCE_Y_AXIS_WIDTH = Y_AXIS_WIDTH + 12;

const chartData = heroResourcesData.flatMap((resource) =>
  series.map((key) => ({
    name: resource.name,
    series: key,
    value: resource[key],
  })),
);

const definition = defineChart(
  {
    marks: [
      barX(chartData, {
        id: "resource-bars",
        x: "value",
        y: "name",
        z: "series",
        color: "series",
        key: (row) => `${row.name}:${row.series}`,
        layout: stack({ order: series }),
        maxThickness: BAR_SIZE,
        radius: 0,
      }),
    ],
    scales: {
      x: {
        scale: scaleLinear().domain([0, 10]),
        axis: false,
      },
      y: {
        scale: () => scaleBand<string>().padding(0.35),
        axis: {
          line: false,
          ticks: { size: 0 },
          tickLabels: {
            anchor: "start",
            dx: -(RESOURCE_Y_AXIS_WIDTH - 8),
            fontSize: 11,
            opacity: 1,
          },
        },
      },
    },
    color: {
      domain: series,
      range: series.map((key) => chartConfig[key].color),
    },
    margin: { top: 4, right: 8, bottom: 4, left: RESOURCE_Y_AXIS_WIDTH },
    theme: chartTheme,
  },
  {
    focus: "group-y",
    svgAnimation: false,
    tooltip: {
      use: tooltip,
      className: CHART_TOOLTIP_CLASS,
      anchor: "group-center",
      sort: "color-domain",
      content: (points) => ({
        title: points[0]?.datum.name ?? "",
        rows: points.map((point) => ({
          label: chartConfig[point.datum.series].label,
          value: point.datum.value.toLocaleString(),
          color: point.color,
        })),
      }),
    },
  },
);

export function HeroResourcesChart() {
  return (
    <ChartFrame
      ariaLabel="Reserved and available resources by scope"
      chartClassName="font-mono"
      config={chartConfig}
      definition={definition}
      height={categoricalChartHeight(heroResourcesData.length)}
      legendItems={series}
    />
  );
}
