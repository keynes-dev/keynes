import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FigureFrameProps {
  children: ReactNode;
  height: number;
  lead?: ReactNode;
  note?: ReactNode;
  className?: string;
}

export function FigureFrame({
  children,
  height,
  lead,
  note,
  className,
}: FigureFrameProps) {
  return (
    <div className="space-y-2">
      {lead ? (
        <p className="font-mono text-xs text-muted-foreground">{lead}</p>
      ) : null}
      <div
        className={cn("h-full min-w-0 w-full overflow-visible", className)}
        style={{ height }}
      >
        {children}
      </div>
      {note ? (
        <div className="text-center font-mono text-xs text-muted-foreground">
          {note}
        </div>
      ) : null}
    </div>
  );
}
