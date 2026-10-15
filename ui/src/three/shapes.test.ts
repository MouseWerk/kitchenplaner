import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Parts } from "../kinds/parts/mesh";
import { mergeItemObject } from "./merge";
import { disposeShared, getShared, isSharedGeometry, sharedShape } from "./shared";
import { arcPoints, extrudeGeometry, latheGeometry, roundedBoxGeometry, tubeGeometry, type Profile } from "./shapes";

const boxOf = (geo: THREE.BufferGeometry) => {
  geo.computeBoundingBox();
  return geo.boundingBox!;
};

/** Triangles as vertex indices. */
function triangles(geo: THREE.BufferGeometry): [number, number, number][] {
  const idx = geo.getIndex()!;
  const out: [number, number, number][] = [];
  for (let i = 0; i < idx.count; i += 3) out.push([idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)]);
  return out;
}

/** The face normal of a triangle (not normalised) and its vertices' mean normal. */
function faceAndNormal(geo: THREE.BufferGeometry, [a, b, c]: [number, number, number]) {
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const p = [a, b, c].map((i) => new THREE.Vector3().fromBufferAttribute(pos, i));
  const face = new THREE.Vector3().crossVectors(p[1].clone().sub(p[0]), p[2].clone().sub(p[0]));
  const n = [a, b, c].reduce((s, i) => s.add(new THREE.Vector3().fromBufferAttribute(nor, i)), new THREE.Vector3());
  return { face, n, centre: p[0].add(p[1]).add(p[2]).divideScalar(3) };
}

/** Every triangle has an area and faces the way its normals point (front faces out). */
function expectWellFormed(geo: THREE.BufferGeometry): void {
  for (const t of triangles(geo)) {
    const { face, n } = faceAndNormal(geo, t);
    expect(face.length()).toBeGreaterThan(0);
    expect(face.dot(n)).toBeGreaterThan(0);
  }
  const nor = geo.getAttribute("normal");
  for (let i = 0; i < nor.count; i++) expect(new THREE.Vector3().fromBufferAttribute(nor, i).length()).toBeCloseTo(1, 5);
}

/** For a convex shape round `c`: every triangle faces away from it. */
function expectOutward(geo: THREE.BufferGeometry, c = new THREE.Vector3()): void {
  for (const t of triangles(geo)) {
    const { face, centre } = faceAndNormal(geo, t);
    expect(face.dot(centre.sub(c))).toBeGreaterThan(0);
  }
}

/** Area of the triangles whose normals point along `dir`. */
function areaFacing(geo: THREE.BufferGeometry, dir: THREE.Vector3): number {
  let area = 0;
  for (const t of triangles(geo)) {
    const { face } = faceAndNormal(geo, t);
    if (face.clone().normalize().dot(dir) > 0.999) area += face.length() / 2;
  }
  return area;
}

describe("rounded boxes", () => {
  it.each(["all", "top", "vertical"] as const)("fill their box exactly, faces out (%s)", (edges) => {
    const geo = roundedBoxGeometry(0.6, 0.85, 0.7, 0.003, 1, edges);
    const b = boxOf(geo);
    expect(b.min.toArray()).toEqual([-0.3, -0.425, -0.35].map((v) => expect.closeTo(v, 6)));
    expect(b.max.toArray()).toEqual([0.3, 0.425, 0.35].map((v) => expect.closeTo(v, 6)));
    expectWellFormed(geo);
    expectOutward(geo);
  });

  it("keep their flat faces flat: the top is the box less its rounded rim", () => {
    const geo = roundedBoxGeometry(1.2, 0.04, 0.7, 0.003, 2);
    expect(areaFacing(geo, new THREE.Vector3(0, 1, 0))).toBeCloseTo((1.2 - 0.006) * (0.7 - 0.006), 6);
    // Square bottom edges ("top"): the whole bottom is flat but for the rounded upright corners.
    const top = roundedBoxGeometry(1.2, 0.04, 0.7, 0.003, 2, "top");
    // Each corner is a polygon of 2 steps per quarter (8 round the circle) instead of a square.
    const r = 0.003;
    const polygon = 0.5 * 8 * r * r * Math.sin((Math.PI * 2) / 8);
    expect(areaFacing(top, new THREE.Vector3(0, -1, 0))).toBeCloseTo(1.2 * 0.7 - 4 * r * r + polygon, 6);
  });

  it("carry UVs in metres round the sides and across the top", () => {
    const geo = roundedBoxGeometry(2, 0.5, 1, 0.01, 2);
    const uv = geo.getAttribute("uv");
    let maxU = 0;
    for (let i = 0; i < uv.count; i++) maxU = Math.max(maxU, uv.getX(i));
    // Round the outside: the straight sides plus a little less than a full circle of 10 mm.
    expect(maxU).toBeGreaterThan(2 * (2 - 0.02) + 2 * (1 - 0.02) + 0.06);
    expect(maxU).toBeLessThan(2 * (2 - 0.02) + 2 * (1 - 0.02) + 2 * Math.PI * 0.01 + 1e-9);
    expect(geo.userData.metricUv).toBe(true);
  });
});

