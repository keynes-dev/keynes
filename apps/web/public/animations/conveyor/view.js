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
