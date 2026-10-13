// The 3D room: floor with a metre grid, walls extruded outwards from the inner outline, with
// the doors, windows and passages cut out. Units as in `meshes.ts`: metres, plan y -> three z.
//
// Each wall is one group with `userData.wall` (its index) and `userData.inward` (unit normal
// into the room, three coordinates), so a view can hide the walls between the camera and the
// room (`applyCutaway`). Partitions are groups with `userData.partition` (their id, also on
// every mesh in them, for picking); they stand inside the room and always stay visible. Unlike
// the item models, the room owns its geometry and materials: dispose a replaced room with
// `disposeRoomObject`.

import * as THREE from "three";
import type { Opening, Partition, Room, Vec2 } from "../model/types";
import { add, bounds, cross, EPS, scale, sub, walls, type Wall } from "../model/geometry";
import { bandPiece, clampPartitionOpening, HATCH_SHELF_DEPTH, HATCH_SHELF_THICKNESS, partitionBand, partitionLength } from "../model/partitions";
import { MM_PER_UNIT } from "./meshes";

/** Spacing of the floor grid lines (mm): one metre, the usual tile module for orientation. */
const GRID_STEP = 1000;
/** Lift of the grid lines above the floor so they do not flicker with it (m). */
const GRID_LIFT = 0.001;
/** Thickness of a window pane as drawn (m). */
const PANE = 0.01;

const COLORS = {
  floor: 0xd4d1cb,
  grid: 0xb3afa8,
  wall: 0xf2f0ec,
  glass: 0xa9c0cc,
  /** Brushed stainless steel of hatch shelves. */
  steel: 0xc4c8cc,
};

const m = (mm: number) => mm / MM_PER_UNIT;

/** The 3D room. All geometry and materials in it belong to it. */
export function buildRoomObject(room: Room): THREE.Group {
  const g = new THREE.Group();
  g.name = "room";
  g.userData.room = true;
  if (room.points.length < 3) return g;

  g.add(buildFloor(room.points));
  const grid = buildGrid(room.points);
  if (grid) g.add(grid);

  const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.9, metalness: 0 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: COLORS.glass,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const steelMat = new THREE.MeshStandardMaterial({ color: COLORS.steel, roughness: 0.35, metalness: 0.6 });
  const mats: Materials = { wall: wallMat, glass: glassMat, steel: steelMat };
  const ws = walls(room);
  const outer = outerCorners(ws, room.wallThickness);
  for (const w of ws) {
    // A repeated corner (an old or hand-edited file) has no wall to build; its corner stays in `outer`.
    if (w.length < EPS) continue;
    const openings = room.openings.filter((o) => o.partition === undefined && o.wall === w.index);
    g.add(buildWall(w, outer[w.index], outer[(w.index + 1) % ws.length], room, openings, mats));
  }
  for (const p of room.partitions) {
    if (partitionLength(p) < EPS) continue;
    const openings = room.openings.filter((o) => o.partition === p.id).map((o) => clampPartitionOpening(p, o));
    g.add(buildPartition(room, p, openings, mats));
  }
  return g;
}

/** Disposes everything a room object owns (geometry and materials). */
export function disposeRoomObject(o: THREE.Object3D): void {
  const mats = new Set<THREE.Material>();
  o.traverse((c) => {
    if (c instanceof THREE.Mesh || c instanceof THREE.LineSegments) {
      c.geometry.dispose();
      for (const mat of Array.isArray(c.material) ? c.material : [c.material]) mats.add(mat);
    }
  });
  for (const mat of mats) mat.dispose();
}

/**
 * Hides the walls that stand between the camera and the room: those whose outside faces the
 * camera (the camera is behind the wall's plane, seen from inside). With `enabled` false all
 * walls show.
 */
export function applyCutaway(roomObject: THREE.Object3D, camera: THREE.Vector3, enabled: boolean): void {
  for (const c of roomObject.children) {
    if (typeof c.userData.wall !== "number") continue;
    if (!enabled) {
      c.visible = true;
      continue;
    }
    const inward = c.userData.inward as THREE.Vector3;
    const start = c.userData.start as THREE.Vector3;
    const toCamera = camera.x * inward.x + camera.z * inward.z - (start.x * inward.x + start.z * inward.z);
    c.visible = toCamera >= 0;
  }
}

// ---------------------------------------------------------------------------------------------

function buildFloor(points: readonly Vec2[]): THREE.Mesh {
  const geo = extrudeOutline(points, 0, 0);
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.85, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "floor";
  mesh.receiveShadow = true;
  mesh.userData.floor = true;
  return mesh;
}

