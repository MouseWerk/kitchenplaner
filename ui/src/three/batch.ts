// Draws the items of the 3D view in a few draw calls: one `BatchedMesh` per material.
//
// Merged per item (merge.ts), a kitchen of 500 units is still about 4,000 draw calls, twice that
// in a frame that draws the shadow map; at roughly 4 microseconds of CPU each that alone is more
// than a frame. A batch draws every item of one material in one multi-draw call. Each item keeps
// its place in the batch as an instance with its own matrix, so moving or turning an item writes
// one matrix (the engine moves models instead of rebuilding them) and nothing is merged again.
// Items of the same model (same catalog entry, variant and dimensions: `modelKey`) share one
// geometry in the batch, so twenty identical shelves cost the vertex memory of one.
//
// The item's own merged group stays in the scene with its batched meshes hidden: picking, boxes
// and outlines keep working on it unchanged (the raycaster does not look at `visible`). An item
// is shown by its own meshes instead of the batch while it is detached: the selected items, whose
// material changes to the highlight. Transparent materials (glass, water) are never batched: they
// are sorted per object, and inside a batch they would be sorted against each other instead.

import * as THREE from "three";
import type { Item } from "../model/types";

/** Initial room of a new batch; it doubles when it runs out. */
const INITIAL_INSTANCES = 64;
const INITIAL_VERTICES = 1 << 15;

interface SharedGeometry {
  id: number;
  users: number;
}

interface Batch {
  mesh: THREE.BatchedMesh;
  /** Geometry ids by model key. */
  geometries: Map<string, SharedGeometry>;
  /** Room of the vertex and index buffers. */
  vertices: number;
  indices: number;
}

interface Slot {
  batch: Batch;
  batchKey: string;
  modelKey: string;
  instance: number;
  /** The item's own mesh that the instance stands for. */
  mesh: THREE.Mesh;
}

interface Entry {
  slots: Slot[];
  detached: boolean;
}

/**
 * The key of everything an item's model is built from: two items with the same key build the
 * same geometry and differ only in where they stand. The id, the position number and the name
 * never reach the model.
 */
export function modelKey(item: Item): string {
  const { id: _id, pos: _pos, name: _name, x: _x, y: _y, rotation: _rotation, ...model } = item;
  return JSON.stringify(model);
}

/** True when a mesh of this material can be drawn as part of a batch. */
export function batchable(material: THREE.Material): boolean {
  return !material.transparent;
}

/** The batch a mesh belongs to: its material, its shadow and the layout of its vertices. */
function batchKeyOf(mesh: THREE.Mesh, material: THREE.Material): string {
  const geo = mesh.geometry;
  const attrs = Object.keys(geo.attributes)
    .sort()
    .map((n) => {
      const a = geo.getAttribute(n);
      return `${n}:${a.itemSize}:${a.normalized ? 1 : 0}`;
    })
    .join(",");
  return `${material.uuid}|${mesh.castShadow ? 1 : 0}|${geo.index ? "i" : "n"}|${attrs}`;
}

export class ItemBatches {
  /** Add this to the scene at its origin, next to the items' own groups. */
  readonly root = new THREE.Group();
  private readonly batches = new Map<string, Batch>();
  private readonly entries = new Map<string, Entry>();

  constructor() {
    this.root.name = "item batches";
  }

  /**
   * Takes the merged model of item `id` (from `mergeItemObject`, placed) into the batches and
   * hides its batched meshes. An item already there is replaced.
   */
  add(id: string, object: THREE.Object3D, key: string): void {
    this.remove(id);
    const slots: Slot[] = [];
    object.updateMatrixWorld(true);
    for (const child of object.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      const material = (child.userData.baseMaterial as THREE.Material | undefined) ?? (child.material as THREE.Material);
      if (Array.isArray(child.material) || !batchable(material)) continue;
      const batchKey = batchKeyOf(child, material);
      const batch = this.batchFor(batchKey, child, material);
      let geo = batch.geometries.get(key);
      if (!geo) {
        geo = { id: this.addGeometry(batch, child.geometry), users: 0 };
        batch.geometries.set(key, geo);
      }
      geo.users++;
      if (batch.mesh.instanceCount >= batch.mesh.maxInstanceCount) batch.mesh.setInstanceCount(batch.mesh.maxInstanceCount * 2);
      const instance = batch.mesh.addInstance(geo.id);
      batch.mesh.setMatrixAt(instance, child.matrixWorld);
      child.visible = false;
      slots.push({ batch, batchKey, modelKey: key, instance, mesh: child });
    }
    this.entries.set(id, { slots, detached: false });
  }

