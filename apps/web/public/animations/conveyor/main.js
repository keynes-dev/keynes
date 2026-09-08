/*
  Conveyor belt shape sorter, isometric hidden-line drafting style.

  Three glass tubes of shapes drain through ducts into a machine that
  dispenses into the box below its nozzle, each box taking the shape that fits
  the hole in its lid. One box arrives with a hole the machine cannot fill, so
  a pincer arm rolls it over to present a face it can. The loop opens on empty
  tubes, runs a box at a time until they are spent, and stands stopped under a
  red lamp until it comes round: every pass is the same pass.

  config.js holds every dimension and duration, timeline.js turns a loop time
  into a description of the frame, and each part under parts/ moves its own
  objects to match. Time lives in the timeline, placement in the parts.

  Extension point: window.conveyor.config.sequence is one entry per box in belt
  order — `dispense` is the shape it receives, `reject` marks the one the arm
  has to turn first.
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
window.conveyor = {
  config: CONFIG,
  timeline: { loop, cycles, describe: timeline.describe },
  controls: { seek: view.seek, start: view.start, stop: view.stop },
  scene,
  parts,
};
