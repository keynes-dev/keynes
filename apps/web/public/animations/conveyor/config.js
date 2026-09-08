/*
  Every dimension and duration in the scene, and the values derived directly
  from them. No Three.js here on purpose: this module and the timeline built on
  it are plain arithmetic, so both can be exercised under vitest without a
  renderer. Anything that needs a geometry or a material belongs further out.
*/

export const CONFIG = {
  sequence: [{ dispense: 0 }, { dispense: 1, reject: true }, { dispense: 2 }],
  // `empty` and `resume` bracket the restock: how long the machine stands
  // stopped with nothing left to dispense before the hoppers are opened, and
  // how long it waits, charged again, before the belt moves.
  phase: {
    travel: 1.2,
    settle: 0.4,
    reject: 0.6,
    drop: 1.0,
    hold: 0.4,
    empty: 0.9,
    resume: 0.35,
  },
  arm: { descend: 0.4, grip: 0.2, turn: 0.7, release: 0.2, retract: 0.4 },
  itemsPerDrop: 3,
  tubeCapacity: 3,
  releaseStagger: 0.2,
  ductTransit: 0.18,
  manifoldDelay: 0.06,
  refillStart: 0.06,
  refillStagger: 0.26,
  gravity: 24,
  restitution: 0.15,
  // White, like every other surface here, and told apart by their outlines the
  // way every other solid in the drawing is. Nothing in the scene carries colour
  // now except the lamp.
  shapeColors: [0xffffff, 0xffffff, 0xffffff],
  // Keyed by meaning rather than by colour, so the palette can be retuned
  // without the names lying. `denied` is a box the machine cannot fill;
  // `depleted` is the machine with nothing left to fill one with. Both are
  // stopped, so both are red, but they are not the same fault and a palette
  // that wanted to tell them apart could.
  lampColors: {
    running: 0xf2b705,
    denied: 0xe3262e,
    depleted: 0xe3262e,
    approved: 0x18b85a,
  },
  lineWidth: 1.25,
  fineWidth: 0.55,
  maxPixelRatio: 2,
  frustum: 2.9,
  skyMargin: 1.15,
  // Raised until the furthest tube's top rim clears the frame. It is the rim
  // that decides, not the axis: the tube nearest the top of frame projects its
  // far lip higher than its centre line, and checking the centre alone lets the
  // lip clip.
  lookAt: [0, 2.36, 0],
};

const belt = {
  width: 1.6,
  top: 0.75,
  thickness: 0.25,
  length: 24,
  slot: 2.4,
  slots: 9,
  slat: 0.4,
  slatDepth: 0.3,
  slatRise: 0.05,
  rollerW: 1.66,
  rollerSpan: 7.2,
  rollerTeeth: 12,
  rollerRoot: 0.74,
  rollerHub: 0.34,
};
export const BELT = Object.freeze({
  ...belt,
  // The belt advances three slots per loop. Sizing the rollers so that distance
  // is a whole number of turns keeps them from jumping at the seam.
  rollerR: (belt.slot * 3) / (2 * Math.PI * 9),
  // One roller per slat. The rollers are evenly spaced whatever the pitch, but
  // only this pitch looks it: the slats mask them, so at any other spacing the
  // gaps between slats fall on a different beat from the rollers, which roller
  // shows through changes down the run, and they read as unevenly spread.
  rollerGap: belt.slat,
});
// How far the belt runs before a slot comes round again.
export const WRAP = BELT.slot * BELT.slots;

const box = { size: 0.8, wall: 0.06, clear: 0.01 };
export const BOX = Object.freeze({ ...box, center: (box.size - box.wall) / 2 });
// Boxes ride a hair above the slat tops. Landing them exactly on the slats
// makes the two surfaces coplanar, and each slat's top edge then draws
// straight through the box standing on it.
export const BOX_Y = BELT.top + BOX.center + BOX.clear;
// The lid a dropped shape has to go through: the box's own top, not the belt
// plus a nominal box height, since the box outlines itself a little shorter
// than it is wide and rides a hair above the slats.
export const BOX_TOP = BOX_Y + BOX.center;

