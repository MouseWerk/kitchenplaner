// Helpers the washing kinds share: bowl layouts, dish table tops with rack rails, the pre-rinse
// shower, drains under bowls and the tunnel housing of conveyor dishwashers. Plan and elevation
// helpers work in millimetres, mesh helpers in metres (see kinds/README.md).

import { FEET, INSET as FRONT_INSET, type Front } from "../parts/elevation";
import { BODY_RADIUS, DOOR, DOOR_RADIUS, foot, GAP, LEG, LEG_RADIUS, PLINTH, SHEET, TOP_RADIUS, UNDERSHELF, worktop, type Hole, type Parts, type Size } from "../parts/mesh";
import { INSET, type PlanSketch } from "../parts/plan";
import { button } from "./details";
import { display, HOUSING_RADIUS, ratingPlate } from "../parts/details";

/** The end of a unit along its width, as seen from the front. */
export type Side = "left" | "right";
/** An edge of a table top: an end or the front. */
export type Edge = Side | "front";

/** A span along the width in the item frame (mm in plan and elevation, m in 3D). */
export interface Span {
  x0: number;
  x1: number;
}

/**
 * `n` bowls side by side at one end of a top of width `w`, `margin` between them and to the
 * edges, each at most `bowlW` wide (smaller on a narrow top). The first bowl is the one at the
 * end, the next one beside it towards the middle. Works in any unit.
 */
export function bowlSpans(w: number, n: number, bowlW: number, at: Side, margin: number): Span[] {
  const bw = Math.max(0, Math.min(bowlW, (w - (n + 1) * margin) / n));
  const out: Span[] = [];
  for (let i = 0; i < n; i++) {
    if (at === "right") {
      const x1 = w / 2 - margin - i * (bw + margin);
      out.push({ x0: x1 - bw, x1 });
    } else {
      const x0 = -w / 2 + margin + i * (bw + margin);
      out.push({ x0, x1: x0 + bw });
    }
  }
  return out;
}

export const mid = (s: Span) => (s.x0 + s.x1) / 2;

// ---------------------------------------------------------------------------------------------
// Dish tables: a top sunk below a raised rim (Aufkantung) that keeps the water on the table,
// open on the side that joins the dishwasher, with rails the dish racks slide on.

/** Height of the raised rim of dish tables above their top sheet (m, mm in the drawings). */
export const RIM = 0.04;
/** Distance of the two rack rails from the middle of the table (m): under a 500 mm rack. */
const RAIL_OFFSET = 0.2;
const RAIL_RADIUS = 0.008;
/** Rack rails in the plan (mm). */
const RAIL_OFFSET_MM = 200;

/** Legs, an undershelf over part of the width and nothing else: the frame of an open table (m). */
export function tableFrame(p: Parts, s: Size, topY: number, shelf: Span = { x0: -s.w / 2, x1: s.w / 2 }): void {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (s.w / 2 - LEG / 2 - SHEET);
      const z = sz * (s.d / 2 - LEG / 2 - SHEET);
      p.roundedBox("steelDark", x - LEG / 2, x + LEG / 2, 0.012, topY, z - LEG / 2, z + LEG / 2, LEG_RADIUS, "vertical");
      p.lathe("rubber", x, 0, z, [
        [0, 0],
        [LEG * 0.55, 0],
        [LEG * 0.6, 0.006],
        [LEG * 0.6, 0.012],
        [0, 0.012],
      ]);
    }
  }
  if (shelf.x1 - shelf.x0 > LEG) {
    p.roundedBox("steel", Math.max(shelf.x0, -s.w / 2 + SHEET), Math.min(shelf.x1, s.w / 2 - SHEET), UNDERSHELF, UNDERSHELF + SHEET * 2, -s.d / 2 + SHEET, s.d / 2 - SHEET, TOP_RADIUS);
  }
}

/**
 * The top of a dish table: an apron under the top sheet, the sheet `RIM` below the item height
 * with its holes, and the rim on the back, the front and the closed ends (`open` stays open).
 * Returns the height of the top sheet's surface.
 */
