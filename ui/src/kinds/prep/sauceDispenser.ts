// Sauce dispenser with pumps (Saucenspender mit Dosierpumpen), a table-top unit: a stainless
// station holding three containers in its top, each with a pump head whose spout reaches over
// the drip grid at the front.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { mBox, metres, pCircle, pRect } from "./common";
import { housing } from "../parts/details";

/** Number of pumps, the station's height and the containers' height above it (m). */
const PUMPS = 3;
const STATION = 0.12;
const SPOUT_R = 0.006;

function layout({ w, d, h }: Size) {
  const pitch = w / PUMPS;
  const r = Math.min(0.065, pitch / 2 - 0.012, (d - 0.08) / 2 - 0.01);
  const zc = -d / 2 + 0.012 + r;
  const xs = Array.from({ length: PUMPS }, (_, i) => -w / 2 + pitch * (i + 0.5));
  const jarTop = h - 0.075;
  return { r, zc, xs, jarTop };
}

export const sauceDispenser: KindDef = {
  kind: "sauceDispenser",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { r, zc, xs } = layout(m);
    for (const x of xs) {
      pCircle(s, "detail", x, zc, r);
      pRect(s, "detail", x - 0.008, zc, x + 0.008, m.d / 2 - 0.03);
    }
    pRect(s, "detail", -m.w / 2 + 0.02, m.d / 2 - 0.07, m.w / 2 - 0.02, m.d / 2 - 0.01);
  },
  elevation(f) {
    const m = metres(f.item);
    const { r, xs, jarTop } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, 0, STATION);
    for (const x of xs) {
      mBox(f, "detail", x - r, x + r, STATION, jarTop);
      mBox(f, "detail", x - 0.02, x + 0.02, jarTop, m.h);
    }
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { r, zc, xs, jarTop } = layout(s);
    housing(p, "steel", -w / 2, w / 2, 0, STATION, -d / 2, d / 2, 0.01);
    // The drip grid in a dark well at the front.
    const g = { x0: -w / 2 + 0.02, x1: w / 2 - 0.02, z0: d / 2 - 0.07, z1: d / 2 - 0.01 };
    p.box("slot", g.x0, g.x1, STATION - 0.001, STATION + 0.0005, g.z0, g.z1);
    p.grid(g.x0, g.x1, STATION + 0.0005, STATION + 0.0045, g.z0, g.z1, 0.012, "z");
    for (const x of xs) {
      // The container with its rolled rim, the pump's turned head, its spout and the plunger.
      p.lathe("steel", x, STATION - 0.002, zc, [
        [0, 0],
        [r, 0],
        [r, jarTop - STATION - 0.004],
        [r - 0.004, jarTop - STATION + 0.002],
        [0, jarTop - STATION + 0.002],
      ]);
      p.lathe("satin", x, jarTop, zc, [
        [0, 0],
        [r * 0.7, 0],
        [r * 0.7, 0.012],
        [0.022, 0.03],
        [0.022, 0.045],
        [0, 0.045],
      ]);
      const sy = jarTop + 0.035;
      p.tube("handle", [{ x, y: sy, z: zc }, { x, y: sy, z: d / 2 - 0.04 }, { x, y: sy - 0.035, z: d / 2 - 0.04 }], SPOUT_R, { bend: 0.015 });
      p.lathe("knob", x, jarTop + 0.045, zc, [
        [0, 0],
        [0.008, 0],
        [0.008, h - jarTop - 0.06],
        [0.02, h - jarTop - 0.055],
        [0.022, h - jarTop - 0.05],
        [0.02, h - jarTop - 0.045],
        [0, h - jarTop - 0.045],
      ]);
    }
  },
};
