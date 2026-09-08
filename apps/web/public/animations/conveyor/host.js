/*
  Everything between the drawing and the page: the canvas, the clock, and the
  three things the browser has an opinion about — how big the element is, how
  dense its pixels are, and whether the reader wants motion at all.

  Nothing here knows what is being drawn, so a second animation can be hung off
  it unchanged.
*/
import * as THREE from "three";

import { CONFIG } from "./config.js";
import { mod } from "./math.js";
import { setResolution } from "./materials.js";

/*
  `update(t)` draws the frame at loop time t; `loop` is how long a pass takes;
  `still` is the frame to hold when motion is turned off.
*/
export function host(container, { scene, camera, update, loop, still }) {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0xffffff, 1);
  container.appendChild(renderer.domElement);

  let running = false,
    last = 0,
    elapsed = 0;
  const render = () => renderer.render(scene, camera);

  function frame(now) {
    if (!running) return;
    elapsed += Math.min(now - last, 100) / 1000;
    last = now;
    update(elapsed % loop);
    render();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || reducedMotion) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
  }
  function seek(t) {
    stop();
    elapsed = t;
    update(mod(t, loop));
    render();
  }

  function resize() {
    const size = Math.max(1, Math.round(container.clientWidth));
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio);
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
    setResolution(size * dpr, size * dpr, dpr);
    if (!running) {
      update(reducedMotion ? still : elapsed % loop);
      render();
    }
  }
  new ResizeObserver(resize).observe(container);
  resize();

  if (reducedMotion) {
    update(still);
    render();
  } else {
    // Only run while it is on screen.
    new IntersectionObserver((entries) => {
      entries.some((e) => e.isIntersecting) ? start() : stop();
    }).observe(container);
  }

  return { renderer, seek, start, stop };
}
