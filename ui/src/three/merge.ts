// Merges an item model into one mesh per material, for the 3D view.
//
// An item model is built from dozens of small shared boxes and cylinders (`meshes.ts`): cheap to
// build, but every part is a draw call, twice with shadows. A kitchen of forty items would cost
// thousands of draw calls a frame, which integrated graphics cannot draw in 16 ms. Merged, an
// item is a handful of draw calls (one per material it uses). The merged geometry belongs to the
// merged object: dispose it with `disposeMerged` when the item is removed or rebuilt.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * One mesh per material of `source` (an item group from `buildItemObject`), placed and turned
 * like it, with the same `userData.itemId` on the group and every mesh. The merged group's
 * `userData.localBox` is the model's box in its own frame (metres), for outlines.
 */
export function mergeItemObject(source: THREE.Group): THREE.Group {
  const byMaterial = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; castShadow: boolean }>();
  for (const child of source.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    child.updateMatrix();
    const geo = (child.geometry as THREE.BufferGeometry).clone().applyMatrix4(child.matrix);
    const mat = child.material as THREE.Material;
    let entry = byMaterial.get(mat);
    if (!entry) {
      entry = { geos: [], castShadow: child.castShadow };
      byMaterial.set(mat, entry);
    }
    entry.geos.push(geo);
  }

  const g = new THREE.Group();
  g.name = source.name;
  g.userData.itemId = source.userData.itemId;
  g.position.copy(source.position);
  g.quaternion.copy(source.quaternion);
  const localBox = new THREE.Box3();
  for (const [mat, { geos, castShadow }] of byMaterial) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) for (const geo of geos) geo.dispose();
    if (!merged) continue;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    localBox.union(merged.boundingBox!);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = mat.name;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.userData.itemId = g.userData.itemId;
    g.add(mesh);
  }
  g.userData.localBox = localBox;
  g.updateMatrixWorld(true);
  return g;
}

/** Disposes the geometry a merged item owns (its materials are shared and stay). */
export function disposeMerged(g: THREE.Object3D): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
