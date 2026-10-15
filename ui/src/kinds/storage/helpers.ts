// Helpers the storage units share: pressed shelves with folded edges, round posts with their
// feet and caps, slanted struts (bracing, brackets), pressed trays and crates, and the plates,
// pots and bottles that stand in the racks. Castors and feet come from parts/mesh.ts.

import { arcPoints, BODY_RADIUS, roundSteps, TOP_RADIUS, type MaterialId, type Parts, type ProfilePoint } from "../parts/mesh";

/** Height of a shelf's folded edge (m). */
export const LIP = 0.03;
/** Sheet thickness of a shelf as drawn (m). */
const DECK = 0.006;
/** Corner radius of a pressed shelf seen from above (m). */
const SHELF_CORNER = 0.008;
/** Pitch of the slats of a slatted shelf (m). */
const PITCH = 0.06;
/** Perforated shelf: distance of the slot rows and of the slots in a row, slot width (m). */
const HOLE_ROW = 0.14;
const HOLE_COL = 0.25;
const HOLE = 0.02;
/** Radius of a round shelving post (25 mm tube) and the height of its foot and cap (m). */
export const POST_R = 0.0125;
const POST_FOOT = 0.025;
const POST_CAP = 0.012;

/** What a shelf is made of: solid sheet, perforated sheet (slotted) or open slats. */
export type Deck = "solid" | "perforated" | "slatted";

/**
 * A round strut from point `a` to point `b` (metres, item frame): cross bracing and bracket
 * struts. Its round section reaches `r` past the line, so keep the ends that far inside the box.
 */
export function strut(p: Parts, mat: MaterialId, a: readonly [number, number, number], b: readonly [number, number, number], r: number): void {
  p.bar(mat, { x: a[0], y: a[1], z: a[2] }, { x: b[0], y: b[1], z: b[2] }, r);
}

/**
 * A tray pressed from one sheet and laid upside down, filling the box: a deck on top with a
 * rolled outer edge and its sides folded down by the box's height, open below (a shelf, a lid,
 * a drip tray turned over). `wall` is the sheet, `r` the corner radius seen from above.
 */
export function invertedTray(p: Parts, mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, wall = DECK, r = SHELF_CORNER): void {
  const h = y1 - y0;
  const rc = Math.max(Math.min(r, (x1 - x0) / 2, (z1 - z0) / 2), wall * 1.5);
  const e = Math.min(TOP_RADIUS, wall * 0.8, h / 3);
  const profile: ProfilePoint[] = [
    [0, h - wall],
    [rc - wall, h - wall],
    [rc - wall, 0],
    [rc, 0],
    [rc, h - e],
    ...arcPoints(rc - e, h - e, e, 0, Math.PI / 2, roundSteps(e)),
    [0, h],
  ];
  p.lathe(mat, (x0 + x1) / 2, y0, (z0 + z1) / 2, profile, { rect: [(x1 - x0) / 2 - rc, (z1 - z0) / 2 - rc] });
}

/** One shelf from x0 to x1 and z0 to z1, its lower edge at y: the deck and its folded edges. */
export function shelf(p: Parts, deck: Deck, x0: number, x1: number, z0: number, z1: number, y: number, mat: MaterialId = "steel") {
  const top = y + LIP;
  if (deck !== "slatted") {
    invertedTray(p, mat, x0, x1, y, top, z0, z1);
    if (deck === "solid") return;
    // A closed sheet punched with staggered rows of short slots: dark marks in the deck's face
    // (the `slot` material draws over the face it shares), never the open slats of alu shelving.
    const inner0 = z0 + DECK * 2;
    const inner1 = z1 - DECK * 2;
    const rows = Math.max(2, Math.round((inner1 - inner0) / HOLE_ROW));
    const rowPitch = (inner1 - inner0) / rows;
    const cols = Math.max(2, Math.round((x1 - x0) / HOLE_COL));
    const colPitch = (x1 - x0 - 4 * DECK) / cols;
    for (let r = 0; r < rows; r++) {
      const zc = inner0 + rowPitch * (r + 0.5);
      // Every other row is shifted by half a slot pitch and has one slot less.
      const shift = r % 2 === 1 ? colPitch / 2 : 0;
      const n = r % 2 === 1 ? cols - 1 : cols;
      for (let c = 0; c < n; c++) {
        const xc = x0 + 2 * DECK + colPitch * (c + 0.5) + shift;
        p.roundedBox("slot", xc - colPitch * 0.3, xc + colPitch * 0.3, top - 0.002, top, zc - HOLE / 2, zc + HOLE / 2, HOLE / 2, "vertical");
      }
    }
    return;
  }
  // A frame of two side rails and a front and a back profile, open slats between them.
  const rail = 0.02;
  p.roundedBox(mat, x0, x0 + rail, y, top, z0, z1, BODY_RADIUS);
  p.roundedBox(mat, x1 - rail, x1, y, top, z0, z1, BODY_RADIUS);
  for (const [a, b] of [
    [z0, z0 + rail],
    [z1 - rail, z1],
  ]) {
    p.roundedBox(mat, x0 + rail, x1 - rail, y, top, a, b, BODY_RADIUS);
  }
  const inner0 = z0 + rail;
  const inner1 = z1 - rail;
  const n = Math.max(2, Math.round((inner1 - inner0) / PITCH));
  const pitch = (inner1 - inner0) / n;
  for (let i = 0; i < n; i++) {
    const zc = inner0 + pitch * (i + 0.5);
    p.roundedBox(mat, x0 + rail, x1 - rail, top - 0.012, top - 0.001, zc - pitch / 3, zc + pitch / 3, BODY_RADIUS, "top");
  }
}

