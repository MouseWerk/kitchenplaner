// The geometry and materials every item model shares: one unit box, one unit cylinder (and a
// lighter one for wires), the shaped parts (`shapes.ts`) cached by their parameters, and a fixed
// set of materials. Models never make geometry or materials of their own; the 3D view merges each
// model per material (`merge.ts`). Brushed steel gets a procedural roughness map, granite and
// wood a colour map (`textures.ts`). Callers that own a renderer hold
// the cache with `retainShared()` and give it back with `releaseShared()`; the last release
// disposes it. The code needs no WebGL context.

import * as THREE from "three";
import { brushedSteelPixels, granitePixels, GRANITE_REPEAT_M, toTexture, WOOD_REPEAT_M, woodPixels } from "./textures";

/** Millimetres per three.js unit (metre). */
export const MM_PER_UNIT = 1000;

/** Segments around a cylinder: round enough at kitchen scale, cheap to draw. */
const CYLINDER_SEGMENTS = 24;
/**
 * Segments around a wire (baskets, grids, guards: 4 to 6 mm rods, often a hundred per item):
 * eight sides read round at that size and cost a third of the triangles.
 */
const WIRE_SEGMENTS = 8;
/**
 * Shaped parts kept in the cache at most. Sizes are part of the key, so resizing an item makes new
 * entries; the least recently used ones go first. The cache only holds the models' sources (the
 * 3D view and the thumbnails draw merged copies), so an evicted entry costs no GPU memory.
 */
const SHAPE_CACHE = 4096;