/** Metre grid lines clipped to the room outline, as one line set. */
function buildGrid(points: readonly Vec2[]): THREE.LineSegments | null {
  const b = bounds(points);
  const pos: number[] = [];
  const firstX = Math.ceil(b.minX / GRID_STEP) * GRID_STEP;
  for (let x = firstX; x <= b.maxX; x += GRID_STEP) {
    for (const [y0, y1] of insideRuns(points, x, "x")) pos.push(m(x), GRID_LIFT, m(y0), m(x), GRID_LIFT, m(y1));
  }
  const firstY = Math.ceil(b.minY / GRID_STEP) * GRID_STEP;
  for (let y = firstY; y <= b.maxY; y += GRID_STEP) {
    for (const [x0, x1] of insideRuns(points, y, "y")) pos.push(m(x0), GRID_LIFT, m(y), m(x1), GRID_LIFT, m(y));
  }
  if (pos.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: COLORS.grid }));
  lines.name = "grid";
  lines.raycast = () => {}; // never picked: clicks on the floor clear the selection instead
  return lines;
}

/**
 * The runs of a grid line `axis = v` that lie inside the polygon: the crossings with the edges,
 * sorted and paired (even-odd rule).
 */
export function insideRuns(points: readonly Vec2[], v: number, axis: "x" | "y"): [number, number][] {
  const other = axis === "x" ? "y" : "x";
  const hits: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    // Half-open test so a line through a corner counts it once.
    if (a[axis] > v !== b[axis] > v) {
      const t = (v - a[axis]) / (b[axis] - a[axis]);
      hits.push(a[other] + t * (b[other] - a[other]));
    }
  }
  hits.sort((p, q) => p - q);
  const runs: [number, number][] = [];
  for (let i = 0; i + 1 < hits.length; i += 2) if (hits[i + 1] - hits[i] > EPS) runs.push([hits[i], hits[i + 1]]);
  return runs;
}

/**
 * The outer corner of each wall start: where the outer faces of the wall and the one before it
 * meet, so walls close at every corner, convex or reflex.
 */
function outerCorners(ws: readonly Wall[], thickness: number): Vec2[] {
  return ws.map((w, i) => {
    const prev = ws[(i - 1 + ws.length) % ws.length];
    const p = sub(w.a, scale(w.inward, thickness));
    const q = sub(prev.a, scale(prev.inward, thickness));
    const denom = cross(w.dir, prev.dir);
    // Collinear walls: the outer face simply continues.
    if (Math.abs(denom) < EPS) return p;
    const u = cross(sub(q, p), prev.dir) / denom;
    return add(p, scale(w.dir, u));
  });
}

/** A solid stretch of a wall: from `s0` to `s1` along it, from `y0` to `y1` above the floor (mm). */
interface Piece {
  s0: number;
  s1: number;
  y0: number;
  y1: number;
}

interface Materials {
  wall: THREE.Material;
  glass: THREE.Material;
  steel: THREE.Material;
}

function buildWall(w: Wall, outerStart: Vec2, outerEnd: Vec2, room: Room, openings: readonly Opening[], mats: Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = `wall-${w.index}`;
  g.userData.wall = w.index;
  g.userData.inward = new THREE.Vector3(w.inward.x, 0, w.inward.y);
  g.userData.start = new THREE.Vector3(m(w.a.x), 0, m(w.a.y));

  const t = room.wallThickness;
  const inner = (s: number) => add(w.a, scale(w.dir, s));
  // Outer point at a distance along the wall: the mitred corner at the ends, else straight out.
  const outer = (s: number) =>
    s <= EPS ? outerStart : s >= w.length - EPS ? outerEnd : sub(inner(s), scale(w.inward, t));

  for (const p of wallPieces(w.length, room.height, openings)) {
    const geo = extrudeOutline([inner(p.s0), inner(p.s1), outer(p.s1), outer(p.s0)], p.y0, p.y1);
    const mesh = new THREE.Mesh(geo, mats.wall);
    mesh.receiveShadow = true;
    mesh.userData.wall = w.index;
    g.add(mesh);
  }

  // Across the band: 0 at the inner face, -t at the outer face (along the inward normal).
  const across = (s: number, k: number) => add(inner(s), scale(w.inward, k));
  for (const mesh of openingFittings(openings, w.length, room.height, across, 0, -t, mats)) {
    mesh.userData.wall = w.index;
    g.add(mesh);
  }
  return g;
}

