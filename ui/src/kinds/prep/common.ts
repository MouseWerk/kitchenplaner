// Construction shared by the work tables, cabinets and preparation machines of this area: the
// worktop with its upstand and rolled front edge, legs on adjustable feet or castors, cabinet
// bodies on feet, drawer fronts and sliding doors, in all three views.
//
// Candidates for kinds/parts once another area needs them (tableTop, tableFrame, castor,
// slidingDoors, drawerFronts and their elevation counterparts).

import type { Fill, Pen } from "../../render/drawing";
import { FEET, INSET, LEG as FRONT_LEG, TOP as FRONT_TOP, type Front } from "../parts/elevation";
import { castor, DOOR, GAP, LEG, SHEET, TOP, UNDERSHELF, type Hole, type Parts, type Size } from "../parts/mesh";
import { INSET as PLAN_INSET, type PlanSketch } from "../parts/plan";

// ---------------------------------------------------------------------------------------------
// Sizes (mm for `rise`, plan and elevation; m for 3D)

/** Height of the back upstand above the worktop (mm): the usual 40 mm splash edge. */
export const UPSTAND_RISE = 40;
/** Height of a drawer under a table top (mm, a flat cutlery or tool drawer). */
export const TABLE_DRAWER = 150;
/** Width of a drawer under a table top (mm). */
export const TABLE_DRAWER_W = 500;
/** Table width from which a work table has a drawer at each end instead of one (mm). */
const TWO_DRAWERS_FROM = 1400;
/** Height of the adjustable foot under a table leg (mm, as in 3D). */
const LEG_FOOT_MM = 50;
/** Height of a castor under a mobile table (mm, as in 3D). */
const CASTOR_MM = 110;

/** Upstand in 3D: height (the `rise`) and sheet thickness (m). */
const UPSTAND_H = UPSTAND_RISE / 1000;
const UPSTAND_T = 0.02;
/** Radius of the rolled front edge (m): a 40 mm apron rounded towards the user. */
const EDGE = TOP / 2;
/** Legs are set in under the top by this much on every side (m). */
const LEG_SET = 0.02;
/** Height of the adjustable foot under a leg, and of its rubber pad (m). */
const LEG_FOOT = LEG_FOOT_MM / 1000;
const FOOT_PAD = 0.012;
/** Height of the frame rails under a table top (m). */
const RAIL = 0.05;
/** Castor wheel radius and the whole castor's height under the leg (m). */
const CASTOR_R = 0.045;
export const CASTOR = CASTOR_MM / 1000;
/** Feet under cabinets (m, the usual 150 mm adjustable feet of gastro cabinets). */
export const CAB_FEET = FEET / 1000;
/** Door and drawer fronts end this far behind the rolled edge (m). */
const FRONT_SET = 0.005;
/** Overlap of two sliding doors in the middle (m). */
const SLIDE_OVERLAP = 0.03;
/** Height of a drawer under a table top, and its width (m). */
const DRAWER_3D = TABLE_DRAWER / 1000;
const DRAWER_W_3D = TABLE_DRAWER_W / 1000;
/** Rubber feet under table-top machines (m). */
export const MACHINE_FOOT = 0.015;

/** Number of drawers under the top of a work table of the given width (mm). */
export function tableDrawerCount(width: number): number {
  return width >= TWO_DRAWERS_FROM ? 2 : 1;
}

/**
 * X ranges of the drawers under a table top, from the right end (one) or at both ends (two),
 * clear of the legs; `w` and `set` in the same unit (mm or m).
 */
export function tableDrawerSpans(w: number, drawerW: number, set: number, count: number): [number, number][] {
  const width = Math.min(drawerW, (w - 2 * set) / count - set);
  const right: [number, number] = [w / 2 - set - width, w / 2 - set];
  return count === 1 ? [right] : [[-w / 2 + set, -w / 2 + set + width], right];
}

// ---------------------------------------------------------------------------------------------
// 3D

/** Which edges of a worktop get an upstand, and whether the back edge is rolled too (islands). */
export interface TopEdges {
  back?: boolean;
  left?: boolean;
  right?: boolean;
  rolledBack?: boolean;
}

