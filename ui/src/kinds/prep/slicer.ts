// Slicer (Aufschnittmaschine), a table-top unit: a base with the motor housing at the right, the
// round blade in its guard ring inclined over it (a gravity slicer: the blade faces up to the
// left and a little to the front), the carriage with the product tray and pusher at the left, the
// thickness knob at the front. Stands on a work table (`tableTop`). The plan and the front
// elevation draw the blade as the 3D model's disc seen from above and from the front, so all
// three views agree.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, mLine, pRect } from "./common";

type V3 = readonly [number, number, number];

/** Inclination of the blade from upright and its turn towards the front (radians). */
const TILT = (40 * Math.PI) / 180;
const TURN = (25 * Math.PI) / 180;
/** The blade's normal: to the carriage at the left, up, and a little to the front. */
const N: V3 = [-Math.cos(TILT) * Math.cos(TURN), Math.sin(TILT), Math.cos(TILT) * Math.sin(TURN)];
/**
 * Two directions in the blade's plane, as `Parts.bar` lays a disc: `ACROSS` level, `SLOPE` the
 * line of steepest slope. The disc's outline is centre + r (cos a ACROSS + sin a SLOPE).
 */
const ACROSS: V3 = (() => {
  const l = Math.hypot(N[0], N[2]);
  return [N[2] / l, 0, -N[0] / l];
})();
const SLOPE: V3 = [ACROSS[1] * N[2] - ACROSS[2] * N[1], ACROSS[2] * N[0] - ACROSS[0] * N[2], ACROSS[0] * N[1] - ACROSS[1] * N[0]];
/** Thickness of the guard ring, the blade and the centre cover along the normal (m). */
const RING_T = 0.012;
const BLADE_T = 0.004;
const COVER_T = 0.008;
/** Radius of the hub that carries the blade out of the motor housing (m). */
const HUB = 0.035;

/** Points of the outline of a disc of radius `r` round `c`, shifted by `t` along the normal. */
function disc(c: V3, r: number, t = 0, n = 32): V3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const [ca, sa] = [Math.cos(a) * r, Math.sin(a) * r];
    return [0, 1, 2].map((k) => c[k] + ca * ACROSS[k] + sa * SLOPE[k] + t * N[k]) as unknown as V3;
  });
}

/** Where the parts of a slicer of the given size lie (m, item frame). */
function layout({ w, d, h }: Size) {
  const baseTop = MACHINE_FOOT + h * 0.16;
  const baseFront = d / 2 - 0.025;
  const ring = Math.min(h * 0.38, d * 0.3, w * 0.32);
  const r = ring - 0.012;
  // The guard ring's highest point is the unit's height: the disc reaches its radius times the
  // slope's rise above the centre (as the bounding box of `Parts.bar` counts it).
  const c: V3 = [w * 0.12, h - Math.abs(SLOPE[1]) * ring, 0];
  // Both faces of the guard ring and the blade: the tray stays left of them, the housing right
  // of and below them.
  const rim = [...disc(c, ring, -RING_T), ...disc(c, ring, BLADE_T)];
  const ty = c[1] - ring * 0.5;
  const tx1 = Math.min(...rim.filter((p) => p[1] > ty - 0.01).map((p) => p[0])) - 0.02;
  const tray = { x0: -w / 2 + 0.03, x1: tx1, y: ty, z0: -ring * 0.9, z1: ring * 0.9 };
  const hy1 = c[1] - 0.015;
  const hx0 = Math.max(c[0] + 0.01, ...rim.filter((p) => p[1] < hy1 + 0.01).map((p) => p[0] + 0.01));
  const housing = { x0: hx0, x1: w / 2 - 0.02, y1: hy1, z0: -ring, z1: ring * 0.5 };
  return { baseTop, baseFront, r, ring, c, tray, housing };
}

