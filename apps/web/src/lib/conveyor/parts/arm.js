/*
  The pincer arm. Two links solved for the wrist, a roll actuator held level on
  the end of them, and a head whose jaws close on the box like tongs.

  Every barrel here — joint slices, bosses, the wrist shafts — is `barrel` from
  the drafting toolkit, which is what makes a joint read as one stepped housing
  rather than as parts adrift on a flat face.
*/
import * as THREE from "three";

import { ARM } from "../config.js";
import { barrel, box, fullRing, segments } from "../draft.js";
import { fineMat } from "../materials.js";

// One slice of a joint barrel: a cylinder across the arm's plane. A joint is
// two of these, coaxial and of different radii, one per link, so the near slice
// is the face that shows, stepped down inside its rim.
const jointSlice = (r, [from, to], ring = 0) =>
  barrel("z", from, to, r, r, { ring });
// A boss standing on the roll plane, about the jaws' hinge axis.
const boss = (r, from, to) => barrel("y", from, to, r, r, { radial: 28 });
// A cylinder lying along the roll axis.
const shaft = (r, from, to) => barrel("x", from, to, r, r, { radial: 28 });
// A ring drawn on a flat face — a bearing race, a bolt circle, an axle cap —
// standing a hair off the face it belongs to. The whole circle shows, because
// the face is flat: culling it to the camera-facing half, as a ring on a curved
// surface needs, would leave an arc ending in mid-air.
function faceRing(axis, at, r, steps) {
  const centre = new THREE.Vector3();
  centre[axis] = at;
  const dir = new THREE.Vector3();
  dir[axis] = 1;
  const pts = [];
  fullRing(pts, centre, dir, r, steps);
  return segments(pts, fineMat);
}
// A link's body: a box beam lying along +X from the joint it hangs off, sunk
// into the barrel at each end so neither end face is ever the outline.
function beam(length, s) {
  const g = new THREE.Group();
  g.add(box(length, s.h, s.w, length / 2, 0, s.z));
  return g;
}
// A straight member of a pincer jaw: a bar of length L laid from (x0, z0) in
// the jaw's own plane, at `angle` off the reach axis.
function jawBar(x0, z0, angle, L, h, t) {
  const g = new THREE.Group();
  g.position.set(x0, 0, z0);
  g.rotation.y = -angle;
  g.add(box(L, h, t, L / 2, 0, 0));
  return g;
}

