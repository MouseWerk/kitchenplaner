// Details the washing units share in 3D: machine feet, machine panels with a display and push
// buttons, plastic dish racks, waste bins on castors, wall dispensers, square funnels under a top
// and the bottle trap of a wall basin. All in metres (see kinds/README.md). Housings, control
// panels, displays and rating plates are in parts/details.ts.

import { controlPanel, display } from "../parts/details";
import { BODY_RADIUS, BOWL_RADIUS, castor, DOOR, foot, LEG, PLINTH, SHEET, type MaterialId, type Parts } from "../parts/mesh";

/** Radius of a push button and how far it stands out (m). */
const BUTTON_R = 0.009;
const BUTTON_PROUD = 0.004;
/** Set-back of a kick plate under a machine from its front (m). */
const KICK_SETBACK = 0.05;
/** Wall of a plastic dish rack (m) and its corner radius seen from above. */
const RACK_WALL = 0.006;
const RACK_RADIUS = 0.012;
/** Corner radius of wall dispensers (m). */
const DISPENSER_RADIUS = 0.012;

/**
 * Adjustable feet at the corners of a machine `w` × `d` whose front face is at `zFront`, and the
 * kick plate between them set back from it, up to `top` (m).
 */
export function machineFeet(p: Parts, w: number, d: number, zFront: number, top = PLINTH): void {
  const r = 0.022;
  p.roundedBox("steelDark", -w / 2 + LEG, w / 2 - LEG, 0.012, top, -d / 2 + LEG, zFront - KICK_SETBACK, BODY_RADIUS, "vertical");
  for (const sx of [-1, 1]) for (const z of [-d / 2 + r * 1.5, zFront - r * 1.5]) foot(p, sx * (w / 2 - r * 1.5), z, top, r);
}

/** A round push button at (cx, cy) on a face at `zFace`: a satin collar and a domed cap. */
export function button(p: Parts, cx: number, cy: number, zFace: number, r = BUTTON_R, cap: MaterialId = "knob"): void {
  p.lathe("satin", cx, cy, zFace, [
    [0, 0],
    [r * 1.3, 0],
    [r * 1.3, BUTTON_PROUD * 0.3],
    [r * 1.1, BUTTON_PROUD * 0.5],
    [0, BUTTON_PROUD * 0.5],
  ], { axis: "z" });
  p.lathe(cap, cx, cy, zFace + BUTTON_PROUD * 0.5, [
    [0, 0],
    [r, 0],
    [r, BUTTON_PROUD * 0.3],
    [r * 0.7, BUTTON_PROUD * 0.5],
    [0, BUTTON_PROUD * 0.55],
  ], { axis: "z" });
}

/** A row of `n` push buttons from x0 to x1 at height y on a face at `zFace`. */
export function buttons(p: Parts, x0: number, x1: number, y: number, zFace: number, n: number, r = BUTTON_R): void {
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) button(p, x0 + step * (i + 0.5), y, zFace, r);
}

/**
 * The control panel of a machine from x0 to x1 and y0 to y1 (m): the dark panel from `zBack` to
 * `zFace`, a display at its left and `n` buttons at its right (fewer on a narrow panel).
 */
export function machinePanel(p: Parts, x0: number, x1: number, y0: number, y1: number, zBack: number, zFace: number, n = 3): void {
  controlPanel(p, x0, x1, y0, y1, zBack, zFace);
  const h = y1 - y0;
  const yc = (y0 + y1) / 2;
  const dw = Math.min(0.14, (x1 - x0) * 0.35);
  const dh = Math.min(0.045, h * 0.5);
  display(p, x0 + 0.03 + dw / 2, yc, dw, dh, zFace);
  const room = x1 - x0 - dw - 0.08;
  const k = Math.max(0, Math.min(n, Math.floor(room / 0.035)));
  if (k > 0) buttons(p, x1 - 0.02 - k * 0.035, x1 - 0.02, yc, zFace, k, Math.min(BUTTON_R, h * 0.2));
}

/**
 * A plastic dish rack (500 × 500 as usual) standing at (cx, cz) from `y0`, `size` square and `h`
 * high: the wall turned round its outline with round corners, the open grid of its sides as
 * dark slots on the front and the back.
 */
export function plasticRack(p: Parts, cx: number, cz: number, y0: number, size: number, h: number, mat: MaterialId = "paintGray"): void {
  const half = size / 2 - RACK_RADIUS;
  const t = RACK_WALL;
  p.lathe(mat, cx, y0, cz, [
    [RACK_RADIUS - t, 0],
    [RACK_RADIUS, 0],
    [RACK_RADIUS, h],
    [RACK_RADIUS - t, h],
    [RACK_RADIUS - t, 0],
  ], { rect: [half, half], caps: false });
  // The floor grid seen from above and the openings in the side walls.
  p.box(mat, cx - size / 2 + t, cx + size / 2 - t, y0, y0 + 0.004, cz - size / 2 + t, cz + size / 2 - t);
  const open = Math.min(0.03, h * 0.35);
  if (h > 0.04) {
    for (const z of [cz - size / 2 - 0.0005, cz + size / 2 - 0.0005]) {
      p.plate("slot", cx - size / 2 + 0.04, cx + size / 2 - 0.04, y0 + (h - open) / 2, y0 + (h + open) / 2, z, z + 0.001, open / 2);
    }
  }
}

