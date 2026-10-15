// Geometry of the model parts beyond the unit box and cylinder: rounded boxes, turned shapes
// (lathe), rounded-rectangle pans, extruded profiles and bent tubes. Each generator builds at real
// size in metres with normals that make rounded edges catch the light, and UVs that already are
// metres on the surface (`userData.metricUv`, kept as they are by `merge.ts`). They are pure
// functions of their parameters: `shared.ts` caches the results by a key of the quantised
// parameters, so equal parts of equal items share one geometry.

import * as THREE from "three";

/**
 * A point of a lathe profile: (radius, height), optionally with its normal (radius and height
 * components). Without a normal the generator smooths the profile between segments that meet at
 * less than `CREASE` and keeps a hard edge where they meet at more.
 */
export type ProfilePoint = readonly [number, number] | readonly [number, number, number, number];
export type Profile = readonly ProfilePoint[];

/** A point of a 2D outline (extrusion profiles). */
export type Point2 = readonly [number, number];

/** Segments meeting at more than this angle keep a hard edge; less is smoothed. */
const CREASE = THREE.MathUtils.degToRad(40);
/** Lengths below this are the same point (m). */
const EPS = 1e-9;
/** Twice the area under which a triangle is degenerate (collapsed corners of a lathe) and dropped. */
const DEGENERATE = 1e-14;
/** Arc steps of a tube bend per quarter turn; half as many for bends up to `TIGHT_BEND` (m). */
const BEND_STEPS = 6;
const TIGHT_BEND = 0.01;

/** Collects vertices and triangles; every triangle is turned to face where its normals point. */
class Builder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uv: number[] = [];
  private readonly idx: number[] = [];

  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number): number {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }

  /**
   * A triangle, wound so its front faces the side its vertex normals point to: the generators
   * then need not track the winding through mirrored axes and reversed profiles. Collapsed
   * triangles (a lathe's pole, a rounded box's corner) are dropped.
   */
  tri(a: number, b: number, c: number): void {
    const p = this.pos;
    const e1x = p[b * 3] - p[a * 3];
    const e1y = p[b * 3 + 1] - p[a * 3 + 1];
    const e1z = p[b * 3 + 2] - p[a * 3 + 2];
    const e2x = p[c * 3] - p[a * 3];
    const e2y = p[c * 3 + 1] - p[a * 3 + 1];
    const e2z = p[c * 3 + 2] - p[a * 3 + 2];
    const fx = e1y * e2z - e1z * e2y;
    const fy = e1z * e2x - e1x * e2z;
    const fz = e1x * e2y - e1y * e2x;
    if (fx * fx + fy * fy + fz * fz < DEGENERATE * DEGENERATE) return;
    const n = this.nor;
    const nx = n[a * 3] + n[b * 3] + n[c * 3];
    const ny = n[a * 3 + 1] + n[b * 3 + 1] + n[c * 3 + 1];
    const nz = n[a * 3 + 2] + n[b * 3 + 2] + n[c * 3 + 2];
    if (fx * nx + fy * ny + fz * nz < 0) this.idx.push(a, c, b);
    else this.idx.push(a, b, c);
  }

  getPositions(): readonly number[] {
    return this.pos;
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setIndex(this.idx);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    // The UVs are metres already: merging must not rescale them (`merge.ts`).
    geo.userData.metricUv = true;
    return geo;
  }
}

/** One ring of a lathe: a profile point with the normal it is drawn with and its distance along the profile. */
interface Row {
  rho: number;
  y: number;
  nr: number;
  ny: number;
  v: number;
}

/** Unit normal of the profile segment a -> b (radius, height): the segment turned clockwise. */
function segmentNormal(a: ProfilePoint, b: ProfilePoint): [number, number] | null {
  const dr = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dr, dy);
  return len < EPS ? null : [dy / len, -dr / len];
}

/**
 * The smooth normal where two segments meet, weighted by their lengths: where a narrow bevel
 * meets a wide face, the face keeps nearly its own normal instead of being shaded across its
 * whole width towards the bevel's.
 */
function blend(prev: readonly [number, number] | null, lenPrev: number, next: readonly [number, number] | null, lenNext: number): [number, number] {
  const a = (prev?.[0] ?? 0) * lenPrev + (next?.[0] ?? 0) * lenNext;
  const b = (prev?.[1] ?? 0) * lenPrev + (next?.[1] ?? 0) * lenNext;
  const len = Math.hypot(a, b) || 1;
  return [a / len, b / len];
}

