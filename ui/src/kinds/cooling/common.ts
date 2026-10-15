// Parts the refrigeration units share: insulated doors with gaskets and hinges, louvre grilles in
// front of the machine compartment, temperature displays, and the section counts that the plan,
// the elevations and 3D of refrigerated counters agree on.

import * as THREE from "three";
import { INSET, type Front } from "../parts/elevation";
import { arcPoints, BODY_RADIUS, GAP, GN_RADIUS, PLINTH, plinth, SHEET, SHELF_PITCH, type MaterialId, type Parts, type Size } from "../parts/mesh";
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
/** Width of the magnetic gasket under the leaf's edge, and how far its bulb shows past the leaf (m). */
const GASKET_W = 0.012;
const GASKET_BULGE = 0.0015;
/** Edge radius of an insulated door leaf: a pressed, foamed leaf, rounder than a cabinet door (m). */
export const LEAF_RADIUS = 0.004;
/** Width of the frame around a glass door pane. */
export const GLASS_FRAME = 0.05;
/** Height of the fascia with the controls on top of upright cabinets (m). */
export const FASCIA = 0.12;
/** Pitch of the slats of a louvre grille. */
const SLAT_PITCH = 0.03;
/** Most slats a grille gets, so a tall grille does not cost many parts. */
const MAX_SLATS = 8;
/** Size of a temperature display's window (m), its bezel round it and the bezel's reach right of it for the buttons. */
const DISPLAY = { w: 0.1, h: 0.035 };
const BEZEL = 0.008;
const BUTTONS = 0.06;
/** Height and edge radius of a grille slat (m). */
const SLAT = 0.008;
const SLAT_RADIUS = 0.003;
/** Sheet and rim of a GN container hanging in a well (m). */
const GN_WALL = 0.004;
const GN_RIM = 0.008;

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
  /** Material of a glass door's frame (steel by default; black on wine and bar coolers). */
  frame?: MaterialId;
  /** False for a sliding leaf: no hinge barrels. */
  hinges?: boolean;
}

/**
 * An insulated door: the leaf, rounded at its front, on its magnetic gasket whose bulb shows dark
 * in the gap all round, two turned hinge barrels at the hinge side and the handle. A glass door
 * is a pane in one frame with round outer corners, without the gasket so the shelves behind it
 * show.
 */
