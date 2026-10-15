// Cold room and freezer room (Kühlzelle, Tiefkühlzelle): walls and roof of insulated sandwich
// panels with visible joints, a hinged door near the left corner of the front wall with its
// threshold, kick plate, lever handle and the temperature display beside it. The freezer room has
// thicker panels, a pressure relief valve and the freezer's frost strip on its door. The plan, the
// elevation and 3D place the door with `doorSpan`, so the views agree.

import type { Front } from "../parts/elevation";
import { FROST_STRIP, frostFront, frostMark, frostPlan } from "../parts/frost";
import { TOP_RADIUS, type MaterialId, type Parts, type Size } from "../parts/mesh";
import type { PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";
import { bottle, coolDoor, doorFront, doorSwings, gasket, GLASS_FRAME_MM, hingeLeft, LEAF_GAP_MM, LEAF_RADIUS, m, pushButton, wireShelves } from "./common";

/** Panel thickness of a cold room and of a freezer room (mm, common PU sandwich panels). */
export const COLD_PANEL_MM = 100;
export const FREEZER_PANEL_MM = 150;
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
/** Shortest panel at the end of a wall: closer joints are left out (mm). */
const JOINT_MARGIN_MM = 150;
/** Width of the joint groove between two panels (m), and how deep it is set back. */
const JOINT = 0.006;
const JOINT_DEPTH = 0.004;
/** Edge radius of a sandwich panel at its joints (m). */
const PANEL_RADIUS = 0.003;

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
  const margin = m(JOINT_MARGIN_MM);
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
    p.roundedBox("panel", x === a ? x : x + JOINT / 2, j === b ? j : j - JOINT / 2, y0, y1, z0, z1, PANEL_RADIUS, "vertical");
    if (j !== b) p.box("steelDark", j - JOINT / 2, j + JOINT / 2, y0, y1, z0 + JOINT_DEPTH, z1 - JOINT_DEPTH);
    x = j;
  }
}

