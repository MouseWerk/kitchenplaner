// Parts the building elements share: the stainless frame of a unit set flush into the floor.

import { roundedRectOutline, type Parts } from "../parts/mesh";

/**
 * A stainless frame flush with the floor round a box of half sizes W × D, `rim` wide and `h`
 * high (m): one plate with the opening cut out, its outer edge lightly rounded.
 */
export function flushFrame(p: Parts, W: number, D: number, rim: number, h: number): void {
  p.extrude(
    "steel",
    "y",
    0,
    h,
    roundedRectOutline(-W, W, -D, D, 0.002),
    [roundedRectOutline(-W + rim, W - rim, -D + rim, D - rim, 0)],
  );
}