/** Rows of a profile: one per point, two (one per side) where it has a hard edge. */
function profileRows(profile: Profile, closed: boolean): Row[] {
  const n = profile.length;
  const seg: ([number, number] | null)[] = [];
  const segLen: number[] = [];
  for (let i = 0; i + 1 < n; i++) {
    seg.push(segmentNormal(profile[i], profile[i + 1]));
    segLen.push(Math.hypot(profile[i + 1][0] - profile[i][0], profile[i + 1][1] - profile[i][1]));
  }
  const rows: Row[] = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    const p = profile[i];
    if (i > 0) v += Math.hypot(p[0] - profile[i - 1][0], p[1] - profile[i - 1][1]);
    if (p.length === 4) {
      const len = Math.hypot(p[2], p[3]) || 1;
      rows.push({ rho: p[0], y: p[1], nr: p[2] / len, ny: p[3] / len, v });
      continue;
    }
    // A closed profile's ends are the same point: each sees the other's segment.
    const iPrev = i > 0 ? i - 1 : closed ? n - 2 : -1;
    const iNext = i < n - 1 ? i : closed ? 0 : -1;
    const prev = iPrev >= 0 ? seg[iPrev] : null;
    const next = iNext >= 0 ? seg[iNext] : null;
    if (prev && next && Math.acos(Math.max(-1, Math.min(1, prev[0] * next[0] + prev[1] * next[1]))) > CREASE) {
      rows.push({ rho: p[0], y: p[1], nr: prev[0], ny: prev[1], v });
      rows.push({ rho: p[0], y: p[1], nr: next[0], ny: next[1], v });
    } else {
      const [nr, ny] = blend(prev, segLen[iPrev] ?? 0, next, segLen[iNext] ?? 0);
      rows.push({ rho: p[0], y: p[1], nr, ny, v });
    }
  }
  return rows;
}

/** A column of a lathe: the direction round the axis and the corner centre it is drawn from. */
interface Column {
  c: number;
  s: number;
  cx: number;
  cz: number;
}

/**
 * The columns round a lathe: `segments` steps round a circle, or, with a rectangle (half sizes
 * hx, hz), a quarter circle round each of its corners joined by its straight sides. The first
 * column is repeated at the end so the UVs can run on round the seam. A step falls on every
 * quarter, so the shape's box is exact.
 */
function latheColumns(segments: number, hx: number, hz: number): Column[] {
  const cols: Column[] = [];
  if (hx < EPS && hz < EPS) {
    for (let k = 0; k <= segments; k++) {
      const a = (k / segments) * Math.PI * 2;
      cols.push({ c: Math.cos(a), s: Math.sin(a), cx: 0, cz: 0 });
    }
    return cols;
  }
  const n = segments / 4;
  const corners = [
    [hx, hz],
    [-hx, hz],
    [-hx, -hz],
    [hx, -hz],
  ];
  for (let q = 0; q < 4; q++) {
    for (let k = 0; k <= n; k++) {
      const a = ((q + k / n) * Math.PI) / 2;
      cols.push({ c: Math.cos(a), s: Math.sin(a), cx: corners[q][0], cz: corners[q][1] });
    }
  }
  cols.push(cols[0]);
  return cols;
}

/** Options of `latheGeometry`. */
export interface LatheOptions {
  /** Steps round the full circle; a multiple of 4. */
  segments: number;
  /** Half sizes of the rectangle the profile is turned round (a rounded-rectangle lathe); 0 for a circle. */
  hx?: number;
  hz?: number;
  /** Close open ends (default); without, an open band (a worktop's rounded rim round its middle). */
  caps?: boolean;
}

/**
 * A profile turned round the y axis: radius and height pairs from the bottom of the axis outwards
 * and up (so the normals point out of the material), or, with `hx`/`hz`, round a rectangle, the
 * radius then measured from its outline (a rounded box, a GN pan with round corners). Open ends
 * are closed: on the axis or the rectangle by a flat cap, away from it by a flat ring; a profile
 * whose last point is its first (a gasket, a ring) is closed in itself.
 */
