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
import { grid } from "./draft.js";
import { gridMat } from "./materials.js";
import { createArm } from "./parts/arm.js";
import { createBelt } from "./parts/belt.js";
import { createBoxes } from "./parts/boxes.js";
import { createDucting } from "./parts/ducting.js";
import { createMachine } from "./parts/machine.js";
import { createItems } from "./parts/items.js";
import { createTimeline, TUBES } from "./timeline.js";
import { camera, frameCamera, skyOffset } from "./view.js";

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
  scene.add(grid(40, 80, gridMat));

  const parts = [
    createBelt(scene),
    createDucting(scene),
    createMachine(scene),
    createBoxes(scene),
    createArm(scene),
    createItems(scene),
  ];

  /*
    How far above each tube's mouth a refill has to start to be off frame. Only
    the camera can answer that, and only once it has been stood where the frame
    will be seen from: a tall frame zooms the camera out, and measuring against
    the default window starts the charge on screen. Aspect does not change that
    height, so any is fine here; the host reframes with the element's own.

    Measured against every framing the drawing can be seen in rather than the
    one it opens in, and the furthest taken. The placement is settled again on
    each resize, so a frame that began beside the text can become one below it
    without the scene being rebuilt, and a charge measured for the closer of the
    two would fall into view partway. Starting one further out than it needs
    costs only a longer pour, which the timeline sizes to the fall.
  */
  const standing = typeof place === "function" ? place() : place;
  const sky = TUBES.map(() => 0);
  for (const framing of [CONFIG.aside, CONFIG.below, standing]) {
    frameCamera(1, framing);
    TUBES.forEach((tube, s) => {
      const point = new THREE.Vector3(0, tube.topY, tube.z);
      sky[s] = Math.max(sky[s], skyOffset(point));
    });
  }
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
