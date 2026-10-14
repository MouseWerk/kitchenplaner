// Parts the cooking appliances share: the module of a cooking line (feet, base, control strip)
// in 3D and in the elevation, the grid of cooking zones on its top, gas burners and hotplates,
// and the stand under table-top units (combi ovens, deck ovens).

import { FEET, INSET, LEG as FRONT_LEG, PANEL, TOP, UNDERSHELF as FRONT_UNDERSHELF, type Front } from "../parts/elevation";
import { CONTROLS, controlKnobs, DOOR, doors, GAP, LEG, ovenWindow, PLINTH, plinth, SHEET, UNDERSHELF, type Parts, type Size } from "../parts/mesh";
import { CONTROL_STRIP, INSET as PLAN_INSET, type PlanSketch } from "../parts/plan";

/** Width taken by one column of cooking zones (two zones front to back, m). */
const ZONE_COLUMN_WIDTH = 0.4;
/** Share of a zone's cell that its radius takes. */
const ZONE_FILL = 0.32;
/** How far hotplates and zone marks stand over the cooking top (m). */
export const PROUD = 0.003;
/** Height of the cast pan supports over the burner tray of a gas top (m). */
export const PAN_SUPPORT = 0.03;
/** Width of a bar of the cast pan supports (m). */
const SUPPORT_BAR = 0.012;
/** Thickness of the control panel sheet on the front of the body (m); the knobs stand on it. */
const PANEL_SHEET = 0.002;
/** Door width of the base cabinets of a cooking line (m): 400 = 1 door, 800 and 1200 = 2. */
const LINE_DOOR = 0.5;
/** Height of the short feet of a table-top unit on its stand (m). */
const TABLE_FEET = 0.04;
/** Pitch of the tray runners of a stand (m, GN trays). */
const RUNNER_PITCH = 0.07;

/** Columns of cooking zones on a top of the given width (mm or m with `per` in the same unit). */
export function columns(width: number, per = ZONE_COLUMN_WIDTH * 1000): number {
  return Math.max(1, Math.round(width / per));
}

