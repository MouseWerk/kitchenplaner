// The contract every unit of the catalog keeps, checked for every entry and each of its variants
// (width steps × energies). A new unit passes it without writing a test of its own; a unit that
// needs more room (a tap over the top, a door swing) declares it in its KindDef, never here.

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { de } from "../locales/de";
import { en } from "../locales/en";
import type { Msg } from "../locales/de";
import { itemPoints } from "../model/points";
import { itemFromCatalog, variantPatch } from "../model/project";
import { parseProject, serializeProject } from "../model/serialize";
import { testProject } from "../model/testProject";
import { activeTrades, DN_SERIES, PLUG_RATING } from "../model/trades";
import { ENERGIES, type Connections, type Item, type ItemPoints, type Vec2 } from "../model/types";
import type { Shape } from "../render/drawing";
import { buildItemObject } from "../three/meshes";
import { getShared, isSharedGeometry } from "../three/shared";
import { fitOrthoCamera } from "../three/thumbnails";
import { Front } from "./parts/elevation";
import { AIR_BELOW } from "./parts/pointRules";
import { FLUSH_HEIGHT } from "./parts/sizes";
import { PlanSketch } from "./parts/plan";
import { CATALOG, CATEGORIES, KINDS, kindDef, placementOf, SUBGROUPS, variantConnections, type CatalogEntry, type Energy, type KindDef } from "./registry";

/** Tolerance of 2D drawings (mm): the symbols are exact, this only absorbs rounding. */
const TOL_MM = 1e-6;
/** Tolerance of 3D sizes (m): a tenth of a millimetre, as the mesh tests. */
const TOL_M = 1e-4;
/** The budget of one unit in every variant (kinds/README.md, "Budget"). */
const MAX_PARTS = 200;
const MAX_TRIANGLES = 10_000;
/** Thumbnail aspect of a catalog row (56 × 44 px). */
const THUMB_ASPECT = 56 / 44;
/** How far a floor drain point may lie in front of its unit (mm): tilting pans pour forward. */
const FLOOR_DRAIN_REACH = 600;

const texts: Record<"de" | "en", Record<string, Msg>> = { de, en };

interface Case {
  entry: CatalogEntry;
  def: KindDef;
  /** The variant's label in test names. */
  label: string;
  item: Item;
  energy?: Energy;
}

/** Every entry in every variant, as an item made the way the app makes it. */
function cases(): Case[] {
  const out: Case[] = [];
  for (const entry of CATALOG) {
    const def = kindDef(entry.kind);
    for (const width of entry.widths ?? [entry.width]) {
      for (const energy of entry.energy ?? [undefined]) {
        const base = { ...itemFromCatalog(entry, 0, 0), id: `it-${entry.id}`, pos: 1 };
        const item = { ...base, ...variantPatch(base, entry, { width, energy }) };
        out.push({ entry, def, item, energy, label: `${entry.id} ${width}${energy ? ` ${energy}` : ""}` });
      }
    }
  }
  return out;
}

const ALL = cases();

/** The points a shape covers (arcs sampled along their sweep). */
function pointsOf(s: Shape): Vec2[] {
  switch (s.t) {
    case "poly":
      return s.pts;
    case "circle":
      return [
        { x: s.c.x - s.r, y: s.c.y - s.r },
        { x: s.c.x + s.r, y: s.c.y + s.r },
      ];
    case "arc": {
      const pts: Vec2[] = [];
      for (let i = 0; i <= 16; i++) {
        const a = ((s.a0 + ((s.a1 - s.a0) * i) / 16) * Math.PI) / 180;
        pts.push({ x: s.c.x + s.r * Math.cos(a), y: s.c.y + s.r * Math.sin(a) });
      }
      return pts;
    }
    default:
      return [];
  }
}

const meshesOf = (g: THREE.Object3D) => {
  const out: THREE.Mesh[] = [];
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
};

