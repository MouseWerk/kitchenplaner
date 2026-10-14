// Tilting pan (Kippbratpfanne): a pan between two pedestals, tilting forward around an axis near
// the front by a hand wheel; the controls in the right pedestal. The pressure braising pan
// (`pressurePan`) has a heavy lid locked by a central wheel, a pressure gauge and a safety valve.

import { CONTROLS, GAP, SHEET } from "../parts/mesh";
import { CONTROL_STRIP, INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Depth of the pan (m). */
const PAN = 0.3;
/** Thickness of the lid (m). */
const LID = 0.02;

function makeTiltingPan(kind: string, pressure: boolean): KindDef {
  return {
    kind,
    plan(s) {
      // The pan tilts forward around an axis near the front; the pivots sit at both sides.
      const axisY = s.F - CONTROL_STRIP;
      s.rect("detail", s.L + 2 * INSET, s.B + INSET, s.R - 2 * INSET, axisY - INSET);
      s.line("hidden", [s.L + INSET, axisY], [s.R - INSET, axisY]);
      s.circle("detail", s.L + INSET, axisY, INSET / 2);
      s.circle("detail", s.R - INSET, axisY, INSET / 2);
      // The pouring lip at the front of the pan.
      s.line("detail", [-INSET * 2, axisY - INSET], [-INSET, axisY - INSET / 2], [INSET, axisY - INSET / 2], [INSET * 2, axisY - INSET]);
      if (pressure) s.circle("detail", 0, (s.B + axisY) / 2, Math.min(s.w, s.d) * 0.08);
    },
    elevation(f) {
      // The pedestals at both sides, the pan between them, the controls on the right pedestal.
      const { l, r, z0, top } = f;
      const ped = Math.min(200, f.w * 0.15);
      f.box("detail", l, l + ped, z0, top);
      f.box("detail", r - ped, r, z0, top);
      f.box("detail", l + ped + INSET / 4, r - ped - INSET / 4, top - PAN * 1000 - LID * 1000, top - LID * 1000);
      f.line("detail", [l + ped + INSET, top - LID * 1000 + 10], [r - ped - INSET, top - LID * 1000 + 10]);
      f.box("detail", r - ped + INSET / 4, r - INSET / 4, top - CONTROLS * 2500, top - 30, "item-dark");
      f.circle("detail", r - ped / 2, top - PAN * 1000 - 150, Math.min(70, ped * 0.4));
    },
    mesh(p, s) {
      // Two pedestals carry the pan between them on its tilting axis.
      const ped = Math.min(0.2, s.w * 0.15);
      const panTop = s.h - LID;
      const panBottom = panTop - PAN;
      for (const sx of [-1, 1]) {
        const x0 = sx < 0 ? -s.w / 2 : s.w / 2 - ped;
        p.box("steel", x0, x0 + ped, 0.012, s.h, -s.d / 2, s.d / 2 - 0.02);
        p.box("rubber", x0 + 0.02, x0 + ped - 0.02, 0, 0.012, -s.d / 2 + 0.02, s.d / 2 - 0.04);
      }
      // Control panel with knobs and a display on the right pedestal.
      const px0 = s.w / 2 - ped + GAP;
      const px1 = s.w / 2 - GAP;
      const zFace = s.d / 2 - 0.02;
      p.box("panelDark", px0, px1, s.h - CONTROLS * 2.5, s.h - 0.03, zFace, zFace + 0.002);
      p.box("glassDark", px0 + 0.02, px1 - 0.02, s.h - 0.09, s.h - 0.05, zFace + 0.002, zFace + 0.004);
      p.knob((px0 + px1) / 2 - ped * 0.2, s.h - CONTROLS * 1.3, zFace + 0.002, s.d / 2);
      p.knob((px0 + px1) / 2 + ped * 0.2, s.h - CONTROLS * 1.3, zFace + 0.002, s.d / 2);
      // The hand wheel that tilts the pan, on the front of the right pedestal.
      const wy = panBottom - 0.15;
      p.rod("handle", "z", (px0 + px1) / 2, wy, s.d / 2 - 0.015, 0.03, 0.012);
      p.rod("steelDark", "z", (px0 + px1) / 2, wy, s.d / 2 - 0.006, 0.012, Math.min(0.07, ped * 0.4));
      p.rod("handle", "x", (px0 + px1) / 2 + Math.min(0.06, ped * 0.35), wy, s.d / 2 - 0.006, 0.012, 0.006);
      // The pan, its pivots and the pouring lip.
      const x0 = -s.w / 2 + ped + GAP * 2;
      const x1 = s.w / 2 - ped - GAP * 2;
      const z0 = -s.d / 2 + 0.02;
      const z1 = s.d / 2 - 0.08;
      p.tub("steel", x0, x1, panBottom, panTop, z0, z1);
      p.box("steelDark", x0 + SHEET, x1 - SHEET, panBottom - 0.04, panBottom, z0 + SHEET, z1 - SHEET);
      p.box("steel", -0.06, 0.06, panTop - 0.06, panTop - 0.02, z1, z1 + 0.04);
      for (const x of [x0, x1]) p.rod("steelDark", "x", x + (x === x0 ? -GAP : GAP), panTop - 0.08, z1 - 0.04, GAP * 2 + 0.002, 0.03);
      // The lid lies closed on the pan, its handle bar along the front edge.
      const lidTop = pressure ? s.h - 0.006 : s.h;
      p.box("steel", x0, x1, panTop, lidTop, z0, z1);
      const hz = z1 + 0.02;
      p.rod("handle", "x", (x0 + x1) / 2, panTop + 0.01, hz, (x1 - x0) * 0.7, 0.01);
      for (const sx of [-1, 1]) p.box("handle", sx * (x1 - x0) * 0.33 - 0.008, sx * (x1 - x0) * 0.33 + 0.008, panTop + 0.004, panTop + 0.016, z1, hz);
      if (pressure) {
        // The locking wheel in the middle of the lid, the gauge and the safety valve beside it.
        const cz = (z0 + z1) / 2;
        const r = Math.min(0.12, (z1 - z0) * 0.18);
        p.cyl("steelDark", 0, cz, lidTop, s.h - 0.003, r);
        p.cyl("handle", 0, cz, lidTop, s.h, r * 0.3);
        p.cyl("panel", (x1 - x0) * 0.3, cz, lidTop, s.h - 0.002, 0.035);
        p.cyl("handle", -(x1 - x0) * 0.3, cz, lidTop, s.h - 0.001, 0.02);
      }
    },
  };
}

export const tiltingPan = makeTiltingPan("tiltingPan", false);
export const pressurePan = makeTiltingPan("pressurePan", true);
