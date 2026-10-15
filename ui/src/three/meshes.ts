// 3D models of the equipment, one group per item. Each kind builds its model from shared parts
// (kinds/<area>/, kinds/parts/mesh.ts); this module places and turns it in the room.
//
// Units: 1 three.js unit = 1 m, y up. Plan (x, y) maps to three (x, z): the plan's y axis
// (south, down on screen) becomes +z. Every model is first built in its own frame, x along the
// width, z towards the front and y up from the item's elevation, then placed and turned.
//
// All meshes reuse the shared unit box and cylinders, cached shaped parts and a fixed set of
// materials (`shared.ts`); the 3D view merges each model per material to keep the draw calls low.

import * as THREE from "three";
import type { Item } from "../model/types";
import { rad } from "../model/geometry";
import { Parts, type Size } from "../kinds/parts/mesh";
import { kindDef, kindOf } from "../kinds/registry";
import { highlightedMaterial, MM_PER_UNIT, NO_SHADOW } from "./shared";

export { disposeShared, MM_PER_UNIT, releaseShared, retainShared } from "./shared";

/**
 * The 3D model of an item, placed and turned in the room. Every mesh carries
 * `userData.itemId` for picking. The group's own geometry and materials are shared; removing
 * it from the scene needs no disposal.
 */
export function buildItemObject(item: Item): THREE.Group {
  const g = new THREE.Group();
  g.name = item.name;
  g.userData.itemId = item.id;
  const s: Size = {
    w: Math.max(item.width, 1) / MM_PER_UNIT,
    d: Math.max(item.depth, 1) / MM_PER_UNIT,
    h: Math.max(item.height, 1) / MM_PER_UNIT,
  };
  const parts = new Parts(g);
  kindDef(kindOf(item.catalogId)).mesh(parts, s, item);

  const noShadow = new Set([...NO_SHADOW].map((id) => parts.s.mat[id]));
  g.traverse((o) => {
    o.userData.itemId = item.id;
    if (o instanceof THREE.Mesh) {
      o.castShadow = !noShadow.has(o.material as THREE.Material);
      o.receiveShadow = true;
    }
  });

  // Plan (x, y) -> three (x, z); a clockwise turn on the plan (y down) is a negative turn about
  // three's y axis (seen from above, with z pointing towards the viewer's bottom).
  g.position.set(item.x / MM_PER_UNIT, item.elevation / MM_PER_UNIT, item.y / MM_PER_UNIT);
  g.rotation.y = -rad(item.rotation);
  g.updateMatrixWorld(true);
  return g;
}

/** Shows an item model as selected (a neutral tint) or plain. */
export function setItemHighlight(g: THREE.Object3D, on: boolean): void {
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const base = (o.userData.baseMaterial as THREE.Material | undefined) ?? (o.material as THREE.Material);
    o.userData.baseMaterial = base;
    o.material = on ? highlightedMaterial(base) : base;
  });
}

/** The item id of a picked object, walking up to the item's group. */
export function itemIdOf(o: THREE.Object3D | null): string | null {
  for (let cur = o; cur; cur = cur.parent) {
    const id = cur.userData.itemId;
    if (typeof id === "string") return id;
  }
  return null;
}