/** Positions of cooking zones in a grid of rows and columns over the top (centres, radius; m). */
export function zones(s: Size, cols: number, rows: number): { x: number; z: number; r: number }[] {
  const cw = s.w / cols;
  const rd = (s.d - CONTROLS) / rows;
  const r = Math.min(cw, rd) * ZONE_FILL;
  const out = [];
  for (let c = 0; c < cols; c++) {
    for (let k = 0; k < rows; k++) out.push({ x: -s.w / 2 + cw * (c + 0.5), z: -s.d / 2 + rd * (k + 0.5), r });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Plan

/** The area of a cooking top behind the control strip in the plan (mm). */
export function planTop(s: PlanSketch): { x0: number; x1: number; y0: number; y1: number } {
  return { x0: s.L + PLAN_INSET, x1: s.R - PLAN_INSET, y0: s.B + PLAN_INSET, y1: s.F - CONTROL_STRIP };
}

/**
 * Burners of a gas top in the plan: per cooking zone the burner (two circles: crown and cap) in
 * the square of its pan support.
 */
export function planBurners(s: PlanSketch, cols: number, rows: number) {
  const { x0, x1, y0, y1 } = planTop(s);
  const cw = (x1 - x0) / cols;
  const rh = (y1 - y0) / rows;
  for (let c = 0; c < cols; c++) {
    for (let k = 0; k < rows; k++) {
      const cx = x0 + cw * (c + 0.5);
      const cy = y0 + rh * (k + 0.5);
      const half = Math.min(cw, rh) * 0.45;
      s.rect("detail", cx - half, cy - half, cx + half, cy + half);
      s.circle("detail", cx, cy, half * 0.55);
      s.circle("detail", cx, cy, half * 0.25);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Elevation

/** What a module of the cooking line has below its top. */
export type LineBase = "oven" | "open" | "doors" | "heated";

/** What runs across the front under the top: a control strip with knobs, a drawer or nothing. */
export type LineStrip = "knobs" | "drawer" | "none";

/** Number of base doors of a cooking line module in the elevation and 3D. */
function lineDoors(width: number): number {
  return Math.max(1, Math.round(width / LINE_DOOR));
}

/**
 * Elevation front of a cooking line module: the top band, the control strip with `knobs` knobs
 * (or a drawer) and the base: an oven door with its window, an open base with a shelf, or doors.
 */
export function lineFront(f: Front, knobs: number, base: LineBase, strip: LineStrip = "knobs") {
  const { l, r, top } = f;
  f.worktop();
  let baseTop = top - TOP;
  if (strip === "knobs") {
    f.panel(top - TOP - PANEL, top - TOP, knobs);
    baseTop = top - TOP - PANEL;
  } else if (strip === "drawer") {
    f.drawers(1, top - TOP - PANEL, top - TOP - INSET / 4);
    baseTop = top - TOP - PANEL;
  }
  const b0 = f.z0 + FEET;
  const b1 = baseTop - INSET / 2;
  if (b1 - b0 < INSET * 2) return;
  if (base === "oven") {
    f.box("detail", l + INSET, r - INSET, b0, b1);
    if (b1 - b0 > INSET * 8 && f.w > INSET * 8) f.box("detail", l + INSET * 3, r - INSET * 3, b0 + INSET * 2, b1 - INSET * 3, "glass");
    f.line("detail", [l + INSET * 3, b1 - INSET * 1.5], [r - INSET * 3, b1 - INSET * 1.5]);
  } else if (base === "open") {
    f.box("detail", l + INSET / 2, r - INSET / 2, b0, b1, "item-dark");
    f.line("detail", [l + INSET / 2, (b0 + b1) / 2], [r - INSET / 2, (b0 + b1) / 2]);
  } else {
    f.doors(lineDoors(f.w / 1000), b0, b1);
    if (base === "heated") {
      // Vent slots over the doors of a heated cabinet.
      for (let i = 1; i <= 3; i++) f.line("detail", [l + INSET * 2, b1 - INSET * 0.5 * i], [l + INSET * 5, b1 - INSET * 0.5 * i]);
    }
  }
}

/** The stand under a raised table-top unit in the elevation: two legs and the undershelf. */
export function standFront(f: Front) {
  const { l, r, z0 } = f;
  if (z0 <= 0) return;
  f.box("item", l, l + FRONT_LEG, 0, z0, "item");
  f.box("item", r - FRONT_LEG, r, 0, z0, "item");
  if (z0 > FRONT_UNDERSHELF + INSET) f.line("detail", [l + FRONT_LEG, FRONT_UNDERSHELF], [r - FRONT_LEG, FRONT_UNDERSHELF]);
  f.line("item", [l, z0], [r, z0]);
}

// ---------------------------------------------------------------------------------------------
// 3D

/** Options of a cooking line module in 3D. */
export interface LineOptions {
  base: LineBase;
  /** Knobs on the control strip (with `strip` "knobs"). */
  knobs: number;
  /** Height of the underside of the top (m); the kind adds the top itself. */
  underTop: number;
  strip?: LineStrip;
  /**
   * Height below which the body is solid (m); above it only the outer sheets stand, so tanks
   * and basins set into the top stay visible from above. Default: solid up to the top.
   */
  solidTo?: number;
}

/**
 * A module of the cooking line up to the underside of its top: feet and kick plate, the body,
 * the base (an oven with a window, an open base with a shelf, doors) and the control strip with
 * its knobs (or a drawer). Returns the height of the top of the base (m).
 */
export function lineModule(p: Parts, s: Size, o: LineOptions): number {
  const { w, d } = s;
  const strip = o.strip ?? "knobs";
  const yc = strip === "none" ? o.underTop : o.underTop - CONTROLS;
  const zBody = d / 2 - DOOR;
  plinth(p, w, d);
  const solidTo = Math.min(o.solidTo ?? o.underTop, o.underTop);
  if (o.base === "open") {
    // Sides, back and floor of an open base with a shelf in the middle; dark inside.
    const top = Math.min(solidTo, o.underTop);
    p.box("steel", -w / 2, -w / 2 + SHEET, PLINTH, top, -d / 2, zBody);
    p.box("steel", w / 2 - SHEET, w / 2, PLINTH, top, -d / 2, zBody);
    p.box("steelDark", -w / 2 + SHEET, w / 2 - SHEET, PLINTH, top, -d / 2, -d / 2 + SHEET);
    p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, PLINTH, PLINTH + SHEET, -d / 2 + SHEET, zBody);
    p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, (PLINTH + yc) / 2, (PLINTH + yc) / 2 + SHEET, -d / 2 + SHEET, zBody - SHEET);
    // The body over the opening, behind the control strip, or at least the opening's ceiling.
    if (top > yc) p.box("steel", -w / 2, w / 2, yc, top, -d / 2, zBody);
    else p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, yc - SHEET, yc, -d / 2 + SHEET, zBody);
  } else {
    p.box("steel", -w / 2, w / 2, PLINTH, solidTo, -d / 2, zBody);
  }
  if (solidTo < o.underTop) {
    // Only the outer sheets above the solid part: sides, back and front.
    p.box("steel", -w / 2, -w / 2 + SHEET, solidTo, o.underTop, -d / 2, zBody);
    p.box("steel", w / 2 - SHEET, w / 2, solidTo, o.underTop, -d / 2, zBody);
    p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, solidTo, o.underTop, -d / 2, -d / 2 + SHEET);
    p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, solidTo, o.underTop, zBody - SHEET, zBody);
  }
  if (o.base === "oven") {
    p.box("steel", -w / 2 + GAP, w / 2 - GAP, PLINTH + GAP, yc - GAP, zBody, d / 2 - DOOR / 2);
    ovenWindow(p, -w / 2, w / 2, PLINTH, yc - 0.08, d / 2 - DOOR / 2);
    const len = Math.min(0.5, w * 0.6);
    p.barHandle("x", -len / 2, len / 2, yc - 0.05, d / 2 - DOOR / 2, d / 2);
  } else if (o.base === "doors" || o.base === "heated") {
    doors(p, -w / 2, w / 2, PLINTH, yc, d, lineDoors(w), "vertical");
    if (o.base === "heated") {
      // Vent slots at the top of the cabinet front.
      for (let i = 0; i < 3; i++) {
        const y = yc - 0.03 - i * 0.02;
        p.box("steelDark", -w / 2 + 0.05, -w / 2 + 0.15, y - 0.004, y, d / 2 - DOOR / 2, d / 2 - DOOR / 2 + 0.002);
      }
    }
  }
  if (strip === "knobs") {
    p.box("steel", -w / 2 + GAP, w / 2 - GAP, yc + GAP, o.underTop - GAP, zBody, zBody + PANEL_SHEET);
    controlKnobs(p, w, (yc + o.underTop) / 2, zBody + PANEL_SHEET, d / 2, o.knobs);
  } else if (strip === "drawer") {
    p.box("steel", -w / 2 + GAP, w / 2 - GAP, yc + GAP, o.underTop - GAP, zBody, d / 2 - DOOR / 2);
    const len = Math.min(0.3, w * 0.6);
    p.barHandle("x", -len / 2, len / 2, (yc + o.underTop) / 2, d / 2 - DOOR / 2, d / 2);
  }
  return yc;
}

