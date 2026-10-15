// Parts the refrigeration units share: insulated doors with gaskets and hinges, louvre grilles in
// front of the machine compartment, temperature displays, and the section counts that the plan,
// the elevations and 3D of refrigerated counters agree on.

import { INSET, type Front } from "../parts/elevation";
import { GAP, PLINTH, plinth, SHEET, SHELF_PITCH, type Parts, type Size } from "../parts/mesh";
import { INSET as PLAN_INSET, type PlanSketch } from "../parts/plan";
import { MM_PER_UNIT } from "../../three/shared";

/** Millimetres to metres. */
export const m = (mm: number) => mm / MM_PER_UNIT;

// 3D (m)
/**
 * Depth of the door zone in front of a refrigerated cabinet's body: a 30 mm insulated leaf and a
 * handle standing 20 mm proud of it. The body stops this far behind the item's front.
 */
export const FRONT = 0.05;
/** How far a handle stands proud of its door leaf. */
export const STANDOFF = 0.02;
/** Width of a door hinge seen from the front. */
const HINGE = 0.012;
/** Thickness of the rubber gasket that shows in the gap around a door. */
const GASKET = 0.004;
/** Width of the frame around a glass door pane. */
export const GLASS_FRAME = 0.05;
/** Height of the fascia with the controls on top of upright cabinets (m). */
export const FASCIA = 0.12;
/** Pitch of the slats of a louvre grille. */
const SLAT_PITCH = 0.03;
/** Most slats a grille gets, so a tall grille does not cost many parts. */
const MAX_SLATS = 8;
/** Size of a temperature display (m). */
const DISPLAY = { w: 0.1, h: 0.035 };

// Elevation (mm)
/** Base (feet and kick plate) below the doors of cabinets and counters (mm, the 3D `PLINTH`). */
export const BASE_MM = PLINTH * MM_PER_UNIT;
/** Fascia with the controls on top of upright cabinets (mm). */
export const FASCIA_MM = FASCIA * MM_PER_UNIT;
/** Gap between door leaves as drawn in the elevation (mm). */
export const LEAF_GAP_MM = 10;
/** Frame around a glass pane in the elevation (mm). */
export const GLASS_FRAME_MM = GLASS_FRAME * MM_PER_UNIT;
/** Length of a vertical door handle in the elevation (mm). */
const HANDLE_MM = 400;
/** Height of the middle of a door handle above the floor on tall doors (mm, a comfortable grip). */
export const GRIP_HEIGHT_MM = 1100;

/** Width of the machine compartment of refrigerated counters (mm). */
export const MACHINE_MM = 400;
/** Width of one door or drawer section of a refrigerated counter (mm, a GN 1/1 compartment). */
const SECTION_MM = 460;

/**
 * Number of door or drawer sections of a refrigerated counter of the given width (mm): the
 * machine compartment at the left, then GN 1/1 sections (1360 mm = 2, 1800 mm = 3, 2230 mm = 4).
 * The plan, the elevations and 3D all count with it, so a resized counter agrees in every view.
 */
export function counterSections(width: number): number {
  return Math.max(1, Math.round((width - MACHINE_MM) / SECTION_MM));
}

/** Width of the machine compartment of a counter of the given width (mm), shrunk on small ones. */
export function machineWidth(width: number): number {
  return Math.min(MACHINE_MM, width * 0.3);
}

/** Number of door columns of an upright cabinet (mm width; a GN 2/1 door is about 700 mm wide). */
export function uprightColumns(width: number): number {
  return Math.max(1, Math.round(width / 700));
}

/**
 * Hinge side of door `i` of `n` side by side: a single door is hinged on the left, pairs open
 * from the middle (left door on the left, right door on the right).
 */
export function hingeLeft(i: number, n: number): boolean {
  return n === 1 || i % 2 === 0;
}

// ---------------------------------------------------------------------------------------------
// 3D

export interface DoorSpec {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Front face of the body behind the door, and the item's front (the handle ends there). */
  zBody: number;
  zFront: number;
  hinge: "left" | "right";
  /** A vertical bar at the free edge (centred at `gripY`), or a horizontal bar near the top. */
  handle: "vertical" | "top";
  gripY?: number;
  /** A glass pane in a steel frame instead of a solid leaf; what stands behind it shows. */
  glass?: boolean;
}

/**
 * An insulated door: the rubber gasket shows as a dark line in the gap, the leaf, two hinges at
 * the hinge side and the handle. A glass door is a framed pane without the gasket so the
 * shelves behind it show.
 */