/**
 * A round shelving post standing at (x, z) from `y0` up to `h`: a turned plastic foot with a levelling
 * pad (1.2 `r` round, the widest part), the tube, and a domed cap at the top.
 */
export function roundPost(p: Parts, mat: MaterialId, x: number, z: number, h: number, r = POST_R, y0 = 0): void {
  p.lathe("knob", x, y0, z, [
    [0, 0],
    [r * 1.1, 0],
    [r * 1.2, POST_FOOT * 0.25],
    [r * 1.12, POST_FOOT * 0.5],
    [r * 1.02, POST_FOOT],
    [0, POST_FOOT],
  ]);
  p.rod(mat, "y", x, (y0 + POST_FOOT + h - POST_CAP) / 2, z, h - POST_CAP - POST_FOOT - y0, r);
  p.lathe("knob", x, h - POST_CAP, z, [[0, 0], [r * 1.02, 0], [r * 1.02, POST_CAP * 0.4], ...arcPoints(r * 0.4, POST_CAP * 0.4, Math.min(r * 0.62, POST_CAP * 0.6), 0, Math.PI / 2, 2), [0, POST_CAP]]);
}

/**
 * A stack of `n` plates of radius `r` lying flat from `y0` at (x, z), each `t` high: one turned
 * part with a groove under each plate's rim, so the stack reads as plates and not as a cylinder.
 */
export function plateStack(p: Parts, x: number, y0: number, z: number, r: number, n: number, t: number): void {
  const pts: ProfilePoint[] = [
    [0, 0],
    [r * 0.62, 0],
  ];
  for (let i = 0; i < n; i++) pts.push([r, i * t + t * 0.55], [r * 0.93, (i + 1) * t]);
  pts.push([r * 0.6, n * t], [0, n * t]);
  p.lathe("panel", x, y0, z, pts);
}

/**
 * A cooking pot hanging or standing at (x, y0, z), radius `r` and height `h`: the turned body
 * with a rolled rim, and its two side handles along x.
 */
export function pot(p: Parts, x: number, y0: number, z: number, r: number, h: number): void {
  p.lathe("satin", x, y0, z, [
    [0, 0],
    [r * 0.94, 0],
    [r, h * 0.08],
    [r, h * 0.95],
    [r * 1.03, h],
    [r * 0.97, h],
    [r * 0.95, h * 0.95],
    [r * 0.95, h * 0.06],
    [0, h * 0.06],
  ]);
  const hy = y0 + h * 0.82;
  for (const sx of [-1, 1]) {
    const a = x + sx * r * 0.98;
    p.tube("handle", [
      { x: a, y: hy, z: z - r * 0.25 },
      { x: a + sx * r * 0.22, y: hy, z: z - r * 0.25 },
      { x: a + sx * r * 0.22, y: hy, z: z + r * 0.25 },
      { x: a, y: hy, z: z + r * 0.25 },
    ], 0.004, { bend: 0.01 });
  }
}

/**
 * A wine bottle lying along z with its bottom at `z0` and its neck towards +z, `len` long and of
 * radius `r`, centred on (x, y): one turned part with shoulder, neck and capsule.
 */
export function bottle(p: Parts, x: number, y: number, z0: number, r: number, len: number): void {
  p.lathe(
    "glassDark",
    x,
    y,
    z0,
    [
      [0, 0],
      [r * 0.9, 0],
      [r, len * 0.04],
      [r, len * 0.58],
      [r * 0.8, len * 0.68],
      [r * 0.38, len * 0.78],
      [r * 0.34, len * 0.98],
      [r * 0.38, len],
      [0, len],
    ],
    { axis: "z", segments: 8 },
  );
}

