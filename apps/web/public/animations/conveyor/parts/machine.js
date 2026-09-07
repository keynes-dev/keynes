/*
  The machine itself: the manifold every duct drains into, the nozzle it
  dispenses from, and the lit sign bolted to its front.
*/
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { MACHINE } from "../config.js";
import { addRun, barrel, box, edgeLines, segments, solid, sphereSilhouette, thin } from "../draft.js";
import { LOGO_PATHS, LOGO_VIEWBOX } from "../logo.js";
import { fineMat, lampMat, markMat, white } from "../materials.js";
import { VIEW } from "../view.js";

// A lamp round the sign: a socket let into the panel, a neck, and a glass
// envelope that carries the colour. A sphere's outline is view-dependent and
// never falls out of edge extraction, so it is drawn explicitly the way the
// dispensed spheres are.
function lamp() {
  const g = new THREE.Group();
  g.add(barrel("x", -0.03, 0.03, MACHINE.lampSocketR, MACHINE.lampSocketR, { radial: 28 }));
  g.add(barrel("x", 0.03, 0.06, MACHINE.lampNeckR, MACHINE.lampNeckR, { radial: 28 }));
  const centre = 0.06 + MACHINE.lampBulbR * 0.75;
  const glass = new THREE.Mesh(new THREE.SphereGeometry(MACHINE.lampBulbR, 20, 14), lampMat);
  glass.position.x = centre;
  g.add(glass);
  g.add(sphereSilhouette(MACHINE.lampBulbR, new THREE.Vector3(centre, 0, 0)));
  return g;
}

