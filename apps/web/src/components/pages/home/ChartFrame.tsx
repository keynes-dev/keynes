import type { ChartValue, DomChartDefinition } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ChartLegend, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export const ROW_HEIGHT = 26;
export const BAR_SIZE = 14;
export const AXIS_BAND = 28;
export const Y_AXIS_WIDTH = 84;

export const CHART_MARGIN = {
  left: 4,
  right: 8,
  top: 4,
  bottom: 4,
} as const;

export const AXIS_TICK = {
  fontSize: 11,
  fontFamily: "monospace",
} as const;

export const LEGEND_CLASS = "flex-wrap gap-x-4 gap-y-1 pt-2";
const LEGEND_HEIGHT = 24;

export function categoricalChartHeight(rows: number): number {
  return rows * ROW_HEIGHT + AXIS_BAND;
}

const HOW_IT_WORKS_LEAD_NOTE_BAND = 48;

/** Shared chart area height inside HowItWorks figures. */
export const HOW_IT_WORKS_CHART_HEIGHT = 248;

/** Fixed chart block in HowItWorks (lead + chart + note). */
export const HOW_IT_WORKS_CHART_BLOCK_HEIGHT =
  HOW_IT_WORKS_CHART_HEIGHT + HOW_IT_WORKS_LEAD_NOTE_BAND;

interface ChartFrameProps<
  TDatum,
  TXValue extends ChartValue,
  TYValue extends ChartValue,
> {
  ariaLabel: string;
  config: ChartConfig;
  definition: DomChartDefinition<TDatum, TXValue, TYValue>;
  height: number;
  legendItems?: readonly string[];
  lead?: ReactNode;
  note?: ReactNode;
  className?: string;
  chartClassName?: string;
}

export function ChartFrame<
  TDatum,
  TXValue extends ChartValue,
  TYValue extends ChartValue,
>({
  ariaLabel,
  config,
  definition,
  height,
  legendItems,
  lead,
  note,
  className,
  chartClassName,
}: ChartFrameProps<TDatum, TXValue, TYValue>) {
  const legendRef = useRef<HTMLDivElement>(null);
  const [legendHeight, setLegendHeight] = useState(LEGEND_HEIGHT);

  useEffect(() => {
    const legend = legendRef.current;
    if (!legend) return;

    const syncLegendHeight = () => {
      const nextHeight = Math.ceil(legend.getBoundingClientRect().height);
      if (nextHeight > 0) setLegendHeight(nextHeight);
    };

    syncLegendHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncLegendHeight);
      return () => window.removeEventListener("resize", syncLegendHeight);
    }

    const observer = new ResizeObserver(syncLegendHeight);
    observer.observe(legend);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-2">
      {lead ? (
        <p className="font-mono text-xs text-muted-foreground">{lead}</p>
      ) : null}
      <div
        className={cn("w-full text-xs", className)}
        data-slot="chart"
        style={{ height }}
      >
        <Chart
          ariaLabel={ariaLabel}
          className={cn("w-full", chartClassName)}
          definition={definition}
          height={height - legendHeight}
          initialWidth={320}
        />
        <ChartLegend
          className={LEGEND_CLASS}
          config={config}
          items={legendItems}
          ref={legendRef}
        />
      </div>
      {note ? (
        <div className="text-center font-mono text-xs text-muted-foreground">
          {note}
        </div>
      ) : null}
    </div>
  );
}