// Hole layout per box in the loop: every face bored, and every face its own
// shape. From this camera exactly three faces of a box ever show, the ones
// facing +x, +y and +z, and a box rolled half a turn about x shows a different
// three: the same +x face, its base where its lid was, and its far z face
// brought round to the near side. So both triples have to be three different
// shapes, and giving the two z faces one shape between them is what put two
// triangles on a flipped box. The -x face never shows in either stance.
// `base` is the face a turned box ends up presenting, since the arm rolls it
// right over rather than onto its side, so it carries the shape the machine
// dispenses to it.
//
// That both stances of every box show three different shapes is easy to break
// by hand, and the fault only shows on the one box that is ever seen the other
// way up, so it is asserted in the tests rather than left to the eye.
export const BOXES = Object.freeze([
  { top: 0, base: 2, xPos: 1, xNeg: 0, zPos: 2, zNeg: 0 },
  { top: 0, base: 1, xPos: 2, xNeg: 0, zPos: 1, zNeg: 0, turns: true },
  { top: 2, base: 1, xPos: 0, xNeg: 2, zPos: 1, zNeg: 2 },
]);

// Pincer arm: a jointed two-link arm mounted behind the machine, on the far
// side of the belt so it never stands between the boxes and the camera. Its
// wrist sits on the roll axis just outside the box, and the claw reaches in.
// Placement is constrained by sight lines as much as by reach: the shoulder
// and both poses are kept out of the screen area the near tube's iris covers,
// or the joints vanish behind it and the arm reads as loose parts.
export const ARM = Object.freeze({
  shoulder: { x: -2.4, y: 2.2 },
  upper: 1.1,
  fore: 0.95,
  // The claw's fingers straddle the box along the belt, not across it, so they
  // pass either side of it and the claw runs straight in and straight back
  // out. Parked, the whole hand sits clear of the belt at working height.
  wristX: -0.85,
  parkX: -2.3,
  releaseLift: 0.44,

  // Links and joints. Each link is a box beam running from one pivot to the
  // next, and each joint is one stepped barrel split along its axis into a
  // slice per link: the near slice narrower, so the step between them is a
  // machined shoulder rather than a line adrift on a flat face. Because the
  // slices are coaxial and the two beams they hold sit only a short step apart
  // in depth, a joint reads as one solid part. Separating consecutive links by
  // more than the joint's own radius is what opened the gaps before: the far
  // link then projects clear of the near one and the joint comes apart.
  mountBeam: { h: 0.2, w: 0.16, z: -0.11 },
  upperBeam: { h: 0.26, w: 0.16, z: 0.11 },
  foreBeam: { h: 0.22, w: 0.14, z: -0.08 },
  shoulderJoint: {
    rearR: 0.29,
    frontR: 0.25,
    rear: [-0.23, 0.01],
    front: [-0.01, 0.23],
    ring: 0.13,
  },
  elbowJoint: {
    rearR: 0.24,
    frontR: 0.2,
    rear: [-0.19, 0.03],
    front: [-0.01, 0.23],
    ring: 0.11,
  },
  // The mount drops clear of the tubes before it reaches out, or the whole
  // attachment to the machine disappears behind the near iris.
  post: { x: -0.38, y: 2.55, h: 0.6 },
  mount: { x: -0.38, y: 2.35 },
  // Wrist: a roll actuator carried in a block on the end of the forearm, its
  // axis the arm's own reach. Everything outboard of the block is laid out in
  // sequence along that axis, so the turning shaft is never nested inside the
  // part it turns in.
  wristBlock: { l: 0.34, h: 0.34, w: 0.38, x: -0.13 },
  noseR: 0.13,
  noseFrom: -0.02,
  noseTo: 0.09,
  raceR: 0.085,
  collarR: 0.095,
  collarFrom: 0.05,
  collarTo: 0.13,
  flangeR: 0.16,
  flangeFrom: 0.13,
  flangeTo: 0.2,
  flangeRing: 0.09,
  // Pincer head. Both jaws hinge on one axle through the head block and swing
  // in the plane of the reach, closing on the box the way a pair of tongs
  // does. They are stacked in height rather than set side by side, because at
  // full close their shanks would otherwise run through each other. A shank
  // leaves the hinge almost square to the reach, so the jaw is out past the
  // box's own face before it turns forward: a shallower shank cuts the corner
  // of the box on the way in, however wide the jaws are opened.
  head: { l: 0.22, h: 0.36, w: 0.42, x: 0.31 },
  bossR: 0.09,
  bossFrom: 0.18,
  bossTo: 0.23,
  bossRing: 0.045,
  // The jaws are full depth rather than stacked: each shank starts a little
  // out from the axle instead of on it, so the two clear each other where they
  // cross, and the whole crossing is buried inside the head block anyway.
  hinge: 0.31,
  jawH: 0.28,
  jawT: 0.16,
  jawRoot: 0.09,
  shankAngle: 88,
  knuckleR: 0.085,
  // The finger stands off the box on its pad, so it reads as a jaw closed on
  // the box rather than as a line drawn along the box's own face.
  jawFinger: { from: 0, to: 1, z: 0.53 },
  jawPad: { l: 0.36, h: 0.18, w: 0.09, x: 0.7, z: 0.455 },
  // Shut leaves the pads a hair off the box's faces; the open angle clears
  // them by enough for the head to run in and out past a box it is not
  // gripping, jaw roots included.
  pincerOpen: 0.35,
});

