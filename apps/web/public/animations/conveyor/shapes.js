/*
  The three dispensable shapes, as one table.

  Everything that used to be indexed by a loose `sh` — height, reach, centre of
  mass, geometry, material, tumble — is a field of one entry here, so adding a
  fourth shape is adding a row rather than remembering eight arrays.

  Each geometry has its origin at the shape's base, because that is what a stack
  is built from.
*/
import * as THREE from "three";

import { CONFIG, ITEM, SHAPES as METRICS, TRI_ANGLES } from "./config.js";
import { edgeLines, sphereSilhouette } from "./draft.js";
import { shapeMats } from "./materials.js";
import { UP } from "./view.js";

function tetraGeometry(edge) {
  const R = edge / Math.sqrt(3),
    h = edge * Math.sqrt(2 / 3);
  const base = TRI_ANGLES.map((a) => [R * Math.cos(a), 0, R * Math.sin(a)]);
  const apex = [0, h, 0];
  const pos = [];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  tri(base[0], base[2], base[1]);
  tri(base[0], base[1], apex);
  tri(base[1], base[2], apex);
  tri(base[2], base[0], apex);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const GEOMETRIES = [
  new THREE.BoxGeometry(ITEM.cube, ITEM.cube, ITEM.cube).translate(
    0,
    ITEM.cube / 2,
    0,
  ),
  tetraGeometry(ITEM.tetraEdge),
  new THREE.SphereGeometry(ITEM.sphereR, 24, 16).translate(0, ITEM.sphereR, 0),
];

// Nothing torques a shape once it is in the air, so it turns about a fixed
// axis at a constant rate for the whole of its fall. Axis and rate are seeded
// from which shape it is and where it comes in the batch, so a given shape
// tumbles the same way on every pass of the loop.
function tumbles(index) {
  const list = [];
  for (let m = 0; m < CONFIG.itemsPerDrop; m++) {
    const n = index * CONFIG.itemsPerDrop + m;
    list.push({
      axis: new THREE.Vector3(
        Math.cos(n * 2.399),
        0.45 * Math.cos(n * 1.13),
        Math.sin(n * 2.399),
      ).normalize(),
      rate: 4.6 + 1.4 * (n % 4),
    });
  }
  return list;
}

export const SHAPES = METRICS.map((metrics, index) => ({
  ...metrics,
  index,
  geometry: GEOMETRIES[index],
  material: shapeMats[index],
  tumble: tumbles(index),
  // A sphere's outline is view-dependent and never falls out of edge
  // extraction, so it is drawn explicitly.
  round: index === 2,
}));

export function item(index) {
  const shape = SHAPES[index];
  const g = new THREE.Group();
  g.add(new THREE.Mesh(shape.geometry, shape.material));
  g.add(
    shape.round
      ? sphereSilhouette(ITEM.sphereR, new THREE.Vector3(0, ITEM.sphereR, 0))
      : edgeLines(shape.geometry, 1),
  );
  g.userData.shape = index;
  return g;
}

const REST_TURN = new THREE.Quaternion();
const spinTurn = new THREE.Quaternion();
const lever = new THREE.Vector3();
// Place a shape in free fall from the frame's description of it: its centre
// goes on the trajectory, it turns about that centre, and `square` winds the
// turn back upright for a shape the tube has taken hold of, so the stack it
// lands on stays tidy.
export function placeFalling(object, index, state) {
  const shape = SHAPES[index];
  // A sphere is drawn by its outline, and that outline is a circle only while
  // it faces the camera. Turning one is unobservable on the surface — it is
  // featureless white — but it swings the circle out of the view plane, where
  // it projects as an ellipse and the shape reads as a stray arc rather than a
  // ball. So a round shape falls without turning: nothing is lost, since there
  // was nothing on it to see turn.
  if (shape.round) spinTurn.identity();
  else {
    const spin = shape.tumble[state.spin];
    spinTurn.setFromAxisAngle(spin.axis, spin.rate * state.t);
    if (state.square > 0) spinTurn.slerp(REST_TURN, state.square);
  }
  object.quaternion.copy(spinTurn);
  lever.set(0, shape.centre, 0).applyQuaternion(spinTurn);
  object.position.set(state.x - lever.x, state.y - lever.y, state.z - lever.z);
}
// Place a shape standing on `point`, its up axis along `axis` (spheres stay upright).
export function placeItem(object, point, axis = UP, yaw = 0) {
  object.position.copy(point);
  if (SHAPES[object.userData.shape].round) object.quaternion.identity();
  else {
    object.quaternion.setFromUnitVectors(UP, axis);
    if (yaw) object.rotateY(yaw);
  }
}
