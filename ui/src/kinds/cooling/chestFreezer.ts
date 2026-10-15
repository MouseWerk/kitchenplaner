// Chest freezer (Tiefkühltruhe): a white pressed housing with a hinged insulated lid, the
// compressor behind the vent at the bottom of one end; the ice cream conservator
// (Eiskonservator) is the same chest with two sliding glass lids in a gray frame, the tubs and
// packs showing through them. Both carry the freezer mark on the front.

import { FROST_STRIP, frostFront, frostMark, frostPlan } from "../parts/frost";
import { foot, type MaterialId, type Parts, type Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { pushButton } from "./common";

/** Edge radius of the pressed housing and the lid (m). */
const HOUSING_R = 0.012;
/** Depth of the grip moulding on the lid's front edge (m). */
const GRIP = 0.022;
/** How far the housing's front stands behind the item's front: room for the frost mark on it (m). */
const FRONT_SET = 0.009;
/** Height of the lid, or of the glass frame (m); the recessed base under the housing (m). */
const LID = 0.07;
const FRAME = 0.05;
const BASE = 0.05;
/** Depth of the conservator's open well under its glass lids (m). */
const WELL = 0.22;
/** Width of the vent slots at the right end of the front (m). */
const VENT_W = 0.18;
/** Height of the frost strip below the lid (m). */
const FROST_DROP = 0.06;
/** Tubs in the conservator: size seen from above and the flavours in turn (m). */
const TUB = { w: 0.17, d: 0.25 };
const FLAVOURS: readonly MaterialId[] = ["foodCream", "foodBrown", "foodRed", "foodGreen", "foodCream", "foodRed"];

function chest(kind: string, glass: boolean): KindDef {
  return {
    kind,
    plan(s) {
      if (glass) {
        // The two sliding lids overlap in the middle.
        s.rect("detail", s.L + INSET, s.B + INSET, INSET, s.F - INSET);
        s.rect("detail", -INSET, s.B + INSET, s.R - INSET, s.F - INSET);
      } else s.rect("detail", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.F - INSET / 2);
      // On the glass top the mark keeps clear of the lids' overlap in the middle.
      frostPlan(s, glass ? s.L / 2 : 0, 0);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const lid = (glass ? FRAME : LID) * 1000;
      f.line("detail", [l, top - lid], [r, top - lid]);
      f.line("detail", [l + 30, z0 + BASE * 1000], [r - 30, z0 + BASE * 1000]);
      const fz = top - lid - FROST_DROP * 1000;
      frostFront(f, l + 40, r - 40 - VENT_W * 1000, fz - FROST_STRIP * 1000, fz);
      f.box("detail", r - 30 - VENT_W * 1000, r - 30, z0 + BASE * 1000 + 30, z0 + BASE * 1000 + 110, "item-dark");
      if (!glass) f.line("detail", [(l + r) / 2 - 150, top - lid / 2], [(l + r) / 2 + 150, top - lid / 2]);
    },
    mesh(p, s) {
      const y1 = s.h - (glass ? FRAME : LID);
      // Feet under the recessed base, the base, the housing.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (s.w / 2 - 0.06), sz * (s.d / 2 - 0.06), 0.02, 0.018);
      p.roundedBox("steelDark", -s.w / 2 + 0.03, s.w / 2 - 0.03, 0.02, BASE + 0.005, -s.d / 2 + 0.03, s.d / 2 - 0.03, 0.004, "vertical");
      // The conservator's housing is open at the top: a body up to the baskets' floor, walls above.
      const well = glass ? y1 - WELL : y1;
      p.roundedBox("panel", -s.w / 2, s.w / 2, BASE, well + (glass ? HOUSING_R : 0), -s.d / 2, s.d / 2 - FRONT_SET, HOUSING_R, glass ? "vertical" : "all");
      if (glass) {
        const t = 0.05;
        for (const [z0, z1] of [[-s.d / 2, -s.d / 2 + t], [s.d / 2 - FRONT_SET - t, s.d / 2 - FRONT_SET]]) p.roundedBox("panel", -s.w / 2, s.w / 2, well, y1, z0, z1, HOUSING_R, "vertical");
        for (const sx of [-1, 1]) p.box("panel", sx > 0 ? s.w / 2 - t : -s.w / 2 + 0.001, sx > 0 ? s.w / 2 - 0.001 : -s.w / 2 + t, well, y1, -s.d / 2 + t, s.d / 2 - FRONT_SET - t);
      }
      // Vent slots and the thermostat at the right of the front, the frost strip at the left.
      const zf = s.d / 2 - FRONT_SET;
      for (let i = 0; i < 5; i++) p.plate("slot", s.w / 2 - 0.03 - VENT_W, s.w / 2 - 0.03, BASE + 0.035 + i * 0.016, BASE + 0.043 + i * 0.016, zf - 0.001, zf + 0.0005, 0.004);
      pushButton(p, s.w / 2 - 0.03 - VENT_W / 2, y1 - 0.06, zf, 0.014);
      frostMark(p, -s.w / 2 + 0.04, s.w / 2 - 0.04 - VENT_W, y1 - FROST_DROP - FROST_STRIP, y1 - FROST_DROP, zf);
      if (glass) conservatorTop(p, s, y1);
      else lid(p, s, y1);
    },
  };
}

/** The hinged lid: a pressed panel over a gasket, a grip along its front edge, hinges at the back. */
function lid(p: Parts, s: Size, y1: number): void {
  p.roundedBox("rubber", -s.w / 2 + 0.01, s.w / 2 - 0.01, y1, y1 + 0.006, -s.d / 2 + 0.01, s.d / 2 - 0.012, 0.004);
  p.roundedBox("panel", -s.w / 2, s.w / 2, y1 + 0.004, s.h, -s.d / 2, s.d / 2 - GRIP, HOUSING_R);
  // The grip: a gray moulding along the middle of the lid's front edge, hooked under it.
  const gw = Math.min(0.4, s.w * 0.45);
  p.extrude("paintGray", "x", -gw / 2, gw / 2, [
    [s.d / 2 - GRIP - 0.004, y1 + 0.008],
    [s.d / 2 - 0.004, y1 + 0.008],
    [s.d / 2, y1 + 0.014],
    [s.d / 2, s.h - 0.012],
    [s.d / 2 - 0.006, s.h - 0.004],
    [s.d / 2 - GRIP - 0.004, s.h - 0.004],
  ]);
  for (const x of [-s.w / 2 + 0.15, s.w / 2 - 0.15]) p.roundedBox("paintGray", x - 0.03, x + 0.03, y1 - 0.03, y1 + 0.03, -s.d / 2, -s.d / 2 + 0.004, 0.004);
}

/**
 * The conservator's top: a gray frame round the opening, wire baskets in it holding tubs, and two
 * sliding glass lids, the right one in the upper track.
 */
function conservatorTop(p: Parts, s: Size, y1: number): void {
  const fw = 0.045;
  p.lathe(
    "paintGray",
    0,
    y1,
    0,
    [
      [0, 0],
      [fw, 0],
      [fw, FRAME - 0.006],
      [fw - 0.006, FRAME],
      [0, FRAME],
      [0, 0],
    ],
    { rect: [s.w / 2 - fw, s.d / 2 - fw] },
  );
  // The tubs in two rows, their lids off: flavours showing, a white liner round them.
  const x0 = -s.w / 2 + fw + 0.01;
  const x1 = s.w / 2 - fw - 0.01;
  const z0 = -s.d / 2 + fw + 0.01;
  const z1 = s.d / 2 - fw - 0.01;
  p.box("panel", x0, x1, y1 - 0.2, y1 - 0.19, z0, z1);
  const cols = Math.max(1, Math.floor((x1 - x0) / (TUB.w + 0.01)));
  const rows = Math.max(1, Math.floor((z1 - z0) / (TUB.d + 0.01)));
  const cw = (x1 - x0) / cols;
  const rd = (z1 - z0) / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const a = x0 + c * cw + 0.005;
      const b = a + cw - 0.01;
      const za = z0 + r * rd + 0.005;
      const zb = za + rd - 0.01;
      const top = y1 - 0.03;
      p.roundedBox("panel", a, b, y1 - 0.19, top, za, zb, 0.012, "vertical");
      p.roundedBox(FLAVOURS[(c + r * 3) % FLAVOURS.length], a + 0.004, b - 0.004, top - 0.03, top + 0.002, za + 0.004, zb - 0.004, 0.01, "vertical");
    }
  }
  // The lids: panes in light frames, overlapping in the middle.
  const half = (s.w - 2 * fw) / 2 + 0.03;
  for (const [i, xa] of [-s.w / 2 + fw - 0.01, s.w / 2 - fw + 0.01 - half].entries()) {
    const y = y1 + (i === 0 ? FRAME - 0.022 : FRAME - 0.008);
    p.roundedBox("glass", xa, xa + half, y, y + 0.006, -s.d / 2 + fw - 0.01, s.d / 2 - fw + 0.01, 0.003);
    p.roundedBox("paintGray", i === 0 ? xa + half - 0.03 : xa, i === 0 ? xa + half : xa + 0.03, y - 0.002, y + 0.008, -s.d / 2 + fw - 0.01, s.d / 2 - fw + 0.01, 0.003);
  }
}

export const chestFreezer = chest("chestFreezer", false);
export const iceCreamConservator = chest("iceCreamConservator", true);
