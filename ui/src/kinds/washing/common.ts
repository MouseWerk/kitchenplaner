// Helpers the washing kinds share: bowl layouts, dish table tops with rack rails, the pre-rinse
// shower, drains under bowls and the tunnel housing of conveyor dishwashers. Plan and elevation
// helpers work in millimetres, mesh helpers in metres (see kinds/README.md).

import { FEET, INSET as FRONT_INSET, type Front } from "../parts/elevation";
import { DOOR, GAP, LEG, PLINTH, SHEET, UNDERSHELF, type Hole, type Parts, type Size } from "../parts/mesh";
import { INSET, type PlanSketch } from "../parts/plan";

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
      p.box("steelDark", x - LEG / 2, x + LEG / 2, 0, topY, z - LEG / 2, z + LEG / 2);
      p.cyl("rubber", x, z, 0, 0.012, LEG * 0.6);
    }
  }
  if (shelf.x1 - shelf.x0 > LEG) {
    p.box("steel", Math.max(shelf.x0, -s.w / 2 + SHEET), Math.min(shelf.x1, s.w / 2 - SHEET), UNDERSHELF, UNDERSHELF + SHEET * 2, -s.d / 2 + SHEET, s.d / 2 - SHEET);
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
  else p.box("steel", -s.w / 2, s.w / 2, y0, y1, -s.d / 2, s.d / 2);
  // Apron (Zarge) under the sheet at the front: it stiffens the top and hides the frame's top.
  p.box("steel", -s.w / 2, s.w / 2, y0 - 0.08, y0, s.d / 2 - SHEET, s.d / 2);
  // The rim: a back upstand, a rolled front edge and the closed ends.
  const t = SHEET * 1.5;
  p.box("steel", -s.w / 2, s.w / 2, y0, s.h, -s.d / 2, -s.d / 2 + t);
  if (!open.includes("front")) {
    p.box("steel", -s.w / 2, s.w / 2, y0, s.h - 0.012, s.d / 2 - t, s.d / 2);
    p.rod("steel", "x", 0, s.h - 0.012, s.d / 2 - 0.012, s.w, 0.012);
  }
  if (!open.includes("left")) p.box("steel", -s.w / 2, -s.w / 2 + t, y0, s.h, -s.d / 2, s.d / 2);
  if (!open.includes("right")) p.box("steel", s.w / 2 - t, s.w / 2, y0, s.h, -s.d / 2, s.d / 2);
  return y1;
}

