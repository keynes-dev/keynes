import { policiesData, POLICY_REQUEST_TOKENS } from "@/lib/charts";
import { cn } from "@/lib/utils";

import { HOW_IT_WORKS_CHART_BLOCK_HEIGHT } from "./ChartFrame";
import { FigureFrame } from "./FigureFrame";

const GRID =
  "grid grid-cols-[minmax(0,1fr)_5.5rem_3.25rem] items-center gap-x-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_3.75rem] sm:gap-x-4";

const ROW =
  "relative min-h-0 flex-1 px-3 font-mono text-xs leading-none sm:px-3.5 sm:text-[13px]";

const POLICY_WHEN = "when leadScore >= 80";

type Tone = "ok" | "binds" | "denied";

function Status({ tone }: { tone: Tone }) {
  let label: string;
  switch (tone) {
    case "ok":
      label = "ok";
      break;
    case "binds":
      label = "BINDS";
      break;
    case "denied":
      label = "DENIED";
      break;
    default: {
      const exhaustive: never = tone;
      throw new Error(`unhandled policy tone: ${exhaustive}`);
    }
  }

  return (
    <span
      className={cn(
        "text-right text-[11px] tracking-wider",
        tone === "ok" && "text-muted-foreground",
        tone === "binds" && "font-semibold text-chart-accent",
        tone === "denied" && "font-semibold text-chart-denied",
      )}
    >
      {label}
    </span>
  );
}

interface LabelProps {
  scope?: string;
  name: string;
  tone: Tone;
}

function Label({ scope, name, tone }: LabelProps) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      {scope ? (
        <span className="hidden shrink-0 text-[10px] tracking-wider text-muted-foreground uppercase opacity-55 sm:inline">
          {scope}
        </span>
      ) : null}
      <span
        className={cn("truncate", tone === "denied" && "text-chart-denied")}
      >
        {name}
      </span>
    </span>
  );
}

export function PoliciesFigure() {
  const ceilings = [...policiesData].sort(
    (left, right) => right.ceiling - left.ceiling,
  );

  return (
    <FigureFrame height={HOW_IT_WORKS_CHART_BLOCK_HEIGHT}>
      <div
        aria-label="Four policy ceilings; risk_policy binds at 1,000 tokens; request of 1,800 is denied"
        className="box-border flex h-full min-w-0 w-full flex-col gap-1.5 overflow-visible p-px sm:gap-2"
        role="img"
      >
        <div className={cn(GRID, "shrink-0 px-3 sm:px-3.5")}>
          <span className="font-mono text-xs text-muted-foreground">
            {POLICY_WHEN}
          </span>
          <span className="text-right font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            tokens
          </span>
          <span />
        </div>

        {ceilings.map((policy) => {
          const binds = Boolean(policy.binds);
          const tone: Tone = binds ? "binds" : "ok";

          return (
            <div className={cn(GRID, ROW, "border bg-card")} key={policy.name}>
              {binds ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-0.5 bg-chart-accent"
                />
              ) : null}
              <Label name={policy.name} scope="policy" tone={tone} />
              <span
                className={cn(
                  "text-right tabular-nums",
                  binds ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {`<= ${policy.ceiling.toLocaleString()}`}
              </span>
              <Status tone={tone} />
            </div>
          );
        })}

        <div
          className={cn(
            GRID,
            ROW,
            "border border-dashed border-chart-denied/50 bg-chart-denied/5",
          )}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-0.5 bg-chart-denied"
          />
          <Label name="request" tone="denied" />
          <span className="text-right tabular-nums text-chart-denied/70">
            {POLICY_REQUEST_TOKENS.toLocaleString()}
          </span>
          <Status tone="denied" />
        </div>
      </div>
    </FigureFrame>
  );
}
