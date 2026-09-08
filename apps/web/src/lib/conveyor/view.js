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

const H = CONFIG.frustum;
export const camera = new THREE.OrthographicCamera(-H, H, H, -H, 0.1, 200);
const target = new THREE.Vector3(...CONFIG.lookAt);
camera.position.copy(target).addScaledVector(ISO_DIR, 40);
camera.lookAt(target);
camera.updateMatrixWorld();

/*
  Fit the frame to the shape of the element it is drawn in, and stand the
  machine off centre in it.

  The vertical half-extent stays at `frustum` whatever the shape, so the machine
  is the same size in a wide banner as in a square, and the extra room a wide
  frame brings is extra ground rather than a bigger drawing — which is what lets
  the grid run the width of a section with the machine sitting at one end.

  `offset` is where the machine lands, in fractions of a half-frame from the
  centre: 0 is centred, 1 would be hard against the right edge. Sliding the
  window left by that much moves what is drawn in it right by the same, so the
  camera itself never moves and every silhouette drawn against it still holds.
*/
export function frameCamera(aspect, offset = 0) {
  const width = H * Math.max(aspect, 0.001);
  camera.left = -width - offset * width;
  camera.right = width - offset * width;
  camera.top = H;
  camera.bottom = -H;
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
