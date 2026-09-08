/*
  The boxes on the belt: nine slots, hole shapes repeating every three so a
  three-box loop is seamless.

  Every box carries all three holes: one shape on the lid and the other two on
  its sides, so a passing box never shows the same cut twice.
*/
import * as THREE from "three";

import { BELT, BOX, BOXES, ITEM, TRI_ANGLES } from "../config.js";
import { edgeLines, segments } from "../draft.js";
import { black, white } from "../materials.js";

function holeShape(shape) {
  const path = new THREE.Path();
  if (shape === 0) {
    const s = ITEM.cube / 2 + 0.03;
    path.moveTo(-s, -s);
    path.lineTo(s, -s);
    path.lineTo(s, s);
    path.lineTo(-s, s);
    path.closePath();
  } else if (shape === 1) {
    const R = ITEM.tetraEdge / Math.sqrt(3) + 0.035;
    TRI_ANGLES.forEach((a, i) => {
      const x = R * Math.cos(a),
        y = -R * Math.sin(a);
      i ? path.lineTo(x, y) : path.moveTo(x, y);
    });
    path.closePath();
  } else {
    path.absarc(0, 0, ITEM.sphereR + 0.03, 0, Math.PI * 2, false);
  }
  return path;
}
// A panel of the box: a rectangle with one shape cut through it, extruded to
// the wall thickness and centred on its own plane. Panels carry no border of
// their own — the box is outlined once, as a box, so its edges stay
// uncluttered — but the cut is outlined on the panel's outer face.
function panel(shape, w, h) {
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2, -h / 2);
  outer.lineTo(w / 2, -h / 2);
  outer.lineTo(w / 2, h / 2);
  outer.lineTo(-w / 2, h / 2);
  outer.closePath();
  outer.holes.push(holeShape(shape));
  const geometry = new THREE.ExtrudeGeometry(outer, {
    depth: BOX.wall,
    bevelEnabled: false,
    curveSegments: 32,
  });
  geometry.translate(0, 0, -BOX.wall / 2);

  const pts = holeShape(shape).getPoints(48);
  const z = BOX.wall / 2;
  const cut = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    cut.push(a.x, a.y, z, b.x, b.y, z);
  }

  const g = new THREE.Group();
  g.add(new THREE.Mesh(geometry, white));
  g.add(segments(cut));
  return g;
}

/*
  Six bored panels round a black core. Every panel's outer face lands exactly on
  the box's own outline and spans the full height between them, or the shell is
  not closed: short sides leave an open skirt at the foot, through which the
  slats behind are drawn across the box's face. The base sits at the very bottom
  for that reason, and because recessing it would throw the pivot off centre.
*/
function crate({ top, base: baseShape, xPos, xNeg, zPos, zNeg }) {
  const s = BOX.size,
    wt = BOX.wall;
  const h = s - wt; // the height the box outlines for itself
  const face = (s - wt) / 2; // centre plane of a side panel, so its outer face lands on the outline
  const inner = s - 2 * wt; // the pair of panels that sit between the other pair
  const g = new THREE.Group();

  const base = panel(baseShape, s, s);
  base.rotation.x = Math.PI / 2;
  base.position.y = wt / 2;
  g.add(base);

  const lid = panel(top, s, s);
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = h - wt / 2;
  g.add(lid);

  for (const [shape, width, yaw, x, z] of [
    [xPos, s, Math.PI / 2, face, 0],
    [xNeg, s, -Math.PI / 2, -face, 0],
    [zPos, inner, 0, 0, face],
    [zNeg, inner, Math.PI, 0, -face],
  ]) {
    const side = panel(shape, width, h);
    side.rotation.y = yaw;
    side.position.set(x, h / 2, z);
    g.add(side);
  }

  // A solid black core, so every hole reads as an opening rather than a wall.
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(inner - 0.01, h - 2 * wt - 0.01, inner - 0.01),
    black,
  );
  core.position.y = h / 2;
  g.add(core);

  const outline = edgeLines(new THREE.BoxGeometry(s, h, s));
  outline.position.y = h / 2;
  g.add(outline);
  return g;
}

export function createBoxes(scene) {
  const groups = [];
  for (let k = 0; k < BELT.slots; k++) {
    const shell = crate(BOXES[k % BOXES.length]);
    shell.position.y = -BOX.center;
    const group = new THREE.Group();
    group.add(shell);
    scene.add(group);
    groups.push(group);
  }
  return {
    groups,
    apply({ boxes }) {
      for (let k = 0; k < groups.length; k++) {
        groups[k].position.set(0, boxes[k].y, boxes[k].z);
        groups[k].rotation.x = boxes[k].roll;
      }
    },
  };
}
