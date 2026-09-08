/*
  The belt: slats and the toothed rollers they ride on. Nothing carries the belt
  but the gears themselves — the chain wraps them, riding on the tooth tips
  above and hanging from them below.
*/
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { BELT } from "../config.js";
import { edgeLines, segments, thin } from "../draft.js";
import { mod } from "../math.js";
import { fineMat, white } from "../materials.js";

const gearY = BELT.top - BELT.slatRise - BELT.rollerR;

// Toothed rollers. The tips ride on the slats, so the tip circle is the
// roller radius and the roots fall inside it.
function gearProfile(tip, root, teeth) {
  const step = (Math.PI * 2) / teeth;
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [r, f] of [
      [root, 0],
      [root, 0.24],
      [tip, 0.34],
      [tip, 0.66],
      [root, 0.76],
    ]) {
      pts.push([r * Math.cos(a + f * step), r * Math.sin(a + f * step)]);
    }
  }
  return pts;
}

export function createBelt(scene) {
  // Slats: solid boards, merged into one pair of objects so a belt's worth of
  // them costs two draws rather than a hundred. The chain is continuous, so the
  // same run comes back underneath, travelling the other way.
  const slatGeos = [];
  for (let z = -BELT.length / 2; z <= BELT.length / 2; z += BELT.slat) {
    slatGeos.push(
      new THREE.BoxGeometry(
        BELT.width,
        BELT.slatRise,
        BELT.slatDepth,
      ).translate(0, 0, z),
    );
  }
  const slatGeo = mergeGeometries(slatGeos);
  const slatRun = (y) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(slatGeo, white));
    g.add(edgeLines(slatGeo, 1));
    g.position.y = y;
    scene.add(g);
    return g;
  };
  const slats = slatRun(BELT.top - BELT.slatRise / 2);
  const returnSlats = slatRun(gearY - BELT.rollerR - BELT.slatRise / 2);

  const gearPts = gearProfile(
    BELT.rollerR,
    BELT.rollerR * BELT.rollerRoot,
    BELT.rollerTeeth,
  );
  const gearShape = new THREE.Shape();
  gearShape.moveTo(gearPts[0][0], gearPts[0][1]);
  for (let i = 1; i < gearPts.length; i++)
    gearShape.lineTo(gearPts[i][0], gearPts[i][1]);
  gearShape.closePath();
  const rollerGeo = new THREE.ExtrudeGeometry(gearShape, {
    depth: BELT.rollerW,
    bevelEnabled: false,
  });
  rollerGeo.translate(0, 0, -BELT.rollerW / 2);
  rollerGeo.rotateY(Math.PI / 2);

  // A small cross on the face that shows: the centre a wheel is turned about,
  // not spokes. Drawn to the tooth tips it stopped being part of the wheel and
  // read as a mark on the drawing.
  const faceX = BELT.rollerW / 2 + 0.002;
  const hub = BELT.rollerR * BELT.rollerHub;
  const spokes = [];
  for (const a of [0, Math.PI / 2]) {
    const c = Math.cos(a) * hub,
      s = Math.sin(a) * hub;
    spokes.push(faceX, c, s, faceX, -c, -s);
  }
  // Counted rather than accumulated, so the run stays symmetric about the middle
  // however the gap is set: stepping a float from one end drops the last roller.
  const rollers = [];
  const count = Math.round((2 * BELT.rollerSpan) / BELT.rollerGap);
  for (let i = 0; i <= count; i++) {
    const roller = new THREE.Group();
    roller.add(new THREE.Mesh(rollerGeo, white));
    roller.add(thin(edgeLines(rollerGeo, 30)));
    roller.add(segments(spokes, fineMat));
    roller.position.set(0, gearY, -BELT.rollerSpan + i * BELT.rollerGap);
    scene.add(roller);
    rollers.push(roller);
  }

  return {
    apply({ beltShift }) {
      slats.position.z = -mod(beltShift, BELT.slat);
      returnSlats.position.z = mod(beltShift, BELT.slat);
      for (const roller of rollers)
        roller.rotation.x = -beltShift / BELT.rollerR;
    },
  };
}
