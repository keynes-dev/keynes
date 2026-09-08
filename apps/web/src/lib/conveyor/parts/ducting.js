/*
  The upright storage tubes and the opaque sheet-metal fittings that drain them.
  The outer two turn through corrugated elbows and run inward to a tee; the
  middle one drops straight into it. The tee's trunk carries every shape down
  into the machine.

  Swept solids are outlined by their silhouette against the fixed camera, since
  edge extraction on a swept tube yields unusable clutter.
*/
import * as THREE from "three";

import { IRIS, MACHINE, PLATE_BORE } from "../config.js";
import {
  addRun,
  frontRing,
  fullRing,
  glassPipe,
  segments,
  silhouette,
  solid,
} from "../draft.js";
import { fineMat, white } from "../materials.js";
import { TUBES } from "../timeline.js";
import { UP, VIEW } from "../view.js";
import { iris } from "./iris.js";

// A straight length of duct between two points.
export function straightDuct(p0, p1, r) {
  const g = new THREE.Group();
  const dir = p1.clone().sub(p0).normalize();
  const len = p0.distanceTo(p1);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 32), white);
  mesh.position.copy(p0).lerp(p1, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir);
  g.add(mesh);
  g.add(silhouette(p0, r, p1, r));
  return g;
}
// A corrugated elbow: smooth collars at both ends, ribbed through the bend.
export function elbow(from, corner, to, r) {
  const curve = new THREE.QuadraticBezierCurve3(from, corner, to);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r, 24, false), white));
  const samples = 48,
    left = [],
    right = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const side = new THREE.Vector3()
      .crossVectors(curve.getTangentAt(t), VIEW)
      .normalize()
      .multiplyScalar(r);
    left.push(curve.getPointAt(t).add(side));
    right.push(curve.getPointAt(t).sub(side));
  }
  const outline = [];
  addRun(outline, left);
  addRun(outline, right);
  g.add(segments(outline));
  const span = 0.86 - 0.14;
  const count = Math.max(
    2,
    Math.round((curve.getLength() * span) / MACHINE.ductRib),
  );
  const ribs = [];
  for (let k = 0; k <= count; k++) {
    const t = 0.14 + span * (k / count);
    frontRing(ribs, curve.getPointAt(t), curve.getTangentAt(t), r);
  }
  g.add(segments(ribs, fineMat));
  return g;
}
// A bolted flange: the collar that joins two fittings, ringed with bolt heads.
export function flange(centre, axis, r) {
  const g = new THREE.Group();
  const rf = r + MACHINE.flangeR;
  const body = solid(
    new THREE.CylinderGeometry(rf, rf, MACHINE.flangeW, 32),
    white,
    30,
  );
  body.position.copy(centre);
  body.quaternion.setFromUnitVectors(UP, axis);
  g.add(body);
  const u = new THREE.Vector3().crossVectors(axis, VIEW).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u).normalize();
  const pts = [];
  for (let b = 0; b < MACHINE.bolts; b++) {
    const a = (b / MACHINE.bolts) * Math.PI * 2;
    const n = u
      .clone()
      .multiplyScalar(Math.cos(a))
      .addScaledVector(v, Math.sin(a));
    if (n.dot(VIEW) > 0) continue;
    fullRing(
      pts,
      centre.clone().addScaledVector(n, rf * 1.01),
      n,
      MACHINE.boltR,
      18,
    );
  }
  g.add(segments(pts, fineMat));
  return g;
}
// The welded saddle where a branch meets the trunk. Equal radii make the seam
// a pair of arcs meeting in a V, exactly as on a sheet-metal tee.
export function saddleSeam(trunkCentre, r, towards) {
  const pts = [];
  for (const sign of [1, -1]) {
    const run = [];
    for (let j = 0; j <= 40; j++) {
      const x = -r + (2 * r * j) / 40;
      const h = Math.sqrt(Math.max(0, r * r - x * x));
      const point = trunkCentre
        .clone()
        .add(new THREE.Vector3(x, sign * h, towards * h));
      if (new THREE.Vector3(x, 0, towards * h).dot(VIEW) > 0) {
        addRun(pts, run.splice(0));
        continue;
      }
      run.push(point);
    }
    addRun(pts, run);
  }
  return segments(pts);
}

export function createDucting(scene) {
  const R = MACHINE.ductR;
  const trunkTop = MACHINE.elbowY;
  const trunkBottom = MACHINE.manifold.y + MACHINE.manifoldH / 2;
  const trunkAxis = new THREE.Vector3(0, 0, 1);
  const irises = [];

  TUBES.forEach((tube, s) => {
    const bottom = new THREE.Vector3(0, tube.bottomY, tube.z);
    const top = bottom.clone().setY(tube.topY);
    scene.add(glassPipe(bottom, top, MACHINE.tubeR, true));

    const diaphragm = iris(bottom.clone(), PLATE_BORE + IRIS.clearance);
    scene.add(diaphragm.group);
    irises.push(diaphragm);

    const spigot = new THREE.Vector3(0, MACHINE.elbowY, tube.z);
    if (tube.z === 0) {
      scene.add(straightDuct(spigot, new THREE.Vector3(0, trunkTop, 0), R));
    } else {
      const towards = Math.sign(-tube.z);
      const armEnd = new THREE.Vector3(
        0,
        MACHINE.armY,
        tube.z + towards * MACHINE.elbowR,
      );
      scene.add(
        elbow(spigot, new THREE.Vector3(0, MACHINE.armY, tube.z), armEnd, R),
      );
      scene.add(
        straightDuct(
          armEnd,
          new THREE.Vector3(0, MACHINE.armY, towards * 0.04),
          R,
        ),
      );
      scene.add(
        flange(armEnd.clone().setZ(armEnd.z + towards * 0.09), trunkAxis, R),
      );
      scene.add(saddleSeam(new THREE.Vector3(0, MACHINE.armY, 0), R, -towards));
    }
    // Collar joining the iris frame to the ducting below it.
    scene.add(
      flange(new THREE.Vector3(0, MACHINE.elbowY + 0.05, tube.z), UP, R),
    );
  });

  // The tee itself, and its bolted connection into the machine.
  scene.add(
    straightDuct(
      new THREE.Vector3(0, trunkBottom, 0),
      new THREE.Vector3(0, trunkTop, 0),
      R,
    ),
  );
  scene.add(flange(new THREE.Vector3(0, trunkBottom + 0.07, 0), UP, R));

  return {
    apply({ iris: openings }) {
      for (let s = 0; s < irises.length; s++) irises[s].open(openings[s]);
    },
  };
}