export const MACHINE = Object.freeze({
  tubeR: 0.23,
  tubeLen: 1.15,
  tubeBottomY: 3.95,
  tubeZ: [-1.15, 0, 1.15],
  // The elbow's bend radius also decides how much straight duct hangs below the
  // iris before the pipe turns away. At 0.44 the bend ate the whole drop and
  // there was nowhere to put a throat; at 0.24 there is a short spigot under
  // each iris for one to sit inside, and the fittings read tighter for it.
  ductR: 0.2,
  ductRib: 0.1,
  elbowR: 0.24,
  elbowY: 3.76,
  armY: 3.32,
  flangeR: 0.038,
  flangeW: 0.1,
  boltR: 0.03,
  bolts: 6,
  manifold: { x: 0, y: 2.9, z: 0 },
  manifoldW: 0.8,
  manifoldH: 0.4,
  manifoldD: 0.78,
  nozzleTop: 2.6,
  nozzleBottom: 2.22,
  nozzleR0: 0.3,
  nozzleR1: 0.22,
  // The bell: tiers of a flared frustum with a stiffening rib standing proud at
  // each joint and a lip at the mouth, then flutes down the face of it.
  nozzleTiers: 3,
  nozzleFlare: 1.7,
  nozzleRibR: 0.024,
  nozzleRibH: 0.03,
  nozzleLipR: 0.028,
  nozzleLipH: 0.034,
  nozzleFlutes: 12,
  // A single verdict lamp on the manifold's own front face, in place of the
  // sign the machine used to carry: a bulb screwed into a keyless socket, a
  // plate and the cup that takes it. Centred on the face rather than floating
  // above it, since nothing this size needs the height the panel's own
  // footprint did. The ball is the size of the balls the machine itself drops,
  // `ITEM.sphereR` — it cannot be written in terms of that here, since ITEM is
  // declared further down, but it is the same 0.11 and meant to be. A lamp is
  // a fitting on the machine rather than a part of what it handles, and at any
  // more than this it stops reading as one.
  // The plate has to stand a good way clear of the cup to read as a plate at
  // all: at anything near the cup's own radius the two rims are a pixel or two
  // apart and read as one thick ring.
  lampPlateR: 0.085,
  lampPlateT: 0.014,
  lampCupR: 0.046,
  lampCupLen: 0.037,
  // The glass: its radius where it leaves the cup, its radius where it meets
  // the ball, how far the ball's centre stands off the cup, and the ball. The
  // shoulder has to stay under the ball's own radius, or the flare ends proud
  // of the envelope instead of inside it and draws a rim across the glass.
  lampGlassR: 0.034,
  lampShoulder: 0.087,
  lampRise: 0.138,
  lampGlobeR: 0.11,
});

