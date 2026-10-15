// A disc tilted in space (a slicer's blade, an inclined bowl): the directions in its plane as
// `Parts.bar` lays a disc, and its outline, so the plan and the elevations can draw exactly the
// disc the 3D model shows. Item frame, metres.

export type V3 = readonly [number, number, number];

/** A tilted disc's normal `n` and the two directions in its plane. */
export interface DiscFrame {
  n: V3;
  /** Level, across the line of steepest slope (the x axis `Parts.bar` gives a bar). */
  across: V3;
  /** The line of steepest slope in the disc's plane. */
  slope: V3;
}

/** The frame of a disc with the unit normal `n` (not upright: n must not be vertical). */
export function discFrame(n: V3): DiscFrame {
  const l = Math.hypot(n[0], n[2]);
  const across: V3 = [n[2] / l, 0, -n[0] / l];
  const slope: V3 = [across[1] * n[2] - across[2] * n[1], across[2] * n[0] - across[0] * n[2], across[0] * n[1] - across[1] * n[0]];
  return { n, across, slope };
}

/**
 * Points of the outline of a disc of radius `r` round `c` in the frame `f`, shifted by `t` along
 * the normal, `segments` steps round (the first point repeated at the end): centre + r (cos a
 * across + sin a slope).
 */
export function discOutline(f: DiscFrame, c: V3, r: number, t = 0, segments = 32): V3[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    const [ca, sa] = [Math.cos(a) * r, Math.sin(a) * r];
    return [0, 1, 2].map((k) => c[k] + ca * f.across[k] + sa * f.slope[k] + t * f.n[k]) as unknown as V3;
  });
}
