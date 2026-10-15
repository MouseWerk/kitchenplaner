// Cold room and freezer room (Kühlzelle, Tiefkühlzelle): walls and roof of insulated sandwich
// panels with visible joints, a hinged door near the left corner of the front wall with its
// threshold, kick plate, lever handle and the temperature display beside it. The freezer room has
// thicker panels, a pressure relief valve and the freezer's frost strip on its door. The plan, the
// elevation and 3D place the door with `doorSpan`, so the views agree.

import type { Front } from "../parts/elevation";
import type { Parts, Size } from "../parts/mesh";
import type { PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";
import { FROST_STRIP, frostFront, frostMark, frostPlan, m } from "./common";

/** Panel thickness of a cold room and of a freezer room (mm, common PU sandwich panels). */
export const COLD_PANEL_MM = 100;
const FREEZER_PANEL_MM = 150;
/** Width of one sandwich panel; the joints show at this pitch (mm). */
const MODULE_MM = 1200;
/** Clear width and height of the door, and its distance from the side wall (mm). */
const DOOR_W = 800;
const DOOR_H = 1900;
const DOOR_SIDE = 100;
/** How far the door leaf overlaps the opening on each side and at the top (mm). */
const OVERLAP_MM = 40;
/**
 * Depth in front of the front wall taken by the surface-mounted door leaf (50 mm) and its handle
 * (20 mm); the front wall's face stands this far behind the item's front (mm).
 */
export const DOOR_ZONE_MM = 70;
/** Leaf thickness (m), kick plate height (m), handle height above the floor (mm). */
const LEAF = 0.05;
const KICK = 0.3;
const HANDLE_Z_MM = 1050;
/** Height of a freezer room door's frost strip above the floor (mm). */
const FROST_Z_MM = 1650;
/** Radius of the snowflake in a freezer room's plan (mm). */
const FROST_PLAN_MM = 250;
/** Height of the temperature display beside the door (mm). */
const DISPLAY_Z_MM = 1600;
/** Width of the joint groove between two panels (m), and how deep it is set back. */
const JOINT = 0.006;
const JOINT_DEPTH = 0.004;

/** The door opening in the item frame (mm): near the left corner when it fits, else centred. */
export function doorSpan(width: number, panel: number): { x0: number; x1: number } {
  const door = Math.min(DOOR_W, width - 4 * panel);
  const left = -width / 2 + panel + DOOR_SIDE;
  return left + door <= width / 2 - panel ? { x0: left, x1: left + door } : { x0: -door / 2, x1: door / 2 };
}

/** Width of the display box and its distance from the door leaf (mm). */
const DISPLAY_W_MM = 120;
const DISPLAY_GAP_MM = 150;

/**
 * Left edge of the temperature display (mm in the item frame): right of the door when there is
 * room before the side wall, else left of it, or none on a very narrow front.
 */
function displayAt(span: { x0: number; x1: number }, width: number, panelMm: number): number | undefined {
  const right = span.x1 + OVERLAP_MM + DISPLAY_GAP_MM;
  if (right + DISPLAY_W_MM <= width / 2 - panelMm) return right;
  const left = span.x0 - OVERLAP_MM - DISPLAY_GAP_MM - DISPLAY_W_MM;
  return left >= -width / 2 + panelMm ? left : undefined;
}

/** Clear door height for a room of the given height (mm). */
const doorHeight = (height: number, panel: number) => Math.min(DOOR_H, height - panel - OVERLAP_MM * 2);

/**
 * Joint positions between `a` and `b` (m) on the module grid that starts at the room's outer
 * corner `origin`, leaving out joints too close to the ends.
 */
function joints(a: number, b: number, origin = a): number[] {
  const out: number[] = [];
  const margin = m(MODULE_MM) / 4;
  for (let x = origin + m(MODULE_MM); x < b - margin; x += m(MODULE_MM)) if (x > a + margin) out.push(x);
  return out;
}

/**
 * A panel wall across the width (front, back or the panel of a door unit) from x `a` to `b`,
 * split into panels at the module joints, with the grooves between them.
 */
function wallAlongX(p: Parts, a: number, b: number, y0: number, y1: number, z0: number, z1: number, origin = a): void {
  let x = a;
  for (const j of [...joints(a, b, origin), b]) {
    p.box("panel", x === a ? x : x + JOINT / 2, j === b ? j : j - JOINT / 2, y0, y1, z0, z1);
    if (j !== b) p.box("steelDark", j - JOINT / 2, j + JOINT / 2, y0, y1, z0 + JOINT_DEPTH, z1 - JOINT_DEPTH);
    x = j;
  }
}

/** A side wall along the depth from z `a` to `b` at x `x0` to `x1`, split like `wallAlongX`. */
function wallAlongZ(p: Parts, x0: number, x1: number, y0: number, y1: number, a: number, b: number): void {
  let z = a;
  for (const j of [...joints(a, b), b]) {
    p.box("panel", x0, x1, y0, y1, z === a ? z : z + JOINT / 2, j === b ? j : j - JOINT / 2);
    if (j !== b) p.box("steelDark", x0 + JOINT_DEPTH, x1 - JOINT_DEPTH, y0, y1, j - JOINT / 2, j + JOINT / 2);
    z = j;
  }
}

/** Where the front wall of a walk-in runs: from x `xa` to `xb` and up to `yTop` (m). */
export interface FrontWall {
  xa: number;
  xb: number;
  yTop: number;
  /** Inner face, outer face of the wall and the item's front (the handle ends there). */
  zIn: number;
  zFace: number;
  zFront: number;
}

/**
 * The front wall with the door: panels beside and above the opening, and the surface-mounted
 * door in front of it. The door sits where `doorSpan` puts it in the item's full width.
 */
export function walkInFront(p: Parts, s: Size, panelMm: number, wall: FrontWall, freezer: boolean): void {
  const { xa, xb, yTop, zIn, zFace, zFront } = wall;
  const span = doorSpan(s.w * 1000, panelMm);
  const x0 = m(span.x0);
  const x1 = m(span.x1);
  const dh = m(doorHeight(s.h * 1000, panelMm));
  const lap = m(OVERLAP_MM);
  wallAlongX(p, xa, x0, 0, yTop, zIn, zFace, -s.w / 2);
  wallAlongX(p, x1, xb, 0, yTop, zIn, zFace, -s.w / 2);
  p.box("panel", x0, x1, dh, yTop, zIn, zFace);
  // Threshold across the opening, reaching out under the leaf.
  p.box("steel", x0 - lap, x1 + lap, 0, 0.012, zIn, zFace + LEAF + 0.01);
  // The leaf overlaps the opening; a dark seal shows around it.
  const zLeaf = zFace + LEAF;
  p.box("rubber", x0 - lap - 0.006, x1 + lap + 0.006, 0.014, dh + lap + 0.006, zFace, zFace + 0.004);
  p.box("panel", x0 - lap, x1 + lap, 0.016, dh + lap, zFace + 0.004, zLeaf);
  p.box("steel", x0 - lap + 0.01, x1 + lap - 0.01, 0.026, KICK, zLeaf, zLeaf + 0.003);
  // Three hinges on the left edge.
  for (const y of [0.25, dh / 2, dh - 0.15]) p.box("handle", x0 - lap - 0.012, x0 - lap + 0.02, y, y + 0.1, zFace + 0.004, zLeaf + 0.008);
  // Lever handle with its lock at the right edge.
  const hx = x1 + lap - 0.08;
  const hy = m(HANDLE_Z_MM);
  p.box("steel", hx - 0.02, hx + 0.02, hy - 0.1, hy + 0.08, zLeaf, zLeaf + 0.006);
  p.rod("handle", "x", hx - 0.06, hy, zFront - 0.008, 0.14, 0.008);
  p.box("handle", hx - 0.012, hx + 0.012, hy - 0.012, hy + 0.012, zLeaf, zFront - 0.008);
  p.cyl("knob", hx, zLeaf + 0.006, hy - 0.07, hy - 0.05, 0.008);
  if (freezer) {
    const fy = Math.min(m(FROST_Z_MM), dh - FROST_STRIP * 2);
    frostMark(p, x0 - lap, x1 + lap, fy, fy + FROST_STRIP, zLeaf);
  }
  // Temperature display beside the door; a freezer room also has its pressure relief valve.
  const side = displayAt(span, s.w * 1000, panelMm);
  if (side !== undefined) {
    p.box("panelDark", m(side), m(side) + 0.12, m(DISPLAY_Z_MM), m(DISPLAY_Z_MM) + 0.08, zFace, zFace + 0.012);
    p.box("glassDark", m(side) + 0.015, m(side) + 0.105, m(DISPLAY_Z_MM) + 0.035, m(DISPLAY_Z_MM) + 0.065, zFace + 0.012, zFace + 0.014);
    if (freezer) p.rod("steelDark", "z", m(side) + 0.06, m(DISPLAY_Z_MM) + 0.3, zFace + 0.02, 0.04, 0.04);
  }
}

/** The door in the elevation: leaf over the opening, kick plate, handle and the display. */
export function walkInFrontElevation(f: Front, panelMm: number, freezer = false): void {
  const { z0 } = f;
  const c = (f.l + f.r) / 2;
  const span = doorSpan(f.w, panelMm);
  const a = c + span.x0 - OVERLAP_MM;
  const b = c + span.x1 + OVERLAP_MM;
  const dh = doorHeight(f.item.height, panelMm) + OVERLAP_MM;
  f.box("detail", a, b, z0 + 15, z0 + dh);
  f.line("detail", [a + 10, z0 + KICK * 1000], [b - 10, z0 + KICK * 1000]);
  f.line("detail", [b - 140, z0 + HANDLE_Z_MM], [b - 20, z0 + HANDLE_Z_MM]);
  if (freezer) {
    const fz = Math.min(FROST_Z_MM, dh - OVERLAP_MM - FROST_STRIP * 2000);
    frostFront(f, a, b, z0 + fz, z0 + fz + FROST_STRIP * 1000);
  }
  const side = displayAt(span, f.w, panelMm);
  if (side !== undefined) f.box("detail", c + side, c + side + DISPLAY_W_MM, z0 + DISPLAY_Z_MM, z0 + DISPLAY_Z_MM + 80, "item-dark");
  // Panel joints in the front wall beside the door, as in 3D.
  const origin = m(-f.w / 2);
  const beside = [...joints(m(-f.w / 2 + panelMm), m(span.x0), origin), ...joints(m(span.x1), m(f.w / 2 - panelMm), origin)];
  for (const j of beside) f.line("detail", [c + j * 1000, z0], [c + j * 1000, f.top]);
}

function room(kind: string, panelMm: number, freezer: boolean): KindDef {
  return {
    kind,
    plan(s) {
      planRoom(s, panelMm);
      if (freezer) frostPlan(s, 0, (s.B + s.F - DOOR_ZONE_MM) / 2, FROST_PLAN_MM);
    },
    elevation(f) {
      // The roof panel's lower edge, then the front with the door.
      f.line("detail", [f.l, f.top - panelMm], [f.r, f.top - panelMm]);
      walkInFrontElevation(f, panelMm, freezer);
    },
    mesh(p, s) {
      const t = Math.min(m(panelMm), s.w / 4, s.d / 4);
      const zFace = s.d / 2 - m(DOOR_ZONE_MM);
      p.box("panel", -s.w / 2, s.w / 2, s.h - t, s.h, -s.d / 2, zFace);
      wallAlongZ(p, -s.w / 2, -s.w / 2 + t, 0, s.h - t, -s.d / 2, zFace);
      wallAlongZ(p, s.w / 2 - t, s.w / 2, 0, s.h - t, -s.d / 2, zFace);
      wallAlongX(p, -s.w / 2 + t, s.w / 2 - t, 0, s.h - t, -s.d / 2, -s.d / 2 + t);
      walkInFront(p, s, panelMm, { xa: -s.w / 2 + t, xb: s.w / 2 - t, yTop: s.h - t, zIn: zFace - t, zFace, zFront: s.d / 2 }, freezer);
    },
  };
}

/** The plan of a walk-in: the panel walls, their joints, and the door with its swing. */
function planRoom(s: PlanSketch, panelMm: number): void {
  const { L, R, B, F } = s;
  const p = panelMm;
  const zone = DOOR_ZONE_MM;
  const { x0, x1 } = doorSpan(s.w, p);
  const fi = F - zone - p;
  s.line("detail", [x0, fi], [L + p, fi], [L + p, B + p], [R - p, B + p], [R - p, fi], [x1, fi]);
  s.line("detail", [L, F - zone], [x0, F - zone]);
  s.line("detail", [x1, F - zone], [R, F - zone]);
  // The opening cuts through the front wall.
  s.line("detail", [x0, fi], [x0, F - zone]);
  s.line("detail", [x1, fi], [x1, F - zone]);
  // Panel joints across the side walls.
  for (const j of joints(B / 1000, (F - zone) / 1000)) {
    s.line("detail", [L, j * 1000], [L + p, j * 1000]);
    s.line("detail", [R - p, j * 1000], [R, j * 1000]);
  }
  // The door opens out of the room: the leaf drawn open, its swing dashed.
  const door = x1 - x0;
  s.line("opening", [x0, F], [x0, F + door]);
  s.quarter("swing", x0, F, door, 0);
}

export const coldRoom = room("coldRoom", COLD_PANEL_MM, false);
export const freezerRoom = room("freezerRoom", FREEZER_PANEL_MM, true);
