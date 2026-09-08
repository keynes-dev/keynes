/*
  The diaphragm at the base of each tube: a frame ring, its blades, and the
  black bore they close over. Every blade pivots on the frame ring; its inner
  edge is a chord whose distance from the axis is the aperture radius, so
  sweeping the blades shuts the bore like a camera.
*/
import * as THREE from "three";

import { IRIS } from "../config.js";
import { edgeLines, segments, silhouette, solid, thin } from "../draft.js";
import { black, shell, white } from "../materials.js";

// One tapered leaf, hinged at the origin: its long edge is the chord, and it
// narrows to a tip so the far corner never swings outside the frame.
const bladeShape = new THREE.Shape();
bladeShape.moveTo(0, 0);
bladeShape.lineTo(IRIS.length, 0);
bladeShape.lineTo(0, -IRIS.width);
bladeShape.closePath();
const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
  depth: IRIS.thickness,
  bevelEnabled: false,
});
bladeGeo.rotateX(Math.PI / 2);

// Only the chord and the taper are drawn. Outlining all three sides of every
// leaf turns a shut iris into a black smudge at this size.
function leaf() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(bladeGeo, white));
  g.add(
    segments([
      0,
      0,
      0,
      IRIS.length,
      0,
      0,
      IRIS.length,
      0,
      0,
      0,
      0,
      -IRIS.width,
    ]),
  );
  return g;
}

// `centre` is the mouth, level with the bottom of the glass tube above it.
export function iris(centre, holeR) {
  const g = new THREE.Group();
  const frameGeo = new THREE.CylinderGeometry(
    IRIS.frameR,
    IRIS.frameR,
    IRIS.frameH,
    40,
    1,
    true,
  );
  const frame = new THREE.Mesh(frameGeo, shell);
  frame.position.copy(centre).setY(centre.y - IRIS.frameH / 2);
  g.add(frame);
  const rims = edgeLines(frameGeo, 30);
  rims.position.copy(frame.position);
  g.add(rims);
  g.add(
    silhouette(
      centre.clone().setY(centre.y - IRIS.frameH),
      IRIS.frameR,
      centre.clone(),
      IRIS.frameR,
    ),
  );

  const bore = new THREE.Mesh(new THREE.CircleGeometry(IRIS.pivotR, 40), black);
  bore.rotation.x = -Math.PI / 2;
  bore.position.copy(centre).setY(centre.y - IRIS.boreDrop);
  g.add(bore);
  // The throat below it. Solid, so a shape dropping down the bore is swallowed
  // by the near wall as it goes rather than being switched off whole.
  const throat = new THREE.Mesh(
    new THREE.CylinderGeometry(IRIS.throatR, IRIS.throatR, IRIS.throatH, 24),
    black,
  );
  throat.position
    .copy(centre)
    .setY(centre.y - IRIS.boreDrop - 0.004 - IRIS.throatH / 2);
  g.add(throat);

  // Cover plate: it masks the pivots and the outer sweep of the leaves, so
  // only the aperture itself shows, the way a lens plate does.
  const plateShape = new THREE.Shape();
  plateShape.absarc(0, 0, IRIS.frameR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
  plateShape.holes.push(hole);
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
    depth: IRIS.plateT,
    bevelEnabled: false,
    curveSegments: 44,
  });
  plateGeo.rotateX(Math.PI / 2);
  const plate = thin(solid(plateGeo, white, 30));
  plate.position.copy(centre);
  g.add(plate);

  const blades = [];
  for (let k = 0; k < IRIS.blades; k++) {
    const phi = (k / IRIS.blades) * Math.PI * 2;
    const pivot = new THREE.Group();
    // Each leaf sits a shade above the last, as overlapping leaves do. Without
    // that the coplanar blades fight for depth and every hidden edge shows.
    pivot.position
      .copy(centre)
      .setY(centre.y - IRIS.bladeDrop + k * IRIS.bladeStep)
      .add(
        new THREE.Vector3(
          IRIS.pivotR * Math.cos(phi),
          0,
          IRIS.pivotR * Math.sin(phi),
        ),
      );
    const blade = thin(leaf());
    blade.position.y = IRIS.thickness / 2;
    pivot.add(blade);
    pivot.userData.phi = phi;
    g.add(pivot);
    blades.push(pivot);
  }
  // Each blade's chord swings from the bore edge to the axis.
  const open = (amount) => {
    const beta = IRIS.betaShut + amount * (IRIS.betaOpen - IRIS.betaShut);
    for (const blade of blades) blade.rotation.y = -(blade.userData.phi + beta);
  };
  return { group: g, open };
}