/** A partition: its band (joined at walls and partitions) to its height, with the openings cut out. */
function buildPartition(room: Room, p: Partition, openings: readonly Opening[], mats: Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = `partition-${p.id}`;
  g.userData.partition = p.id;
  const band = partitionBand(room, p);
  for (const piece of wallPieces(band.length, p.height, openings)) {
    const mesh = new THREE.Mesh(extrudeOutline(bandPiece(band, piece.s0, piece.s1), piece.y0, piece.y1), mats.wall);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  const across = (s: number, k: number) => add(add(p.a, scale(band.dir, s)), scale(band.left, k));
  for (const mesh of openingFittings(openings, band.length, p.height, across, p.thickness / 2, -p.thickness / 2, mats)) g.add(mesh);
  g.traverse((o) => (o.userData.partition = p.id));
  return g;
}

/**
 * Panes in windows and the shelves of hatches. `across(s, k)` is the plan point `s` along the
 * wall and `k` across it; the band reaches from `near` to `far` across.
 */
function openingFittings(
  openings: readonly Opening[],
  length: number,
  height: number,
  across: (s: number, k: number) => Vec2,
  near: number,
  far: number,
  mats: Materials,
): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const mid = (near + far) / 2;
  const half = (PANE * MM_PER_UNIT) / 2;
  for (const o of openings) {
    const [s0, s1] = span(o, length);
    if (o.kind === "window") {
      const top = Math.min(o.sill + o.height, height);
      if (top <= o.sill) continue;
      const geo = extrudeOutline([across(s0, mid + half), across(s1, mid + half), across(s1, mid - half), across(s0, mid - half)], o.sill, top);
      const pane = new THREE.Mesh(geo, mats.glass);
      pane.name = "pane";
      out.push(pane);
    } else if (o.kind === "hatch" && o.sill < height) {
      // The stainless counter through the opening, reaching out on both sides.
      const k0 = near + Math.sign(near - far) * HATCH_SHELF_DEPTH;
      const k1 = far + Math.sign(far - near) * HATCH_SHELF_DEPTH;
      const geo = extrudeOutline([across(s0, k0), across(s1, k0), across(s1, k1), across(s0, k1)], o.sill - HATCH_SHELF_THICKNESS, o.sill);
      const shelf = new THREE.Mesh(geo, mats.steel);
      shelf.name = "shelf";
      shelf.castShadow = true;
      shelf.receiveShadow = true;
      out.push(shelf);
    }
  }
  return out;
}

/** An opening's extent along its wall, clamped to the wall (mm). */
function span(o: Opening, length: number): [number, number] {
  return [Math.max(0, o.offset - o.width / 2), Math.min(length, o.offset + o.width / 2)];
}

/**
 * The solid pieces of a wall with openings: full height between openings, and over each
 * opening the parts below its sill and above its head.
 */
export function wallPieces(length: number, height: number, openings: readonly Opening[]): Piece[] {
  const spans = openings
    .map((o) => ({ o, s: span(o, length) }))
    .filter(({ s }) => s[1] - s[0] > EPS)
    .sort((a, b) => a.s[0] - b.s[0]);
  const pieces: Piece[] = [];
  let s = 0;
  for (const { o, s: [s0, s1] } of spans) {
    if (s0 > s + EPS) pieces.push({ s0: s, s1: s0, y0: 0, y1: height });
    const from = Math.max(s0, s);
    if (s1 > from + EPS) {
      if (o.sill > EPS) pieces.push({ s0: from, s1, y0: 0, y1: Math.min(o.sill, height) });
      const head = o.sill + o.height;
      if (head < height - EPS) pieces.push({ s0: from, s1, y0: head, y1: height });
    }
    s = Math.max(s, s1);
  }
  if (s < length - EPS) pieces.push({ s0: s, s1: length, y0: 0, y1: height });
  return pieces;
}

/**
 * A plan outline (mm) extruded from `y0` to `y1` (mm) as three geometry in metres; with equal
 * heights a flat face pointing up. three's extrusion runs along +z of the shape, which is turned
 * to point up; the shape's y is the negated plan y so the plan's y ends up on three's +z.
 */
function extrudeOutline(points: readonly Vec2[], y0: number, y1: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(m(p.x), -m(p.y))));
  const geo =
    y1 - y0 > EPS
      ? new THREE.ExtrudeGeometry(shape, { depth: m(y1 - y0), bevelEnabled: false })
      : new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, m(y0), 0);
  return geo;
}
