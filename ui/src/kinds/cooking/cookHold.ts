// Mobile cabinets on castors: the cook and hold oven (Garen-und-Warmhalten-Ofen: two cavities
// stacked, each with its solid door and a control strip with a display over it), the holding
// cabinet (Warmhalteschrank: one tall door) and the smoking cabinet (Räucherschrank: a door with a
// small window, the smoke generator's drawer under it and a chimney on the top). A rubber bumper
// runs round the bottom, push handles stand on the sides.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, castor, DOOR, GAP } from "../parts/mesh";
import { frontDoorSwing, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { buttons, doorWindow, gripX, pilot, topSlots } from "./details";
import { controlPanel, display, housing, ratingPlate } from "../parts/details";

/** Height of the castors with their plates, and their radius (m). */
const CASTORS = 0.15;
const WHEEL = 0.05;
/** Height of a control strip over a door (m). */
const STRIP = 0.1;
/** Height of the smoke generator's drawer under the smoker's door (m). */
const SMOKE_DRAWER = 0.18;
/** Height of the smoker's chimney over its top (m). */
const CHIMNEY = 0.08;

type Look = "cookHold" | "holding" | "smoker";

function makeCabinet(kind: string, look: Look, cavities: number): KindDef {
  return {
    kind,
    plan(s) {
      s.rect("detail", s.L + INSET / 2, s.F - INSET, s.R - INSET / 2, s.F);
      frontDoorSwing(s);
      if (look === "smoker") s.circle("detail", s.R - 120, s.B + 120, 50);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const I = FRONT_INSET;
      const y0 = z0 + CASTORS * 1000;
      const yTop = look === "smoker" ? top - CHIMNEY * 1000 : top;
      const base = look === "smoker" ? y0 + SMOKE_DRAWER * 1000 : y0;
      const ch = (yTop - base) / cavities;
      // The castors and the bumper.
      f.circle("detail", l + 80, z0 + WHEEL * 1000, WHEEL * 1000);
      f.circle("detail", r - 80, z0 + WHEEL * 1000, WHEEL * 1000);
      f.line("detail", [l, y0 + 30], [r, y0 + 30]);
      for (let i = 0; i < cavities; i++) {
        const b = base + ch * i;
        const t = b + ch;
        f.box("detail", l + I / 2, r - I / 2, t - STRIP * 1000, t - I / 2, "item-dark");
        f.box("detail", l + I / 2, r - I / 2, b + I, t - STRIP * 1000 - I / 2);
        f.line("detail", [r - I * 2, (b + t) / 2 - 150], [r - I * 2, (b + t) / 2 + 150]);
        if (look === "smoker") f.box("detail", (l + r) / 2 - 100, (l + r) / 2 + 100, (b + t) / 2, (b + t) / 2 + 250, "glass");
      }
      if (look === "smoker") {
        f.box("detail", l + I, r - I, y0 + I, base - I / 2);
        f.box("hidden", r - 170, r - 70, yTop, top);
      }
    },
    mesh(p, s) {
      const zf = s.d / 2;
      const r = WHEEL;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) castor(p, sx * (s.w / 2 - r - 0.02), sz * (s.d / 2 - r - 0.03), r, CASTORS - 0.02);
      const y0 = CASTORS;
      const yTop = look === "smoker" ? s.h - CHIMNEY : s.h;
      // The body on its base frame, a rubber bumper round the bottom.
      p.roundedBox("steelDark", -s.w / 2 + 0.02, s.w / 2 - 0.02, CASTORS - 0.02, y0 + 0.01, -s.d / 2 + 0.02, zf - 0.03, BODY_RADIUS);
      housing(p, "steel", -s.w / 2 + 0.012, s.w / 2 - 0.012, y0, yTop, -s.d / 2 + 0.012, zf - DOOR, 0.01);
      p.lathe("rubber", 0, y0 + 0.01, -0.006, [
        [0, 0],
        [0.03, 0],
        [0.03, 0.04],
        [0, 0.04],
      ], { rect: [s.w / 2 - 0.03, s.d / 2 - 0.036], caps: false });
      const base = look === "smoker" ? y0 + SMOKE_DRAWER : y0 + 0.05;
      const ch = (yTop - base) / cavities;
      const zFace = zf - DOOR / 2;
      for (let i = 0; i < cavities; i++) {
        const b = base + ch * i;
        const t = b + ch;
        const d1 = t - STRIP - GAP;
        // The door with its gasket round it and a latch handle at its free edge.
        p.plate("rubber", -s.w / 2 + 0.02, s.w / 2 - 0.02, b + GAP, d1, zf - DOOR, zf - DOOR + 0.002, 0.008);
        p.roundedBox("steel", -s.w / 2 + 0.024, s.w / 2 - 0.024, b + GAP * 2, d1 - GAP, zf - DOOR, zFace, 0.006, "top", "z");
        const len = Math.min(0.3, (d1 - b) * 0.4);
        p.barHandle("y", (b + d1) / 2 - len / 2, (b + d1) / 2 + len / 2, s.w / 2 - 0.07, zFace, zf);
        if (look === "smoker") doorWindow(p, -0.1, 0.1, (b + d1) / 2, Math.min((b + d1) / 2 + 0.25, d1 - 0.08), zFace);
        // The control strip over the door: a display, buttons and a pilot light.
        controlPanel(p, -s.w / 2 + 0.024, s.w / 2 - 0.024, d1 + GAP, t - GAP * 2, zf - DOOR, zFace);
        const sy = (d1 + t) / 2;
        display(p, -s.w / 2 + 0.13, sy, 0.13, 0.04, zFace);
        buttons(p, -0.02, s.w / 2 - 0.1, sy, zFace, 4, 0.016);
        pilot(p, s.w / 2 - 0.06, sy, zFace);
      }
      if (look === "smoker") {
        // The smoke generator's drawer with its grip, and the chimney with its damper on the top.
        p.roundedBox("steel", -s.w / 2 + 0.024, s.w / 2 - 0.024, y0 + 0.05, base - GAP, zf - DOOR, zFace, 0.006, "top", "z");
        gripX(p, -0.08, 0.08, (y0 + 0.05 + base) / 2, zFace + 0.004, 0.006);
        const cx = s.w / 2 - 0.12;
        const cz = -s.d / 2 + 0.12;
        p.lathe("satin", cx, yTop - 0.004, cz, [
          [0, 0],
          [0.07, 0],
          [0.07, 0.01],
          [0.05, 0.02],
          [0.05, CHIMNEY - 0.012],
          [0.055, CHIMNEY - 0.006],
          [0.055, CHIMNEY + 0.004],
          [0, CHIMNEY + 0.004],
        ]);
        p.box("knob", cx - 0.004, cx + 0.004, yTop + 0.03, yTop + 0.04, cz + 0.05, cz + 0.08);
      } else {
        topSlots(p, -s.w / 2 + 0.08, s.w / 2 - 0.08, -s.d / 2 + 0.08, -s.d / 2 + 0.18, yTop - 0.001, 10);
      }
      // Push handles on both sides at the back.
      for (const sx of [-1, 1]) {
        const x = sx * (s.w / 2 - 0.012);
        const xo = sx * (s.w / 2 - 0.006);
        p.tube("handle", [
          { x, y: yTop - 0.45, z: -s.d / 2 + 0.1 },
          { x: xo, y: yTop - 0.45, z: -s.d / 2 + 0.1 },
          { x: xo, y: yTop - 0.15, z: -s.d / 2 + 0.1 },
          { x, y: yTop - 0.15, z: -s.d / 2 + 0.1 },
        ], 0.006, { bend: 0.006 });
      }
      ratingPlate(p, -s.w / 2 + 0.08, y0 + 0.075, zFace, 0.08, 0.03);
    },
  };
}

export const cookHold1 = makeCabinet("cookHold1", "holding", 1);
export const cookHold2 = makeCabinet("cookHold2", "cookHold", 2);
export const smoker = makeCabinet("smoker", "smoker", 1);