  /** Follows the item's group after it was placed again (a move or turn). */
  place(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    for (const s of entry.slots) {
      s.mesh.updateWorldMatrix(true, false);
      s.batch.mesh.setMatrixAt(s.instance, s.mesh.matrixWorld);
    }
  }

  /**
   * Shows the item by its own meshes (detached, for the highlight of the selection) or by the
   * batches again.
   */
  setDetached(id: string, detached: boolean): void {
    const entry = this.entries.get(id);
    if (!entry || entry.detached === detached) return;
    entry.detached = detached;
    for (const s of entry.slots) {
      s.mesh.visible = detached;
      s.batch.mesh.setVisibleAt(s.instance, !detached);
    }
  }

  /** Takes the item out of the batches; its own meshes are left as they are. */
  remove(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.delete(id);
    for (const s of entry.slots) {
      const { mesh, geometries } = s.batch;
      mesh.deleteInstance(s.instance);
      const geo = geometries.get(s.modelKey)!;
      if (--geo.users === 0) {
        mesh.deleteGeometry(geo.id);
        geometries.delete(s.modelKey);
      }
      if (mesh.instanceCount === 0) {
        // An empty batch gives its buffers back; the next item of the material starts a new one.
        this.root.remove(mesh);
        mesh.dispose();
        this.batches.delete(s.batchKey);
      }
    }
  }

  dispose(): void {
    for (const { mesh } of this.batches.values()) mesh.dispose();
    this.batches.clear();
    this.entries.clear();
    this.root.clear();
  }

  /** Batches, instances and shared geometries (tests and the benchmark). */
  get stats(): { batches: number; instances: number; geometries: number } {
    let instances = 0;
    let geometries = 0;
    for (const b of this.batches.values()) {
      instances += b.mesh.instanceCount;
      geometries += b.geometries.size;
    }
    return { batches: this.batches.size, instances, geometries };
  }

  /** The batched meshes (tests). */
  get meshes(): THREE.BatchedMesh[] {
    return [...this.batches.values()].map((b) => b.mesh);
  }

  private batchFor(key: string, mesh: THREE.Mesh, material: THREE.Material): Batch {
    let batch = this.batches.get(key);
    if (batch) return batch;
    const vertices = Math.max(INITIAL_VERTICES, mesh.geometry.getAttribute("position").count);
    const bm = new THREE.BatchedMesh(INITIAL_INSTANCES, vertices, vertices * 2, material);
    bm.name = material.name;
    bm.castShadow = mesh.castShadow;
    bm.receiveShadow = mesh.receiveShadow;
    // The batch's own bounding sphere is computed once and would go stale as items come and
    // move; each instance is culled against the frustum by itself instead.
    bm.frustumCulled = false;
    bm.perObjectFrustumCulled = true;
    // Opaque only (see `batchable`): the depth test decides, the order does not matter.
    bm.sortObjects = false;
    // Picking hits the items' own meshes, which carry the item id.
    bm.raycast = () => {};
    this.root.add(bm);
    batch = { mesh: bm, geometries: new Map(), vertices, indices: vertices * 2 };
    this.batches.set(key, batch);
    return batch;
  }

  /** Adds `geo` to the batch, packing or growing its buffers when they are full. */
  private addGeometry(batch: Batch, geo: THREE.BufferGeometry): number {
    const bm = batch.mesh;
    const v = geo.getAttribute("position").count;
    const i = geo.index ? geo.index.count : 0;
    if (bm.unusedVertexCount < v || bm.unusedIndexCount < i) {
      // Removed geometries leave holes: close them first, grow only when that is not enough.
      bm.optimize();
      if (bm.unusedVertexCount < v || bm.unusedIndexCount < i) {
        batch.vertices = Math.max(batch.vertices * 2, batch.vertices - bm.unusedVertexCount + v);
        batch.indices = Math.max(batch.indices * 2, batch.indices - bm.unusedIndexCount + i);
        bm.setGeometrySize(batch.vertices, batch.indices);
      }
    }
    return bm.addGeometry(geo);
  }
}
