// Work cabinet: a wall work table closed with hinged doors, on adjustable feet.

import { doorCount } from "../parts/elevation";
import { doors } from "../parts/mesh";
import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { cabinetBody, cabinetFront, doorsFront, frontsPlan, tableTop, UPSTAND_RISE } from "./common";

export const cabinet: KindDef = {
  kind: "cabinet",
  rise: UPSTAND_RISE,
  plan(s) {
    upstandLine(s);
    frontsPlan(s, s.L, s.R, doorCount(s.w));
  },
  elevation(f) {
    const { z0, z1 } = cabinetFront(f, true);
    doorsFront(f, f.l, f.r, z0, z1, doorCount(f.w));
  },
  mesh(p, s, item) {
    const { y0, y1, zf } = cabinetBody(p, s);
    doors(p, -s.w / 2, s.w / 2, y0, y1, 2 * zf, doorCount(item.width), "vertical");
    tableTop(p, s, { back: true });
  },
};
