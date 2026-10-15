// Building blocks of the 3D models, in the item's own frame: metres, x along the width (centred),
// z towards the front (the back face at -d/2, the front face at +d/2), y up from the item's
// elevation. `buildItemObject` (three/meshes.ts) places and turns the result.
//
// Parts are the shared unit box or cylinder, scaled (`box`, `cyl`, `rod`, `bar`), or a shaped
// part from the shared cache (`roundedBox`, `plate`, `lathe`, `pan`, `extrude`, `tube`), always
// with a shared material (three/shared.ts): a model never creates geometry or materials of its
// own. Shaped parts are built at their real size and only moved and turned, never scaled. Wire
// work (baskets, grids, guards) is made of thin rods (`grid`, `wireBox`, `wireCage`), never of a
// wireframe. The model style guide in kinds/README.md says which part to use for what.

import * as THREE from "three";
import { getShared, sharedShape, type MaterialId, type Shared } from "../../three/shared";
import { arcPoints, extrudeGeometry, latheGeometry, roundedBoxGeometry, tubeGeometry, type Axis, type Point2, type Profile, type ProfilePoint, type RoundedEdges } from "../../three/shapes";

export type { MaterialId } from "../../three/shared";
export type { Axis, Point2, Profile, ProfilePoint, RoundedEdges } from "../../three/shapes";
export { arcPoints } from "../../three/shapes";

/** Size of an item in metres. */
export interface Size {
  w: number;
  d: number;
  h: number;
}

/** A rectangular hole in a worktop (bowls, basins), in the item frame (m). */
export interface Hole {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /**
   * Corner radius (m): `BOWL_RADIUS` by default, matching a `tub` let into the hole; 0 for a
   * square hole (a flush insert), half the smaller side for a round one.
   */
  r?: number;
}

// Typical construction sizes of stainless equipment (m).
/** Smallest extent of a part, so a resized tiny item never gets a zero scale. */
const MIN_PART = 0.001;
/** Sheet metal thickness as drawn (thicker than real so it is visible). */
export const SHEET = 0.01;
/** Worktop thickness. */
export const TOP = 0.04;
/** Square table leg. */
export const LEG = 0.04;
/** Height of the lower shelf of an open table above the floor. */
export const UNDERSHELF = 0.18;
/** Plinth height of cabinets and fridges. */
export const PLINTH = 0.1;
/** Gap between a door and the next one or the body edge. */
export const GAP = 0.004;
/** Depth of a door panel standing proud of the body. */
export const DOOR = 0.02;
/** Handle bar size; handles end flush with the item's front. */
export const HANDLE = 0.02;
/** Height of the control strip on the front of cooking appliances. */
export const CONTROLS = 0.12;
/** Thickness of a cooking top (dark plate on the body). */
export const COOKTOP = 0.05;
/** Usual width of one cabinet door. */
export const DOOR_WIDTH = 0.6;
/** Radius of a round handle bar. */
const HANDLE_BAR = 0.008;
/** Radius of a control knob. */
const KNOB_RADIUS = 0.022;
/** How far a knob's index mark stands on its face (m). */
const KNOB_MARK = 0.001;
/** Set-back of the kick plate under a body from its front (toe space). */
const KICK_SETBACK = 0.05;
/** Radius of an adjustable foot. */
const FOOT = 0.022;
/** Height of the round pad at the bottom of a foot. */
const FOOT_PAD = 0.012;
/** Largest distance between two knobs on a control strip (m). */
const KNOB_PITCH = 0.15;
/** Radius of a wire of baskets, grids and guards (4 mm wire). */
export const WIRE = 0.002;
/** Radius of the frame rods of baskets and grids (6 mm). */
export const WIRE_FRAME = 0.003;
/** Wire distance of baskets and dish racks. */
export const BASKET_PITCH = 0.02;
/** Wire distance of wire shelves, grids and guards. */
export const SHELF_PITCH = 0.03;
/** The axis of the unit cylinder. */
const UP = new THREE.Vector3(0, 1, 0);

// Edge radii of the model style guide (m, kinds/README.md): large enough to catch a highlight
// at viewing distance, as small as the sheet metal's real bends.
/** Worktops and covers: the rolled front edge of a pressed top. */
export const TOP_RADIUS = 0.003;
/** Bodies (upright corners), plinths, panels and control strips. */
export const BODY_RADIUS = 0.002;
/** Door and drawer leaves. */
export const DOOR_RADIUS = 0.002;
/** Inside corners of bowls, tanks, wells and pans (a hygienic radius) and their holes in the top. */
export const BOWL_RADIUS = 0.02;
/** Corners of GN containers (about 10 mm on real ones; the rim takes the rest). */
export const GN_RADIUS = 0.012;
/** Below this a radius is not drawn: the part stays a plain box. */
const MIN_RADIUS = 0.0002;
/** Quantum of sizes in a shaped part's cache key (m): a hundredth of a millimetre. */
const KEY_QUANTUM = 1e-5;
const qk = (v: number) => Math.round(v / KEY_QUANTUM);
const qv = (v: number) => qk(v) * KEY_QUANTUM;

/** Steps per quarter circle of a rounded edge or corner of radius `r` (m): more for larger radii. */
export function roundSteps(r: number): number {
  return r <= 0.004 ? 1 : r <= 0.012 ? 2 : r <= 0.04 ? 3 : 4;
}

/** Steps round a turned part of largest radius `r` (m), a multiple of 4. */
function turnSegments(r: number): number {
  return r <= 0.03 ? 16 : r <= 0.15 ? 24 : 32;
}

