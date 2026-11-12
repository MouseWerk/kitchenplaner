// The connection points in the 3D view: a small stub at each point of the trade filter of the plan
// (`Prefs.points`), where the point lies in the room (`itemPoints`: the plan position `at` and the
// height `z`, after the unit's rotation).
//
// One shape per trade group, so the groups tell apart without colour too: a box for electric, an
// upright pipe for the sanitary trades, a diamond for gas, a duct standing up from the top of the
// unit for air, a cone for steam and refrigeration; a floor drain is a disc on the floor. The
// colours (`STUB_COLOUR`) follow the hues of the DXF layers of the installation drawing, so a
// trade has the same colour in the export and here. A colour is fine in this case: the stubs are
// data in the picture, not a state of the interface.
//
// Most points sit behind or under the unit (50 mm in from its back, 300 mm above the floor), so
// the unit hides them. Each stub is drawn twice: solid where it is in sight, and faint where
// something stands in front of it (a second pass that passes only behind the depth already drawn),
// as the 3D view does for a hidden selection.
//
// A big kitchen has about 1500 points: each trade is one instanced mesh, so the stubs cost at most
// two draw calls per trade, whatever their number. A moved or turned unit rewrites the instance
// matrices; points are derived again only for the units whose object changed. The stubs live in
// their own group, apart from the item models and the batches: they cast no shadow, take no part
// in picking, outlines or contact shadows.

import * as THREE from "three";
import { rad } from "../model/geometry";
import { itemPoints, type ConnectionPoint } from "../model/points";
import { inFilter, TRADE_GROUP, TRADES, type TradeGroup } from "../model/trades";
import type { Item, Trade } from "../model/types";
import type { PointsPref } from "../store/store";
import { MM_PER_UNIT } from "./shared";

export type StubShape = "box" | "pipe" | "diamond" | "duct" | "cone" | "disc";

/** The shape of each trade group; a floor drain has its own (`stubShape`). */
export const GROUP_SHAPE: Readonly<Record<TradeGroup, StubShape>> = {
  electric: "box",
  sanitary: "pipe",
  gas: "diamond",
  ventilation: "duct",
  special: "cone",
};

export function stubShape(trade: Trade): StubShape {
  return trade === "floorDrain" ? "disc" : GROUP_SHAPE[TRADE_GROUP[trade]];
}

/**
 * The stub colours (sRGB), one per DXF layer of the points (`render/dxf.ts`): the waters share
 * one, as do the drains and the air. Electric, gas and water take the signal colours of the
 * materials (`shared.ts`: RAL 3000, 1003, 5015); the others are the DXF layer's hue, toned down
 * for a lit scene. Steam and refrigeration share the cone, so their colours stay far apart.
 */
export const STUB_COLOUR = {
  electric: 0xa8261d,
  gas: 0xe8a90c,
  water: 0x2874b2,
  drain: 0x7a4f2a,
  air: 0x2a9fb0,
  steam: 0x8a4cc2,
  refrigeration: 0x8cc3f0,
} as const;

export type StubColour = keyof typeof STUB_COLOUR;

export const TRADE_COLOUR: Readonly<Record<Trade, StubColour>> = {
  electric: "electric",
  gas: "gas",
  coldWater: "water",
  hotWater: "water",
  softWater: "water",
  drain: "drain",
  floorDrain: "drain",
  exhaust: "air",
  supply: "air",
  steam: "steam",
  refrigeration: "refrigeration",
};

/** Opacity of the part of a stub behind something. */
const HIDDEN_OPACITY = 0.4;
/** Fewest instances a trade's mesh is made for; it grows by doubling. */
const MIN_CAPACITY = 16;
/** A floor drain's disc stands this far above the floor (m), so it does not flicker with it. */
const FLOOR_LIFT = 0.002;

/** The stub shapes in metres, around the point: the duct and the disc stand on it. */
function shapeGeometry(shape: StubShape): THREE.BufferGeometry {
  switch (shape) {
    case "box":
      return new THREE.BoxGeometry(0.07, 0.07, 0.07);
    case "pipe":
      return new THREE.CylinderGeometry(0.02, 0.02, 0.12, 16);
    case "diamond":
      return new THREE.OctahedronGeometry(0.055);
    case "duct":
      return new THREE.CylinderGeometry(0.05, 0.05, 0.2, 20).translate(0, 0.1, 0);
    case "cone":
      return new THREE.ConeGeometry(0.045, 0.11, 16);
    case "disc":
      return new THREE.CylinderGeometry(0.1, 0.1, 0.008, 28).translate(0, 0.004 + FLOOR_LIFT, 0);
  }
}

interface TradeMeshes {
  solid: THREE.InstancedMesh;
  hidden: THREE.InstancedMesh;
}

/** The stubs of all points of the filter; `root` goes into the scene. */
export class PointStubs {
  readonly root = new THREE.Group();
  private filter: PointsPref = "off";
  private items: readonly Item[] = [];
  /** The points of each unit, derived for the item object they were derived from. */
  private readonly derived = new Map<string, { item: Item; points: ConnectionPoint[] }>();
  private readonly meshes = new Map<Trade, TradeMeshes>();
  private readonly geometries = new Map<StubShape, THREE.BufferGeometry>();
  private readonly materials: THREE.Material[] = [];
  private readonly solidMat = new Map<StubColour, THREE.Material>();
  private readonly hiddenMat = new Map<StubColour, THREE.Material>();