describe("lathes", () => {
  const knob: Profile = [
    [0, 0],
    [0.02, 0],
    [0.02, 0.004],
    [0.016, 0.006],
    [0.015, 0.018],
    [0, 0.02],
  ];

  it("turn a profile round the axis: the box is the largest radius, nothing collapsed at the pole", () => {
    const geo = latheGeometry(knob, { segments: 16 });
    const b = boxOf(geo);
    expect(b.max.x).toBeCloseTo(0.02, 6);
    expect(b.min.z).toBeCloseTo(-0.02, 6);
    expect(b.min.y).toBe(0);
    expect(b.max.y).toBeCloseTo(0.02, 6);
    expectWellFormed(geo);
    expectOutward(geo, new THREE.Vector3(0, 0.01, 0));
  });

  it("keep a hard edge where the profile turns sharply and smooth where it turns gently", () => {
    const geo = latheGeometry(knob, { segments: 16 });
    const pos = geo.getAttribute("position");
    const nor = geo.getAttribute("normal");
    // The corner at (0.02, 0) has a vertex facing down (the bottom) and one facing out (the side).
    const at = (y: number) =>
      Array.from({ length: pos.count }, (_, i) => i).filter((i) => Math.abs(pos.getY(i) - y) < 1e-9 && Math.abs(pos.getX(i) - 0.02) < 1e-6 && Math.abs(pos.getZ(i)) < 1e-9);
    const normals = at(0).map((i) => [nor.getX(i), nor.getY(i)].map((v) => Math.round(v) + 0));
    expect(normals).toContainEqual([0, -1]);
    expect(normals).toContainEqual([1, 0]);
  });

  it("close a profile that returns to its start without caps (a ring)", () => {
    const ring: Profile = Array.from({ length: 9 }, (_, k) => {
      const a = -Math.PI + (k / 8) * Math.PI * 2;
      return [0.2 + 0.01 * Math.cos(a), 0.01 * Math.sin(a), Math.cos(a), Math.sin(a)] as const;
    });
    const geo = latheGeometry(ring, { segments: 24 });
    expect(boxOf(geo).max.x).toBeCloseTo(0.21, 6);
    expectWellFormed(geo);
    // No cap: no triangle lies flat across the hole in the middle.
    for (const t of triangles(geo)) expect(faceAndNormal(geo, t).centre.length()).toBeGreaterThan(0.18);
  });

  it("turn round a rectangle: a pan with round corners, its inside facing in", () => {
    const p = new Parts(new THREE.Group());
    const pan = p.pan("steel", -0.25, 0.25, 0, 0.25, -0.2, 0.2, { wall: 0.01, r: 0.02 });
    const geo = pan.geometry;
    const b = boxOf(geo).clone().translate(pan.position);
    expect(b.min.toArray()).toEqual([-0.25, 0, -0.2].map((v) => expect.closeTo(v, 4)));
    expect(b.max.toArray()).toEqual([0.25, 0.25, 0.2].map((v) => expect.closeTo(v, 4)));
    expectWellFormed(geo);
    // The floor inside faces up and the bottom outside faces down, each nearly the full size.
    expect(areaFacing(geo, new THREE.Vector3(0, 1, 0))).toBeGreaterThan(0.4 * 0.3);
    expect(areaFacing(geo, new THREE.Vector3(0, -1, 0))).toBeGreaterThan(0.4 * 0.3);
  });

  it("make a pan with a rim: the body stands in, the flange reaches the box", () => {
    const p = new Parts(new THREE.Group());
    const pan = p.pan("steel", -0.1, 0.1, 0, 0.1, -0.15, 0.15, { wall: 0.002, r: 0.025, rim: 0.012 });
    const b = boxOf(pan.geometry).clone().translate(pan.position);
    expect(b.max.x).toBeCloseTo(0.1, 4);
    expect(b.min.z).toBeCloseTo(-0.15, 4);
    // Just under the flange the pan is narrower by the rim.
    const pos = pan.geometry.getAttribute("position");
    let below = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.09) below = Math.max(below, pos.getX(i));
    expect(below).toBeCloseTo(0.1 - 0.012, 4);
  });
});

