// Construction shared by the work tables, cabinets and preparation machines of this area: the
// worktop with its upstand and rolled front edge, legs on adjustable feet or castors, cabinet
// bodies on feet, drawer fronts and sliding doors, in all three views.
//
// Candidates for kinds/parts once another area needs them (tableTop, tableFrame, castor,
// slidingDoors, drawerFronts and their elevation counterparts).

import type { Fill, Pen } from "../../render/drawing";
import { FEET, INSET, LEG as FRONT_LEG, TOP as FRONT_TOP, type Front } from "../parts/elevation";
import { BODY_RADIUS, BOWL_RADIUS, castor, DOOR, DOOR_RADIUS, foot as turnedFoot, GAP, LEG, LEG_RADIUS, roundedRectOutline, SHEET, TOP, TOP_RADIUS, UNDERSHELF, worktop, type Hole, type Parts, type Point2, type Size } from "../parts/mesh";
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
/** Height of the frame rails under a table top, behind its apron (m). */
const RAIL = 0.03;
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

/**
 * Which edges of a worktop get an upstand, whether the back edge is rolled too (islands), and
 * whether the top is closed underneath (on a cabinet body) instead of open behind its apron.
 */
export interface TopEdges {
  back?: boolean;
  left?: boolean;
  right?: boolean;
  rolledBack?: boolean;
  solid?: boolean;
}

/** Radius of the rolled front edge of a worktop (m). */
const NOSE = 0.012;
/** Thickness of the top over the open space behind its apron (sheet and sound-deadening board, m). */
const TOP_SHEET = 0.012;
/** The apron's sheet as drawn (m). */
const APRON = 0.004;
/** Hygienic cove between the worktop and its upstand (m). */
const COVE = 0.008;
/** Radius of the rounded top of an upstand (m). */
const UPSTAND_ROUND = 0.004;