/** Steps round a tube of radius `r` (m), a multiple of 4. */
function tubeSegments(r: number): number {
  return r <= 0.006 ? 8 : r <= 0.02 ? 12 : 16;
}

/** The turn that lays a part built along y along `axis` (y stays, z: y to +z, x: y to +x). */
function layAlong(m: THREE.Object3D, axis: Axis): void {
  if (axis === "z") m.rotation.x = Math.PI / 2;
  else if (axis === "x") m.rotation.z = -Math.PI / 2;
}

/**
 * Positions of the wires between `a` and `b` (exclusive) at about `pitch`, evenly spread: the
 * ends are the frame's.
 */
export function wirePositions(a: number, b: number, pitch: number): number[] {
  if (b <= a || pitch <= 0) return [];
  const n = Math.max(1, Math.round((b - a) / pitch));
  return Array.from({ length: n - 1 }, (_, i) => a + ((b - a) * (i + 1)) / n);
}

/** Adds parts to an item's group. */
export class Parts {
  readonly s: Shared = getShared();
  constructor(readonly g: THREE.Group) {}

  /** An axis-aligned box from its extents. */
  box(mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.Mesh {
    const m = new THREE.Mesh(this.s.box, this.s.mat[mat]);
    m.scale.set(Math.max(x1 - x0, MIN_PART), Math.max(y1 - y0, MIN_PART), Math.max(z1 - z0, MIN_PART));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.g.add(m);
    return m;
  }

  /** A standing cylinder from its centre on the plan, its height range and radius. */
  cyl(mat: MaterialId, cx: number, cz: number, y0: number, y1: number, r: number): THREE.Mesh {
    const m = new THREE.Mesh(this.s.cylinder, this.s.mat[mat]);
    m.scale.set(2 * r, Math.max(y1 - y0, MIN_PART), 2 * r);
    m.position.set(cx, (y0 + y1) / 2, cz);
    this.g.add(m);
    return m;
  }

  /** A mesh of a shaped part from the shared cache, added to the item. */
  private shaped(mat: MaterialId, key: string, make: () => THREE.BufferGeometry): THREE.Mesh {
    const m = new THREE.Mesh(sharedShape(key, make), this.s.mat[mat]);
    this.g.add(m);
    return m;
  }

  /**
   * A box from its extents with rounded edges of radius `r` (m): all edges, the edges round its
   * `top` end and the corners along `axis`, or only the corners along `axis` ("vertical"). The
   * `axis` (y by default) is what "top" and "vertical" refer to: along z the top is the front, so
   * a door leaf with `edges: "top", axis: "z"` is rounded at its front and flat at the back. The
   * radius shrinks to fit; below a fraction of a millimetre the part is a plain box.
   */
  roundedBox(mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, r: number, edges: RoundedEdges = "all", axis: Axis = "y"): THREE.Mesh {
    const sx = Math.max(x1 - x0, MIN_PART);
    const sy = Math.max(y1 - y0, MIN_PART);
    const sz = Math.max(z1 - z0, MIN_PART);
    // The sizes in the frame the geometry is built in: `axis` as its y.
    const [bx, by, bz] = axis === "z" ? [sx, sz, sy] : axis === "x" ? [sy, sx, sz] : [sx, sy, sz];
    const rr = Math.min(r, bx / 2, bz / 2, edges === "vertical" ? Infinity : edges === "top" ? by : by / 2);
    if (rr < MIN_RADIUS) return this.box(mat, x0, x1, y0, y1, z0, z1);
    const seg = roundSteps(rr);
    const key = `rbox ${qk(bx)} ${qk(by)} ${qk(bz)} ${qk(rr)} ${seg} ${edges}`;
    const m = this.shaped(mat, key, () => roundedBoxGeometry(qv(bx), qv(by), qv(bz), qv(rr), seg, edges));
    layAlong(m, axis);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return m;
  }

  /**
   * A front plate with rounded corners in its own plane (a window, a display, a panel, a door
   * glass): a box thin along z whose corners along z are rounded to `r`, and its front edges too
   * when `front` is set.
   */
  plate(mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, r: number, front = false): THREE.Mesh {
    return this.roundedBox(mat, x0, x1, y0, y1, z0, z1, r, front ? "top" : "vertical", "z");
  }

  /**
   * A turned part: `profile` (radius, height) pairs from the bottom of the axis out and up,
   * revolved round an axis through (x, y, z), height 0 at that point and growing along `axis`
   * (y up, z to the front, x to the right). Knobs, bowls, kettles, feet, lamp shades, burner
   * crowns. With `rect` (half sizes across the axis) the profile is turned round a rectangle
   * instead: a pan, a tub, a frame with round corners. Points without a normal are smoothed where
   * the profile turns by less than 40 degrees and kept sharp where it turns more; `arcPoints`
   * gives a round with exact normals. Open ends are capped unless `caps` is false.
   */
  lathe(mat: MaterialId, x: number, y: number, z: number, profile: Profile, o: { axis?: Axis; segments?: number; rect?: readonly [number, number]; caps?: boolean } = {}): THREE.Mesh {
    const axis = o.axis ?? "y";
    const [hx, hz] = o.rect ?? [0, 0];
    const rMax = Math.max(...profile.map((p) => p[0]));
    const segments = o.segments ?? (hx > 0 || hz > 0 ? 4 * roundSteps(rMax) : turnSegments(rMax));
    const caps = o.caps ?? true;
    const pts = profile.map((p) => p.map((v, i) => (i < 2 ? qv(v) : Math.round(v * 1e4) / 1e4)) as unknown as ProfilePoint);
    const key = `lathe ${segments} ${qk(hx)} ${qk(hz)} ${caps ? 1 : 0} ${pts.map((p) => p.map((v, i) => (i < 2 ? qk(v) : v)).join(",")).join(";")}`;
    const m = this.shaped(mat, key, () => latheGeometry(pts, { segments, hx: qv(hx), hz: qv(hz), caps }));
    layAlong(m, axis);
    m.position.set(x, y, z);
    return m;
  }

  /**
   * A pan or tub with round corners filling the box, open at the top (`y1`): a sink bowl, a fryer
   * tank, a well, a GN container. `wall` is its sheet, `r` the radius of its corners seen from
   * above (and of the hole it sits in, `Hole.r`); the floor meets the walls in a cove. With a
   * `rim` (m) the body stands in by that much and a flange at the top reaches the box (a GN
   * container hanging in a well). A box too small for its walls is drawn as five sheets.
   */
  pan(mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, o: { wall?: number; r?: number; rim?: number } = {}): THREE.Mesh {
    const wall = o.wall ?? SHEET;
    const rim = o.rim ?? 0;
    const hxo = (x1 - x0) / 2;
    const hzo = (z1 - z0) / 2;
    const height = y1 - y0;
    // The corner radius of the outline: room for the wall, the rim and a cove, never more than
    // the box allows (a square box with the largest radius is round).
    const rc = Math.min(Math.max(o.r ?? BOWL_RADIUS, rim + wall * 2), hxo, hzo);
    const body = rc - rim;
    if (body < wall * 1.5 || height < wall * 2) return this.tubSheets(mat, x0, x1, y0, y1, z0, z1, wall);
    return this.lathe(mat, (x0 + x1) / 2, y0, (z0 + z1) / 2, panProfile(body, height, wall, rim, rc), { rect: [hxo - rc, hzo - rc] });
  }

  /**
   * A 2D outline extruded along `axis` from `a` to `b` (m), in the item frame: along x the
   * outline's points are (z, y), along y (x, z), along z (x, y). It may have holes. A rolled
   * edge, a handle or gasket profile, a hood's folded front, a kick plate, a worktop with its
   * cut-outs. Corners turning by less than 40 degrees are smooth, others sharp; both ends flat.
   */
  extrude(mat: MaterialId, axis: Axis, a: number, b: number, outline: readonly Point2[], holes: readonly (readonly Point2[])[] = []): THREE.Mesh {
    // Built from its lowest corner, so equal profiles at other places share the geometry.
    const u0 = Math.min(...outline.map((p) => p[0]));
    const v0 = Math.min(...outline.map((p) => p[1]));
    const rel = (pts: readonly Point2[]) => pts.map((p) => [qv(p[0] - u0), qv(p[1] - v0)] as const);
    const out = rel(outline);
    const hs = holes.map(rel);
    const len = qv(Math.max(b - a, MIN_PART));
    const key = `extrude ${axis} ${qk(len)} ${[out, ...hs].map((l) => l.map((p) => `${qk(p[0])},${qk(p[1])}`).join(";")).join("|")}`;
    const m = this.shaped(mat, key, () => extrudeGeometry(axis, len, out, hs));
    if (axis === "x") m.position.set(a, v0, u0);
    else if (axis === "y") m.position.set(u0, a, v0);
    else m.position.set(u0, v0, a);
    return m;
  }

  /**
   * A round tube of radius `r` along the points (m), its corners bent round `bend` (twice the
   * tube's radius by default): a tap's column and spout, a bar handle on its stand-offs, a gas
   * pipe, a rail. Its ends are closed unless `caps` is false.
   */
  tube(mat: MaterialId, points: readonly THREE.Vector3Like[], r: number, o: { bend?: number; segments?: number; caps?: boolean } = {}): THREE.Mesh {
    const p0 = points[0];
    const rel = points.map((p) => ({ x: qv(p.x - p0.x), y: qv(p.y - p0.y), z: qv(p.z - p0.z) }));
    const bend = qv(o.bend ?? r * 2);
    const segments = o.segments ?? tubeSegments(r);
    const caps = o.caps ?? true;
    const key = `tube ${qk(r)} ${qk(bend)} ${segments} ${caps ? 1 : 0} ${rel.map((p) => `${qk(p.x)},${qk(p.y)},${qk(p.z)}`).join(";")}`;
    const m = this.shaped(mat, key, () => tubeGeometry(rel, qv(r), { bend, segments, caps }));
    m.position.set(p0.x, p0.y, p0.z);
    return m;
  }

  /** The unit cylinder for a material: wires get the lighter one. */
  private cylinderFor(mat: MaterialId): THREE.BufferGeometry {
    return mat === "wire" ? this.s.wireCylinder : this.s.cylinder;
  }

  /** A round bar along an axis, centred at (cx, cy, cz). Used for handles, rails and spouts. */
  rod(mat: MaterialId, axis: "x" | "y" | "z", cx: number, cy: number, cz: number, length: number, r: number): THREE.Mesh {
    const m = new THREE.Mesh(this.cylinderFor(mat), this.s.mat[mat]);
    m.scale.set(2 * r, Math.max(length, MIN_PART), 2 * r);
    if (axis === "x") m.rotation.z = Math.PI / 2;
    if (axis === "z") m.rotation.x = Math.PI / 2;
    m.position.set(cx, cy, cz);
    this.g.add(m);
    return m;
  }

  /**
   * A control knob standing out of a panel whose face is at `zFace`, ending at `zFront`: a turned
   * grip on a skirt, its face rounded over, with a bright index mark standing on the face.
   */
  knob(cx: number, cy: number, zFace: number, zFront: number, r = KNOB_RADIUS): void {
    const d = zFront - zFace;
    const face = d - Math.min(KNOB_MARK, d / 4);
    this.lathe(
      "knob",
      cx,
      cy,
      zFace,
      [
        [0, 0],
        [r, 0],
        [r, d * 0.14],
        [r * 0.8, d * 0.22],
        [r * 0.76, face * 0.8],
        [r * 0.72, face * 0.94],
        [r * 0.6, face],
        [0, face],
      ],
      { axis: "z" },
    );
    // The index mark shows the setting: a bright rib on the face, the knob's frontmost part.
    this.box("handle", cx - r * 0.1, cx + r * 0.1, cy + r * 0.12, cy + r * 0.55, zFace + face - 0.001, zFront);
  }

  /**
   * A bar handle on stand-offs in front of a door face at `zFace`, ending flush with `zFront`:
   * horizontal (along x) or vertical (along y), from `a` to `b` on that axis, at `at` on the
   * other one.
   */
  barHandle(axis: "x" | "y", a: number, b: number, at: number, zFace: number, zFront: number): void {
    const r = Math.min(HANDLE_BAR, (zFront - zFace) / 3);
    const zc = zFront - r;
    // One bent bar: out of the face, along, and back in; the bends at its ends stay within a..b.
    const inset = Math.min(0.03, (b - a) * 0.15);
    const s0 = Math.min(a + Math.max(inset, r), (a + b) / 2);
    const s1 = Math.max(b - Math.max(inset, r), (a + b) / 2);
    const at3 = (s: number, z: number) => (axis === "x" ? { x: s, y: at, z } : { x: at, y: s, z });
    this.tube("handle", [at3(s0, zFace), at3(s0, zc), at3(s1, zc), at3(s1, zFace)], r, { bend: Math.min(r * 2, zc - zFace) });
  }

  /** A round bar from point `a` to point `b` (any direction), for the wires of cages. */
  bar(mat: MaterialId, a: THREE.Vector3Like, b: THREE.Vector3Like, r: number): THREE.Mesh {
    const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const length = dir.length();
    const m = new THREE.Mesh(this.cylinderFor(mat), this.s.mat[mat]);
    m.scale.set(2 * r, Math.max(length, MIN_PART), 2 * r);
    if (length > 0) {
      // The cylinder's axis along the bar, its x axis level across it: the bar's box then stays
      // as tight as an axis-aligned rod's, so a cage keeps within its circle.
      dir.divideScalar(length);
      const across = new THREE.Vector3().crossVectors(UP, dir);
      if (across.lengthSq() < 1e-12) across.set(1, 0, 0);
      across.normalize();
      const third = new THREE.Vector3().crossVectors(across, dir);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, dir, third));
    }
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    this.g.add(m);
    return m;
  }

  /**
   * A flat wire grid filling the box (a wire shelf, a grill grid, a grille): a frame of rods
   * round the edge and wires along `along` (x or z) every `pitch` between them, all in the
   * middle of the box's height. Everything stays inside the box.
   */
  grid(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, pitch: number, along: "x" | "z" = "z"): void {
    const y = (y0 + y1) / 2;
    const rf = Math.min(WIRE_FRAME, (y1 - y0) / 2, (x1 - x0) / 4, (z1 - z0) / 4);
    const rw = Math.min(WIRE, rf);
    this.rod("wire", "x", (x0 + x1) / 2, y, z0 + rf, x1 - x0, rf);
    this.rod("wire", "x", (x0 + x1) / 2, y, z1 - rf, x1 - x0, rf);
    this.rod("wire", "z", x0 + rf, y, (z0 + z1) / 2, z1 - z0 - 4 * rf, rf);
    this.rod("wire", "z", x1 - rf, y, (z0 + z1) / 2, z1 - z0 - 4 * rf, rf);
    if (along === "z") {
      for (const x of wirePositions(x0 + rf * 2, x1 - rf * 2, pitch)) this.rod("wire", "z", x, y, (z0 + z1) / 2, z1 - z0 - 4 * rf, rw);
    } else {
      for (const z of wirePositions(z0 + rf * 2, z1 - rf * 2, pitch)) this.rod("wire", "x", (x0 + x1) / 2, y, z, x1 - x0 - 4 * rf, rw);
    }
  }

  /**
   * A wire basket or cage filling the box (a fryer basket, a dish rack, a guard): rods along the
   * top and bottom edges and at the four corners, upright wires every `pitch` in the four walls
   * (every `wallPitch` if given: a basket seen from above shows its walls end-on), and a grid
   * across the bottom and, if asked, across the top.
   */
  wireBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, pitch: number, faces: { bottom?: boolean; top?: boolean; wallPitch?: number } = {}): void {
    const rf = Math.min(WIRE_FRAME, (x1 - x0) / 4, (y1 - y0) / 4, (z1 - z0) / 4);
    const rw = Math.min(WIRE, rf);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    // The frame: the rims at the top and the bottom and the corner posts.
    for (const y of [y0 + rf, y1 - rf]) {
      for (const z of [z0 + rf, z1 - rf]) this.rod("wire", "x", cx, y, z, x1 - x0, rf);
      for (const x of [x0 + rf, x1 - rf]) this.rod("wire", "z", x, y, cz, z1 - z0 - 4 * rf, rf);
    }
    for (const x of [x0 + rf, x1 - rf]) for (const z of [z0 + rf, z1 - rf]) this.rod("wire", "y", x, (y0 + y1) / 2, z, y1 - y0 - 4 * rf, rf);
    // Upright wires in the walls, between the rims.
    const yc = (y0 + y1) / 2;
    const hw = y1 - y0 - 4 * rf;
    const wp = faces.wallPitch ?? pitch;
    for (const x of wirePositions(x0 + rf * 2, x1 - rf * 2, wp)) {
      for (const z of [z0 + rf, z1 - rf]) this.rod("wire", "y", x, yc, z, hw, rw);
    }
    for (const z of wirePositions(z0 + rf * 2, z1 - rf * 2, wp)) {
      for (const x of [x0 + rf, x1 - rf]) this.rod("wire", "y", x, yc, z, hw, rw);
    }
    // Wires across the bottom and the top, front to back, inside the rims.
    const ys = [...(faces.bottom ?? true ? [y0 + rf] : []), ...(faces.top ? [y1 - rf] : [])];
    for (const y of ys) for (const x of wirePositions(x0 + rf * 2, x1 - rf * 2, pitch)) this.rod("wire", "z", x, y, cz, z1 - z0 - 4 * rf, rw);
  }

  /**
   * A round wire cage standing on the circle of radius `r` round (cx, cz) from `y0` to `y1` (a
   * bowl guard, a whisk): `wires` upright wires and a ring at the bottom and the top, the rings
   * made of straight rods between the wires. Everything stays within `r` of the centre.
   */
  wireCage(cx: number, cz: number, y0: number, y1: number, r: number, wires: number): void {
    const rf = Math.min(WIRE_FRAME, r / 4, (y1 - y0) / 4);
    const rw = Math.min(WIRE, rf);
    const n = Math.max(3, Math.round(wires));
    const ring = r - rf;
    const at = (i: number, y: number) => {
      const a = (i / n) * Math.PI * 2;
      return { x: cx + ring * Math.cos(a), y, z: cz + ring * Math.sin(a) };
    };
    for (let i = 0; i < n; i++) {
      for (const y of [y0 + rf, y1 - rf]) this.bar("wire", at(i, y), at(i + 1, y), rf);
      const p = at(i, 0);
      this.rod("wire", "y", p.x, (y0 + y1) / 2, p.z, y1 - y0 - 4 * rf, rw);
    }
  }

  /**
   * An open tub filling the box, its rim at `y1`: a sink bowl, a basin, a tank or a pan, with
   * round corners of radius `r` (as the `Hole` it sits in) and a cove at the floor (`pan`).
   * Used so bowls look recessed instead of painted on.
   */
  tub(mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, wall = SHEET, r = BOWL_RADIUS): void {
    this.pan(mat, x0, x1, y0, y1, z0, z1, { wall, r });
  }

  /** A tub of five flat sheets (floor and walls), for boxes too small for a `pan`. Returns the floor. */
  private tubSheets(mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, wall: number): THREE.Mesh {
    const floor = this.box(mat, x0, x1, y0, y0 + wall, z0, z1);
    this.box(mat, x0, x1, y0, y1, z0, z0 + wall);
    this.box(mat, x0, x1, y0, y1, z1 - wall, z1);
    this.box(mat, x0, x0 + wall, y0, y1, z0, z1);
    this.box(mat, x1 - wall, x1, y0, y1, z0, z1);
    return floor;
  }

  /**
   * A worktop over the whole item (w × d, centred) with holes cut out (bowls, basins, wells),
   * their corners rounded to `Hole.r`: a rounded rim round the edge like `worktop`, and the
   * middle with the cut-outs, open from above.
   */
  topWithHoles(mat: MaterialId, w: number, d: number, y0: number, y1: number, holes: readonly Hole[]): void {
    const er = Math.min(TOP_RADIUS, (y1 - y0) / 2, w / 4, d / 4);
    const hx = w / 2 - er;
    const hz = d / 2 - er;
    const seg = roundSteps(er);
    // The rim: a rounded box's sides without its top and bottom.
    this.lathe(mat, 0, y0, 0, [...arcPoints(0, er, er, -Math.PI / 2, 0, seg), ...arcPoints(0, y1 - y0 - er, er, 0, Math.PI / 2, seg)], { rect: [hx, hz], caps: false });
    // Holes stay a hair inside the middle so their outlines never touch its edge.
    const inside = (v: number, h: number) => Math.max(-h + HOLE_MARGIN, Math.min(h - HOLE_MARGIN, v));
    const cuts = holes.map((h) => roundedRectOutline(inside(h.x0, hx), inside(h.x1, hx), inside(h.z0, hz), inside(h.z1, hz), h.r ?? BOWL_RADIUS));
    this.extrude(
      mat,
      "y",
      y0,
      y1,
      [
        [-hx, -hz],
        [hx, -hz],
        [hx, hz],
        [-hx, hz],
      ],
      cuts,
    );
  }

  /**
   * A sheet across the width (x0 to x1) on a 45° fold: its outer face runs from the top edge at
   * (`yTop`, `zTop`) down by `run` towards the front (dir 1, +z) or the back (dir -1). A hood's
   * inclined front and back.
   */
  slope(mat: MaterialId, x0: number, x1: number, zTop: number, yTop: number, run: number, dir: 1 | -1, t = SHEET): THREE.Mesh {
    const len = run * Math.SQRT2;
    const m = this.box(mat, x0, x1, -t / 2, t / 2, -len / 2, len / 2);
    m.rotation.x = (dir * Math.PI) / 4;
    const n = Math.SQRT1_2 * (t / 2);
    m.position.set((x0 + x1) / 2, yTop - run / 2 - n, zTop + (dir * run) / 2 - dir * n);
    return m;
  }

  /**
   * The triangle of a side panel (x0 to x1) under a `slope`, as a square turned 45° whose outer
   * edge is the fold from (`yTop`, `zEdge`) down by `run`; the rest of the square has to hide in
   * the panel's straight parts. Slightly thinner than the panel so their faces do not fight.
   */
  chamferCorner(mat: MaterialId, x0: number, x1: number, zEdge: number, yTop: number, run: number, dir: 1 | -1): THREE.Mesh {
    const a = run * Math.SQRT2;
    const m = this.box(mat, x0 + 0.001, x1 - 0.001, -a / 2, a / 2, -a / 2, a / 2);
    m.rotation.x = Math.PI / 4;
    m.position.set((x0 + x1) / 2, yTop - run, zEdge - dir * run);
    return m;
  }

  /**
   * A level ring round (x, z) at height y, its centre line at radius `rc` and its round section of
   * radius `rb` (a wok ring, a trim ring): a turned torus.
   */
  ring(mat: MaterialId, x: number, z: number, y: number, rc: number, rb: number): THREE.Mesh {
    const section: ProfilePoint[] = Array.from({ length: RING_STEPS + 1 }, (_, k) => {
      const a = -Math.PI + (k / RING_STEPS) * Math.PI * 2;
      return [rc + rb * Math.cos(a), rb * Math.sin(a), Math.cos(a), Math.sin(a)];
    });
    return this.lathe(mat, x, y, z, section);
  }
}