describe("extrusions", () => {
  it("cut holes: the caps are the outline less the holes, the sides face out of the material", () => {
    const outline = [
      [0, 0],
      [1, 0],
      [1, 0.6],
      [0, 0.6],
    ] as const;
    const hole = Array.from({ length: 32 }, (_, k) => [0.5 + 0.2 * Math.cos((k / 32) * Math.PI * 2), 0.3 + 0.2 * Math.sin((k / 32) * Math.PI * 2)] as const);
    const geo = extrudeGeometry("y", 0.04, outline, [hole]);
    const polygon = 0.5 * 32 * 0.04 * Math.sin((Math.PI * 2) / 32);
    expect(areaFacing(geo, new THREE.Vector3(0, 1, 0))).toBeCloseTo(0.6 - polygon, 6);
    expect(areaFacing(geo, new THREE.Vector3(0, -1, 0))).toBeCloseTo(0.6 - polygon, 6);
    expectWellFormed(geo);
    // Hole walls face its middle.
    const nor = geo.getAttribute("normal");
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i) - 0.5, pos.getZ(i) - 0.3);
      if (Math.abs(r - 0.2) < 1e-6 && Math.abs(nor.getY(i)) < 1e-6) {
        expect(nor.getX(i) * (0.5 - pos.getX(i)) + nor.getZ(i) * (0.3 - pos.getZ(i))).toBeGreaterThan(0);
      }
    }
  });

  it.each(["x", "y", "z"] as const)("lay the outline in the right plane along %s", (axis) => {
    const geo = extrudeGeometry(axis, 2, [
      [0, 0],
      [0.1, 0],
      [0.1, 0.3],
      [0, 0.3],
    ]);
    const size = boxOf(geo).getSize(new THREE.Vector3());
    const want = axis === "x" ? [2, 0.3, 0.1] : axis === "y" ? [0.1, 2, 0.3] : [0.1, 0.3, 2];
    expect(size.toArray()).toEqual(want.map((v) => expect.closeTo(v, 6)));
    expectWellFormed(geo);
    expectOutward(geo, boxOf(geo).getCenter(new THREE.Vector3()));
  });
});