export const slicer: KindDef = {
  kind: "slicer",
  placement: "tableTop",
  plan(s) {
    const { w, d } = metres(s.item);
    const { ring, c, tray, housing } = layout(metres(s.item));
    // The inclined blade seen from above, the motor housing under it, the carriage at the left.
    s.line("detail", ...disc(c, ring).map(([x, , z]): [number, number] => [x * 1000, z * 1000]));
    pRect(s, "detail", housing.x0, housing.z0, housing.x1, housing.z1);
    pRect(s, "detail", tray.x0, tray.z0, tray.x1, tray.z1);
    pRect(s, "detail", -w / 2 + 0.05, d / 2 - 0.025, -w / 2 + 0.11, d / 2);
  },
  elevation(f) {
    const s = metres(f.item);
    const { baseTop, ring, c, r, tray, housing } = layout(s);
    mBox(f, "detail", -s.w / 2, s.w / 2, MACHINE_FOOT, baseTop);
    mBox(f, "detail", housing.x0, housing.x1, baseTop, housing.y1);
    // The blade seen from the front: the guard ring and the centre cover as ellipses.
    mLine(f, ...disc(c, ring).map(([x, y]): [number, number] => [x, y]));
    mLine(f, ...disc(c, r * 0.45, BLADE_T).map(([x, y]): [number, number] => [x, y]));
    mBox(f, "detail", tray.x0, tray.x1, tray.y, tray.y + 0.008);
    mLine(f, [tray.x0 + 0.04, tray.y + r * 0.6], [tray.x1 - 0.02, tray.y + r * 0.6]);
    mCircle(f, -s.w / 2 + 0.08, (MACHINE_FOOT + baseTop) / 2, 0.03);
  },
  mesh(p, s) {
    const { w, d } = s;
    const { baseTop, baseFront, r, ring, c, tray, housing } = layout(s);
    machineFeet(p, -w / 2, w / 2, -d / 2, baseFront);
    p.box("steel", -w / 2, w / 2, MACHINE_FOOT, baseTop, -d / 2, baseFront);
    // Motor housing under the blade, and the hub carrying the blade out of it.
    p.box("steel", housing.x0, housing.x1, baseTop, housing.y1, housing.z0, housing.z1);
    const at = (t: number) => ({ x: c[0] + N[0] * t, y: c[1] + N[1] * t, z: c[2] + N[2] * t });
    p.bar("steelDark", at(-RING_T), at(-RING_T - 0.05), HUB);
    // Guard ring, the bright blade in front of it and the centre cover, all in the blade's
    // inclined plane.
    p.bar("steelDark", at(-RING_T), at(0), ring);
    p.bar("handle", at(0), at(BLADE_T), r);
    p.bar("steelDark", at(BLADE_T), at(BLADE_T + COVER_T), r * 0.45);
    // Carriage: a slide column, the tray, the side plate and the pusher with its knob.
    const cx = (tray.x0 + tray.x1) / 2;
    p.box("steelDark", cx - 0.03, cx + 0.03, baseTop, tray.y, -0.03, 0.03);
    p.box("steel", tray.x0, tray.x1, tray.y, tray.y + 0.008, tray.z0, tray.z1);
    p.box("steel", tray.x0, tray.x1, tray.y, tray.y + r * 0.35, tray.z0, tray.z0 + 0.006);
    p.box("steelDark", tray.x0 + 0.02, tray.x1 - 0.02, tray.y + r * 0.55, tray.y + r * 0.6, -0.015, 0.015);
    p.cyl("knob", tray.x0 + 0.04, 0, tray.y + r * 0.6, tray.y + r * 0.6 + 0.05, 0.018);
    // Thickness knob at the front left, start and stop buttons at the front right.
    p.knob(-w / 2 + 0.08, (MACHINE_FOOT + baseTop) / 2, baseFront, d / 2, 0.03);
    const yb = (MACHINE_FOOT + baseTop) / 2;
    p.box("handle", w / 2 - 0.13, w / 2 - 0.1, yb - 0.012, yb + 0.012, baseFront, baseFront + 0.008);
    p.box("knob", w / 2 - 0.09, w / 2 - 0.06, yb - 0.012, yb + 0.012, baseFront, baseFront + 0.008);
  },
};
