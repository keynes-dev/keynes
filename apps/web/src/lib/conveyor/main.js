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

import { choosePlace, CONFIG } from "./config.js";
import { host } from "./host.js";
import { gridMat } from "./materials.js";
import { createArm } from "./parts/arm.js";
import { createBelt } from "./parts/belt.js";
import { createBoxes } from "./parts/boxes.js";
import { createDucting } from "./parts/ducting.js";
import { createMachine } from "./parts/machine.js";
import { createItems } from "./parts/items.js";
import { createTimeline, TUBES } from "./timeline.js";
import { camera, skyOffset } from "./view.js";

// The conveyor currently drawn, if any. See the guard in `createConveyor`.
let live = null;

/*
  Where the machine stands in its frame follows the shape of the element it is
  drawn in, decided on every resize by `choosePlace`: to one side when there is
  room to set something beside it, at the bottom when there is not. A caller
  with its own idea can pass `place`, either a fixed `{ x, y, zoom }` or its own
  function; nothing on this site does, and the point of the default is that the
  choice is not a prop anyone has to thread down and keep in step.
*/
export function createConveyor(container, { place = choosePlace } = {}) {
  // One drawing at a time. The camera in view.js and every material in
  // materials.js are one set shared by the module, and the parts draw their
  // outlines against that one camera; a second conveyor would silently retune
  // the first one's framing, line weight and colours rather than fail. Cheap to
  // say so here, and worth saying now that the drawing is a tag anyone can put
  // on a page twice without an import to give them pause.
  if (live) {
    throw new Error(
      "createConveyor: a conveyor is already running. The scene keeps one " +
        "camera and one set of materials, so only one can be drawn at a time; " +
        "destroy the first before making another.",
    );
  }

  const scene = new THREE.Scene();
  const grid = new THREE.GridHelper(40, 40);
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
      if (live === handle) live = null;
      if (window.conveyor === handle) delete window.conveyor;
    },
  };
  live = handle;
  window.conveyor = handle;
  return handle;
}