/** Steps round the section of a `Parts.ring`. */
const RING_STEPS = 8;
/** Steps round a `roundBowl` and its hole in the deck (the same, so they meet). */
const BOWL_SEGMENTS = 32;
/** How far a hole's outline stays inside the middle of a `topWithHoles` (m). */
const HOLE_MARGIN = 0.0001;

/**
 * The outline of a rectangle with corners rounded to `r` (m) in the plane of a top (x, z),
 * counter-clockwise, with as many steps per corner as a `pan` of that radius has, so a hole and
 * the tub let into it meet. A radius of half the smaller side makes it round.
 */
export function roundedRectOutline(x0: number, x1: number, z0: number, z1: number, r: number): Point2[] {
  const rr = Math.max(0, Math.min(r, (x1 - x0) / 2, (z1 - z0) / 2));
  if (rr < MIN_RADIUS) {
    return [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
  }
  const steps = roundSteps(rr);
  const corners: [number, number][] = [
    [x1 - rr, z1 - rr],
    [x0 + rr, z1 - rr],
    [x0 + rr, z0 + rr],
    [x1 - rr, z0 + rr],
  ];
  const out: Point2[] = [];
  corners.forEach(([cx, cz], q) => {
    for (let k = 0; k <= steps; k++) {
      const a = ((q + k / steps) * Math.PI) / 2;
      const p: Point2 = [cx + rr * Math.cos(a), cz + rr * Math.sin(a)];
      // Corners that meet (a round hole) share their end points: keep one.
      const last = out[out.length - 1];
      if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-9) out.push(p);
    }
  });
  const first = out[0];
  const last = out[out.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-9) out.pop();
  return out;
}

