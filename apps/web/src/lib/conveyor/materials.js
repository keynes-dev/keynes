/*
  Every material in the scene. Line materials need the pixel size of the canvas
  to work out their width, so they are registered as they are made and the whole
  set is retuned through `setResolution`: a material added here cannot be one the
  resize forgot about.

  The drawing is two colours — the ground it is drawn on and the ink it is drawn
  in — and both come from the page rather than being fixed here, so the scene
  inverts with the site's theme instead of sitting as a lit panel in a dark one.
  Every white surface is the ground and every line the ink; a hole is ink too,
  since what shows through it has to read against the face it is cut in. The
  lamp keeps its own colours: those carry the verdict and mean the same thing
  whichever way round the page is.
*/
import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

import { CONFIG } from "./config.js";

const offset = {
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
};

// Widths are in CSS pixels; the registry scales them by the device ratio.
const widths = new Map();
function lineMaterial(width) {
  const material = new LineMaterial({ color: CONFIG.ink, linewidth: width });
  widths.set(material, width);
  return material;
}

export const white = new THREE.MeshBasicMaterial({
  color: CONFIG.ground,
  ...offset,
});
export const black = new THREE.MeshBasicMaterial({ color: CONFIG.ink });
export const shell = new THREE.MeshBasicMaterial({
  color: CONFIG.ground,
  side: THREE.DoubleSide,
  ...offset,
});
export const glass = new THREE.MeshBasicMaterial({
  color: 0x9fbfe0,
  transparent: true,
  opacity: 0.14,
  depthWrite: false,
  ...offset,
});
export const lampMat = new THREE.MeshBasicMaterial({
  color: CONFIG.lampColors.running,
  ...offset,
});
// Unlit, like everything else in the scene. Nothing here shades: it is line
// work, and a surface that takes a light is a surface pretending to have been
// photographed.
export const shapeMats = CONFIG.shapeColors.map(
  () =>
    new THREE.MeshBasicMaterial({
      color: CONFIG.ground,
      side: THREE.DoubleSide,
      ...offset,
    }),
);
// The ground grid. GridHelper bakes its two colours into vertex attributes;
// giving it a plain material instead makes it one faint rule that can be
// themed with everything else.
export const gridMat = new THREE.LineBasicMaterial({ color: CONFIG.rule });
export const lineMat = lineMaterial(CONFIG.lineWidth);
// Hairline weight for mechanism detail. At 512px a bolt head is only a few
// pixels across, so the structural line weight fills it in solid.
export const fineMat = lineMaterial(CONFIG.fineWidth);

const grounds = [white, shell, ...shapeMats];
const inks = [black, lineMat, fineMat];

// Repaint the drawing in the page's own two colours. Called with resolved sRGB
// numbers, since a CSS custom property here is `oklch(...)` and three's colour
// parser does not read it — the host resolves it through a canvas first.
export function setTheme(ground, ink, rule) {
  for (const material of grounds) material.color.setHex(ground);
  for (const material of inks) material.color.setHex(ink);
  gridMat.color.setHex(rule);
}

/*
  `weight` is how large the drawing is being rendered against the size its line
  weights were chosen at. A line is otherwise a fixed number of screen pixels
  however far out the frame is zoomed, so a machine drawn half the size keeps
  full-weight strokes and its detail closes up into a blot.
*/
export function setResolution(width, height, pixelRatio, weight = 1) {
  for (const [material, base] of widths) {
    material.resolution.set(width, height);
    material.linewidth = base * pixelRatio * weight;
  }
}