export interface Shared {
  box: THREE.BoxGeometry;
  cylinder: THREE.CylinderGeometry;
  /** The unit cylinder with fewer sides, for wire work. */
  wireCylinder: THREE.CylinderGeometry;
  /** Shaped parts by key (`sharedShape`), least recently used first. */
  shapes: Map<string, THREE.BufferGeometry>;
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
  | "chrome"
  | "satin"
  | "castIron"
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
  | "slot"
  | "concrete"
  | "knob"
  | "glassDark"
  | "rubber"
  | "paintGray"
  | "granite"
  | "wood"
  | "foodRed"
  | "foodGreen"
  | "foodCream"
  | "foodBrown";

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
  const wireCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, WIRE_SEGMENTS);
  // The roughness map scales the material roughness: its mean is about 0.5, so the base values
  // below are about twice the effective roughness.
  const brushed = toTexture(brushedSteelPixels(), false);
  brushed.repeat.set(BRUSH_REPEAT.u, BRUSH_REPEAT.v);
  const granite = toTexture(granitePixels(), true);
  granite.repeat.set(1 / GRANITE_REPEAT_M, 1 / GRANITE_REPEAT_M);
  const wood = toTexture(woodPixels(), true);
  wood.repeat.set(1 / WOOD_REPEAT_M.along, 1 / WOOD_REPEAT_M.across);
  const mat: Record<MaterialId, THREE.Material> = {
    // Brushed stainless steel: a metal that takes its look from what it reflects, with a fine
    // grain that smears the reflections along the stroke.
    steel: std(0xc9cdd1, 0.9, 0.7, { roughnessMap: brushed }),
    steelDark: std(0x9a9fa5, 0.85, 0.85, { roughnessMap: brushed }),
    handle: std(0xe4e7ea, 1, 0.22),
    // Polished chrome (a chromed griddle plate): a bright, near-mirror metal that reads apart from
    // the brushed body around it. A pure mirror would only show the gray room it reflects and
    // look like more steel; half of it diffuse white lifts it in every light.
    chrome: std(0xffffff, 0.5, 0.1),
    // Satin (bead-blasted) stainless: turned and pressed parts without a grain (hinges, tap
    // levers, knob skirts, burner crowns); softer than polished `handle`, brighter than steelDark.
    satin: std(0xc4c8cc, 0.85, 0.38),
    // Enamelled cast iron (pan supports, burner caps): near black with a satin gloss, so the
    // bars show their rounded tops against the dark burner tray.
    castIron: std(0x161719, 0.15, 0.4),
    top: std(0x2c2e31, 0.35, 0.5),
    // Black glass ceramic: almost no diffuse light, a sharp reflection on top.
    ceramic: std(0x0b0c0e, 0, 0.06),
    zone: std(0x3a3d42, 0, 0.25),
    plate: std(0x1d1e20, 0.6, 0.5),
    glass: std(0x9fb5b4, 0.1, 0.05, { transparent: true, opacity: 0.3, depthWrite: false }),
    // Tinted oven and display glass: dark, glossy, opaque enough to hide the inside.
    glassDark: std(0x14171a, 0, 0.05),
    panel: std(0xeceeef, 0, 0.55),
    panelDark: std(0x34373b, 0.2, 0.55),
    oil: std(0x7a5a22, 0.1, 0.2),
    // Water in basins and wells: light, glossy and see-through enough to show the basin floor.
    water: std(0x9fbfcc, 0, 0.04, { transparent: true, opacity: 0.55, depthWrite: false }),
    // Wires of baskets, grids and guards (`Parts.grid`, `wireBox`, `wireCage`): solid thin rods.
    wire: std(0xb4b9be, 0.8, 0.35),
    // Dark slots, holes and perforations drawn flush on a face (a flue outlet, the punched slots
    // of a perforated shelf, vents). They lie in the plane of the face they are set into; the
    // polygon offset draws them over it instead of flickering.
    slot: std(0x1b1c1e, 0.2, 0.6, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    concrete: std(0xbab7b1, 0, 0.9),
    // Plastic knobs and grips: a dark, slightly glossy thermoset.
    knob: std(0x1b1c1e, 0, 0.36),
    // Rubber of feet, gaskets and wheels: dark and dull.
    rubber: std(0x222325, 0, 0.9),
    // Painted (powder-coated) steel, light gray (about RAL 7035): cold room panels and doors,
    // machine housings that are not stainless.
    paintGray: std(0xc9cbc7, 0, 0.5),
    // Polished dark granite (pizza and pastry tops) and beech (butcher blocks): colour maps in
    // metres like the steel grain.
    granite: std(0xffffff, 0, 0.22, { map: granite }),
    wood: std(0xffffff, 0, 0.62, { map: wood }),
    // Food in wells, pans and displays: muted, moist tones that tell a filled counter from an
    // empty one without turning it into a colour chart.
    foodRed: std(0x94493a, 0, 0.6),
    foodGreen: std(0x6c7d4e, 0, 0.65),
    foodCream: std(0xd9ccad, 0, 0.7),
    foodBrown: std(0x765236, 0, 0.6),
  };
  // Named after their id so tests and debugging can tell the parts apart.
  for (const [id, m] of Object.entries(mat)) m.name = id;
  shared = { box, cylinder, wireCylinder, shapes: new Map(), mat, textures: [brushed, granite, wood], highlighted: new Map() };
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
  shared.wireCylinder.dispose();
  for (const g of shared.shapes.values()) g.dispose();
  for (const m of Object.values(shared.mat)) m.dispose();
  for (const m of shared.highlighted.values()) m.dispose();
  for (const t of shared.textures) t.dispose();
  shared = null;
}

/**
 * A shaped part's geometry by its key (the generator and its quantised parameters): made with
 * `make` on first use, then shared by every model that asks for the same key. The geometry is
 * named after its key.
 */
export function sharedShape(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const { shapes } = getShared();
  let geo = shapes.get(key);
  if (geo) {
    // Most recently used last.
    shapes.delete(key);
  } else {
    geo = make();
    geo.name = key;
    while (shapes.size >= SHAPE_CACHE) {
      const oldest = shapes.keys().next().value as string;
      shapes.get(oldest)!.dispose();
      shapes.delete(oldest);
    }
  }
  shapes.set(key, geo);
  return geo;
}

/** Whether a geometry is one the models share: the unit box or cylinders, or a cached shape. */
export function isSharedGeometry(geo: THREE.BufferGeometry): boolean {
  const s = getShared();
  return geo === s.box || geo === s.cylinder || geo === s.wireCylinder || s.shapes.get(geo.name) === geo;
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