export function dishTableTop(p: Parts, s: Size, holes: readonly Hole[], open: readonly Edge[]): number {
  const y1 = s.h - RIM;
  const y0 = y1 - SHEET * 2;
  if (holes.length > 0) p.topWithHoles("steel", s.w, s.d, y0, y1, holes);
  else worktop(p, "steel", -s.w / 2, s.w / 2, y0, y1, -s.d / 2, s.d / 2);
  // Apron (Zarge) under the sheet at the front: it stiffens the top and hides the frame's top.
  p.roundedBox("steel", -s.w / 2, s.w / 2, y0 - 0.08, y0 + TOP_RADIUS, s.d / 2 - SHEET, s.d / 2, BODY_RADIUS, "vertical");
  // The rim: a back upstand, a rolled front edge and the closed ends, their top edges rounded.
  const t = SHEET * 1.5;
  p.roundedBox("steel", -s.w / 2, s.w / 2, y0, s.h, -s.d / 2, -s.d / 2 + t, TOP_RADIUS, "top");
  if (!open.includes("front")) {
    p.roundedBox("steel", -s.w / 2, s.w / 2, y0 + TOP_RADIUS, s.h - 0.012, s.d / 2 - t, s.d / 2, BODY_RADIUS, "vertical");
    p.rod("steel", "x", 0, s.h - 0.012, s.d / 2 - 0.012, s.w, 0.012);
  }
  const zEnd = open.includes("front") ? s.d / 2 : s.d / 2 - t;
  if (!open.includes("left")) p.roundedBox("steel", -s.w / 2, -s.w / 2 + t, y0, s.h, -s.d / 2 + t, zEnd, TOP_RADIUS, "top");
  if (!open.includes("right")) p.roundedBox("steel", s.w / 2 - t, s.w / 2, y0, s.h, -s.d / 2 + t, zEnd, TOP_RADIUS, "top");
  return y1;
}

/** Two round rails along the width that dish racks slide on, from x0 to x1, on stand-offs. */
export function rackRails(p: Parts, x0: number, x1: number, y: number, zc = 0): void {
  if (x1 - x0 < 0.05) return;
  for (const dz of [-RAIL_OFFSET, RAIL_OFFSET]) {
    p.rod("handle", "x", (x0 + x1) / 2, y + RAIL_RADIUS * 2, zc + dz, x1 - x0, RAIL_RADIUS);
    for (const x of [x0 + 0.04, x1 - 0.04]) p.rod("handle", "y", x, y + RAIL_RADIUS / 2 + 0.0005, zc + dz, RAIL_RADIUS * 3 - 0.001, RAIL_RADIUS * 0.6);
  }
}

/** The rack rails in the plan: two lines along the width from x0 to x1 (mm). */
export function rackRailsPlan(s: PlanSketch, x0: number, x1: number, yc = 0): void {
  for (const dy of [-RAIL_OFFSET_MM, RAIL_OFFSET_MM]) s.line("detail", [x0, yc + dy], [x1, yc + dy]);
}

/** An arrow along the width in the plan: the direction the racks travel (mm). */
export function flowArrow(s: PlanSketch, x0: number, x1: number, y: number, towards: Side): void {
  const head = Math.min(60, Math.abs(x1 - x0) / 3);
  const tip = towards === "right" ? x1 : x0;
  const back = towards === "right" ? -head : head;
  s.line("detail", [x0, y], [x1, y]);
  s.line("detail", [tip + back, y - head / 2], [tip, y], [tip + back, y + head / 2]);
}

/** Front of a dish table in the elevation: the top band with its rim, legs and undershelf. */
export function dishTableFront(f: Front): void {
  f.worktop();
  f.line("detail", [f.l, f.top - RIM * 1000], [f.r, f.top - RIM * 1000]);
  f.legsAndUndershelf();
}

// ---------------------------------------------------------------------------------------------
// Bowls