/** Points on an arc in the (z, y) plane of an extruded profile: centre, radius, angles (rad). */
export function arc2(cz: number, cy: number, r: number, a0: number, a1: number, steps: number): Point2[] {
  return Array.from({ length: steps + 1 }, (_, k): Point2 => {
    const a = a0 + ((a1 - a0) * k) / steps;
    return [cz + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

/**
 * The front edge of a worktop at `zf` (m) in the (z, y) plane: from the underside up the apron
 * and over the rolled edge, ending on the top surface.
 */
function frontEdge(zf: number, h: number, solid: boolean): Point2[] {
  const yA = h - TOP;
  const under: Point2[] = solid ? [] : [[zf - APRON, h - TOP_SHEET], [zf - APRON, yA]];
  return [...under, [zf - 0.001, yA], [zf, yA + 0.001], ...arc2(zf - NOSE, h - NOSE, NOSE, 0, Math.PI / 2, 4)];
}

/** The back edge from the top surface down to the underside: an upstand, a rolled or a plain edge. */
function backEdge(zb: number, h: number, edges: TopEdges): Point2[] {
  const yA = h - TOP;
  const under: Point2[] = edges.solid ? [[zb + 0.001, yA]] : [[zb + APRON, yA], [zb + APRON, h - TOP_SHEET]];
  if (edges.back) {
    const t = UPSTAND_T;
    const top = h + UPSTAND_H;
    return [
      ...arc2(zb + t + COVE, h + COVE, COVE, 1.5 * Math.PI, Math.PI, 3),
      ...arc2(zb + t - UPSTAND_ROUND, top - UPSTAND_ROUND, UPSTAND_ROUND, 0, Math.PI / 2, 3),
      ...arc2(zb + UPSTAND_ROUND, top - UPSTAND_ROUND, UPSTAND_ROUND, Math.PI / 2, Math.PI, 3),
      [zb, yA],
      ...under,
    ];
  }
  const r = edges.rolledBack ? NOSE : TOP_RADIUS;
  return [...arc2(zb + r, h - r, r, Math.PI / 2, Math.PI, edges.rolledBack ? 4 : 3), [zb, yA + 0.001], ...under];
}

/**
 * A stainless worktop whose surface lies at the item's height: the rolled front edge on its
 * apron and the back upstand with a cove (the kind declares `rise: UPSTAND_RISE`) or a rolled
 * back edge as pressed profiles along the width, the flat top between them with its cut-outs
 * (`holes`), and upstands at the ends.
 */
export function tableTop(p: Parts, { w, d, h }: Size, edges: TopEdges, holes: readonly Hole[] = []): void {
  const zf = d / 2;
  const zb = -d / 2;
  const front = frontEdge(zf, h, !!edges.solid);
  const back = backEdge(zb, h, edges);
  // The two edges are pressed profiles along the width; the flat middle between them is a sheet
  // with rounded edges like `worktop`, centred on the item so its grain lies in plan metres, or
  // the sheet with the cut-outs. The profiles reach in flat to meet it.
  const yU = edges.solid ? h - TOP : h - TOP_SHEET;
  const zF = zf - NOSE;
  const zB = zb + (edges.back ? UPSTAND_T + COVE : edges.rolledBack ? NOSE : TOP_RADIUS);
  const m = Math.min(zF, -zB);
  const flat = (z: number, end: number): Point2[] => (Math.abs(z - end) > 1e-6 ? [[end, h]] : []);
  p.extrude("steel", "x", -w / 2, w / 2, [...front, ...flat(zF, m), [m, yU]]);
  p.extrude("steel", "x", -w / 2, w / 2, [[-m, yU], ...flat(zB, -m), ...back]);
  if (holes.length === 0) {
    worktop(p, "steel", -w / 2, w / 2, yU, h, -m, m);
  } else {
    const inside = (v: number, a: number, b: number) => Math.max(a + 0.002, Math.min(b - 0.002, v));
    const cuts = holes.map((o) => roundedRectOutline(inside(o.x0, -w / 2, w / 2), inside(o.x1, -w / 2, w / 2), inside(o.z0, -m, m), inside(o.z1, -m, m), o.r ?? BOWL_RADIUS));
    p.extrude(
      "steel",
      "y",
      yU,
      h,
      [
        [-w / 2, -m],
        [w / 2, -m],
        [w / 2, m],
        [-w / 2, m],
      ],
      cuts,
    );
  }
  // Upstands at the ends stand on the top, half a millimetre inside its end so their faces never
  // lie in the plane of the profile's end.
  const sideFront = zf - 2 * EDGE;
  const inset = 0.0005;
  if (edges.left) p.roundedBox("steel", -w / 2 + inset, -w / 2 + UPSTAND_T, h, h + UPSTAND_H, zb + UPSTAND_T, sideFront, UPSTAND_ROUND, "top");
  if (edges.right) p.roundedBox("steel", w / 2 - UPSTAND_T, w / 2 - inset, h, h + UPSTAND_H, zb + UPSTAND_T, sideFront, UPSTAND_ROUND, "top");
}

/** Centre of the legs of a table (m from the middle): set in under the top and its rolled edge. */
function legCentre({ w, d }: Size): { x: number; z: number } {
  return { x: w / 2 - LEG_SET - LEG / 2, z: d / 2 - 2 * EDGE - LEG / 2 };
}

/** An adjustable foot: a threaded post on a rubber pad, centred under (x, z), up to `top`. */
export function foot(p: Parts, x: number, z: number, top: number): void {
  turnedFoot(p, x, z, top, 0.02);
}

/** A swivel castor of the tables and machines under (x, z), its plate at `CASTOR` (m). */
export function tableCastor(p: Parts, x: number, z: number): void {
  castor(p, x, z, CASTOR_R, CASTOR);
}

/**
 * The frame of a table: four square tube legs on adjustable feet (or castors) from the floor up
 * under the top (`topY` is the underside of its apron), the frame rails behind the apron and an
 * optional undershelf.
 */
export function tableFrame(p: Parts, s: Size, topY: number, o: { shelf: boolean; castors?: boolean; frontRail?: boolean }): void {
  const c = legCentre(s);
  const bottom = o.castors ? CASTOR : LEG_FOOT;
  // The legs reach up into the space behind the apron, under the top's sheet.
  const legTop = topY + TOP - TOP_SHEET;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * c.x;
      const z = sz * c.z;
      p.roundedBox("steelDark", x - LEG / 2, x + LEG / 2, bottom, legTop, z - LEG / 2, z + LEG / 2, LEG_RADIUS, "vertical");
      if (o.castors) tableCastor(p, x, z);
      else foot(p, x, z, bottom);
    }
  }
  const rx = c.x - LEG / 2;
  const rz = c.z - LEG / 2;
  const r0 = legTop - RAIL;
  if (o.frontRail !== false) p.roundedBox("steelDark", -rx, rx, r0, legTop, c.z - SHEET, c.z + SHEET, BODY_RADIUS);
  p.roundedBox("steelDark", -rx, rx, r0, legTop, -c.z - SHEET, -c.z + SHEET, BODY_RADIUS);
  for (const sx of [-1, 1]) p.roundedBox("steelDark", sx * c.x - SHEET, sx * c.x + SHEET, r0, legTop, -rz, rz, BODY_RADIUS);
  if (o.shelf) {
    const sy = shelfY(!!o.castors) / 1000;
    p.roundedBox("steel", -c.x - LEG / 2 - 0.004, c.x + LEG / 2 + 0.004, sy, sy + SHEET * 2, -c.z - LEG / 2 - 0.004, c.z + LEG / 2 + 0.004, TOP_RADIUS);
  }
}

/** Height of a table's undershelf above the floor (mm): higher on castors. */
function shelfY(castors: boolean): number {
  return (castors ? Math.max(UNDERSHELF, CASTOR + 0.05) : UNDERSHELF) * 1000;
}

/** Drawers under a table top (`tableDrawerSpans`): housing, front and handle, up to `topY`. */
export function tableDrawers(p: Parts, s: Size, topY: number): void {
  const zf = s.d / 2 - FRONT_SET;
  const c = legCentre(s);
  for (const [x0, x1] of tableDrawerSpans(s.w, DRAWER_W_3D, s.w / 2 - c.x + LEG / 2 + 0.01, tableDrawerCount(Math.round(s.w * 1000)))) {
    p.roundedBox("steel", x0, x1, topY - DRAWER_3D, topY, -c.z, zf - DOOR, BODY_RADIUS, "vertical");
    drawerFronts(p, x0, x1, topY - DRAWER_3D, topY, zf, 1);
  }
}

/**
 * A cabinet body on adjustable feet, closed from the feet to the top: returns the front range
 * the doors or drawers fill (y0 to y1) and the plane their fronts end in (zf). Its top is a
 * `tableTop` with `solid: true`.
 */
export function cabinetBody(p: Parts, s: Size): { y0: number; y1: number; zf: number } {
  const { w, d, h } = s;
  const zf = d / 2 - FRONT_SET;
  p.roundedBox("steel", -w / 2, w / 2, CAB_FEET, h - TOP, -d / 2, zf - DOOR, BODY_RADIUS, "vertical");
  // A dark bottom panel under the body reads as the shadow gap above the feet.
  p.box("steelDark", -w / 2 + SHEET, w / 2 - SHEET, CAB_FEET - SHEET, CAB_FEET, -d / 2 + SHEET, zf - DOOR - SHEET);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) foot(p, sx * (w / 2 - 0.04), sz * (d / 2 - 0.07), CAB_FEET - SHEET);
  }
  return { y0: CAB_FEET, y1: h - TOP, zf };
}

