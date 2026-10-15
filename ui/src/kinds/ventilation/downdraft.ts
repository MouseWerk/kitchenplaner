// Downdraft extraction module (Tischlüftung): a module of a cooking island that draws the vapour
// down through a grille in its top, so the island needs no hood above it. The grille lies across
// the top over a grease filter, the fan sits in the base behind a door with the outlet louvre at
// the bottom, the speed control on the front.

import { doorCount, FEET, INSET as FRONT_INSET, PANEL, TOP as FRONT_TOP } from "../parts/elevation";
import { BODY_RADIUS, CONTROLS, DOOR, DOOR_RADIUS, GAP, PLINTH, plinth, TOP } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { latch, slotRows } from "./common";

/** The grille: margin from the sides and the back, depth (mm). */
const GRILLE_MARGIN = 60;
const GRILLE_DEPTH = 320;
/** Bars of the grille (pitch, m) and the depth of the well under it (m). */
const BAR_PITCH = 0.022;
const WELL = 0.12;

/** The grille in the item frame (mm): across the width, behind the control strip. */
function grille(width: number, depth: number) {
  const y1 = depth / 2 - CONTROL_STRIP - INSET;
  return { x0: -width / 2 + GRILLE_MARGIN, x1: width / 2 - GRILLE_MARGIN, y0: Math.max(-depth / 2 + GRILLE_MARGIN, y1 - GRILLE_DEPTH), y1 };
}

export const downdraft: KindDef = {
  kind: "downdraft",
  plan(s) {
    const g = grille(s.w, s.d);
    s.rect("detail", g.x0, g.y0, g.x1, g.y1);
    for (let x = g.x0 + 40; x < g.x1 - 20; x += 40) s.line("detail", [x, g.y0 + 15], [x, g.y1 - 15]);
    controlStrip(s);
  },
  elevation(f) {
    f.worktop();
    f.panel(f.top - FRONT_TOP - PANEL, f.top - FRONT_TOP, 1);
    f.doors(doorCount(f.w), f.z0 + FEET, f.top - FRONT_TOP - PANEL - FRONT_INSET);
    for (let i = 1; i <= 3; i++) f.line("detail", [f.l + FRONT_INSET * 2, f.z0 + FEET + FRONT_INSET * i], [f.r - FRONT_INSET * 2, f.z0 + FEET + FRONT_INSET * i]);
  },
  mesh(p, s, item) {
    const { w, d, h } = s;
    const zBody = d / 2 - DOOR;
    plinth(p, w, d);
    const g = grille(item.width, item.depth);
    const gx0 = g.x0 / 1000;
    const gx1 = g.x1 / 1000;
    const gz0 = g.y0 / 1000;
    const gz1 = g.y1 / 1000;
    // The body, open under the grille, and the top with the grille's opening.
    p.roundedBox("steel", -w / 2, w / 2, PLINTH, h - TOP - WELL, -d / 2, zBody, BODY_RADIUS, "vertical");
    p.box("steel", -w / 2, -w / 2 + 0.01, h - TOP - WELL - 0.001, h - TOP, -d / 2, zBody);
    p.box("steel", w / 2 - 0.01, w / 2, h - TOP - WELL - 0.001, h - TOP, -d / 2, zBody);
    p.box("steel", -w / 2 + 0.01, w / 2 - 0.01, h - TOP - WELL - 0.001, h - TOP, zBody - 0.01, zBody);
    p.box("steel", -w / 2 + 0.01, w / 2 - 0.01, h - TOP - WELL - 0.001, h - TOP, -d / 2, -d / 2 + 0.01);
    p.topWithHoles("steel", w, d, h - TOP, h, [{ x0: gx0, x1: gx1, z0: gz0, z1: gz1, r: 0.01 }]);
    // Under the grille: the well with the grease filter's baffles at its floor.
    p.tub("steelDark", gx0, gx1, h - WELL, h - 0.001, gz0, gz1, 0.004, 0.01);
    for (let x = gx0 + 0.03; x < gx1 - 0.02; x += 0.04) p.roundedBox("satin", x - 0.012, x + 0.012, h - WELL + 0.004, h - WELL + 0.012, gz0 + 0.02, gz1 - 0.02, 0.004, "all", "z");
    // The grille: flat bars along the depth in a frame, flush with the top.
    p.lathe(
      "satin",
      (gx0 + gx1) / 2,
      h - 0.006,
      (gz0 + gz1) / 2,
      [
        [0, 0],
        [0.008, 0],
        [0.008, 0.006],
        [0, 0.006],
        [0, 0],
      ],
      { rect: [(gx1 - gx0) / 2 - 0.008, (gz1 - gz0) / 2 - 0.008] },
    );
    for (let x = gx0 + 0.008 + BAR_PITCH; x < gx1 - 0.008 - 0.004; x += BAR_PITCH) {
      p.roundedBox("satin", x - 0.003, x + 0.003, h - 0.03, h - 0.0005, gz0 + 0.008, gz1 - 0.008, 0.002, "top");
    }
    // The control strip: a speed knob and its pilot lamp; the fan door below with its latch and
    // the outlet louvre at the bottom.
    const yc = h - TOP - CONTROLS;
    p.roundedBox("panelDark", -w / 2 + GAP, w / 2 - GAP, yc + GAP, h - TOP - GAP, zBody, zBody + 0.004, BODY_RADIUS * 2, "top", "z");
    p.knob(0, (yc + h - TOP) / 2, zBody + 0.004, d / 2);
    p.lathe("oil", w / 2 - 0.06, (yc + h - TOP) / 2, zBody + 0.004, [[0, 0], [0.006, 0], [0.004, 0.004], [0, 0.005]], { axis: "z" });
    const zFace = d / 2 - DOOR / 2;
    p.box("top", -w / 2 + 0.002, w / 2 - 0.002, PLINTH + 0.002, yc, zBody, zBody + 0.002);
    p.roundedBox("steel", -w / 2 + GAP, w / 2 - GAP, PLINTH + GAP, yc - GAP, zBody + 0.002, zFace, DOOR_RADIUS, "top", "z");
    latch(p, w / 2 - 0.05, yc - 0.08, zFace, d / 2 - zFace);
    slotRows(p, -w / 2 + 0.06, w / 2 - 0.06, PLINTH + 0.04, PLINTH + 0.16, zFace, 4);
  },
};