/**
 * Drain of a bowl (m): the outlet in its floor and, with `trap`, a pipe down and the trap's arm
 * to the wall (a wall basin hides its trap in its base).
 */
export function bowlDrain(p: Parts, cx: number, cz: number, yFloor: number, zBack: number, trap = true): void {
  // The strainer: a turned flange with a domed plug in the middle.
  p.lathe("satin", cx, yFloor + SHEET, cz, [
    [0, 0],
    [0.035, 0],
    [0.035, 0.001],
    [0.03, 0.003],
    [0.014, 0.003],
    [0.012, 0.004],
    [0.006, 0.0055],
    [0, 0.0055],
  ]);
  if (!trap) return;
  // The waste pipe down from the bowl, bent towards the wall.
  const r = 0.02;
  const yTrap = Math.max(0.05, yFloor - 0.16);
  const len = cz - zBack;
  const down = [
    { x: cx, y: yFloor, z: cz },
    { x: cx, y: yTrap + r, z: cz },
  ];
  p.tube("steelDark", len > 0.03 ? [...down, { x: cx, y: yTrap + r, z: zBack }] : [...down, { x: cx, y: yTrap, z: cz }], r, { bend: 0.04 });
}

/** Overflow slot in the back wall of a bowl (m), just under the rim. */
export function overflow(p: Parts, cx: number, zWall: number, yRim: number): void {
  p.plate("slot", cx - 0.03, cx + 0.03, yRim - 0.06, yRim - 0.045, zWall, zWall + 0.002, 0.0075);
}

/** Pressed grooves in a drainer that lead the water to the bowls (m), along the width. */
export function drainerGrooves(p: Parts, x0: number, x1: number, y: number, z0: number, z1: number, count = 6): void {
  if (x1 - x0 < 0.15) return;
  for (let i = 1; i <= count; i++) {
    const z = z0 + ((z1 - z0) * i) / (count + 1);
    p.box("steelDark", x0, x1, y - 0.003, y - 0.001, z - 0.004, z + 0.004);
  }
}

/** The drainer's grooves in the plan: three lines along the width (mm). */
export function drainerPlan(s: PlanSketch, x0: number, x1: number, y0: number, y1: number): void {
  if (x1 - x0 < 150) return;
  for (let i = 1; i <= 3; i++) {
    const y = y0 + ((y1 - y0) * i) / 4;
    s.line("detail", [x0, y], [x1, y]);
  }
}

// ---------------------------------------------------------------------------------------------
// Pre-rinse shower (Vorspülbrause): a riser at the back, a gooseneck at its top and the spray
// head hanging from it on a spring, with a mixing valve low on the riser.

const SHOWER_R = 0.013;
/** Reach of the gooseneck from the riser towards the front (m). */
const SHOWER_REACH = 0.16;
/** Radius of the spray head's nozzle ring, its widest part (m). */
const SHOWER_HEAD = 0.03;
/** Length of the spring the spray head hangs on (m), and its coils. */
const SPRING = 0.36;
const SPRING_COILS = 14;

/**
 * The pre-rinse shower in 3D: riser at (x, zBack + 0.06) from y0 up to y0 + rise, the gooseneck
 * reaching `reach` forward (m).
 */