export function latheGeometry(profile: Profile, o: LatheOptions): THREE.BufferGeometry {
  const hx = o.hx ?? 0;
  const hz = o.hz ?? 0;
  const first = profile[0];
  const last = profile[profile.length - 1];
  const closed = Math.hypot(first[0] - last[0], first[1] - last[1]) < EPS;
  const rows = profileRows(profile, closed);
  const cols = latheColumns(o.segments, hx, hz);
  const b = new Builder();
  const grid: number[][] = [];
  for (const r of rows) {
    const line: number[] = [];
    let u = 0;
    let px = 0;
    let pz = 0;
    cols.forEach((col, j) => {
      const x = col.cx + r.rho * col.c;
      const z = col.cz + r.rho * col.s;
      if (j > 0) u += Math.hypot(x - px, z - pz);
      px = x;
      pz = z;
      line.push(b.vert(x, r.y, z, r.nr * col.c, r.ny, r.nr * col.s, u, r.v));
    });
    grid.push(line);
  }
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let j = 0; j + 1 < cols.length; j++) b.quad(grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]);
  }
  if (!closed && o.caps !== false) {
    // The start cap faces away from the end and the end cap away from the start.
    const up = last[1] >= first[1] ? 1 : -1;
    latheCap(b, rows[0], cols, hx, hz, -up);
    latheCap(b, rows[rows.length - 1], cols, hx, hz, up);
  }
  return b.build();
}

/** A flat cap over an open end of a lathe, facing `dir` (+1 up, -1 down). */
function latheCap(b: Builder, r: Row, cols: readonly Column[], hx: number, hz: number, dir: number): void {
  const rect = hx >= EPS || hz >= EPS;
  if (r.rho < EPS) {
    // On the axis the ring is one point: nothing to close. On a rectangle it is the rectangle.
    if (!rect) return;
    const c = [
      [hx, hz],
      [-hx, hz],
      [-hx, -hz],
      [hx, -hz],
    ].map(([x, z]) => b.vert(x, r.y, z, 0, dir, 0, x, z));
    b.quad(c[0], c[1], c[2], c[3]);
    return;
  }
  const centre = b.vert(0, r.y, 0, 0, dir, 0, 0, 0);
  const ring = cols.slice(0, -1).map((col) => {
    const x = col.cx + r.rho * col.c;
    const z = col.cz + r.rho * col.s;
    return b.vert(x, r.y, z, 0, dir, 0, x, z);
  });
  for (let j = 0; j < ring.length; j++) b.tri(centre, ring[j], ring[(j + 1) % ring.length]);
}

/** Which edges of a rounded box are round. */
export type RoundedEdges = "all" | "top" | "vertical";

/**
 * Points of a quarter arc of radius `r` round (0, cy) in a profile, from angle `a0` to `a1`
 * (radians, 0 along the radius, π/2 up), `steps` segments, with the arc's own normals.
 */
export function arcPoints(cr: number, cy: number, r: number, a0: number, a1: number, steps: number): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (let k = 0; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    const c = Math.cos(a);
    const s = Math.sin(a);
    out.push([Math.max(0, cr + r * c), cy + r * s, c, s]);
  }
  return out;
}

/**
 * A box of size sx × sy × sz centred on the origin with edges rounded to radius `r` (`seg` steps
 * per quarter): all edges, the top edges and the upright corners, or the upright corners only.
 */
export function roundedBoxGeometry(sx: number, sy: number, sz: number, r: number, seg: number, edges: RoundedEdges = "all"): THREE.BufferGeometry {
  const hy = sy / 2;
  const side: ProfilePoint[] = [];
  if (edges === "all") side.push(...arcPoints(0, -hy + r, r, -Math.PI / 2, 0, seg));
  else side.push([r, -hy, 1, 0]);
  if (edges === "vertical") side.push([r, hy, 1, 0]);
  else side.push(...arcPoints(0, hy - r, r, 0, Math.PI / 2, seg));
  return latheGeometry(side, { segments: seg * 4, hx: sx / 2 - r, hz: sz / 2 - r });
}

/** The axis a part runs along. */
export type Axis = "x" | "y" | "z";

/**
 * Item-frame coordinates of a point (u, v) of an extrusion profile at `w` along the axis: along
 * x the profile is (z, y), along y it is (x, z), along z it is (x, y).
 */
function extrudeFrame(axis: Axis, u: number, v: number, w: number): [number, number, number] {
  if (axis === "x") return [w, v, u];
  if (axis === "y") return [u, w, v];
  return [u, v, w];
}

/** Twice the signed area of an outline (positive counter-clockwise in (u, v)). */
function signedArea(pts: readonly Point2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a;
}

