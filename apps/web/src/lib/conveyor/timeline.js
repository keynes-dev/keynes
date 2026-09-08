/*
  The schedule, and the frame description built from it.

  `describe(t)` answers one question — what does the machine look like at time
  t — as plain numbers, and nothing in it touches the scene. The parts then read
  that description and move their objects to match. Time lives here; placement
  lives in the parts.

  The whole scene stays a pure function of loop time, so it never drifts and the
  frame at t = LOOP matches the frame at t = 0 exactly.
*/
import {
  ARM,
  BELT,
  BOX_TOP,
  BOX_Y,
  BOXES,
  CONFIG,
  IRIS,
  ITEM,
  MACHINE,
  SHAPES,
  WRAP,
} from "./config.js";
import {
  clamp,
  clamp01,
  easeInOut,
  glide,
  mod,
  settle,
  settleTime,
  smooth,
} from "./math.js";

// A rejected box costs an extra beat, so cycles are not all the same length
// and the loop is a schedule rather than a fixed multiple.
const ARM_TIME =
  CONFIG.arm.descend +
  CONFIG.arm.grip +
  CONFIG.arm.turn +
  CONFIG.arm.release +
  CONFIG.arm.retract;

// Pour, then one beat per box, then the stall: every pass is the same pass.
// Each beat carries `advance`, the slots the belt has already moved when it
// starts, and `box`, the box it serves (null for the pour and stall). The
// schedule is built per timeline rather than once at load because `pourLength`
// depends on how far off frame a charge starts, which only the camera knows.
function buildCycles(pourLength) {
  // Beats that serve no box never reach any of a box cycle's marks: they are
  // set out of reach rather than left undefined, since nothing reaches Infinity.
  const never = { armStart: Infinity, approved: Infinity, dropStart: Infinity };
  const cycles = [
    {
      ...never,
      entry: null,
      pour: true,
      box: null,
      advance: 0,
      length: pourLength,
      start: 0,
    },
  ];
  CONFIG.sequence.forEach((entry, box) => {
    const lead =
      CONFIG.phase.travel +
      CONFIG.phase.settle +
      (entry.reject ? CONFIG.phase.reject + ARM_TIME : 0);
    const armStart =
      CONFIG.phase.travel + CONFIG.phase.settle + CONFIG.phase.reject;
    // When the box under the nozzle becomes one the machine can fill: as soon as
    // the belt stops for a box it can already fill, or the moment the arm finishes
    // rolling one it cannot. This is what the lamp reads.
    const approved = entry.reject
      ? armStart + CONFIG.arm.descend + CONFIG.arm.grip + CONFIG.arm.turn
      : CONFIG.phase.travel;
    cycles.push({
      entry,
      box,
      advance: box,
      armStart,
      approved,
      dropStart: lead,
      length: lead + CONFIG.phase.drop + CONFIG.phase.hold,
      start: 0,
    });
  });
  cycles.push({
    ...never,
    entry: null,
    stall: true,
    box: null,
    advance: CONFIG.sequence.length,
    length: CONFIG.phase.empty,
    start: 0,
  });
  let clock = 0;
  for (const cycle of cycles) {
    cycle.start = clock;
    clock += cycle.length;
  }
  return cycles;
}
// Which cycle spends each shape. A tube is full until its cycle, empty after.
const SPEND_CYCLE = [];
CONFIG.sequence.forEach((entry, index) => {
  SPEND_CYCLE[entry.dispense] = index;
});
// How long a shape spends out of sight, from the iris it drops through to the
// mouth of the nozzle.
const EMERGE = CONFIG.ductTransit + CONFIG.manifoldDelay;

