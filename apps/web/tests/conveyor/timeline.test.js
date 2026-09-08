/*
  The conveyor animation's schedule, checked without a renderer.

  Only the claims that are expensive to see by eye are here: that the loop is
  seamless, that the tubes account for every shape they hold, that no box shows
  the same cut twice, and that nothing steps where a viewer would catch it. A
  bad hole pairing shows on the one box that is ever turned over; a roll that
  steps shows for a third of a frame every few loops.
*/
import { describe as suite, expect, it } from "vitest";

import {
  BELT,
  BOXES,
  CONFIG,
  ITEM,
  SHAPES,
  WRAP,
} from "../../public/animations/conveyor/config.js";
import {
  createTimeline,
  TUBES,
} from "../../public/animations/conveyor/timeline.js";

// The camera answers this in the browser; any plausible height will do here.
const SKY = [3, 3, 3];
const { describe: frameAt, cycles: CYCLES, loop: LOOP } = createTimeline(SKY);
const POUR = CYCLES[0];
const STALL = CYCLES[CYCLES.length - 1];
const snapshot = (t) => JSON.parse(JSON.stringify(frameAt(t)));
const sweep = (step = 1 / 240) => {
  const out = [];
  for (let t = 0; t < LOOP; t += step) out.push(snapshot(t));
  return out;
};

suite("box faces", () => {
  // From this camera exactly three faces of a box ever show, and a box rolled
  // half a turn about x shows a different three: the same +x face, its base
  // where its lid was, and its far z face brought round to the near side.
  it("shows three different shapes in both stances of every box", () => {
    for (const box of BOXES) {
      for (const stance of [
        [box.top, box.xPos, box.zPos],
        [box.base, box.xPos, box.zNeg],
      ]) {
        expect(new Set(stance).size, `repeated shape in ${stance}`).toBe(3);
      }
    }
    const turning = CONFIG.sequence.findIndex((entry) => entry.reject);
    expect(BOXES[turning].base).toBe(CONFIG.sequence[turning].dispense);
  });
});

suite("the loop", () => {
  it("covers every instant exactly once", () => {
    let clock = 0;
    for (const cycle of CYCLES) {
      expect(cycle.start).toBeCloseTo(clock, 12);
      clock += cycle.length;
    }
    expect(clock).toBeCloseTo(LOOP, 12);
  });

  it("comes back to the frame it started on, with the arm parked", () => {
    const key = (frame) =>
      frame.boxes
        .map((box, k) =>
          [k % BOXES.length, box.z.toFixed(6), box.roll.toFixed(6)].join(":"),
        )
        .sort();
    const start = snapshot(0);
    const end = snapshot(LOOP - 1e-9);
    expect(key(end)).toEqual(key(start));
    expect(end.stacks.map((s) => s.count)).toEqual(
      start.stacks.map((s) => s.count),
    );
    for (const cycle of CYCLES) {
      const parked = snapshot(cycle.start + cycle.length - 1e-9).arm;
      expect(parked.x).toBeCloseTo(start.arm.x, 9);
      expect(parked.grip).toBe(0);
    }
  });

  // A box only ever turns under the arm, so its roll may not step anywhere it
  // can be seen doing it. The one place it may is the wrap, half a belt away,
  // where a box that has been round comes back as one that has not.
  it("never steps a box's roll anywhere it could be seen", () => {
    const seam = WRAP / 2 - BELT.slot;
    let last = null;
    for (const frame of sweep(1 / 480)) {
      if (last) {
        frame.boxes.forEach((box, k) => {
          if (Math.abs(box.z) > seam) return;
          const step = Math.abs(box.roll - last[k].roll);
          expect(
            step,
            `box ${k} stepped ${step.toFixed(3)} at z=${box.z.toFixed(3)}`,
          ).toBeLessThan(0.05);
        });
      }
      last = frame.boxes;
    }
  });

  it("leaves nothing undefined anywhere in a frame", () => {
    for (const frame of sweep()) {
      for (const value of JSON.stringify(frame).match(
        /-?\d+(\.\d+)?(e-?\d+)?/g,
      ) ?? []) {
        expect(Number.isFinite(Number(value))).toBe(true);
      }
    }
  });
});

suite("the tubes", () => {
  it("opens empty, is charged by the end of the pour, and is spent by the stall", () => {
    const counts = (t) => snapshot(t).stacks.map((s) => s.count);
    expect(counts(0)).toEqual(SHAPES.map(() => 0));
    expect(counts(POUR.length - 1e-9)).toEqual(
      SHAPES.map(() => CONFIG.tubeCapacity),
    );
    expect(counts(STALL.start)).toEqual(SHAPES.map(() => 0));
    expect(counts(LOOP - 1e-9)).toEqual(SHAPES.map(() => 0));
  });

  it("never holds more than it can, or less than nothing", () => {
    for (const frame of sweep()) {
      for (const stack of frame.stacks) {
        expect(stack.count).toBeGreaterThanOrEqual(0);
        expect(stack.count).toBeLessThanOrEqual(CONFIG.tubeCapacity);
      }
      // Whatever is in the air belongs to the shape this beat dispenses, and a
      // beat that dispenses nothing has nothing in the air.
      expect(frame.shape).toBe(
        frame.cycle.entry ? frame.cycle.entry.dispense : -1,
      );
      if (frame.shape < 0) {
        expect(frame.falling.filter((f) => f.visible).length).toBe(0);
      }
    }
  });
});

// A tube holds one kind of shape, so its stack is pitched by that shape's own
// height. Pitching all three alike drove every tetrahedron's apex through the
// base of the one above it.
suite("stacking", () => {
  it("leaves every shape clear of the one above it, inside its tube", () => {
    SHAPES.forEach((shape, s) => {
      expect(
        shape.pitch,
        `${shape.name} sits inside its neighbour`,
      ).toBeGreaterThan(shape.height);
      const top =
        TUBES[s].bottomY +
        ITEM.lift +
        (CONFIG.tubeCapacity - 1) * shape.pitch +
        shape.height;
      expect(top, `${shape.name} stack stands out of its tube`).toBeLessThan(
        TUBES[s].topY,
      );
    });
  });
});
