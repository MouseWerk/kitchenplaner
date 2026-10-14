// Corner work table: closes the corner between two wall tables, with upstands along the back and
// along the side wall (left or right corner).

import { TOP } from "../parts/mesh";
import { UPSTAND, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { tableFrame, tableFront, tableTop, UPSTAND_RISE } from "./common";

function cornerTable(kind: string, side: "left" | "right"): KindDef {
  return {
    kind,
    rise: UPSTAND_RISE,
    plan(s) {
      upstandLine(s);
      const x = side === "left" ? s.L + UPSTAND : s.R - UPSTAND;
      s.line("detail", [x, s.B + UPSTAND], [x, s.F]);
    },
    elevation(f) {
      tableFront(f, { upstand: true, shelf: true });
    },
    mesh(p, s) {
      tableFrame(p, s, s.h - TOP, { shelf: true });
      tableTop(p, s, { back: true, [side]: true });
    },
  };
}

export const cornerTableLeft = cornerTable("cornerTableLeft", "left");
export const cornerTableRight = cornerTable("cornerTableRight", "right");