// Where the loop is: which cycle, and how far into it.
export function cycleAt(cycles, t) {
  let index = cycles.length - 1;
  while (index > 0 && t < cycles[index].start) index--;
  return index;
}
// How far the arm has rolled the box it is holding: nothing before the turn,
// a quarter turn after it, whether or not the arm is still attached.
export function rolled(u, cycle) {
  if (!cycle.entry?.reject) return 0;
  const start = cycle.armStart + CONFIG.arm.descend + CONFIG.arm.grip;
  return Math.PI * glide(clamp01((u - start) / CONFIG.arm.turn));
}
// The arm's own pose: where the wrist is, how far the claw has rolled, and
// how tightly it is closed. It parks clear of the belt except on a rejected box.
export function armPose(u, cycle) {
  // Straight in and straight back out, at working height throughout.
  const reach = (p) => ({
    x: ARM.parkX + (ARM.wristX - ARM.parkX) * p,
    y: BOX_Y,
  });
  const idle = { ...reach(0), roll: 0, grip: 0, lift: 0 };
  if (!cycle.entry?.reject) return idle;
  const a = CONFIG.arm;
  let x = u - cycle.armStart;
  if (x <= 0) return idle;
  if (x < a.descend)
    return { ...reach(glide(x / a.descend)), roll: 0, grip: 0, lift: 0 };

  x -= a.descend;
  if (x < a.grip)
    return { ...reach(1), roll: 0, grip: smooth(x / a.grip), lift: 0 };
  x -= a.grip;
  const at = reach(1);
  if (x < a.turn) {
    // A hover through the turn: the arm picks the box up off the slats, rolls
    // it, and sets it back down. The lift is a function of the roll angle
    // rather than of time, so it is zero exactly when the box is square and
    // peaks exactly when the box is on its edge, and the whole flip is driven
    // by one curve instead of two that have to be kept in step. It has to be
    // steep enough at both ends to outrun the corner the box would otherwise
    // pivot on, which is what sets its size: half the box's own height.
    const roll = Math.PI * glide(x / a.turn);
    const lift = ARM.releaseLift * Math.sin(roll);
    return { x: at.x, y: at.y + lift, roll, grip: 1, lift };
  }
  x -= a.turn;
  // Level again, so it can let go and draw out at working height.
  if (x < a.release)
    return { ...at, roll: Math.PI, grip: 1 - smooth(x / a.release), lift: 0 };
  x -= a.release;
  // It draws out still turned and never winds back. The head is symmetric about
  // the roll axis, axle heads included, so a half turn maps it onto itself:
  // parked half turned is indistinguishable from parked square, and the pose
  // the next cycle starts from is the one this ends in. Winding back meant
  // spinning the head through half a turn during the retract, which whipped,
  // and needed the jaws shut to keep a finger off the deck — so the claw came
  // to rest closed and popped open at the cycle boundary.
  const back = reach(1 - glide(clamp01(x / a.retract)));
  return { x: back.x, y: back.y, roll: Math.PI, grip: 0, lift: 0 };
}

// Two-link solve for the shoulder and elbow that put the wrist on target. The
// positive branch swings the elbow away from the belt, clear of the boxes.
export function armJoints(wx, wy) {
  const dx = wx - ARM.shoulder.x,
    dy = wy - ARM.shoulder.y;
  const d = Math.min(Math.hypot(dx, dy), ARM.upper + ARM.fore - 1e-3);
  const cos = clamp(
    (d * d - ARM.upper * ARM.upper - ARM.fore * ARM.fore) /
      (2 * ARM.upper * ARM.fore),
    -1,
    1,
  );
  const bend = Math.acos(cos);
  const base =
    Math.atan2(dy, dx) -
    Math.atan2(
      ARM.fore * Math.sin(bend),
      ARM.upper + ARM.fore * Math.cos(bend),
    );
  return { base, tip: base + bend };
}

// How far the iris of `shape` stands open. It blinks once per release, so
// exactly one item drops through each time.
export function irisOpening(shape, u, cycle) {
  if (shape !== cycle.entry?.dispense) return 0;
  let open = 0;
  for (let m = 0; m < CONFIG.itemsPerDrop; m++) {
    const tau = u - (cycle.dropStart + m * CONFIG.releaseStagger - IRIS.lead);
    if (tau < 0 || tau > 2 * IRIS.move + IRIS.hold) continue;
    if (tau < IRIS.move) open = Math.max(open, smooth(tau / IRIS.move));
    else if (tau < IRIS.move + IRIS.hold) open = 1;
    else
      open = Math.max(
        open,
        1 - smooth((tau - IRIS.move - IRIS.hold) / IRIS.move),
      );
  }
  return open;
}

