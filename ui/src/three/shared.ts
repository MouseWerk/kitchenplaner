// The geometry and materials every item model shares: one unit box, one unit cylinder and a fixed
// set of materials, so a kitchen with a hundred items creates no new GPU buffers when it changes.
// Brushed steel gets a procedural roughness map (`textures.ts`). Callers that own a renderer hold
// the cache with `retainShared()` and give it back with `releaseShared()`; the last release
// disposes it. The code needs no WebGL context.

import * as THREE from "three";
import { brushedSteelPixels, toTexture } from "./textures";

/** Millimetres per three.js unit (metre). */
export const MM_PER_UNIT = 1000;

/** Segments around a cylinder: round enough at kitchen scale, cheap to draw. */
const CYLINDER_SEGMENTS = 24;

export interface Shared {
  box: THREE.BoxGeometry;
  cylinder: THREE.CylinderGeometry;
  mat: Record<MaterialId, THREE.Material>;
  textures: THREE.Texture[];
  /** Selected look of each material, made on first use. */
  highlighted: Map<THREE.Material, THREE.Material>;
}

/**
 * Selected items glow faintly in a neutral gray: a lift in brightness that reads on every
 * colour of steel and panel, without an accent colour.
 */
const HIGHLIGHT_EMISSIVE = 0x2e2e2e;

export type MaterialId =
  | "steel"
  | "steelDark"
  | "handle"
  | "top"
  | "ceramic"
  | "zone"
  | "plate"
  | "glass"
  | "panel"
  | "panelDark"
  | "oil"
  | "water"
  | "wire"
  | "flue"
  | "concrete"
  | "knob"
  | "glassDark"
  | "rubber";

/** Materials that should not darken what is behind them in shadows. */
export const NO_SHADOW: ReadonlySet<MaterialId> = new Set<MaterialId>(["glass", "water", "wire"]);

let shared: Shared | null = null;
let holders = 0;

function std(color: number, metalness: number, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

/**
 * Brushed grain repeats per metre (merged models have UVs in metres, `merge.ts`): finer across
 * the stroke, so the 256 rows of the map are hairlines of half a millimetre on every surface,
 * below a pixel from a normal viewing distance (the mipmaps then average them into a sheen).
 */
export const BRUSH_REPEAT = { u: 1, v: 8 };

export function getShared(): Shared {
  if (shared) return shared;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, CYLINDER_SEGMENTS);
  // The roughness map scales the material roughness: its mean is about 0.5, so the base values
  // below are about twice the effective roughness.
  const brushed = toTexture(brushedSteelPixels(), false);
  brushed.repeat.set(BRUSH_REPEAT.u, BRUSH_REPEAT.v);
  const mat: Record<MaterialId, THREE.Material> = {
    // Brushed stainless steel: a metal that takes its look from what it reflects, with a fine
    // grain that smears the reflections along the stroke.
    steel: std(0xc9cdd1, 0.9, 0.7, { roughnessMap: brushed }),
    steelDark: std(0x9a9fa5, 0.85, 0.85, { roughnessMap: brushed }),
    handle: std(0xe4e7ea, 1, 0.22),
    top: std(0x2c2e31, 0.35, 0.5),
    // Black glass ceramic: almost no diffuse light, a sharp reflection on top.
    ceramic: std(0x0b0c0e, 0, 0.06),
    zone: std(0x3a3d42, 0, 0.25),
    plate: std(0x1d1e20, 0.6, 0.5),
    glass: std(0x9fb2bd, 0.1, 0.05, { transparent: true, opacity: 0.3, depthWrite: false }),
    // Tinted oven and display glass: dark, glossy, opaque enough to hide the inside.
    glassDark: std(0x14171a, 0, 0.05),
    panel: std(0xeceeef, 0, 0.55),
    panelDark: std(0x34373b, 0.2, 0.55),
    oil: std(0x7a5a22, 0.1, 0.2),
    // Water in basins and wells: light, glossy and see-through enough to show the basin floor.
    water: std(0x9fbfcc, 0, 0.04, { transparent: true, opacity: 0.55, depthWrite: false }),
    // Wires of baskets, grids and guards (`Parts.grid`, `wireBox`, `wireCage`): solid thin rods.
    wire: std(0xb4b9be, 0.8, 0.35),
    // The dark slots of a gas unit's flue outlet (kinds/parts/flue.ts). They lie in the plane of
    // the top they are set into; the polygon offset draws them over it instead of flickering.
    flue: std(0x1b1c1e, 0.2, 0.6, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    concrete: std(0xbab7b1, 0, 0.9),
    knob: std(0x1b1c1e, 0, 0.45),
    rubber: std(0x222325, 0, 0.9),
  };
  // Named after their id so tests and debugging can tell the parts apart.
  for (const [id, m] of Object.entries(mat)) m.name = id;
  shared = { box, cylinder, mat, textures: [brushed], highlighted: new Map() };
  return shared;
}

/** Holds the shared geometry and materials for a renderer that draws item models. */
export function retainShared(): void {
  holders++;
}

/** Gives the shared parts back; the last holder disposes them (they are rebuilt on next use). */
export function releaseShared(): void {
  holders = Math.max(0, holders - 1);
  if (holders === 0) disposeShared();
}

/** Disposes the shared geometry and materials now, whoever holds them. */
export function disposeShared(): void {
  if (!shared) return;
  shared.box.dispose();
  shared.cylinder.dispose();
  for (const m of Object.values(shared.mat)) m.dispose();
  for (const m of shared.highlighted.values()) m.dispose();
  for (const t of shared.textures) t.dispose();
  shared = null;
}

/** The selected look of a material: a clone with the neutral highlight glow, made once. */
export function highlightedMaterial(base: THREE.Material): THREE.Material {
  const s = getShared();
  let lit = s.highlighted.get(base);
  if (!lit) {
    lit = base.clone();
    if (lit instanceof THREE.MeshStandardMaterial) lit.emissive.setHex(HIGHLIGHT_EMISSIVE);
    s.highlighted.set(base, lit);
  }
  return lit;
}
