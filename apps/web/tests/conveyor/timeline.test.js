/*
  The conveyor animation's schedule, checked without a renderer.

  These are the claims its comments make about itself: that the loop is seamless,
  that the tubes account for every shape they hold, and that no box ever shows
  the same cut twice. They are cheap to state here and expensive to see by eye —
  a bad hole pairing only shows on the one box that is ever turned over.
*/
import { describe as suite, expect, it } from "vitest";

import { BELT, BOXES, CONFIG, ITEM, MACHINE, SHAPES, WRAP } from "../../public/animations/conveyor/config.js";
import { settle, settleTime } from "../../public/animations/conveyor/math.js";
import { createTimeline, irisOpening, TUBES } from "../../public/animations/conveyor/timeline.js";

// The camera answers this in the browser; any plausible height will do here.
const SKY = [3, 3, 3];
const { describe: frameAt, cycles: CYCLES, loop: LOOP } = createTimeline(SKY);
const BOX_CYCLES = CYCLES.filter((cycle) => cycle.entry);
const POUR = CYCLES[0];
const STALL = CYCLES[CYCLES.length - 1];
const snapshot = (t) => JSON.parse(JSON.stringify(frameAt(t)));
const sweep = (step = 1 / 120) => {
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
      for (const stance of [[box.top, box.xPos, box.zPos], [box.base, box.xPos, box.zNeg]]) {
        expect(new Set(stance).size, `repeated shape in ${stance}`).toBe(3);
      }
    }
  });

  it("gives the turned box the shape the machine dispenses to it", () => {
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

  it("comes back to the frame it started on", () => {
    const key = (frame) => frame.boxes
      .map((box, k) => [k % BOXES.length, box.z.toFixed(6), box.roll.toFixed(6)].join(":"))
      .sort();
    const start = snapshot(0);
    const end = snapshot(LOOP - 1e-9);
    expect(key(end)).toEqual(key(start));
    expect(end.stacks.map((s) => s.count)).toEqual(start.stacks.map((s) => s.count));
  });

  it("never leaves the arm anywhere but parked between cycles", () => {
    for (const cycle of CYCLES) {
      const parked = snapshot(cycle.start + cycle.length - 1e-9).arm;
      expect(parked.x).toBeCloseTo(snapshot(0).arm.x, 9);
      expect(parked.grip).toBe(0);
    }
  });

  // A box only ever turns under the arm, so its roll may not step anywhere it
  // can be seen doing it. The one place it is allowed to is the wrap, half a
  // belt away, where a box that has been round already comes back as one that
  // has not; that is off frame by a wide margin and is the whole reason a
  // turned box can keep its new face up without the loop drifting.
  it("never steps a box's roll anywhere it could be seen", () => {
    const seam = WRAP / 2 - BELT.slot;
    let last = null;
    for (const frame of sweep(1 / 480)) {
      if (last) {
        frame.boxes.forEach((box, k) => {
          if (Math.abs(box.z) > seam) return;
          const step = Math.abs(box.roll - last[k].roll);
          expect(step, `box ${k} stepped ${step.toFixed(3)} at z=${box.z.toFixed(3)}`).toBeLessThan(0.05);
        });
      }
      last = frame.boxes;
    }
  });
});

suite("the tubes", () => {
  const frames = sweep();

  it("holds a count between empty and full at every instant", () => {
    for (const frame of frames) {
      for (const stack of frame.stacks) {
        expect(stack.count).toBeGreaterThanOrEqual(0);
        expect(stack.count).toBeLessThanOrEqual(CONFIG.tubeCapacity);
      }
    }
  });

  it("opens empty, is charged by the end of the pour, and is spent by the stall", () => {
    expect(snapshot(0).stacks.map((s) => s.count)).toEqual(SHAPES.map(() => 0));
    expect(snapshot(POUR.length - 1e-9).stacks.map((s) => s.count)).toEqual(SHAPES.map(() => CONFIG.tubeCapacity));
    expect(snapshot(STALL.start).stacks.map((s) => s.count)).toEqual(SHAPES.map(() => 0));
    expect(snapshot(LOOP - 1e-9).stacks.map((s) => s.count)).toEqual(SHAPES.map(() => 0));
  });

  it("has one shape in the air at a time, and only from the tube being spent", () => {
    for (const frame of frames) {
      const flying = frame.falling.filter((f) => f.visible);
      expect(flying.length).toBeLessThanOrEqual(CONFIG.itemsPerDrop);
      // Whatever is in the air belongs to the shape this cycle dispenses, and
      // the beat that dispenses nothing has nothing in the air.
      expect(frame.shape).toBe(frame.cycle.entry ? frame.cycle.entry.dispense : -1);
      if (frame.shape < 0) expect(flying.length).toBe(0);
    }
  });

  it("blinks each iris once per shape released", () => {
    for (const cycle of BOX_CYCLES) {
      const shape = cycle.entry.dispense;
      let blinks = 0, wasShut = true;
      for (let u = 0; u < cycle.length; u += 1 / 400) {
        const open = irisOpening(shape, u, cycle) > 0;
        if (open && wasShut) blinks++;
        wasShut = !open;
      }
      expect(blinks).toBe(CONFIG.itemsPerDrop);
    }
  });

  it("leaves nothing undefined anywhere in a frame", () => {
    for (const frame of frames) {
      for (const value of JSON.stringify(frame).match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []) {
        expect(Number.isFinite(Number(value))).toBe(true);
      }
    }
  });
});