  constructor() {
    this.root.name = "points";
    this.root.visible = false;
    for (const [name, hex] of Object.entries(STUB_COLOUR) as [StubColour, number][]) {
      const solid = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0 });
      // Drawn only where something nearer has drawn already: the part of the stub out of sight.
      // The offset pulls it towards the camera, so it never passes behind its own solid pass.
      const hidden = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: HIDDEN_OPACITY,
        depthWrite: false,
        depthFunc: THREE.GreaterDepth,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -4,
      });
      solid.name = hidden.name = `point-${name}`;
      this.solidMat.set(name, solid);
      this.hiddenMat.set(name, hidden);
      this.materials.push(solid, hidden);
    }
  }

  /** Sets the filter; true when the stubs shown changed. */
  setFilter(filter: PointsPref): boolean {
    if (filter === this.filter) return false;
    const was = this.filter;
    this.filter = filter;
    this.root.visible = filter !== "off";
    if (filter === "off") return was !== "off";
    this.layout();
    return true;
  }

  /**
   * Takes the units as they stand now; true when the stubs shown changed. Units whose object is the
   * same as last time keep their points; the others get theirs derived again.
   */
  setItems(items: readonly Item[]): boolean {
    if (items === this.items) return false;
    this.items = items;
    // Off: nothing is derived; turning the filter on catches up.
    if (this.filter === "off") return false;
    this.layout();
    return true;
  }

  /** The number of stubs of a trade, or of all trades. */
  count(trade?: Trade): number {
    if (!this.root.visible) return 0;
    let n = 0;
    for (const [tr, m] of this.meshes) if (!trade || tr === trade) n += m.solid.visible ? m.solid.count : 0;
    return n;
  }

  /** The instanced meshes of a trade (tests and benchmarks). */
  meshesOf(trade: Trade): TradeMeshes | undefined {
    return this.meshes.get(trade);
  }

  dispose(): void {
    for (const m of this.meshes.values()) disposeMeshes(m);
    this.meshes.clear();
    for (const g of this.geometries.values()) g.dispose();
    this.geometries.clear();
    for (const m of this.materials) m.dispose();
    this.root.clear();
    this.derived.clear();
  }

  private pointsOf(item: Item): ConnectionPoint[] {
    const known = this.derived.get(item.id);
    if (known?.item === item) return known.points;
    const points = itemPoints(item);
    this.derived.set(item.id, { item, points });
    return points;
  }

  /** Writes the instance matrices of every stub of the filter. */
  private layout(): void {
    const filter = this.filter;
    if (filter === "off") return;
    const byTrade = new Map<Trade, { point: ConnectionPoint; turn: number }[]>();
    const seen = new Set<string>();
    for (const item of this.items) {
      seen.add(item.id);
      const turn = -rad(item.rotation);
      for (const point of this.pointsOf(item)) {
        if (!inFilter(point.trade, filter)) continue;
        let list = byTrade.get(point.trade);
        if (!list) byTrade.set(point.trade, (list = []));
        list.push({ point, turn });
      }
    }
    for (const id of this.derived.keys()) if (!seen.has(id)) this.derived.delete(id);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    for (const trade of TRADES) {
      const list = byTrade.get(trade) ?? [];
      const meshes = list.length > 0 ? this.ensure(trade, list.length) : this.meshes.get(trade);
      if (!meshes) continue;
      const { solid, hidden } = meshes;
      list.forEach(({ point, turn }, i) => {
        // Plan (x, y) -> three (x, z), as the item models (`placeItemObject`).
        p.set(point.at.x / MM_PER_UNIT, point.z / MM_PER_UNIT, point.at.y / MM_PER_UNIT);
        q.setFromAxisAngle(up, turn);
        solid.setMatrixAt(i, m.compose(p, q, one));
      });
      solid.count = hidden.count = list.length;
      solid.visible = hidden.visible = list.length > 0;
      solid.instanceMatrix.needsUpdate = true;
      if (list.length > 0) {
        solid.computeBoundingSphere();
        hidden.boundingSphere = solid.boundingSphere;
      }
    }
  }

  /** The meshes of a trade with room for `n` stubs; a full one is replaced by one twice the size. */
  private ensure(trade: Trade, n: number): TradeMeshes {
    const known = this.meshes.get(trade);
    if (known && known.solid.instanceMatrix.count >= n) return known;
    let capacity = Math.max(MIN_CAPACITY, known?.solid.instanceMatrix.count ?? 0);
    while (capacity < n) capacity *= 2;
    if (known) {
      this.root.remove(known.solid, known.hidden);
      disposeMeshes(known);
    }
    const shape = stubShape(trade);
    let geo = this.geometries.get(shape);
    if (!geo) this.geometries.set(shape, (geo = shapeGeometry(shape)));
    const colour = TRADE_COLOUR[trade];
    const solid = new THREE.InstancedMesh(geo, this.solidMat.get(colour), capacity);
    const hidden = new THREE.InstancedMesh(geo, this.hiddenMat.get(colour), capacity);
    // Both passes read the same matrices: written once, uploaded once.
    hidden.instanceMatrix = solid.instanceMatrix;
    for (const mesh of [solid, hidden]) {
      mesh.name = `points-${trade}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      // Not for picking: a click on a stub selects the unit behind it, or nothing.
      mesh.raycast = () => {};
      mesh.count = 0;
    }
    solid.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const meshes = { solid, hidden };
    this.meshes.set(trade, meshes);
    this.root.add(solid, hidden);
    return meshes;
  }
}

function disposeMeshes(m: TradeMeshes): void {
  // The geometry and materials are the stubs' own and shared between trades: only the instance
  // buffers go (both meshes share one).
  m.solid.dispose();
  m.hidden.dispose();
}
