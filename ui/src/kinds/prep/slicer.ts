// Slicer (Aufschnittmaschine), a table-top unit: a base with the round blade and its guard ring
// at the right, the carriage with the product tray and pusher at the left, the thickness knob at
// the front. Stands on a work table (`tableTop`).

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, mLine, pRect } from "./common";

/** Where the parts of a slicer of the given size lie (m, item frame). */
function layout({ w, d, h }: Size) {
  const baseTop = MACHINE_FOOT + h * 0.16;
  const baseFront = d / 2 - 0.025;
  const r = Math.min(h * 0.35, d * 0.3, w * 0.3);
  const ring = r + 0.012;
  const bx = w * 0.08;
  const by = h - ring;
  const tray = { x0: -w / 2 + 0.03, x1: bx - 0.015, y: by - r * 0.6, z0: -r * 0.9, z1: r * 0.9 };
  return { baseTop, baseFront, r, ring, bx, by, tray };
}

export const slicer: KindDef = {
  kind: "slicer",
  placement: "tableTop",
  plan(s) {
    const { w, d } = metres(s.item);
    const { r, ring, bx, tray } = layout(metres(s.item));
    // The blade seen edge on, the motor housing behind it, the carriage at the left.
    pRect(s, "detail", bx - 0.004, -ring, bx + 0.012, ring);
    pRect(s, "detail", bx + 0.012, -ring, w / 2 - 0.02, r * 0.4);
    pRect(s, "detail", tray.x0, tray.z0, tray.x1, tray.z1);
    pRect(s, "detail", -w / 2 + 0.05, d / 2 - 0.025, -w / 2 + 0.11, d / 2);
  },
  elevation(f) {
    const s = metres(f.item);
    const { baseTop, ring, bx, by, r, tray } = layout(s);
    mBox(f, "detail", -s.w / 2, s.w / 2, MACHINE_FOOT, baseTop);
    mBox(f, "detail", bx + 0.012, s.w / 2 - 0.02, baseTop, by + r * 0.5);
    mBox(f, "detail", bx - 0.004, bx + 0.012, by - ring, by + ring, "item-dark");
    mBox(f, "detail", tray.x0, tray.x1, tray.y, tray.y + 0.008);
    mLine(f, [tray.x0 + 0.04, tray.y + r * 0.6], [tray.x1 - 0.04, tray.y + r * 0.6]);
    mCircle(f, -s.w / 2 + 0.08, (MACHINE_FOOT + baseTop) / 2, 0.03);
  },
  mesh(p, s) {
    const { w, d } = s;
    const { baseTop, baseFront, r, ring, bx, by, tray } = layout(s);
    machineFeet(p, -w / 2, w / 2, -d / 2, baseFront);
    p.box("steel", -w / 2, w / 2, MACHINE_FOOT, baseTop, -d / 2, baseFront);
    // Motor housing and blade arm behind the blade.
    p.box("steel", bx + 0.012, w / 2 - 0.02, baseTop, by + r * 0.5, -ring, r * 0.4);
    // Guard ring, the bright blade and its centre cover; the ring's top is the unit's height.
    p.rod("steelDark", "x", bx + 0.006, by, 0, 0.012, ring);
    p.rod("handle", "x", bx - 0.002, by, 0, 0.004, r);
    p.rod("steelDark", "x", bx - 0.008, by, 0, 0.008, r * 0.45);
    // Carriage: a slide column, the tray, the side plate and the pusher with its knob.
    const cx = (tray.x0 + tray.x1) / 2;
    p.box("steelDark", cx - 0.03, cx + 0.03, baseTop, tray.y, -0.03, 0.03);
    p.box("steel", tray.x0, tray.x1, tray.y, tray.y + 0.008, tray.z0, tray.z1);
    p.box("steel", tray.x0, tray.x1, tray.y, tray.y + r * 0.35, tray.z0, tray.z0 + 0.006);
    p.box("steelDark", tray.x0 + 0.02, tray.x1 - 0.02, tray.y + r * 0.55, tray.y + r * 0.6, -0.015, 0.015);
    p.cyl("knob", tray.x0 + 0.04, 0, tray.y + r * 0.6, tray.y + r * 0.6 + 0.05, 0.018);
    // Thickness knob at the front left, start and stop buttons at the front right.
    p.knob(-w / 2 + 0.08, (MACHINE_FOOT + baseTop) / 2, baseFront, d / 2, 0.03);
    const yb = (MACHINE_FOOT + baseTop) / 2;
    p.box("handle", w / 2 - 0.13, w / 2 - 0.1, yb - 0.012, yb + 0.012, baseFront, baseFront + 0.008);
    p.box("knob", w / 2 - 0.09, w / 2 - 0.06, yb - 0.012, yb + 0.012, baseFront, baseFront + 0.008);
  },
};
