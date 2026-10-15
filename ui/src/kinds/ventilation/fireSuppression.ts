// Fire suppression line (Löschanlage, Düsenleitung): the overhead pipe of a kitchen fire
// suppression system over the cooking line, hung from the ceiling. Drop nozzles with red blow-off
// caps point down at the appliances, a detection line with fusible links runs beside the pipe,
// and the release unit with its pull handle and pressure gauge sits at the right end.

import { INSET } from "../parts/elevation";
import type { KindDef } from "../types";
import { PRESSED } from "./common";

/** One drop nozzle per this much width (m), the pipe's radius and the nozzle's drop (m). */
const NOZZLE_PITCH = 0.6;
const PIPE_R = 0.014;
const DROP = 0.09;
/** Release unit at the right end (m): width and height. */
const RELEASE = { w: 0.22, h: 0.26 };
/** Hangers: one per this much width (m). */
const HANGER_PITCH = 1.2;

/** Centres of the nozzles along the width (m), left of the release unit. */
function nozzleXs(w: number): number[] {
  const span = w - RELEASE.w - 0.1;
  const n = Math.max(1, Math.round(span / NOZZLE_PITCH));
  return Array.from({ length: n }, (_, i) => -w / 2 + 0.05 + (span / n) * (i + 0.5));
}

function hangerXs(w: number): number[] {
  const span = w - RELEASE.w - 0.1;
  const n = Math.max(1, Math.round(span / HANGER_PITCH));
  return Array.from({ length: n + 1 }, (_, i) => -w / 2 + 0.05 + (span * i) / n);
}

