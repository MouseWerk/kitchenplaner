import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CATALOG } from "../kinds/registry";
import { itemFromCatalog } from "../model/project";
import { testItem, testProject } from "../model/testProject";
import { buildItemObject, itemIdOf } from "./meshes";
import { disposeMerged, mergeItemObject, metricUv } from "./merge";
import { buildContactShadows, CONTACT_FEATHER, contactOutline } from "./look";

// Precise (per vertex): a turned item's box is the same however its parts are grouped.
const boxOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o, true);

describe("merged item models", () => {
  for (const entry of CATALOG) {
    it(`${entry.id}: one mesh per material, same box and item id`, () => {
      const item = { ...itemFromCatalog(entry, 2000, 3000), id: `m-${entry.id}`, rotation: 30 };
      const source = buildItemObject(item);
      const merged = mergeItemObject(source);
      const materials = new Set<THREE.Material>();
      let parts = 0;
      source.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          parts++;
          materials.add(o.material as THREE.Material);
        }
      });
      expect(merged.children.length).toBe(materials.size);
      expect(merged.children.length).toBeLessThanOrEqual(parts);
      const a = boxOf(source);
      const b = boxOf(merged);
      expect(b.min.distanceTo(a.min)).toBeLessThan(1e-4);
      expect(b.max.distanceTo(a.max)).toBeLessThan(1e-4);
      for (const c of merged.children) expect(itemIdOf(c)).toBe(item.id);
      // The local box is the model in its own frame: the item's size.
      const size = (merged.userData.localBox as THREE.Box3).getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(item.width / 1000, 4);
      expect(size.z).toBeCloseTo(item.depth / 1000, 4);
      disposeMerged(merged);
    });
  }
});

describe("contact shadows", () => {
  it("lie under floor items only, grown by the feather", () => {
    const table = testItem("t", "table", 4000, 3000);
    const o = contactOutline(table)!;
    expect(o.inner).toHaveLength(4);
    const xs = o.outer.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(table.width + 2 * CONTACT_FEATHER * 1000, 6);
    expect(contactOutline(testItem("h", "hood-wall", 4000, 3000))).toBeNull();
    // Only units standing on the floor cast one: not a slicer on a table, not a drain in the floor.
    expect(contactOutline(testItem("s", "prep-slicer", 4000, 3000))).toBeNull();
    expect(contactOutline(testItem("d", "floor-drain", 4000, 3000))).toBeNull();
  });

  it("are one mesh for the whole kitchen, fading to nothing at the outer edge", () => {
    const p = testProject([testItem("a", "table", 2000, 3000), testItem("b", "range-4", 5000, 450), testItem("h", "hood-wall", 5000, 550)]);
    const mesh = buildContactShadows(p.items);
    const colour = mesh.geometry.getAttribute("color");
    expect(colour.itemSize).toBe(4);
    // Two floor items with 8 corners each; the hood has none.
    expect(colour.count).toBe(16);
    expect(colour.getW(0)).toBeGreaterThan(0);
    expect(colour.getW(4)).toBe(0);
    expect(mesh.geometry.getIndex()!.count).toBe(2 * 30);
  });
});

describe("metric UVs", () => {
  const uvRange = (geo: THREE.BufferGeometry, from: number, to: number) => {
    const uv = geo.getAttribute("uv");
    const us: number[] = [];
    const vs: number[] = [];
    for (let i = from; i < to; i++) {
      us.push(uv.getX(i));
      vs.push(uv.getY(i));
    }
    return [Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs)];
  };

  it("give every face of a scaled box its size in metres, so a large panel is not stretched", () => {
    // A hood-sized box: 2.4 m wide, 0.45 m high, 2 m deep. BoxGeometry lists its faces as
    // +x, -x, +y, -y, +z, -z with four vertices each.
    const geo = metricUv(new THREE.BoxGeometry(1, 1, 1).applyMatrix4(new THREE.Matrix4().makeScale(2.4, 0.45, 2)));
    const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));
    near(uvRange(geo, 0, 4), [2, 0.45]);
    near(uvRange(geo, 8, 12), [2.4, 2]);
    near(uvRange(geo, 16, 20), [2.4, 0.45]);
  });

  it("are the same for a turned part, and the original geometry keeps its UVs", () => {
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const turned = new THREE.Matrix4().makeRotationY(0.7).multiply(new THREE.Matrix4().makeScale(0.6, 0.9, 0.7));
    const geo = metricUv(unit.clone().applyMatrix4(turned));
    const [u, v] = uvRange(geo, 16, 20);
    expect(u).toBeCloseTo(0.6, 6);
    expect(v).toBeCloseTo(0.9, 6);
    expect(uvRange(unit, 16, 20)).toEqual([1, 1]);
  });

  it("measure a cylinder's side around its circumference", () => {
    const geo = metricUv(new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, false).applyMatrix4(new THREE.Matrix4().makeScale(0.1, 0.8, 0.1)));
    // The side: (24 + 1) × 2 vertices first. The polygon's perimeter is a little under π·d.
    const [u, v] = uvRange(geo, 0, 50);
    expect(u).toBeGreaterThan(0.31);
    expect(u).toBeLessThan(Math.PI * 0.1);
    expect(v).toBeCloseTo(0.8, 6);
  });

  it("are what the merged steel parts of an item carry", () => {
    const entry = CATALOG.find((e) => e.id === "hood-island")!;
    const merged = mergeItemObject(buildItemObject({ ...itemFromCatalog(entry, 0, 0), id: "uv" }));
    const steel = merged.children.find((m) => m.name === "steel") as THREE.Mesh;
    const uv = steel.geometry.getAttribute("uv");
    let max = 0;
    for (let i = 0; i < uv.count; i++) max = Math.max(max, Math.abs(uv.getX(i)), Math.abs(uv.getY(i)));
    // 2.4 m wide: UVs reach metres, not just 1.
    expect(max).toBeGreaterThan(2);
    disposeMerged(merged);
  });
});
