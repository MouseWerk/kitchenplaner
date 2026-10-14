// Wall shelves: one or two boards with folded edges on wall consoles (a rail on the wall, an arm
// under each board and a strut under the top board).

import type { Front } from "../parts/elevation";
import { cross, INSET, type PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";
import { LIP, shelf, strut } from "./helpers";

// Construction sizes (m).
/** Thickness of a console plate. */
const CONSOLE = 0.008;
/** Depth of the wall rail of a console. */
const RAIL = 0.03;
/** Height of a console arm under a board. */
const ARM = 0.025;
/** Radius of a console strut. */
const STRUT = 0.006;
/** Largest distance between two consoles. */
const CONSOLE_PITCH = 0.9;
/** Distance of the outer consoles from the board ends. */
const CONSOLE_INSET = 0.1;

/** Positions of the consoles along the width (m), centred on x = 0. */
function consoles(w: number): number[] {
  const span = Math.max(0, w - 2 * CONSOLE_INSET);
  const n = Math.max(2, Math.ceil(span / CONSOLE_PITCH) + 1);
  return Array.from({ length: n }, (_, i) => -span / 2 + (span * i) / (n - 1));
}

/** Plan: the usual diagonal of an overhead shelf, the front edge and the consoles. */
function planShelf(s: PlanSketch) {
  cross(s, "overhead", false);
  s.line("overhead", [s.L, s.F - INSET / 2], [s.R, s.F - INSET / 2]);
  for (const x of consoles(s.w / 1000)) s.line("overhead", [x * 1000, s.B], [x * 1000, s.B + s.d * 0.7]);
}

/** Elevation: the boards' edges and the consoles below them. */
function frontShelf(f: Front, boards: number) {
  const lip = LIP * 1000;
  const zs = boards === 1 ? [f.top - lip] : [f.z0 + ARM * 1000, f.top - lip];
  for (const z of zs) f.box("detail", f.l, f.r, z, z + lip);
  const t = CONSOLE * 1000;
  for (const x of consoles(f.w / 1000)) {
    const xc = (f.l + f.r) / 2 + x * 1000;
    f.box("detail", xc - t / 2, xc + t / 2, f.z0, zs[zs.length - 1]);
  }
}

function wallShelfKind(kind: string, boards: 1 | 2): KindDef {
  return {
    kind,
    placement: "overhead",
    plan: planShelf,
    elevation(f) {
      frontShelf(f, boards);
    },
    mesh(p, s) {
      const B = -s.d / 2;
      const top = s.h - LIP;
      // A lower board rests on the bottom arms; the top board on arms with a strut below.
      const ys = boards === 1 ? [top] : [ARM, top];
      for (const y of ys) shelf(p, "solid", -s.w / 2, s.w / 2, B + RAIL, s.d / 2, y);
      for (const x of consoles(s.w)) {
        const x0 = x - CONSOLE / 2;
        const x1 = x + CONSOLE / 2;
        p.box("steelDark", x0, x1, 0, top, B, B + RAIL);
        for (const y of ys) p.box("steelDark", x0, x1, y - ARM, y, B + RAIL, s.d / 2 - LIP);
        const low = boards === 1 ? STRUT * 2 : ARM + LIP + STRUT * 2;
        strut(p, "steelDark", [x, low, B + RAIL], [x, top - ARM, B + RAIL + (s.d - RAIL) * 0.6], STRUT);
      }
    },
  };
}

export const wallShelf = wallShelfKind("wallShelf", 1);
export const wallShelfDouble = wallShelfKind("wallShelfDouble", 2);
