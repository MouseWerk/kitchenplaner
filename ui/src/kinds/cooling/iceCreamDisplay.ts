// Ice cream display (Eistheke, Speiseeisvitrine): a refrigerated counter with two rows of 5-litre
// ice cream pans (360 × 165 mm) under a curved glass front on the guests' side (the back) and a
// flat glass top; the staff serve from the open front over a narrow ledge. The machine sits
// behind the grille in the base on the staff side.

import { TOP as FRONT_TOP } from "../parts/elevation";
import { BODY_RADIUS, plinth, TOP_RADIUS, type MaterialId, type Point2 } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { CABINET_RADIUS, display, displayFront, gnPan, grille, grilleFront, LEAF_GAP_MM, m } from "./common";

/** Height of the pan deck above the floor (mm), and of the machine grille (mm). */
const DECK_MM = 900;
const GRILLE_MM = 120;
/** An ice cream pan: width along the counter and length front to back (mm). */
const PAN = { w: 165, l: 360 };
/** Margin of the pans from the ends and the depth of the staff ledge at the front (mm). */
const MARGIN_MM = 60;
const LEDGE_MM = 180;
/** Radius of the curved glass on the guests' side (m) and the glass's thickness. */
const CURVE = 0.32;
const PANE = 0.008;
/** Steps of the glass curve (a quarter circle). */
const CURVE_STEPS = 8;
/** Flavours in turn: vanilla, chocolate, strawberry, pistachio, stracciatella, raspberry. */
const FLAVOURS: readonly MaterialId[] = ["foodCream", "foodBrown", "foodRed", "foodGreen", "panel", "foodRed"];

const panCols = (width: number) => Math.max(1, Math.floor((width - 2 * MARGIN_MM) / (PAN.w + 10)));

/** The two rows of pans (mm, item frame y from the back): z0, z1 of each. */
function rows(depth: number): [number, number][] {
  const front = depth / 2 - LEDGE_MM - 20;
  const l = Math.min(PAN.l, (front + depth / 2 - 2 * MARGIN_MM) / 2);
  return [
    [front - 2 * l - 10, front - l - 10],
    [front - l, front],
  ];
}

export const iceCreamDisplay: KindDef = {
  kind: "iceCreamDisplay",
  plan(s) {
    const n = panCols(s.w);
    const pw = (s.w - 2 * MARGIN_MM) / n;
    for (const [y0, y1] of rows(s.d)) for (let i = 0; i < n; i++) s.rect("detail", s.L + MARGIN_MM + i * pw + 5, y0, s.L + MARGIN_MM + (i + 1) * pw - 5, y1);
    // The ledge on the staff side and the foot of the curved glass on the guests' side.
    s.line("detail", [s.L, s.F - LEDGE_MM], [s.R, s.F - LEDGE_MM]);
    s.line("detail", [s.L + INSET, s.B + INSET], [s.R - INSET, s.B + INSET]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const deck = z0 + DECK_MM;
    f.box("detail", l, r, deck - FRONT_TOP, deck);
    grilleFront(f, l + LEAF_GAP_MM * 3, l + f.w * 0.5, z0 + 120, z0 + 120 + GRILLE_MM);
    displayFront(f, r - 120, deck - 120);
    f.line("detail", [l, z0 + 100], [r, z0 + 100]);
    // The glass seen through: the flat top and the pans' mounds over the deck.
    f.box("detail", l + 20, r - 20, top - 10, top, "glass");
    f.line("detail", [l + 20, deck + 40], [r - 20, deck + 40]);
  },
  mesh(p, s) {
    const deck = m(DECK_MM);
    const back = -s.d / 2;
    const front = s.d / 2;
    plinth(p, s.w, s.d);
    // The base: the guests' side clad in white, the staff side with the grille and the display.
    p.roundedBox("panel", -s.w / 2, s.w / 2, 0.1, deck - 0.04, back, front - 0.02, CABINET_RADIUS, "vertical");
    grille(p, -s.w / 2 + 0.04, -s.w / 2 + s.w * 0.5, 0.12, 0.12 + m(GRILLE_MM), front - 0.02, front - 0.008);
    p.plate("panelDark", s.w / 2 - 0.2, s.w / 2 - 0.03, deck - 0.16, deck - 0.08, front - 0.02, front - 0.018, 0.006, true);
    display(p, s.w / 2 - 0.15, deck - 0.12, front - 0.018);
    // The deck with the pans let into it, the ice cream heaped over their rims.
    const n = panCols(s.w * 1000);
    const pw = (s.w - 2 * m(MARGIN_MM)) / n;
    const x0 = -s.w / 2 + m(MARGIN_MM);
    p.roundedBox("steel", -s.w / 2, s.w / 2, deck - 0.04, deck - 0.015, back, front, TOP_RADIUS);
    for (const [a, b] of rows(s.d * 1000)) {
      for (let i = 0; i < n; i++) {
        const xa = x0 + i * pw + 0.004;
        gnPan(p, xa, xa + pw - 0.008, deck - 0.12, deck, m(a), m(b), FLAVOURS[(i + (a < 0 ? 0 : 3)) % FLAVOURS.length], -0.025);
      }
    }
    p.roundedBox("steel", -s.w / 2, s.w / 2, deck - 0.015, deck + 0.002, front - m(LEDGE_MM), front, TOP_RADIUS);
    p.roundedBox("steel", -s.w / 2, s.w / 2, deck - 0.015, deck + 0.002, back, m(rows(s.d * 1000)[0][0]) - 0.002, TOP_RADIUS);
    // The glass: the curved front on the guests' side running into the flat top as one bent pane
    // (its outer face a quarter circle round (zc, h - CURVE)), and the end panes under it.
    const zc = back + CURVE;
    const arc = (r: number): Point2[] =>
      Array.from({ length: CURVE_STEPS + 1 }, (_, k) => {
        const a = Math.PI - (k / CURVE_STEPS) * (Math.PI / 2);
        return [zc + r * Math.cos(a), s.h - CURVE + r * Math.sin(a)] as const;
      });
    const zEnd = front - m(LEDGE_MM) + 0.04;
    const inner = arc(CURVE - PANE).reverse();
    p.extrude("glass", "x", -s.w / 2 + 0.012, s.w / 2 - 0.012, [[back, deck + 0.002], ...arc(CURVE), [zEnd, s.h], [zEnd, s.h - PANE], ...inner, [back + PANE, deck + 0.002]]);
    const end: Point2[] = [[back + PANE, deck + 0.002], [zEnd, deck + 0.002], [zEnd, s.h - PANE], ...inner.slice(1)];
    p.extrude("glass", "x", -s.w / 2 + 0.002, -s.w / 2 + 0.012, end);
    p.extrude("glass", "x", s.w / 2 - 0.012, s.w / 2 - 0.002, end);
    // A steel cap along the top pane's edge over the staff side.
    p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - 0.02, s.h, zEnd - 0.03, zEnd + 0.004, BODY_RADIUS);
  },
};
