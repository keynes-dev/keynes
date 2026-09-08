/*
  Every material in the scene. Line materials need the pixel size of the canvas
  to work out their width, so they are registered as they are made and the whole
  set is retuned through `setResolution`: a material added here cannot be one the
  resize forgot about.
*/
import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

import { CONFIG } from "./config.js";

const offset = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };

// Widths are in CSS pixels; the registry scales them by the device ratio.
const widths = new Map();
function lineMaterial(width) {
  const material = new LineMaterial({ color: 0x111111, linewidth: width });
  widths.set(material, width);
  return material;
}

export const white = new THREE.MeshBasicMaterial({ color: 0xffffff, ...offset });
export const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
export const shell = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, ...offset });
export const glass = new THREE.MeshBasicMaterial({ color: 0x9fbfe0, transparent: true, opacity: 0.14, depthWrite: false, ...offset });
export const lampMat = new THREE.MeshBasicMaterial({ color: CONFIG.lampColors.running, ...offset });
// Unlit, like everything else in the scene. Nothing here shades: it is line
// work, and a surface that takes a light is a surface pretending to have been
// photographed.
export const shapeMats = CONFIG.shapeColors.map((color) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, ...offset }));
export const lineMat = lineMaterial(CONFIG.lineWidth);
// Hairline weight for mechanism detail. At 512px a bolt head is only a few
// pixels across, so the structural line weight fills it in solid.
export const fineMat = lineMaterial(CONFIG.fineWidth);

export function setResolution(width, height, pixelRatio) {
  for (const [material, base] of widths) {
    material.resolution.set(width, height);
    material.linewidth = base * pixelRatio;
  }
}