/**
 * The profile of a pan's wall turned round its axis or outline (`Parts.pan`, `roundBowl`): from
 * the middle of the floor out, the bottom rounded, up the outside at `body` (m, from the axis or
 * outline) to `height`, over the rim (with a flange out to `rc` if `rim` > 0) and down the inside
 * of the `wall` into a cove at the floor and back to the middle.
 */
function panProfile(body: number, height: number, wall: number, rim: number, rc: number): ProfilePoint[] {
  const cove = Math.min(body - wall, height / 3, BOWL_RADIUS);
  const outer = cove + wall;
  const inward = (pts: ProfilePoint[]) => pts.map((p) => [p[0], p[1], -(p[2] ?? 0), -(p[3] ?? 0)] as ProfilePoint);
  const top: ProfilePoint[] =
    rim > 0
      ? [
          [body, height - wall, 1, 0],
          [body, height - wall, 0, -1],
          [rc, height - wall, 0, -1],
          [rc, height - wall, 1, 0],
          [rc, height, 1, 0],
          [rc, height, 0, 1],
        ]
      : [
          [body, height, 1, 0],
          [body, height, 0, 1],
        ];
  return [
    [0, 0, 0, -1],
    ...arcPoints(body - outer, outer, outer, -Math.PI / 2, 0, roundSteps(outer)),
    ...top,
    [body - wall, height, 0, 1],
    [body - wall, height, -1, 0],
    ...inward(arcPoints(body - wall - cove, wall + cove, cove, 0, -Math.PI / 2, roundSteps(cove))),
    [0, wall, 0, 1],
  ];
}

