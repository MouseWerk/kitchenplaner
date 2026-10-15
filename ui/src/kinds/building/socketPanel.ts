// Socket panel (Steckdosenkombination): a surface-mounted housing on the wall with flip-lid
// sockets for 230 V and, from three places on, a 400 V five-pin socket on the right.

import { INSET } from "../parts/elevation";
import type { KindDef } from "../types";
import { socket230, socket400 } from "./sockets";

// Sizes (m).
/** Width of one socket place. */
const PLACE = 0.09;
/** How far the sockets stand out of the housing's face (the rest of the depth is housing). */
const PROUD = 0.022;
/** Size of a 230 V socket's lid and radius of the 400 V socket. */
const LID = 0.056;
const CEE = 0.03;

/** Socket places along the width (m), centred, and whether the last one is the 400 V socket. */
function places(w: number): { xs: number[]; cee: boolean } {
  const n = Math.max(1, Math.floor((w - 0.02) / PLACE));
  return { xs: Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * PLACE), cee: n >= 3 };
}

export const socketPanel: KindDef = {
  kind: "socketPanel",
  placement: "overhead",
  plan(s) {
    // The housing's face and the sockets in front of it, as 3D shows them from above (the round
    // 400 V socket points to the front, so from above it is a rectangle too).
    const face = s.F - PROUD * 1000;
    s.line("overhead", [s.L, face], [s.R, face]);
    const { xs, cee } = places(s.w / 1000);
    xs.forEach((x, i) => {
      const half = (cee && i === xs.length - 1 ? CEE : LID / 2) * 1000;
      s.rect("overhead", x * 1000 - half, face, x * 1000 + half, s.F);
    });
  },
  elevation(f) {
    const c = (f.l + f.r) / 2;
    const zc = (f.z0 + f.top) / 2;
    const { xs, cee } = places(f.w / 1000);
    xs.forEach((x, i) => {
      const xc = c + x * 1000;
      if (cee && i === xs.length - 1) {
        f.circle("detail", xc, zc, CEE * 1000);
        f.circle("detail", xc, zc, CEE * 500);
      } else {
        f.box("detail", xc - LID * 500, xc + LID * 500, zc - LID * 500, zc + LID * 500);
        f.circle("detail", xc, zc, LID * 250);
      }
    });
    f.line("detail", [f.l + INSET / 2, f.z0 + INSET / 2], [f.r - INSET / 2, f.z0 + INSET / 2]);
  },
  mesh(p, s) {
    const B = -s.d / 2;
    const zf = s.d / 2 - PROUD;
    // The surface-mounted housing, pressed plastic with round corners.
    p.roundedBox("panel", -s.w / 2, s.w / 2, 0, s.h, B, zf, 0.006);
    const yc = s.h / 2;
    const { xs, cee } = places(s.w);
    xs.forEach((x, i) => {
      if (cee && i === xs.length - 1) socket400(p, x, yc, zf, s.d / 2, CEE);
      else socket230(p, x, yc, zf, s.d / 2, LID);
    });
    // A small indicator light under the sockets.
    p.plate("glassDark", -0.01, 0.01, 0.012, 0.024, zf - 0.001, zf + 0.002, 0.003);
  },
};