describe("catalog registry", () => {
  it("has unique entry ids and kinds, and a kind for every entry", () => {
    const ids = CATALOG.map((e) => e.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i), "duplicate ids").toEqual([]);
    const kinds = KINDS.map((k) => k.kind);
    expect(kinds.filter((k, i) => kinds.indexOf(k) !== i), "duplicate kinds").toEqual([]);
    expect(CATALOG.filter((e) => !kinds.includes(e.kind)).map((e) => e.id), "entries without a kind").toEqual([]);
    expect(kinds.filter((k) => !CATALOG.some((e) => e.kind === k)), "kinds no entry uses").toEqual([]);
  });

  it("names every category in both languages", () => {
    for (const c of CATEGORIES) {
      for (const lang of ["de", "en"] as const) expect(texts[lang][`category.${c}`], `${lang} category.${c}`).toBeTruthy();
    }
    expect(CATALOG.filter((e) => !CATEGORIES.includes(e.category)).map((e) => e.id)).toEqual([]);
  });

  it("puts every entry of a large group into one of its sub-groups, named in both languages", () => {
    for (const e of CATALOG) {
      const groups = SUBGROUPS[e.category];
      if (groups) expect(groups, `${e.id} group ${e.group}`).toContain(e.group);
      else expect(e.group, `${e.id} has a sub-group in an undivided group`).toBeUndefined();
    }
    for (const groups of Object.values(SUBGROUPS)) {
      for (const g of groups ?? []) {
        expect(CATALOG.some((e) => e.group === g), `sub-group ${g} is used`).toBe(true);
        for (const lang of ["de", "en"] as const) expect(texts[lang][`group.${g}`], `${lang} group.${g}`).toBeTruthy();
      }
    }
  });
});

describe.each(CATALOG.map((e) => [e.id, e] as const))("entry %s", (_, entry) => {
  it("has its texts in German and English", () => {
    for (const key of [entry.name, ...(entry.description ? [entry.description] : [])]) {
      for (const lang of ["de", "en"] as const) expect(texts[lang][key], `${lang} ${key}`).toBeTruthy();
    }
    for (const tag of entry.tags ?? []) expect(tag, "tags are lower case words").toBe(tag.toLocaleLowerCase().trim());
  });

  it("has sizes in whole millimetres and offers its own width", () => {
    for (const v of [entry.width, entry.depth, entry.height]) expect(Number.isInteger(v) && v > 0, `size ${v}`).toBe(true);
    expect(Number.isInteger(entry.elevation) && entry.elevation >= 0).toBe(true);
    if (entry.widths) {
      expect(entry.widths).toContain(entry.width);
      for (const w of entry.widths) expect(Number.isInteger(w) && w > 0, `width ${w}`).toBe(true);
    }
    const placement = placementOf(entry.kind);
    if (placement === "overhead") expect(entry.elevation, "an overhead unit hangs above the floor").toBeGreaterThan(0);
    if (placement === "tableTop") expect(entry.elevation, "a table-top unit stands on a table").toBeGreaterThan(0);
    if (placement === "flat") expect(entry.elevation, "a flat unit lies on the floor").toBe(0);
    if (placement === "flat" && !kindDef(entry.kind).raised) {
      expect(entry.height, "a unit set into the floor stands flush with it").toBeLessThanOrEqual(FLUSH_HEIGHT);
    }
  });

  it("offers known energies and gives the default variant its connection values", () => {
    if (entry.energy) {
      expect(entry.energy.length).toBeGreaterThan(0);
      expect(new Set(entry.energy).size).toBe(entry.energy.length);
      for (const e of entry.energy) expect(ENERGIES).toContain(e);
    }
    if (entry.variantConnections) {
      expect(variantConnections(entry, { width: entry.width, energy: entry.energy?.[0] })).toEqual(entry.connections);
    }
  });
});

/** What a model looks like, as a sorted list of its parts (material, shape, place and size). */
function looks(item: Item): string[] {
  const r = (v: THREE.Vector3) => v.toArray().map((n) => n.toFixed(4)).join(",");
  return meshesOf(buildItemObject(item))
    .map((m) => `${(m.material as THREE.Material).name} ${m.geometry.name} ${r(m.position)} ${r(m.scale)}`)
    .sort();
}

describe.each(CATALOG.filter((e) => e.energy && e.energy.length > 1).map((e) => [e.id, e] as const))("energies of %s", (_, entry) => {
  it("look different in 3D, so a gas unit is never mistaken for its electric twin", () => {
    for (const c of ALL.filter((x) => x.entry === entry && x.energy !== entry.energy![0])) {
      const twin = ALL.find((x) => x.entry === entry && x.item.width === c.item.width && x.energy === entry.energy![0])!;
      expect(looks(c.item), c.label).not.toEqual(looks(twin.item));
    }
  });
});

