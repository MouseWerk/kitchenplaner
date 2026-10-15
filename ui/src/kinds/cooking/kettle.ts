// Boiling kettle (Kochkessel): a round vessel on legs beside a narrow control column at the
// right, a lid hinged at the back, a draw-off tap at the front and a swivel fill tap on the
// column. Heated directly (`kettle`) or indirectly through a water jacket (`kettleIndirect`, with
// a pressure gauge and a safety valve on the column). The vessel grows with the unit: a 60 l
// kettle on the 700 line is small and on long legs, a 150 l one wide and deep.
//
// The flue outlet of a gas kettle sits on top of the column, not at the back of the box (there
// is nothing there to carry it), so the kind draws it itself (`flue: false`).

import type { Front } from "../parts/elevation";
import type { Parts, Size } from "../parts/mesh";
import type { PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";

/** Room the draw-off tap takes in front of the vessel (m). */
const TAP_REACH = 0.09;
/** Width of the control column at the right, and the share of the depth it takes from the back (m). */
const COLUMN = 0.16;
const COLUMN_DEPTH = 0.5;
/** The base frame the legs stand on: two rails across, from the left side to the column (m). */
const RAIL = 0.04;
/** Room beside the vessel and behind it (m). */
const SIDE = 0.02;
const BACK = 0.03;
/** Depth a unit needs besides the vessel's radius: the 700 line only holds a small kettle (m). */
const DEPTH_ROOM = 0.47;
/** Leg height from the vessel radius: a large vessel sits low, a small one on long legs (m). */
const LEGS_AT_ZERO = 0.95;
const LEGS_PER_RADIUS = 2.2;
const LEGS_MIN = 0.1;
const LEGS_MAX = 0.4;
/** Lid thickness and the rim ring under it (m). */
const LID = 0.02;
const RIM = 0.015;
/** How far the swivel fill tap rises over the column (mm). */
const FILL_RISE = 250;
/** Radius of the fill tap's pipe (m). */
const FILL_PIPE = 0.011;
/** The gas flue outlet on the column top: depth, distance from the back and slot pitch (m). */
const FLUE_DEPTH = 0.06;
const FLUE_BACK = 0.03;
const FLUE_SLOT = 0.008;
const FLUE_PITCH = 0.016;
const FLUE_HEIGHT = 0.03;

/** Where the parts of a kettle go, from its size (m). */
function layout(s: Size) {
  const colX0 = s.w / 2 - COLUMN;
  const cx = (-s.w / 2 + colX0) / 2;
  const zFront = s.d / 2 - TAP_REACH;
  const zBack = -s.d / 2 + BACK;
  const r = Math.max(0.05, Math.min((colX0 + s.w / 2) / 2 - SIDE, (zFront - zBack) / 2, s.d - DEPTH_ROOM));
  const cz = (zFront + zBack) / 2;
  const legs = Math.min(LEGS_MAX, Math.max(LEGS_MIN, LEGS_AT_ZERO - LEGS_PER_RADIUS * r));
  const rim = s.h - LID - 0.01;
  const colX = s.w / 2 - COLUMN / 2;
  const zCol = -s.d / 2 + s.d * COLUMN_DEPTH;
  // The fill tap stands on the column level with the back of the vessel and reaches over it.
  const fillZ = cz - r * 0.4;
  const fillTo = cx + r * 0.35;
  return { colX0, colX, zCol, cx, cz, r, legs, rim, fillZ, fillTo };
}

/** The flue outlet on the column top (m). */
function flue(s: Size) {
  const x0 = s.w / 2 - COLUMN + 0.02;
  const x1 = s.w / 2 - 0.02;
  const z0 = -s.d / 2 + FLUE_BACK;
  return { x0, x1, z0, z1: z0 + FLUE_DEPTH };
}

function sizeOf(item: { width: number; depth: number; height: number }): Size {
  return { w: item.width / 1000, d: item.depth / 1000, h: item.height / 1000 };
}

function plan(s: PlanSketch, indirect: boolean) {
  const m = layout(sizeOf(s.item));
  const k = (v: number) => v * 1000;
  // The control column at the right.
  s.rect("detail", k(m.colX0), s.B, s.R, k(m.zCol));
  s.circle("detail", k(m.cx), k(m.cz), k(m.r));
  if (indirect) s.circle("detail", k(m.cx), k(m.cz), k(m.r) * 0.92);
  // The draw-off tap at the front and the fill tap on the column.
  s.rect("detail", k(m.cx) - 20, k(m.cz + m.r), k(m.cx) + 20, s.F);
  s.circle("detail", k(m.colX), k(m.fillZ), 20);
  s.line("detail", [k(m.colX), k(m.fillZ)], [k(m.fillTo), k(m.fillZ)]);
  if (s.item.energy === "gas") {
    const f = flue(sizeOf(s.item));
    s.rect("detail", k(f.x0), k(f.z0), k(f.x1), k(f.z1));
    s.line("detail", [k(f.x0), k(f.z0)], [k(f.x1), k(f.z1)]);
    s.line("detail", [k(f.x1), k(f.z0)], [k(f.x0), k(f.z1)]);
  }
}

function elevation(f: Front, indirect: boolean) {
  const s = { w: f.w / 1000, d: f.item.depth / 1000, h: f.item.height / 1000 };
  const m = layout(s);
  const X = (x: number) => f.l + (x + s.w / 2) * 1000;
  const cx = X(m.cx);
  const r = m.r * 1000;
  const z0 = f.z0;
  const legs = z0 + m.legs * 1000;
  const rim = z0 + m.rim * 1000;
  // The base frame and the legs on it.
  const c0 = X(m.colX0);
  const rail = z0 + RAIL * 1000;
  f.box("detail", f.l, c0, z0, rail);
  f.line("detail", [cx - r * 0.6, rail], [cx - r * 0.6, legs]);
  f.line("detail", [cx + r * 0.6, rail], [cx + r * 0.6, legs]);
  f.box("detail", cx - r, cx + r, legs, rim);
  f.box("detail", cx - r, cx + r, rim, f.top - 10);
  // The draw-off tap and its lever.
  f.box("detail", cx - 25, cx + 25, legs + 30, legs + 80);
  f.line("detail", [cx, legs + 80], [cx, legs + 160]);
  // The control column with its panel and knobs.
  const pc = X(m.colX);
  f.box("detail", c0, f.r, z0, f.top);
  f.box("detail", c0 + 20, f.r - 20, f.top - 350, f.top - 30, "item-dark");
  f.circle("detail", pc, f.top - 120, 25);
  f.circle("detail", pc, f.top - 250, 25);
  if (indirect) f.circle("detail", pc, f.top - 450, 40);
  // The swivel fill tap over the vessel.
  const fy = f.top + FILL_RISE * 0.92;
  f.line("detail", [pc, f.top], [pc, fy], [X(m.fillTo), fy], [X(m.fillTo), fy - 40]);
  if (f.item.energy === "gas") {
    const fl = flue(s);
    f.box("hidden", X(fl.x0), X(fl.x1), f.top - FLUE_HEIGHT * 1000, f.top);
  }
}

/** The swivel fill tap on the column: a pillar and a spout reaching over the vessel (m). */
function fillTap(p: Parts, x: number, z: number, y0: number, xTo: number) {
  const top = y0 + FILL_RISE / 1000;
  const r = FILL_PIPE;
  p.cyl("handle", x, z, y0, y0 + 0.02, r * 2);
  p.cyl("handle", x, z, y0, top - r, r);
  p.rod("handle", "x", (x + xTo) / 2, top - r, z, x - xTo, r);
  p.cyl("handle", xTo, z, top - r - 0.05, top - r, r * 0.8);
  // The tap's handwheel on the pillar.
  p.rod("knob", "z", x, y0 + 0.1, z + r + 0.008, 0.016, 0.02);
}

function makeKettle(kind: string, indirect: boolean): KindDef {
  return {
    kind,
    flue: false,
    rise: FILL_RISE,
    plan(s) {
      plan(s, indirect);
    },
    elevation(f) {
      elevation(f, indirect);
    },
    mesh(p, s, item) {
      const m = layout(s);
      const { cx, cz, r, legs, rim } = m;
      // The control column at the right, on a dark base.
      p.box("steel", m.colX0, s.w / 2, RAIL, s.h, -s.d / 2, m.zCol);
      p.box("steelDark", m.colX0 + 0.01, s.w / 2 - 0.01, 0, RAIL, -s.d / 2 + 0.01, m.zCol - 0.01);
      // The base frame: two rails from the left side to the column, under the legs.
      for (const sz of [-1, 1]) {
        const z = cz + sz * r * 0.6;
        p.box("steelDark", -s.w / 2, m.colX0, 0, RAIL, z - RAIL / 2, z + RAIL / 2);
      }
      // The vessel on its legs; an indirect one in its water jacket.
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = cx + sx * r * 0.6;
        const z = cz + sz * r * 0.6;
        p.cyl("steelDark", x, z, RAIL, legs, 0.02);
      }
      p.cyl("steelDark", cx, cz, legs - 0.02, legs, r * 0.8);
      p.cyl("steel", cx, cz, legs, rim - RIM, r);
      if (indirect) p.cyl("steel", cx, cz, legs, legs + (rim - legs) * 0.75, r * 1.03);
      p.cyl("handle", cx, cz, rim - RIM, rim, r * 1.04);
      // The bracket holding the vessel on the column.
      const by = legs + (rim - legs) * 0.4;
      const bz = Math.min(cz, m.zCol - 0.06);
      p.box("steelDark", cx + r * 0.9, m.colX0, by, by + 0.1, bz - 0.05, bz + 0.05);
      // The lid with its knob, hinged at the back, its handle bar at the front.
      p.cyl("steel", cx, cz, rim, s.h - 0.01, r);
      p.cyl("steelDark", cx, cz, s.h - 0.01, s.h - 0.006, r * 0.15);
      p.box("steelDark", cx - r * 0.3, cx + r * 0.3, rim - 0.03, s.h - 0.012, cz - r - 0.025, cz - r * 0.9);
      p.rod("handle", "x", cx, s.h - 0.016, cz + r * 0.85, r * 0.6, 0.008);
      for (const sx of [-1, 1]) p.box("handle", cx + sx * r * 0.3 - 0.006, cx + sx * r * 0.3 + 0.006, rim + 0.004, s.h - 0.016, cz + r * 0.8, cz + r * 0.85);
      // The draw-off tap at the bottom front, its lever pointing up.
      const ty = legs + 0.06;
      const zt = s.d / 2;
      p.rod("handle", "z", cx, ty, (cz + r - 0.01 + zt - 0.03) / 2, zt - 0.03 - (cz + r - 0.01), 0.025);
      p.cyl("handle", cx, zt - 0.025, ty - 0.06, ty, 0.015);
      p.box("knob", cx - 0.01, cx + 0.01, ty + 0.02, ty + 0.12, zt - 0.06, zt - 0.04);
      p.rod("handle", "z", cx, ty, zt - 0.015, 0.03, 0.03);
      // The control panel on the front of the column: two knobs and a pilot light.
      const zf = m.zCol;
      const px = m.colX;
      p.box("panelDark", m.colX0 + 0.02, s.w / 2 - 0.02, s.h - 0.35, s.h - 0.03, zf, zf + 0.002);
      p.knob(px, s.h - 0.12, zf + 0.002, zf + 0.03);
      p.knob(px, s.h - 0.25, zf + 0.002, zf + 0.03);
      p.rod("zone", "z", px, s.h - 0.32, zf + 0.006, 0.008, 0.006);
      if (indirect) {
        // Pressure gauge of the water jacket under the panel, the safety valve on the column top.
        const gy = s.h - 0.45;
        const gr = 0.04;
        p.rod("steel", "z", px, gy, zf + 0.01, 0.02, gr);
        p.rod("panel", "z", px, gy, zf + 0.021, 0.002, gr * 0.85);
        p.box("handle", px - 0.002, px + 0.002, gy, gy + gr * 0.7, zf + 0.022, zf + 0.024);
        p.cyl("handle", px, zf - 0.05, s.h, s.h + 0.06, 0.015);
      }
      fillTap(p, px, m.fillZ, s.h, m.fillTo);
      if (item.energy === "gas") {
        // The flue outlet on the column top: dark slots across a steel collar.
        const f = flue(s);
        p.box("steel", f.x0, f.x1, s.h - FLUE_HEIGHT, s.h - 0.002, f.z0, f.z1).name = "flue";
        const n = Math.max(1, Math.floor((f.x1 - f.x0) / FLUE_PITCH));
        const pitch = (f.x1 - f.x0) / n;
        for (let i = 0; i < n; i++) {
          const x = f.x0 + pitch * (i + 0.5);
          p.box("flue", x - FLUE_SLOT / 2, x + FLUE_SLOT / 2, s.h - FLUE_HEIGHT, s.h, f.z0, f.z1).name = "flue";
        }
      }
    },
  };
}

export const kettle = makeKettle("kettle", false);
export const kettleIndirect = makeKettle("kettleIndirect", true);