/**
 * A round bowl let into a deck from x -w/2 to w/2 and z from `z0` to `z1` (m), its centre at
 * (0, cz), radius `r`, the deck's top at `rim` and `deck` thick, the bowl's floor at `floor`:
 * the deck with a round hole and the turned bowl under it, its wall `SHEET` thick, a cove at the
 * floor. A hand wash basin's bowl.
 */
export function roundBowl(p: Parts, mat: MaterialId, w: number, z0: number, z1: number, cz: number, r: number, rim: number, floor: number, deck: number): void {
  const hole: Point2[] = Array.from({ length: BOWL_SEGMENTS }, (_, k) => {
    const a = (k / BOWL_SEGMENTS) * Math.PI * 2;
    return [r * Math.cos(a), cz + r * Math.sin(a)];
  });
  p.extrude(
    mat,
    "y",
    rim - deck,
    rim,
    [
      [-w / 2, z0],
      [w / 2, z0],
      [w / 2, z1],
      [-w / 2, z1],
    ],
    [hole],
  );
  // The bowl's top stands a hair under the deck's, its outer edge hidden under the deck.
  p.lathe(mat, 0, floor, cz, panProfile(r + SHEET, rim - 0.001 - floor, SHEET, 0, r + SHEET), { segments: BOWL_SEGMENTS });
}