export function preRinseShower(p: Parts, x: number, zBack: number, y0: number, rise: number, reach = SHOWER_REACH): void {
  const r = SHOWER_R;
  const z = zBack + 0.06;
  const top = y0 + rise;
  const zh = z + reach - r;
  // The rosette on the table and the riser bent over into the gooseneck, as one tube.
  p.lathe("handle", x, y0, z, [
    [0, 0],
    [r * 2.2, 0],
    [r * 2.2, 0.004],
    [r * 1.6, 0.014],
    [r * 1.2, 0.02],
    [0, 0.02],
  ]);
  const drop = 0.04;
  p.tube(
    "handle",
    [
      { x, y: y0 + 0.01, z },
      { x, y: top - r, z },
      { x, y: top - r, z: zh },
      { x, y: top - r - drop, z: zh },
    ],
    r,
    { bend: Math.min(0.06, reach / 2) },
  );
  // Wall bracket near the top of the riser.
  p.roundedBox("handle", x - 0.012, x + 0.012, top - 0.2, top - 0.17, zBack, z - r + 0.002, 0.003);
  // Mixing valve low on the riser: a turned body across it with a cross handle at each end.
  const vy = y0 + Math.min(0.18, rise * 0.2);
  p.roundedBox("handle", x - 0.06, x + 0.06, vy - 0.022, vy + 0.022, z - 0.022, z + 0.022, 0.01);
  for (const sx of [-1, 1]) {
    const hx = x + sx * 0.042;
    p.lathe("handle", hx, vy + 0.022, z, [
      [0, 0],
      [0.008, 0],
      [0.008, 0.012],
      [0, 0.012],
    ]);
    p.lathe("knob", hx, vy + 0.032, z, [
      [0, 0],
      [0.018, 0],
      [0.02, 0.004],
      [0.016, 0.01],
      [0, 0.012],
    ]);
  }
  // The spring hangs from the gooseneck: one turned coil, the spray head at its end.
  const spring = Math.min(SPRING, rise * 0.45);
  const springTop = top - r - drop;
  const coil: [number, number][] = [[0, 0]];
  const steps = SPRING_COILS * 2;
  for (let i = 0; i <= steps; i++) coil.push([i % 2 === 0 ? 0.017 : 0.024, (spring * i) / steps]);
  coil.push([0, spring]);
  p.lathe("handle", x, springTop - spring, zh, coil);
  const head = springTop - spring;
  p.lathe("handle", x, head - 0.12, zh, [
    [0, 0],
    [0.024, 0],
    [0.024, 0.02],
    [0.02, 0.05],
    [0.014, 0.1],
    [0.014, 0.12],
    [0, 0.12],
  ]);
  p.lathe("steelDark", x, head - 0.13, zh, [
    [0, 0.002],
    [SHOWER_HEAD * 0.8, 0],
    [SHOWER_HEAD, 0.004],
    [SHOWER_HEAD, 0.01],
    [0, 0.01],
  ]);
  // Trigger lever on the head and a balance arm from the riser to the spring.
  p.roundedBox("knob", x - 0.006, x + 0.006, head - 0.08, head - 0.02, zh + 0.012, zh + SHOWER_HEAD, 0.003);
  p.rod("handle", "z", x, top - spring * 0.6, (z + zh) / 2, zh - z, r * 0.4);
}

/** The gooseneck's reach that puts the front of the spray head at `zFront` (m). */
export function showerReachTo(zBack: number, zFront: number): number {
  return zFront - SHOWER_HEAD - (zBack + 0.06) + SHOWER_R;
}

/** The pre-rinse shower in the elevation: riser, gooseneck, spring and head (mm). */
export function preRinseFront(f: Front, x: number, z0: number, rise: number): void {
  const top = z0 + rise;
  const reach = 160;
  const spring = Math.min(SPRING * 1000, rise * 0.45);
  f.line("detail", [x, z0], [x, top], [x - reach, top]);
  // The spring as a zigzag under the gooseneck's end.
  const hx = x - reach;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) pts.push([hx + (i % 2 === 0 ? -15 : 15), top - (spring * i) / 8]);
  f.line("detail", ...pts);
  f.box("detail", hx - 20, hx + 20, top - spring - 130, top - spring);
  f.box("detail", x - 70, x + 70, z0 + 155, z0 + 205);
}

/** The pre-rinse shower in the plan: the riser at the back and the head in front of it (mm). */
export function preRinsePlan(s: PlanSketch, x: number): void {
  s.circle("detail", x, s.B + 60, 15);
  s.line("detail", [x, s.B + 60], [x, s.B + 60 + SHOWER_REACH * 1000]);
  s.circle("detail", x, s.B + 60 + SHOWER_REACH * 1000, 25);
}

/** Height a pre-rinse shower rises above a table top (mm). */
export const SHOWER_RISE = 1000;

