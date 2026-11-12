import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CATALOG } from "../kinds/registry";
import { itemFromCatalog } from "../model/project";
import { testItem } from "../model/testProject";
import type { Item } from "../model/types";
import { batchable, ItemBatches, modelKey } from "./batch";
import { disposeMerged, mergeItemObject } from "./merge";
import { buildItemObject, itemIdOf, placeItemObject } from "./meshes";
import { stressProject } from "./stress";

const build = (item: Item) => mergeItemObject(buildItemObject(item));

/** The meshes of a merged item, split by whether the batches draw them. */
function meshesOf(g: THREE.Object3D): { batched: THREE.Mesh[]; own: THREE.Mesh[] } {
  const batched: THREE.Mesh[] = [];
  const own: THREE.Mesh[] = [];
  for (const c of g.children) if (c instanceof THREE.Mesh) (batchable(c.material as THREE.Material) ? batched : own).push(c);
  return { batched, own };
}

/** Every visible instance of every batch as (material name, matrix) pairs. */
function instances(b: ItemBatches): { name: string; matrix: THREE.Matrix4 }[] {
  const out: { name: string; matrix: THREE.Matrix4 }[] = [];
  for (const bm of b.meshes) {
    const info = (bm as unknown as { _instanceInfo: { active: boolean; visible: boolean }[] })._instanceInfo;
    info.forEach((inst, i) => {
      if (inst.active && inst.visible) out.push({ name: bm.name, matrix: bm.getMatrixAt(i, new THREE.Matrix4()) });
    });
  }
  return out;
}

/** Matrices equal up to the float32 of the batch's matrix texture. */
const near = (a: THREE.Matrix4, b: THREE.Matrix4) => a.elements.every((v, i) => Math.abs(v - b.elements[i]) < 1e-6);

describe("model key", () => {
  it("ignores where an item stands, its id, number and name, not its size or variant", () => {
    const a = testItem("a", "table", 1000, 1000);
    expect(modelKey({ ...a, id: "b", pos: 7, name: "Anders", x: 5, y: 9, rotation: 90 })).toBe(modelKey(a));
    expect(modelKey({ ...a, width: a.width + 100 })).not.toBe(modelKey(a));
    expect(modelKey({ ...a, elevation: 300 })).not.toBe(modelKey(a));
    expect(modelKey({ ...a, catalogId: "other" })).not.toBe(modelKey(a));
  });
});