// ---------------------------------------------------------------------------------------------
// Assemblies shared by several kinds

/** A stainless body with a worktop: the base of most counters. */
export function body(p: Parts, { w, d, h }: Size, topMat: MaterialId = "steel", topThickness = TOP, holes: readonly Hole[] = []): void {
  plinth(p, w, d);
  p.roundedBox("steel", -w / 2, w / 2, PLINTH, h - topThickness, -d / 2, d / 2 - DOOR, BODY_RADIUS, "vertical");
  if (holes.length > 0) p.topWithHoles(topMat, w, d, h - topThickness, h, holes);
  else worktop(p, topMat, -w / 2, w / 2, h - topThickness, h, -d / 2, d / 2);
}

/** A worktop or cover over the box, its edges rounded like a pressed top (`TOP_RADIUS`). */
export function worktop(p: Parts, mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.Mesh {
  return p.roundedBox(mat, x0, x1, y0, y1, z0, z1, TOP_RADIUS);
}

/**
 * The base under a body: a kick plate set back from the front and adjustable feet at the
 * corners, as on stainless counters (all within the footprint).
 */
export function plinth(p: Parts, w: number, d: number): void {
  p.roundedBox("steelDark", -w / 2 + LEG, w / 2 - LEG, FOOT_PAD, PLINTH, -d / 2 + LEG, d / 2 - DOOR - KICK_SETBACK, BODY_RADIUS, "vertical");
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) foot(p, sx * (w / 2 - FOOT * 1.5), sz * (d / 2 - DOOR - FOOT * 1.5), PLINTH);
  }
}

