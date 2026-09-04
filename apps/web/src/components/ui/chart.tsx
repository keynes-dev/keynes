import type { ChartTheme } from "@tanstack/charts";
import type { Ref } from "react";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  {
    label: string;
    color: string;
  }
>;

export const CHART_TOOLTIP_CLASS = "keynes-chart-tooltip";

export const chartTheme = {
  foreground: "var(--foreground)",
  muted: "var(--muted-foreground)",
  grid: "var(--border)",
  background: "transparent",
  palette: [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ],
} satisfies ChartTheme;

interface ChartLegendProps {
  config: ChartConfig;
  items?: readonly string[];
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export function ChartLegend({
  config,
  items = Object.keys(config),
  className,
  ref,
}: ChartLegendProps) {
  return (
    <div
      className={cn("flex items-center justify-center gap-4", className)}
      ref={ref}
    >
      {items.map((key) => {
        const item = config[key];
        if (!item) {
          throw new Error(`Missing chart configuration for ${key}`);
        }

        return (
          <div className="flex items-center gap-1.5" key={key}>
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </div>
        );
      })}
    </div>
  );
}
