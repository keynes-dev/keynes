import { useEffect, useRef } from "react";

/*
  The conveyor animation, drawn behind whatever it is put in: the ground grid
  fills the whole of it and the machine stands in one corner of that.

  `aside` puts the machine to the right, for content set beside it; without it
  the machine drops to the bottom, for content set above it. Either way this is
  a background, so the element it is given has to be the one doing the clipping.

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
      // Never in the way of selecting the text it sits under.
      className="pointer-events-none absolute inset-0"
      role="img"
      aria-label="A machine sorting shapes into boxes on a conveyor belt: each box receives the shape that fits the hole in its lid, and one that arrives the wrong way up is turned over by a mechanical arm."
    />
  );
}