// The bell, built in tiers rather than as one smooth cone. A rib stands proud
// at each joint and a lip runs round the mouth, so the profile itself steps
// instead of relying on lines drawn on a plain surface, which is what carries
// the shape at the size this renders at.
function bell() {
  const nozzle = new THREE.Group();
  const height = MACHINE.nozzleTop - MACHINE.nozzleBottom;
  // The collar is drawn without a silhouette: it is buried under the manifold's
  // own outline, and adding one only doubles that edge.
  const collar = solid(new THREE.CylinderGeometry(MACHINE.nozzleR0 + 0.05, MACHINE.nozzleR0 + 0.05, 0.1, 32), white, 30);
  collar.position.y = height / 2 + 0.05;
  nozzle.add(collar);

  // Local y runs from the mouth at the bottom to the throat at the top, and the
  // radius flares faster than a straight cone would, so the wall reads curved.
  const bellY = (t) => height / 2 - t * height;
  const bellR = (t) => MACHINE.nozzleR1 + (MACHINE.nozzleR0 - MACHINE.nozzleR1) * Math.pow(t, MACHINE.nozzleFlare);
  const tier = (y0, r0, y1, r1) => barrel("y", y0, y1, r0, r1);
  for (let k = 0; k < MACHINE.nozzleTiers; k++) {
    const t0 = k / MACHINE.nozzleTiers, t1 = (k + 1) / MACHINE.nozzleTiers;
    nozzle.add(tier(bellY(t1), bellR(t1), bellY(t0), bellR(t0)));
    if (k === MACHINE.nozzleTiers - 1) continue;
    // The ribs and the lip are detail on the bell, not the bell's own outline,
    // so they are drawn at hairline weight: at structural weight their rim
    // circles read as heavy as the profile and the whole thing bands up.
    const r = bellR(t1) + MACHINE.nozzleRibR;
    nozzle.add(thin(tier(bellY(t1) - MACHINE.nozzleRibH / 2, r, bellY(t1) + MACHINE.nozzleRibH / 2, r)));
  }
  const lipR = MACHINE.nozzleR0 + MACHINE.nozzleLipR;
  nozzle.add(thin(tier(bellY(1), lipR, bellY(1) + MACHINE.nozzleLipH, lipR)));

  // Flutes down the face of the bell, the way a real nozzle carries its cooling
  // tubes. Kept to the half that faces the camera: a line on a curved surface
  // drawn all the way round shows through the far wall.
  const flutes = [];
  for (let k = 0; k < MACHINE.nozzleFlutes; k++) {
    const a = (k / MACHINE.nozzleFlutes) * Math.PI * 2;
    const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    if (n.dot(VIEW) > -0.2) continue;
    const run = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8;
      run.push(new THREE.Vector3(n.x * bellR(t), bellY(t), n.z * bellR(t)));
    }
    addRun(flutes, run);
  }
  nozzle.add(segments(flutes, fineMat));
  nozzle.position.set(0, (MACHINE.nozzleTop + MACHINE.nozzleBottom) / 2, 0);
  return nozzle;
}
/*
  The machine's front. The panel carrying the mark is the face, and a border of
  lamps runs round it, all of them wired to the same verdict. It sits just into
  the manifold's own front and overhangs it on every side; everything behind
  stays inboard of that plane, so nothing has to move to make room.
*/
function sign(scene) {
  const m = MACHINE.manifold;
  // Let a little into the manifold's face so the two are not coplanar, which
  // would leave them fighting over the same pixels.
  const back = MACHINE.manifoldW / 2 - 0.01;
  const front = back + MACHINE.signT;
  const at = MACHINE.signY;
  scene.add(box(MACHINE.signT, MACHINE.signH, MACHINE.signW, back + MACHINE.signT / 2, at, m.z + MACHINE.signZ));
  // Two stays back into the machine, one into the manifold and one into the
  // trunk above it, since the panel is carried down the belt and only its near
  // end sits against the manifold's face.
  for (const dy of [-1, 1]) {
    scene.add(box(MACHINE.signStay, 0.08, 0.08, back - MACHINE.signStay / 2 + 0.02, at + dy * 0.28, m.z));
  }

  const svg = `<svg viewBox="0 0 ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}">${LOGO_PATHS.map((d) => `<path d="${d}" fill="#000"/>`).join("")}</svg>`;
  const shapes = [];
  for (const path of new SVGLoader().parse(svg).paths) shapes.push(...SVGLoader.createShapes(path));
  const mark = mergeGeometries(shapes.map((shape) => new THREE.ShapeGeometry(shape, 10)));
  mark.scale(1, -1, 1);
  mark.computeBoundingBox();
  const bb = mark.boundingBox;
  mark.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0);
  const k = MACHINE.signLogoW / (bb.max.x - bb.min.x);
  mark.scale(k, k, 1);
  const face = new THREE.Mesh(mark, markMat);
  // Every triangle of the fill is coplanar, so edge extraction keeps only each
  // glyph's boundary, and drawing that through the line pipeline gives a stroke
  // measured in screen pixels rather than in world units.
  const stroke = edgeLines(mark, 1);
  stroke.material = markMat.line;
  // Turned to lie on the panel. Its own reading direction then runs up and to
  // the right, which is what a face on this axis does in this projection.
  face.position.set(front + 0.002, at + MACHINE.signLogoY, m.z + MACHINE.signZ + MACHINE.signLogoZ);
  face.rotation.y = stroke.rotation.y = Math.PI / 2;
  stroke.position.copy(face.position).setX(front + 0.003);
  scene.add(face, stroke);

  // Walk the border, starting each edge at a corner so the corners are lit once.
  const halfW = MACHINE.signW / 2 - MACHINE.signInset;
  const halfH = MACHINE.signH / 2 - MACHINE.signInset;
  const seats = [];
  for (let i = 0; i < MACHINE.signLampsW; i++) {
    const t = -halfW + (2 * halfW * i) / MACHINE.signLampsW;
    seats.push([t, -halfH], [-t, halfH]);
  }
  for (let i = 0; i < MACHINE.signLampsH; i++) {
    const t = -halfH + (2 * halfH * i) / MACHINE.signLampsH;
    seats.push([halfW, t], [-halfW, -t]);
  }
  for (const [dz, dy] of seats) {
    const g = lamp();
    g.position.set(front, at + dy, m.z + MACHINE.signZ + dz);
    scene.add(g);
  }
}

export function createMachine(scene) {
  const m = MACHINE.manifold;
  scene.add(box(MACHINE.manifoldW, MACHINE.manifoldH, MACHINE.manifoldD, m.x, m.y, m.z));
  const nozzle = bell();
  scene.add(nozzle);
  sign(scene);

  return {
    apply({ pulse, lamp: colour }) {
      // The nozzle swells as each shape is spat out of it.
      nozzle.scale.set(1 + 0.12 * pulse, 1, 1 + 0.12 * pulse);
      lampMat.color.set(colour);
    },
  };
}
