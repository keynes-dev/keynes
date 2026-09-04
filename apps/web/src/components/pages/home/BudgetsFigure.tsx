import type { ReactNode } from "react";

import {
  BUDGET_RESOURCE_KEYS,
  budgetCascade,
  budgetLevel,
  budgetStepRequests,
  budgetTokenShare,
  settleBudgetSteps,
  type BudgetResourceKey,
  type BudgetResources,
} from "@/lib/charts";
import { cn } from "@/lib/utils";

import { HOW_IT_WORKS_CHART_BLOCK_HEIGHT } from "./ChartFrame";
import { FigureFrame } from "./FigureFrame";

const GRID =
  "grid grid-cols-[minmax(0,1fr)_2.75rem_3.25rem_2.5rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_3.25rem_3.75rem_3rem] sm:gap-x-3";

const ROW = "rounded-sm px-2 py-0.5 font-mono text-[11px] leading-4 sm:px-2.5";

type Tone = "root" | "level" | "accepted" | "denied" | "unreserved";

const NUMBER_TONE: Record<Tone, string> = {
  root: "text-background",
  level: "text-foreground",
  accepted: "text-foreground",
  denied: "text-chart-denied/70",
  unreserved: "text-muted-foreground",
};

interface ResourceCellsProps {
  resources: BudgetResources;
  tone: Tone;
  shortfall?: BudgetResourceKey[];
}

function ResourceCells({
  resources,
  tone,
  shortfall = [],
}: ResourceCellsProps) {
  return (
    <>
      {BUDGET_RESOURCE_KEYS.map((key) => (
        <span className="text-right" key={key}>
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums",
              NUMBER_TONE[tone],
              shortfall.includes(key) &&
                "rounded-full bg-chart-denied px-1.5 py-0.5 font-semibold text-background",
            )}
          >
            {resources[key].toLocaleString()}
          </span>
        </span>
      ))}
    </>
  );
}

interface LabelProps {
  scope: string;
  name: string;
  tone: Tone;
  trailing?: ReactNode;
}

function Label({ scope, name, tone, trailing }: LabelProps) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span
        className={cn(
          "hidden shrink-0 text-[9px] tracking-wider uppercase opacity-55 sm:inline",
          tone === "root" ? "text-background" : "text-muted-foreground",
        )}
      >
        {scope}
      </span>
      <span
        className={cn("truncate", tone === "denied" && "text-chart-denied")}
      >
        {name}
      </span>
      {trailing}
    </span>
  );
}

const SPINE = "border-muted-foreground/35";
const SPINE_DENIED = "border-dashed border-chart-denied/60";

interface TreeRowProps {
  children: ReactNode;
  depth: number;
  /** Continues the spine past this junction so the next sibling connects. */
  continues?: boolean;
  dashed?: boolean;
}

function TreeRow({
  children,
  depth,
  continues = false,
  dashed = false,
}: TreeRowProps) {
  const spine = `calc(var(--indent) * ${depth - 1} + 3px)`;
  const elbow = dashed ? SPINE_DENIED : SPINE;

  return (
    <div
      className="relative"
      style={{ paddingLeft: `calc(var(--indent) * ${depth})` }}
    >
      <span
        aria-hidden
        className={cn("absolute top-0 h-1/2 border-l", elbow)}
        style={{ left: spine }}
      />
      {continues ? (
        <span
          aria-hidden
          className={cn("absolute top-1/2 bottom-0 border-l", SPINE)}
          style={{ left: spine }}
        />
      ) : null}
      <span
        aria-hidden
        className={cn("absolute top-1/2 border-t", elbow)}
        style={{ left: spine, width: "calc(var(--indent) - 4px)" }}
      />
      {children}
    </div>
  );
}

export function BudgetsFigure() {
  const [org, ...descendants] = budgetCascade;
  const run = budgetLevel("run");
  const { steps, unreserved } = settleBudgetSteps(
    run.resources,
    budgetStepRequests,
  );
  const stepDepth = budgetCascade.length;
  const reserved = steps.filter((step) => step.accepted).length;

  return (
    <FigureFrame height={HOW_IT_WORKS_CHART_BLOCK_HEIGHT}>
      <div
        aria-label={`budget cascade from org to run: ${reserved} steps reserved, ${steps.length - reserved} denied`}
        className="flex h-full min-w-0 w-full max-w-full flex-col justify-center gap-1.5 [--indent:0.625rem] sm:gap-2 sm:[--indent:1rem]"
        role="img"
      >
        <div
          className={cn(
            GRID,
            "px-2 pb-1 font-mono text-[9px] tracking-wider text-muted-foreground uppercase sm:px-2.5 sm:pb-1.5",
          )}
        >
          <span>budget</span>
          {BUDGET_RESOURCE_KEYS.map((key) => (
            <span className="text-right" key={key}>
              {key}
            </span>
          ))}
        </div>

        <div className={cn(GRID, ROW, "bg-foreground py-0.5 text-background")}>
          <Label name={org.name} scope={org.scope} tone="root" />
          <ResourceCells resources={org.resources} tone="root" />
        </div>

        {descendants.map((level, index) => (
          <TreeRow depth={index + 1} key={level.scope}>
            <div className={cn(GRID, ROW, "border bg-card")}>
              <Label
                name={level.name}
                scope={level.scope}
                tone="level"
                trailing={
                  <span className="ml-auto hidden shrink-0 pl-2 text-[9px] text-muted-foreground tabular-nums sm:inline">
                    {budgetTokenShare(level, budgetCascade[index])}% of parent
                  </span>
                }
              />
              <ResourceCells resources={level.resources} tone="level" />
            </div>
          </TreeRow>
        ))}

        {steps.map((step) => {
          const tone = step.accepted ? "accepted" : "denied";
          return (
            <TreeRow
              continues
              dashed={!step.accepted}
              depth={stepDepth}
              key={step.name}
            >
              <div
                className={cn(
                  GRID,
                  ROW,
                  "border border-l-2",
                  step.accepted
                    ? "border-l-chart-accent bg-card"
                    : "border-dashed border-chart-denied/50 border-l-chart-denied bg-chart-denied/5",
                )}
              >
                <Label
                  name={step.name}
                  scope="step"
                  tone={tone}
                  trailing={
                    <span
                      className={cn(
                        "ml-auto hidden shrink-0 pl-2 text-[9px] font-semibold tracking-wider sm:inline",
                        step.accepted
                          ? "text-chart-accent"
                          : "text-chart-denied",
                      )}
                    >
                      {step.accepted ? "RESERVED" : "DENIED"}
                    </span>
                  }
                />
                <ResourceCells
                  resources={step.requested}
                  shortfall={step.shortfall}
                  tone={tone}
                />
              </div>
            </TreeRow>
          );
        })}

        <TreeRow depth={stepDepth}>
          <div
            className={cn(
              GRID,
              ROW,
              "border border-dashed text-muted-foreground",
            )}
          >
            <Label name="unreserved" scope="run" tone="unreserved" />
            <ResourceCells resources={unreserved} tone="unreserved" />
          </div>
        </TreeRow>
      </div>
    </FigureFrame>
  );
}
