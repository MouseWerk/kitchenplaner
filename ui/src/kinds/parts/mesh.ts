// Building blocks of the 3D models, in the item's own frame: metres, x along the width (centred),
// z towards the front (the back face at -d/2, the front face at +d/2), y up from the item's
// elevation. `buildItemObject` (three/meshes.ts) places and turns the result.
//
// Every part is the shared unit box or unit cylinder, scaled, with a shared material
// (three/shared.ts): a model never creates geometry or materials of its own.

import * as THREE from "three";
import { getShared, type MaterialId, type Shared } from "../../three/shared";

export type { MaterialId } from "../../three/shared";

/** Size of an item in metres. */
export interface Size {
  w: number;
  d: number;
  h: number;
}

/** A rectangular hole in a worktop (bowls, basins), in the item frame (m). */
export interface Hole {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

// Typical construction sizes of stainless equipment (m).
/** Smallest extent of a part, so a resized tiny item never gets a zero scale. */
const MIN_PART = 0.001;
/** Sheet metal thickness as drawn (thicker than real so it is visible). */
export const SHEET = 0.01;
/** Worktop thickness. */
export const TOP = 0.04;
/** Square table leg. */
export const LEG = 0.04;
/** Height of the lower shelf of an open table above the floor. */
export const UNDERSHELF = 0.18;
/** Plinth height of cabinets and fridges. */
export const PLINTH = 0.1;
/** Gap between a door and the next one or the body edge. */
export const GAP = 0.004;
/** Depth of a door panel standing proud of the body. */
export const DOOR = 0.02;
/** Handle bar size; handles end flush with the item's front. */
export const HANDLE = 0.02;
/** Height of the control strip on the front of cooking appliances. */
export const CONTROLS = 0.12;
/** Thickness of a cooking top (dark plate on the body). */
export const COOKTOP = 0.05;
/** Usual width of one cabinet door. */
export const DOOR_WIDTH = 0.6;
/** Radius of a round handle bar. */
const HANDLE_BAR = 0.008;
/** Radius of a control knob. */
const KNOB_RADIUS = 0.022;
/** Set-back of the kick plate under a body from its front (toe space). */
const KICK_SETBACK = 0.05;
/** Radius of an adjustable foot. */
const FOOT = 0.022;
/** Height of the round pad at the bottom of a foot. */
const FOOT_PAD = 0.012;
/** Largest distance between two knobs on a control strip (m). */
const KNOB_PITCH = 0.15;

/** Adds parts to an item's group. */
export class Parts {
  readonly s: Shared = getShared();
  constructor(readonly g: THREE.Group) {}