/**
 * Pin hinges of `count` doors side by side from x0 to x1 (as `doors` in parts/mesh lays them):
 * two turned barrels on each leaf at its hinged edge, the edge away from the handle.
 */
export function doorHinges(p: Parts, x0: number, x1: number, y0: number, y1: number, zf: number, count: number): void {
  const dw = (x1 - x0) / count;
  const r = HINGE_R;
  const zc = zf - DOOR / 2 + r;
  for (let i = 0; i < count; i++) {
    const handleLeft = count > 1 && i % 2 === 1;
    const x = handleLeft ? x0 + (i + 1) * dw - GAP - r - 0.002 : x0 + i * dw + GAP + r + 0.002;
    for (const y of [y0 + 0.06, y1 - 0.06 - HINGE_L]) {
      p.lathe("satin", x, y, zc, [
        [0, 0],
        [r * 0.8, 0],
        [r, r * 0.3],
        [r, HINGE_L - r * 0.3],
        [r * 0.8, HINGE_L],
        [0, HINGE_L],
      ]);
    }
  }
}

/** Radius and length of a pin hinge's barrel (m). */
const HINGE_R = 0.005;
const HINGE_L = 0.05;

/** `n` drawer fronts stacked from y0 to y1, each with a bar handle near its top (m). */
export function drawerFronts(p: Parts, x0: number, x1: number, y0: number, y1: number, zf: number, n: number): void {
  const dh = (y1 - y0) / n;
  const len = Math.min(0.3, (x1 - x0) * 0.55);
  const cx = (x0 + x1) / 2;
  for (let i = 0; i < n; i++) {
    const a = y0 + i * dh;
    p.roundedBox("steel", x0 + GAP, x1 - GAP, a + GAP, a + dh - GAP, zf - DOOR, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
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
  p.roundedBox("steelDark", x0 + GAP, x1 - GAP, y0, y0 + GAP * 2, zf - DOOR, zf - GAP, BODY_RADIUS);
  p.roundedBox("steelDark", x0 + GAP, x1 - GAP, y1 - GAP * 2, y1, zf - DOOR, zf - GAP, BODY_RADIUS);
  const leaves: [number, number, number][] = [
    [x0 + GAP, mid + SLIDE_OVERLAP / 2, zf - DOOR],
    [mid - SLIDE_OVERLAP / 2, x1 - GAP, zf - DOOR + t + GAP],
  ];
  const gh = Math.min(0.14, (y1 - y0) * 0.35);
  const gy = (y0 + y1) / 2;
  leaves.forEach(([a, b, z], i) => {
    p.roundedBox("steel", a, b, y0 + GAP * 2, y1 - GAP * 2, z, z + t, DOOR_RADIUS, "top", "z");
    // Recessed grip at the outer edge of each leaf: a pressed satin cup with its dark hollow.
    const gx = i === 0 ? a + 0.05 : b - 0.05;
    p.plate("satin", gx - 0.016, gx + 0.016, gy - gh / 2, gy + gh / 2, z + t, z + t + 0.0015, 0.012, true);
    p.plate("slot", gx - 0.01, gx + 0.01, gy - gh / 2 + 0.008, gy + gh / 2 - 0.008, z + t + 0.0015, z + t + 0.002, 0.008);
  });
}

/** Four turned rubber feet under the corners of a machine base from x0 to x1 and z0 to z1 (m). */
export function machineFeet(p: Parts, x0: number, x1: number, z0: number, z1: number): void {
  const r = 0.015;
  for (const x of [x0 + r * 1.5, x1 - r * 1.5]) {
    for (const z of [z0 + r * 1.5, z1 - r * 1.5]) rubberFoot(p, x, z, r, MACHINE_FOOT);
  }
}

/** A turned rubber foot of radius `r` from the floor up to `h` (m): a pad with a rounded shoulder. */
export function rubberFoot(p: Parts, x: number, z: number, r: number, h: number): void {
  p.lathe("rubber", x, 0, z, [
    [0, 0],
    [r * 0.85, 0],
    [r, h * 0.25],
    [r, h * 0.7],
    [r * 0.8, h],
    [0, h],
  ]);
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
  if (o.shelf) {
    const sy = z0 + shelfY(!!o.castors);
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
