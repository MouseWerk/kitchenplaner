// Flight-type dishwasher (Bandspülmaschine): an endless belt with rows of fingers carries plates
// and trays without racks from the loading section at the left, through the tunnel (pre-wash,
// wash, rinse, drying), to the unloading section at the right. Both open belt sections are part
// of the unit, so it is one long item.

import { LEG as FRONT_LEG } from "../parts/elevation";
import { LEG, SHEET } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { Parts, Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { CONVEYOR, flowArrow, tunnelFront, tunnelHousing, tunnelPlan, type Span } from "./common";

/** Loading and unloading section: share of the length and the most they take (mm). */
const LOAD = { share: 0.2, max: 1200 };
const UNLOAD = { share: 0.27, max: 1600 };
/** Shares of pre-wash, wash, rinse and drying zone in the tunnel. */
const ZONE_SHARES = [0.2, 0.35, 0.2, 0.25];
const PANEL_ZONE = 1;
/** Distance between two rows of fingers on the belt (m). */
const FINGER_PITCH = 0.25;
/** Height of the side guards above the belt (m). */
const GUARD = 0.06;
/** Distance of the belt from the front and back of the unit (m). */
const BELT_INSET = 0.08;

/** Loading section, tunnel and unloading section along the width (mm, or m with `k` 1/1000). */
function sections(w: number, k = 1) {
  const load = Math.min(LOAD.max * k, w * LOAD.share);
  const unload = Math.min(UNLOAD.max * k, w * UNLOAD.share);
  const tunnel = { x0: -w / 2 + load, x1: w / 2 - unload };
  const zones = ZONE_SHARES.map((share) => (tunnel.x1 - tunnel.x0) * share);
  return { load: { x0: -w / 2, x1: tunnel.x0 }, unload: { x0: tunnel.x1, x1: w / 2 }, tunnel, zones };
}

/** An open belt section in 3D: frame on legs, belt with rows of fingers, side guards. */
function beltSection(p: Parts, s: Size, span: Span, endAt: number): void {
  const z0 = -s.d / 2 + BELT_INSET;
  const z1 = s.d / 2 - BELT_INSET;
  const frameTop = CONVEYOR - 0.04;
  for (const x of [span.x0 + 0.06, span.x1 - 0.06]) {
    if (x < span.x0 || x > span.x1) continue;
    for (const z of [z0 + LEG / 2, z1 - LEG / 2]) {
      p.box("steelDark", x - LEG / 2, x + LEG / 2, 0, frameTop, z - LEG / 2, z + LEG / 2);
      p.cyl("rubber", x, z, 0, 0.012, LEG * 0.6);
    }
  }
  // Frame with the returning belt below and the belt on top.
  p.box("steel", span.x0, span.x1, frameTop - 0.12, frameTop, z0, z1);
  p.box("plate", span.x0, span.x1, frameTop, CONVEYOR, z0 + SHEET, z1 - SHEET);
  const n = Math.floor((span.x1 - span.x0) / FINGER_PITCH);
  for (let i = 1; i <= n; i++) {
    const x = span.x0 + ((span.x1 - span.x0) * i) / (n + 1);
    p.box("rubber", x - 0.006, x + 0.006, CONVEYOR, CONVEYOR + 0.035, z0 + SHEET * 3, z1 - SHEET * 3);
  }
  // Side guards along the front and the back, the turning roller at the open end.
  for (const [a, b] of [
    [-s.d / 2, z0 + SHEET],
    [z1 - SHEET, s.d / 2],
  ]) {
    p.box("steel", span.x0, span.x1, frameTop - 0.12, CONVEYOR + GUARD, a, b);
  }
  p.rod("steelDark", "z", endAt, frameTop - 0.06, 0, z1 - z0, 0.06);
}

export const flightDishwasher: KindDef = {
  kind: "flightDishwasher",
  plan(s) {
    const { load, unload, tunnel, zones } = sections(s.w);
    tunnelPlan(s, tunnel.x0, zones);
    for (const sec of [load, unload]) {
      const b = BELT_INSET * 1000;
      s.rect("detail", sec.x0 + INSET / 2, s.B + b, sec.x1 - INSET / 2, s.F - b);
      for (let x = sec.x0 + FINGER_PITCH * 1000; x < sec.x1 - INSET; x += FINGER_PITCH * 1000) s.line("detail", [x, s.B + b * 2], [x, s.F - b * 2]);
    }
    flowArrow(s, tunnel.x0 + INSET * 4, tunnel.x1 - INSET * 4, s.d / 4, "right");
  },
  elevation(f) {
    const c = (f.l + f.r) / 2;
    const { load, unload, tunnel, zones } = sections(f.w);
    tunnelFront(f, c + tunnel.x0, c + tunnel.x1, zones, PANEL_ZONE);
    const belt = f.z0 + CONVEYOR * 1000;
    for (const sec of [load, unload]) {
      const a = c + sec.x0;
      const b = c + sec.x1;
      f.box("detail", a, b, belt - 160, belt + GUARD * 1000);
      for (const x of [a + 40, b - 40 - FRONT_LEG]) f.box("detail", x, x + FRONT_LEG, f.z0, belt - 160);
    }
  },
  mesh(p, s) {
    const { load, unload, tunnel, zones } = sections(s.w, 1 / 1000);
    beltSection(p, s, load, load.x0 + 0.06);
    beltSection(p, s, unload, unload.x1 - 0.06);
    tunnelHousing(p, s, tunnel.x0, tunnel.x1, zones, PANEL_ZONE);
  },
};
