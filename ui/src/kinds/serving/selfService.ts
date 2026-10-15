// Self-service: the cutlery and napkin dispenser for a counter top, the tray stand, and the
// soft ice machines: the floor-standing soft-serve machine (Softeismaschine) and the counter-top
// frozen yoghurt machine, both with two flavours and a twist between them.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, castor, foot, type Parts, type Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { dripTray, pilotLamp, trayStack } from "./common";
import { ventSlots } from "../parts/details";

// ---------------------------------------------------------------------------------------------
// Cutlery and napkin dispenser

/** Quivers along the dispenser (pitch, m), their radius and height (m). */
const QUIVER_PITCH = 0.11;
const QUIVER_R = 0.045;
const QUIVER_H = 0.15;
/** Width of the napkin box at the right (m). */
const NAPKIN_W = 0.18;

function quiverXs(w: number): number[] {
  const span = w - NAPKIN_W - 0.04;
  const n = Math.max(1, Math.floor(span / QUIVER_PITCH));
  return Array.from({ length: n }, (_, i) => -w / 2 + 0.02 + (span / n) * (i + 0.5));
}

export const cutleryDispenser: KindDef = {
  kind: "cutleryDispenser",
  placement: "tableTop",
  plan(s) {
    for (const x of quiverXs(s.w / 1000)) s.circle("detail", x * 1000, 0, QUIVER_R * 1000);
    s.rect("detail", s.R - NAPKIN_W * 1000, s.B + INSET / 2, s.R - INSET / 2, s.F - INSET / 2);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const scale = f.w / f.item.width;
    for (const x of quiverXs(f.item.width / 1000)) {
      const cx = (l + r) / 2 + x * 1000 * scale;
      f.box("detail", cx - QUIVER_R * 1000, cx + QUIVER_R * 1000, z0 + 15, z0 + 15 + QUIVER_H * 1000);
      f.line("detail", [cx, z0 + 15 + QUIVER_H * 1000], [cx, top]);
    }
    f.box("detail", r - NAPKIN_W * 1000, r - 10, z0, z0 + 130);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    // The base tray, its rail at the back, the quivers on it with cutlery standing handle up.
    p.roundedBox("steel", -w / 2, w / 2, 0, 0.015, -d / 2, d / 2, 0.006);
    p.roundedBox("steel", -w / 2 + 0.01, w / 2 - 0.01, 0.015, h * 0.65, -d / 2, -d / 2 + 0.012, 0.004, "top");
    for (const [k, x] of quiverXs(w).entries()) {
      const r = Math.min(QUIVER_R, d / 2 - 0.02);
      p.lathe("satin", x, 0.015, 0, [
        [0, 0],
        [r * 0.9, 0],
        [r, 0.006],
        [r, QUIVER_H - 0.006],
        [r + 0.003, QUIVER_H - 0.003],
        [r, QUIVER_H],
        [r - 0.003, QUIVER_H],
        [r - 0.003, 0.01],
        [0, 0.01],
      ]);
      for (const [j, dx] of [-0.014, 0, 0.014].entries()) {
        const top = h - (j === 1 ? 0 : 0.015) - (k % 2) * 0.01;
        p.roundedBox("handle", x + dx - 0.005, x + dx + 0.005, QUIVER_H - 0.04, top, dx * 0.3 - 0.002, dx * 0.3 + 0.002, 0.0015, "vertical", "z");
      }
    }
    // The napkin box with the napkin showing in its slot.
    const nx = w / 2 - 0.005;
    p.roundedBox("steel", nx - NAPKIN_W, nx, 0.015, 0.14, -d / 2 + 0.02, d / 2 - 0.01, 0.01);
    p.roundedBox("slot", nx - NAPKIN_W + 0.03, nx - 0.03, 0.1395, 0.1405, -0.02, 0.02, 0.01, "vertical");
    p.roundedBox("panel", nx - NAPKIN_W + 0.04, nx - 0.04, 0.136, 0.146, -0.012, 0.012, 0.005);
  },
};

// ---------------------------------------------------------------------------------------------
// Tray stand

/** Tray levels of the stand and the thickness of a tray (m). */
const TRAY_LEVELS = 10;
const TRAY_T = 0.02;
/** Radius of the frame tubes (m). */
const FRAME_R = 0.012;

