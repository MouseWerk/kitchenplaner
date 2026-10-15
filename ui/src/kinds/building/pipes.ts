// Pipework of the building elements: flanged pipes, angle valves, valve levers and manhole
// covers, all turned or bent (`lathe`, `tube`).

import type { Parts } from "../parts/mesh";

/**
 * A horizontal pipe along x from `xEnd` (its open end) to `xWall` (the face it leaves), its axis
 * at (y, z), radius `r`: the pipe with a flange where it meets the face and a socket at its end.
 */
export function flangedPipe(p: Parts, xEnd: number, xWall: number, y: number, z: number, r: number): void {
  const dir = Math.sign(xEnd - xWall);
  const len = Math.abs(xEnd - xWall);
  const x0 = Math.min(xEnd, xWall);
  p.lathe(
    "panelDark",
    x0,
    y,
    z,
    dir > 0
      ? [[0, 0], [r * 1.4, 0], [r * 1.4, 0.012], [r, 0.014], [r, len - 0.03], [r * 1.12, len - 0.026], [r * 1.12, len], [0, len]]
      : [[0, 0], [r * 1.12, 0], [r * 1.12, 0.026], [r, 0.03], [r, len - 0.014], [r * 1.4, len - 0.012], [r * 1.4, len], [0, len]],
    { axis: "x" },
  );
}

/**
 * A round manhole cover lying on a top at `y` round (x, z): a cast frame ring, the cover with a
 * raised rim and a recessed lifting handle, `h` high in all, radius `r`.
 */
export function manholeCover(p: Parts, x: number, y: number, z: number, r: number, h: number): void {
  p.lathe("steelDark", x, y, z, [
    [0, 0],
    [r, 0],
    [r, h * 0.35],
    [r * 0.94, h * 0.45],
    [r * 0.9, h * 0.6],
    [r * 0.86, h * 0.6],
    [r * 0.84, h * 0.5],
    [0, h * 0.5],
  ]);
  p.lathe("satin", x, y + h * 0.5, z, [
    [0, 0],
    [r * 0.83, 0],
    [r * 0.83, h * 0.15],
    [r * 0.8, h * 0.2],
    [0, h * 0.2],
  ]);
  // The lifting handle: a bent bar standing in the middle, its top at y + h.
  const hw = Math.min(r * 0.5, 0.08);
  p.tube("handle", [
    { x: x - hw, y: y + h * 0.6, z },
    { x: x - hw, y: y + h - 0.008, z },
    { x: x + hw, y: y + h - 0.008, z },
    { x: x + hw, y: y + h * 0.6, z },
  ], 0.008, { bend: 0.012 });
}

/**
 * A valve lever pointing up from a valve stem at (x, y), standing out of a face at `zFace` to
 * `zFront`, `len` long: a turned stem nut and a flat grip with a plastic sleeve.
 */
export function valveLever(p: Parts, x: number, y: number, zFace: number, zFront: number, len: number): void {
  const d = zFront - zFace;
  p.lathe("satin", x, y, zFace, [[0, 0], [0.012, 0], [0.012, d * 0.5], [0.009, d * 0.6], [0, d * 0.6]], { axis: "z" });
  p.tube("knob", [
    { x, y: y + 0.01, z: zFront - 0.007 },
    { x, y: y + len, z: zFront - 0.007 },
  ], 0.007);
}

/**
 * An angle valve (Eckventil) out of a face at `zFace` reaching `zFront`, its body's axis at
 * (x, y), radius `r`: the turned body with its wall rosette, the outlet bent down and the
 * handle wheel at the front, its cap marked cold (dark) or hot (bright).
 */
export function angleValve(p: Parts, x: number, y: number, zFace: number, zFront: number, r: number, which: "cold" | "hot"): void {
  const d = zFront - zFace;
  p.lathe("handle", x, y, zFace - 0.001, [
    [0, 0],
    [r * 2, 0],
    [r * 2, 0.002],
    [r * 1.2, 0.006],
    [r * 0.8, 0.008],
    [r * 0.8, d * 0.3],
    [r, d * 0.35],
    [r, d * 0.7],
    [r * 0.6, d * 0.75],
    [0, d * 0.75],
  ], { axis: "z" });
  // The outlet bends down to the hose.
  p.tube("handle", [
    { x, y, z: zFace + d * 0.55 },
    { x, y: y - 0.05, z: zFace + d * 0.55 },
  ], r * 0.55);
  // The handle: a turned wheel with a coloured cap.
  p.lathe("knob", x, y, zFace + d * 0.75, [
    [0, 0],
    [r * 1.3, 0],
    [r * 1.5, d * 0.08],
    [r * 1.5, d * 0.2],
    [r * 1.2, d * 0.25],
    [0, d * 0.25],
  ], { axis: "z" });
  p.lathe(which === "hot" ? "signalRed" : "signalBlue", x, y, zFront - 0.0015, [[0, 0], [r * 0.6, 0], [r * 0.5, 0.0015], [0, 0.0015]], { axis: "z" });
}