export function coolDoor(p: Parts, o: DoorSpec): void {
  const { x0, x1, y0, y1, zBody, zFront } = o;
  const zLeaf = zFront - STANDOFF;
  const a = x0 + GAP;
  const b = x1 - GAP;
  const lo = y0 + GAP;
  const hi = y1 - GAP;
  if (o.glass) {
    const fw = Math.min(GLASS_FRAME, (b - a) / 4, (hi - lo) / 4);
    p.box("steel", a, b, lo, lo + fw, zBody, zLeaf);
    p.box("steel", a, b, hi - fw, hi, zBody, zLeaf);
    p.box("steel", a, a + fw, lo + fw, hi - fw, zBody, zLeaf);
    p.box("steel", b - fw, b, lo + fw, hi - fw, zBody, zLeaf);
    p.box("glass", a + fw, b - fw, lo + fw, hi - fw, zLeaf - SHEET, zLeaf - SHEET / 2);
  } else {
    p.box("rubber", x0 + GAP / 2, x1 - GAP / 2, y0 + GAP / 2, y1 - GAP / 2, zBody, zBody + GASKET);
    p.box("steel", a, b, lo, hi, zBody + GASKET, zLeaf);
  }
  const left = o.hinge === "left";
  // Hinges sit on the hinge edge, a little in from the top and the bottom.
  const hx = left ? a : b - HINGE;
  const hh = Math.min(0.05, (hi - lo) / 6);
  for (const hy of [lo + hh * 0.5, hi - hh * 1.5]) p.box("steelDark", hx, hx + HINGE, hy, hy + hh, zLeaf - 0.006, zLeaf + 0.004);
  if (o.handle === "vertical") {
    const len = Math.min(0.4, (hi - lo) * 0.5);
    const mid = Math.min(Math.max(o.gripY ?? (lo + hi) / 2, lo + len / 2), hi - len / 2);
    const x = left ? b - 0.04 : a + 0.04;
    p.barHandle("y", mid - len / 2, mid + len / 2, x, zLeaf, zFront);
  } else {
    const len = Math.min(0.32, (b - a) * 0.6);
    const cx = (a + b) / 2;
    p.barHandle("x", cx - len / 2, cx + len / 2, hi - Math.min(0.05, (hi - lo) / 4), zLeaf, zFront);
  }
}

/** A drawer front with a gasket in the gap and a horizontal bar handle near its top. */
export function coolDrawer(p: Parts, x0: number, x1: number, y0: number, y1: number, zBody: number, zFront: number): void {
  const zLeaf = zFront - STANDOFF;
  p.box("rubber", x0 + GAP / 2, x1 - GAP / 2, y0 + GAP / 2, y1 - GAP / 2, zBody, zBody + GASKET);
  p.box("steel", x0 + GAP, x1 - GAP, y0 + GAP, y1 - GAP, zBody + GASKET, zLeaf);
  const len = Math.min(0.4, (x1 - x0) * 0.7);
  const cx = (x0 + x1) / 2;
  p.barHandle("x", cx - len / 2, cx + len / 2, y1 - Math.min(0.05, (y1 - y0) / 4), zLeaf, zFront);
}

/**
 * A louvre grille in front of a machine compartment: a dark opening with horizontal steel slats,
 * from the face at `zFace` to `zFront`.
 */
export function grille(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number, zFront: number): void {
  p.box("panelDark", x0, x1, y0, y1, zFace, zFace + (zFront - zFace) / 2);
  const n = Math.min(MAX_SLATS, Math.floor((y1 - y0) / SLAT_PITCH) - 1);
  const pitch = (y1 - y0) / (n + 1);
  for (let i = 1; i <= n; i++) {
    const y = y0 + pitch * i;
    p.box("steel", x0 + 0.01, x1 - 0.01, y - 0.004, y + 0.004, zFace, zFront);
  }
}

/** A temperature display with two buttons beside it, centred at (cx, cy) on a face at `zFace`. */
export function display(p: Parts, cx: number, cy: number, zFace: number): void {
  p.box("glassDark", cx - DISPLAY.w / 2, cx + DISPLAY.w / 2, cy - DISPLAY.h / 2, cy + DISPLAY.h / 2, zFace, zFace + 0.003);
  for (const dx of [DISPLAY.w / 2 + 0.02, DISPLAY.w / 2 + 0.045]) p.rod("knob", "z", cx + dx, cy, zFace + 0.003, 0.006, 0.007);
}

/**
 * The carcass of an upright refrigerated cabinet: feet and kick plate, the body up to `zBody`
 * and the fascia on top with a louvre grille over the machine and the display. A `hollow` one
 * only gets its head; the caller builds the shell behind the glass doors.
 */
export function uprightCarcass(p: Parts, s: Size, zBody: number, hollow = false): void {
  plinth(p, s.w, s.d);
  // A hollow cabinet (glass doors) gets its shell from `cabinetShell`; only the head is solid.
  p.box("steel", -s.w / 2, s.w / 2, hollow ? s.h - FASCIA : PLINTH, s.h, -s.d / 2, zBody);
  const zLeaf = s.d / 2 - STANDOFF;
  const y0 = s.h - FASCIA;
  p.box("steel", -s.w / 2, s.w / 2, y0 + GAP, s.h, zBody, zLeaf);
  // Grille over the left part, display at the right.
  const gw = Math.min(0.45, s.w * 0.55);
  grille(p, -s.w / 2 + 0.03, -s.w / 2 + 0.03 + gw, y0 + 0.025, s.h - 0.025, zLeaf, s.d / 2);
  display(p, s.w / 2 - 0.13, y0 + FASCIA / 2, zLeaf);
}