describe.each(ALL.map((c) => [c.label, c] as const))("variant %s", (_, { def, item, energy }) => {
  const top = item.elevation + item.height;
  const rise = def.rise ?? 0;

  it("has plausible connection values for its energy", () => {
    const c: Connections = item.connections;
    for (const k of ["electricKw", "voltage", "gasKw", "exhaustM3h"] as const) {
      const v = c[k];
      if (v !== undefined) expect(Number.isFinite(v) && v >= 0, `${k} ${v}`).toBe(true);
    }
    if (c.electricKw) expect(c.voltage, "electric power needs a voltage").toBeGreaterThan(0);
    if (energy === "gas") expect(c.gasKw, "a gas variant has gas power").toBeGreaterThan(0);
    if (energy === "electric") {
      expect(c.electricKw, "an electric variant has electric power").toBeGreaterThan(0);
      expect(c.gasKw ?? 0, "an electric variant has no gas").toBe(0);
    }
    if (energy) expect(item.energy).toBe(energy);
  });

  it("draws its plan symbol inside the footprint (door swings may open to the front)", () => {
    const shapes: Shape[] = [];
    def.plan(new PlanSketch(item, shapes));
    const { width: w, depth: d } = item;
    for (const s of shapes) {
      expect(s.itemId).toBe(item.id);
      // A door swing (arc) or an open door leaf reaches out at the front, at most a leaf's width.
      const swing = s.t === "arc" || s.pen === "opening";
      const front = swing ? d / 2 + w : d / 2;
      for (const p of pointsOf(s)) {
        expect(Math.abs(p.x), `${s.t} x ${p.x}`).toBeLessThanOrEqual(w / 2 + TOL_MM);
        expect(p.y, `${s.t} y ${p.y}`).toBeGreaterThanOrEqual(-d / 2 - TOL_MM);
        expect(p.y, `${s.t} y ${p.y}`).toBeLessThanOrEqual(front + TOL_MM);
      }
    }
  });

  it("draws its own plan outline (if it has one) inside the footprint", () => {
    if (!def.planOutline) return;
    const pts = def.planOutline(item.width, item.depth);
    expect(pts.length).toBeGreaterThanOrEqual(3);
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(item.width / 2 + TOL_MM);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(item.depth / 2 + TOL_MM);
    }
  });

  it("draws its elevation within the projected box (a stand below, a declared rise above)", () => {
    const l = -item.width / 2;
    const r = item.width / 2;
    const bottom = def.elevationBase ? 0 : item.elevation;
    for (const view of ["front", "side"] as const) {
      const shapes: Shape[] = [];
      const f = new Front(item, l, r, shapes);
      def.elevationBase?.(f);
      if (view === "front") def.elevation(f);
      else def.elevationSide?.(f);
      for (const s of shapes) {
        expect(s.itemId).toBe(item.id);
        for (const p of pointsOf(s)) {
          expect(p.x, `${view} x`).toBeGreaterThanOrEqual(l - TOL_MM);
          expect(p.x, `${view} x`).toBeLessThanOrEqual(r + TOL_MM);
          // Drawing Y is minus the height above the floor.
          expect(-p.y, `${view} height`).toBeGreaterThanOrEqual(bottom - TOL_MM);
          expect(-p.y, `${view} height`).toBeLessThanOrEqual(top + rise + TOL_MM);
        }
      }
    }
  });

  it("builds a model that fills width × depth × height at its elevation", () => {
    const b = new THREE.Box3().setFromObject(buildItemObject(item));
    expect(b.min.x).toBeCloseTo(-item.width / 2000, 4);
    expect(b.max.x).toBeCloseTo(item.width / 2000, 4);
    // The back at -z, the front (operating side) at +z.
    expect(b.min.z).toBeCloseTo(-item.depth / 2000, 4);
    expect(b.max.z).toBeCloseTo(item.depth / 2000, 4);
    if (rise > 0) {
      expect(b.max.y).toBeGreaterThanOrEqual(top / 1000 - TOL_M);
      expect(b.max.y).toBeLessThanOrEqual((top + rise) / 1000 + TOL_M);
    } else {
      expect(b.max.y).toBeCloseTo(top / 1000, 4);
    }
    // Units hanging overhead, standing on a table or lying flat start at their elevation (above
    // or at the floor); a floor unit reaches the floor (on a stand if raised).
    expect(b.min.y).toBeCloseTo((def.placement ?? "floor") === "floor" ? 0 : item.elevation / 1000, 4);
  });

  it("turns with the item: the front follows the rotation as in the plan", () => {
    // At 90 degrees the front faces west (-x on the plan and in 3D).
    const turned = { ...item, rotation: 90 };
    const b = new THREE.Box3().setFromObject(buildItemObject(turned));
    expect(b.min.x).toBeCloseTo(-item.depth / 2000, 4);
    expect(b.max.x).toBeCloseTo(item.depth / 2000, 4);
    expect(b.min.z).toBeCloseTo(-item.width / 2000, 4);
    expect(b.max.z).toBeCloseTo(item.width / 2000, 4);
    // Each part of the turned model is the part of the plain one, turned (none depends on the rotation).
    const plain = meshesOf(buildItemObject(item)).map((m) => m.getWorldPosition(new THREE.Vector3()));
    const parts = meshesOf(buildItemObject(turned)).map((m) => m.getWorldPosition(new THREE.Vector3()));
    expect(parts).toHaveLength(plain.length);
    parts.forEach((p, i) => {
      // Plan (x, y) turned 90 degrees clockwise is (-y, x); three's z is the plan's y.
      expect(p.x).toBeCloseTo(-plain[i].z, 6);
      expect(p.z).toBeCloseTo(plain[i].x, 6);
      expect(p.y).toBeCloseTo(plain[i].y, 6);
    });
    // The plan symbol turns the same way.
    const flat: Shape[] = [];
    const rotated: Shape[] = [];
    def.plan(new PlanSketch(item, flat));
    def.plan(new PlanSketch(turned, rotated));
    expect(rotated.map((s) => s.t)).toEqual(flat.map((s) => s.t));
    const turn = (p: Vec2): Vec2 => ({ x: -p.y, y: p.x });
    const anchors = (s: Shape): Vec2[] => (s.t === "poly" ? s.pts : s.t === "circle" || s.t === "arc" ? [s.c] : []);
    flat.forEach((s, i) => {
      const want = anchors(s).map(turn);
      const got = anchors(rotated[i]);
      expect(got).toHaveLength(want.length);
      got.forEach((p, k) => {
        expect(p.x).toBeCloseTo(want[k].x, 6);
        expect(p.y).toBeCloseTo(want[k].y, 6);
      });
    });
  });

  it("marks every mesh with the item id and uses only the shared geometry and materials", () => {
    const shared = getShared();
    const materials = new Set(Object.values(shared.mat));
    const meshes = meshesOf(buildItemObject(item));
    expect(meshes.length).toBeGreaterThan(0);
    for (const m of meshes) {
      expect(m.userData.itemId).toBe(item.id);
      // The unit box and cylinders, or a shaped part from the shared cache: never its own.
      expect(isSharedGeometry(m.geometry), m.geometry.name || m.geometry.type).toBe(true);
      // Shaped parts carry their real size: scaling one would distort its rounds and its UVs.
      if (m.geometry.userData.metricUv) expect(m.scale.toArray(), m.geometry.name).toEqual([1, 1, 1]);
      expect(materials.has(m.material as THREE.Material), (m.material as THREE.Material).name).toBe(true);
      // Wire work is made of rods: a wireframe shows the triangles of the unit box.
      expect((m.material as THREE.MeshStandardMaterial).wireframe, (m.material as THREE.Material).name).not.toBe(true);
    }
  });

  it("stays within the budget of 200 parts and 10 000 triangles", () => {
    const meshes = meshesOf(buildItemObject(item));
    const triangles = meshes.reduce((sum, m) => {
      const g = m.geometry;
      return sum + (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    }, 0);
    expect(meshes.length, "parts").toBeLessThanOrEqual(MAX_PARTS);
    expect(triangles, "triangles").toBeLessThanOrEqual(MAX_TRIANGLES);
  });

  it("shows its energy: a gas variant has the flue outlet in 3D and the plan, an electric one not", () => {
    if (def.flue === false) return;
    const flue = meshesOf(buildItemObject(item)).filter((m) => m.name === "flue");
    if (energy === "gas") expect(flue.length, "flue parts").toBeGreaterThan(0);
    else expect(flue).toEqual([]);
  });

  it("survives saving and opening the project", () => {
    const project = testProject([item]);
    expect(parseProject(serializeProject(project)).items).toEqual([item]);
  });

  it("fits its thumbnail: inside the image with a margin, centred", () => {
    const box = new THREE.Box3().setFromObject(buildItemObject(item));
    const cam = new THREE.OrthographicCamera();
    fitOrthoCamera(cam, box, THUMB_ASPECT);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      expect(p.z).toBeGreaterThan(-1);
      expect(p.z).toBeLessThan(1);
    }
    expect(minX).toBeGreaterThanOrEqual(-1);
    expect(maxX).toBeLessThanOrEqual(1);
    expect(minY).toBeGreaterThanOrEqual(-1);
    expect(maxY).toBeLessThanOrEqual(1);
    expect(Math.max(maxX - minX, maxY - minY)).toBeGreaterThan(1.6);
    expect(minX + maxX).toBeCloseTo(0, 6);
    expect(minY + maxY).toBeCloseTo(0, 6);
  });
});

