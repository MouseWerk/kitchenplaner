// Elements of the cooking line without cooking zones, in its depths and module widths: a
// neutral element (work top with a drawer over an open base), a base cabinet with doors and a
// heated cabinet (Wärmeschrank) with a thermostat.

import { CONTROLS, DOOR, TOP_RADIUS, worktop } from "../parts/mesh";
import { controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { lineFront, lineModule, type LineBase, type LineStrip } from "./common";
import { pilot } from "./details";

/** Thickness of the work top, and how far its raised edge at the back stands over it (m). */
const WORKTOP = 0.04;
const UPSTAND = 0.01;

function makeElement(kind: string, base: LineBase, strip: LineStrip, knobs: number): KindDef {
  return {
    kind,
    plan(s) {
      // The work top, its raised edge at the back.
      s.line("detail", [s.L, s.B + INSET], [s.R, s.B + INSET]);
      if (strip !== "none") controlStrip(s);
    },
    elevation(f) {
      lineFront(f, knobs, base, strip);
    },
    mesh(p, s) {
      lineModule(p, s, { base, knobs, underTop: s.h - WORKTOP, strip });
      // The work top, pressed with a rounded front edge, and the raised edge at the back.
      worktop(p, "steel", -s.w / 2, s.w / 2, s.h - WORKTOP, s.h - UPSTAND, -s.d / 2, s.d / 2);
      p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - UPSTAND - TOP_RADIUS, s.h, -s.d / 2, -s.d / 2 + INSET / 1000, TOP_RADIUS, "top");
      if (knobs > 0) pilot(p, s.w / 2 - 0.06, s.h - WORKTOP - CONTROLS / 2, s.d / 2 - DOOR + 0.002);
    },
  };
}

export const lineNeutral = makeElement("lineNeutral", "open", "drawer", 0);
export const lineCabinet = makeElement("lineCabinet", "doors", "none", 0);
export const lineHeatedCabinet = makeElement("lineHeatedCabinet", "heated", "knobs", 1);