// ---------------------------------------------------------------------------------------------
// Conveyor dishwashers: the tank cabinet set back under the tunnel, the tunnel over the conveyor
// cut into zones (pre-wash, wash, rinse, drying), each with a lift-up inspection door, the upper
// housing set back above the tunnel with the control panel, and the tunnel openings with their
// curtains at both ends.

/** Height of the conveyor (the racks' or belt's level) above the floor (m). */
export const CONVEYOR = 0.86;
/** Height of the top cap above the housing that carries the exhaust stub (m). */
const STUB = 0.12;
/** Height of the tunnel with its inspection doors above the conveyor (m), at most. */
const TUNNEL = 0.68;
/** Least height of the upper housing over the tunnel (m). */
const UPPER = 0.2;
/** How far the upper housing and the tank cabinet stand back from the front of the doors (m). */
const SETBACK = 0.15;
const TANK_SETBACK = 0.04;

/** Radius of an adjustable foot and the height of its pad (m), as `plinth` in parts/mesh.ts. */
const FOOT = 0.022;
const FOOT_PAD = 0.012;
/** Largest distance between two pairs of feet under a long machine (m). */
const FOOT_PITCH = 1.2;
/** Height of the tunnel opening above the conveyor at the machine's ends (m). */
const OPENING = 0.5;
/** Depth of the recess at each end in front of the curtains, and the jambs beside it (m). */
const END_RECESS = 0.12;
const JAMB = 0.08;
/** Strips of a curtain across the opening. */
const CURTAIN_STRIPS = 5;
/** Slats of the vent grille in a drying zone's door. */
const DRYER_SLATS = 4;

/** Kick plate and adjustable feet under a long machine over [x0, x1] (m). */
export function longPlinth(p: Parts, x0: number, x1: number, d: number): void {
  const zf = d / 2 - DOOR;
  p.roundedBox("steelDark", x0 + LEG, x1 - LEG, FOOT_PAD, PLINTH, -d / 2 + LEG, zf - 0.05, BODY_RADIUS, "vertical");
  const n = Math.max(1, Math.ceil((x1 - x0) / FOOT_PITCH));
  for (let i = 0; i <= n; i++) {
    const x = x0 + FOOT * 1.5 + ((x1 - x0 - FOOT * 3) * i) / n;
    for (const z of [-d / 2 + FOOT * 1.5, zf - FOOT * 1.5]) foot(p, x, z, PLINTH, FOOT);
  }
}

/** Heights of a conveyor machine of height `h` (m): the doors' top and the housing's top. */
function tunnelHeights(h: number): { doorTop: number; housingTop: number } {
  const housingTop = h - STUB;
  return { doorTop: Math.min(housingTop - UPPER, CONVEYOR + TUNNEL), housingTop };
}

/**
 * The housing of a conveyor dishwasher over [x0, x1] (m): the tank cabinet set back under the
 * doors, the tunnel with one lift-up inspection door per zone (`zones` are their lengths from
 * the left; the zone `dryZone` is a drying zone with a vent grille), the upper housing set back
 * above it with the control panel over the zone `panelZone`, the tunnel openings with rack rails
 * and curtains at both ends and the exhaust stub on top of the first zone.
 */