export const trayStand: KindDef = {
  kind: "trayStand",
  plan(s) {
    s.rect("detail", s.L + INSET, s.B + INSET / 2, s.R - INSET, s.F - INSET / 2);
    for (const x of [s.L + INSET / 2, s.R - INSET / 2]) s.line("detail", [x, s.B], [x, s.F]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.line("detail", [l + FRONT_INSET / 2, z0], [l + FRONT_INSET / 2, top]);
    f.line("detail", [r - FRONT_INSET / 2, z0], [r - FRONT_INSET / 2, top]);
    const y0 = z0 + 150;
    for (let k = 0; k < TRAY_LEVELS; k++) {
      const y = y0 + ((top - 60 - y0) * k) / (TRAY_LEVELS - 1);
      f.line("detail", [l + FRONT_INSET, y], [r - FRONT_INSET, y]);
    }
  },
  mesh(p, s) {
    const { w, d, h } = s;
    // Two side frames, each a tube bent into a tall U standing on castors' plates, joined by
    // cross tubes at the top and the bottom; angle runners on the frames' insides, a tray on each.
    const c = 0.04;
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - FRAME_R);
      p.tube(
        "handle",
        [
          { x, y: 0.11, z: -d / 2 + FRAME_R },
          { x, y: h - FRAME_R, z: -d / 2 + FRAME_R },
          { x, y: h - FRAME_R, z: d / 2 - FRAME_R },
          { x, y: 0.11, z: d / 2 - FRAME_R },
        ],
        FRAME_R,
        { bend: 0.05 },
      );
      p.roundedBox("steel", x - FRAME_R, x + FRAME_R, 0.1, 0.13, -d / 2 + 0.005, d / 2 - 0.005, 0.004, "all", "z");
      for (const z of [-d / 2 + c, d / 2 - c]) castor(p, sx * (w / 2 - c), z, c, 0.1);
    }
    for (const y of [0.12, h - FRAME_R]) for (const z of [-d / 2 + FRAME_R, d / 2 - FRAME_R]) p.rod("handle", "x", 0, y, z, w - FRAME_R * 4, FRAME_R * 0.8);
    const y0 = 0.15;
    const tw = w / 2 - FRAME_R * 2 - 0.004;
    for (let k = 0; k < TRAY_LEVELS; k++) {
      const y = y0 + ((h - 0.06 - y0) * k) / (TRAY_LEVELS - 1);
      for (const sx of [-1, 1]) p.roundedBox("steel", sx > 0 ? tw - 0.002 : -tw - 0.018, sx > 0 ? tw + 0.018 : -tw + 0.002, y - 0.004, y, -d / 2 + 0.03, d / 2 - 0.03, 0.002);
      trayStack(p, -tw + 0.004, tw - 0.004, y, -d / 2 + 0.03, d / 2 - 0.03, 1, TRAY_T);
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Soft ice machines

/** Share of the height the freezer head takes on a floor machine (the cabinet the rest). */
const HEAD_SHARE = 0.55;

/**
 * The head of a soft ice machine filling the box from `y0` to the top: a pressed body with the
 * hopper lids on top, the freezing door with three draw handles (two flavours and a twist) and
 * its spouts at the front, the drip tray under them, the control panel above the door and the
 * louvres at the sides.
 */
function iceHead(p: Parts, { w, d, h }: Size, y0: number): void {
  const zb = d / 2 - 0.1;
  const hh = h - y0;
  p.roundedBox("steel", -w / 2, w / 2, y0, h - 0.03, -d / 2, zb, 0.012, "vertical");
  p.roundedBox("steel", -w / 2, w / 2, h - 0.03, h, -d / 2, zb, 0.012);
  // Hopper lids on top, each with its grip.
  for (const sx of [-1, 1]) {
    const x = (sx * w) / 4;
    p.roundedBox("panel", x - w / 4 + 0.03, x + w / 4 - 0.03, h - 0.002, h, -d / 2 + 0.06, zb - 0.06, 0.02, "vertical");
  }
  // The control panel, the freezing door with its three handles and spouts, the drip tray.
  p.plate("panelDark", -w / 2 + 0.04, w / 2 - 0.04, h - 0.12, h - 0.05, zb, zb + 0.004, 0.008, true);
  p.plate("glassDark", -0.06, 0.06, h - 0.1, h - 0.07, zb + 0.004, zb + 0.005, 0.004);
  for (const sx of [-1, 1]) pilotLamp(p, sx * (w / 2 - 0.08), h - 0.085, zb + 0.004, sx > 0 ? "foodGreen" : "oil", 0.006);
  const dy = y0 + hh * 0.35;
  p.roundedBox("glass", -w / 2 + 0.05, w / 2 - 0.05, dy, dy + hh * 0.3, zb, zb + 0.04, 0.02, "all", "z");
  p.roundedBox("satin", -w / 2 + 0.06, w / 2 - 0.06, dy + hh * 0.3 - 0.02, dy + hh * 0.3, zb + 0.005, zb + 0.06, 0.008, "all", "x");
  for (const x of [-w / 4, 0, w / 4]) {
    p.lathe("satin", x, dy - 0.04, zb + 0.04, [[0, 0], [0.012, 0], [0.018, 0.02], [0.018, 0.04], [0, 0.04]]);
    p.tube(
      "knob",
      [
        { x, y: dy + hh * 0.3 - 0.01, z: zb + 0.06 },
        { x, y: dy + hh * 0.3 + 0.05, z: d / 2 - 0.012 },
      ],
      0.012,
    );
    p.lathe("knob", x, dy + hh * 0.3 + 0.05, d / 2 - 0.012, [[0, 0], [0.012, 0], [0.012, 0.02], [0, 0.03]]);
  }
  dripTray(p, -w / 2 + 0.04, w / 2 - 0.04, y0 + 0.02, y0 + 0.045, zb, d / 2 - 0.01);
  // Louvres at the sides of the head, as slots on its front corners.
  ventSlots(p, -w / 2 + 0.03, -w / 2 + 0.12, y0 + hh * 0.1, y0 + hh * 0.3, zb, 4);
  ventSlots(p, w / 2 - 0.12, w / 2 - 0.03, y0 + hh * 0.1, y0 + hh * 0.3, zb, 4);
}

function makeIceMachine(kind: string, floor: boolean): KindDef {
  return {
    kind,
    placement: floor ? "floor" : "tableTop",
    plan(s) {
      s.rect("detail", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.F - 100);
      for (const x of [-s.w / 4, 0, s.w / 4]) s.circle("detail", x, s.F - 60, 20);
      s.line("detail", [0, s.B + INSET], [0, s.F - 100 - INSET]);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const y0 = floor ? z0 + f.item.height * (1 - HEAD_SHARE) : z0;
      const hh = top - y0;
      if (floor) f.box("detail", l + FRONT_INSET / 2, r - FRONT_INSET / 2, z0 + 120, y0 - FRONT_INSET / 2);
      f.box("detail", l + 50, r - 50, y0 + hh * 0.35, y0 + hh * 0.65, "glass");
      f.box("detail", l + 40, r - 40, top - 120, top - 50, "item-dark");
      for (const x of [l + (r - l) / 4, (l + r) / 2, r - (r - l) / 4]) f.line("detail", [x, y0 + hh * 0.65], [x, y0 + hh * 0.75]);
    },
    mesh(p, s) {
      const { w, d, h } = s;
      let y0 = 0;
      if (floor) {
        // The cabinet under the head on castors, with its door and louvre.
        y0 = h * (1 - HEAD_SHARE);
        const c = 0.045;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) castor(p, sx * (w / 2 - c - 0.01), sz * (d / 2 - c - 0.11), c, 0.11);
        p.roundedBox("steel", -w / 2, w / 2, 0.11, y0, -d / 2, d / 2 - 0.12, BODY_RADIUS * 4, "vertical");
        p.roundedBox("steel", -w / 2 + 0.01, w / 2 - 0.01, 0.13, y0 - 0.02, d / 2 - 0.12, d / 2 - 0.105, 0.002, "top", "z");
        p.barHandle("y", y0 - 0.25, y0 - 0.08, w / 2 - 0.05, d / 2 - 0.105, d / 2 - 0.085);
        ventSlots(p, -w / 2 + 0.06, w / 2 - 0.12, 0.17, 0.33, d / 2 - 0.105, 5);
      } else {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (w / 2 - 0.04), sz * (d / 2 - 0.14), 0.03, 0.016);
        y0 = 0.03;
      }
      iceHead(p, s, y0);
    },
  };
}

export const softServe = makeIceMachine("softServe", true);
export const frozenYoghurt = makeIceMachine("frozenYoghurt", false);
