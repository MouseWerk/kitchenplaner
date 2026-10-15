// Pizza ovens beyond the deck oven: the conveyor oven (Durchlauf-Pizzaofen: a wire belt running
// through a hot-air tunnel and out at both ends, the controls on the tunnel's front, on its own
// stand), the stone dome oven (Steinofen, Kuppel: a tiled dome on a masonry base with an arched
// mouth, a landing in front of it and the chimney over the mouth) and the oven with a rotating
// deck (Drehteller: a round steel housing over a turning stone, the mouth in a steel frame).
//
// The dome and the rotating oven draw their own chimney for both energies (`flue: false`): gas
// heats with a burner whose control box sits beside the mouth, electric with elements under a
// control panel with a display.

import { INSET as FRONT_INSET, LEG as FRONT_LEG, UNDERSHELF as FRONT_UNDERSHELF } from "../parts/elevation";
import { BODY_RADIUS, LEG, LEG_RADIUS, SHEET, TOP_RADIUS, UNDERSHELF, type Parts, type Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import { MM_PER_UNIT } from "../../three/shared";
import type { KindDef } from "../types";
import { buttons, doorWindow, frontSlots, pilot, topSlots } from "./details";
import { controlPanel, display, housing, ratingPlate } from "../parts/details";

// ---------------------------------------------------------------------------------------------
// Conveyor oven

/** How far the belt runs out of the tunnel at each end (m), at most a share of the width. */
const BELT_OUT = 0.3;
const BELT_OUT_SHARE = 0.2;
/** Height of the belt over the tunnel's bottom, and the tunnel opening's height (m). */
const BELT_Y = 0.1;
const OPENING = 0.09;

function beltOut(w: number): number {
  return Math.min(BELT_OUT, w * BELT_OUT_SHARE);
}

export const conveyorOven: KindDef = {
  kind: "conveyorOven",
  plan(s) {
    const o = beltOut(s.w / 1000) * 1000;
    s.rect("detail", s.L + o, s.B + INSET, s.R - o, s.F - INSET);
    // The belt from end to end.
    s.rect("detail", s.L, -s.d * 0.3, s.R, s.d * 0.3);
  },
  elevationBase(f) {
    const o = beltOut(f.w / 1000) * 1000;
    const { z0 } = f;
    if (z0 <= 0) return;
    f.box("item", f.l + o, f.l + o + FRONT_LEG, 0, z0, "item");
    f.box("item", f.r - o - FRONT_LEG, f.r - o, 0, z0, "item");
    f.line("detail", [f.l + o + FRONT_LEG, FRONT_UNDERSHELF], [f.r - o - FRONT_LEG, FRONT_UNDERSHELF]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const o = beltOut(f.w / 1000) * 1000;
    const by = z0 + BELT_Y * 1000;
    f.box("detail", l, l + o, by - 10, by + 10);
    f.box("detail", r - o, r, by - 10, by + 10);
    f.box("detail", l + o + FRONT_INSET, r - o - FRONT_INSET, by + 30, top - FRONT_INSET * 2);
    f.box("detail", r - o - 220, r - o - FRONT_INSET, by + 50, top - FRONT_INSET * 2.5, "item-dark");
  },
  mesh(p, s, item) {
    const elev = item.elevation / MM_PER_UNIT;
    const o = beltOut(s.w);
    const tw = s.w - o * 2;
    standUnder(p, { w: tw, d: s.d, h: s.h }, elev);
    const zf = s.d / 2;
    const by = BELT_Y;
    // The tunnel housing: the bottom under the belt, the top over the opening, closed sides
    // with the openings where the belt runs through.
    housing(p, "steel", -tw / 2, tw / 2, 0, by - 0.015, -s.d / 2, zf - 0.02, 0.006);
    housing(p, "steel", -tw / 2, tw / 2, by + OPENING - 0.03, s.h, -s.d / 2, zf - 0.02);
    const bz = s.d * 0.3;
    for (const sx of [-1, 1]) {
      const x = sx * (tw / 2 - 0.01);
      p.roundedBox("steel", x - 0.01, x + 0.01, by - 0.016, by + OPENING - 0.029, -s.d / 2, -bz - 0.01, BODY_RADIUS, "vertical");
      p.roundedBox("steel", x - 0.01, x + 0.01, by - 0.016, by + OPENING - 0.029, bz + 0.01, zf - 0.02, BODY_RADIUS, "vertical");
      p.box("top", x - 0.009, x + 0.009, by - 0.01, by + OPENING - 0.035, -bz - 0.01, bz + 0.01);
    }
    // The wire belt on its frame, out at both ends, with the drive at the left.
    p.grid(-s.w / 2, s.w / 2, by - 0.006, by, -bz, bz, 0.015, "x");
    for (const sx of [-1, 1]) {
      const xe = sx * s.w / 2;
      const xi = sx * (tw / 2);
      for (const sz of [-1, 1]) p.roundedBox("steel", Math.min(xe, xi), Math.max(xe, xi), by - 0.03, by - 0.006, sz * (bz + 0.01) - 0.01, sz * (bz + 0.01) + 0.01, BODY_RADIUS);
      p.roundedBox("satin", Math.min(xe, xe - sx * 0.12), Math.max(xe, xe - sx * 0.12), by - 0.03, by - 0.008, -bz + 0.02, bz - 0.02, 0.004);
    }
    p.roundedBox("paintGray", -s.w / 2, -s.w / 2 + 0.1, by - 0.12, by - 0.03, bz - 0.04, bz + 0.03, 0.006);
    // A small viewing window on the tunnel's front, the control panel at the right.
    const zFace = zf - 0.017;
    const pw = Math.min(0.22, tw * 0.3);
    doorWindow(p, -tw / 2 + 0.08, tw / 2 - pw - 0.08, by + OPENING, s.h - 0.06, zf - 0.02);
    p.barHandle("x", -tw / 4, tw / 4 - pw / 2, s.h - 0.035, zf - 0.02, zf);
    controlPanel(p, tw / 2 - pw, tw / 2 - 0.02, by + OPENING - 0.01, s.h - 0.02, zf - 0.02, zFace);
    display(p, tw / 2 - pw / 2 - 0.01, s.h - 0.07, pw - 0.06, 0.04, zFace);
    buttons(p, tw / 2 - pw + 0.02, tw / 2 - 0.04, s.h - 0.13, zFace, 4, 0.016);
    pilot(p, tw / 2 - pw / 2 - 0.01, by + OPENING + 0.03, zFace);
    topSlots(p, -tw / 2 + 0.1, tw / 2 - 0.1, -s.d / 2 + 0.06, -s.d / 2 + 0.16, s.h - 0.001, Math.max(8, Math.round(tw / 0.05)));
    if (item.energy === "gas") {
      // The gas burner's box on the back wall.
      p.roundedBox("paintGray", tw / 2 - 0.35, tw / 2 - 0.05, 0.02, s.h - 0.05, -s.d / 2, -s.d / 2 + 0.02, BODY_RADIUS);
    }
  },
};

/** A stand of four legs under a unit `s.w` wide at its middle, from the floor up to it (m). */
function standUnder(p: Parts, s: Size, elev: number) {
  if (elev <= 0) return;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (s.w / 2 - LEG / 2);
      const z = sz * (s.d / 2 - LEG / 2);
      p.roundedBox("steelDark", x - LEG / 2, x + LEG / 2, -elev, 0, z - LEG / 2, z + LEG / 2, LEG_RADIUS, "vertical");
    }
  }
  p.roundedBox("steel", -s.w / 2 + LEG, s.w / 2 - LEG, -elev + UNDERSHELF, -elev + UNDERSHELF + SHEET, -s.d / 2 + LEG / 2, s.d / 2 - LEG / 2, TOP_RADIUS);
}