  /** An axis-aligned box from its extents. */
  box(mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.Mesh {
    const m = new THREE.Mesh(this.s.box, this.s.mat[mat]);
    m.scale.set(Math.max(x1 - x0, MIN_PART), Math.max(y1 - y0, MIN_PART), Math.max(z1 - z0, MIN_PART));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.g.add(m);
    return m;
  }

  /** A standing cylinder from its centre on the plan, its height range and radius. */
  cyl(mat: MaterialId, cx: number, cz: number, y0: number, y1: number, r: number): THREE.Mesh {
    const m = new THREE.Mesh(this.s.cylinder, this.s.mat[mat]);
    m.scale.set(2 * r, Math.max(y1 - y0, MIN_PART), 2 * r);
    m.position.set(cx, (y0 + y1) / 2, cz);
    this.g.add(m);
    return m;
  }

  /** A round bar along an axis, centred at (cx, cy, cz). Used for handles, rails and spouts. */
  rod(mat: MaterialId, axis: "x" | "y" | "z", cx: number, cy: number, cz: number, length: number, r: number): THREE.Mesh {
    const m = new THREE.Mesh(this.s.cylinder, this.s.mat[mat]);
    m.scale.set(2 * r, Math.max(length, MIN_PART), 2 * r);
    if (axis === "x") m.rotation.z = Math.PI / 2;
    if (axis === "z") m.rotation.x = Math.PI / 2;
    m.position.set(cx, cy, cz);
    this.g.add(m);
    return m;
  }

  /** A control knob standing out of a panel whose face is at `zFace`, ending at `zFront`. */
  knob(cx: number, cy: number, zFace: number, zFront: number, r = KNOB_RADIUS): void {
    const depth = zFront - zFace;
    this.rod("knob", "z", cx, cy, zFace + depth * 0.35, depth * 0.7, r);
    // A bright index mark on the knob's face shows its setting.
    this.box("handle", cx - r * 0.12, cx + r * 0.12, cy + r * 0.2, cy + r * 0.85, zFront - depth * 0.3, zFront);
  }

  /**
   * A bar handle on stand-offs in front of a door face at `zFace`, ending flush with `zFront`:
   * horizontal (along x) or vertical (along y), from `a` to `b` on that axis, at `at` on the
   * other one.
   */
  barHandle(axis: "x" | "y", a: number, b: number, at: number, zFace: number, zFront: number): void {
    const r = Math.min(HANDLE_BAR, (zFront - zFace) / 3);
    const zc = zFront - r;
    const len = b - a;
    const inset = Math.min(0.03, len * 0.15);
    for (const s of [a + inset, b - inset]) {
      if (axis === "x") this.box("handle", s - r * 0.8, s + r * 0.8, at - r * 0.8, at + r * 0.8, zFace, zc);
      else this.box("handle", at - r * 0.8, at + r * 0.8, s - r * 0.8, s + r * 0.8, zFace, zc);
    }
    if (axis === "x") this.rod("handle", "x", (a + b) / 2, at, zc, len, r);
    else this.rod("handle", "y", at, (a + b) / 2, zc, len, r);
  }

  /**
   * An open tub: floor and four walls, its rim at `y1`. Used for sink bowls, basins and pans so
   * they look recessed instead of painted on.
   */
  tub(mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, wall = SHEET): void {
    this.box(mat, x0, x1, y0, y0 + wall, z0, z1);
    this.box(mat, x0, x1, y0, y1, z0, z0 + wall);
    this.box(mat, x0, x1, y0, y1, z1 - wall, z1);
    this.box(mat, x0, x0 + wall, y0, y1, z0, z1);
    this.box(mat, x1 - wall, x1, y0, y1, z0, z1);
  }

  /**
   * A worktop with rectangular holes cut out (bowls, basins): the top is split into strips
   * around the holes so the holes stay open from above.
   */
  topWithHoles(mat: MaterialId, w: number, d: number, y0: number, y1: number, holes: readonly Hole[]): void {
    const hz0 = Math.min(...holes.map((h) => h.z0));
    const hz1 = Math.max(...holes.map((h) => h.z1));
    this.box(mat, -w / 2, w / 2, y0, y1, -d / 2, hz0);
    this.box(mat, -w / 2, w / 2, y0, y1, hz1, d / 2);
    const sorted = [...holes].sort((a, b) => a.x0 - b.x0);
    let x = -w / 2;
    for (const h of sorted) {
      if (h.x0 > x) this.box(mat, x, h.x0, y0, y1, hz0, hz1);
      x = h.x1;
    }
    if (x < w / 2) this.box(mat, x, w / 2, y0, y1, hz0, hz1);
  }
}

// ---------------------------------------------------------------------------------------------
// Assemblies shared by several kinds

/** A stainless body with a worktop: the base of most counters. */
export function body(p: Parts, { w, d, h }: Size, topMat: MaterialId = "steel", topThickness = TOP, holes: readonly Hole[] = []): void {
  plinth(p, w, d);
  p.box("steel", -w / 2, w / 2, PLINTH, h - topThickness, -d / 2, d / 2 - DOOR);
  if (holes.length > 0) p.topWithHoles(topMat, w, d, h - topThickness, h, holes);
  else p.box(topMat, -w / 2, w / 2, h - topThickness, h, -d / 2, d / 2);
}

/**
 * The base under a body: a kick plate set back from the front and adjustable feet at the
 * corners, as on stainless counters (all within the footprint).
 */
export function plinth(p: Parts, w: number, d: number): void {
  p.box("steelDark", -w / 2 + LEG, w / 2 - LEG, FOOT_PAD, PLINTH, -d / 2 + LEG, d / 2 - DOOR - KICK_SETBACK);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - FOOT * 1.5);
      const z = sz * (d / 2 - DOOR - FOOT * 1.5);
      p.cyl("steelDark", x, z, FOOT_PAD, PLINTH, FOOT * 0.6);
      p.cyl("rubber", x, z, 0, FOOT_PAD, FOOT);
    }
  }
}

/** Door panels side by side over a width range, each with a vertical or horizontal handle. */
export function doors(p: Parts, x0: number, x1: number, y0: number, y1: number, d: number, count: number, handle: "vertical" | "top"): void {
  const zf = d / 2;
  const dw = (x1 - x0) / count;
  for (let i = 0; i < count; i++) {
    const a = x0 + i * dw + GAP;
    const b = x0 + (i + 1) * dw - GAP;
    p.box("steel", a, b, y0 + GAP, y1 - GAP, zf - DOOR, zf - DOOR / 2);
    if (handle === "vertical") {
      // Handles sit at the meeting edges of a pair of doors; a single door has it on the right.
      const atLeft = count > 1 && i % 2 === 1;
      const hx = atLeft ? a + HANDLE * 1.5 : b - HANDLE * 1.5;
      const len = Math.min(0.4, (y1 - y0) * 0.5);
      const mid = (y0 + y1) / 2;
      p.barHandle("y", mid - len / 2, mid + len / 2, hx, zf - DOOR / 2, zf);
    } else {
      const len = Math.min(0.3, (b - a) * 0.6);
      const cx = (a + b) / 2;
      p.barHandle("x", cx - len / 2, cx + len / 2, y1 - 0.05, zf - DOOR / 2, zf);
    }
  }
}