/** Two round rails along the width that dish racks slide on, from x0 to x1, on stand-offs. */
export function rackRails(p: Parts, x0: number, x1: number, y: number, zc = 0): void {
  if (x1 - x0 < 0.05) return;
  for (const dz of [-RAIL_OFFSET, RAIL_OFFSET]) {
    p.rod("handle", "x", (x0 + x1) / 2, y + RAIL_RADIUS * 2, zc + dz, x1 - x0, RAIL_RADIUS);
    for (const x of [x0 + 0.04, x1 - 0.04]) p.box("handle", x - 0.006, x + 0.006, y, y + RAIL_RADIUS * 2, zc + dz - 0.004, zc + dz + 0.004);
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
  p.cyl("steelDark", cx, cz, yFloor + SHEET, yFloor + SHEET + 0.003, 0.035);
  p.cyl("steelDark", cx, cz, yFloor + SHEET + 0.003, yFloor + SHEET + 0.005, 0.012);
  if (!trap) return;
  const yTrap = Math.max(0.05, yFloor - 0.16);
  p.cyl("steelDark", cx, cz, yTrap, yFloor, 0.02);
  const len = cz - zBack;
  if (len > 0.03) p.rod("steelDark", "z", cx, yTrap + 0.02, zBack + len / 2, len, 0.02);
}

/** Overflow slot in the back wall of a bowl (m), just under the rim. */
export function overflow(p: Parts, cx: number, zWall: number, yRim: number): void {
  p.box("steelDark", cx - 0.03, cx + 0.03, yRim - 0.06, yRim - 0.045, zWall, zWall + 0.002);
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
const SPRING_COILS = 9;

/**
 * The pre-rinse shower in 3D: riser at (x, zBack + 0.06) from y0 up to y0 + rise, the gooseneck
 * reaching `reach` forward (m).
 */
export function preRinseShower(p: Parts, x: number, zBack: number, y0: number, rise: number, reach = SHOWER_REACH): void {
  const r = SHOWER_R;
  const z = zBack + 0.06;
  const top = y0 + rise;
  // Riser with its foot and a wall bracket near the top.
  p.cyl("handle", x, z, y0, y0 + 0.02, r * 2.2);
  p.cyl("handle", x, z, y0, top - r, r);
  p.box("handle", x - 0.012, x + 0.012, top - 0.2, top - 0.17, zBack, z);
  // Mixing valve with two cross handles low on the riser.
  const vy = y0 + Math.min(0.18, rise * 0.2);
  p.box("handle", x - 0.07, x + 0.07, vy - 0.025, vy + 0.025, z - 0.025, z + 0.025);
  for (const sx of [-1, 1]) p.cyl("knob", x + sx * 0.08, z, vy + 0.025, vy + 0.035, 0.022);
  // Gooseneck at the top, reaching forward.
  p.rod("handle", "z", x, top - r, z + reach / 2, reach, r);
  const zh = z + reach - r;
  // The spring hangs from the gooseneck, the hose inside it, the spray head at its end.
  const spring = Math.min(SPRING, rise * 0.45);
  p.rod("rubber", "y", x, top - r - spring / 2, zh, spring, r * 0.6);
  for (let i = 0; i < SPRING_COILS; i++) {
    const y = top - r * 2 - (i * (spring - r)) / (SPRING_COILS - 1);
    p.cyl("handle", x, zh, y - 0.003, y + 0.003, 0.024);
  }
  const head = top - r - spring;
  p.cyl("handle", x, zh, head - 0.12, head, 0.022);
  p.cyl("steelDark", x, zh, head - 0.13, head - 0.12, SHOWER_HEAD);
  // Trigger lever on the head and a balance arm from the riser to the spring.
  p.box("knob", x - 0.006, x + 0.006, head - 0.08, head - 0.02, zh + 0.018, zh + SHOWER_HEAD);
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
  p.box("steelDark", x0 + LEG, x1 - LEG, FOOT_PAD, PLINTH, -d / 2 + LEG, zf - 0.05);
  const n = Math.max(1, Math.ceil((x1 - x0) / FOOT_PITCH));
  for (let i = 0; i <= n; i++) {
    const x = x0 + FOOT * 1.5 + ((x1 - x0 - FOOT * 3) * i) / n;
    for (const z of [-d / 2 + FOOT * 1.5, zf - FOOT * 1.5]) {
      p.cyl("steelDark", x, z, FOOT_PAD, PLINTH, FOOT * 0.6);
      p.cyl("rubber", x, z, 0, FOOT_PAD, FOOT);
    }
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
  const { doorTop, housingTop } = tunnelHeights(s.h);
  const opening = Math.min(CONVEYOR + OPENING, doorTop - 0.05);
  longPlinth(p, x0, x1, s.d);
  // The tank cabinet stands back under the doors: one plain front with a joint at each zone and
  // a drip rail under the doors.
  p.box("steel", x0, x1, PLINTH, CONVEYOR, zb, zf - TANK_SETBACK);
  p.box("steelDark", x0, x1, CONVEYOR - 0.025, CONVEYOR, zf - TANK_SETBACK, zf + DOOR / 2);
  // The tunnel: closed between the end recesses, where the racks enter and leave below a lintel.
  p.box("steel", x0 + END_RECESS, x1 - END_RECESS, CONVEYOR, doorTop, zb, zf);
  for (const [a, b, face] of [
    [x0, x0 + END_RECESS, x0 + END_RECESS - 0.004],
    [x1 - END_RECESS, x1, x1 - END_RECESS],
  ]) {
    p.box("steel", a, b, opening, doorTop, zb, zf);
    p.box("steel", a, b, CONVEYOR, opening, zb, zb + JAMB);
    p.box("steel", a, b, CONVEYOR, opening, zf - JAMB, zf);
    rackRails(p, a, b, CONVEYOR, 0);
    // The curtain of rubber strips hangs at the tunnel's face, a little gap between the strips.
    const cw = (s.d - DOOR - 2 * JAMB) / CURTAIN_STRIPS;
    for (let i = 0; i < CURTAIN_STRIPS; i++) {
      const z = zb + JAMB + i * cw;
      p.box("rubber", face, face + 0.004, CONVEYOR + 0.04, opening, z + 0.003, z + cw - 0.003);
    }
  }
  // The upper housing, set back above the tunnel, with a dark ledge on the tunnel's top.
  p.box("steel", x0, x1, doorTop, housingTop, zb, zr);
  p.box("steelDark", x0, x1, doorTop, doorTop + 0.008, zr, zf + DOOR / 2);
  p.box("steelDark", x0, x1, housingTop, housingTop + 0.01, zb, zr);
  let x = x0;
  zones.forEach((len, i) => {
    const a = x + GAP;
    const b = x + len - GAP;
    const c = (a + b) / 2;
    if (i > 0) p.box("steelDark", x - 0.002, x + 0.002, PLINTH, CONVEYOR - 0.025, zf - TANK_SETBACK, zf - TANK_SETBACK + 0.002);
    // The inspection door lifts up: its grip runs along its lower edge.
    p.box("steel", a, b, CONVEYOR + GAP, doorTop - GAP, zf, zf + DOOR / 2);
    const hl = Math.min(0.25, len * 0.35);
    p.barHandle("x", c - hl, c + hl, CONVEYOR + 0.05, zf + DOOR / 2, s.d / 2);
    if (i === dryZone) {
      // The drying zone's door has a vent grille in its upper part.
      const g0 = doorTop - 0.24;
      const g1 = doorTop - 0.06;
      p.box("panelDark", a + 0.05, b - 0.05, g0, g1, zf + DOOR / 2, zf + DOOR / 2 + 0.002);
      for (let k = 1; k <= DRYER_SLATS; k++) {
        const y = g0 + ((g1 - g0) * k) / (DRYER_SLATS + 1);
        p.box("steel", a + 0.05, b - 0.05, y - 0.006, y + 0.006, zf + DOOR / 2, zf + DOOR / 2 + 0.006);
      }
    }
    if (i === panelZone) {
      // The control panel on the upper housing's front: display and two buttons.
      const y0 = doorTop + 0.04;
      const y1 = housingTop - 0.04;
      p.box("panelDark", a + 0.02, b - 0.02, y0, y1, zr, zr + 0.012);
      p.box("glassDark", a + 0.05, Math.min(b - 0.14, a + 0.25), y0 + 0.03, y1 - 0.03, zr + 0.012, zr + 0.015);
      for (let k = 0; k < 2; k++) p.rod("knob", "z", b - 0.06 - k * 0.05, (y0 + y1) / 2, zr + 0.016, 0.008, 0.015);
    }
    x += len;
  });
  // Exhaust stub on the top cap over the first zone.
  const sx = x0 + (zones[0] ?? 0) / 2;
  p.cyl("steel", sx, -s.d / 4, housingTop, s.h - 0.01, 0.08);
  p.cyl("steelDark", sx, -s.d / 4, s.h - 0.01, s.h, 0.085);
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
