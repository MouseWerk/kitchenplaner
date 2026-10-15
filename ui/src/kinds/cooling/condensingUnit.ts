// Condensing unit (Kälteaggregat, Verflüssigungssatz) of a cold room or a remote refrigerated
// counter, set up outside the kitchen (yard, roof, plant room): a painted housing on base rails
// with the axial fans blowing out of the front, the coil behind the back's louvres, and the
// service panel with the main switch and the pipe connections at the right end.

import { BODY_RADIUS, roundedRectOutline, type Parts, type Point2 } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { m } from "./common";

/** Width from which the unit has two fans (mm), the service strip at the right (mm). */
const TWO_FANS_FROM = 1200;
const SERVICE_MM = 240;
/** Height of the base rails (m), edge radius of the housing (m). */
const RAIL = 0.06;
const HOUSING_R = 0.008;
/** Fan guard: concentric rings, radial wires and the wire radius (m). */
const RINGS = 4;
const SPOKES = 8;
const WIRE_R = 0.002;
/** Fan blades. */
const BLADES = 5;
/**
 * Depth of the venturi ring behind the face (the front panel is as thick, the fans set into it),
 * and of the zone in front of the face taken by the guards and the switch box (m).
 */
const VENTURI = 0.07;
const FACE = 0.03;

const fansOf = (width: number) => (width >= TWO_FANS_FROM ? 2 : 1);

/** Fan centres and radius in the item frame (mm): x of each, height and radius. */
function fanLayout(width: number, height: number) {
  const n = fansOf(width);
  const span = width - SERVICE_MM;
  const r = Math.min(260, (height - RAIL * 1000 - 120) / 2, span / n / 2 - 50);
  const xs = Array.from({ length: n }, (_, i) => -width / 2 + (span * (i + 0.5)) / n);
  return { xs, y: RAIL * 1000 + (height - RAIL * 1000) / 2, r };
}

/**
 * One fan behind the front face at `zf`: the flared venturi ring standing in the face's hole, the
 * dark duct behind, the blades on the hub, and the guard over the opening.
 */
function fan(p: Parts, x: number, y: number, r: number, zf: number): void {
  const lip = 0.012;
  p.lathe(
    "paintGray",
    x,
    y,
    zf - VENTURI,
    [
      [r, 0],
      [r + 0.01, 0],
      [r + 0.01, VENTURI - lip],
      [r + 0.035, VENTURI],
      [r + 0.035, VENTURI + 0.004],
      [r + 0.02, VENTURI + 0.004],
      [r, VENTURI - lip * 0.5],
      [r, 0],
    ],
    { axis: "z" },
  );
  p.lathe("slot", x, y, zf - VENTURI, [
    [0, 0],
    [r + 0.005, 0],
    [r + 0.005, 0.002],
    [0, 0.002],
  ], { axis: "z" });
  // Hub and blades, set back in the venturi.
  p.lathe("steelDark", x, y, zf - VENTURI + 0.002, [
    [0, 0],
    [r * 0.2, 0],
    [r * 0.2, 0.02],
    [r * 0.14, 0.035],
    [0, 0.04],
  ], { axis: "z" });
  for (let i = 0; i < BLADES; i++) {
    const a = (i / BLADES) * Math.PI * 2;
    const len = r * 0.74;
    const b = p.box("steelDark", -len / 2, len / 2, -r * 0.15, r * 0.15, -0.002, 0.002);
    b.rotation.set(0.4 * -Math.sin(a), 0.4 * Math.cos(a), a, "ZXY");
    b.position.set(x + Math.cos(a) * (r * 0.2 + len / 2), y + Math.sin(a) * (r * 0.2 + len / 2), zf - VENTURI + 0.03);
  }
  // The guard: concentric wire rings and the spokes across them, over the lip.
  const zg = zf + 0.008;
  for (let k = 1; k <= RINGS; k++) {
    const rc = ((r + 0.02) * k) / RINGS;
    const steps = 8;
    p.lathe(
      "wire",
      x,
      y,
      zg,
      Array.from({ length: steps + 1 }, (_, j) => {
        const t = Math.PI - (j / steps) * Math.PI * 2;
        return [rc + WIRE_R * Math.cos(t), WIRE_R * Math.sin(t), Math.cos(t), Math.sin(t)] as const;
      }),
      { axis: "z", segments: 32 },
    );
  }
  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * Math.PI * 2;
    p.bar("wire", { x: x + Math.cos(a) * r * 0.08, y: y + Math.sin(a) * r * 0.08, z: zg }, { x: x + Math.cos(a) * (r + 0.02), y: y + Math.sin(a) * (r + 0.02), z: zg }, WIRE_R);
  }
}

