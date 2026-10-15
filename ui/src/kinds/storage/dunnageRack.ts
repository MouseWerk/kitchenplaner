// Floor rack (Bodenrost): a low slatted platform on legs that keeps crates, sacks and cases off
// the floor of a store or cold room so the floor can be cleaned underneath.

import { LEG } from "../parts/elevation";
import { BODY_RADIUS, LEG_RADIUS, TOP_RADIUS } from "../parts/mesh";
import type { KindDef } from "../types";

// Construction sizes (m).
/** Square leg and the rubber pad under it. */
const POST = 0.04;
const PAD = 0.012;
/** Slats on top: thickness, width and largest pitch. */
const SLAT = 0.02;
const SLAT_W = 0.05;
const SLAT_PITCH = 0.08;
/** Height of the frame rails under the slats. */
const RAIL = 0.04;
/** Largest distance between two legs along the width. */
const LEG_PITCH = 0.7;

/** Positions of the legs along the width (m), centred on x = 0. */
function legs(w: number): number[] {
  const span = w - POST;
  const n = Math.max(2, Math.ceil(span / LEG_PITCH) + 1);
  return Array.from({ length: n }, (_, i) => -span / 2 + (span * i) / (n - 1));
}

function slats(d: number): number[] {
  const n = Math.max(2, Math.round(d / SLAT_PITCH));
  const pitch = (d - SLAT_W) / (n - 1);
  return Array.from({ length: n }, (_, i) => -d / 2 + SLAT_W / 2 + pitch * i);
}

export const dunnageRack: KindDef = {
  kind: "dunnageRack",
  plan(s) {
    for (const y of slats(s.d / 1000)) {
      for (const e of [-SLAT_W / 2, SLAT_W / 2]) {
        const yy = (y + e) * 1000;
        if (yy > s.B + 1 && yy < s.F - 1) s.line("detail", [s.L, yy], [s.R, yy]);
      }
    }
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.box("detail", l, r, top - SLAT * 1000, top);
    f.box("detail", l, r, top - (SLAT + RAIL) * 1000, top - SLAT * 1000);
    const c = (l + r) / 2;
    for (const x of legs(f.w / 1000)) f.box("detail", c + x * 1000 - LEG / 2, c + x * 1000 + LEG / 2, z0, top - (SLAT + RAIL) * 1000);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    const railTop = s.h - SLAT;
    for (const x of legs(s.w)) {
      for (const sz of [-1, 1]) {
        const z = sz * (D - POST / 2);
        // A turned levelling pad under each square leg.
        p.lathe("rubber", x, 0, z, [
          [0, 0],
          [POST * 0.45, 0],
          [POST * 0.5, PAD * 0.4],
          [POST * 0.42, PAD],
          [0, PAD],
        ]);
        p.roundedBox("steelDark", x - POST / 2, x + POST / 2, PAD, railTop - RAIL, z - POST / 2, z + POST / 2, LEG_RADIUS, "vertical");
      }
      // A bearer across the depth over each pair of legs.
      p.roundedBox("steelDark", x - POST / 2, x + POST / 2, railTop - RAIL, railTop - 0.001, -D, D, BODY_RADIUS);
    }
    for (const sz of [-1, 1]) p.roundedBox("steelDark", -W, W, railTop - RAIL, railTop - 0.001, sz * D - (sz > 0 ? POST / 2 : 0), sz * D + (sz < 0 ? POST / 2 : 0), BODY_RADIUS);
    // Pressed slats with rounded edges along the width, lying on the bearers.
    for (const z of slats(s.d)) p.roundedBox("steel", -W, W, railTop, s.h, z - SLAT_W / 2, z + SLAT_W / 2, TOP_RADIUS, "top");
  },
};
