// Roll-in blast chiller (Einfahr-Schockkühler): a tall insulated cabinet that takes one or two
// GN trolleys at floor level, so it stands without feet on a flush ramp. The door (a pair for two
// trolleys) takes the front beside a control column at the right; the machine sits on top behind
// a grille. The same cabinet without the column and with a plain fascia is the roll-in
// refrigerator or freezer (Einfahrkühlschrank, Einfahrtiefkühlschrank).

import { FROST_STRIP, frostFront, frostMark, frostPlan } from "../parts/frost";
import { BODY_RADIUS, GAP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { CABINET_RADIUS, coolDoor, display, displayFront, doorFront, doorSwings, FRONT, grille, grilleFront, hingeLeft, LEAF_GAP_MM, m, pushButton, STANDOFF } from "./common";

/** Width of the control column beside the door (mm). */
const COLUMN_MM = 250;
/** Height of the machine grille on top (mm). */
const GRILLE_MM = 150;
/** Height of the controls on the column above the floor (mm). */
const CONTROLS_MM = 1450;
/** Size of a GN 1/1 trolley (mm): drawn dashed inside the cabinet in the plan. */
const TROLLEY = { w: 450, d: 650 };
/** Width from which the cabinet takes two trolleys side by side behind a pair of doors (mm). */
const TWO_FROM = 1500;
/** Height of the kick plate on the door (m), and of the frost strip of a freezer (mm). */
const KICK = 0.3;
/** Heights of the bump rails on the door and their radius (m). */
const RAILS = [0.45, 0.8];
const RAIL_R = 0.012;
const FROST_Z_MM = 1650;

const columnWidth = (width: number, column: boolean) => (column ? Math.min(COLUMN_MM, width * 0.25) : 0);
const trolleys = (width: number) => (width >= TWO_FROM ? 2 : 1);

/** A roll-in cabinet: `column` for the blast chiller's control column, `freezer` for the frost mark. */
function rollIn(kind: string, column: boolean, freezer = false): KindDef {
  return {
    kind,
    plan(s) {
      const col = columnWidth(s.w, column);
      const n = trolleys(s.w);
      doorSwings(s, n, s.L, s.R - col);
      if (column) s.line("detail", [s.R - col, s.F - INSET / 2], [s.R - col, s.F]);
      // The trolleys inside, dashed, side by side.
      const cw = (s.w - col) / n;
      const tw = Math.min(TROLLEY.w, cw - 2 * INSET);
      const td = Math.min(TROLLEY.d, s.d - 3 * INSET);
      for (let i = 0; i < n; i++) {
        const cx = s.L + cw * (i + 0.5);
        s.rect("hidden", cx - tw / 2, -td / 2, cx + tw / 2, td / 2);
      }
      if (freezer) frostPlan(s, (s.L + s.R - col) / 2, 0);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const col = columnWidth(f.w, column);
      grilleFront(f, l + LEAF_GAP_MM, r - LEAF_GAP_MM, top - GRILLE_MM + LEAF_GAP_MM / 2, top - LEAF_GAP_MM);
      const n = trolleys(f.w);
      const dw = (f.w - col) / n;
      for (let i = 0; i < n; i++) {
        const a = l + i * dw + LEAF_GAP_MM / 2;
        const b = a + dw - LEAF_GAP_MM;
        doorFront(f, a, b, z0 + LEAF_GAP_MM, top - GRILLE_MM - LEAF_GAP_MM / 2, hingeLeft(i, n));
        f.line("detail", [a + LEAF_GAP_MM, z0 + KICK * 1000], [b - LEAF_GAP_MM, z0 + KICK * 1000]);
        for (const y of RAILS) f.box("detail", a + 70, b - 70, z0 + y * 1000 - RAIL_R * 1000, z0 + y * 1000 + RAIL_R * 1000);
        if (freezer) frostFront(f, a, b, z0 + FROST_Z_MM, z0 + FROST_Z_MM + FROST_STRIP * 1000);
      }
      const zc = Math.min(z0 + CONTROLS_MM, top - GRILLE_MM - 100);
      if (column) displayFront(f, r - col / 2, zc);
      else displayFront(f, r - 130, top - GRILLE_MM / 2);
    },
    mesh(p, s) {
      const zBody = s.d / 2 - FRONT;
      const zLeaf = s.d / 2 - STANDOFF;
      const col = m(columnWidth(s.w * 1000, column));
      const gy = s.h - m(GRILLE_MM);
      p.roundedBox("steel", -s.w / 2, s.w / 2, 0, s.h, -s.d / 2, zBody, CABINET_RADIUS, "vertical");
      // The head over the doors: the machine grille and, on a cabinet without a column, the display.
      p.roundedBox("steel", -s.w / 2, s.w / 2, gy + GAP, s.h, zBody, zLeaf, BODY_RADIUS, "top", "z");
      const gw = column ? s.w - 0.06 : Math.min(0.6, s.w * 0.55);
      grille(p, -s.w / 2 + 0.03, -s.w / 2 + 0.03 + gw, gy + 0.025, s.h - 0.025, zLeaf, s.d / 2);
      if (!column) display(p, s.w / 2 - 0.13, gy + m(GRILLE_MM) / 2, zLeaf);
      if (column) {
        // The control column stands in the door plane beside the door, with its panel.
        p.roundedBox("steel", s.w / 2 - col + GAP, s.w / 2, 0, gy - GAP, zBody, zLeaf - 0.008, BODY_RADIUS, "top", "z");
        const yc = Math.min(m(CONTROLS_MM), gy - 0.15);
        const zp = zLeaf - 0.008;
        p.plate("panelDark", s.w / 2 - col + 0.03, s.w / 2 - 0.03, yc - 0.14, yc + 0.1, zp, zp + 0.002, 0.006, true);
        p.plate("glassDark", s.w / 2 - col + 0.05, s.w / 2 - 0.05, yc, yc + 0.08, zp + 0.002, zp + 0.003, 0.004);
        for (const dx of [-0.05, 0, 0.05]) pushButton(p, s.w / 2 - col / 2 + dx, yc - 0.03, zp + 0.002, 0.009);
        p.knob(s.w / 2 - col / 2, yc - 0.095, zp + 0.002, zLeaf + 0.012, 0.024);
      }
      const n = trolleys(s.w * 1000);
      const dw = (s.w - col) / n;
      for (let i = 0; i < n; i++) {
        const x0 = -s.w / 2 + i * dw;
        coolDoor(p, { x0, x1: x0 + dw, y0: 0, y1: gy, zBody, zFront: s.d / 2, hinge: hingeLeft(i, n) ? "left" : "right", handle: "vertical", gripY: 1.1 });
        // Kick plate on the lower door, where the trolley bumps it.
        p.plate("satin", x0 + 0.03, x0 + dw - 0.03, 0.012, KICK, zLeaf, zLeaf + 0.002, 0.004);
        // Bump rails across the door at the trolley's frame, which tell a roll-in cabinet from an
        // upright one at a glance.
        const rr = Math.min(RAIL_R, (s.d / 2 - zLeaf) / 2 - 0.001);
        for (const y of RAILS) {
          p.tube("handle", [
            { x: x0 + 0.07, y, z: zLeaf },
            { x: x0 + 0.07, y, z: s.d / 2 - rr },
            { x: x0 + dw - 0.07, y, z: s.d / 2 - rr },
            { x: x0 + dw - 0.07, y, z: zLeaf },
          ], rr, { bend: 0.02 });
        }
        if (freezer) frostMark(p, x0, x0 + dw, m(FROST_Z_MM), m(FROST_Z_MM) + FROST_STRIP, zLeaf);
      }
    },
  };
}

export const blastChillerRollIn = rollIn("blastChillerRollIn", true);
export const fridgeRollIn = rollIn("fridgeRollIn", false);
export const freezerRollIn = rollIn("freezerRollIn", false, true);
