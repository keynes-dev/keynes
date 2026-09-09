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

  These are one set for the module rather than one per conveyor, and `setTheme`
  and `setResolution` retune that set in place, so two conveyors on a page would
  each repaint the other's. `createConveyor` refuses a second one.
*/
import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

import { CONFIG } from "./config.js";

const offset = {
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
};

// Widths are in CSS pixels. LineSegments2 writes the CSS viewport into
// `resolution` before each draw, so a linewidth of 1 is a 1px stroke — the
// same as a CSS border. Multiplying that by the device ratio would double
// it on a retina display.
//
// `weigh` is whether a stroke follows the drawing's scale: machine ink does,
// so a zoomed-out frame keeps its proportions. The ground grid does not — it
// is the same 1px rule as the page's own borders, which do not thicken when
// the machine shrinks.
const widths = new Map();
function lineMaterial(width, weigh = true) {
  const material = new LineMaterial({ color: CONFIG.ink, linewidth: width });
  widths.set(material, { width, weigh });
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
// The ground grid. A 1px CSS stroke, same as the page's own rules.
export const gridMat = lineMaterial(1, false);
gridMat.color.setHex(CONFIG.rule);
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
  for (const [material, spec] of widths) {
    material.resolution.set(width, height);
    material.linewidth = spec.weigh
      ? spec.width * pixelRatio * weight
      : spec.width;
  }
}