// Iris diaphragm at the base of each tube. Every blade pivots on the frame
// ring; its inner edge is a chord whose distance from the axis is the
// aperture radius, so sweeping the blades shuts the bore like a camera.
const iris = {
  blades: 8,
  bore: 0.23,
  pivotR: 0.24,
  length: 0.42,
  width: 0.2,
  thickness: 0.02,
  frameR: 0.45,
  frameH: 0.15,
  bladeDrop: 0.07,
  boreDrop: 0.11,
  bladeStep: 0.005,
  plateT: 0.02,
  clearance: 0.015,
  // The bore is a throat rather than a painted-on disc, so a shape let go of
  // has somewhere to fall into and is taken by it a piece at a time. Narrow
  // enough to sit inside the ducting it feeds, which is what hides the rest of
  // the drop.
  throatR: 0.185,
  throatH: 0.28,
  betaShut: (179 * Math.PI) / 180,
  move: 0.06,
  hold: 0.05,
  lead: 0.06,
};
export const IRIS = Object.freeze({
  ...iris,
  // Open stands the blade's chord off the axis by exactly the bore radius, so
  // the aperture clears; shut lays it across the axis. Blade span and count are
  // the smallest that leave no gap when shut.
  betaOpen: Math.PI - Math.asin(iris.bore / iris.pivotR),
});

export const ITEM = Object.freeze({
  cube: 0.2,
  tetraEdge: 0.3,
  sphereR: 0.11,
  // Clearance between shapes in a stack. A tube holds one kind of shape, so the
  // stack is pitched by that shape's own height and this gap, not by one figure
  // for all three: at a single pitch the tallest of them — the tetrahedron, at
  // 0.245 — is taller than the pitch itself, and every apex is driven through
  // the base of the one above it. The gap has to be worth seeing as well as
  // clearing, or two outlines a hair apart merge into one at this line weight.
  gap: 0.05,
  lift: 0.005,
  exit: 1.2,
  catch: 0.3,
  sink: 0.175,
});
export const TRI_ANGLES = [Math.PI / 6, (5 * Math.PI) / 6, (3 * Math.PI) / 2];

// One entry per dispensable shape, replacing the parallel arrays that used to
// be indexed by the same loose `sh`. Only the measurements live here; the
// geometry and material that go with each are attached in shapes.js, which is
// the half of the table that needs a renderer.
//
//   height  how tall it stands, which is what a stack is pitched by
//   radius  its widest horizontal reach: the cube's diagonal, the
//           tetrahedron's base circumradius, the sphere's radius. Every iris
//           plate is bored to the largest of them, so all three are
//           interchangeable.
//   pitch   how far apart they sit in a tube: its own height plus a clearance
//   centre  height of its centre of mass above its base. A shape's geometry has
//           its origin at its base, because that is what a stack is built from;
//           a falling body turns about its centre of mass, though, so the
//           centre is what follows the trajectory and the base goes wherever
//           the turn leaves it.
export const SHAPES = Object.freeze(
  [
    {
      name: "cube",
      height: ITEM.cube,
      radius: (ITEM.cube * Math.SQRT2) / 2,
      centre: ITEM.cube / 2,
    },
    {
      name: "tetrahedron",
      height: ITEM.tetraEdge * Math.sqrt(2 / 3),
      radius: ITEM.tetraEdge / Math.sqrt(3),
      centre: (ITEM.tetraEdge * Math.sqrt(2 / 3)) / 4,
    },
    {
      name: "sphere",
      height: ITEM.sphereR * 2,
      radius: ITEM.sphereR,
      centre: ITEM.sphereR,
    },
  ].map((shape) => Object.freeze({ ...shape, pitch: shape.height + ITEM.gap })),
);

export const PLATE_BORE = Math.max(...SHAPES.map((s) => s.radius));