/**
 * A 2D outline (with optional holes) extruded `length` along an axis from 0 (a handle profile, a
 * kick plate, a rolled edge, a worktop with its bowl cut-outs along y). The outline does not
 * repeat its first point. Sides are smooth where the outline turns by less than `CREASE`; both
 * ends get a flat cap.
 */
export function extrudeGeometry(axis: Axis, length: number, outline: readonly Point2[], holes: readonly (readonly Point2[])[] = []): THREE.BufferGeometry {
  const b = new Builder();
  // The brushed grain runs along the extrusion, round the outline when it stands upright.
  const uvOf = (s: number, w: number): [number, number] => (axis === "y" ? [s, w] : [w, s]);
  const loops = [outline, ...holes];
  loops.forEach((loop, li) => {
    // Edge normals point out of the material: away from the outline's inside, into a hole.
    const sign = Math.sign(signedArea(loop)) * (li === 0 ? 1 : -1);
    const n = loop.length;
    const lengths = loop.map((p, i) => Math.hypot(loop[(i + 1) % n][0] - p[0], loop[(i + 1) % n][1] - p[1]));
    const normals = loop.map((p, i) => {
      const q = loop[(i + 1) % n];
      const len = lengths[i] || 1;
      return [(sign * (q[1] - p[1])) / len, (-sign * (q[0] - p[0])) / len] as const;
    });
    // Per corner one column, two where the outline turns sharply (each side its own normal).
    const columns: { u: number; v: number; nu: number; nv: number; s: number }[] = [];
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const k = i % n;
      const p = loop[k];
      if (i > 0) s += Math.hypot(p[0] - loop[i - 1][0], p[1] - loop[i - 1][1]);
      const prev = normals[(k - 1 + n) % n];
      const next = normals[k];
      const angle = Math.acos(Math.max(-1, Math.min(1, prev[0] * next[0] + prev[1] * next[1])));
      if (angle > CREASE) {
        if (i > 0) columns.push({ u: p[0], v: p[1], nu: prev[0], nv: prev[1], s });
        if (i < n) columns.push({ u: p[0], v: p[1], nu: next[0], nv: next[1], s });
      } else {
        const [nu, nv] = blend(prev, lengths[(k - 1 + n) % n], next, lengths[k]);
        columns.push({ u: p[0], v: p[1], nu, nv, s });
      }
    }
    const ends = [0, length].map((w) =>
      columns.map((c) => {
        const [x, y, z] = extrudeFrame(axis, c.u, c.v, w);
        const [nx, ny, nz] = extrudeFrame(axis, c.nu, c.nv, 0);
        const [tu, tv] = uvOf(c.s, w);
        return b.vert(x, y, z, nx, ny, nz, tu, tv);
      }),
    );
    for (let j = 0; j + 1 < columns.length; j++) b.quad(ends[0][j], ends[0][j + 1], ends[1][j + 1], ends[1][j]);
  });
  const faces = THREE.ShapeUtils.triangulateShape(
    outline.map((p) => new THREE.Vector2(p[0], p[1])),
    holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1]))),
  );
  const flat = loops.flat();
  for (const [w, dir] of [
    [0, -1],
    [length, 1],
  ] as const) {
    const [nx, ny, nz] = extrudeFrame(axis, 0, 0, dir);
    const ids = flat.map((p) => {
      const [x, y, z] = extrudeFrame(axis, p[0], p[1], w);
      return b.vert(x, y, z, nx, ny, nz, p[0], p[1]);
    });
    for (const [a, c, d] of faces) b.tri(ids[a], ids[c], ids[d]);
  }
  return b.build();
}

/** Options of `tubeGeometry`. */
export interface TubeOptions {
  /** Centre-line radius of the bends (m); clamped so neighbouring bends do not overlap. */
  bend: number;
  /** Steps round the tube; a multiple of 4. */
  segments: number;
  /** Close the ends with flat discs. */
  caps: boolean;
}

/**
 * A round tube of radius `r` along a polyline, its corners bent round `bend` (a tap's spout, a
 * handle bar on its stand-offs, a gas pipe, a rail). UVs run along the tube (u) and round it (v).
 */
