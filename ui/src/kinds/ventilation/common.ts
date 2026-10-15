// Parts the ventilation units share: pressed housings, slot rows and perforations, round duct
// spigots, flanges with their bolts, latches and the small control boxes of hoods and fans. 3D
// sizes are metres.

import type { MaterialId, Parts } from "../parts/mesh";

/** Radius of a pressed housing's edges (m), as on fan boxes and control boxes. */
export const PRESSED = 0.008;
/** Wall of a round spigot as drawn (m). */
const SPIGOT_WALL = 0.003;

/**
 * Rows of slots in an upright face at `zFace` (either side): `n` slots with round ends across
 * x0..x1, spread over y0..y1, a millimetre thick, half of it in the face.
 */
export function slotRows(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number, n: number): void {
  const pitch = (y1 - y0) / n;
  const sh = Math.min(0.01, pitch * 0.5);
  const z0 = zFace - 0.0005;
  for (let i = 0; i < n; i++) {
    const y = y0 + pitch * (i + 0.5);
    p.plate("slot", x0, x1, y - sh / 2, y + sh / 2, z0, z0 + 0.001, sh / 2);
  }
}

/**
 * Slots in a level face (an underside or a top) at height `y`: `n` slots along z from z0 to z1,
 * spread over x0..x1, a millimetre thick, half of it in the face.
 */
export function levelSlots(p: Parts, x0: number, x1: number, z0: number, z1: number, y: number, n: number, width = 0.01): void {
  const pitch = (x1 - x0) / n;
  const sw = Math.min(width, pitch * 0.5);
  for (let i = 0; i < n; i++) {
    const x = x0 + pitch * (i + 0.5);
    p.roundedBox("slot", x - sw / 2, x + sw / 2, y - 0.0005, y + 0.0005, z0, z1, sw / 2, "vertical");
  }
}

/**
 * A round duct spigot standing on a face, from `y0` up by `rise` (along +y), radius `r`: a flange
 * on the face, the spigot with a bead and its open mouth, dark inside.
 */
export function spigotUp(p: Parts, x: number, y0: number, z: number, r: number, rise: number, mat: MaterialId = "steel"): void {
  p.lathe("steelDark", x, y0, z, [
    [0, 0],
    [r + 0.02, 0],
    [r + 0.02, 0.005],
    [r + 0.012, 0.008],
    [0, 0.008],
  ]);
  p.lathe(mat, x, y0, z, [
    [0, 0],
    [r, 0],
    [r, rise - 0.03],
    [r + 0.004, rise - 0.026],
    [r, rise - 0.022],
    [r, rise],
    [r - SPIGOT_WALL, rise],
    [r - SPIGOT_WALL, rise - 0.04],
    [0, rise - 0.04],
  ]);
  p.cyl("slot", x, z, y0 + rise - 0.04, y0 + rise - 0.039, r - SPIGOT_WALL);
}

/**
 * A round spigot on an end face along x: from `x0` out by `len` in the direction `dir` (+1: to
 * +x), its axis at (y, z), radius `r`, with a flange on the face and a bead near its mouth.
 */
export function spigotSide(p: Parts, x0: number, y: number, z: number, r: number, len: number, dir: 1 | -1): void {
  const profile: [number, number][] = [
    [0, 0],
    [r + 0.02, 0],
    [r + 0.02, 0.006],
    [r, 0.01],
    [r, len - 0.03],
    [r + 0.004, len - 0.026],
    [r, len - 0.022],
    [r, len],
    [r - SPIGOT_WALL, len],
    [r - SPIGOT_WALL, len - 0.03],
    [0, len - 0.03],
  ];
  const m = p.lathe("steel", x0, y, z, profile, { axis: "x" });
  if (dir < 0) m.rotation.z = Math.PI / 2;
}

/**
 * A latch of an access door on a face at `zFace` (facing +z): a turned base and a lever, standing
 * out by at most `depth`.
 */
export function latch(p: Parts, x: number, y: number, zFace: number, depth = 0.012): void {
  p.lathe(
    "satin",
    x,
    y,
    zFace,
    [
      [0, 0],
      [0.012, 0],
      [0.012, depth * 0.3],
      [0.008, depth * 0.5],
      [0, depth * 0.5],
    ],
    { axis: "z" },
  );
  p.roundedBox("knob", x - 0.005, x + 0.005, y - 0.025, y + 0.005, zFace + depth * 0.5, zFace + depth, 0.003, "top", "z");
}

/** A row of bolt heads on a face facing +z at `zFace`, from x0 to x1 at height y, every `pitch` or so. */
export function boltRow(p: Parts, x0: number, x1: number, y: number, zFace: number, pitch = 0.15): void {
  const n = Math.max(1, Math.round((x1 - x0) / pitch));
  for (let i = 0; i <= n; i++) {
    p.lathe(
      "satin",
      x0 + ((x1 - x0) * i) / n,
      y,
      zFace,
      [
        [0, 0],
        [0.006, 0],
        [0.006, 0.002],
        [0.004, 0.003],
        [0, 0.003],
      ],
      { axis: "z" },
    );
  }
}

/**
 * A small control box on a face at `zFace` (facing +z): a pressed box with a display, two keys
 * and a pilot lamp, from x0..x1 and y0..y1, standing out to `zFront`.
 */
export function controlBox(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number, zFront: number): void {
  const t = zFront - zFace;
  const zb = zFront - Math.min(0.003, t / 3);
  p.roundedBox("panelDark", x0, x1, y0, y1, zFace, zb, Math.min(PRESSED / 2, t / 3), "top", "z");
  const w = x1 - x0;
  const h = y1 - y0;
  const cy = (y0 + y1) / 2;
  p.plate("glassDark", x0 + w * 0.08, x0 + w * 0.5, cy - h * 0.2, cy + h * 0.2, zb - 0.0005, zb + 0.0005, 0.002);
  for (const k of [0.64, 0.84]) p.roundedBox("satin", x0 + w * k - h * 0.13, x0 + w * k + h * 0.13, cy - h * 0.13, cy + h * 0.13, zb - 0.0005, zFront, 0.002, "top", "z");
}
