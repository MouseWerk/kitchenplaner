// Utility trolley (Etagenwagen): three pressed trays with turned-up edges between four round
// posts on swivel castors under the bottom tray, a push handle bent over each end.

import type { Parts, Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { CASTOR, mBox, metres, pRect, tableCastor } from "./common";

/** Radius of the posts and handles (m, 25 mm tube). */
const POST = 0.0125;
/** Depth of a tray's turned-up edge (m). */
const TRAY = 0.03;
/** Heights of the trays' rims as shares of the height up to the top tray, and the top tray (m). */
const TRAY_SHARES = [0, 0.48, 1] as const;
const TOP_DROP = 0.12;

function layout({ w, d, h }: Size) {
  const x = w / 2 - 0.03 - POST;
  const z = d / 2 - POST;
  const lowest = CASTOR + TRAY + 0.001;
  const top = h - TOP_DROP;
  const trays = TRAY_SHARES.map((k) => lowest + (top - lowest) * k);
  return { x, z, trays };
}

/** A tray from x0 to x1 and z0 to z1 with its rim at `y` (m). */
function tray(p: Parts, x0: number, x1: number, z0: number, z1: number, y: number): void {
  p.pan("steel", x0, x1, y - TRAY, y, z0, z1, { wall: 0.003, r: 0.025 });
}

export const prepTrolley: KindDef = {
  kind: "prepTrolley",
  plan(s) {
    const m = metres(s.item);
    const { x } = layout(m);
    pRect(s, "detail", -x, -m.d / 2 + 0.005, x, m.d / 2 - 0.005);
    for (const sx of [-1, 1]) s.line("detail", [sx * (x * 1000), s.B + INSET / 2], [sx * (x * 1000), s.F - INSET / 2]);
  },
  elevation(f) {
    const m = metres(f.item);
    const { x, trays } = layout(m);
    for (const y of trays) mBox(f, "detail", -m.w / 2, m.w / 2, y - TRAY, y);
    for (const sx of [-1, 1]) mBox(f, "detail", sx * x - POST, sx * x + POST, CASTOR, m.h);
    for (const sx of [-1, 1]) mBox(f, "detail", sx * (x - 0.03) - 0.03, sx * (x - 0.03) + 0.03, 0, CASTOR);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { x, z, trays } = layout(s);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        tableCastor(p, sx * (x - 0.03), sz * (z - 0.05));
      }
    }
    for (const y of trays) tray(p, -w / 2, w / 2, -d / 2, d / 2, y);
    // Each end: two posts from the bottom tray up, bent over into the push handle along z.
    for (const sx of [-1, 1]) {
      const px = sx * x;
      const bend = 0.05;
      const yt = h - POST;
      for (const sz of [-1, 1]) {
        p.rod("steel", "y", px, (trays[0] - TRAY + yt - bend) / 2, sz * z, yt - bend - trays[0] + TRAY, POST);
        p.tube("steel", [{ x: px, y: yt - bend, z: sz * z }, { x: px, y: yt, z: sz * z }, { x: px, y: yt, z: sz * (z - bend) }], POST, { bend, caps: false });
      }
      p.rod("steel", "z", px, yt, 0, 2 * (z - bend), POST);
    }
  },
};