/**
 * Open gas burners with cast pan supports over a burner tray whose top is at `trayTop`; the pan
 * supports reach up to `top` (m). One burner per cell of `cols` × `rows` behind the control strip.
 */
export function gasBurners(p: Parts, s: Size, cols: number, rows: number, trayTop: number, top: number) {
  const m = 0.02;
  const x0 = -s.w / 2 + m;
  const x1 = s.w / 2 - m;
  const z0 = -s.d / 2 + m;
  const z1 = s.d / 2 - CONTROLS;
  const cw = (x1 - x0) / cols;
  const rd = (z1 - z0) / rows;
  const b = SUPPORT_BAR / 2;
  // The frame of the pan supports: bars along the rows and the columns.
  for (let k = 0; k <= rows; k++) {
    const z = Math.min(z1 - b, Math.max(z0 + b, z0 + rd * k));
    p.box("knob", x0, x1, trayTop, top, z - b, z + b);
  }
  for (let c = 0; c <= cols; c++) {
    const x = Math.min(x1 - b, Math.max(x0 + b, x0 + cw * c));
    p.box("knob", x - b, x + b, trayTop, top, z0, z1);
  }
  for (let c = 0; c < cols; c++) {
    for (let k = 0; k < rows; k++) {
      const cx = x0 + cw * (c + 0.5);
      const cz = z0 + rd * (k + 0.5);
      const r = Math.min(cw, rd) * 0.22;
      // Burner crown and cap.
      p.cyl("steelDark", cx, cz, trayTop, trayTop + 0.015, r);
      p.cyl("knob", cx, cz, trayTop + 0.015, trayTop + 0.022, r * 0.7);
      // Four fingers of the pan support from the frame towards the burner.
      const fy = top - 0.01;
      p.box("knob", cx - cw / 2, cx - r * 1.2, fy, top, cz - b, cz + b);
      p.box("knob", cx + r * 1.2, cx + cw / 2, fy, top, cz - b, cz + b);
      p.box("knob", cx - b, cx + b, fy, top, cz - rd / 2, cz - r * 1.2);
      p.box("knob", cx - b, cx + b, fy, top, cz + r * 1.2, cz + rd / 2);
    }
  }
}

