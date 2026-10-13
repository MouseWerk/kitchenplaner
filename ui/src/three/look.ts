// The look of the 3D view beyond the plain models: surface textures for the room (tiled floor,
// painted walls) and soft contact shadows under the equipment.
//
// The room geometry comes from `room.ts`; this module only dresses its materials, so the room
// stays one source of truth for shapes. Textures are owned by `RoomTextures` (one set per view),
// the contact shadow mesh by its caller (`disposeContactShadows`).

import * as THREE from "three";
import type { Item } from "../model/types";
import { isOverhead, kindOf } from "../model/catalog";
import { footprint } from "../model/geometry";
import { MM_PER_UNIT } from "./meshes";
import { floorTilePixels, TILE, TILES_PER_TEXTURE, toTexture, wallPaintPixels } from "./textures";

/** Width of the soft edge of a contact shadow beyond the footprint (m). */
export const CONTACT_FEATHER = 0.12;
/** Darkness of a contact shadow under the item (0 none, 1 black). */
export const CONTACT_OPACITY = 0.38;
/** Lift of the contact shadows above the floor (m), so they do not flicker with it. */
const CONTACT_LIFT = 0.002;
/** Wall paint texture size on the wall (m per repeat). */
const PAINT_REPEAT_M = 0.5;
/** Strength of the paint's roller texture in the bump map. */
const PAINT_BUMP = 0.6;
/** Strength of the tiles' grout and grain in the bump map. */
const TILE_BUMP = 1.5;

/** The textures one view puts on its room. */
export class RoomTextures {
  readonly tileColor: THREE.Texture;
  readonly tileRough: THREE.Texture;
  readonly paint: THREE.Texture;

  constructor() {
    const tiles = floorTilePixels();
    this.tileColor = toTexture(tiles.color, true);
    this.tileRough = toTexture(tiles.rough, false);
    // Floor UVs are plan metres: one texture repeat spans TILES_PER_TEXTURE tiles.
    const perMetre = MM_PER_UNIT / (TILE * TILES_PER_TEXTURE);
    this.tileColor.repeat.set(perMetre, perMetre);
    this.tileRough.repeat.set(perMetre, perMetre);
    this.paint = toTexture(wallPaintPixels(), false);
    this.paint.repeat.set(1 / PAINT_REPEAT_M, 1 / PAINT_REPEAT_M);
  }

  dispose(): void {
    this.tileColor.dispose();
    this.tileRough.dispose();
    this.paint.dispose();
  }
}

/**
 * Dresses a room object from `buildRoomObject`: tiles on the floor (the metre grid is hidden,
 * the 300 mm tiles give the scale), matt paint on the walls, drawn from both sides so a section
 * cut shows the wall's inside instead of a hole. Unknown parts (from newer room features) keep
 * their own look.
 */
export function applyRoomLook(room: THREE.Object3D, tex: RoomTextures): void {
  room.traverse((o) => {
    if (o.name === "grid") {
      o.visible = false;
      return;
    }
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
    const mat = o.material;
    if (o.userData.floor) {
      mat.color.setHex(0xffffff);
      mat.map = tex.tileColor;
      mat.roughness = 1;
      mat.roughnessMap = tex.tileRough;
      mat.bumpMap = tex.tileRough;
      mat.bumpScale = TILE_BUMP;
      mat.needsUpdate = true;
    } else if (typeof o.userData.wall === "number" && !mat.transparent) {
      mat.bumpMap = tex.paint;
      mat.bumpScale = PAINT_BUMP;
      mat.side = THREE.DoubleSide;
      mat.needsUpdate = true;
    }
  });
}

/**
 * The corners of an item's contact shadow on the floor (plan mm): the footprint, and the
 * footprint grown by the feather. Null for items that do not stand on the floor.
 */
export function contactOutline(item: Item): { inner: { x: number; y: number }[]; outer: { x: number; y: number }[] } | null {
  if (isOverhead(kindOf(item.catalogId))) return null;
  const inner = footprint(item);
  const grown = footprint({ ...item, width: item.width + 2 * CONTACT_FEATHER * MM_PER_UNIT, depth: item.depth + 2 * CONTACT_FEATHER * MM_PER_UNIT });
  return { inner, outer: grown };
}

/**
 * Soft dark patches under every item standing on the floor, as one mesh (one draw call): the
 * footprint at `CONTACT_OPACITY`, fading to nothing over `CONTACT_FEATHER`. They ground the
 * equipment like ambient occlusion would, at no per-frame cost.
 */
export function buildContactShadows(items: readonly Item[]): THREE.Mesh {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const it of items) {
    const o = contactOutline(it);
    if (!o) continue;
    const base = pos.length / 3;
    for (const [ring, alpha] of [
      [o.inner, CONTACT_OPACITY],
      [o.outer, 0],
    ] as const) {
      for (const p of ring) {
        pos.push(p.x / MM_PER_UNIT, CONTACT_LIFT, p.y / MM_PER_UNIT);
        col.push(0, 0, 0, alpha);
      }
    }
    // Inner quad, then a band of two triangles per side between the inner and the outer ring.
    // Both rings run the same way round, so each side is (i, i+1) inner and outer.
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    for (let i = 0; i < 4; i++) {
      const a = base + i;
      const b = base + ((i + 1) % 4);
      idx.push(a, a + 4, b + 4, a, b + 4, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    // Drawn from both sides: the winding depends on the footprint's turn, not worth checking.
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "contact-shadows";
  mesh.raycast = () => {};
  mesh.renderOrder = -1;
  return mesh;
}

export function disposeContactShadows(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
}
