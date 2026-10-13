import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CATALOG } from "../model/catalog";
import { itemFromCatalog } from "../model/project";
import { testItem, testProject } from "../model/testProject";
import { buildItemObject, itemIdOf } from "./meshes";
import { disposeMerged, mergeItemObject } from "./merge";
import { buildContactShadows, CONTACT_FEATHER, contactOutline } from "./look";
import { cubeTransform } from "./engine";

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

describe("view cube", () => {
  it("shows the front face to a camera looking north", () => {
    // Camera with no turn looks along -z (north): the cube is not turned either.
    expect(cubeTransform(new THREE.Quaternion())).toBe("matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)");
  });

  it("shows the top face to a camera looking down", () => {
    const down = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const m = cubeTransform(down).slice("matrix3d(".length, -1).split(",").map(Number);
    // The cube's top normal (CSS: -y) must point at the viewer (CSS: +z): column 1, row 2 is -1.
    expect(m[1 * 4 + 2]).toBeCloseTo(-1, 6);
  });
});
