// Boiling kettle (Kochkessel): a round vessel on legs in front of a control column, a lid hinged
// at the back and a draw-off tap at the front. Heated directly (`kettle`) or indirectly through a
// water jacket (`kettleIndirect`, with a pressure gauge and a safety valve on the column).

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";

/** Room the draw-off tap takes in front of the vessel (m). */
const TAP_REACH = 0.09;
/** Height of the legs under the vessel (m). */
const LEGS = 0.15;
/** Lid thickness and the rim ring under it (m). */
const LID = 0.02;
const RIM = 0.015;
/** Least room beside the vessel for the control panel on the column (m). */
const PANEL_ROOM = 0.06;

/** Where the parts of a kettle go, from its size (m). */
function layout(s: Size) {
  const col = Math.min(0.22, s.d * 0.25);
  const r = Math.max(0.05, Math.min(s.w / 2 - 0.03, (s.d - col - TAP_REACH) / 2 - 0.01));
  // The vessel stands as far forward as the tap allows.
  const cz = s.d / 2 - TAP_REACH - 0.01 - r;
  const rim = s.h - LID - 0.01;
  return { col, r, cz, rim };
}

function makeKettle(kind: string, indirect: boolean): KindDef {
  return {
    kind,
    plan(s) {
      const m = layout({ w: s.w / 1000, d: s.d / 1000, h: s.item.height / 1000 });
      const col = m.col * 1000;
      const r = m.r * 1000;
      const cz = m.cz * 1000;
      s.line("detail", [s.L, s.B + col], [s.R, s.B + col]);
      s.circle("detail", 0, cz, r);
      if (indirect) s.circle("detail", 0, cz, r * 0.92);
      // The draw-off tap at the front.
      s.rect("detail", -20, cz + r, 20, s.F);
    },
    elevation(f) {
      const m = layout({ w: f.w / 1000, d: f.item.depth / 1000, h: f.item.height / 1000 });
      const cx = (f.l + f.r) / 2;
      const r = m.r * 1000;
      const z0 = f.z0;
      const legs = z0 + LEGS * 1000;
      const rim = z0 + m.rim * 1000;
      f.line("detail", [cx - r * 0.6, z0], [cx - r * 0.6, legs]);
      f.line("detail", [cx + r * 0.6, z0], [cx + r * 0.6, legs]);
      f.box("detail", cx - r, cx + r, legs, rim);
      f.box("detail", cx - r, cx + r, rim, f.top - 10);
      // The draw-off tap and its lever.
      f.box("detail", cx - 25, cx + 25, legs + 30, legs + 80);
      f.line("detail", [cx, legs + 80], [cx, legs + 160]);
      const room = f.r - (cx + r);
      if (room >= PANEL_ROOM * 1000) {
        const px = cx + r + room / 2;
        f.box("detail", cx + r + 20, f.r - 20, f.top - 350, f.top - 30, "item-dark");
        f.circle("detail", px, f.top - 120, Math.min(25, room / 4));
        f.circle("detail", px, f.top - 250, Math.min(25, room / 4));
        if (indirect) f.circle("detail", cx - r - room / 2, f.top - 150, Math.min(40, room / 3));
      }
    },
    mesh(p, s) {
      const { col, r, cz, rim } = layout(s);
      // The control column at the back.
      p.box("steel", -s.w / 2, s.w / 2, 0.012, s.h, -s.d / 2, -s.d / 2 + col);
      p.box("rubber", -s.w / 2 + 0.02, s.w / 2 - 0.02, 0, 0.012, -s.d / 2 + 0.02, -s.d / 2 + col - 0.02);
      const zCol = -s.d / 2 + col;
      // The vessel on its legs; an indirect one in its water jacket.
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = sx * r * 0.6;
        const z = cz + sz * r * 0.6;
        p.cyl("steelDark", x, z, 0.012, LEGS, 0.02);
        p.cyl("rubber", x, z, 0, 0.012, 0.03);
      }
      p.cyl("steel", 0, cz, LEGS, rim - RIM, r);
      if (indirect) p.cyl("steel", 0, cz, LEGS, LEGS + (rim - LEGS) * 0.75, r * 1.03);
      p.cyl("steelDark", 0, cz, LEGS - 0.02, LEGS, r * 0.8);
      p.cyl("handle", 0, cz, rim - RIM, rim, r * 1.04);
      // The lid, hinged on the column, with its handle bar at the front.
      p.cyl("steel", 0, cz, rim, s.h - 0.01, r);
      p.cyl("steelDark", 0, cz, s.h - 0.01, s.h - 0.006, r * 0.15);
      p.box("steelDark", -r * 0.4, r * 0.4, rim, s.h - 0.012, zCol, cz - r * 0.9);
      p.rod("handle", "x", 0, s.h - 0.016, cz + r * 0.85, r * 0.6, 0.008);
      for (const sx of [-1, 1]) p.box("handle", sx * r * 0.3 - 0.006, sx * r * 0.3 + 0.006, rim + 0.004, s.h - 0.016, cz + r * 0.8, cz + r * 0.85);
      // The draw-off tap at the bottom front, its lever pointing up.
      const ty = LEGS + 0.06;
      const zt = s.d / 2;
      p.rod("handle", "z", 0, ty, (cz + r - 0.01 + zt - 0.03) / 2, zt - 0.03 - (cz + r - 0.01), 0.025);
      p.cyl("handle", 0, zt - 0.025, ty - 0.06, ty, 0.015);
      p.box("knob", -0.01, 0.01, ty + 0.02, ty + 0.12, zt - 0.06, zt - 0.04);
      p.rod("handle", "z", 0, ty, zt - 0.015, 0.03, 0.03);
      // The control panel on the column beside the vessel, if there is room.
      const room = s.w / 2 - r;
      if (room >= PANEL_ROOM) {
        const px = r + room / 2;
        p.box("panelDark", r + 0.02, s.w / 2 - 0.02, s.h - 0.35, s.h - 0.03, zCol, zCol + 0.002);
        p.knob(px, s.h - 0.12, zCol + 0.002, zCol + 0.03, Math.min(0.022, room / 4));
        p.knob(px, s.h - 0.25, zCol + 0.002, zCol + 0.03, Math.min(0.022, room / 4));
        p.rod("zone", "z", px, s.h - 0.32, zCol + 0.006, 0.008, 0.006);
        if (indirect) {
          // Pressure gauge and safety valve of the water jacket on the left.
          const gx = -px;
          const gr = Math.min(0.04, room / 3);
          p.rod("steel", "z", gx, s.h - 0.15, zCol + 0.01, 0.02, gr);
          p.rod("panel", "z", gx, s.h - 0.15, zCol + 0.021, 0.002, gr * 0.85);
          p.box("handle", gx - 0.002, gx + 0.002, s.h - 0.15, s.h - 0.15 + gr * 0.7, zCol + 0.022, zCol + 0.024);
          p.cyl("handle", gx, zCol + 0.03, s.h - 0.3, s.h - 0.22, 0.015);
          p.rod("handle", "z", gx, s.h - 0.26, zCol + 0.015, 0.03, 0.01);
        }
      }
    },
  };
}

export const kettle = makeKettle("kettle", false);
export const kettleIndirect = makeKettle("kettleIndirect", true);
