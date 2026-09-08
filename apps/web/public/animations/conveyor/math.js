/*
  Scalar helpers. Pure functions of their arguments, with no Three.js and no
  scene state, so the curves the whole animation is built from can be checked
  in isolation.
*/
import { CONFIG } from "./config.js";

export const mod = (a, n) => ((a % n) + n) % n;
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const clamp01 = (x) => clamp(x, 0, 1);
export const easeInOut = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const smooth = (x) => {
  x = clamp01(x);
  return x * x * (3 - 2 * x);
};
// Smoothstep leaves a jump in acceleration at each end. The arm's own moves
// start and stop from rest, where that jump reads as a flinch, so they use a
// curve whose first and second derivatives both vanish at both ends.
export const glide = (x) => {
  x = clamp01(x);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

// A body dropped from `height` above where it comes to rest: free fall, then a
// bounce to a fraction of its height each time until it stops. Both phases are
// closed form, so the whole settle is a pure function of the time since it was
// let go and can be read off at any point in the loop without integrating up
// to it, which is what keeps the scene seekable and the loop seamless.
export function settle(height, t) {
  const g = CONFIG.gravity;
  if (height <= 0) return 0;
  if (t <= 0) return height;
  const first = Math.sqrt((2 * height) / g);
  if (t < first) return height - 0.5 * g * t * t;
  let tau = t - first;
  let v = Math.sqrt(2 * g * height) * CONFIG.restitution;
  while (v > 0.02) {
    const span = (2 * v) / g;
    if (tau < span) {
      const s = tau - span / 2;
      return (v * v) / (2 * g) - 0.5 * g * s * s;
    }
    tau -= span;
    v *= CONFIG.restitution;
  }
  return 0;
}
// How long that takes, so schedules are sized from the drop rather than the
// drop being cut to fit a schedule.
export function settleTime(height) {
  const g = CONFIG.gravity;
  if (height <= 0) return 0;
  let t = Math.sqrt((2 * height) / g);
  let v = Math.sqrt(2 * g * height) * CONFIG.restitution;
  while (v > 0.02) {
    t += (2 * v) / g;
    v *= CONFIG.restitution;
  }
  return t;
}