/**
 * A stainless worktop whose surface lies at the item's height: the rolled front edge, and
 * upstands rising above it (the kind declares `rise: UPSTAND_RISE`).
 */
export function tableTop(p: Parts, { w, d, h }: Size, edges: TopEdges, holes: readonly Hole[] = []): void {
  if (holes.length > 0) p.topWithHoles("steel", w, d, h - TOP, h, holes);
  else p.box("steel", -w / 2, w / 2, h - TOP, h, -d / 2, d / 2);
  p.rod("steel", "x", 0, h - EDGE, d / 2 - EDGE, w, EDGE);
  if (edges.rolledBack) p.rod("steel", "x", 0, h - EDGE, -d / 2 + EDGE, w, EDGE);
  if (edges.back) p.box("steel", -w / 2, w / 2, h, h + UPSTAND_H, -d / 2, -d / 2 + UPSTAND_T);
  const sideFront = d / 2 - 2 * EDGE;
  if (edges.left) p.box("steel", -w / 2, -w / 2 + UPSTAND_T, h, h + UPSTAND_H, -d / 2, sideFront);
  if (edges.right) p.box("steel", w / 2 - UPSTAND_T, w / 2, h, h + UPSTAND_H, -d / 2, sideFront);
}

/** Centre of the legs of a table (m from the middle): set in under the top and its rolled edge. */
function legCentre({ w, d }: Size): { x: number; z: number } {
  return { x: w / 2 - LEG_SET - LEG / 2, z: d / 2 - 2 * EDGE - LEG / 2 };
}

/** An adjustable foot: a threaded post on a rubber pad, centred under (x, z), up to `top`. */
export function foot(p: Parts, x: number, z: number, top: number): void {
  p.cyl("steelDark", x, z, FOOT_PAD, top, 0.013);
  p.cyl("rubber", x, z, 0, FOOT_PAD, 0.02);
}

/** A swivel castor of the tables and machines under (x, z), its plate at `CASTOR` (m). */
export function tableCastor(p: Parts, x: number, z: number): void {
  castor(p, x, z, CASTOR_R, CASTOR);
}

/**
 * The frame of a table: four square legs on adjustable feet (or castors) from the floor up to
 * `topY`, frame rails under the top and an optional undershelf.
 */
export function tableFrame(p: Parts, s: Size, topY: number, o: { shelf: boolean; castors?: boolean; frontRail?: boolean }): void {
  const c = legCentre(s);
  const bottom = o.castors ? CASTOR : LEG_FOOT;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * c.x;
      const z = sz * c.z;
      p.box("steel", x - LEG / 2, x + LEG / 2, bottom, topY, z - LEG / 2, z + LEG / 2);
      if (o.castors) tableCastor(p, x, z);
      else foot(p, x, z, bottom);
    }
  }
  const rx = c.x - LEG / 2;
  const rz = c.z - LEG / 2;
  if (o.frontRail !== false) p.box("steel", -rx, rx, topY - RAIL, topY, c.z - SHEET, c.z + SHEET);
  p.box("steel", -rx, rx, topY - RAIL, topY, -c.z - SHEET, -c.z + SHEET);
  for (const sx of [-1, 1]) p.box("steel", sx * c.x - SHEET, sx * c.x + SHEET, topY - RAIL, topY, -rz, rz);
  if (o.shelf) {
    const sy = o.castors ? Math.max(UNDERSHELF, CASTOR + 0.05) : UNDERSHELF;
    p.box("steel", -c.x - LEG / 2, c.x + LEG / 2, sy, sy + SHEET * 2, -c.z - LEG / 2, c.z + LEG / 2);
  }
}

/** Drawers under a table top (`tableDrawerSpans`): housing, front and handle, up to `topY`. */
export function tableDrawers(p: Parts, s: Size, topY: number): void {
  const zf = s.d / 2 - FRONT_SET;
  const c = legCentre(s);
  for (const [x0, x1] of tableDrawerSpans(s.w, DRAWER_W_3D, s.w / 2 - c.x + LEG / 2 + 0.01, tableDrawerCount(Math.round(s.w * 1000)))) {
    p.box("steel", x0, x1, topY - DRAWER_3D, topY, -c.z, zf - DOOR);
    drawerFronts(p, x0, x1, topY - DRAWER_3D, topY, zf, 1);
  }
}