/**
 * A round waste bin on castors at (cx, cz) from the floor to `top`, `r` at its rim: the turned
 * body narrowing to the bottom with a rolled rim, open at the top, on two castors and two feet.
 */
export function wasteBin(p: Parts, cx: number, cz: number, top: number, r: number, mat: MaterialId = "panelDark"): void {
  const wheel = Math.min(0.03, r * 0.25);
  const y0 = wheel * 2 + 0.005;
  const h = top - y0;
  const lip = Math.min(0.012, r * 0.08);
  p.lathe(mat, cx, y0, cz, [
    [0, 0],
    [r * 0.82 - 0.01, 0],
    [r * 0.84, 0.012],
    [r - lip, h - lip * 2.5],
    [r, h - lip * 2],
    [r, h - lip * 0.5],
    [r - lip * 0.5, h],
    [r - lip * 1.5, h],
    [r - lip * 1.6, h - lip * 2],
    [r * 0.84 - 0.008, 0.03],
    [0, 0.03],
  ]);
  for (const sx of [-1, 1]) castor(p, cx + sx * r * 0.55, cz, wheel, y0);
}

/**
 * A square funnel under a hole in a top (m): a sheet ring round the hole's outline from `y0` up
 * to `y1`, its corners rounded like the hole (`r`).
 */
export function funnel(p: Parts, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, r = BOWL_RADIUS): void {
  const rr = Math.min(r, (x1 - x0) / 2 - 0.001, (z1 - z0) / 2 - 0.001);
  const t = Math.min(SHEET, rr * 0.8);
  // Inside the hole by a hair, so the top's cut edge hides the ring's top.
  const ro = rr - 0.0005;
  p.lathe("steel", (x0 + x1) / 2, y0, (z0 + z1) / 2, [
    [ro - t, 0],
    [ro, 0],
    [ro, y1 - y0],
    [ro - t, y1 - y0],
    [ro - t, 0],
  ], { rect: [(x1 - x0) / 2 - rr, (z1 - z0) / 2 - rr], caps: false });
}

/**
 * A white wall dispenser from x0 to x1 and y0 to y1, from the wall at `zWall` to `zFront` (m):
 * the rounded body, a window showing the fill and a push lever or the outlet under it.
 */
export function wallDispenser(p: Parts, x0: number, x1: number, y0: number, y1: number, zWall: number, zFront: number, kind: "soap" | "towel" | "lever"): void {
  const w = x1 - x0;
  const h = y1 - y0;
  const r = Math.min(DISPENSER_RADIUS, w / 4, (zFront - zWall) / 3);
  p.roundedBox("panel", x0, x1, y0, y1, zWall, zFront, r);
  const cx = (x0 + x1) / 2;
  if (kind === "towel") {
    // The slot the paper comes out of along the bottom and a dark viewing window above.
    p.plate("slot", x0 + w * 0.15, x1 - w * 0.15, y0 + 0.012, y0 + 0.024, zFront - 0.0005, zFront + 0.0005, 0.006);
    p.plate("glassDark", x0 + w * 0.2, x1 - w * 0.2, y1 - h * 0.3, y1 - h * 0.12, zFront - 0.0005, zFront + 0.0015, 0.006, true);
    return;
  }
  p.plate("glass", x0 + w * 0.25, x1 - w * 0.25, y0 + h * 0.4, y1 - h * 0.12, zFront - 0.0005, zFront + 0.0015, 0.008, true);
  if (kind === "soap") {
    // The push plate at the front under the window.
    p.roundedBox("knob", x0 + w * 0.15, x1 - w * 0.15, y0 + h * 0.08, y0 + h * 0.3, zFront - 0.004, zFront + 0.0015, 0.004, "top", "z");
  } else {
    // An elbow lever: a bar from a pivot near the top down along the front.
    p.tube("handle", [
      { x: cx, y: y1 - h * 0.08, z: zFront - 0.004 },
      { x: cx, y: y1 - h * 0.08, z: zFront + 0.012 },
      { x: cx, y: y0 + h * 0.15, z: zFront + 0.012 },
    ], 0.005, { bend: 0.01 });
  }
}

/**
 * The bottle trap under a wall basin (m): the turned trap body under the outlet at (x, z) from
 * `yLow` up to `yFloor`, and its arm back to the wall at `zWall`, low on the trap.
 */
export function bottleTrap(p: Parts, x: number, z: number, yLow: number, yFloor: number, zWall: number, r = 0.022): void {
  const h = yFloor - yLow;
  if (h < 0.04) return;
  p.lathe("satin", x, yLow, z, [
    [0, 0],
    [r * 0.8, 0],
    [r, r * 0.3],
    [r, h * 0.45],
    [r * 0.5, h * 0.55],
    [r * 0.5, h - 0.004],
    [r * 0.7, h - 0.002],
    [r * 0.7, h],
    [0, h],
  ]);
  const ya = yLow + h * 0.35;
  if (z - zWall > 0.02) p.tube("satin", [{ x, y: ya, z: z - r * 0.8 }, { x, y: ya, z: zWall + 0.001 }], r * 0.5);
}

/** The depth of a door leaf as the shared `doors` helper draws it (m). */
export const LEAF = DOOR / 2;