/** Width of a castor wheel at most, and thickness of its mounting plate (m). */
const CASTOR_WHEEL = 0.03;
const CASTOR_PLATE = 0.012;

/**
 * A swivel castor standing on the floor at (x, z): a rubber wheel of radius `r` turning about
 * the x axis with its hub, the fork, and the mounting plate up to `top` (m). Everything stays
 * within `r` of (x, z), so a castor set in from the edges by `r` stays inside the footprint.
 */
export function castor(p: Parts, x: number, z: number, r: number, top: number): void {
  const wheel = Math.min(CASTOR_WHEEL, r * 0.7);
  p.rod("rubber", "x", x, r, z, wheel, r);
  p.rod("steelDark", "x", x, r, z, wheel * 1.2, r * 0.35);
  const fork = wheel / 2 + 0.003;
  const forkD = Math.min(0.015, r * 0.4);
  for (const sx of [-1, 1]) p.box("steelDark", x + sx * fork - 0.002, x + sx * fork + 0.002, r, top - CASTOR_PLATE, z - forkD, z + forkD);
  const plate = Math.min(CASTOR_WHEEL, r);
  p.box("steelDark", x - plate, x + plate, top - CASTOR_PLATE, top, z - plate, z + plate);
}

/** Four legs and a lower shelf: the frame of open tables and sinks. */
export function openFrame(p: Parts, { w, d }: Size, topY: number): void {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - LEG / 2 - SHEET);
      const z = sz * (d / 2 - LEG / 2 - SHEET);
      p.box("steelDark", x - LEG / 2, x + LEG / 2, 0, topY, z - LEG / 2, z + LEG / 2);
    }
  }
  p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, UNDERSHELF, UNDERSHELF + SHEET * 2, -d / 2 + SHEET, d / 2 - SHEET);
}

/**
 * A mixer tap: a base, a column, a spout reaching forward and bending down over the bowl, and a
 * lever on the column. The column is named "tap" (one per tap).
 */
export function tap(p: Parts, x: number, zBack: number, y0: number, rise: number): void {
  const r = 0.012;
  const z = zBack + 0.05;
  p.cyl("handle", x, z, y0, y0 + 0.02, r * 2);
  p.cyl("handle", x, z, y0, y0 + rise - r, r).name = "tap";
  const reach = Math.min(0.2, rise * 0.7);
  // The spout bar reaches forward from the column's top; its round section tops out at the rise.
  p.rod("handle", "z", x, y0 + rise - r, z + reach / 2, reach, r);
  // The outlet points down at the end of the spout.
  const drop = Math.min(0.06, rise * 0.25);
  p.cyl("handle", x, z + reach - r * 0.8, y0 + rise - r - drop, y0 + rise - r, r * 0.8);
  // Single lever on the side of the column.
  p.box("handle", x + r, x + r + 0.07, y0 + rise * 0.55, y0 + rise * 0.55 + 0.012, z - 0.006, z + 0.006);
}

/** Cooking body: steel cabinet with a control strip on top of the front and a dark top. */
export function cookingBody(p: Parts, s: Size, topMat: MaterialId, ovenDoor: boolean, holes: readonly Hole[] = [], knobs = 0): void {
  body(p, s, topMat, COOKTOP, holes);
  const yc = s.h - COOKTOP - CONTROLS;
  p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, yc, s.h - COOKTOP - GAP, s.d / 2 - DOOR, s.d / 2 - HANDLE);
  controlKnobs(p, s.w, (yc + s.h - COOKTOP) / 2, s.d / 2 - HANDLE, s.d / 2, knobs);
  if (ovenDoor) {
    doors(p, -s.w / 2, s.w / 2, PLINTH, yc, s.d, 1, "top");
    ovenWindow(p, -s.w / 2, s.w / 2, PLINTH, yc - 0.08, s.d / 2 - DOOR / 2);
  }
}

/** A row of knobs spread over a control strip of width `w`, centred on x = 0. */
export function controlKnobs(p: Parts, w: number, y: number, zFace: number, zFront: number, count: number): void {
  if (count <= 0) return;
  const step = Math.min(w / count, KNOB_PITCH);
  const x0 = -((count - 1) * step) / 2;
  for (let i = 0; i < count; i++) p.knob(x0 + i * step, y, zFace, zFront);
}

/** A dark glass window in an oven door whose face is at `zFace`, inside the door's frame. */
export function ovenWindow(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number): void {
  const mx = Math.min(0.1, (x1 - x0) * 0.15);
  const my = 0.1;
  if (x1 - x0 < 2 * mx + 0.1 || y1 - y0 < 2 * my + 0.1) return;
  p.box("glassDark", x0 + mx, x1 - mx, y0 + my, y1 - my, zFace, zFace + 0.002);
}
