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
  A CSS colour as an sRGB number, or null if it is not a colour or is wholly
  transparent — which is what an element with no background of its own computes
  to, and so how the caller tells "nothing said" from "said black".

  The page states its colours in `oklch`, which three's parser does not read, so
  the browser is asked to do it: painting the colour onto a canvas and reading
  the pixel back works for any colour CSS can express, however it was written.

  A colour given with alpha is laid over `over` — the theme's `--border` in the
  dark is white at a tenth, and means the tenth of white the card behind shows
  through as, not white. Alpha needs a backdrop to mean anything, and the swatch
  is one pixel reused, so without one such a colour composites over whatever was
  last resolved on it and comes out near enough that.

  The swatch is made on first use rather than at import, so that nothing here
  runs a `document` call merely because this module was named in an import: the
  drawing is only ever reached through a dynamic import from the browser today,
  but a static one from a server-rendered module is an easy thing to write by
  accident and should fail on the missing canvas, not on the import.
*/
let swatch;
function paint(colour, over) {
  if (!colour) return null;
  swatch ??= document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  swatch.clearRect(0, 0, 1, 1);
  // Setting an unreadable colour leaves the previous one standing, so the
  // fully transparent one before it is what an unusable value falls back to.
  swatch.fillStyle = "rgba(0, 0, 0, 0)";
  swatch.fillStyle = colour.trim();
  swatch.fillRect(0, 0, 1, 1);
  const alpha = swatch.getImageData(0, 0, 1, 1).data[3];
  if (!alpha) return null;
  if (alpha < 255) {
    // Behind what is already there, which is what sitting on the ground means.
    swatch.globalCompositeOperation = "destination-over";
    swatch.fillStyle = `#${(over ?? CONFIG.ground).toString(16).padStart(6, "0")}`;
    swatch.fillRect(0, 0, 1, 1);
    swatch.globalCompositeOperation = "source-over";
  }
  const [r, g, b] = swatch.getImageData(0, 0, 1, 1).data;
  return (r << 16) | (g << 8) | b;
}

/*
  `update(t)` draws the frame at loop time t; `loop` is how long a pass takes;
  `still` is the frame to hold when motion is turned off.

  `place` is where the machine stands in the frame, either fixed or a function
  asked again on every resize. It is asked inside `resize` rather than read once
  here because the placement can change with the shape of the element — see
  `config.js`'s `choosePlace` — and because its `zoom` sets the line weight as
  well as the framing, so a placement resolved for only one of the two draws the
  right camera in the wrong strokes.
*/
export function host(container, { scene, camera, update, loop, still, place }) {
  // Followed rather than read once: a reader who turns motion off does so to
  // stop something already moving, and waiting for a reload to honour that is
  // most of the way to not honouring it.
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = motionQuery.matches;
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

  /*
    The drawing is drawn in the element's own colours, so it takes them the way
    anything else on the page does and can be told them the same way — a utility
    class, a style, a variant — rather than through a vocabulary of its own:

      ground  the element's `background-color`, falling back to `--card`
      ink     its `color`, which it inherits like any text
      rule    its `border-color`, which this app's base layer sets to `--border`

    Ink inheriting is the useful part and the reason it is `color` rather than a
    property of our own: the drawing comes out in the ink of whatever it was put
    in without being told, exactly as an icon drawn in `currentColor` does, and
    saying otherwise is one class. Nothing is read from the page itself, so a
    conveyor in a card follows the card.
  */
  let ground = CONFIG.ground;
  function repaint() {
    const style = getComputedStyle(container);
    ground =
      paint(style.backgroundColor) ??
      paint(style.getPropertyValue("--card")) ??
      CONFIG.ground;
    const ink = paint(style.color, ground) ?? CONFIG.ink;
    const rule = paint(style.borderTopColor, ground) ?? CONFIG.rule;
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
    // Both of the next two depend on this, so it is resolved once here rather
    // than asked for twice: they would otherwise be free to disagree.
    const standing = typeof place === "function" ? place() : place;
    // How large the drawing is rendered, against the size its line weights were
    // chosen at: the frame's own height in pixels over the world height it
    // covers, which `zoom` is what changes.
    const weight = height / (CONFIG.weighedAt * (standing?.zoom ?? 1));
    setResolution(width * dpr, height * dpr, dpr, weight);
    frameCamera(width / height, standing);
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

  // Only run while it is on screen — and only watch for that while motion is
  // wanted at all, since with it turned off there is never anything to pause.
  let watching = null;
  function watch() {
    if (watching) return;
    watching = new IntersectionObserver((entries) => {
      entries.some((e) => e.isIntersecting) ? start() : stop();
    });
    // The observer reports where the element is as soon as it is given one, so
    // this is also what starts the drawing.
    watching.observe(container);
  }
  function unwatch() {
    watching?.disconnect();
    watching = null;
  }

  /*
    Hold the one still frame, or go back to running when on screen. Called for
    the setting the reader arrives with and again whenever they change it, so
    the two directions cannot drift apart: turning motion off has to stop a
    loop that is already going and leave something drawn behind it, and turning
    it back on has to pick the loop up where it was left.
  */
  function settle() {
    if (!reducedMotion) return watch();
    unwatch();
    stop();
    update(still);
    render();
  }
  settle();
  const followMotion = (event) => {
    reducedMotion = event.matches;
    settle();
  };
  motionQuery.addEventListener("change", followMotion);

  // The page can take the drawing away again — an element is removed, a route
  // changes — and a WebGL context that nothing drops is one the browser keeps
  // until it runs out and starts discarding them.
  //
  // Dropping the context releases what the scene holds on the GPU, and the
  // geometries go with the scene once the caller lets go of it. Nothing here
  // walks the scene disposing them, and nothing should dispose the materials at
  // all: those are the module's, shared with whatever is drawn next.
  function destroy() {
    stop();
    sizing.disconnect();
    theming.disconnect();
    motionQuery.removeEventListener("change", followMotion);
    unwatch();
    renderer.domElement.remove();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { renderer, seek, start, stop, destroy };
}
