import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/*
  The conveyor animation.

  Set `aside` when it is being used as a section's background, with something
  else laid over it: the machine then stands to one side and its ground grid
  runs the full width behind that content. Without it the drawing is a block of
  its own and the machine is centred in it.

  three and the scene are pulled in on mount rather than imported at the top, so
  neither is in the bundle the page first parses. The effect can be torn down
  before the import settles, hence the cancelled flag: without it a fast scroll
  past leaves a WebGL context nothing owns.
*/
export function ConveyorBelt({ aside = false }: { aside?: boolean }) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = holder.current;
    if (!container) return;

    let cancelled = false;
    let conveyor: { destroy(): void } | undefined;
    void import("@/lib/conveyor/main.js").then(({ createConveyor }) => {
      if (cancelled) return;
      conveyor = createConveyor(container, { aside });
    });

    return () => {
      cancelled = true;
      conveyor?.destroy();
    };
  }, [aside]);

  return (
    <div
      ref={holder}
      className={cn(
        // Never in the way of selecting the text it sits under.
        "pointer-events-none",
        aside ? "absolute inset-0" : "mt-10 h-80 w-full",
      )}
      role="img"
      aria-label="A machine sorting shapes into boxes on a conveyor belt: each box receives the shape that fits the hole in its lid, and one that arrives the wrong way up is turned over by a mechanical arm."
    />
  );
}