/**
 * A cabinet body on adjustable feet, closed from the feet to the top: returns the front range
 * the doors or drawers fill (y0 to y1) and the plane their fronts end in (zf).
 */
export function cabinetBody(p: Parts, s: Size): { y0: number; y1: number; zf: number } {
  const { w, d, h } = s;
  const zf = d / 2 - FRONT_SET;
  p.box("steel", -w / 2, w / 2, CAB_FEET, h - TOP, -d / 2, zf - DOOR);
  // A dark bottom panel under the body reads as the shadow gap above the feet.
  p.box("steelDark", -w / 2 + SHEET, w / 2 - SHEET, CAB_FEET - SHEET, CAB_FEET, -d / 2 + SHEET, zf - DOOR - SHEET);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) foot(p, sx * (w / 2 - 0.04), sz * (d / 2 - 0.07), CAB_FEET - SHEET);
  }
  return { y0: CAB_FEET, y1: h - TOP, zf };
}

/** `n` drawer fronts stacked from y0 to y1, each with a bar handle near its top (m). */
export function drawerFronts(p: Parts, x0: number, x1: number, y0: number, y1: number, zf: number, n: number): void {
  const dh = (y1 - y0) / n;
  const len = Math.min(0.3, (x1 - x0) * 0.55);
  const cx = (x0 + x1) / 2;
  for (let i = 0; i < n; i++) {
    const a = y0 + i * dh;
    p.box("steel", x0 + GAP, x1 - GAP, a + GAP, a + dh - GAP, zf - DOOR, zf - DOOR / 2);
    p.barHandle("x", cx - len / 2, cx + len / 2, a + dh - Math.min(0.045, dh * 0.3), zf - DOOR / 2, zf);
  }
}

/**
 * Two sliding doors from x0 to x1 overlapping in the middle, the left one running behind the
 * right one, each with a recessed grip at its outer edge, and the runner rails above and below.
 */
export function slidingDoors(p: Parts, x0: number, x1: number, y0: number, y1: number, zf: number): void {
  const mid = (x0 + x1) / 2;
  const t = DOOR * 0.4;
  p.box("steelDark", x0 + GAP, x1 - GAP, y0, y0 + GAP * 2, zf - DOOR, zf - GAP);
  p.box("steelDark", x0 + GAP, x1 - GAP, y1 - GAP * 2, y1, zf - DOOR, zf - GAP);
  const leaves: [number, number, number][] = [
    [x0 + GAP, mid + SLIDE_OVERLAP / 2, zf - DOOR],
    [mid - SLIDE_OVERLAP / 2, x1 - GAP, zf - DOOR + t + GAP],
  ];
  const gh = Math.min(0.14, (y1 - y0) * 0.35);
  const gy = (y0 + y1) / 2;
  leaves.forEach(([a, b, z], i) => {
    p.box("steel", a, b, y0 + GAP * 2, y1 - GAP * 2, z, z + t);
    // Recessed grip: a dark slot at the outer edge of each leaf.
    const gx = i === 0 ? a + 0.05 : b - 0.05;
    p.box("panelDark", gx - 0.012, gx + 0.012, gy - gh / 2, gy + gh / 2, z + t, z + t + 0.002);
  });
}

/** Four rubber feet under the corners of a machine base from x0 to x1 and z0 to z1 (m). */
export function machineFeet(p: Parts, x0: number, x1: number, z0: number, z1: number): void {
  const r = 0.015;
  for (const x of [x0 + r * 1.5, x1 - r * 1.5]) {
    for (const z of [z0 + r * 1.5, z1 - r * 1.5]) p.cyl("rubber", x, z, 0, MACHINE_FOOT, r);
  }
}

// ---------------------------------------------------------------------------------------------
// Elevation (mm)