export function tunnelHousing(p: Parts, s: Size, x0: number, x1: number, zones: readonly number[], panelZone: number, dryZone = -1): void {
  const zb = -s.d / 2;
  const zf = s.d / 2 - DOOR;
  const zr = zf - SETBACK;
  const zLeaf = zf + DOOR / 2;
  const { doorTop, housingTop } = tunnelHeights(s.h);
  const opening = Math.min(CONVEYOR + OPENING, doorTop - 0.05);
  longPlinth(p, x0, x1, s.d);
  // The tank cabinet stands back under the doors: one plain front with a joint at each zone and
  // a drip rail under the doors.
  p.roundedBox("steel", x0, x1, PLINTH, CONVEYOR - 0.02, zb, zf - TANK_SETBACK, BODY_RADIUS, "vertical");
  p.roundedBox("steelDark", x0, x1, CONVEYOR - 0.025, CONVEYOR, zb + 0.01, zLeaf, BODY_RADIUS, "top", "z");
  // The tunnel: closed between the end recesses, where the racks enter and leave below a lintel.
  p.roundedBox("steel", x0 + END_RECESS, x1 - END_RECESS, CONVEYOR, doorTop, zb, zf, BODY_RADIUS);
  for (const [a, b, face] of [
    [x0, x0 + END_RECESS, x0 + END_RECESS - 0.004],
    [x1 - END_RECESS, x1, x1 - END_RECESS],
  ]) {
    p.roundedBox("steel", a, b, opening, doorTop, zb, zf, HOUSING_RADIUS);
    p.roundedBox("steel", a, b, CONVEYOR, opening + HOUSING_RADIUS, zb, zb + JAMB, HOUSING_RADIUS, "vertical");
    p.roundedBox("steel", a, b, CONVEYOR, opening + HOUSING_RADIUS, zf - JAMB, zf, HOUSING_RADIUS, "vertical");
    // The dark tunnel behind the opening.
    p.box("slot", face - 0.002, face, CONVEYOR, opening, zb + JAMB, zf - JAMB);
    rackRails(p, a, b, CONVEYOR, 0);
    // The curtain of rubber strips hangs at the tunnel's face, a little gap between the strips.
    const cw = (s.d - DOOR - 2 * JAMB) / CURTAIN_STRIPS;
    for (let i = 0; i < CURTAIN_STRIPS; i++) {
      const z = zb + JAMB + i * cw;
      p.roundedBox("rubber", face, face + 0.004, CONVEYOR + 0.04, opening, z + 0.003, z + cw - 0.003, 0.0015, "vertical", "x");
    }
  }
  // The upper housing, set back above the tunnel, with a dark ledge on the tunnel's top and a
  // cap carrying the exhaust stub.
  p.roundedBox("steel", x0, x1, doorTop + 0.008, housingTop, zb, zr, HOUSING_RADIUS);
  p.roundedBox("steelDark", x0, x1, doorTop, doorTop + 0.008, zb + 0.01, zLeaf, BODY_RADIUS, "top", "z");
  p.roundedBox("steelDark", x0 + 0.01, x1 - 0.01, housingTop - 0.002, housingTop + 0.01, zb + 0.01, zr - 0.01, BODY_RADIUS);
  let x = x0;
  zones.forEach((len, i) => {
    const a = x + GAP;
    const b = x + len - GAP;
    const c = (a + b) / 2;
    if (i > 0) p.box("slot", x - 0.002, x + 0.002, PLINTH + 0.01, CONVEYOR - 0.03, zf - TANK_SETBACK, zf - TANK_SETBACK + 0.001);
    // The inspection door lifts up: its grip runs along its lower edge.
    p.roundedBox("steel", a, b, CONVEYOR + GAP, doorTop - GAP, zf, zLeaf, DOOR_RADIUS, "top", "z");
    const hl = Math.min(0.25, len * 0.35);
    p.barHandle("x", c - hl, c + hl, CONVEYOR + 0.05, zLeaf, s.d / 2);
    if (i === 0) ratingPlate(p, b - 0.06, doorTop - 0.05, zLeaf, 0.06, 0.035);
    if (i === dryZone) {
      // The drying zone's door has a vent grille in its upper part.
      const g0 = doorTop - 0.24;
      const g1 = doorTop - 0.06;
      p.plate("slot", a + 0.05, b - 0.05, g0, g1, zLeaf - 0.0005, zLeaf + 0.0015, 0.01);
      for (let k = 1; k <= DRYER_SLATS; k++) {
        const y = g0 + ((g1 - g0) * k) / (DRYER_SLATS + 1);
        p.roundedBox("steel", a + 0.05, b - 0.05, y - 0.008, y + 0.008, zLeaf, zLeaf + 0.006, 0.003, "top", "z");
      }
    }
    if (i === panelZone) {
      // The control panel on the upper housing's front: display, buttons and the main switch.
      const y0 = doorTop + 0.04;
      const y1 = housingTop - 0.04;
      const zFace = zr + 0.012;
      p.roundedBox("panelDark", a + 0.02, b - 0.02, y0, y1, zr - 0.002, zFace, BODY_RADIUS, "top", "z");
      const dw = Math.min(0.2, (b - a) * 0.3);
      display(p, a + 0.05 + dw / 2, (y0 + y1) / 2, dw, Math.min(0.08, (y1 - y0) * 0.6), zFace);
      for (let k = 0; k < 3; k++) button(p, b - 0.07 - k * 0.045, (y0 + y1) / 2, zFace, 0.011);
    }
    x += len;
  });
  // Exhaust stub on the top cap over the first zone: a turned collar and the pipe's flange.
  const sx = x0 + (zones[0] ?? 0) / 2;
  const sh = s.h - housingTop - 0.01;
  p.lathe("steel", sx, housingTop + 0.01, -s.d / 4, [
    [0, 0],
    [0.1, 0],
    [0.1, 0.006],
    [0.08, 0.012],
    [0.08, sh - 0.01],
    [0.085, sh - 0.01],
    [0.085, sh],
    [0.072, sh],
    [0.072, sh - 0.02],
    [0, sh - 0.02],
  ]);
}

