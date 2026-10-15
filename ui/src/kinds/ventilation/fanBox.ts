// Exhaust fan box (Abluftventilatorbox): the insulated box with the exhaust fan of the kitchen
// extraction, hung under the ceiling in a plant room or a ceiling void. The duct comes in through
// the round spigot at the left end and leaves at the right, the access door with its latches is
// on the front, the motor's terminal box and the repair switch sit beside it, and the box hangs
// on threaded rods with rubber mounts.

import { cross, INSET as PLAN_INSET } from "../parts/plan";
import { INSET } from "../parts/elevation";
import type { KindDef } from "../types";
import { latch, PRESSED, spigotSide } from "./common";

/** Length of the spigots at both ends (m) and their radius share of the box's height. */
const SPIGOT = 0.08;
const SPIGOT_SHARE = 0.32;
/** Height taken by the hangers over the box (share of the height, at most 150 mm). */
const HANGER_SHARE = 0.22;
const HANGER_MAX = 0.15;

function boxTop(h: number): number {
  return h - Math.min(HANGER_MAX, h * HANGER_SHARE);
}

export const fanBox: KindDef = {
  kind: "fanBox",
  placement: "overhead",
  plan(s) {
    cross(s, "overhead", false);
    const sp = SPIGOT * 1000;
    s.rect("overhead", s.L + sp, s.B + PLAN_INSET / 2, s.R - sp, s.F - PLAN_INSET / 2);
    // The direction of the air, from the inlet at the left to the outlet at the right.
    s.line("overhead", [-120, 0], [120, 0]);
    s.line("overhead", [80, -40], [120, 0], [80, 40]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const sp = SPIGOT * 1000;
    const bt = z0 + boxTop(f.item.height / 1000) * 1000;
    f.box("detail", l + sp, r - sp, z0, bt);
    const cy = (z0 + bt) / 2;
    const rr = (bt - z0) * SPIGOT_SHARE;
    f.box("detail", l, l + sp, cy - rr, cy + rr);
    f.box("detail", r - sp, r, cy - rr, cy + rr);
    f.box("detail", l + sp + INSET * 2, r - sp - INSET * 6, z0 + INSET, bt - INSET);
    for (const x of [l + sp + 120, r - sp - 120]) f.line("detail", [x, bt], [x, top]);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const bt = boxTop(h);
    const x0 = -w / 2 + SPIGOT;
    const x1 = w / 2 - SPIGOT;
    // The box, pressed with round edges, a seam round its lid.
    p.roundedBox("paintGray", x0, x1, 0.02, bt, -d / 2 + 0.01, d / 2 - 0.02, PRESSED * 2);
    p.lathe(
      "steelDark",
      0,
      bt - 0.06,
      -0.005,
      [
        [0, 0],
        [0.0015, 0],
        [0.0015, 0.004],
        [0, 0.004],
        [0, 0],
      ],
      { rect: [(x1 - x0) / 2 - PRESSED * 2, (d - 0.03) / 2 - PRESSED * 2] },
    );
    // The spigots, flanged to the box's ends, with the duct coming in and leaving.
    const cy = (0.02 + bt) / 2;
    const r = Math.min((bt - 0.02) * SPIGOT_SHARE, d / 2 - 0.05);
    spigotSide(p, x0, cy, -0.005, r, SPIGOT, -1);
    spigotSide(p, x1, cy, -0.005, r, SPIGOT, 1);
    // The access door on the front with its gasket and latches, the motor's terminal box and the
    // repair switch with its red-yellow handle beside it.
    const zf = d / 2 - 0.02;
    const dx0 = x0 + 0.05;
    const dx1 = x1 - 0.2;
    p.plate("rubber", dx0 - 0.004, dx1 + 0.004, 0.06, bt - 0.08, zf - 0.001, zf + 0.002, 0.012);
    p.plate("paintGray", dx0, dx1, 0.064, bt - 0.084, zf + 0.002, zf + 0.008, 0.01, true);
    for (const y of [0.1, bt - 0.12]) latch(p, dx1 - 0.04, y, zf + 0.008, 0.01);
    const sx = (dx1 + x1) / 2 + 0.01;
    p.roundedBox("panelDark", sx - 0.06, sx + 0.06, cy - 0.06, cy + 0.06, zf, zf + 0.012, 0.006, "top", "z");
    p.lathe("signalYellow", sx, cy, zf + 0.012, [
      [0, 0],
      [0.035, 0],
      [0.035, 0.003],
      [0, 0.003],
    ], { axis: "z" });
    p.roundedBox("signalRed", sx - 0.008, sx + 0.008, cy - 0.03, cy + 0.03, zf + 0.012, d / 2, 0.004, "top", "z");
    // Rubber mounts under the box's corners: it stands on two rails hung from the ceiling.
    for (const x of [x0 + 0.12, x1 - 0.12]) {
      p.roundedBox("steelDark", x - 0.025, x + 0.025, 0, 0.012, -d / 2, d / 2, 0.003, "all", "z");
      for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) {
        p.lathe("rubber", x, 0.012, z, [
          [0, 0],
          [0.018, 0],
          [0.014, 0.012],
          [0, 0.012],
        ]);
        p.rod("steelDark", "y", x, (0.006 + h) / 2, z, h - 0.006, 0.005);
        p.roundedBox("steelDark", x - 0.025, x + 0.025, h - 0.006, h, z - 0.025, z + 0.025, 0.003);
      }
    }
  },
};