export function createArm(scene) {
  const upper = new THREE.Group();
  const fore = new THREE.Group();
  const wrist = new THREE.Group();
  const rotor = new THREE.Group();
  const jaws = [];

  // Mount: a post off the machine and a beam out to the shoulder. The beam
  // starts inside the post and ends inside the shoulder barrel, so the arm is
  // attached at both ends rather than resting against anything.
  scene.add(box(0.15, ARM.post.h, 0.5, ARM.post.x, ARM.post.y, 0));
  const span = Math.hypot(
    ARM.mount.x - ARM.shoulder.x,
    ARM.mount.y - ARM.shoulder.y,
  );
  const mount = beam(span, ARM.mountBeam);
  mount.position.set(ARM.mount.x, ARM.mount.y, 0);
  mount.rotation.z = Math.atan2(
    ARM.shoulder.y - ARM.mount.y,
    ARM.shoulder.x - ARM.mount.x,
  );
  scene.add(mount);

  // Shoulder: the mount's slice is the wider one and sits behind, so the upper
  // arm's own slice is the face that shows, stepped down inside its rim.
  const shoulderRear = jointSlice(
    ARM.shoulderJoint.rearR,
    ARM.shoulderJoint.rear,
  );
  shoulderRear.position.set(ARM.shoulder.x, ARM.shoulder.y, 0);
  scene.add(shoulderRear);

  // Upper arm: shoulder slice, beam, elbow slice, all one rigid body.
  upper.add(
    jointSlice(
      ARM.shoulderJoint.frontR,
      ARM.shoulderJoint.front,
      ARM.shoulderJoint.ring,
    ),
  );
  upper.add(beam(ARM.upper, ARM.upperBeam));
  const elbowFront = jointSlice(
    ARM.elbowJoint.frontR,
    ARM.elbowJoint.front,
    ARM.elbowJoint.ring,
  );
  elbowFront.position.x = ARM.upper;
  upper.add(elbowFront);
  scene.add(upper);

  // Forearm: the elbow's rear slice and a beam out to the wrist block.
  fore.add(jointSlice(ARM.elbowJoint.rearR, ARM.elbowJoint.rear));
  fore.add(beam(ARM.fore, ARM.foreBeam));
  scene.add(fore);

  // Wrist: the roll actuator, held level whatever the two links are doing. The
  // forearm's beam ends deep inside its block, and the bearing nose steps out
  // of the block's face along the roll axis.
  wrist.add(
    box(
      ARM.wristBlock.l,
      ARM.wristBlock.h,
      ARM.wristBlock.w,
      ARM.wristBlock.x,
      0,
      0,
    ),
  );
  wrist.add(shaft(ARM.noseR, ARM.noseFrom, ARM.noseTo));
  wrist.add(faceRing("x", ARM.noseTo + 0.002, ARM.raceR, 40));
  scene.add(wrist);

  // The hand: a collar turning in the nose, a bolted flange, and a pincer head
  // whose two jaws hinge on one axle and close on the box like tongs. Each jaw
  // is a shank out of the head's side, a knuckle, and a finger reaching
  // forward over the box to a pad. The knuckles reach further from the roll
  // axis than anything else on the hand, and the lift through the flip is
  // sized to that reach so the whole head stays clear of the deck.
  rotor.add(shaft(ARM.collarR, ARM.collarFrom, ARM.collarTo));
  rotor.add(shaft(ARM.flangeR, ARM.flangeFrom, ARM.flangeTo));
  rotor.add(faceRing("x", ARM.flangeTo + 0.002, ARM.flangeRing, 32));
  rotor.add(box(ARM.head.l, ARM.head.h, ARM.head.w, ARM.head.x, 0, 0));

  // The axle both jaws turn on, its heads standing proud of the block top and
  // bottom rather than sunk in it. Both heads, not just the one that shows:
  // they are what make the head symmetric about the roll axis, which is what
  // lets the arm park still turned instead of winding back.
  for (const end of [1, -1]) {
    const lo = Math.min(end * ARM.bossFrom, end * ARM.bossTo);
    const pin = boss(ARM.bossR, lo, lo + (ARM.bossTo - ARM.bossFrom));
    pin.position.x = ARM.hinge;
    rotor.add(pin);
    const cap = faceRing("y", end * (ARM.bossTo + 0.002), ARM.bossRing, 24);
    cap.position.x = ARM.hinge;
    rotor.add(cap);
  }

  const shankA = (ARM.shankAngle * Math.PI) / 180;
  const shankL = (ARM.jawFinger.z - ARM.jawRoot) / Math.sin(shankA);
  const knuckleX = shankL * Math.cos(shankA);
  for (const side of [-1, 1]) {
    const jaw = new THREE.Group();
    jaw.position.set(ARM.hinge, 0, 0);
    jaw.add(
      jawBar(0, side * ARM.jawRoot, side * shankA, shankL, ARM.jawH, ARM.jawT),
    );
    const knuckle = boss(ARM.knuckleR, -ARM.jawH / 2, ARM.jawH / 2);
    knuckle.position.set(knuckleX, 0, side * ARM.jawFinger.z);
    jaw.add(knuckle);
    const len = ARM.jawFinger.to - ARM.jawFinger.from;
    jaw.add(
      box(
        len,
        ARM.jawH,
        ARM.jawT,
        ARM.jawFinger.from + len / 2,
        0,
        side * ARM.jawFinger.z,
      ),
    );
    jaw.add(
      box(
        ARM.jawPad.l,
        ARM.jawPad.h,
        ARM.jawPad.w,
        ARM.jawPad.x,
        0,
        side * ARM.jawPad.z,
      ),
    );
    jaw.userData.side = side;
    rotor.add(jaw);
    jaws.push(jaw);
  }
  scene.add(rotor);

  return {
    parts: { upper, fore, wrist, rotor, jaws },
    apply({ arm }) {
      upper.position.set(ARM.shoulder.x, ARM.shoulder.y, 0);
      upper.rotation.z = arm.base;
      fore.position.set(arm.elbowX, arm.elbowY, 0);
      fore.rotation.z = arm.tip;
      // The roll housing is pinned in the fork but held level, the way a wrist's
      // last joint keeps its tool square however the forearm lies.
      wrist.position.set(arm.x, arm.y, 0);
      rotor.position.set(arm.x, arm.y, 0);
      rotor.rotation.x = arm.roll;
      const open = ARM.pincerOpen * (1 - arm.grip);
      for (const jaw of jaws) jaw.rotation.y = -jaw.userData.side * open;
    },
  };
}