export const condensingUnit: KindDef = {
  kind: "condensingUnit",
  plan(s) {
    const { xs, r } = fanLayout(s.w, s.item.height);
    // The fans in the front, seen from above as their venturi rings; the service strip at the right.
    for (const x of xs) s.line("detail", [x - r, s.F - INSET], [x + r, s.F - INSET]);
    s.line("detail", [s.R - SERVICE_MM, s.B], [s.R - SERVICE_MM, s.F]);
    s.line("hidden", [s.L + INSET, s.B + INSET], [s.R - SERVICE_MM - INSET, s.B + INSET]);
  },
  elevation(f) {
    const { l, z0, top } = f;
    const c = (f.l + f.r) / 2;
    const { xs, y, r } = fanLayout(f.w, f.item.height);
    for (const x of xs) {
      f.circle("detail", c + x, z0 + y, r + 40);
      f.circle("detail", c + x, z0 + y, r);
      f.circle("detail", c + x, z0 + y, r * 0.2);
    }
    f.line("detail", [f.r - SERVICE_MM, z0 + RAIL * 1000], [f.r - SERVICE_MM, top]);
    f.line("detail", [l, z0 + RAIL * 1000], [f.r, z0 + RAIL * 1000]);
    f.box("detail", f.r - SERVICE_MM + 60, f.r - 60, top - 300, top - 120, "item-dark");
  },
  mesh(p, s) {
    const zf = s.d / 2 - FACE;
    // Base rails under the front and the back, the housing on them: its body and the front panel
    // with the fan openings.
    for (const z of [-s.d / 2 + 0.03, zf - 0.04]) p.roundedBox("steelDark", -s.w / 2, s.w / 2, 0, RAIL, z - 0.03, z + 0.03, BODY_RADIUS, "vertical", "x");
    p.roundedBox("paintGray", -s.w / 2, s.w / 2, RAIL, s.h, -s.d / 2, zf - VENTURI, HOUSING_R);
    const { xs, y, r } = fanLayout(s.w * 1000, s.h * 1000);
    const outline: Point2[] = [
      [-s.w / 2 + 0.002, RAIL + 0.002],
      [s.w / 2 - 0.002, RAIL + 0.002],
      [s.w / 2 - 0.002, s.h - 0.002],
      [-s.w / 2 + 0.002, s.h - 0.002],
    ];
    // The openings are polygons of 16 sides: wide enough that their flats clear the venturi.
    const hr = m(r) + 0.02;
    const holes = xs.map((x) => roundedRectOutline(m(x) - hr, m(x) + hr, m(y) - hr, m(y) + hr, hr));
    p.extrude("paintGray", "z", zf - VENTURI - 0.002, zf, outline, holes);
    for (const x of xs) fan(p, m(x), m(y), m(r), zf);
    // The service panel: a door with louvres, the switch box with the main switch over it, and
    // the service valves of the suction and the liquid line under it.
    const x0 = s.w / 2 - m(SERVICE_MM);
    const xc = x0 + m(SERVICE_MM) / 2;
    p.plate("paintGray", x0 + 0.01, s.w / 2 - 0.01, RAIL + 0.03, s.h - 0.03, zf, zf + 0.003, 0.004, true);
    for (let i = 0; i < 6; i++) p.plate("slot", x0 + 0.05, s.w / 2 - 0.05, RAIL + 0.14 + i * 0.03, RAIL + 0.152 + i * 0.03, zf + 0.0025, zf + 0.0035, 0.005);
    const by0 = s.h - m(300);
    const by1 = s.h - m(120);
    p.roundedBox("panel", x0 + 0.06, s.w / 2 - 0.06, by0, by1, zf + 0.003, zf + 0.012, 0.004, "top", "z");
    p.knob(xc, (by0 + by1) / 2, zf + 0.012, s.d / 2, 0.025);
    for (const dx of [-0.04, 0.04]) {
      p.lathe("satin", xc + dx, RAIL + 0.07, zf + 0.003, [
        [0, 0],
        [0.014, 0],
        [0.014, 0.01],
        [0.01, 0.013],
        [0.01, 0.023],
        [0.008, 0.026],
        [0, 0.026],
      ], { axis: "z" });
    }
  },
};
