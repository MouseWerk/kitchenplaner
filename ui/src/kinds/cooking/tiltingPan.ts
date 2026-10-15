// Tilting pan (Kippbratpfanne): a pan between two pedestals, tilting forward around an axis near
// the front by a hand wheel; the controls in the right pedestal. The pressure braising pan
// (`pressurePan`) has a heavy lid locked by a central wheel, a pressure gauge and a safety valve.

import { BODY_RADIUS, CONTROLS, GAP, SHEET } from "../parts/mesh";
import { CONTROL_STRIP, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { handWheel, hinges, pilot } from "./details";
import { controlPanel, display, housing, ratingPlate } from "../parts/details";

/** Depth of the pan (m). */
const PAN = 0.3;
/** Edge radius of the pedestals (m), and the half width of the pouring lip. */
const PEDESTAL_RADIUS = 0.004;
const LIP = 0.07;
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
      const zf = s.d / 2;
      for (const sx of [-1, 1]) {
        const x0 = sx < 0 ? -s.w / 2 : s.w / 2 - ped;
        p.roundedBox("steel", x0, x0 + ped, 0.012, s.h, -s.d / 2, zf - 0.02, PEDESTAL_RADIUS);
        p.roundedBox("rubber", x0 + 0.02, x0 + ped - 0.02, 0, 0.014, -s.d / 2 + 0.02, zf - 0.04, BODY_RADIUS, "vertical");
      }
      // Control panel with a display, two knobs and a pilot light on the right pedestal.
      const px0 = s.w / 2 - ped + GAP;
      const px1 = s.w / 2 - GAP;
      const pcx = (px0 + px1) / 2;
      const zFace = zf - 0.018;
      controlPanel(p, px0, px1, s.h - CONTROLS * 2.5, s.h - 0.03, zf - 0.022, zFace);
      display(p, pcx, s.h - 0.07, px1 - px0 - 0.04, 0.04, zFace);
      p.knob(pcx - ped * 0.2, s.h - CONTROLS * 1.4, zFace, zf);
      p.knob(pcx + ped * 0.2, s.h - CONTROLS * 1.4, zFace, zf);
      pilot(p, pcx, s.h - CONTROLS * 2.1, zFace);
      ratingPlate(p, pcx, 0.125, zf - 0.02, 0.08, 0.05);
      // The hand wheel that tilts the pan, on the front of the right pedestal.
      handWheel(p, pcx, panBottom - 0.15, zf - 0.02, Math.min(0.07, ped * 0.4), 0.02);
      // The pan between the pedestals: a deep tub with a satin rim round its top and the heated
      // floor under it, the pouring lip at the front.
      const x0 = -s.w / 2 + ped + GAP * 3;
      const x1 = s.w / 2 - ped - GAP * 3;
      const z0 = -s.d / 2 + 0.02;
      const z1 = zf - 0.08;
      p.tub("steel", x0, x1, panBottom, panTop, z0, z1);
      p.roundedBox("steelDark", x0 + SHEET, x1 - SHEET, panBottom - 0.05, panBottom + 0.002, z0 + SHEET, z1 - SHEET, BODY_RADIUS);
      p.lathe("satin", (x0 + x1) / 2, panTop - 0.012, (z0 + z1) / 2, [
        [0.004, 0],
        [0.012, 0],
        [0.012, 0.012],
        [0.004, 0.012],
        [0.004, 0],
      ], { rect: [(x1 - x0) / 2 - 0.012, (z1 - z0) / 2 - 0.012] });
      p.extrude("steel", "x", -LIP, LIP, [
        [z1 - 0.012, panTop - 0.09],
        [z1 + 0.04, panTop - 0.012],
        [z1 + 0.04, panTop - 0.002],
        [z1 - 0.012, panTop - 0.002],
      ]);
      // The pivots of the tilting axis: turned hubs from the pan into the pedestals.
      for (const [xa, xb] of [
        [x0 - GAP * 3 - 0.004, x0],
        [x1, x1 + GAP * 3 + 0.004],
      ]) {
        p.lathe("satin", xa, panTop - 0.08, z1 - 0.04, [
          [0, 0],
          [0.03, 0],
          [0.034, 0.003],
          [0.034, xb - xa - 0.003],
          [0.03, xb - xa],
          [0, xb - xa],
        ], { axis: "x" });
      }
      // The lid lies closed on the pan inside its rim: rounded like a pressed cover, hinged at
      // the back, with a handle bar along the front.
      const lidTop = pressure ? s.h - 0.008 : s.h;
      housing(p, "steel", x0 + 0.004, x1 - 0.004, panTop - 0.002, lidTop, z0 + 0.004, z1 - 0.004, 0.006);
      hinges(p, x0 + 0.05, x1 - 0.05, panTop + 0.004, z0 - 0.002, 2, 0.012, 0.08);
      const len = (x1 - x0) * 0.7;
      p.tube("handle", [
        { x: -len / 2, y: lidTop - 0.008, z: z1 - 0.03 },
        { x: -len / 2, y: lidTop - 0.008, z: z1 + 0.025 },
        { x: len / 2, y: lidTop - 0.008, z: z1 + 0.025 },
        { x: len / 2, y: lidTop - 0.008, z: z1 - 0.03 },
      ], 0.008, { bend: 0.02 });
      if (pressure) {
        // The locking wheel in the middle of the lid, the gauge and the safety valve beside it.
        const cz = (z0 + z1) / 2;
        const r = Math.min(0.12, (z1 - z0) * 0.18);
        p.lathe("steelDark", 0, lidTop - 0.002, cz, [
          [0, 0],
          [r * 0.35, 0],
          [r * 0.35, 0.006],
          [0, 0.006],
        ]);
        const ry = s.h - 0.004;
        p.ring("satin", 0, cz, ry, r - 0.004, 0.004);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          p.bar("satin", { x: r * 0.3 * Math.cos(a), y: ry, z: cz + r * 0.3 * Math.sin(a) }, { x: (r - 0.006) * Math.cos(a), y: ry, z: cz + (r - 0.006) * Math.sin(a) }, 0.003);
        }
        p.lathe("handle", 0, lidTop - 0.002, cz, [
          [0, 0],
          [r * 0.3, 0],
          [r * 0.3, 0.004],
          [r * 0.2, 0.01],
          [0, 0.01],
        ]);
        const gx = (x1 - x0) * 0.3;
        p.lathe("satin", gx, lidTop - 0.002, cz, [
          [0, 0],
          [0.035, 0],
          [0.035, 0.006],
          [0, 0.006],
        ]);
        p.lathe("panel", gx, lidTop + 0.004, cz, [
          [0, 0],
          [0.03, 0],
          [0.03, 0.0005],
          [0, 0.0005],
        ]);
        p.lathe("handle", -gx, lidTop - 0.002, cz, [
          [0, 0],
          [0.02, 0],
          [0.02, 0.003],
          [0.012, 0.006],
          [0.012, 0.008],
          [0, 0.008],
        ]);
      }
    },
  };
}

export const tiltingPan = makeTiltingPan("tiltingPan", false);
export const pressurePan = makeTiltingPan("pressurePan", true);
