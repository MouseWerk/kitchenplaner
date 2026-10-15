// Construction shared by the preparation machines of this area: control panels with displays,
// push buttons and pilot lamps, side slots, turned bowls, hand wheels and rollers (m, in the item
// frame as in kinds/README.md). Housings, rating plates and vent slots are in parts/details.ts.

import { arcPoints, type MaterialId, type Parts, type Point2, type ProfilePoint } from "../parts/mesh";

/** Thickness of a control panel standing on a housing's face (m). */
export const PANEL_T = 0.004;

/** A dark control panel on a face at `zFace`, rounded at its front; returns its face (m). */
export function controlPanel(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number): number {
  p.plate("panelDark", x0, x1, y0, y1, zFace, zFace + PANEL_T, Math.min(0.006, (y1 - y0) / 4), true);
  return zFace + PANEL_T;
}

/** A display: tinted glass in a black bezel on a face at `zFace` (m). */
export function displayWindow(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number): void {
  const b = Math.min(0.004, (x1 - x0) / 6, (y1 - y0) / 6);
  p.plate("rubber", x0, x1, y0, y1, zFace, zFace + 0.0015, Math.min(0.004, (y1 - y0) / 4));
  p.plate("glassDark", x0 + b, x1 - b, y0 + b, y1 - b, zFace + 0.0015, zFace + 0.003, Math.min(0.003, (y1 - y0) / 5), true);
}

/**
 * A round push button on a face at `zFace` (m): a satin bezel and a domed cap of radius `r`
 * (`panel` white for start, `knob` black for stop), standing `proud` out of the face.
 */
export function pushButton(p: Parts, x: number, y: number, zFace: number, r: number, cap: MaterialId = "knob", proud = 0.008): void {
  const t = 0.002;
  p.lathe(
    "satin",
    x,
    y,
    zFace,
    [
      [0, 0],
      [r * 1.4, 0],
      [r * 1.4, t * 0.4],
      [r * 1.2, t],
      [0, t],
    ],
    { axis: "z" },
  );
  const h = proud - t;
  p.lathe(
    cap,
    x,
    y,
    zFace + t,
    [
      [0, 0],
      [r, 0],
      [r, h * 0.55],
      [r * 0.85, h * 0.85],
      [r * 0.5, h],
      [0, h],
    ],
    { axis: "z" },
  );
}

/** A pilot lamp on a face at `zFace` (m): a satin bezel with a bright domed lens. */
export function pilotLamp(p: Parts, x: number, y: number, zFace: number, r = 0.006): void {
  p.lathe(
    "satin",
    x,
    y,
    zFace,
    [
      [0, 0],
      [r * 1.5, 0],
      [r * 1.5, 0.002],
      [0, 0.002],
    ],
    { axis: "z" },
  );
  p.lathe(
    "handle",
    x,
    y,
    zFace + 0.002,
    [
      [0, 0],
      [r, 0],
      [r * 0.8, r * 0.5],
      [0, r * 0.7],
    ],
    { axis: "z" },
  );
}

/**
 * Vent slots on a side face at `xFace` (m), facing +x (`dir` 1) or -x: slots along z, stacked in
 * y, let into the face (the `slot` material draws over it), so they never stand out of the unit.
 */
export function sideSlots(p: Parts, xFace: number, dir: 1 | -1, y0: number, y1: number, z0: number, z1: number, n: number): void {
  const pitch = (y1 - y0) / n;
  const t = Math.min(0.008, pitch * 0.5);
  const [a, b] = dir > 0 ? [xFace - 0.001, xFace] : [xFace, xFace + 0.001];
  for (let i = 0; i < n; i++) {
    const y = y0 + pitch * (i + 0.5);
    p.roundedBox("slot", a, b, y - t / 2, y + t / 2, z0, z1, t / 2, "vertical", "x");
  }
}

/**
 * A turned bowl standing at (x, y0, z) (m): radius `r` to its outside, `h` high, open at the top
 * with a rounded rim, the floor meeting the wall in a cove inside and out.
 */
export function turnedBowl(p: Parts, mat: MaterialId, x: number, y0: number, z: number, r: number, h: number, wall = 0.004): void {
  const c = Math.min(r * 0.3, h * 0.3);
  const ci = Math.max(0.002, c - wall);
  const inward = (pts: ProfilePoint[]) => pts.map((q) => [q[0], q[1], -(q[2] ?? 0), -(q[3] ?? 0)] as ProfilePoint);
  p.lathe(mat, x, y0, z, [
    [0, 0, 0, -1],
    ...arcPoints(r - c, c, c, -Math.PI / 2, 0, 3),
    ...arcPoints(r - wall / 2, h - wall / 2, wall / 2, 0, Math.PI, 3),
    ...inward(arcPoints(r - wall - ci, wall + ci, ci, 0, -Math.PI / 2, 3)),
    [0, wall, 0, 1],
  ]);
}

/**
 * A hand wheel turning about the x axis, the middle of its rim at (x, y, z) (m): the rim of
 * radius `r` and round section `rb`, three spokes to the hub, and a grip standing out of the rim
 * towards +x (`dir` 1) or -x.
 */
export function handWheel(p: Parts, x: number, y: number, z: number, r: number, rb: number, dir: 1 | -1): void {
  const steps = 8;
  const section: ProfilePoint[] = Array.from({ length: steps + 1 }, (_, k) => {
    const a = -Math.PI + (k / steps) * Math.PI * 2;
    return [r - rb + rb * Math.cos(a), rb + rb * Math.sin(a), Math.cos(a), Math.sin(a)];
  });
  // Lathe heights grow along +x: the rim reaches from x - rb to x + rb.
  p.lathe("handle", x - rb, y, z, section, { axis: "x" });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    p.bar("handle", { x, y, z }, { x, y: y + (r - rb) * Math.sin(a), z: z + (r - rb) * Math.cos(a) }, rb * 0.5);
  }
  p.rod("handle", "x", x, y, z, rb * 4, rb * 1.4);
  p.rod("knob", "x", x + dir * 0.025, y + r - rb, z, 0.05, rb * 1.1);
}

/**
 * The open top of a housing from y0 to y1 (m), for a tub or chamber let into it: the housing's
 * walls round the box (`wall` thick, their outer corners rounded) and a deck at the top with the
 * opening `hole` cut out. The housing below is built up to y0 by the caller.
 */
export function openTop(p: Parts, mat: MaterialId, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, hole: readonly Point2[], wall = 0.012): void {
  const hx = (x1 - x0) / 2 - wall;
  const hz = (z1 - z0) / 2 - wall;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  p.lathe(
    mat,
    cx,
    y0,
    cz,
    [
      [0, 0],
      [wall, 0],
      [wall, y1 - y0],
      [0, y1 - y0],
      [0, 0],
    ],
    { rect: [hx, hz] },
  );
  p.extrude(
    mat,
    "y",
    y1 - DECK,
    y1,
    [
      [cx - hx, cz - hz],
      [cx + hx, cz - hz],
      [cx + hx, cz + hz],
      [cx - hx, cz + hz],
    ],
    [hole],
  );
}

/** Thickness of the deck of an `openTop` (m). */
const DECK = 0.01;
