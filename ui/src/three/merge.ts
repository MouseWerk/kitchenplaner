// Merges an item model into one mesh per material, for the 3D view.
//
// An item model is built from dozens of small shared boxes and cylinders (`meshes.ts`): cheap to
// build, but every part is a draw call, twice with shadows. A kitchen of forty items would cost
// thousands of draw calls a frame, which integrated graphics cannot draw in 16 ms. Merged, an
// item is a handful of draw calls (one per material it uses). The merged geometry belongs to the
// merged object: dispose it with `disposeMerged` when the item is removed or rebuilt.
//
// The shared parts carry the unit box's and cylinder's UVs, 0..1 across every face whatever its
// size, so a texture would be stretched over a 2.4 m hood as far as over a 40 mm leg. Merging
// rescales them to metres (`metricUv`): the brushed grain has the same size on every surface.
// Shaped parts (`shapes.ts`: rounded boxes, lathes, extrusions, tubes) are built at their real
// size with UVs in metres already and are only moved and turned, so they keep their UVs.

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
    const source = child.geometry as THREE.BufferGeometry;
    const placed = source.clone().applyMatrix4(child.matrix);
    // A shaped part someone scaled after all loses its metres: measure it like a unit part.
    const kept = source.userData.metricUv && Math.abs(child.scale.x - 1) + Math.abs(child.scale.y - 1) + Math.abs(child.scale.z - 1) < 1e-9;
    const geo = kept ? placed : metricUv(placed);
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

/**
 * Rescales `geo`'s UVs in place so one UV unit is one metre on the surface. For each triangle
 * the lengths of dP/du and dP/dv (the surface distance per UV unit) scale its vertices' UVs; a
 * scaled box or cylinder is uniform per face, so the faces' triangles agree. Returns `geo`.
 */
export function metricUv(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!uv || !pos) return geo;
  const index = geo.getIndex();
  const count = index ? index.count : pos.count;
  const scale = new Float32Array(pos.count * 2);
  const seen = new Uint8Array(pos.count);
  const p0 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i + 2 < count; i += 3) {
    const [a, b, c] = [i, i + 1, i + 2].map((k) => (index ? index.getX(k) : k));
    p0.fromBufferAttribute(pos, a);
    e1.fromBufferAttribute(pos, b).sub(p0);
    e2.fromBufferAttribute(pos, c).sub(p0);
    const du1 = uv.getX(b) - uv.getX(a);
    const dv1 = uv.getY(b) - uv.getY(a);
    const du2 = uv.getX(c) - uv.getX(a);
    const dv2 = uv.getY(c) - uv.getY(a);
    const det = du1 * dv2 - du2 * dv1;
    // A triangle without UV area (a cylinder cap's centre fan has some) tells nothing.
    if (Math.abs(det) < 1e-12) continue;
    const su = t.copy(e1).multiplyScalar(dv2).addScaledVector(e2, -dv1).length() / Math.abs(det);
    const sv = t.copy(e2).multiplyScalar(du1).addScaledVector(e1, -du2).length() / Math.abs(det);
    for (const v of [a, b, c]) {
      if (seen[v]) continue;
      seen[v] = 1;
      scale[v * 2] = su;
      scale[v * 2 + 1] = sv;
    }
  }
  for (let v = 0; v < pos.count; v++) {
    if (!seen[v]) continue;
    uv.setXY(v, uv.getX(v) * scale[v * 2], uv.getY(v) * scale[v * 2 + 1]);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Disposes the geometry a merged item owns (its materials are shared and stay). */
export function disposeMerged(g: THREE.Object3D): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