export const fireSuppression: KindDef = {
  kind: "fireSuppression",
  placement: "overhead",
  plan(s) {
    s.line("overhead", [s.L, 0], [s.R - RELEASE.w * 1000, 0]);
    s.line("overhead", [s.L, s.d / 4], [s.R - RELEASE.w * 1000, s.d / 4]);
    for (const x of nozzleXs(s.w / 1000)) s.circle("overhead", x * 1000, 0, 30);
    s.rect("overhead", s.R - RELEASE.w * 1000, s.B + INSET, s.R, s.F - INSET);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const scale = f.w / f.item.width;
    const yp = z0 + DROP * 1000 + 30;
    f.line("detail", [l, yp], [r - RELEASE.w * 1000 * scale, yp]);
    for (const x of nozzleXs(f.item.width / 1000)) {
      const cx = (l + r) / 2 + x * 1000 * scale;
      f.line("detail", [cx, yp], [cx, z0 + 20]);
      f.box("detail", cx - 12, cx + 12, z0, z0 + 25);
    }
    for (const x of hangerXs(f.item.width / 1000)) {
      const cx = (l + r) / 2 + x * 1000 * scale;
      f.line("detail", [cx, yp], [cx, top]);
    }
    f.box("detail", r - RELEASE.w * 1000 * scale, r, top - RELEASE.h * 1000 - 20, top - 20, "item-dark");
  },
  elevationSide(f) {
    const { l, r, z0, top } = f;
    const cx = (l + r) / 2;
    f.circle("detail", cx, z0 + DROP * 1000 + 30, PIPE_R * 1000);
    f.line("detail", [cx, z0 + DROP * 1000 + 30], [cx, top]);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const yp = DROP + 0.03;
    const xEnd = w / 2 - RELEASE.w;
    // The pipe with a bend up into the release unit at its right end.
    p.tube(
      "satin",
      [
        { x: -w / 2 + 0.01, y: yp, z: 0 },
        { x: xEnd - 0.04, y: yp, z: 0 },
        { x: xEnd - 0.04, y: h - RELEASE.h * 0.6, z: 0 },
        { x: xEnd, y: h - RELEASE.h * 0.6, z: 0 },
      ],
      PIPE_R,
      { bend: 0.04 },
    );
    p.lathe("satin", -w / 2, yp, 0, [
      [0, 0],
      [PIPE_R * 1.3, 0],
      [PIPE_R * 1.3, 0.016],
      [0, 0.016],
    ], { axis: "x" });
    // Drop nozzles: a tee on the pipe, the drop and the nozzle with its red blow-off cap.
    for (const x of nozzleXs(w)) {
      p.lathe("satin", x, yp - PIPE_R * 1.4, 0, [
        [0, 0],
        [PIPE_R * 0.7, 0],
        [PIPE_R * 0.7, PIPE_R * 2.8],
        [0, PIPE_R * 2.8],
      ]);
      p.lathe("satin", x, 0.012, 0, [
        [0, 0],
        [0.008, 0],
        [0.014, 0.012],
        [0.014, 0.028],
        [0.008, 0.032],
        [0.007, DROP],
        [0, DROP],
      ]);
      p.lathe("signalRed", x, 0, 0, [
        [0, 0],
        [0.012, 0],
        [0.016, 0.006],
        [0.016, 0.014],
        [0, 0.014],
      ]);
    }
    // The detection line: a thin conduit towards the front with fusible link holders on it.
    const zd = Math.min(d / 4, d / 2 - 0.02);
    p.rod("steelDark", "x", (-w / 2 + 0.03 + xEnd) / 2, yp + 0.02, zd, xEnd - (-w / 2 + 0.03), 0.005);
    for (const x of nozzleXs(w)) {
      p.roundedBox("satin", x + 0.1 - 0.025, x + 0.1 + 0.025, yp + 0.005, yp + 0.035, zd - 0.012, zd + 0.012, 0.003);
      p.roundedBox("oil", x + 0.1 - 0.008, x + 0.1 + 0.008, yp - 0.002, yp + 0.006, zd - 0.006, zd + 0.006, 0.002);
    }
    // Hangers: threaded rods with their pipe clamps and ceiling plates.
    for (const x of hangerXs(w)) {
      p.rod("steelDark", "y", x, (yp + h) / 2, 0, h - yp, 0.004);
      p.lathe("steelDark", x, yp - PIPE_R - 0.004, 0, [
        [PIPE_R, 0],
        [PIPE_R + 0.004, 0],
        [PIPE_R + 0.004, 0.012],
        [PIPE_R, 0.012],
        [PIPE_R, 0],
      ], { axis: "x" }).position.x = x - 0.006;
      p.roundedBox("steelDark", x - 0.03, x + 0.03, h - 0.006, h, -0.03, 0.03, 0.003);
    }
    // The release unit: a wall-hung box with its pull handle (red), the gauge and the label;
    // its back plate reaches the depth so the line keeps its footprint.
    const rx0 = xEnd;
    const ry0 = h - RELEASE.h - 0.02;
    p.roundedBox("paintGray", rx0, w / 2, ry0, h - 0.02, -d / 2 + 0.02, d / 2 - 0.03, PRESSED);
    p.roundedBox("steelDark", rx0 + 0.02, w / 2 - 0.02, h - 0.02, h, -d / 2, d / 2, 0.003);
    p.lathe("satin", rx0 + RELEASE.w * 0.35, ry0 + RELEASE.h * 0.68, d / 2 - 0.03, [
      [0, 0],
      [0.032, 0],
      [0.032, 0.012],
      [0.028, 0.014],
      [0, 0.014],
    ], { axis: "z" });
    p.plate("panel", rx0 + RELEASE.w * 0.35 - 0.026, rx0 + RELEASE.w * 0.35 + 0.026, ry0 + RELEASE.h * 0.68 - 0.026, ry0 + RELEASE.h * 0.68 + 0.026, d / 2 - 0.017, d / 2 - 0.0155, 0.026);
    p.tube(
      "signalRed",
      [
        { x: rx0 + RELEASE.w * 0.75, y: ry0 + RELEASE.h * 0.25, z: d / 2 - 0.03 },
        { x: rx0 + RELEASE.w * 0.75, y: ry0 + RELEASE.h * 0.25, z: d / 2 - 0.008 },
        { x: rx0 + RELEASE.w * 0.75, y: ry0 + RELEASE.h * 0.55, z: d / 2 - 0.008 },
        { x: rx0 + RELEASE.w * 0.75, y: ry0 + RELEASE.h * 0.55, z: d / 2 - 0.03 },
      ],
      0.008,
      { bend: 0.012 },
    );
    p.plate("signalRed", rx0 + 0.03, rx0 + RELEASE.w * 0.55, ry0 + 0.03, ry0 + 0.08, d / 2 - 0.0305, d / 2 - 0.0295, 0.004);
  },
};
