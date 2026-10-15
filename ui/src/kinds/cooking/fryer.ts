// Fryer (Fritteuse): oil tanks open in the top with a basket each, hung on a bar at the back;
// doors below (the oil drain container behind them). `fryer` has two tanks from 380 mm width,
// `fryerSingle` one tank over the whole width with two baskets.

import { BASKET_PITCH, BOWL_RADIUS, CONTROLS, SHEET } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { lineFront, lineModule } from "./common";

/** From this width the twin fryer has two tanks (m). */
const FRYER_TWIN_WIDTH = 0.38;
/** Thickness of the top (m). */
const TOP_SHEET = 0.03;
/** Depth of the oil tank below the top (m). */
const TANK = 0.25;

function makeFryer(kind: string, twin: boolean): KindDef {
  const tanks = (w: number) => (twin && w >= FRYER_TWIN_WIDTH ? 2 : 1);
  return {
    kind,
    plan(s) {
      const n = tanks(s.w / 1000);
      const bw = (s.w - (n + 1) * INSET) / n;
      for (let i = 0; i < n; i++) {
        const x = s.L + INSET + i * (bw + INSET);
        s.rect("detail", x, s.B + INSET, x + bw, s.F - CONTROL_STRIP);
        // The basket in the tank (two in a single wide tank).
        const k = twin ? 1 : 2;
        const kw = (bw - (k + 1) * INSET / 2) / k;
        for (let j = 0; j < k; j++) {
          const kx = x + INSET / 2 + j * (kw + INSET / 2);
          s.rect("detail", kx, s.B + INSET * 2, kx + kw, s.F - CONTROL_STRIP - INSET);
        }
      }
      controlStrip(s);
    },
    elevation(f) {
      lineFront(f, tanks(f.w / 1000), "doors");
    },
    mesh(p, s) {
      const n = tanks(s.w);
      const m = 0.04;
      const bw = (s.w - m * (n + 1)) / n;
      const z0 = -s.d / 2 + m;
      const z1 = s.d / 2 - CONTROLS - m;
      const holes = Array.from({ length: n }, (_, i) => {
        const x0 = -s.w / 2 + m + i * (bw + m);
        return { x0, x1: x0 + bw, z0, z1 };
      });
      lineModule(p, s, { base: "doors", knobs: n, underTop: s.h - TOP_SHEET, solidTo: s.h - TANK - 0.01 });
      p.topWithHoles("steel", s.w, s.d, s.h - TOP_SHEET, s.h, holes);
      const k = twin ? 1 : 2;
      for (const { x0, x1 } of holes) {
        // The oil fills the tank up to its level, round in the corners like the tank.
        const wall = SHEET / 2;
        p.roundedBox("oil", x0 + wall, x1 - wall, s.h - TANK + wall, s.h - 0.08, z0 + wall, z1 - wall, BOWL_RADIUS - wall, "vertical");
        p.tub("steelDark", x0, x1, s.h - TANK, s.h, z0, z1, wall);
        // The bar at the back the baskets hang on when they drip off.
        p.rod("handle", "x", (x0 + x1) / 2, s.h - 0.012, z0 + 0.025, x1 - x0 - SHEET, 0.006);
        const inset = 0.02;
        const kw = (x1 - x0 - inset * (k + 1)) / k;
        const kz1 = z1 - 0.07;
        for (let j = 0; j < k; j++) {
          const kx = x0 + inset + j * (kw + inset);
          p.wireBox(kx, kx + kw, s.h - 0.15, s.h - 0.03, z0 + 0.05, kz1, BASKET_PITCH);
          // Handle: a bent bracket up from the basket's front and a black grip towards the front.
          const cx = kx + kw / 2;
          const gy = s.h - 0.02;
          p.tube(
            "handle",
            [
              { x: cx, y: s.h - 0.06, z: kz1 - 0.004 },
              { x: cx, y: gy, z: kz1 - 0.004 },
              { x: cx, y: gy, z: kz1 + 0.01 },
            ],
            0.004,
            { bend: 0.01 },
          );
          p.lathe(
            "knob",
            cx,
            gy,
            kz1,
            [
              [0, 0],
              [0.008, 0],
              [0.01, 0.006],
              [0.01, 0.052],
              [0.008, 0.06],
              [0, 0.06],
            ],
            { axis: "z" },
          );
        }
      }
    },
  };
}

export const fryer = makeFryer("fryer", true);
export const fryerSingle = makeFryer("fryerSingle", false);
