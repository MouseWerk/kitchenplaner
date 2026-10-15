// Ultrasonic cleaning tank (Ultraschall-Reinigungsbecken): a cabinet with doors and a control
// strip at the front, the heated tank let into its top with a lifting basket in it, and a
// folding lid whose front half lies folded back on the rear half, so the bath shows. Used for
// grill grates, filters, GN containers and baking trays.

import { FEET, INSET as FRONT_INSET, doorCount } from "../parts/elevation";
import { BODY_RADIUS, BOWL_RADIUS, DOOR, doors, GAP, PLINTH, TOP, TOP_RADIUS, type Hole } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { bowlDrain } from "./common";
import { machineFeet, machinePanel } from "./details";

/** Margin of the tank from the edges of the top (mm), its depth (mm). */
const MARGIN = 100;
const TANK_DEPTH = 350;
/** Height of the control strip under the top (m). */
const STRIP = 0.1;
/** Thickness of one leaf of the folding lid (m). */
const LID = 0.012;

/** The tank's opening in the item frame (mm or m, `k`). */
function tankOf(w: number, d: number, k: number) {
  const m = MARGIN * k;
  return { x0: -w / 2 + m, x1: w / 2 - m, z0: -d / 2 + m * 0.8, z1: d / 2 - m * 1.2 };
}

export const ultrasonicTank: KindDef = {
  kind: "ultrasonicTank",
  plan(s) {
    const t = tankOf(s.w, s.d, 1);
    const zm = (t.z0 + t.z1) / 2;
    s.rect("detail", t.x0, t.z0, t.x1, t.z1);
    // The folded lid over the rear half, the open bath in front of it.
    s.rect("detail", t.x0 - INSET / 2, t.z0 - INSET / 2, t.x1 + INSET / 2, zm);
    s.line("detail", [s.L, s.F - INSET], [s.R, s.F - INSET]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const strip = top - TOP * 1000 - STRIP * 1000;
    f.worktop();
    f.box("detail", l + I / 2, r - I / 2, strip, top - TOP * 1000 - I / 4, "item-dark");
    f.box("detail", l + I, l + I + 140, strip + 25, top - TOP * 1000 - 25);
    f.line("detail", [l, z0 + FEET * 0.67], [r, z0 + FEET * 0.67]);
    f.doors(doorCount(f.w), z0 + FEET * 0.67 + I / 2, strip - I / 2);
    const t = tankOf(f.w, f.item.depth, 1);
    const c = (l + r) / 2;
    f.box("hidden", c + t.x0, c + t.x1, top - TANK_DEPTH, top - TOP * 1000);
  },
  mesh(p, s) {
    const zf = s.d / 2;
    const yTop = s.h - LID * 2 - 0.004;
    const t = tankOf(s.w, s.d, 1 / 1000);
    const hole: Hole = { ...t, r: BOWL_RADIUS };
    const zb = zf - DOOR;
    // The cabinet on its feet, the doors under the control strip.
    machineFeet(p, s.w, s.d, zb);
    p.roundedBox("steel", -s.w / 2, s.w / 2, PLINTH, yTop - TOP, -s.d / 2, zb, BODY_RADIUS, "vertical");
    const strip = yTop - TOP - STRIP;
    doors(p, -s.w / 2, s.w / 2, PLINTH, strip, s.d, Math.max(1, Math.round(s.w / 0.6)), "top");
    machinePanel(p, -s.w / 2 + GAP, s.w / 2 - GAP, strip + GAP, yTop - TOP - GAP, zb - 0.002, zf - DOOR / 2, 4);
    // The top with the tank, the bath in it and the basket hanging in the bath.
    p.topWithHoles("steel", s.w, s.d, yTop - TOP, yTop, [hole]);
    const depth = TANK_DEPTH / 1000;
    // A darker tank (as the fryers' and the pasta cooker's) lets the bath read as water, not as more steel.
    p.tub("steelDark", t.x0, t.x1, yTop - depth, yTop, t.z0, t.z1);
    bowlDrain(p, (t.x0 + t.x1) / 2, (t.z0 + t.z1) / 2, yTop - depth, -s.d / 2, false);
    // The bath stands well below the rim, so the tank's wall and the basket show above it.
    const water = yTop - depth * 0.55;
    p.roundedBox("water", t.x0 + 0.012, t.x1 - 0.012, yTop - depth + 0.02, water, t.z0 + 0.012, t.z1 - 0.012, BOWL_RADIUS - 0.012, "vertical");
    const bx0 = t.x0 + 0.04;
    const bx1 = t.x1 - 0.04;
    const bTop = yTop - 0.07;
    p.wireBox(bx0, bx1, yTop - depth + 0.05, bTop, t.z0 + 0.04, t.z1 - 0.04, 0.05);
    // The basket's two lifting handles, folded up at its ends.
    for (const x of [bx0 + 0.006, bx1 - 0.006]) {
      p.tube("satin", [
        { x, y: bTop - 0.01, z: t.z0 + 0.1 },
        { x, y: yTop - 0.012, z: t.z0 + 0.1 },
        { x, y: yTop - 0.012, z: t.z1 - 0.1 },
        { x, y: bTop - 0.01, z: t.z1 - 0.1 },
      ], 0.005, { bend: 0.02 });
    }
    // Hood filters standing in the basket, their baffles showing above the bath.
    const fw = Math.min(0.4, bx1 - bx0 - 0.04) / 2;
    for (const fz of [0.03, 0.1]) {
      const z = (t.z0 + t.z1) / 2 + fz;
      p.roundedBox("satin", -fw, fw, yTop - depth + 0.06, yTop - 0.03, z - 0.012, z + 0.012, 0.004);
      for (let k = 1; k <= 3; k++) {
        const y = yTop - 0.03 - k * 0.035;
        p.box("slot", -fw + 0.02, fw - 0.02, y - 0.006, y + 0.006, z + 0.012, z + 0.013);
      }
    }
    // The folding lid: the rear leaf on the tank's rear half, the front leaf folded onto it, the
    // hinge between and the grip on the front leaf.
    const zm = (t.z0 + t.z1) / 2;
    const lx0 = t.x0 - 0.02;
    const lx1 = t.x1 + 0.02;
    p.roundedBox("steel", lx0, lx1, yTop, yTop + LID, t.z0 - 0.02, zm, TOP_RADIUS);
    p.roundedBox("steel", lx0 + 0.004, lx1 - 0.004, yTop + LID + 0.002, s.h - 0.002, t.z0 - 0.01, zm - 0.004, TOP_RADIUS);
    p.rod("satin", "x", 0, yTop + LID + 0.001, zm - 0.003, lx1 - lx0 - 0.04, 0.003);
    p.roundedBox("knob", -0.08, 0.08, s.h - 0.004, s.h, t.z0 + 0.02, t.z0 + 0.05, 0.002);
  },
};