// ---------------------------------------------------------------------------------------------
// Dome and rotating ovens

/** Height of the base under the oven floor (m), and of the chimney over the dome. */
const OVEN_FLOOR = 1.05;
/** Width and height of the mouth (m). */
const MOUTH_W = 0.5;
const MOUTH_H = 0.24;
/** Radius of the chimney (m). */
const CHIMNEY_R = 0.09;

type DomeLook = "dome" | "rotating";

/** Where the parts of a round oven go, from its size (m). */
function domeLayout(s: Size) {
  const r = Math.min(s.w, s.d) / 2 - 0.02;
  const floor = Math.min(OVEN_FLOOR, s.h * 0.55);
  const cz = -s.d / 2 + 0.02 + r;
  const domeH = Math.min(r * 0.75, s.h - floor - 0.25);
  return { r, floor, cz, domeH };
}

function makeDome(kind: string, look: DomeLook): KindDef {
  return {
    kind,
    flue: false,
    plan(s) {
      const m = domeLayout({ w: s.w / 1000, d: s.d / 1000, h: s.item.height / 1000 });
      s.circle("detail", 0, m.cz * 1000, m.r * 1000);
      s.circle("detail", 0, m.cz * 1000, m.r * 820);
      if (look === "rotating") s.circle("detail", 0, m.cz * 1000, m.r * 600);
      // The mouth and the chimney at the front of the dome.
      s.rect("detail", -MOUTH_W * 500, (m.cz + m.r * 0.6) * 1000, MOUTH_W * 500, s.F);
      s.circle("detail", 0, (m.cz + m.r * 0.72) * 1000, CHIMNEY_R * 1000);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const m = domeLayout({ w: f.w / 1000, d: f.item.depth / 1000, h: f.item.height / 1000 });
      const c = (l + r) / 2;
      const fl = z0 + m.floor * 1000;
      f.box("detail", c - m.r * 1000, c + m.r * 1000, z0, fl);
      f.line("detail", [c - m.r * 1000, fl], [c - m.r * 700, fl + m.domeH * 700], [c, fl + m.domeH * 1000], [c + m.r * 700, fl + m.domeH * 700], [c + m.r * 1000, fl]);
      f.box("detail", c - MOUTH_W * 500, c + MOUTH_W * 500, fl, fl + MOUTH_H * 1000, "item-dark");
      f.box("detail", c - CHIMNEY_R * 1000, c + CHIMNEY_R * 1000, fl + MOUTH_H * 1000 + 60, top);
      f.box("detail", c + MOUTH_W * 500 + 60, c + MOUTH_W * 500 + 260, fl - 300, fl - 60, "item-dark");
      // The firewood niche in the dome oven's base.
      if (look === "dome") f.box("detail", c - f.w * 0.3, c + f.w * 0.12, z0 + 120, fl - 250, "item-dark");
    },
    mesh(p, s, item) {
      const m = domeLayout(s);
      const { r, floor, cz, domeH } = m;
      const zf = s.d / 2;
      const gas = item.energy === "gas";
      // The base: tiled masonry for the dome oven, a steel cabinet on feet for the rotating one.
      if (look === "dome") {
        housing(p, "paintGray", -s.w / 2, s.w / 2, 0, floor - 0.06, -s.d / 2, zf - 0.12, 0.02);
        p.roundedBox("granite", -s.w / 2, s.w / 2, floor - 0.08, floor, -s.d / 2, zf - 0.1, 0.01);
        // The niche for the firewood under the oven floor.
        p.plate("top", -s.w * 0.3, s.w * 0.12, 0.12, floor - 0.25, zf - 0.12, zf - 0.119, 0.06);
      } else {
        housing(p, "steel", -s.w / 2, s.w / 2, 0.08, floor, -s.d / 2, zf - 0.12, 0.006);
        p.roundedBox("steelDark", -s.w / 2 + 0.05, s.w / 2 - 0.05, 0, 0.082, -s.d / 2 + 0.05, zf - 0.17, BODY_RADIUS, "vertical");
      }
      // The dome (or the round housing) over the floor.
      const domeMat = look === "dome" ? "granite" : "steel";
      const wall = look === "dome" ? domeH * 0.18 : domeH * 0.6;
      p.lathe(domeMat, 0, floor, cz, [
        [0, 0],
        [r, 0],
        [r, wall],
        [r * 0.96, wall + (domeH - wall) * 0.3],
        [r * 0.82, wall + (domeH - wall) * 0.62],
        [r * 0.55, wall + (domeH - wall) * 0.88],
        [0, domeH],
      ]);
      // The mouth: a dark opening in an arch (the dome) or a steel frame (the rotating oven),
      // the landing in front of it.
      const zm = cz + r * 0.82;
      const mouthTop = floor + MOUTH_H;
      p.extrude(look === "dome" ? "concrete" : "steel", "z", zm, zf - 0.06, [
        [-MOUTH_W / 2 - 0.08, floor],
        [MOUTH_W / 2 + 0.08, floor],
        [MOUTH_W / 2 + 0.08, mouthTop + 0.02],
        [MOUTH_W / 2 * 0.7, mouthTop + 0.09],
        [0, mouthTop + 0.11],
        [-MOUTH_W / 2 * 0.7, mouthTop + 0.09],
        [-MOUTH_W / 2 - 0.08, mouthTop + 0.02],
      ], [
        [
          [-MOUTH_W / 2, floor + 0.001],
          [MOUTH_W / 2, floor + 0.001],
          [MOUTH_W / 2, mouthTop - 0.04],
          [MOUTH_W / 2 * 0.6, mouthTop],
          [-MOUTH_W / 2 * 0.6, mouthTop],
          [-MOUTH_W / 2, mouthTop - 0.04],
        ],
      ]);
      p.extrude("top", "z", cz, zm + 0.001, [
        [-MOUTH_W / 2, floor],
        [MOUTH_W / 2, floor],
        [MOUTH_W / 2, mouthTop - 0.04],
        [MOUTH_W / 2 * 0.6, mouthTop],
        [-MOUTH_W / 2 * 0.6, mouthTop],
        [-MOUTH_W / 2, mouthTop - 0.04],
      ]);
      // The oven floor seen through the mouth, a turning stone in the rotating oven.
      if (look === "rotating") {
        p.lathe("granite", 0, floor + 0.002, cz, [
          [0, 0],
          [r * 0.8, 0],
          [r * 0.8, 0.03],
          [0, 0.03],
        ]);
      }
      p.roundedBox("granite", -MOUTH_W / 2 - 0.12, MOUTH_W / 2 + 0.12, floor - 0.06, floor + 0.002, zm - 0.02, zf, 0.008);
      // The chimney over the mouth with a collar, up to the full height.
      const chz = cz + r * 0.72;
      p.lathe(look === "dome" ? "steelDark" : "steel", 0, mouthTop + 0.08, chz, [
        [0, 0],
        [CHIMNEY_R * 1.6, 0],
        [CHIMNEY_R * 1.6, 0.04],
        [CHIMNEY_R, 0.1],
        [CHIMNEY_R, s.h - mouthTop - 0.08 - 0.03],
        [CHIMNEY_R * 1.15, s.h - mouthTop - 0.08 - 0.02],
        [CHIMNEY_R * 1.15, s.h - mouthTop - 0.08],
        [0, s.h - mouthTop - 0.08],
      ]);
      // The burner's control box (gas) or the control panel (electric) beside the mouth.
      const bx = MOUTH_W / 2 + 0.16;
      const bz = zf - 0.035;
      housing(p, gas ? "paintGray" : "steel", bx, bx + 0.22, floor - 0.32, floor - 0.08, zf - 0.125, bz, 0.006);
      if (gas) {
        p.knob(bx + 0.07, floor - 0.2, bz, bz + 0.03, 0.02);
        pilot(p, bx + 0.16, floor - 0.2, bz);
        p.box("slot", bx + 0.03, bx + 0.19, floor - 0.3, floor - 0.28, bz, bz + 0.001);
      } else {
        controlPanel(p, bx, bx + 0.22, floor - 0.32, floor - 0.08, bz - 0.004, bz + 0.002);
        display(p, bx + 0.11, floor - 0.13, 0.16, 0.05, bz + 0.002);
        buttons(p, bx + 0.02, bx + 0.2, floor - 0.22, bz + 0.002, 4, 0.018);
        pilot(p, bx + 0.11, floor - 0.28, bz + 0.002);
      }
      if (look === "rotating") {
        frontSlots(p, -s.w / 2 + 0.1, -MOUTH_W / 2 - 0.15, 0.2, 0.26, zf - 0.12, 6);
        ratingPlate(p, -s.w / 2 + 0.15, floor - 0.175, zf - 0.12, 0.1, 0.05);
      }
    },
  };
}

export const domeOven = makeDome("domeOven", "dome");
export const rotatingOven = makeDome("rotatingOven", "rotating");