/**
 * An adjustable foot standing on the floor at (x, z) up to `top` (m): a rubber pad, the turned
 * spindle and the cone it hangs from, within `FOOT` of (x, z).
 */
export function foot(p: Parts, x: number, z: number, top: number, r = FOOT): void {
  const pad = Math.min(FOOT_PAD, top / 3);
  p.lathe("rubber", x, 0, z, [
    [0, 0],
    [r * 0.9, 0],
    [r, pad * 0.35],
    [r, pad * 0.6],
    [r * 0.8, pad],
    [0, pad],
  ]);
  const h = top - pad;
  p.lathe("steelDark", x, pad, z, [
    [0, 0],
    [r * 0.55, 0],
    [r * 0.55, h * 0.12],
    [r * 0.38, h * 0.18],
    [r * 0.38, h * 0.62],
    [r * 0.62, h * 0.72],
    [r * 0.62, h * 0.86],
    [r * 0.9, h],
    [0, h],
  ]);
}

/** Door panels side by side over a width range, each with a vertical or horizontal handle. */
export function doors(p: Parts, x0: number, x1: number, y0: number, y1: number, d: number, count: number, handle: "vertical" | "top"): void {
  const zf = d / 2;
  const dw = (x1 - x0) / count;
  for (let i = 0; i < count; i++) {
    const a = x0 + i * dw + GAP;
    const b = x0 + (i + 1) * dw - GAP;
    p.roundedBox("steel", a, b, y0 + GAP, y1 - GAP, zf - DOOR, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
    if (handle === "vertical") {
      // Handles sit at the meeting edges of a pair of doors; a single door has it on the right.
      const atLeft = count > 1 && i % 2 === 1;
      const hx = atLeft ? a + HANDLE * 1.5 : b - HANDLE * 1.5;
      const len = Math.min(0.4, (y1 - y0) * 0.5);
      const mid = (y0 + y1) / 2;
      p.barHandle("y", mid - len / 2, mid + len / 2, hx, zf - DOOR / 2, zf);
    } else {
      const len = Math.min(0.3, (b - a) * 0.6);
      const cx = (a + b) / 2;
      p.barHandle("x", cx - len / 2, cx + len / 2, y1 - 0.05, zf - DOOR / 2, zf);
    }
  }
}

/** Corner radius of a square tube leg (m). */
export const LEG_RADIUS = 0.004;

/** Width of a castor wheel at most, and thickness of its mounting plate (m). */
const CASTOR_WHEEL = 0.03;
const CASTOR_PLATE = 0.012;

/**
 * A swivel castor standing on the floor at (x, z): a rubber wheel of radius `r` turning about
 * the x axis with its hub, the fork, and the mounting plate up to `top` (m). Everything stays
 * within `r` of (x, z), so a castor set in from the edges by `r` stays inside the footprint.
 */
export function castor(p: Parts, x: number, z: number, r: number, top: number): void {
  const wheel = Math.min(CASTOR_WHEEL, r * 0.7);
  const hw = wheel / 2;
  // The tyre with rounded shoulders, turned about the x axis (its profile runs along x).
  p.lathe(
    "rubber",
    x - hw,
    r,
    z,
    [
      [0, 0],
      [r * 0.72, 0],
      [r * 0.93, wheel * 0.08],
      [r, wheel * 0.3],
      [r, wheel * 0.7],
      [r * 0.93, wheel * 0.92],
      [r * 0.72, wheel],
      [0, wheel],
    ],
    { axis: "x" },
  );
  p.rod("steelDark", "x", x, r, z, wheel * 1.2, r * 0.35);
  const fork = hw + 0.003;
  const forkD = Math.min(0.015, r * 0.4);
  for (const sx of [-1, 1]) p.roundedBox("steelDark", x + sx * fork - 0.002, x + sx * fork + 0.002, r, top - CASTOR_PLATE, z - forkD, z + forkD, 0.0015, "vertical", "x");
  const plate = Math.min(CASTOR_WHEEL, r);
  p.roundedBox("steelDark", x - plate, x + plate, top - CASTOR_PLATE, top, z - plate, z + plate, BODY_RADIUS);
}

/** Four legs and a lower shelf: the frame of open tables and sinks. */
export function openFrame(p: Parts, { w, d }: Size, topY: number): void {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - LEG / 2 - SHEET);
      const z = sz * (d / 2 - LEG / 2 - SHEET);
      p.roundedBox("steelDark", x - LEG / 2, x + LEG / 2, 0, topY, z - LEG / 2, z + LEG / 2, LEG_RADIUS, "vertical");
    }
  }
  p.roundedBox("steel", -w / 2 + SHEET, w / 2 - SHEET, UNDERSHELF, UNDERSHELF + SHEET * 2, -d / 2 + SHEET, d / 2 - SHEET, TOP_RADIUS);
}

