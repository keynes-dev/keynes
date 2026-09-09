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
import { gridMat } from "./materials.js";
import { createArm } from "./parts/arm.js";
import { createBelt } from "./parts/belt.js";
import { createBoxes } from "./parts/boxes.js";
import { createDucting } from "./parts/ducting.js";
import { createMachine } from "./parts/machine.js";
import { createItems } from "./parts/items.js";
import { createTimeline, TUBES } from "./timeline.js";
import { camera, frameCamera, skyOffset } from "./view.js";

/*
  `aside` stands the machine to one side of its frame, for a caller setting
  something else beside it; without it the machine drops to the bottom, for a
  caller setting something above it. Which of those a layout wants is the
  layout's to know, not the drawing's.
*/
export function createConveyor(container, { aside = false } = {}) {
  const scene = new THREE.Scene();
  const grid = new THREE.GridHelper(40, 80);
  grid.material = gridMat;
  scene.add(grid);

  const parts = [
    createBelt(scene),
    createDucting(scene),
    createMachine(scene),
    createBoxes(scene),
    createArm(scene),
    createItems(scene),
  ];

  // How far above each tube's mouth a refill has to start to be off frame. Only
  // the camera can answer that, and only once it has been stood where this
  // layout will see it — a tall frame zooms out, and measuring against the
  // default window puts the charge on screen. Aspect does not change that
  // height; host will reframe with the element's own.
  const place = aside ? CONFIG.aside : CONFIG.below;
  frameCamera(1, place);
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
  const view = host(container, {
    scene,
    camera,
    update,
    loop,
    still,
    place,
  });

  // Handles for inspection, each on its own key: the config is not also the
  // control panel, so an exposed `arm` can no longer overwrite the arm's
  // timings. Hung off the window so the drawing can be driven from a console
  // the way it always could, and so a frame can be held still for a screenshot.
  const handle = {
    config: CONFIG,
    timeline: { loop, cycles, describe: timeline.describe },
    controls: { seek: view.seek, start: view.start, stop: view.stop },
    scene,
    parts,
    destroy() {
      view.destroy();
      if (window.conveyor === handle) delete window.conveyor;
    },
  };
  window.conveyor = handle;
  return handle;
}
