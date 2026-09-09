import { useEffect, useRef } from "react";

/*
  The conveyor animation, drawn behind whatever it is put in: the ground grid
  fills the whole of it and the machine stands in one corner of that.

  Where in the frame the machine stands follows the shape of this element and is
  settled inside the drawing, so nothing about it is a prop: there is no state
  here to get out of step with the CSS the text beside it is laid out by.

  three and the scene are pulled in on mount rather than imported at the top, so
  neither is in the bundle the page first parses. Keep it that way for a second
  reason: the import being asynchronous is what makes a teardown before it
  settles free, since there is nothing built yet to throw away. A static import
  would build the whole scene inside the effect and hand every remount a real
  WebGL context to discard.

  The effect can be torn down before the import settles, hence the cancelled
  flag: without it a fast scroll past leaves a WebGL context nothing owns.
*/
export function ConveyorBelt() {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = holder.current;
    if (!container) return;

    let cancelled = false;
    let conveyor: { destroy(): void } | undefined;
    void import("@/lib/conveyor/main.js").then(({ createConveyor }) => {
      if (cancelled) return;
      conveyor = createConveyor(container);
    });

    return () => {
      cancelled = true;
      conveyor?.destroy();
    };
  }, []);

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