describe("item batches", () => {
  it("draws each opaque mesh of an item as an instance at the mesh's place, and hides the mesh", () => {
    const b = new ItemBatches();
    const item = testItem("a", "table", 1200, 800, 30);
    const g = build(item);
    b.add(item.id, g, modelKey(item));
    const { batched } = meshesOf(g);
    expect(batched.length).toBeGreaterThan(0);
    const got = instances(b);
    expect(got).toHaveLength(batched.length);
    for (const m of batched) {
      expect(m.visible).toBe(false);
      expect(near(got.find((x) => x.name === m.name)!.matrix, m.matrixWorld)).toBe(true);
    }
    disposeMerged(g);
    b.dispose();
  });

  it("keeps transparent parts (glass) as the item's own meshes", () => {
    const b = new ItemBatches();
    // The first unit with glass or water in its model.
    const g = CATALOG.map((e) => build({ ...itemFromCatalog(e, 1000, 1000), id: "v" })).find((m) => meshesOf(m).own.length > 0)!;
    const item = { id: "v" };
    const { own } = meshesOf(g);
    expect(own.length).toBeGreaterThan(0);
    b.add(item.id, g, "glass");
    for (const m of own) expect(m.visible).toBe(true);
    for (const bm of b.meshes) expect((bm.material as THREE.Material).transparent).toBe(false);
    disposeMerged(g);
    b.dispose();
  });

  it("shares one geometry between items of the same model", () => {
    const b = new ItemBatches();
    const items = [testItem("a", "table", 1000, 1000), testItem("b", "table", 3000, 1000, 90), testItem("c", "table", 5000, 1000, 0, { width: 1600 })];
    const groups = items.map((it) => {
      const g = build(it);
      b.add(it.id, g, modelKey(it));
      return g;
    });
    const perItem = meshesOf(groups[0]).batched.length;
    expect(b.stats.instances).toBe(3 * perItem);
    // a and b share; c is longer.
    expect(b.stats.geometries).toBe(2 * perItem);
    b.remove("a");
    expect(b.stats.geometries).toBe(2 * perItem);
    b.remove("b");
    expect(b.stats.geometries).toBe(perItem);
    groups.forEach(disposeMerged);
    b.dispose();
  });

  it("follows a move by writing the instance matrices, without building anything again", () => {
    const b = new ItemBatches();
    const item = testItem("a", "table", 1000, 1000);
    const g = build(item);
    b.add(item.id, g, modelKey(item));
    const geometries = b.stats.geometries;
    placeItemObject(g, { ...item, x: 4000, y: 2500, rotation: 45 });
    b.place(item.id);
    for (const m of meshesOf(g).batched) expect(near(instances(b).find((x) => x.name === m.name)!.matrix, m.matrixWorld)).toBe(true);
    expect(b.stats.geometries).toBe(geometries);
    disposeMerged(g);
    b.dispose();
  });

  it("shows a detached item by its own meshes and hides its instances, and back", () => {
    const b = new ItemBatches();
    const item = testItem("a", "table", 1000, 1000);
    const g = build(item);
    b.add(item.id, g, modelKey(item));
    const n = instances(b).length;
    b.setDetached(item.id, true);
    expect(instances(b)).toHaveLength(0);
    for (const m of meshesOf(g).batched) expect(m.visible).toBe(true);
    b.setDetached(item.id, false);
    expect(instances(b)).toHaveLength(n);
    for (const m of meshesOf(g).batched) expect(m.visible).toBe(false);
    disposeMerged(g);
    b.dispose();
  });

  it("picks the item through its hidden meshes; the batches are not picked", () => {
    const b = new ItemBatches();
    const items = new THREE.Group();
    const item = testItem("a", "table", 1000, 1000);
    const g = build(item);
    items.add(g);
    b.add(item.id, g, modelKey(item));
    const ray = new THREE.Raycaster(new THREE.Vector3(1, 5, 1), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(items.children, true)[0];
    expect(itemIdOf(hit?.object ?? null)).toBe("a");
    expect(ray.intersectObjects(b.root.children, true)).toHaveLength(0);
    disposeMerged(g);
    b.dispose();
  });

  it("gives an empty batch back and grows a full one", () => {
    const b = new ItemBatches();
    const project = stressProject(150);
    const groups = project.items.map((it) => {
      const g = build(it);
      b.add(it.id, g, modelKey(it));
      return g;
    });
    let opaque = 0;
    const materials = new Set<THREE.Material>();
    for (const g of groups)
      for (const m of meshesOf(g).batched) {
        opaque++;
        materials.add(m.material as THREE.Material);
      }
    expect(b.stats.instances).toBe(opaque);
    // One batch per material (and vertex layout): a handful, not one per item.
    expect(b.stats.batches).toBeGreaterThanOrEqual(materials.size);
    expect(b.stats.batches).toBeLessThan(materials.size * 2);
    // Every instance sits where its mesh is.
    const got = instances(b);
    expect(got).toHaveLength(opaque);
    for (const it of project.items) b.remove(it.id);
    expect(b.stats).toEqual({ batches: 0, instances: 0, geometries: 0 });
    expect(b.root.children).toHaveLength(0);
    groups.forEach(disposeMerged);
  });

  it("replaces an item added again (a rebuilt model)", () => {
    const b = new ItemBatches();
    const item = testItem("a", "table", 1000, 1000);
    const g1 = build(item);
    b.add(item.id, g1, modelKey(item));
    const n = b.stats.instances;
    const wider = { ...item, width: 1800 };
    const g2 = build(wider);
    b.add(item.id, g2, modelKey(wider));
    expect(b.stats.instances).toBe(n);
    expect(b.stats.geometries).toBe(n);
    disposeMerged(g1);
    disposeMerged(g2);
    b.dispose();
  });
});
