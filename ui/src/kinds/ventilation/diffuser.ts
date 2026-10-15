// Supply air outlets. The swirl diffuser (Drallauslass) sits in the ceiling: a square face plate
// with radial slots that set the air turning, its plenum box above with a round spigot at the
// side. The displacement outlet (Quellluftauslass) stands on the floor against the wall: a half
// round, perforated front that lets the make-up air out slowly at floor level.

import { INSET } from "../parts/elevation";
import { BODY_RADIUS, foot, type Point2 } from "../parts/mesh";
import { INSET as PLAN_INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { spigotUp } from "./common";

/** Height of the face plate and its border (m), how far the slotted field is set back, the radial slots. */
const FACE = 0.02;
const RECESS = 0.005;
const BORDER = 0.04;
const SLOTS = 16;
/** The plenum box's share of the face, and the spigot's radius share of the plenum. */
const PLENUM_SHARE = 0.8;
const SPIGOT_SHARE = 0.32;

export const swirlDiffuser: KindDef = {
  kind: "swirlDiffuser",
  placement: "overhead",
  plan(s) {
    const r = Math.min(s.w, s.d) / 2 - INSET * 1.5;
    s.circle("overhead", 0, 0, r);
    s.circle("overhead", 0, 0, r * 0.3);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      s.line("overhead", [Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35], [Math.cos(a + 0.3) * r * 0.95, Math.sin(a + 0.3) * r * 0.95]);
    }
  },
  elevation(f) {
    const { l, r, z0, top, w } = f;
    const cx = (l + r) / 2;
    f.line("detail", [l, z0 + FACE * 1000], [r, z0 + FACE * 1000]);
    const pw = (w * PLENUM_SHARE) / 2;
    f.box("detail", cx - pw, cx + pw, z0 + FACE * 1000, top - (f.item.height - FACE * 1000) * 0.25);
    const sr = Math.min(w * PLENUM_SHARE * SPIGOT_SHARE, 160);
    f.box("detail", cx - sr, cx + sr, top - (f.item.height - FACE * 1000) * 0.25, top);
  },
  elevationSide(f) {
    const { l, r, z0 } = f;
    f.line("detail", [l, z0 + FACE * 1000], [r, z0 + FACE * 1000]);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    // The face plate: a square with a round opening, in it the slotted field set back a few
    // millimetres with the radial slots and the round cap in its middle.
    const r = Math.min(w, d) / 2 - BORDER;
    const circle = (rr: number): Point2[] => Array.from({ length: 48 }, (_, i) => [rr * Math.cos((i / 48) * Math.PI * 2), rr * Math.sin((i / 48) * Math.PI * 2)] as Point2);
    p.extrude(
      "panel",
      "y",
      0,
      FACE,
      [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ],
      [circle(r)],
    );
    p.lathe("paintGray", 0, RECESS, 0, [
      [0, 0],
      [r + 0.002, 0],
      [r + 0.002, 0.003],
      [0, 0.003],
    ]);
    for (let i = 0; i < SLOTS; i++) {
      const a = (i / SLOTS) * Math.PI * 2;
      const len = r * 0.5;
      const m = p.roundedBox("slot", -0.006, 0.006, -0.0005, 0.0005, -len / 2, len / 2, 0.005, "vertical");
      const rc = r * 0.64;
      m.rotation.y = -a + 0.35;
      m.position.set(Math.cos(a) * rc, RECESS, Math.sin(a) * rc);
    }
    p.lathe("panel", 0, RECESS - 0.003, 0, [
      [0, 0],
      [r * 0.24, 0],
      [r * 0.28, 0.002],
      [r * 0.28, 0.003],
      [0, 0.003],
    ]);
    // The plenum box above with its round spigot on top.
    const pw = (Math.min(w, d) * PLENUM_SHARE) / 2;
    const ph = (h - FACE) * 0.75;
    p.roundedBox("steel", -pw, pw, FACE - 0.001, FACE + ph, -pw, pw, BODY_RADIUS * 3, "top");
    spigotUp(p, 0, FACE + ph, 0, Math.min(pw * SPIGOT_SHARE * 2, 0.16), h - FACE - ph);
  },
};

/** Displacement outlet (m): the plinth height, the top cover and the perforated band's rows. */
const PLINTH_H = 0.06;
const COVER = 0.03;
const ROWS = 14;
/** Steps round the half round. */
const ARC = 16;

/**
 * The half round outline in the plan (x, z): half an ellipse of half width `rx` reaching `rz`
 * forward from (0, zc), facing +z. A square footprint twice as wide as deep makes it round.
 */
function halfRound(rx: number, rz: number, zc: number, steps = ARC): Point2[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI;
    return [rx * Math.cos(a), zc + rz * Math.sin(a)] as Point2;
  });
}

export const displacementOutlet: KindDef = {
  kind: "displacementOutlet",
  plan(s) {
    const pts = (inset: number) => halfRound(s.w / 2 - inset, s.d - inset, s.B).map(([x, z]) => [x, z] as [number, number]);
    s.line("detail", ...pts(0));
    s.line("detail", ...pts(PLAN_INSET));
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.line("detail", [l, z0 + PLINTH_H * 1000], [r, z0 + PLINTH_H * 1000]);
    f.line("detail", [l, top - COVER * 1000], [r, top - COVER * 1000]);
    for (let i = 1; i < 6; i++) {
      const z = z0 + PLINTH_H * 1000 + ((top - COVER * 1000 - z0 - PLINTH_H * 1000) * i) / 6;
      f.line("hidden", [l + INSET, z], [r - INSET, z]);
    }
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const zc = -d / 2;
    // The body: a half round on a dark plinth with feet, the cover on top.
    const outline = (inset: number) => halfRound(w / 2 - inset, d - inset, zc);
    p.extrude("steelDark", "y", PLINTH_H * 0.3, PLINTH_H, outline(0.01));
    for (const x of [-w * 0.3, w * 0.3]) foot(p, x, zc + d * 0.3, PLINTH_H * 0.3 + 0.001, 0.015);
    p.extrude("steel", "y", PLINTH_H, h - COVER, outline(0.003));
    p.extrude("steel", "y", h - COVER, h, outline(0));
    // The perforated front: dark bands round the half round, a hair proud of it.
    const y0 = PLINTH_H + 0.04;
    const y1 = h - COVER - 0.04;
    for (let i = 0; i < ROWS; i++) {
      const y = y0 + ((y1 - y0) * (i + 0.5)) / ROWS;
      const band: Point2[] = [...outline(0.0015), ...outline(0.004).reverse()];
      p.extrude("slot", "y", y - 0.003, y + 0.003, band);
    }
    // The rating plate low on the front.
    p.plate("satin", -0.04, 0.04, PLINTH_H + 0.01, PLINTH_H + 0.03, d / 2 - 0.003, d / 2 - 0.0015, 0.002);
  },
};