// Where each tube stands. Plain numbers: the tubes' own objects are built from
// the same figures in the ducting part.
export const TUBES = MACHINE.tubeZ.map((z) => ({
  z,
  bottomY: MACHINE.tubeBottomY,
  topY: MACHINE.tubeBottomY + MACHINE.tubeLen,
}));

const FALL_START = MACHINE.nozzleBottom - 0.02;
// The nozzle spits: a shape leaves it already moving, so its fall is timed from
// that exit speed rather than from rest.
const FALL_TIME = SHAPES.map((shape) => {
  const end = BOX_TOP - shape.height - 0.15;
  return (
    (Math.sqrt(
      ITEM.exit * ITEM.exit + 2 * CONFIG.gravity * (FALL_START - end),
    ) -
      ITEM.exit) /
    CONFIG.gravity
  );
});

/*
  The frame description. `sky` is how far above each tube's mouth a refill has
  to start to be off frame, which only the camera can answer, so it is handed in
  rather than reached for. Tests pass their own.

  One frame object is allocated per timeline and rewritten in place, since it is
  read and discarded sixty times a second.
*/
export function createTimeline(sky) {
  const drops = CONFIG.itemsPerDrop;
  const cap = CONFIG.tubeCapacity;

  // How long each refill takes to arrive, drop by drop: off frame to the top of
  // the stack under gravity, plus its bounce. The first of a batch falls furthest
  // and lands lowest, so they arrive in the order they were let go.
  const refillFall = TUBES.map((tube, s) => {
    const list = [];
    for (let m = 0; m < drops; m++) {
      const yEnd = tube.bottomY + ITEM.lift + m * SHAPES[s].pitch;
      list.push(settleTime(tube.topY + sky[s] - yEnd));
    }
    return list;
  });
  // When the last of them has landed. The pour is sized to this rather than the
  // drop being cut to fit a beat: a charge falls for as long as gravity and the
  // sky make it, and then the machine waits `resume` before the belt moves.
  const refillEnd = Math.max(
    ...refillFall.map((list) =>
      Math.max(
        ...list.map(
          (f, m) => CONFIG.refillStart + m * CONFIG.refillStagger + f,
        ),
      ),
    ),
  );
  const cycles = buildCycles(refillEnd + CONFIG.phase.resume);
  const loop =
    cycles[cycles.length - 1].start + cycles[cycles.length - 1].length;

  const frame = {
    t: 0,
    index: 0,
    cycle: cycles[0],
    u: 0,
    shape: 0,
    beltShift: 0,
    boxes: Array.from({ length: BELT.slots }, () => ({
      z: 0,
      y: BOX_Y,
      roll: 0,
    })),
    arm: {
      x: 0,
      y: 0,
      roll: 0,
      grip: 0,
      lift: 0,
      base: 0,
      tip: 0,
      elbowX: 0,
      elbowY: 0,
    },
    released: 0,
    falling: Array.from({ length: drops }, () => ({
      visible: false,
      x: 0,
      y: 0,
      z: 0,
      t: 0,
      spin: 0,
      square: 0,
    })),
    refill: TUBES.map(() =>
      Array.from({ length: drops }, () => ({
        visible: false,
        x: 0,
        y: 0,
        z: 0,
        t: 0,
        spin: 0,
        square: 0,
      })),
    ),
    stacks: TUBES.map(() => ({ count: 0, shift: 0 })),
    iris: TUBES.map(() => 0),
    pulse: 0,
    lamp: CONFIG.lampColors.running,
  };

  function describe(t) {
    const index = cycleAt(cycles, t);
    const cycle = cycles[index];
    const u = t - cycle.start;
    // The pour and the stall dispense nothing, so they have no shape of their own.
    const shape = cycle.entry ? cycle.entry.dispense : -1;
    const dropStart = cycle.dropStart;
    frame.t = t;
    frame.index = index;
    frame.cycle = cycle;
    frame.u = u;
    frame.shape = shape;

    // Belt travel with ease-in-out per slot. The pour and the stall stand still,
    // one at the start of the run and one at its end, which are the same
    // drawing: the belt comes round by exactly the three slots the hole shapes
    // repeat on.
    const moving = cycle.entry
      ? easeInOut(clamp01(u / CONFIG.phase.travel))
      : 0;
    const s = BELT.slot * (cycle.advance + moving);
    frame.beltShift = s;

    // Boxes. The one being turned rides the arm; one that has already been
    // turned keeps its new face up until it wraps round to the start again.
    const turn = rolled(u, cycle);
    const pose = armPose(u, cycle);
    // The box is as tall as it is deep about its pivot, so it lands level either
    // way up and needs no stance of its own — only to be off the slats while its
    // corner swings under it, which the arm's lift does. Tracking the lowest
    // corner instead cusps at ninety degrees and reads as a jolt.
    //
    // A box counts as turned from the moment it reaches the nozzle, not once it
    // is strictly past: it stands at z = 0 through its whole beat and is still
    // there when the next one opens, and asking for `z < 0` left that frame
    // answering to neither test, flicking the box back to the face it arrived
    // on.
    const eps = 1e-6;
    for (let k = 0; k < frame.boxes.length; k++) {
      const b = frame.boxes[k];
      b.z = mod((k + 1) * BELT.slot - s + WRAP / 2, WRAP) - WRAP / 2;
      b.y = BOX_Y;
      b.roll = 0;
      if (!BOXES[k % BOXES.length].turns) continue;
      if (Math.abs(b.z) <= eps && k === cycle.box) {
        b.roll = turn;
        b.y = BOX_Y + pose.lift;
      } else if (b.z <= eps) {
        b.roll = Math.PI;
      }
    }

    // The arm: solve the joints for the wrist, and carry the elbow the solution
    // puts them at, so the part has only transforms left to set.
    const joints = armJoints(pose.x, pose.y);
    const arm = frame.arm;
    arm.x = pose.x;
    arm.y = pose.y;
    arm.roll = pose.roll;
    arm.grip = pose.grip;
    arm.lift = pose.lift;
    arm.base = joints.base;
    arm.tip = joints.tip;
    arm.elbowX = ARM.shoulder.x + ARM.upper * Math.cos(joints.base);
    arm.elbowY = ARM.shoulder.y + ARM.upper * Math.sin(joints.base);

    // Items released so far in this cycle, all from the tube for this box.
    let released = 0;
    for (let m = 0; m < drops; m++)
      if (u >= dropStart + m * CONFIG.releaseStagger) released++;
    frame.released = released;

    // Items on the move. The ducting and the machine body are opaque, so a
    // released shape is out of sight from the moment it leaves its tube until
    // it clears the nozzle mouth.
    const tube = TUBES[shape];
    const centre = shape < 0 ? 0 : SHAPES[shape].centre;
    for (let m = 0; m < drops; m++) {
      const it = frame.falling[m];
      it.spin = m;
      if (shape < 0) {
        it.visible = false;
        continue;
      }
      const sink = u - (dropStart + m * CONFIG.releaseStagger);
      // Out of the tube first. It drops off the open iris under gravity and the
      // throat takes it a piece at a time, which is the same shape that later
      // comes out of the nozzle: the sink and the fall never overlap, so one
      // object does both.
      if (sink >= 0 && sink < ITEM.sink) {
        it.visible = true;
        it.x = 0;
        it.z = tube.z;
        it.y =
          tube.bottomY +
          ITEM.lift -
          0.5 * CONFIG.gravity * sink * sink +
          centre;
        it.t = sink;
        it.square = 1;
        continue;
      }
      const tau = sink - EMERGE;
      it.visible = tau >= 0 && tau < FALL_TIME[shape];
      if (!it.visible) continue;
      // The tumble winds out on the way down: a shape has to be square on to go
      // through a hole bored to its own size, and tilted it would not fit.
      const drop =
        FALL_START - ITEM.exit * tau - 0.5 * CONFIG.gravity * tau * tau;
      it.x = 0;
      it.z = 0;
      it.y = drop + centre;
      it.t = tau;
      it.square = smooth((BOX_TOP + ITEM.catch - drop) / ITEM.catch);
    }

    // The pour. The loop opens with every tube empty and all three charged
    // together, the hoppers opening the moment it begins.
    const refilling = Boolean(cycle.pour);
    for (let sh = 0; sh < TUBES.length; sh++) {
      const from = TUBES[sh];
      let arrived = 0;
      for (let m = 0; m < drops; m++) {
        const r = frame.refill[sh][m];
        const tau = u - (CONFIG.refillStart + m * CONFIG.refillStagger);
        if (refilling && tau >= refillFall[sh][m]) arrived++;
        r.visible = refilling && tau >= 0 && tau < refillFall[sh][m];
        r.spin = m;
        if (!r.visible) continue;
        // One fall, off frame to the top of the stack, with the bounce it lands
        // on. The tube catches the tumble as the shape passes its mouth, which is
        // what leaves the stack square whatever way up the shape came down.
        const yEnd = from.bottomY + ITEM.lift + m * SHAPES[sh].pitch;
        const y = yEnd + settle(from.topY + sky[sh] - yEnd, tau);
        r.x = 0;
        r.z = from.z;
        r.y = y + SHAPES[sh].centre;
        r.t = tau;
        r.square = smooth((from.topY - y) / ITEM.catch);
      }

      // Stacks inside the tubes. The active tube settles a pitch after each release.
      const stack = frame.stacks[sh];
      // Through the pour a tube holds exactly what has landed in it. Then it is
      // full until the box that spends it, and empty after, through the stall.
      if (cycle.pour) stack.count = arrived;
      else if (cycle.stall) stack.count = 0;
      else if (sh === shape) stack.count = cap - released;
      else stack.count = SPEND_CYCLE[sh] < cycle.box ? 0 : cap;
      // What is left in the tube drops a place, under gravity like anything else.
      stack.shift =
        sh === shape && released > 0
          ? settle(
              SHAPES[sh].pitch,
              u - (dropStart + (released - 1) * CONFIG.releaseStagger),
            )
          : 0;

      frame.iris[sh] = irisOpening(sh, u, cycle);
    }

    // Nozzle pulse as each item emerges.
    let pulse = 0;
    for (let m = 0; m < released; m++) {
      const e = u - (dropStart + m * CONFIG.releaseStagger + EMERGE);
      if (e >= 0 && e < 0.12)
        pulse = Math.max(pulse, Math.sin((Math.PI * e) / 0.12));
    }
    frame.pulse = pulse;

    // Lamp: amber while the machine is running, red while it is stopped, green
    // when the box under the nozzle is one it can fill. One state per box, held
    // solid, rather than a flash per shape.
    //
    // The machine stops for two different reasons, and the lamp is red for both:
    // a box it cannot fill, and — through the stall — having nothing left to
    // fill one with. Through the pour it is working again, and amber.
    if (cycle.stall) {
      frame.lamp = CONFIG.lampColors.depleted;
    } else if (cycle.pour) {
      frame.lamp = CONFIG.lampColors.running;
    } else if (u >= CONFIG.phase.travel) {
      frame.lamp =
        u < cycle.approved
          ? CONFIG.lampColors.denied
          : CONFIG.lampColors.approved;
    } else {
      frame.lamp = CONFIG.lampColors.running;
    }
    return frame;
  }

  return { describe, refillEnd, loop, cycles };
}