/** Round cast hotplates with a steel rim on a top whose surface is at `topY`, reaching `top` (m). */
export function hotplates(p: Parts, s: Size, cols: number, rows: number, topY: number, top: number) {
  for (const z of zones(s, cols, rows)) {
    p.cyl("steel", z.x, z.z, topY, top - PROUD, z.r * 1.08);
    p.cyl("plate", z.x, z.z, topY, top, z.r);
  }
}

/**
 * The stand under a raised table-top unit, from the floor (y = -elevation) up to the unit:
 * four legs, a bottom shelf and tray runners on both sides.
 */
export function standMesh(p: Parts, s: Size, elev: number) {
  if (elev <= 0) return;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (s.w / 2 - LEG / 2);
      const z = sz * (s.d / 2 - LEG / 2);
      p.box("steelDark", x - LEG / 2, x + LEG / 2, -elev, 0, z - LEG / 2, z + LEG / 2);
    }
  }
  p.box("steel", -s.w / 2 + LEG, s.w / 2 - LEG, -elev, -elev + LEG, -s.d / 2 + LEG / 2, -s.d / 2 + LEG);
  p.box("steel", -s.w / 2 + LEG, s.w / 2 - LEG, -elev + UNDERSHELF, -elev + UNDERSHELF + SHEET, -s.d / 2 + LEG / 2, s.d / 2 - LEG / 2);
  // Tray runners on the inside of the side frames, below the unit.
  const top = -0.06;
  const n = Math.min(6, Math.floor((top - (-elev + UNDERSHELF + 0.08)) / RUNNER_PITCH));
  for (let i = 0; i < n; i++) {
    const y = top - i * RUNNER_PITCH;
    p.box("steel", -s.w / 2 + LEG, -s.w / 2 + LEG + 0.015, y - 0.006, y, -s.d / 2 + LEG, s.d / 2 - LEG);
    p.box("steel", s.w / 2 - LEG - 0.015, s.w / 2 - LEG, y - 0.006, y, -s.d / 2 + LEG, s.d / 2 - LEG);
  }
}

/** Short feet under a table-top unit (on its stand) or the taller feet of a floor unit (m). */
export function unitFeet(p: Parts, s: Size, raised: boolean): number {
  const h = raised ? TABLE_FEET : PLINTH;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (s.w / 2 - 0.04);
      const z = sz * (s.d / 2 - DOOR - 0.04);
      p.cyl("steelDark", x, z, 0.012, h, 0.015);
      p.cyl("rubber", x, z, 0, 0.012, 0.022);
    }
  }
  return h;
}