/** The upstand seen above the worktop behind it. */
export function upstandFront(f: Front): void {
  f.box("detail", f.l, f.r, f.top, f.top + UPSTAND_RISE);
}

/** Legs with feet (or castors), the rail under the top and the undershelf of an open table. */
export function tableLegsFront(f: Front, o: { shelf: boolean; castors?: boolean }): void {
  const { l, r, z0, top } = f;
  const set = LEG_SET * 1000;
  const bottom = z0 + (o.castors ? CASTOR_MM : LEG_FOOT_MM);
  const legTop = top - FRONT_TOP;
  for (const a of [l + set, r - set - FRONT_LEG]) {
    const c = a + FRONT_LEG / 2;
    f.box("detail", a, a + FRONT_LEG, bottom, legTop);
    if (o.castors) {
      // The wheel seen edge on, under its plate.
      f.box("detail", c - 15, c + 15, z0, z0 + CASTOR_R * 2000);
      f.line("detail", [c - 30, bottom], [c + 30, bottom]);
    } else {
      f.box("detail", c - 13, c + 13, z0 + FOOT_PAD * 1000, bottom);
      f.line("detail", [c - 20, z0 + FOOT_PAD * 1000], [c + 20, z0 + FOOT_PAD * 1000]);
    }
  }
  f.line("detail", [l + set + FRONT_LEG, legTop - RAIL * 1000], [r - set - FRONT_LEG, legTop - RAIL * 1000]);
  if (o.shelf) {
    const sy = z0 + (o.castors ? Math.max(UNDERSHELF, CASTOR + 0.05) : UNDERSHELF) * 1000;
    f.box("detail", l + set + FRONT_LEG, r - set - FRONT_LEG, sy, sy + SHEET * 2000);
  }
}

/** A table's front: worktop, upstand (if any), legs and undershelf. */
export function tableFront(f: Front, o: { upstand: boolean; shelf: boolean; castors?: boolean }): void {
  f.worktop();
  if (o.upstand) upstandFront(f);
  tableLegsFront(f, o);
}

/** The drawers under a table top, at the same places as in 3D. */
export function tableDrawersFront(f: Front): void {
  const legTop = f.top - FRONT_TOP;
  const mid = (f.l + f.r) / 2;
  for (const [a, b] of tableDrawerSpans(f.w, TABLE_DRAWER_W, LEG_SET * 1000 + FRONT_LEG + 10, tableDrawerCount(f.w))) {
    f.box("detail", mid + a, mid + b, legTop - TABLE_DRAWER, legTop);
    const c = mid + (a + b) / 2;
    f.line("detail", [c - INSET * 2, legTop - INSET], [c + INSET * 2, legTop - INSET]);
  }
}

/**
 * A cabinet's front: worktop, upstand (if any) and the feet; returns the range from the feet to
 * under the top that the doors and drawers fill.
 */
export function cabinetFront(f: Front, upstand: boolean): { z0: number; z1: number } {
  const { l, r, z0 } = f;
  f.worktop();
  if (upstand) upstandFront(f);
  for (const c of [l + 40, r - 40]) f.box("detail", c - 13, c + 13, z0, z0 + FEET - SHEET * 1000);
  f.line("detail", [l, z0 + FEET], [r, z0 + FEET]);
  return { z0: z0 + FEET, z1: f.top - FRONT_TOP };
}

/** `n` hinged doors from x a to b, handles towards the middle joint as `Front.doors`. */
export function doorsFront(f: Front, a: number, b: number, z0: number, z1: number, n: number): void {
  const gap = INSET / 2;
  const dw = (b - a - gap * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = a + gap + i * (dw + gap);
    f.box("detail", x, x + dw, z0 + gap, z1 - gap);
    const hx = n > 1 && i % 2 === 1 ? x + INSET : x + dw - INSET;
    const zm = (z0 + z1) / 2;
    f.line("detail", [hx, zm - INSET * 2], [hx, zm + INSET * 2]);
  }
}