/** A side wall along the depth from z `a` to `b` at x `x0` to `x1`, split like `wallAlongX`. */
function wallAlongZ(p: Parts, x0: number, x1: number, y0: number, y1: number, a: number, b: number): void {
  let z = a;
  for (const j of [...joints(a, b), b]) {
    p.roundedBox("panel", x0, x1, y0, y1, z === a ? z : z + JOINT / 2, j === b ? j : j - JOINT / 2, PANEL_RADIUS, "vertical");
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
export function walkInFront(p: Parts, s: Size, panelMm: number, wall: FrontWall, freezer: boolean, leafMat: MaterialId = "panel"): void {
  const { xa, xb, yTop, zIn, zFace, zFront } = wall;
  const span = doorSpan(s.w * 1000, panelMm);
  const x0 = m(span.x0);
  const x1 = m(span.x1);
  const dh = m(doorHeight(s.h * 1000, panelMm));
  const lap = m(OVERLAP_MM);
  wallAlongX(p, xa, x0, 0, yTop, zIn, zFace, -s.w / 2);
  wallAlongX(p, x1, xb, 0, yTop, zIn, zFace, -s.w / 2);
  p.roundedBox("panel", x0, x1, dh, yTop, zIn, zFace, PANEL_RADIUS, "vertical");
  // Threshold across the opening, reaching out under the leaf.
  p.roundedBox("satin", x0 - lap, x1 + lap, 0, 0.012, zIn, zFace + LEAF + 0.01, TOP_RADIUS);
  // The leaf overlaps the opening on its gasket, rounded at its front edges like a pressed leaf.
  const zLeaf = zFace + LEAF;
  const la = x0 - lap;
  const lb = x1 + lap;
  const top = dh + lap;
  gasket(p, la, lb, 0.014, top, zFace);
  p.roundedBox(leafMat, la, lb, 0.016, top, zFace + 0.004, zLeaf, LEAF_RADIUS * 2, "top", "z");
  p.plate("satin", la + 0.01, lb - 0.01, 0.026, KICK, zLeaf, zLeaf + 0.002, 0.004);
  // Three hinges on the left edge: a turned barrel on a leaf plate.
  for (const y of [0.25, dh / 2, dh - 0.15]) {
    p.roundedBox("satin", la - 0.004, la + 0.03, y + 0.01, y + 0.09, zLeaf - 0.004, zLeaf + 0.003, 0.002);
    p.lathe("satin", la - 0.004, y, zLeaf + 0.001, [
      [0, 0],
      [0.008, 0],
      [0.011, 0.006],
      [0.011, 0.094],
      [0.008, 0.1],
      [0, 0.1],
    ]);
  }
  // Lever handle on its back plate at the right edge, the lock cylinder under it.
  const hx = lb - 0.08;
  const hy = m(HANDLE_Z_MM);
  p.roundedBox("satin", hx - 0.022, hx + 0.022, hy - 0.11, hy + 0.08, zLeaf, zLeaf + 0.006, 0.004, "top", "z");
  p.lathe("handle", hx, hy, zLeaf + 0.006, [
    [0, 0],
    [0.014, 0],
    [0.012, 0.01],
    [0.009, zFront - zLeaf - 0.015],
    [0, zFront - zLeaf - 0.015],
  ], { axis: "z" });
  p.tube("handle", [
    { x: hx + 0.004, y: hy, z: zFront - 0.009 },
    { x: hx - 0.13, y: hy, z: zFront - 0.009 },
  ], 0.009);
  p.lathe("satin", hx, hy - 0.075, zLeaf + 0.006, [
    [0, 0],
    [0.011, 0],
    [0.011, 0.006],
    [0.008, 0.009],
    [0, 0.009],
  ], { axis: "z" });
  p.box("slot", hx - 0.001, hx + 0.001, hy - 0.081, hy - 0.069, zLeaf + 0.0145, zLeaf + 0.0155);
  if (freezer) {
    const fy = Math.min(m(FROST_Z_MM), dh - FROST_STRIP * 2);
    frostMark(p, la, lb, fy, fy + FROST_STRIP, zLeaf);
  }
  // Temperature display beside the door; a freezer room also has its pressure relief valve.
  const side = displayAt(span, s.w * 1000, panelMm);
  if (side !== undefined) {
    const dx = m(side);
    const dy = m(DISPLAY_Z_MM);
    p.plate("panelDark", dx, dx + 0.12, dy, dy + 0.08, zFace, zFace + 0.012, 0.006, true);
    p.plate("glassDark", dx + 0.015, dx + 0.105, dy + 0.035, dy + 0.065, zFace + 0.012, zFace + 0.0135, 0.003);
    for (const bx of [0.035, 0.06, 0.085]) pushButton(p, dx + bx, dy + 0.017, zFace + 0.012, 0.006);
    if (freezer) {
      // The valve: a round hood with its vent slots under it.
      p.lathe("paintGray", dx + 0.06, dy + 0.3, zFace, [
        [0, 0],
        [0.045, 0],
        [0.045, 0.01],
        [0.04, 0.03],
        [0.03, 0.04],
        [0, 0.045],
      ], { axis: "z" });
    }
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
      p.roundedBox("panel", -s.w / 2, s.w / 2, s.h - t, s.h, -s.d / 2, zFace, PANEL_RADIUS);
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

/** Width of one glass door of a beverage cold room, and the wall kept beside the doors (mm). */
const GLASS_DOOR_MM = 760;
const GLASS_SIDE_MM = 150;
/** Shelves behind the glass doors and the bottles standing on each, per door (budget). */
const GLASS_SHELVES = 4;
const GLASS_BOTTLES = 2;
const BOTTLE_MATS: readonly MaterialId[] = ["glassDark", "oil", "foodGreen"];

/** The glass doors of a beverage cold room across its front (mm, item frame): count and span. */
function glassDoors(width: number, panel: number): { n: number; x0: number; x1: number } {
  const span = width - 2 * (panel + GLASS_SIDE_MM);
  const n = Math.max(1, Math.floor(span / GLASS_DOOR_MM));
  return { n, x0: (-n * GLASS_DOOR_MM) / 2, x1: (n * GLASS_DOOR_MM) / 2 };
}

/**
 * Beverage cold room (Getränkekühlzelle) with a glass door front: the panel room of a cold room
 * whose front wall carries a row of glass doors, the drinks on shelves right behind them, filled
 * from inside and taken out through the doors.
 */
export const coldRoomGlass: KindDef = {
  kind: "coldRoomGlass",
  plan(s) {
    const { L, R, B, F } = s;
    const p = COLD_PANEL_MM;
    const zone = DOOR_ZONE_MM;
    const fi = F - zone - p;
    s.line("detail", [L + p, fi], [L + p, B + p], [R - p, B + p], [R - p, fi], [L + p, fi]);
    for (const j of joints(B / 1000, (F - zone) / 1000)) {
      s.line("detail", [L, j * 1000], [L + p, j * 1000]);
      s.line("detail", [R - p, j * 1000], [R, j * 1000]);
    }
    const g = glassDoors(s.w, p);
    // The shelves behind the doors, dashed, and the doors with their swings.
    s.rect("hidden", g.x0, fi - 450, g.x1, fi - 20);
    doorSwings(s, g.n, g.x0, g.x1);
  },
  elevation(f) {
    f.line("detail", [f.l, f.top - COLD_PANEL_MM], [f.r, f.top - COLD_PANEL_MM]);
    const c = (f.l + f.r) / 2;
    const g = glassDoors(f.w, COLD_PANEL_MM);
    const dw = (g.x1 - g.x0) / g.n;
    const top = Math.min(f.z0 + DOOR_H, f.top - COLD_PANEL_MM - 60);
    for (let i = 0; i < g.n; i++) {
      const a = c + g.x0 + i * dw + LEAF_GAP_MM / 2;
      const b = a + dw - LEAF_GAP_MM;
      doorFront(f, a, b, f.z0 + 60, top, hingeLeft(i, g.n), true);
      for (let k = 1; k <= GLASS_SHELVES; k++) {
        const z = f.z0 + 60 + ((top - f.z0 - 60) * k) / (GLASS_SHELVES + 1);
        f.line("detail", [a + GLASS_FRAME_MM, z], [b - GLASS_FRAME_MM, z]);
      }
    }
  },
  mesh(p, s) {
    const t = Math.min(m(COLD_PANEL_MM), s.w / 4, s.d / 4);
    const zFace = s.d / 2 - m(DOOR_ZONE_MM);
    const zIn = zFace - t;
    p.roundedBox("panel", -s.w / 2, s.w / 2, s.h - t, s.h, -s.d / 2, zFace, PANEL_RADIUS);
    wallAlongZ(p, -s.w / 2, -s.w / 2 + t, 0, s.h - t, -s.d / 2, zFace);
    wallAlongZ(p, s.w / 2 - t, s.w / 2, 0, s.h - t, -s.d / 2, zFace);
    wallAlongX(p, -s.w / 2 + t, s.w / 2 - t, 0, s.h - t, -s.d / 2, -s.d / 2 + t);
    // The front wall: panels beside the door frame and over it, the frame round the doors.
    const g = glassDoors(s.w * 1000, COLD_PANEL_MM);
    const x0 = m(g.x0);
    const x1 = m(g.x1);
    const top = Math.min(m(DOOR_H), s.h - t - 0.06);
    wallAlongX(p, -s.w / 2 + t, x0 - 0.04, 0, s.h - t, zIn, zFace, -s.w / 2);
    wallAlongX(p, x1 + 0.04, s.w / 2 - t, 0, s.h - t, zIn, zFace, -s.w / 2);
    p.roundedBox("panel", x0 - 0.04, x1 + 0.04, top + 0.04, s.h - t, zIn, zFace, PANEL_RADIUS, "vertical");
    // The door frame: jambs, sill and a mullion between two doors carrying their gaskets.
    const dw = (x1 - x0) / g.n;
    for (const [a, b] of [[x0 - 0.04, x0], [x1, x1 + 0.04]]) p.roundedBox("steelDark", a, b, 0, top + 0.04, zIn, zFace - 0.001, 0.004, "vertical");
    for (let i = 1; i < g.n; i++) p.roundedBox("steelDark", x0 + i * dw - 0.015, x0 + i * dw + 0.015, 0.06, top, zIn, zFace - 0.001, 0.003, "vertical");
    p.roundedBox("steelDark", x0 - 0.04, x1 + 0.04, top, top + 0.04, zIn, zFace - 0.001, 0.004, "vertical");
    p.roundedBox("steelDark", x0 - 0.04, x1 + 0.04, 0, 0.06, zIn, zFace + 0.01, 0.004);
    // Shelving with drinks behind the doors: wire shelves on the frame's back, bottles in front rows.
    const inner = { x0: x0 + 0.01, x1: x1 - 0.01, y0: 0.06, y1: top, z0: zIn - 0.45, z1: zIn - 0.01 };
    p.box("panelDark", x0, x1, 0.06, top, zIn - 0.47, zIn - 0.45);
    const shelves = wireShelves(p, inner, GLASS_SHELVES);
    for (const [k, y] of [inner.y0, ...shelves].entries()) {
      const above = k < shelves.length ? shelves[k] : inner.y1;
      const h = Math.min(0.28, above - y - 0.05);
      for (let i = 0; i < g.n; i++) {
        for (let j = 0; j < GLASS_BOTTLES; j++) {
          const x = x0 + i * dw + (dw * (j + 0.5)) / GLASS_BOTTLES;
          bottle(p, x, y + 0.001, zIn - 0.1, h, 0.032, BOTTLE_MATS[(i + j + k) % BOTTLE_MATS.length]);
        }
      }
    }
    for (let i = 0; i < g.n; i++) {
      const a = x0 + i * dw;
      coolDoor(p, { x0: a, x1: a + dw, y0: 0.06, y1: top, zBody: zFace - 0.001, zFront: s.d / 2, hinge: hingeLeft(i, g.n) ? "left" : "right", handle: "vertical", gripY: m(1100), glass: true, frame: "steelDark" });
    }
  },
};
