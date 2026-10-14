// Griddle (Grillplatte): a heated plate with splash guards at the back and the sides and a grease
// gutter at the front draining into a drawer; doors below. The plate is smooth (`griddle`),
// ribbed in its right half (`griddleRibbed`) or chromed (`griddleChrome`).

import { CONTROLS, GAP, HANDLE, SHEET, type MaterialId } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { columns, lineFront, lineModule } from "./common";

/** Height of the splash guards over the plate (m). */
const GUARD = 0.08;
/** Thickness of the plate (m). */
const PLATE = 0.03;
/** Pitch of the ribs of a ribbed plate (m). */
const RIB_PITCH = 0.03;

type Surface = "smooth" | "ribbed" | "chrome";

function makeGriddle(kind: string, surface: Surface): KindDef {
  const mat: MaterialId = surface === "chrome" ? "handle" : "plate";
  return {
    kind,
    plan(s) {
      const y0 = s.B + INSET;
      const y1 = s.F - CONTROL_STRIP;
      s.rect("detail", s.L + INSET, y0, s.R - INSET, y1);
      if (surface === "ribbed") {
        // Ribs in the right half.
        const n = Math.max(2, Math.floor((s.R - INSET) / (RIB_PITCH * 1000 * 2)));
        const step = (s.R - INSET) / n;
        for (let i = 1; i < n; i++) s.line("detail", [i * step, y0], [i * step, y1]);
        s.line("detail", [0, y0], [0, y1]);
      }
      // The grease gutter at the front of the plate.
      s.line("detail", [s.L + INSET, y1 - INSET / 2], [s.R - INSET, y1 - INSET / 2]);
      controlStrip(s);
    },
    elevation(f) {
      lineFront(f, columns(f.w), "doors");
    },
    mesh(p, s) {
      const plateTop = s.h - GUARD;
      lineModule(p, s, { base: "doors", knobs: columns(s.w, 0.4), underTop: plateTop - PLATE });
      p.box(mat, -s.w / 2, s.w / 2, plateTop - PLATE, plateTop, -s.d / 2, s.d / 2);
      if (surface === "ribbed") {
        const x0 = 0.01;
        const x1 = s.w / 2 - 0.04;
        const n = Math.max(2, Math.floor((x1 - x0) / RIB_PITCH));
        for (let i = 0; i < n; i++) {
          const x = x0 + ((x1 - x0) / n) * (i + 0.5);
          p.box("plate", x - 0.005, x + 0.005, plateTop, plateTop + 0.006, -s.d / 2 + SHEET, s.d / 2 - CONTROLS - 0.03);
        }
      }
      // Splash guards at the back and the sides.
      p.box("steel", -s.w / 2, s.w / 2, plateTop, s.h, -s.d / 2, -s.d / 2 + SHEET);
      p.box("steel", -s.w / 2, -s.w / 2 + SHEET, plateTop, s.h, -s.d / 2, 0);
      p.box("steel", s.w / 2 - SHEET, s.w / 2, plateTop, s.h, -s.d / 2, 0);
      // Grease gutter at the front of the plate with its outlet at the right.
      const gz0 = s.d / 2 - CONTROLS - 0.03;
      p.box("steelDark", -s.w / 2 + 0.05, s.w / 2 - 0.05, plateTop - 0.01, plateTop + 0.002, gz0, gz0 + 0.03);
      p.cyl("knob", s.w / 2 - 0.08, gz0 + 0.015, plateTop - 0.012, plateTop + 0.003, 0.01);
      // The grease drawer under the outlet, in the control strip at the right.
      const yc = plateTop - PLATE - CONTROLS;
      const dx1 = s.w / 2 - GAP * 2;
      const dx0 = dx1 - Math.min(0.12, s.w * 0.25);
      p.box("steel", dx0, dx1, yc + 0.02, plateTop - PLATE - 0.02, s.d / 2 - 0.012, s.d / 2 - HANDLE / 2);
      p.box("handle", (dx0 + dx1) / 2 - 0.02, (dx0 + dx1) / 2 + 0.02, yc + 0.03, yc + 0.04, s.d / 2 - HANDLE / 2, s.d / 2);
    },
  };
}

export const griddle = makeGriddle("griddle", "smooth");
export const griddleRibbed = makeGriddle("griddleRibbed", "ribbed");
export const griddleChrome = makeGriddle("griddleChrome", "chrome");