/** `n` drawers stacked from z0 to z1 between x a and b, each with a handle near its top. */
export function drawersFront(f: Front, a: number, b: number, z0: number, z1: number, n: number): void {
  const gap = INSET / 4;
  const dh = (z1 - z0) / n;
  const c = (a + b) / 2;
  const half = Math.min(INSET * 3, (b - a) * 0.3);
  for (let i = 0; i < n; i++) {
    const zb = z0 + i * dh;
    f.box("detail", a + gap, b - gap, zb + gap, zb + dh - gap);
    f.line("detail", [c - half, zb + dh - INSET], [c + half, zb + dh - INSET]);
  }
}

/** Two sliding doors overlapping in the middle, with their grips at the outer edges. */
export function slidingFront(f: Front, a: number, b: number, z0: number, z1: number): void {
  const gap = INSET / 4;
  const mid = (a + b) / 2;
  const o = SLIDE_OVERLAP * 500;
  f.box("detail", a + gap, mid + o, z0 + gap, z1 - gap);
  f.box("detail", mid - o, b - gap, z0 + gap, z1 - gap);
  const zm = (z0 + z1) / 2;
  const gh = Math.min(140, (z1 - z0) * 0.35) / 2;
  for (const gx of [a + 50, b - 50]) f.box("detail", gx - 12, gx + 12, zm - gh, zm + gh);
}

// ---------------------------------------------------------------------------------------------
// Plan (mm)

/** Two sliding door leaves at the front, overlapping in the middle. */
export function slidingPlan(s: PlanSketch): void {
  const y = s.F - PLAN_INSET / 2;
  const o = SLIDE_OVERLAP * 500;
  s.line("detail", [s.L + PLAN_INSET / 2, y], [o, y]);
  s.line("detail", [-o, y - PLAN_INSET / 3], [s.R - PLAN_INSET / 2, y - PLAN_INSET / 3]);
}

/** Door (or drawer) fronts at the front: one short line per front between x a and b. */
export function frontsPlan(s: PlanSketch, a: number, b: number, n: number): void {
  const gap = PLAN_INSET / 2;
  const dw = (b - a - (n + 1) * gap) / n;
  for (let i = 0; i < n; i++) {
    const x = a + gap + i * (dw + gap);
    s.line("detail", [x, s.F - PLAN_INSET / 2], [x + dw, s.F - PLAN_INSET / 2]);
  }
}

// ---------------------------------------------------------------------------------------------
// Machines: their layout is worked out once in metres in the item frame (as in 3D) and drawn
// into the plan and the elevation with these, so the three views agree.

/** Size of the item in metres. */
export function metres(item: { width: number; depth: number; height: number }): Size {
  return { w: item.width / 1000, d: item.depth / 1000, h: item.height / 1000 };
}

/** A box in the elevation from metres in the item frame: x across, y above the elevation. */
export function mBox(f: Front, pen: Pen, x0: number, x1: number, y0: number, y1: number, fill?: Fill): void {
  const m = (f.l + f.r) / 2;
  f.box(pen, m + x0 * 1000, m + x1 * 1000, f.z0 + y0 * 1000, f.z0 + y1 * 1000, fill);
}

/** A circle in the elevation from metres in the item frame. */
export function mCircle(f: Front, x: number, y: number, r: number): void {
  f.circle("detail", (f.l + f.r) / 2 + x * 1000, f.z0 + y * 1000, r * 1000);
}

/** A line in the elevation from metres in the item frame. */
export function mLine(f: Front, ...pts: [number, number][]): void {
  const m = (f.l + f.r) / 2;
  f.line("detail", ...pts.map(([x, y]): [number, number] => [m + x * 1000, f.z0 + y * 1000]));
}

/** A rectangle in the plan from metres in the item frame (z towards the front, as in 3D). */
export function pRect(s: PlanSketch, pen: Pen, x0: number, z0: number, x1: number, z1: number): void {
  s.rect(pen, x0 * 1000, z0 * 1000, x1 * 1000, z1 * 1000);
}

/** A circle in the plan from metres in the item frame. */
export function pCircle(s: PlanSketch, pen: Pen, x: number, z: number, r: number): void {
  s.circle(pen, x * 1000, z * 1000, r * 1000);
}