describe("tubes", () => {
  it("bend round their corners and stay within the path's box grown by the radius", () => {
    const pts = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0.3, z: 0 },
      { x: 0, y: 0.3, z: 0.2 },
      { x: 0, y: 0.24, z: 0.2 },
    ];
    const geo = tubeGeometry(pts, 0.012, { bend: 0.05, segments: 12, caps: true });
    const b = boxOf(geo);
    expect(b.max.y).toBeCloseTo(0.312, 6);
    expect(b.min.y).toBeCloseTo(0, 6);
    expect(b.max.z).toBeLessThanOrEqual(0.212 + 1e-9);
    expect(b.max.x).toBeCloseTo(0.012, 6);
    expectWellFormed(geo);
    // The length along the tube is the path's, shortened by the bends' corner cuts.
    const uv = geo.getAttribute("uv");
    let len = 0;
    for (let i = 0; i < uv.count; i++) len = Math.max(len, uv.getX(i));
    expect(len).toBeLessThan(0.3 + 0.2 + 0.06);
    // Each 90° bend cuts 2·50 mm of the corner and runs 50 mm·π/2 round it, in straight steps.
    expect(len).toBeGreaterThan(0.56 - 2 * 0.05 * (2 - Math.PI / 2) - 0.001);
  });
});

describe("tubes from awkward points", () => {
  it("skip repeated points and turn back sharply instead of failing", () => {
    const pts = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0.01 },
      { x: 0, y: 0, z: 0.01 },
      { x: 0, y: 0, z: 0 },
    ];
    const geo = tubeGeometry(pts, 0.003, { bend: 0.006, segments: 8, caps: true });
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count * 3; i++) expect(Number.isFinite((pos.array as Float32Array)[i])).toBe(true);
    expect(boxOf(geo).max.z).toBeCloseTo(0.01, 6);
  });
});

describe("the shape cache", () => {
  it("gives every model the same geometry for the same key, and keeps a limit", () => {
    disposeShared();
    const make = () => new THREE.BufferGeometry();
    const a = sharedShape("test a", make);
    expect(sharedShape("test a", make)).toBe(a);
    expect(isSharedGeometry(a)).toBe(true);
    expect(isSharedGeometry(new THREE.BufferGeometry())).toBe(false);
    let disposed = false;
    a.addEventListener("dispose", () => (disposed = true));
    // Filling the cache pushes out the least recently used entry, and disposes it.
    for (let i = 0; i < 5000; i++) sharedShape(`test fill ${i}`, make);
    expect(disposed).toBe(true);
    expect(getShared().shapes.size).toBeLessThanOrEqual(4096);
    expect(isSharedGeometry(a)).toBe(false);
    disposeShared();
  });

  it("keys parts by their size, not their place: equal parts elsewhere share one geometry", () => {
    const p = new Parts(new THREE.Group());
    const a = p.roundedBox("steel", 0, 0.6, 0, 0.85, 0, 0.7, 0.003);
    const b = p.roundedBox("steel", 2, 2.6, 0.1, 0.95, -1, -0.3, 0.003);
    const c = p.roundedBox("steel", 0, 0.6, 0, 0.86, 0, 0.7, 0.003);
    expect(b.geometry).toBe(a.geometry);
    expect(c.geometry).not.toBe(a.geometry);
    const k1 = p.lathe("knob", 0, 0, 0, arcPoints(0, 0.01, 0.01, -Math.PI / 2, Math.PI / 2, 4));
    const k2 = p.lathe("knob", 1, 2, 3, arcPoints(0, 0.01, 0.01, -Math.PI / 2, Math.PI / 2, 4), { axis: "z" });
    expect(k2.geometry).toBe(k1.geometry);
  });
});

describe("merging shaped parts", () => {
  it("keeps their UVs in metres and turns their normals with them", () => {
    const g = new THREE.Group();
    const p = new Parts(g);
    p.roundedBox("steel", -1, 1, 0, 0.5, -0.5, 0.5, 0.01, "all", "z");
    const merged = mergeItemObject(g);
    const geo = (merged.children[0] as THREE.Mesh).geometry;
    const uv = geo.getAttribute("uv");
    let maxU = 0;
    for (let i = 0; i < uv.count; i++) maxU = Math.max(maxU, uv.getX(i));
    // Laid along z the outline round the axis is 2 m × 0.5 m.
    expect(maxU).toBeGreaterThan(2 * (2 - 0.02) + 2 * (0.5 - 0.02));
    expect(maxU).toBeLessThan(5);
    expectWellFormed(geo);
    expectOutward(geo, new THREE.Vector3(0, 0.25, 0));
  });
});