/** The housing of a conveyor dishwasher in the elevation over [a, b] (mm, left to right). */
export function tunnelFront(f: Front, a: number, b: number, zones: readonly number[], panelZone: number, dryZone = -1): void {
  const z0 = f.z0;
  const conveyor = z0 + CONVEYOR * 1000;
  const h = tunnelHeights(f.item.height / 1000);
  const doorTop = z0 + h.doorTop * 1000;
  const housingTop = z0 + h.housingTop * 1000;
  const I = FRONT_INSET / 4;
  f.box("detail", a, b, z0 + FEET, housingTop);
  f.line("detail", [a, conveyor], [b, conveyor]);
  f.line("detail", [a, doorTop], [b, doorTop]);
  let x = a;
  zones.forEach((len, i) => {
    const xa = x + I;
    const xb = x + len - I;
    if (i > 0) f.line("detail", [x, z0 + FEET], [x, conveyor]);
    f.box("detail", xa, xb, conveyor + I, doorTop - I);
    const c = (xa + xb) / 2;
    const hl = Math.min(250, len * 0.35);
    f.line("detail", [c - hl, conveyor + 50], [c + hl, conveyor + 50]);
    if (i === dryZone) {
      for (let k = 1; k <= DRYER_SLATS; k++) {
        const z = doorTop - 240 + (180 * k) / (DRYER_SLATS + 1);
        f.line("detail", [xa + 50, z], [xb - 50, z]);
      }
    }
    if (i === panelZone) {
      f.box("detail", xa + 20, xb - 20, doorTop + 40, housingTop - 40, "item-dark");
      f.box("detail", xa + 50, Math.min(xb - 140, xa + 250), doorTop + 70, housingTop - 70);
    }
    x += len;
  });
}

/** Zone lines across a conveyor dishwasher's housing in the plan, the upper housing's edge (mm). */
export function tunnelPlan(s: PlanSketch, a: number, zones: readonly number[]): void {
  let x = a;
  const len = zones.reduce((t, z) => t + z, 0);
  s.rect("detail", a, s.B + INSET / 2, a + len, s.F - INSET / 2);
  s.line("detail", [a, s.F - (DOOR + SETBACK) * 1000], [a + len, s.F - (DOOR + SETBACK) * 1000]);
  for (const zl of zones.slice(0, -1)) {
    x += zl;
    s.line("detail", [x, s.B + INSET / 2], [x, s.F - INSET / 2]);
  }
  s.circle("detail", a + (zones[0] ?? 0) / 2, -s.d / 4, 80);
}
