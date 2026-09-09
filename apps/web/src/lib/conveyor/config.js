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
  // The two colours the drawing is made of, used until the page says otherwise.
  // Every solid takes the ground and every line the ink, so the scene inverts
  // with the site's theme rather than sitting as a lit panel in a dark page.
  ground: 0xffffff,
  ink: 0x111111,
  // The ground grid, which is neither: a rule faint enough to sit under the
  // drawing without competing with it.
  rule: 0xe0e0e0,
  // The dispensed shapes are solids like any other, told apart by their
  // outlines. Nothing in the scene carries colour except the lamp.
  shapeColors: [0xffffff, 0xffffff, 0xffffff],
  // Keyed by meaning, not colour, so the palette can be retuned without the
  // names lying. `denied` is a box the machine cannot fill, `depleted` the
  // machine with nothing left to fill one with: both red, but not one fault.
  lampColors: {
    running: 0xf2b705,
    denied: 0xe3262e,
    depleted: 0xe3262e,
    approved: 0x18b85a,
  },
  lineWidth: 1.25,
  fineWidth: 0.55,
  // The frame height those two weights were chosen against, at zoom 1. A frame
  // rendered larger than this carries proportionally heavier lines and one
  // rendered smaller lighter ones, so the drawing keeps its proportions rather
  // than thickening up as it shrinks.
  weighedAt: 512,
  maxPixelRatio: 2,
  frustum: 2.9,
  // Where the machine stands in its frame, and how much of the frame it fills.
  // Either way the ground it stands on runs out behind whatever else the caller
  // has put there; what changes is where there is room for that — beside the
  // machine when the frame is wide, under it when the frame is tall. Which of
  // the two applies is `choosePlace` below.
  aside: { x: 0.46, y: 0, zoom: 1 },
  below: { x: 0.107, y: -0.429, zoom: 2.5 },
  skyMargin: 1.15,
  // Raised until the furthest tube's top rim clears the frame. The rim decides,
  // not the axis: checking the centre line alone lets the far lip clip.
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
  // One roller per slat. They are evenly spaced at any pitch but only look it
  // at this one: the slats mask them, so at any other spacing which roller
  // shows through changes down the run and they read as unevenly spread.
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

// Hole layout per box: every face bored, every face its own shape. This camera
// shows exactly three faces — +x, +y, +z — and a box rolled half a turn shows a
// different three: the same +x face, its base where its lid was, and its far z
// face brought round. Both triples must be three different shapes; sharing one
// between the two z faces is what put two triangles on a flipped box. `base` is
// what a turned box presents, so it carries the shape dispensed to it. Easy to
// break by hand and visible only on the one box ever turned, so it is tested.
export const BOXES = Object.freeze([
  { top: 0, base: 2, xPos: 1, xNeg: 0, zPos: 2, zNeg: 0 },
  { top: 0, base: 1, xPos: 2, xNeg: 0, zPos: 1, zNeg: 0, turns: true },
  { top: 2, base: 1, xPos: 0, xNeg: 2, zPos: 1, zNeg: 2 },
]);

// Pincer arm: two links, mounted behind the machine on the far side of the belt
// so it never stands between the boxes and the camera. Sight lines constrain it
// as much as reach — the shoulder and both poses stay clear of the screen area
// the near iris covers, or the joints vanish and the arm reads as loose parts.
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

  // Each link is a box beam pivot to pivot; each joint one stepped barrel split
  // into a coaxial slice per link, the near slice narrower so the step reads as
  // a machined shoulder. Keep consecutive links closer in depth than the
  // joint's own radius, or the far link projects clear and the joint opens.
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
  // Pincer head: both jaws hinge on one axle and close like tongs. A shank
  // leaves the hinge almost square to the reach, so the jaw is out past the
  // box's face before it turns forward — a shallower one cuts the box's corner
  // on the way in however wide the jaws open.
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
  // A bulb in a keyless socket on the manifold's front face. The ball is the
  // size of the balls the machine drops — the same 0.11 as `ITEM.sphereR`, and
  // meant to be, though ITEM is declared below and cannot be named here. Any
  // bigger and it stops reading as a fitting on the machine.
  // The plate must stand well clear of the cup: at anything near the cup's own
  // radius the two rims sit a pixel apart and read as one thick ring.
  lampPlateR: 0.085,
  lampPlateT: 0.014,
  lampCupR: 0.046,
  lampCupLen: 0.037,
  // The glass: at the cup, at the ball, the ball's stand-off, and the ball. The
  // shoulder must stay under the ball's radius or the flare ends proud of the
  // envelope and draws a rim across it.
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

// One entry per dispensable shape. Only the measurements live here; shapes.js
// attaches the geometry and material, being the half that needs a renderer.
//
//   height  what a stack is pitched by
//   radius  its widest horizontal reach. Every iris plate is bored to the
//           largest of the three, so all three are interchangeable.
//   pitch   height plus a clearance
//   centre  its centre of mass above its base. Geometry origins sit at the
//           base, since that is what a stack is built from, but a falling body
//           turns about its centre — so the centre follows the trajectory and
//           the base goes where the turn leaves it.
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

/*
  Whether there is room to set something beside the machine, which decides which
  of `CONFIG.aside` and `CONFIG.below` the frame is drawn to.

  This is the same query Tailwind's `lg:` is, and it has to be: the caller lays
  its text out on that breakpoint (`Hero.tsx` uses `lg:max-w-[52%]`,
  `lg:min-h-[32rem]`, `lg:justify-center`), and a camera that switched on
  anything else — a pixel width of the container, say — would agree with the
  text only by coincidence and drift the day the padding or the root font size
  changed. Asked rather than subscribed to: crossing this width necessarily
  resizes the container, so the host's resize observer already fires on every
  transition and a second subscription could only disagree with the first.
*/
export function choosePlace() {
  return window.matchMedia("(min-width: 64rem)").matches
    ? CONFIG.aside
    : CONFIG.below;
}
