// Media column (Versorgungssäule): a stainless column hanging from the ceiling over a cooking
// island or a work table, carrying the power and water down to it: two water valves at the
// bottom, sockets and a 400 V socket above them, the ceiling plate at the top.

import { BODY_RADIUS } from "../parts/mesh";
import type { KindDef } from "../types";
import { angleValve } from "./pipes";
import { socket230, socket400 } from "./sockets";

// Sizes (m).
/** Height of the ceiling plate and how far it stands out round the column. */
const CEILING = 0.03;
const COLLAR = 0.03;
/** Water valves and the lowest socket above the column's lower end, and the sockets' pitch. */
const VALVES_Y = 0.08;
const SOCKETS_Y = 0.2;
const SOCKET_PITCH = 0.085;
/** How far the sockets stand out of the column's face. */
const PROUD = 0.02;

export const mediaColumn: KindDef = {
  kind: "mediaColumn",
  placement: "overhead",
  plan(s) {
    const c = COLLAR * 1000;
    s.rect("overhead", s.L + c, s.B + c, s.R - c, s.F - c - PROUD * 1000);
  },
  elevation(f) {
    const c = COLLAR * 1000;
    f.line("detail", [f.l + c, f.top - CEILING * 1000], [f.r - c, f.top - CEILING * 1000]);
    const xc = (f.l + f.r) / 2;
    for (let k = 0; k < 3; k++) {
      const z = f.z0 + (SOCKETS_Y + k * SOCKET_PITCH) * 1000;
      f.box("detail", xc - 28, xc + 28, z - 28, z + 28);
    }
  },
  mesh(p, s) {
    const W = s.w / 2 - COLLAR;
    const D = s.d / 2 - COLLAR;
    const zf = D - PROUD;
    // The column, the ceiling plate round its top and the end cap at its lower end.
    p.roundedBox("steel", -W, W, 0.012, s.h - CEILING, -D, zf, BODY_RADIUS * 4, "vertical");
    p.roundedBox("steelDark", -W + 0.005, W - 0.005, 0, 0.012, -D + 0.005, zf - 0.005, BODY_RADIUS * 2);
    p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - CEILING, s.h, -s.d / 2, s.d / 2, 0.004);
    // On the front: the water valves at the bottom, three sockets and the 400 V socket above.
    for (const sx of [-1, 1]) angleValve(p, sx * Math.min(0.06, W - 0.03), VALVES_Y, zf, D, 0.012, sx < 0 ? "cold" : "hot");
    for (let k = 0; k < 3; k++) socket230(p, 0, SOCKETS_Y + k * SOCKET_PITCH, zf, D, 0.056);
    socket400(p, 0, SOCKETS_Y + 3 * SOCKET_PITCH + 0.01, zf, D, 0.03);
  },
};
