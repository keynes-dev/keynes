/*
  The refill start is measured in the camera that will actually draw the
  frame. Framing after that measurement is what used to put a charge on screen
  on a tall layout.
*/
import * as THREE from "three";
import { afterEach, describe as suite, expect, it } from "vitest";

import { CONFIG } from "./config.js";
import { TUBES } from "./timeline.js";
import { camera, frameCamera, skyOffset } from "./view.js";

function skyFor(place) {
  frameCamera(1, place);
  return TUBES.map((tube) =>
    skyOffset(new THREE.Vector3(0, tube.topY, tube.z)),
  );
}

afterEach(() => {
  frameCamera(1);
});

suite("skyOffset", () => {
  it("starts each refill above the framed window, not the default one", () => {
    const below = skyFor(CONFIG.below);
    for (const [i, tube] of TUBES.entries()) {
      const start = new THREE.Vector3(0, tube.topY + below[i], tube.z);
      expect(start.project(camera).y).toBeGreaterThanOrEqual(
        CONFIG.skyMargin - 1e-6,
      );
    }
  });

  it("has to start further out once a tall frame zooms the camera out", () => {
    const unframed = skyFor({});
    const below = skyFor(CONFIG.below);
    for (let i = 0; i < below.length; i++) {
      expect(below[i]).toBeGreaterThan(unframed[i]);
    }
  });
});
