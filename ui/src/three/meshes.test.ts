import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CATALOG, isOverhead, kindOf } from "../model/catalog";
import { frontOf } from "../model/geometry";
import type { Item } from "../model/types";
import { buildItemObject, itemIdOf, TAP_RISE } from "./meshes";

/** Tolerance for sizes in metres (a tenth of a millimetre). */
const TOL = 1e-4;

function item(catalogId: string, patch: Partial<Item> = {}): Item {
  const e = CATALOG.find((c) => c.id === catalogId)!;
  return {
    id: `it-${catalogId}`,
    catalogId,
    name: catalogId,
    x: 2000,
    y: 3000,
    rotation: 0,
    width: e.width,
    depth: e.depth,
    height: e.height,
    elevation: e.elevation,
    connections: {},
    ...patch,
  };
}

const boxOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

describe("buildItemObject", () => {
  for (const entry of CATALOG) {
    it(`${entry.id}: fills its footprint and height`, () => {
      const it0 = item(entry.id);
      const b = boxOf(buildItemObject(it0));
      expect(b.min.x).toBeCloseTo((it0.x - it0.width / 2) / 1000, 4);
      expect(b.max.x).toBeCloseTo((it0.x + it0.width / 2) / 1000, 4);
      expect(b.min.z).toBeCloseTo((it0.y - it0.depth / 2) / 1000, 4);
      expect(b.max.z).toBeCloseTo((it0.y + it0.depth / 2) / 1000, 4);

      const top = (it0.elevation + it0.height) / 1000;
      if (entry.kind === "sink") {
        // The tap rises above the worktop, the item's height.
        expect(b.max.y).toBeGreaterThan(top);
        expect(b.max.y).toBeLessThanOrEqual(top + TAP_RISE + TOL);
      } else {
        expect(b.max.y).toBeCloseTo(top, 4);
      }
      // Overhead items hang at their elevation; a combi oven on a stand reaches the floor.
      const bottom = isOverhead(entry.kind) ? it0.elevation / 1000 : 0;
      expect(b.min.y).toBeCloseTo(bottom, 4);
    });
  }

  it("places overhead items at their elevation", () => {
    const hood = item("hood-wall", { elevation: 2100 });
    const b = boxOf(buildItemObject(hood));
    expect(b.min.y).toBeCloseTo(2.1, 4);
    expect(b.max.y).toBeCloseTo(2.1 + hood.height / 1000, 4);
    const shelf = boxOf(buildItemObject(item("wall-shelf")));
    expect(shelf.min.y).toBeCloseTo(1.5, 4);
  });

  it("swaps width and depth when turned by 90 degrees", () => {
    const it90 = item("table", { rotation: 90 });
    const b = boxOf(buildItemObject(it90));
    expect(b.max.x - b.min.x).toBeCloseTo(it90.depth / 1000, 4);
    expect(b.max.z - b.min.z).toBeCloseTo(it90.width / 1000, 4);
  });

  it("turns the front the same way as the plan (frontOf)", () => {
    for (const rotation of [0, 90, 180, 270, 30]) {
      const fridge = item("fridge-700", { rotation });
      const g = buildItemObject(fridge);
      const handles: THREE.Mesh[] = [];
      g.traverse((o) => {
        if (o instanceof THREE.Mesh && (o.material as THREE.Material).name === "handle") handles.push(o);
      });
      expect(handles.length).toBeGreaterThan(0);
      const p = boxOf(handles[0]).getCenter(new THREE.Vector3());
      const front = frontOf(rotation);
      // Plan x -> three x, plan y -> three z.
      const along = (p.x - fridge.x / 1000) * front.x + (p.z - fridge.y / 1000) * front.y;
      // The handle stands at the front face, its centre half a handle behind it.
      expect(along).toBeGreaterThan(fridge.depth / 2000 - 0.02);
      expect(along).toBeLessThan(fridge.depth / 2000);
    }
    // At 90 degrees the front faces west.
    const west = boxOf(buildItemObject(item("fridge-700", { rotation: 90 })));
    expect(west.min.x).toBeCloseTo((2000 - 830 / 2) / 1000, 4);
  });

  it("marks every mesh with the item id", () => {
    for (const entry of CATALOG) {
      const it0 = item(entry.id);
      const g = buildItemObject(it0);
      let meshes = 0;
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          meshes++;
          expect(o.userData.itemId).toBe(it0.id);
          expect(itemIdOf(o)).toBe(it0.id);
        }
      });
      expect(meshes).toBeGreaterThan(0);
    }
  });

  it("shares geometry between items", () => {
    const geos = new Set<THREE.BufferGeometry>();
    for (const entry of CATALOG) {
      buildItemObject(item(entry.id)).traverse((o) => {
        if (o instanceof THREE.Mesh) geos.add(o.geometry);
      });
    }
    expect(geos.size).toBeLessThanOrEqual(2);
  });

  it("draws unknown catalog ids as a table", () => {
    expect(kindOf("from-a-newer-version")).toBe("worktable");
    const b = boxOf(buildItemObject(item("table", { catalogId: "from-a-newer-version" })));
    expect(b.max.y).toBeCloseTo(0.9, 4);
  });
});