export function coolDoor(p: Parts, o: DoorSpec): void {
  const { x0, x1, y0, y1, zBody, zFront } = o;
  const zLeaf = zFront - STANDOFF;
  const a = x0 + GAP;
  const b = x1 - GAP;
  const lo = y0 + GAP;
  const hi = y1 - GAP;
  const cx = (a + b) / 2;
  const cy = (lo + hi) / 2;
  if (o.glass) {
    // The frame: a band round the pane, its outer corners and front edge rounded.
    const fw = Math.min(GLASS_FRAME, (b - a) / 4, (hi - lo) / 4);
    const depth = zLeaf - zBody;
    const r = Math.min(LEAF_RADIUS, fw / 2, depth / 2);
    p.lathe(
      o.frame ?? "steel",
      cx,
      cy,
      zBody,
      [
        [0, 0],
        [fw, 0],
        ...arcPoints(fw - r, depth - r, r, 0, Math.PI / 2, 1),
        [0, depth],
        [0, 0],
      ],
      { axis: "z", rect: [(b - a) / 2 - fw, (hi - lo) / 2 - fw] },
    );
    p.plate("glass", a + fw - 0.002, b - fw + 0.002, lo + fw - 0.002, hi - fw + 0.002, zLeaf - SHEET, zLeaf - SHEET / 2, 0.004);
  } else {
    gasket(p, a, b, lo, hi, zBody);
    p.roundedBox("steel", a, b, lo, hi, zBody + GASKET, zLeaf, LEAF_RADIUS, "top", "z");
  }
  const left = o.hinge === "left";
  // Hinge barrels on the hinge edge, a little in from the top and the bottom.
  const hr = HINGE / 2;
  const hx = left ? a + hr : b - hr;
  const hh = Math.min(0.05, (hi - lo) / 6);
  for (const hy of o.hinges === false ? [] : [lo + hh * 0.5, hi - hh * 1.5]) {
    p.lathe("satin", hx, hy, zLeaf - 0.001, [
      [0, 0],
      [hr * 0.7, 0],
      [hr, hr * 0.4],
      [hr, hh - hr * 0.4],
      [hr * 0.7, hh],
      [0, hh],
    ]);
  }
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

/**
 * The magnetic gasket under a leaf from a to b and lo to hi: a closed bulb profile round the
 * leaf's outline on the body's face at `zBody`, showing a little past the leaf's edge.
 */
export function gasket(p: Parts, a: number, b: number, lo: number, hi: number, zBody: number): void {
  const g = Math.min(GASKET_W, (b - a) / 4, (hi - lo) / 4);
  p.lathe(
    "rubber",
    (a + b) / 2,
    (lo + hi) / 2,
    zBody,
    [
      [0, 0],
      [g + GASKET_BULGE * 0.6, 0],
      [g + GASKET_BULGE, GASKET * 0.5],
      [g + GASKET_BULGE * 0.6, GASKET],
      [0, GASKET],
      [0, 0],
    ],
    { axis: "z", rect: [(b - a) / 2 - g, (hi - lo) / 2 - g] },
  );
}

/** A drawer front on its gasket with a horizontal bar handle near its top. */
export function coolDrawer(p: Parts, x0: number, x1: number, y0: number, y1: number, zBody: number, zFront: number): void {
  const zLeaf = zFront - STANDOFF;
  gasket(p, x0 + GAP, x1 - GAP, y0 + GAP, y1 - GAP, zBody);
  p.roundedBox("steel", x0 + GAP, x1 - GAP, y0 + GAP, y1 - GAP, zBody + GASKET, zLeaf, LEAF_RADIUS, "top", "z");
  const len = Math.min(0.4, (x1 - x0) * 0.7);
  const cx = (x0 + x1) / 2;
  p.barHandle("x", cx - len / 2, cx + len / 2, y1 - Math.min(0.05, (y1 - y0) / 4), zLeaf, zFront);
}

/**
 * A louvre grille in front of a machine compartment: a dark opening with horizontal steel slats,
 * from the face at `zFace` to `zFront`.
 */
export function grille(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number, zFront: number): void {
  const depth = zFront - zFace;
  p.plate("panelDark", x0, x1, y0, y1, zFace, zFace + depth / 2, Math.min(SLAT_RADIUS * 2, (y1 - y0) / 4));
  const n = Math.min(MAX_SLATS, Math.floor((y1 - y0) / SLAT_PITCH) - 1);
  const pitch = (y1 - y0) / (n + 1);
  for (let i = 1; i <= n; i++) {
    const y = y0 + pitch * i;
    p.roundedBox("steel", x0 + 0.01, x1 - 0.01, y - SLAT / 2, y + SLAT / 2, zFace, zFront, SLAT_RADIUS);
  }
}

/**
 * A temperature display centred at (cx, cy) on a face at `zFace`: the dark bezel with the window
 * and two turned push buttons beside it, within 5 mm of the face.
 */
export function display(p: Parts, cx: number, cy: number, zFace: number): void {
  const { w, h } = DISPLAY;
  p.plate("panelDark", cx - w / 2 - BEZEL, cx + w / 2 + BUTTONS, cy - h / 2 - BEZEL, cy + h / 2 + BEZEL, zFace, zFace + 0.0015, 0.004, true);
  p.plate("glassDark", cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, zFace + 0.0015, zFace + 0.0025, 0.003);
  for (const dx of [w / 2 + 0.02, w / 2 + 0.045]) pushButton(p, cx + dx, cy, zFace + 0.0015);
}

/** A turned push button (a low dome on a collar) on a face at `zFace`, `r` its radius (m). */
export function pushButton(p: Parts, x: number, y: number, zFace: number, r = 0.007, mat: MaterialId = "knob"): void {
  p.lathe(
    mat,
    x,
    y,
    zFace,
    [
      [0, 0],
      [r, 0],
      [r, r * 0.2],
      [r * 0.82, r * 0.3],
      [r * 0.7, r * 0.45],
      [0, r * 0.5],
    ],
    { axis: "z" },
  );
}

/**
 * A bottle standing at (x, z) from `y` up to `y + h` (m), or lying from `z` towards the front
 * (`lying`): a turned body with shoulder, neck and lip. Eight sides keep a cooler full of them
 * within the budget.
 */
export function bottle(p: Parts, x: number, y: number, z: number, h: number, r: number, mat: MaterialId, lying = false): void {
  const neck = r * 0.36;
  p.lathe(
    mat,
    x,
    y,
    z,
    [
      [0, 0],
      [r * 0.9, 0],
      [r, h * 0.04],
      [r, h * 0.6],
      [r * 0.92, h * 0.66],
      [r * 0.55, h * 0.74],
      [neck, h * 0.82],
      [neck, h * 0.95],
      [neck * 1.18, h * 0.96],
      [neck * 1.18, h],
      [0, h],
    ],
    { axis: lying ? "z" : "y", segments: 8 },
  );
}

/**
 * A GN container hanging by its rim in a well from x0 to x1 and z0 to z1, its rim at `y1`, with
 * food in it up to `fillDrop` below the rim (none without `food`).
 */
export function gnPan(p: Parts, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, food?: MaterialId, fillDrop = 0.03): void {
  p.pan("steel", x0, x1, y0, y1, z0, z1, { wall: GN_WALL, r: GN_RADIUS, rim: GN_RIM });
  if (!food) return;
  const i = GN_RIM + GN_WALL + 0.0005;
  const r = Math.max(0.001, Math.min(GN_RADIUS, (x1 - x0) / 2, (z1 - z0) / 2) - i);
  p.roundedBox(food, x0 + i, x1 - i, y0 + (y1 - y0) * 0.35, y1 - fillDrop, z0 + i, z1 - i, r, "vertical");
}

/**
 * The carcass of an upright refrigerated cabinet: feet and kick plate, the body up to `zBody`
 * and the fascia on top with a louvre grille over the machine and the display. A `hollow` one
 * only gets its head; the caller builds the shell behind the glass doors. `mat` is the body's
 * finish (steel, or dark on a dry-aging cabinet); without `controls` the caller fits the fascia's
 * grille and display.
 */
export function uprightCarcass(p: Parts, s: Size, zBody: number, hollow = false, mat: MaterialId = "steel", controls = true): void {
  plinth(p, s.w, s.d);
  // A hollow cabinet (glass doors) gets its shell from `cabinetShell`; only the head is solid.
  p.roundedBox(mat, -s.w / 2, s.w / 2, hollow ? s.h - FASCIA : PLINTH, s.h, -s.d / 2, zBody, CABINET_RADIUS, "vertical");
  const zLeaf = s.d / 2 - STANDOFF;
  const y0 = s.h - FASCIA;
  p.roundedBox(mat, -s.w / 2, s.w / 2, y0 + GAP, s.h, zBody, zLeaf, BODY_RADIUS, "top", "z");
  if (!controls) return;
  // Grille over the left part, display at the right.
  const gw = Math.min(0.45, s.w * 0.55);
  grille(p, -s.w / 2 + 0.03, -s.w / 2 + 0.03 + gw, y0 + 0.025, s.h - 0.025, zLeaf, s.d / 2);
  display(p, s.w / 2 - 0.13, y0 + FASCIA / 2, zLeaf);
}

/** Radius of the upright corners of a refrigerated cabinet's body (m). */
export const CABINET_RADIUS = 0.004;

/** Wall thickness of an insulated cabinet shell (m). */
export const SHELL = 0.04;

/**
 * An open-fronted cabinet shell from `y0` to `y1` (behind glass doors): sides, back, floor and
 * roof in steel, a light liner at the back. Returns the inner space.
 */
export function cabinetShell(p: Parts, s: Size, y0: number, y1: number, zBody: number, mat: MaterialId = "steel"): { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number } {
  const t = Math.min(SHELL, s.w / 8);
  p.roundedBox(mat, -s.w / 2, -s.w / 2 + t, y0, y1, -s.d / 2, zBody, CABINET_RADIUS, "vertical");
  p.roundedBox(mat, s.w / 2 - t, s.w / 2, y0, y1, -s.d / 2, zBody, CABINET_RADIUS, "vertical");
  p.box(mat, -s.w / 2 + t, s.w / 2 - t, y0, y0 + t, -s.d / 2, zBody - 0.001);
  p.box(mat, -s.w / 2 + t, s.w / 2 - t, y1 - t, y1, -s.d / 2, zBody - 0.001);
  p.box(mat, -s.w / 2 + t, s.w / 2 - t, y0 + t, y1 - t, -s.d / 2, -s.d / 2 + t);
  p.box("panel", -s.w / 2 + t, s.w / 2 - t, y0 + t, y1 - t, -s.d / 2 + t, -s.d / 2 + t + SHEET);
  return { x0: -s.w / 2 + t, x1: s.w / 2 - t, y0: y0 + t, y1: y1 - t, z0: -s.d / 2 + t + SHEET, z1: zBody };
}

/**
 * Wire shelves across an inner space, `n` of them evenly spaced; returns their heights (m). The
 * wires run along the shelf's longer side, so a wide shelf has as few wires as a narrow one.
 */
export function wireShelves(p: Parts, inner: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }, n: number): number[] {
  const out: number[] = [];
  const pitch = (inner.y1 - inner.y0) / (n + 1);
  const z0 = inner.z0 + 0.02;
  const z1 = inner.z1 - 0.03;
  const along = inner.x1 - inner.x0 > z1 - z0 ? "x" : "z";
  for (let i = 1; i <= n; i++) {
    const y = inner.y0 + pitch * i;
    p.grid(inner.x0, inner.x1, y - 0.006, y, z0, z1, SHELF_PITCH, along);
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

/** A half turn about the vertical axis. */
const HALF_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

/**
 * Turns the parts added to the item since `from` (a count of its parts) half round about the
 * vertical axis through the item's centre: what was built on the front then stands on the back,
 * seen the same way from behind (the second door of a pass-through cabinet).
 */
export function turnAround(p: Parts, from: number): void {
  for (const o of p.g.children.slice(from)) {
    o.position.applyQuaternion(HALF_TURN);
    o.quaternion.premultiply(HALF_TURN);
  }
}
