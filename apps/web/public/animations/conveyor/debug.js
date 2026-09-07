/*
  An opt-in overlay, loaded only for ?debug. It watches every frame for the
  three things that would make the drawing wrong — the module loaded twice, a
  tube showing more than it holds, or a stack standing inside itself — and the
  moment it sees one it stops the clock and prints the frame, so the fault can
  be read off the screen instead of caught in passing.

  `objects` should never move off its startup value: the item pools are built
  once and only shown or hidden after that.
*/
import { CONFIG, SHAPES } from "./config.js";

export function hud(scene, timeline, controls) {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;left:8px;top:8px;z-index:99;font:11px/1.45 ui-monospace,monospace;" +
    "background:#fff;border:1px solid #111;padding:6px 8px;white-space:pre;color:#111;max-width:60vw";
  document.body.appendChild(el);

  let built = null;
  let frames = 0;
  const t0 = performance.now();

  const tick = () => {
    frames++;
    let objects = 0;
    const seen = SHAPES.map(() => []);
    scene.traverse((o) => {
      if (!o.userData || o.userData.shape === undefined) return;
      objects++;
      if (o.visible) seen[o.userData.shape].push(o.position.y);
    });
    if (built === null) built = objects;

    const faults = [];
    if (objects !== built) faults.push(`objects ${built} -> ${objects}: module loaded twice`);
    const canvases = document.querySelectorAll("#scene canvas").length;
    if (canvases !== 1) faults.push(`${canvases} canvases: page mounted twice`);

    const lines = [
      `build   loop ${timeline.loop.toFixed(2)}s, ${timeline.cycles.length} beats, ${objects} objects, ${canvases} canvas`,
      `clock   t=${timeline.frame.t.toFixed(2)}  beat ${timeline.frame.index}  ${frames} frames in ${((performance.now() - t0) / 1000).toFixed(0)}s`,
    ];
    SHAPES.forEach((shape, index) => {
      const ys = seen[index].sort((a, b) => a - b);
      let worst = Infinity;
      for (let i = 1; i < ys.length; i++) worst = Math.min(worst, ys[i] - ys[i - 1]);
      const gap = ys.length < 2 ? "  —  " : worst.toFixed(3);
      lines.push(`${shape.name.padEnd(12)} ${ys.length} shown  gap ${gap}  y ${ys.map((y) => y.toFixed(2)).join(" ")}`);
      if (ys.length > CONFIG.tubeCapacity + CONFIG.itemsPerDrop) faults.push(`${shape.name}: ${ys.length} visible at once`);
      if (ys.length > 1 && worst < shape.height - 1e-9) faults.push(`${shape.name}: shapes ${worst.toFixed(3)} apart, ${shape.height.toFixed(3)} tall — INSIDE EACH OTHER`);
    });

    if (faults.length) {
      controls.stop();
      el.style.borderColor = "#e3262e";
      el.style.borderWidth = "2px";
      lines.push("", "FROZEN — fault caught:", ...faults.map((f) => "  " + f), "", "screenshot this box");
      el.textContent = lines.join("\n");
      return;
    }
    el.textContent = lines.join("\n");
    requestAnimationFrame(tick);
  };
  tick();
}
