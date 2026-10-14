// Free-standing work cabinet: hinged doors at the front, the top rolled at the front and the back
// so both sides can be worked at.

import { doorCount } from "../parts/elevation";
import { doors } from "../parts/mesh";
import type { KindDef } from "../types";
import { cabinetBody, cabinetFront, doorsFront, frontsPlan, tableTop } from "./common";

export const cabinetIsland: KindDef = {
  kind: "cabinetIsland",
  plan(s) {
    frontsPlan(s, s.L, s.R, doorCount(s.w));
  },
  elevation(f) {
    const { z0, z1 } = cabinetFront(f, false);
    doorsFront(f, f.l, f.r, z0, z1, doorCount(f.w));
  },
  mesh(p, s, item) {
    const { y0, y1, zf } = cabinetBody(p, s);
    doors(p, -s.w / 2, s.w / 2, y0, y1, 2 * zf, doorCount(item.width), "vertical");
    tableTop(p, s, { rolledBack: true });
  },
};