describe.each(ALL.map((c) => [c.label, c] as const))("connection points of %s", (_, { entry, item, energy }) => {
  const points = itemPoints(item);
  const top = item.elevation + item.height;
  const placement = placementOf(entry.kind);

  it("has one point per active trade", () => {
    expect(points.map((p) => p.trade)).toEqual(activeTrades(item.connections));
  });

  it("puts its points within the footprint (a floor drain up to 600 mm in front)", () => {
    for (const p of points) {
      const front = p.trade === "floorDrain" ? item.depth + FLOOR_DRAIN_REACH : item.depth;
      expect(p.fromLeft, `${p.trade} from left`).toBeGreaterThanOrEqual(0);
      expect(p.fromLeft, `${p.trade} from left`).toBeLessThanOrEqual(item.width);
      expect(p.fromBack, `${p.trade} from back`).toBeGreaterThanOrEqual(0);
      expect(p.fromBack, `${p.trade} from back`).toBeLessThanOrEqual(front);
      expect(p.z, `${p.trade} height`).toBeGreaterThanOrEqual(0);
    }
  });

  it("puts flat points and floor drains at the floor, air at the top, a table-top socket above the table", () => {
    for (const p of points) {
      if (placement === "flat" || p.trade === "floorDrain") expect(p.z, p.trade).toBe(0);
      if ((p.trade === "exhaust" || p.trade === "supply") && !AIR_BELOW.has(entry.kind)) expect(p.z, p.trade).toBe(top);
      if (placement === "tableTop" && p.trade === "electric") expect(p.z).toBeGreaterThan(item.elevation);
    }
  });

  it("gives an electric point a current, a fuse that carries it and a plug that carries the fuse", () => {
    const e = points.find((p) => p.trade === "electric");
    if (!e) return;
    const { currentA, fuseA, plug, phases } = e.values;
    // A tiny load (an exit sign's 10 W) rounds to 0.0 A; the fuse still has its smallest size.
    expect(currentA).toBeGreaterThanOrEqual(0);
    expect(fuseA).toBeGreaterThan(0);
    expect(fuseA).toBeGreaterThanOrEqual(currentA!);
    expect(PLUG_RATING[plug!]).toBeGreaterThanOrEqual(fuseA!);
    if (plug === "schuko") expect(phases, "a Schuko socket has one phase").toBe(1);
  });

  it("has a sized gas point exactly when it burns gas", () => {
    const gas = points.find((p) => p.trade === "gas");
    if (energy === "gas") expect(gas?.values.dn).toBeGreaterThan(0);
    if (energy === "electric") expect(gas).toBeUndefined();
  });

  it("gives every pipe and duct a nominal size of its series", () => {
    for (const p of points) {
      const series = DN_SERIES[p.trade];
      if (!series) continue;
      expect(p.values.dn, p.trade).toBeGreaterThan(0);
      // Ducts beyond the largest round duct stay a computed size (several stubs in practice).
      if (!(p.values.dn! > series[series.length - 1])) expect(series, p.trade).toContain(p.values.dn);
    }
  });

  it("survives saving and opening with every point overridden", () => {
    const over: ItemPoints = {};
    for (const p of points) over[p.trade] = { x: 10, y: 20, z: 30, currentA: 12.5, fuseA: 16, plug: "cee16", dn: 50, greasy: true, note: "Prüfen" };
    const withPoints = { ...item, ...(points.length > 0 ? { points: over } : {}) };
    expect(parseProject(serializeProject(testProject([withPoints]))).items).toEqual([withPoints]);
  });
});
