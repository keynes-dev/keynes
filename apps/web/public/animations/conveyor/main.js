/*
  Conveyor belt shape sorter, isometric hidden-line drafting style.

  Three upright glass tubes (cubes, pyramids, spheres) stand in a row along
  the belt axis. Each empties into an opaque curved duct that carries the
  shape out of sight into the machine, which dispenses it from a single
  nozzle. Every box is the same closed cube with a hole in its lid: square,
  triangle, or circle. The box under the nozzle receives the shape that fits
  its hole.

  One box in the loop arrives with a hole the machine can no longer fill, so
  the lamp goes red, a pincer arm rolls the box over to present a face it can
  fill, the lamp goes green, and the run continues. The lamp carries the
  verdict on the box that has arrived, not on each shape dropped: amber while
  the belt is running, then red or green, and solid either way.

  The loop opens on empty tubes: the charge falls in from off frame, the belt
  runs a box at a time until every tube is spent, and the machine then stands
  stopped under a red lamp with nothing left to dispense until the loop comes
  round and the hoppers open again. Every pass is the same pass.

  How it fits together: config.js holds every dimension and duration, timeline.js
  turns a loop time into a description of the frame, and each part under parts/
  builds its own objects and moves them to match that description. Time lives in
  the timeline; placement lives in the parts; nothing reaches across.

  Extension point: window.conveyor.config.sequence is one entry per box in belt
  order. `dispense` is the shape that ends up in the box, and `reject` marks
  the box the arm has to turn first.
*/
import * as THREE from "three";

import { CONFIG } from "./config.js";
import { host } from "./host.js";
import { createArm } from "./parts/arm.js";
import { createBelt } from "./parts/belt.js";
import { createBoxes } from "./parts/boxes.js";
import { createDucting } from "./parts/ducting.js";
import { createMachine } from "./parts/machine.js";
import { createItems } from "./parts/items.js";
import { createTimeline, TUBES } from "./timeline.js";
import { camera, skyOffset } from "./view.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
scene.add(new THREE.GridHelper(40, 40, 0xd8d8d8, 0xe8e8e8));

const parts = [
  createBelt(scene),
  createDucting(scene),
  createMachine(scene),
  createBoxes(scene),
  createArm(scene),
  createItems(scene),
];

// How far above each tube's mouth a refill has to start to be off frame. Only
// the camera can answer that, so the timeline is handed the answer rather than
// reaching for a camera itself.
const sky = TUBES.map((tube) =>
  skyOffset(new THREE.Vector3(0, tube.topY, tube.z)),
);
const timeline = createTimeline(sky);
const { cycles, loop } = timeline;

function update(t) {
  const frame = timeline.describe(t);
  for (const part of parts) part.apply(frame);
}

// The frame to hold when motion is turned off: mid-drop on the first box.
const firstBox = cycles.find((cycle) => cycle.entry);
const still = firstBox.start + firstBox.dropStart + 0.7;
const view = host(document.getElementById("scene"), {
  scene,
  camera,
  update,
  loop,
  still,
});

// Handles for inspection, each on its own key: the config is not also the
// control panel, so an exposed `arm` can no longer overwrite the arm's timings.
// `?debug` draws a live overlay: which build is on screen, whether anything is
// being drawn twice, and whether any stack is standing inside itself.
if (new URLSearchParams(location.search).has("debug")) {
  import("./debug.js").then((m) =>
    m.hud(scene, { loop, cycles, frame: timeline.describe(0) }, view),
  );
}

window.conveyor = {
  config: CONFIG,
  timeline: { loop, cycles, describe: timeline.describe },
  controls: { seek: view.seek, start: view.start, stop: view.stop },
  scene,
  parts,
};