/** Wall thickness of an insulated cabinet shell (m). */
export const SHELL = 0.04;

/**
 * An open-fronted cabinet shell from `y0` to `y1` (behind glass doors): sides, back, floor and
 * roof in steel, a light liner at the back. Returns the inner space.
 */
export function cabinetShell(p: Parts, s: Size, y0: number, y1: number, zBody: number): { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number } {
  const t = Math.min(SHELL, s.w / 8);
  p.box("steel", -s.w / 2, -s.w / 2 + t, y0, y1, -s.d / 2, zBody);
  p.box("steel", s.w / 2 - t, s.w / 2, y0, y1, -s.d / 2, zBody);
  p.box("steel", -s.w / 2 + t, s.w / 2 - t, y0, y0 + t, -s.d / 2, zBody);
  p.box("steel", -s.w / 2 + t, s.w / 2 - t, y1 - t, y1, -s.d / 2, zBody);
  p.box("steel", -s.w / 2 + t, s.w / 2 - t, y0 + t, y1 - t, -s.d / 2, -s.d / 2 + t);
  p.box("panel", -s.w / 2 + t, s.w / 2 - t, y0 + t, y1 - t, -s.d / 2 + t, -s.d / 2 + t + SHEET);
  return { x0: -s.w / 2 + t, x1: s.w / 2 - t, y0: y0 + t, y1: y1 - t, z0: -s.d / 2 + t + SHEET, z1: zBody };
}

/** Wire shelves across an inner space, `n` of them evenly spaced; returns their heights (m). */
export function wireShelves(p: Parts, inner: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }, n: number): number[] {
  const out: number[] = [];
  const pitch = (inner.y1 - inner.y0) / (n + 1);
  for (let i = 1; i <= n; i++) {
    const y = inner.y0 + pitch * i;
    p.grid(inner.x0, inner.x1, y - 0.006, y, inner.z0 + 0.02, inner.z1 - 0.03, SHELF_PITCH);
    out.push(y);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Elevation

/** A door in the elevation from a to b and z0 to z1, with its handle at the free edge. */
export function doorFront(f: Front, a: number, b: number, z0: number, z1: number, left: boolean, glass = false): void {
  f.box("detail", a, b, z0, z1);
  if (glass && b - a > 3 * GLASS_FRAME_MM && z1 - z0 > 3 * GLASS_FRAME_MM) {
    f.box("detail", a + GLASS_FRAME_MM, b - GLASS_FRAME_MM, z0 + GLASS_FRAME_MM, z1 - GLASS_FRAME_MM, "glass");
  }
  const x = left ? b - INSET : a + INSET;
  const len = Math.min(HANDLE_MM, (z1 - z0) * 0.5);
  const mid = Math.min(Math.max(Math.min((z0 + z1) / 2, GRIP_HEIGHT_MM), z0 + len / 2), z1 - len / 2);
  f.line("detail", [x, mid - len / 2], [x, mid + len / 2]);
}

/** A louvre grille in the elevation: a frame with horizontal slat lines. */
export function grilleFront(f: Front, a: number, b: number, z0: number, z1: number): void {
  f.box("detail", a, b, z0, z1, "item-dark");
  const n = Math.min(MAX_SLATS, Math.floor((z1 - z0) / (SLAT_PITCH * MM_PER_UNIT)) - 1);
  for (let i = 1; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / (n + 1);
    f.line("detail", [a + LEAF_GAP_MM, z], [b - LEAF_GAP_MM, z]);
  }
}

/** A small display box in the elevation, centred at (x, z). */
export function displayFront(f: Front, x: number, z: number): void {
  const w = DISPLAY.w * MM_PER_UNIT;
  const h = DISPLAY.h * MM_PER_UNIT;
  f.box("detail", x - w / 2, x + w / 2, z - h / 2, z + h / 2, "item-dark");
}

/** The fascia of an upright cabinet in the elevation: grille at the left, display at the right. */
export function fasciaFront(f: Front): void {
  const { l, r, top } = f;
  const z0 = top - FASCIA_MM;
  f.line("detail", [l, z0], [r, z0]);
  const gw = Math.min(450, f.w * 0.55);
  grilleFront(f, l + 30, l + 30 + gw, z0 + 25, top - 25);
  displayFront(f, r - 130, z0 + FASCIA_MM / 2);
}

// ---------------------------------------------------------------------------------------------
// Plan

/**
 * Doors across the front in the plan, drawn closed with their dashed swings: `n` equal leaves,
 * hinged as `hingeLeft` says (from x0 to x1, default the whole width).
 */
export function doorSwings(s: PlanSketch, n: number, x0 = s.L, x1 = s.R): void {
  const dw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * dw;
    const b = a + dw;
    s.line("detail", [a, s.F - PLAN_INSET / 2], [b, s.F - PLAN_INSET / 2]);
    if (hingeLeft(i, n)) s.quarter("hidden", a, s.F, dw, 0);
    else s.quarter("hidden", b, s.F, dw, 90);
  }
}
