// Pre-rinse and sorting table (Vorspül- und Sortiertisch): at the left end a waste chute over a
// bin, next to it a basin with the pre-rinse shower, then rack rails towards the dishwasher,
// which stands to the right of it (the right end is open). Plates are scraped into the chute,
// rinsed over the basin and sorted into racks.

import { INSET as FRONT_INSET, LEG, TOP as FRONT_TOP } from "../parts/elevation";
import { SHEET } from "../parts/mesh";
import { INSET, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { bowlDrain, dishTableTop, flowArrow, preRinseFront, preRinsePlan, preRinseShower, rackRails, rackRailsPlan, RIM, SHOWER_RISE, tableFrame } from "./common";

/** The waste chute (mm): its square opening, the distance from the left end and its depth. */
const CHUTE = 260;
const CHUTE_AT = 100;
const CHUTE_DEPTH = 200;
/** The basin beside the chute (mm): width, depth from back to front and depth. */
const BASIN_W = 450;
const BASIN_D = 450;
const BASIN_DEPTH = 200;
const GAP = 60;
/** Radius and height of the waste bin under the chute (mm). */
const BIN_R = 180;
const BIN_H = 600;

/** The chute and the basin in the item frame (mm), shrunk on a short table. */
function layout(w: number, d: number) {
  const chute = Math.min(CHUTE, w * 0.18);
  const cx0 = -w / 2 + Math.min(CHUTE_AT, w * 0.06);
  const bw = Math.min(BASIN_W, w * 0.3);
  const bd = Math.min(BASIN_D, d - 2 * INSET * 1.6);
  const bx0 = cx0 + chute + GAP;
  return { chute: { x0: cx0, x1: cx0 + chute, y0: -chute / 2, y1: chute / 2 }, basin: { x0: bx0, x1: bx0 + bw, y0: -bd / 2, y1: bd / 2 } };
}

export const sortingTable: KindDef = {
  kind: "sortingTable",
  rise: SHOWER_RISE,
  plan(s) {
    const { chute, basin } = layout(s.w, s.d);
    const cc = (chute.x0 + chute.x1) / 2;
    s.rect("detail", chute.x0, chute.y0, chute.x1, chute.y1);
    s.circle("hidden", cc, 0, Math.min(BIN_R, s.d / 2 - INSET));
    s.rect("detail", basin.x0, basin.y0, basin.x1, basin.y1);
    s.circle("detail", (basin.x0 + basin.x1) / 2, 0, INSET / 2);
    preRinsePlan(s, (basin.x0 + basin.x1) / 2);
    rackRailsPlan(s, basin.x1 + INSET, s.R);
    flowArrow(s, basin.x1 + INSET * 2, s.R - INSET, 0, "right");
    upstandLine(s);
  },
  elevation(f) {
    const c = (f.l + f.r) / 2;
    const { chute, basin } = layout(f.w, f.item.depth);
    const sheet = f.top - RIM * 1000;
    f.worktop();
    f.line("detail", [f.l, sheet], [f.r, sheet]);
    f.box("hidden", c + chute.x0, c + chute.x1, sheet - CHUTE_DEPTH, f.top - FRONT_TOP - FRONT_INSET);
    f.box("hidden", c + basin.x0, c + basin.x1, sheet - BASIN_DEPTH, f.top - FRONT_TOP - FRONT_INSET);
    // The bin under the chute stands on the floor; the undershelf starts beside it.
    const cc = c + (chute.x0 + chute.x1) / 2;
    const bin = Math.min(BIN_R, (chute.x1 - chute.x0) * 0.8);
    f.box("detail", cc - bin, cc + bin, f.z0, f.z0 + Math.min(BIN_H, sheet - CHUTE_DEPTH - f.z0 - FRONT_INSET));
    f.box("detail", f.l, f.l + LEG, f.z0, f.top - FRONT_TOP);
    f.box("detail", f.r - LEG, f.r, f.z0, f.top - FRONT_TOP);
    f.line("detail", [cc + bin + FRONT_INSET, f.z0 + 250], [f.r - LEG, f.z0 + 250]);
    preRinseFront(f, c + (basin.x0 + basin.x1) / 2, sheet, SHOWER_RISE + RIM * 1000);
  },
  mesh(p, s) {
    const { chute: c, basin: b } = layout(s.w * 1000, s.d * 1000);
    const m = (v: number) => v / 1000;
    const chute = { x0: m(c.x0), x1: m(c.x1), z0: m(c.y0), z1: m(c.y1) };
    const basin = { x0: m(b.x0), x1: m(b.x1), z0: m(b.y0), z1: m(b.y1) };
    const cc = (chute.x0 + chute.x1) / 2;
    const bin = Math.min(m(BIN_R), (chute.x1 - chute.x0) * 0.8);
    tableFrame(p, s, s.h - RIM - SHEET * 2, { x0: cc + bin + 0.04, x1: s.w / 2 });
    const y = dishTableTop(p, s, [chute, basin], ["right"]);
    // The chute: a funnel without a floor, the bin standing under it on castors, its rim dark.
    const cy0 = y - m(CHUTE_DEPTH);
    p.box("steel", chute.x0, chute.x1, cy0, y, chute.z0, chute.z0 + SHEET);
    p.box("steel", chute.x0, chute.x1, cy0, y, chute.z1 - SHEET, chute.z1);
    p.box("steel", chute.x0, chute.x0 + SHEET, cy0, y, chute.z0, chute.z1);
    p.box("steel", chute.x1 - SHEET, chute.x1, cy0, y, chute.z0, chute.z1);
    const binTop = Math.min(m(BIN_H), cy0 - 0.03);
    p.cyl("panelDark", cc, 0, 0.03, binTop - 0.02, bin);
    p.cyl("rubber", cc, 0, binTop - 0.02, binTop, bin + 0.008);
    for (const dx of [-bin * 0.6, bin * 0.6]) p.cyl("rubber", cc + dx, 0, 0, 0.03, 0.02);
    // The basin with its drain, the shower behind it, the rails towards the machine.
    p.tub("steel", basin.x0, basin.x1, y - m(BASIN_DEPTH), y, basin.z0, basin.z1);
    bowlDrain(p, (basin.x0 + basin.x1) / 2, 0, y - m(BASIN_DEPTH), -s.d / 2);
    rackRails(p, basin.x1 + 0.05, s.w / 2, y);
    preRinseShower(p, (basin.x0 + basin.x1) / 2, -s.d / 2 + SHEET * 1.5, y, SHOWER_RISE / 1000 + RIM);
  },
};