export function tubeGeometry(points: readonly THREE.Vector3Like[], r: number, o: TubeOptions): THREE.BufferGeometry {
  // Repeated points would give a run without a direction: keep one of each.
  const pts: THREE.Vector3[] = [];
  for (const p of points) {
    const v = new THREE.Vector3(p.x, p.y, p.z);
    if (pts.length === 0 || v.distanceTo(pts[pts.length - 1]) > EPS) pts.push(v);
  }
  if (pts.length < 2) return new Builder().build();
  // The centre line as samples with their tangents: straight runs, and arcs at the corners.
  const path: { p: THREE.Vector3; t: THREE.Vector3 }[] = [];
  const dirOf = (i: number) => pts[i + 1].clone().sub(pts[i]).normalize();
  path.push({ p: pts[0], t: dirOf(0) });
  for (let i = 1; i + 1 < pts.length; i++) {
    const d0 = dirOf(i - 1);
    const d1 = dirOf(i);
    const turn = Math.acos(Math.max(-1, Math.min(1, d0.dot(d1))));
    // Straight on needs no bend; turning back on itself has no plane to bend in: a sharp turn.
    if (turn < 1e-6) continue;
    if (turn > Math.PI - 1e-3) {
      path.push({ p: pts[i], t: d0 });
      continue;
    }
    // The bend may take at most half of each neighbouring run (all of the first and last run).
    const room = Math.min(pts[i].distanceTo(pts[i - 1]) / (i === 1 ? 1 : 2), pts[i].distanceTo(pts[i + 1]) / (i + 2 === pts.length ? 1 : 2));
    const tangent = Math.min(o.bend * Math.tan(turn / 2), room);
    const axis = new THREE.Vector3().crossVectors(d0, d1).normalize();
    const start = pts[i].clone().addScaledVector(d0, -tangent);
    const radius = tangent / Math.tan(turn / 2);
    const centre = start.clone().addScaledVector(new THREE.Vector3().crossVectors(axis, d0), radius);
    // Tight bends (a handle's stand-off) read round with fewer steps than a spout's sweep.
    const steps = Math.max(2, Math.ceil((turn / (Math.PI / 2)) * (radius <= TIGHT_BEND ? BEND_STEPS / 2 : BEND_STEPS)));
    const q = new THREE.Quaternion();
    for (let k = 0; k <= steps; k++) {
      q.setFromAxisAngle(axis, (turn * k) / steps);
      const p = start.clone().sub(centre).applyQuaternion(q).add(centre);
      path.push({ p, t: d0.clone().applyQuaternion(q) });
    }
  }
  path.push({ p: pts[pts.length - 1], t: dirOf(pts.length - 2) });

  const b = new Builder();
  // Frames carried along the path without twisting (parallel transport); the first one level
  // where it can be, so a horizontal tube has a vertex at its top and bottom.
  const t0 = path[0].t;
  const ref = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const normal = ref.clone().addScaledVector(t0, -ref.dot(t0)).normalize();
  const q = new THREE.Quaternion();
  const rings: number[][] = [];
  let s = 0;
  path.forEach((cur, i) => {
    if (i > 0) {
      s += cur.p.distanceTo(path[i - 1].p);
      q.setFromUnitVectors(path[i - 1].t, cur.t);
      normal.applyQuaternion(q);
    }
    const bin = new THREE.Vector3().crossVectors(cur.t, normal);
    const ring: number[] = [];
    for (let k = 0; k <= o.segments; k++) {
      const a = (k / o.segments) * Math.PI * 2;
      const dx = normal.x * Math.cos(a) + bin.x * Math.sin(a);
      const dy = normal.y * Math.cos(a) + bin.y * Math.sin(a);
      const dz = normal.z * Math.cos(a) + bin.z * Math.sin(a);
      ring.push(b.vert(cur.p.x + dx * r, cur.p.y + dy * r, cur.p.z + dz * r, dx, dy, dz, s, a * r));
    }
    rings.push(ring);
  });
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let k = 0; k < o.segments; k++) b.quad(rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]);
  }
  if (o.caps) {
    for (const [i, dir] of [
      [0, -1],
      [path.length - 1, 1],
    ] as const) {
      const { p, t } = path[i];
      const pos = b.getPositions();
      const centre = b.vert(p.x, p.y, p.z, t.x * dir, t.y * dir, t.z * dir, 0, 0);
      const ring = rings[i].slice(0, -1).map((v) => b.vert(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], t.x * dir, t.y * dir, t.z * dir, pos[v * 3] - p.x, pos[v * 3 + 1] - p.y));
      for (let k = 0; k < ring.length; k++) b.tri(centre, ring[k], ring[(k + 1) % ring.length]);
    }
  }
  return b.build();
}
