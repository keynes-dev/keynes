/*
  The machine itself: the manifold every duct drains into, the nozzle it
  dispenses from, and the verdict lamp bolted to its front.
*/
import * as THREE from "three";

import { MACHINE } from "../config.js";
import {
  addRun,
  barrel,
  box,
  segments,
  solid,
  sphereSilhouette,
  thin,
} from "../draft.js";
import { fineMat, lampMat, white } from "../materials.js";
import { VIEW } from "../view.js";

/*
  The verdict lamp: a bulb screwed into a keyless socket. No screw base is
  drawn, because a bulb that is screwed in has none showing — it is up inside
  the cup — and a thread at this size collapses into a dark smudge however it
  is drawn.

  The glass flares out of the cup rather than pinching in behind a ball, which
  is what makes a bulb read as a bulb rather than as a knob on a stem. Both of
  the flare's rims are buried, the inner inside the cup and the outer inside
  the ball, so neither draws a ring across the glass. The ball is a true sphere
  rather than a lathed tier, like every other round part here: a lathed profile
  is straight-line tiers and never yields a true silhouette circle.
*/
function verdictLamp() {
  const g = new THREE.Group();
  const plateEnd = MACHINE.lampPlateT;
  const cupEnd = plateEnd + MACHINE.lampCupLen;
  // Hairline weight, like the bolts and duct ribs: line weight is in screen
  // pixels and does not shrink with the part, so at this size the plate's rim,
  // the cup's rim and its silhouette close into one dark knot at full weight.
  g.add(
    thin(
      barrel("x", 0, plateEnd, MACHINE.lampPlateR, MACHINE.lampPlateR, {
        radial: 32,
      }),
    ),
  );
  g.add(
    thin(
      barrel("x", plateEnd, cupEnd, MACHINE.lampCupR, MACHINE.lampCupR, {
        radial: 32,
      }),
    ),
  );

  const centre = cupEnd + MACHINE.lampRise;
  // The flare stops half a radius short of the ball's centre, where the ball
  // stands wider than the shoulder does, so it finishes inside the glass; it
  // starts back in the middle of the cup, so it finishes inside that too.
  const shoulderEnd = centre - MACHINE.lampGlobeR / 2;
  g.add(
    barrel(
      "x",
      cupEnd - MACHINE.lampCupLen / 2,
      shoulderEnd,
      MACHINE.lampGlassR,
      MACHINE.lampShoulder,
      { radial: 32, material: lampMat },
    ),
  );

  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(MACHINE.lampGlobeR, 24, 16),
    lampMat,
  );
  glass.position.x = centre;
  g.add(glass);
  g.add(sphereSilhouette(MACHINE.lampGlobeR, new THREE.Vector3(centre, 0, 0)));
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
  const collar = solid(
    new THREE.CylinderGeometry(
      MACHINE.nozzleR0 + 0.05,
      MACHINE.nozzleR0 + 0.05,
      0.1,
      32,
    ),
    white,
    30,
  );
  collar.position.y = height / 2 + 0.05;
  nozzle.add(collar);

  // Local y runs from the mouth at the bottom to the throat at the top, and the
  // radius flares faster than a straight cone would, so the wall reads curved.
  const bellY = (t) => height / 2 - t * height;
  const bellR = (t) =>
    MACHINE.nozzleR1 +
    (MACHINE.nozzleR0 - MACHINE.nozzleR1) * Math.pow(t, MACHINE.nozzleFlare);
  const tier = (y0, r0, y1, r1) => barrel("y", y0, y1, r0, r1);
  for (let k = 0; k < MACHINE.nozzleTiers; k++) {
    const t0 = k / MACHINE.nozzleTiers,
      t1 = (k + 1) / MACHINE.nozzleTiers;
    nozzle.add(tier(bellY(t1), bellR(t1), bellY(t0), bellR(t0)));
    if (k === MACHINE.nozzleTiers - 1) continue;
    // The ribs and the lip are detail on the bell, not the bell's own outline,
    // so they are drawn at hairline weight: at structural weight their rim
    // circles read as heavy as the profile and the whole thing bands up.
    const r = bellR(t1) + MACHINE.nozzleRibR;
    nozzle.add(
      thin(
        tier(
          bellY(t1) - MACHINE.nozzleRibH / 2,
          r,
          bellY(t1) + MACHINE.nozzleRibH / 2,
          r,
        ),
      ),
    );
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
export function createMachine(scene) {
  const m = MACHINE.manifold;
  scene.add(
    box(MACHINE.manifoldW, MACHINE.manifoldH, MACHINE.manifoldD, m.x, m.y, m.z),
  );
  const nozzle = bell();
  scene.add(nozzle);
  // The lamp seats on the manifold's front face, let a little into it so the
  // two are not coplanar and fighting over the same pixels. A bolted flange,
  // the joint every duct fitting uses, crowds its bolt heads into a smudge at
  // this radius.
  const lamp = verdictLamp();
  lamp.position.set(MACHINE.manifoldW / 2 - 0.01, m.y, m.z);
  scene.add(lamp);

  return {
    apply({ pulse, lamp: colour }) {
      // The nozzle swells as each shape is spat out of it.
      nozzle.scale.set(1 + 0.12 * pulse, 1, 1 + 0.12 * pulse);
      lampMat.color.set(colour);
    },
  };
}