suite("settling", () => {
  it("starts at the height it was dropped from and ends on the floor", () => {
    const h = ITEM.pitch;
    expect(settle(h, 0)).toBe(h);
    expect(settle(h, settleTime(h))).toBeCloseTo(0, 6);
  });

  it("never rises above where it was let go", () => {
    const h = 2;
    for (let t = 0; t < settleTime(h); t += 1 / 200) {
      expect(settle(h, t)).toBeLessThanOrEqual(h + 1e-12);
      expect(settle(h, t)).toBeGreaterThanOrEqual(-1e-12);
    }
  });
});

suite("the pour and the stall", () => {
  it("pours from the first instant, under an amber lamp", () => {
    expect(snapshot(0).lamp).toBe(CONFIG.lampColors.running);
    const pouring = [];
    for (let t = 0; t < POUR.length; t += 1 / 240) if (snapshot(t).refill.flat().some((r) => r.visible)) pouring.push(t);
    expect(pouring.length).toBeGreaterThan(0);
    expect(pouring[0]).toBeLessThan(CONFIG.refillStart + 0.01);
  });

  it("has everything landed and waiting before the belt moves", () => {
    const ready = snapshot(POUR.length - CONFIG.phase.resume / 2);
    expect(ready.stacks.map((s) => s.count)).toEqual(SHAPES.map(() => CONFIG.tubeCapacity));
    expect(ready.refill.flat().some((r) => r.visible)).toBe(false);
  });

  it("stands empty under a red lamp for the whole stall, and pours nothing", () => {
    for (let t = STALL.start; t < LOOP; t += 1 / 240) {
      const frame = snapshot(t);
      expect(frame.lamp).toBe(CONFIG.lampColors.depleted);
      expect(frame.stacks.every((s) => s.count === 0)).toBe(true);
      expect(frame.refill.flat().some((r) => r.visible)).toBe(false);
    }
  });

  it("keeps the belt still and the arm parked through both", () => {
    for (const beat of [POUR, STALL]) {
      const at = (t) => snapshot(beat.start + t);
      for (let t = 0; t < beat.length; t += 1 / 240) {
        const frame = at(t);
        expect(frame.beltShift).toBe(at(0).beltShift);
        expect(frame.falling.some((f) => f.visible)).toBe(false);
        expect(frame.iris.every((open) => open === 0)).toBe(true);
        expect(frame.arm.grip).toBe(0);
      }
    }
  });
});

suite("stacking", () => {
  // A tube holds one kind of shape, so its stack is pitched by that shape's own
  // height. Pitching all three alike is what drove every tetrahedron's apex
  // through the base of the one above it.
  it("leaves a shape clear of the one above it", () => {
    for (const shape of SHAPES) {
      expect(shape.pitch, `${shape.name} sits inside its neighbour`).toBeGreaterThan(shape.height);
      expect(shape.pitch - shape.height).toBeCloseTo(ITEM.gap, 12);
    }
  });

  it("fits a full charge inside the tube that holds it", () => {
    SHAPES.forEach((shape, s) => {
      const top = TUBES[s].bottomY + ITEM.lift + (CONFIG.tubeCapacity - 1) * shape.pitch + shape.height;
      expect(top, `${shape.name} stack stands out of its tube`).toBeLessThan(TUBES[s].topY);
    });
  });

  it("never draws two shapes of a stack through each other, at any instant", () => {
    for (const frame of sweep(1 / 240)) {
      frame.stacks.forEach((stack, s) => {
        const shape = SHAPES[s];
        for (let j = 1; j < stack.count; j++) {
          const below = ITEM.lift + (j - 1) * shape.pitch + stack.shift;
          const here = ITEM.lift + j * shape.pitch + stack.shift;
          expect(here - below).toBeGreaterThanOrEqual(shape.height);
        }
      });
    }
  });
});
