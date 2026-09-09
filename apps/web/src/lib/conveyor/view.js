/*
  Where the drawing is seen from. The camera never moves, which is what lets
  the rest of the scene draw view-dependent outlines — silhouettes, half rings —
  once at build time instead of every frame.
*/
import * as THREE from "three";

import { CONFIG } from "./config.js";

export const ISO_DIR = new THREE.Vector3(1, 1, 1).normalize();
export const VIEW = ISO_DIR.clone().negate();
export const UP = new THREE.Vector3(0, 1, 0);

// One camera for the module, not one per conveyor: the parts draw their
// outlines against it once at build time, so it is baked into their geometry
// and cannot be swapped underneath them. `createConveyor` refuses a second
// conveyor for this reason.
const H = CONFIG.frustum;
export const camera = new THREE.OrthographicCamera(-H, H, H, -H, 0.1, 200);
const target = new THREE.Vector3(...CONFIG.lookAt);
camera.position.copy(target).addScaledVector(ISO_DIR, 40);
camera.lookAt(target);
camera.updateMatrixWorld();

/*
  Fit the frame to the shape of the element it is drawn in, and stand the
  machine where the caller wants it inside that frame.

  The vertical half-extent is `frustum` times `zoom` whatever the shape, so the
  extra room a wide frame brings is extra ground rather than a bigger drawing —
  which is what lets the grid run the width of a section with the machine at one
  end — and `zoom` is what keeps a tall frame from meaning a tall machine.

  `x` and `y` are where the machine lands, in fractions of a half-frame from the
  centre: 0 is centred, 1 would be hard against the edge, positive is right and
  up. Sliding the window the other way moves what is drawn in it by the same
  amount, so the camera itself never moves and every silhouette drawn against it
  still holds.
*/
export function frameCamera(aspect, { x = 0, y = 0, zoom = 1 } = {}) {
  const height = H * zoom;
  const width = height * Math.max(aspect, 0.001);
  camera.left = -width - x * width;
  camera.right = width - x * width;
  camera.top = height - y * height;
  camera.bottom = -height - y * height;
  camera.updateProjectionMatrix();
}

// How far above `point` an item must start to sit outside the top of the frame.
// Each tube's mouth projects to a different screen height, so this is per tube.
export function skyOffset(point) {
  const here = point.clone().project(camera).y;
  const perUnit =
    point
      .clone()
      .setY(point.y + 1)
      .project(camera).y - here;
  return Math.max(0.6, (CONFIG.skyMargin - here) / perUnit);
}