/**
 * A mixer tap: a base, a column, a spout reaching forward and bending down over the bowl, and a
 * lever on the column. The column is named "tap" (one per tap).
 */
export function tap(p: Parts, x: number, zBack: number, y0: number, rise: number): void {
  const r = 0.012;
  const z = zBack + 0.05;
  // The rosette on the top: a low turned dome.
  p.lathe("handle", x, y0, z, [
    [0, 0],
    [r * 2, 0],
    [r * 2, 0.004],
    [r * 1.6, 0.012],
    [r * 1.2, 0.02],
    [0, 0.02],
  ]);
  const reach = Math.min(0.2, rise * 0.7);
  const drop = Math.min(0.06, rise * 0.25);
  // Column, spout and outlet as one bent tube; its round section tops out at the rise.
  const yTop = y0 + rise - r;
  const zOut = z + reach - r;
  p.tube(
    "handle",
    [
      { x, y: y0 + 0.01, z },
      { x, y: yTop, z },
      { x, y: yTop, z: zOut },
      { x, y: yTop - drop, z: zOut },
    ],
    r,
    { bend: Math.min(0.05, rise * 0.2) },
  ).name = "tap";
  // Single lever on the side of the column: a short bent grip.
  const ly = y0 + rise * 0.55 + 0.006;
  p.tube(
    "handle",
    [
      { x: x + r * 0.5, y: ly, z },
      { x: x + r + 0.05, y: ly, z },
      { x: x + r + 0.07, y: ly + 0.008, z },
    ],
    0.006,
    { bend: 0.015 },
  );
}

/** Cooking body: steel cabinet with a control strip on top of the front and a dark top. */
export function cookingBody(p: Parts, s: Size, topMat: MaterialId, ovenDoor: boolean, holes: readonly Hole[] = [], knobs = 0): void {
  body(p, s, topMat, COOKTOP, holes);
  const yc = s.h - COOKTOP - CONTROLS;
  p.roundedBox("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, yc, s.h - COOKTOP - GAP, s.d / 2 - DOOR, s.d / 2 - HANDLE, BODY_RADIUS, "top", "z");
  controlKnobs(p, s.w, (yc + s.h - COOKTOP) / 2, s.d / 2 - HANDLE, s.d / 2, knobs);
  if (ovenDoor) {
    doors(p, -s.w / 2, s.w / 2, PLINTH, yc, s.d, 1, "top");
    ovenWindow(p, -s.w / 2, s.w / 2, PLINTH, yc - 0.08, s.d / 2 - DOOR / 2);
  }
}

/** A row of knobs spread over a control strip of width `w`, centred on x = 0. */
export function controlKnobs(p: Parts, w: number, y: number, zFace: number, zFront: number, count: number): void {
  if (count <= 0) return;
  const step = Math.min(w / count, KNOB_PITCH);
  const x0 = -((count - 1) * step) / 2;
  for (let i = 0; i < count; i++) p.knob(x0 + i * step, y, zFace, zFront);
}

/** A dark glass window in an oven door whose face is at `zFace`, inside the door's frame. */
export function ovenWindow(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number): void {
  const mx = Math.min(0.1, (x1 - x0) * 0.15);
  const my = 0.1;
  if (x1 - x0 < 2 * mx + 0.1 || y1 - y0 < 2 * my + 0.1) return;
  p.plate("glassDark", x0 + mx, x1 - mx, y0 + my, y1 - my, zFace, zFace + 0.002, WINDOW_RADIUS);
}

/** Corner radius of oven and door windows (m). */
const WINDOW_RADIUS = 0.012;
