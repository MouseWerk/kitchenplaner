// Fixed bratt pan (Bratpfanne, fest): a deep rectangular pan let into the top of a cooking line
// module, its lid closed and hinged at the back; the drain valve's lever under the control strip,
// doors below. The teppanyaki plate (Teppanyaki-Platte) is the line's other wide frying surface: a
// thick polished plate over the whole top, only a low edge at the back, a rail along the front.

import { BODY_RADIUS, CONTROLS, SHEET, TOP_RADIUS } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { columns, lineFront, lineModule } from "./common";
import { gripZ, hinges } from "./details";
import { housing } from "../parts/details";

/** Thickness of the top, the depth of the pan under it and the lid over it (m). */
const TOP_SHEET = 0.03;
const PAN = 0.2;
const LID = 0.03;

export const brattPan: KindDef = {
  kind: "brattPan",
  plan(s) {
    const y1 = s.F - CONTROL_STRIP;
    s.rect("detail", s.L + INSET, s.B + INSET, s.R - INSET, y1);
    s.rect("detail", s.L + INSET * 1.5, s.B + INSET * 1.5, s.R - INSET * 1.5, y1 - INSET / 2);
    // The lid's handle at the front.
    s.line("detail", [-s.w * 0.25, y1 - INSET / 4], [s.w * 0.25, y1 - INSET / 4]);
    controlStrip(s);
  },
  elevation(f) {
    lineFront(f, columns(f.w) + 1, "doors");
    f.line("detail", [f.l, f.top - LID * 1000], [f.r, f.top - LID * 1000]);
  },
  mesh(p, s) {
    const topY = s.h - LID;
    const m = 0.04;
    const hole = { x0: -s.w / 2 + m, x1: s.w / 2 - m, z0: -s.d / 2 + m, z1: s.d / 2 - CONTROLS - 0.02 };
    const yc = lineModule(p, s, { base: "doors", knobs: columns(s.w, 0.4) + 1, underTop: topY - TOP_SHEET, solidTo: topY - PAN - 0.01 });
    p.topWithHoles("steel", s.w, s.d, topY - TOP_SHEET, topY, [hole]);
    p.tub("steel", hole.x0, hole.x1, topY - PAN, topY, hole.z0, hole.z1);
    p.roundedBox("steelDark", hole.x0 + SHEET, hole.x1 - SHEET, topY - PAN - 0.03, topY - PAN + 0.002, hole.z0 + SHEET, hole.z1 - SHEET, BODY_RADIUS);
    // The lid over the opening, hinged at the back, its grip at the front.
    housing(p, "steel", hole.x0 - 0.01, hole.x1 + 0.01, topY - 0.002, s.h, hole.z0 - 0.01, hole.z1 + 0.01, 0.006);
    hinges(p, hole.x0 + 0.05, hole.x1 - 0.05, topY + 0.004, hole.z0 - 0.018, 2, 0.008, 0.06);
    const cx = (hole.x0 + hole.x1) / 2;
    p.tube("handle", [
      { x: cx - 0.12, y: s.h - 0.012, z: hole.z1 - 0.01 },
      { x: cx - 0.12, y: s.h - 0.012, z: hole.z1 + 0.035 },
      { x: cx + 0.12, y: s.h - 0.012, z: hole.z1 + 0.035 },
      { x: cx + 0.12, y: s.h - 0.012, z: hole.z1 - 0.01 },
    ], 0.008, { bend: 0.02 });
    // The drain valve's lever under the control strip, at the right.
    gripZ(p, s.w / 2 - 0.08, yc - 0.06, s.d / 2 - 0.04, s.d / 2, 0.012);
  },
};

/** Height of the teppanyaki plate's low edge at the back over the plate (m), and its thickness. */
const TEPPAN_EDGE = 0.03;
const TEPPAN_PLATE = 0.025;
/** Depth of the front frame with the rail in front of the plate (m). */
const TEPPAN_FRONT = 0.035;

export const teppanyaki: KindDef = {
  kind: "teppanyaki",
  plan(s) {
    const y1 = s.F - CONTROL_STRIP;
    s.rect("detail", s.L + INSET / 2, s.B + INSET, s.R - INSET / 2, y1);
    s.line("detail", [s.L + INSET, y1 - INSET / 2], [s.R - INSET, y1 - INSET / 2]);
    controlStrip(s);
  },
  elevation(f) {
    lineFront(f, columns(f.w), "doors");
  },
  mesh(p, s) {
    const plateTop = s.h - TEPPAN_EDGE;
    const yc = lineModule(p, s, { base: "doors", knobs: columns(s.w, 0.4), underTop: plateTop - TEPPAN_PLATE });
    // The plate over the top, polished; a low edge at the back and the sides' back half.
    const zPlate = s.d / 2 - TEPPAN_FRONT;
    p.roundedBox("chrome", -s.w / 2, s.w / 2, plateTop - TEPPAN_PLATE, plateTop, -s.d / 2, zPlate, TOP_RADIUS);
    p.roundedBox("steel", -s.w / 2, s.w / 2, plateTop - TOP_RADIUS, s.h, -s.d / 2, -s.d / 2 + 0.008, TOP_RADIUS, "top");
    // The grease gutter at the front of the plate.
    p.roundedBox("slot", -s.w / 2 + 0.04, s.w / 2 - 0.04, plateTop - 0.002, plateTop + 0.0008, s.d / 2 - CONTROLS - 0.03, s.d / 2 - CONTROLS - 0.01, 0.01, "vertical");
    // The front frame in front of the plate, a little lower, and the rail along it on stand-offs:
    // it stands in front of everything at the height of the plate, so it shows from every side.
    p.roundedBox("steel", -s.w / 2, s.w / 2, yc + CONTROLS, plateTop - 0.006, zPlate, s.d / 2 - 0.02, TOP_RADIUS, "top");
    const ry = plateTop - 0.018;
    p.tube("handle", [
      { x: -s.w / 2 + 0.04, y: ry, z: s.d / 2 - 0.024 },
      { x: -s.w / 2 + 0.04, y: ry, z: s.d / 2 - 0.01 },
      { x: s.w / 2 - 0.04, y: ry, z: s.d / 2 - 0.01 },
      { x: s.w / 2 - 0.04, y: ry, z: s.d / 2 - 0.024 },
    ], 0.01, { bend: 0.012 });
  },
};
