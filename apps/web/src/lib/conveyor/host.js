/*
  Everything between the drawing and the page: the canvas, the clock, and the
  four things the browser has an opinion about — how big the element is, how
  dense its pixels are, whether the reader wants motion at all, and which way
  round the page's colours are.

  Nothing here knows what is being drawn, so a second animation can be hung off
  it unchanged.
*/
import * as THREE from "three";

import { CONFIG } from "./config.js";
import { mod } from "./math.js";
import { setResolution, setTheme } from "./materials.js";
import { frameCamera } from "./view.js";

/*
  A CSS colour as an sRGB number. The page states its colours in `oklch`, which
  three's parser does not read, so the browser is asked to do it: painting the
  colour onto a canvas and reading the pixel back works for any colour CSS can
  express, however it was written.
*/
const swatch = document.createElement("canvas").getContext("2d", {
  willReadFrequently: true,
});
function resolve(colour, fallback) {
  if (!colour) return fallback;
  swatch.fillStyle = "#000";
  swatch.fillStyle = colour.trim();
  swatch.fillRect(0, 0, 1, 1);
  const [r, g, b] = swatch.getImageData(0, 0, 1, 1).data;
  return (r << 16) | (g << 8) | b;
}

/*
  `update(t)` draws the frame at loop time t; `loop` is how long a pass takes;
  `still` is the frame to hold when motion is turned off.
*/
export function host(container, { scene, camera, update, loop, still, place }) {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  // The buffer is sized in device pixels below and the element is left to fill
  // whatever it was dropped into. Without this the canvas lays out at its own
  // buffer size, which on a dense display is twice the box it is sitting in.
  Object.assign(renderer.domElement.style, {
    display: "block",
    width: "100%",
    height: "100%",
  });
  container.appendChild(renderer.domElement);

  // The drawing takes the colours of whatever it has been dropped into, read
  // off the container itself so it follows the card it sits in rather than the
  // page behind it.
  let ground = CONFIG.ground;
  function repaint() {
    const style = getComputedStyle(container);
    ground = resolve(style.getPropertyValue("--card"), CONFIG.ground);
    const ink = resolve(
      style.getPropertyValue("--card-foreground"),
      CONFIG.ink,
    );
    const rule = resolve(style.getPropertyValue("--border"), CONFIG.rule);
    setTheme(ground, ink, rule);
    renderer.setClearColor(ground, 1);
    scene.background = new THREE.Color(ground);
  }
  repaint();

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
    const width = Math.max(1, Math.round(container.clientWidth));
    const height = Math.max(1, Math.round(container.clientHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    // How large the drawing is rendered, against the size its line weights were
    // chosen at: the frame's own height in pixels over the world height it
    // covers, which `zoom` is what changes.
    const weight = height / (CONFIG.weighedAt * (place?.zoom ?? 1));
    setResolution(width * dpr, height * dpr, dpr, weight);
    frameCamera(width / height, place);
    if (!running) {
      update(reducedMotion ? still : elapsed % loop);
      render();
    }
  }
  const sizing = new ResizeObserver(resize);
  sizing.observe(container);
  resize();

  // The theme is a class on the document, so the drawing repaints when that
  // changes rather than being read once at mount.
  const theming = new MutationObserver(() => {
    repaint();
    if (!running) render();
  });
  theming.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  let watching = null;
  if (reducedMotion) {
    update(still);
    render();
  } else {
    // Only run while it is on screen.
    watching = new IntersectionObserver((entries) => {
      entries.some((e) => e.isIntersecting) ? start() : stop();
    });
    watching.observe(container);
  }

  // The page can take the drawing away again — an island unmounts, a route
  // changes — and a WebGL context that nothing drops is one the browser keeps
  // until it runs out and starts discarding them.
  function destroy() {
    stop();
    sizing.disconnect();
    theming.disconnect();
    watching?.disconnect();
    renderer.domElement.remove();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { renderer, seek, start, stop, destroy };
}
