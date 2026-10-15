// Hand wash basin with foot pedal (Standwaschbecken mit Fußbedienung): a free-standing pedestal
// on a recessed kick plate, the round basin pressed into its deck, a wall plate behind with a
// fixed spout, and the foot pedal in front of the kick plate that opens the water: the hands
// touch nothing.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, roundBowl, SHEET, TOP_RADIUS } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { bowlDrain } from "./common";
import { wallDispenser } from "./details";
import { fixedSpout } from "./handwash";

/** The deck's height above the floor and the bowl's depth (m). */
const RIM = 0.85;
const BOWL_DEPTH = 0.13;
/** The wall plate (m) and the bowl's radius as a share of the deck's smaller side. */
const PLATE = 0.02;
const BOWL_SHARE = 0.33;
/** The kick plate's set-back and height, the pedal's length from the front (m). */
const RECESS = 0.13;
const KICK = 0.1;
const PEDAL = 0.11;
/** Height of the soap dispenser's lower edge above the deck, beside the spout (m). */
const DISPENSER_AT = 0.08;
/** Distance of the spout's column from the back (m). */
const TAP_Z = 0.05;

/** Deck height, or less on a low resized unit (m). */
const rimOf = (h: number) => Math.min(RIM, h * 0.75);

export const handwashPedal: KindDef = {
  kind: "handwashPedal",
  plan(s) {
    const r = Math.min(s.w, s.d - PLATE * 1000) * BOWL_SHARE;
    const cz = (PLATE * 1000) / 2;
    s.circle("detail", 0, cz, r);
    s.circle("detail", 0, cz, INSET / 4);
    s.circle("detail", 0, s.B + TAP_Z * 1000, INSET / 3);
    s.line("detail", [s.L, s.B + PLATE * 1000], [s.R, s.B + PLATE * 1000]);
    // The pedal lies on the floor under the basin.
    s.rect("hidden", -INSET * 1.5, s.F - PEDAL * 1000, INSET * 1.5, s.F - INSET / 5);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const c = (l + r) / 2;
    const rim = z0 + rimOf(f.item.height / 1000) * 1000;
    const br = Math.min(f.w, f.item.depth) * BOWL_SHARE;
    f.line("detail", [l, rim - 60], [r, rim - 60]);
    f.box("hidden", c - br, c + br, rim - BOWL_DEPTH * 1000, rim - 60);
    f.line("detail", [l, z0 + KICK * 1000], [r, z0 + KICK * 1000]);
    f.box("detail", c - I * 1.5, c + I * 1.5, z0 + 15, z0 + 45);
    const tz = Math.min(top - I / 2, rim + 220);
    f.line("detail", [c, rim], [c, tz], [c - I * 2.5, tz], [c - I * 2.5, tz - I]);
    if (top - rim - DISPENSER_AT * 1000 > 100) f.box("detail", r - 20 - 90, r - 20, rim + DISPENSER_AT * 1000, Math.min(top - 20, rim + (DISPENSER_AT + 0.18) * 1000));
  },
  mesh(p, s) {
    const zb = -s.d / 2;
    const zf = s.d / 2;
    const rim = rimOf(s.h);
    const floor = rim - BOWL_DEPTH;
    const r = Math.min(s.w, s.d - PLATE) * BOWL_SHARE;
    const cz = PLATE / 2;
    // The pedestal on its recessed kick plate, the wall plate up to the top.
    p.roundedBox("steelDark", -s.w / 2 + 0.03, s.w / 2 - 0.03, 0, KICK, zb + PLATE, zf - RECESS, BODY_RADIUS, "vertical");
    p.roundedBox("steel", -s.w / 2, s.w / 2, KICK, floor, zb + PLATE, zf - SHEET, BODY_RADIUS, "vertical");
    for (const x of [-s.w / 2, s.w / 2 - SHEET]) p.box("steel", x, x + SHEET, floor, rim - 0.06, zb + PLATE, zf - SHEET);
    p.box("steel", -s.w / 2 + SHEET, s.w / 2 - SHEET, floor, rim - 0.06, zf - SHEET * 2, zf - SHEET);
    p.roundedBox("steel", -s.w / 2, s.w / 2, 0, s.h, zb, zb + PLATE, BODY_RADIUS, "top", "z");
    // The deck with its bowl and the front apron rounded over the top.
    roundBowl(p, "steel", s.w, zb + PLATE, zf - SHEET, cz, r, rim, floor, 0.015);
    p.roundedBox("steel", -s.w / 2, s.w / 2, rim - 0.06, rim, zf - SHEET, zf, TOP_RADIUS, "top");
    bowlDrain(p, 0, cz, floor, zb, false);
    // The foot pedal on its hinge in front of the kick plate, a rubber tread on it.
    const pz0 = zf - PEDAL;
    p.roundedBox("steelDark", -0.06, 0.06, 0.015, 0.035, pz0, zf - 0.01, 0.006, "vertical");
    p.roundedBox("rubber", -0.055, 0.055, 0.035, 0.042, pz0 + 0.01, zf - 0.015, 0.003, "vertical");
    p.lathe("satin", -0.05, 0.03, zf - RECESS + 0.005, [
      [0, 0],
      [0.012, 0],
      [0.012, 0.1],
      [0, 0.1],
    ], { axis: "x" });
    // The fixed spout over the bowl, a soap dispenser on the wall plate beside it.
    fixedSpout(p, zb + TAP_Z, rim, Math.min(0.22, s.h - rim), false);
    const d0 = rim + DISPENSER_AT;
    if (s.h - d0 > 0.1) wallDispenser(p, s.w / 2 - 0.02 - 0.09, s.w / 2 - 0.02, d0, Math.min(s.h - 0.02, d0 + 0.18), zb + PLATE, zb + PLATE + 0.08, "soap");
  },
};
