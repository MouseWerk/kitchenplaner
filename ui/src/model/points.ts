// The connection points of the units: derived at run time from the catalog defaults
// (`kinds/parts/points.ts`), the unit's size, rotation and connection values, with the planner's
// overrides (`Item.points`) on top. A unit has one point per active trade (`activeTrades`); its id
// is `<Pos>.<code>` („12.E“), so plans, tables, the CSV and the DXF agree. The file stores only
// the overrides.
//
// The derived values (current, fuse, plug, sizes) are typical values: the UI shows them as
// placeholders, with the note that connection values are typical.

import { alongPos, defaultPoints, heightPos } from "../kinds/parts/points";
import type { Lang } from "../lib/i18n";
import { add, dot, EPS, cross, norm, partitionFaces, scale, sub, toPlan, walls } from "./geometry";
import { activeTrades, DN_SERIES, FUSE_SERIES, inFilter, PLUG_RATING, PLUGS, TRADES, tradeCode, type PointFilter } from "./trades";
import type { Item, ItemPoints, Plug, PointOverride, Room, Trade, Vec2 } from "./types";

/** The values of a point, after the overrides; which ones a trade has is listed in `itemPoints`. */
export interface PointValues {
  /** Electric, gas or refrigeration power (kW). */
  kw?: number;
  voltage?: number;
  /** 1 for 1N~ (230 V), 3 for 3N~ (400 V). */
  phases?: 1 | 3;
  currentA?: number;
  fuseA?: number;
  plug?: Plug;
  /** DN of a pipe, diameter of a duct (mm). */
  dn?: number;
  /** Air volume (m³/h). */
  m3h?: number;
  /** Steam (kg/h). */
  kgH?: number;
  greasy?: boolean;
  note?: string;
}

export interface ConnectionPoint {
  itemId: string;
  pos: number;
  trade: Trade;
  /** Distance from the unit's left edge, seen from the front (mm). */
  fromLeft: number;
  /** Distance from the unit's back edge (mm); more than the depth lies in front. */
  fromBack: number;
  /** Where the point lies on the plan, after the unit's rotation. */
  at: Vec2;
  /** Height above the finished floor (mm). */
  z: number;
  values: PointValues;
  /** The fields the planner set (the others are derived). */
  set: ReadonlySet<keyof PointOverride>;
}

/** Without a voltage, up to this power runs on one phase (16 A at 230 V). */
export const SINGLE_PHASE_MAX_KW = 3.6;
/** Air speed in the duct the duct size is chosen for (m/s): exhaust and supply. */
export const EXHAUST_SPEED = 6;
export const SUPPLY_SPEED = 3;
/** Gas pipe sizes by load: up to 25 kW DN 15, up to 50 kW DN 20, above that DN 25. */
const GAS_DN: readonly [maxKw: number, dn: number][] = [
  [25, 15],
  [50, 20],
];
const GAS_DN_ABOVE = 25;
/** The largest plug a socket default grows to by itself; a bigger one is a catalog decision. */
const AUTO_PLUG_MAX_A = 32;

/**
 * The current of a load (A, one decimal): P/U at 230 V, P/(√3·U) on three phases; cos φ = 1.
 * Right for heating loads, which most kitchen units are; for motor loads (dishwasher pumps,
 * mixers, compressors) a cos φ of 0.8 to 0.85 means about 15–25 % more current. A typical value:
 * the planner sets the data sheet's current where it matters.
 */
export function currentOf(kw: number, voltage: number): number {
  if (!(kw > 0) || !(voltage > 0)) return 0;
  const i = (kw * 1000) / (phasesOf(voltage) === 3 ? Math.sqrt(3) * voltage : voltage);
  return Math.round(i * 10) / 10;
}

/**
 * The fuse for a current: the smallest of `FUSE_SERIES` that carries it. Above the series the
 * current is rounded up to the next 25 A, which a planner then checks anyway.
 */
export function fuseFor(currentA: number): number {
  return FUSE_SERIES.find((f) => f >= currentA) ?? Math.ceil(currentA / 25) * 25;
}

/** 1 phase at 230 V, 3 phases at 400 V (anything from 380 V up). */
export function phasesOf(voltage: number): 1 | 3 {
  return voltage >= 380 ? 3 : 1;
}

/**
 * The plug the catalog asks for, if it carries the fuse; else the next bigger one up to CEE 32 A,
 * else a fixed connection. A Schuko socket is single phase only.
 */
export function fitPlug(plug: Plug, phases: 1 | 3, fuseA: number): Plug {
  if (plug === "fixed") return "fixed";
  const limit = Math.max(AUTO_PLUG_MAX_A, PLUG_RATING[plug]);
  const from = PLUGS.indexOf(plug);
  const fits = PLUGS.slice(from).find((p) => p !== "fixed" && PLUG_RATING[p] <= limit && PLUG_RATING[p] >= fuseA && (p !== "schuko" || phases === 1));
  return fits ?? "fixed";
}

/** The DN of a gas pipe for a load (kW). */
export function gasDn(kw: number): number {
  return GAS_DN.find(([max]) => kw <= max)?.[1] ?? GAS_DN_ABOVE;
}

/** The duct diameter (mm) for an air volume at an air speed, rounded up to the duct series. */
export function ductSize(m3h: number, speed: number): number {
  const d = Math.sqrt((4 * (m3h / 3600 / speed)) / Math.PI) * 1000;
  const series = DN_SERIES.exhaust ?? [];
  return series.find((s) => s >= d - EPS) ?? Math.ceil(d / 10) * 10;
}

/** The fields of an override that hold a value, in file order. */
const OVERRIDE_KEYS: readonly (keyof PointOverride)[] = ["x", "y", "z", "currentA", "fuseA", "plug", "dn", "greasy", "note"];

/** The connection points of a unit, one per active trade in `TRADES` order. */
export function itemPoints(item: Item): ConnectionPoint[] {
  const trades = activeTrades(item.connections);
  if (trades.length === 0) return [];
  const defs = defaultPoints(item);
  const c = item.connections;
  return trades.map((trade) => {
    const d = defs[trade];
    const o: PointOverride = item.points?.[trade] ?? {};
    const fromLeft = o.x ?? alongPos(d.x, item.width);
    const fromBack = o.y ?? alongPos(d.y, item.depth);
    const z = o.z ?? heightPos(d.z, item);
    const catalogDn = typeof d.dn === "number" ? d.dn : undefined;
    const values: PointValues = {};
    switch (trade) {
      case "electric": {
        const kw = c.electricKw ?? 0;
        const voltage = c.voltage ?? (kw <= SINGLE_PHASE_MAX_KW ? 230 : 400);
        const phases = phasesOf(voltage);
        const currentA = o.currentA ?? currentOf(kw, voltage);
        const fuseA = o.fuseA ?? fuseFor(currentA);
        Object.assign(values, { kw, voltage, phases, currentA, fuseA, plug: o.plug ?? fitPlug(d.plug ?? "fixed", phases, fuseA) });
        break;
      }
      case "gas":
        values.kw = c.gasKw;
        values.dn = o.dn ?? catalogDn ?? gasDn(c.gasKw ?? 0);
        break;
      case "exhaust":
        values.m3h = c.exhaustM3h;
        values.dn = o.dn ?? catalogDn ?? ductSize(c.exhaustM3h ?? 0, EXHAUST_SPEED);
        break;
      case "supply":
        values.m3h = c.supplyM3h;
        values.dn = o.dn ?? catalogDn ?? ductSize(c.supplyM3h ?? 0, SUPPLY_SPEED);
        break;
      case "steam":
        values.kgH = c.steamKgH;
        values.dn = o.dn ?? catalogDn;
        break;
      case "refrigeration":
        values.kw = c.refrigerationKw;
        break;
      case "drain":
      case "floorDrain":
        values.dn = o.dn ?? catalogDn;
        values.greasy = o.greasy ?? d.greasy ?? false;
        break;
      case "coldWater":
      case "hotWater":
      case "softWater":
        values.dn = o.dn ?? catalogDn;
        break;
    }
    if (o.note !== undefined) values.note = o.note;
    return {
      itemId: item.id,
      pos: item.pos,
      trade,
      fromLeft,
      fromBack,
      at: toPlan(item, { x: fromLeft - item.width / 2, y: fromBack - item.depth / 2 }),
      z,
      values,
      set: new Set(OVERRIDE_KEYS.filter((k) => o[k] !== undefined)),
    };
  });
}

/** The points of all units (by position number, then trade) that the filter lets through. */
export function projectPoints(items: readonly Item[], filter: PointFilter = "all"): ConnectionPoint[] {
  return [...items]
    .sort((a, b) => a.pos - b.pos)
    .flatMap(itemPoints)
    .filter((p) => inFilter(p.trade, filter));
}

/** The id of a point on plans and in lists: position number and trade code („12.E“). */
export function pointLabel(p: Pick<ConnectionPoint, "pos" | "trade">, lang?: Lang): string {
  return `${p.pos}.${tradeCode(p.trade, lang)}`;
}

/**
 * The item's `points` after changing one point: `patch` sets fields (undefined removes one, back
 * to the derived value), null resets the whole point. An override left empty is dropped, and
 * `points` is undefined when none is left.
 */
export function setPoint(item: Pick<Item, "points">, trade: Trade, patch: Partial<PointOverride> | null): Pick<Item, "points"> {
  const points: ItemPoints = { ...item.points };
  if (patch === null) delete points[trade];
  else {
    const next: Record<string, unknown> = { ...points[trade] };
    for (const [k, v] of Object.entries(patch)) {
      // An emptied note is no note.
      if (v === undefined || (k === "note" && typeof v === "string" && v.trim() === "")) delete next[k];
      else next[k] = v;
    }
    if (Object.keys(next).length > 0) points[trade] = next as PointOverride;
    else delete points[trade];
  }
  return { points: tidy(points) };
}

/**
 * The overrides worth keeping: those of active trades, without empty fields, blank notes or empty
 * overrides, in `TRADES` and file order; undefined when none is left. Run after the connections
 * change, so switching a unit from gas to electric drops its gas override.
 */
export function cleanPoints(item: Pick<Item, "points" | "connections">): ItemPoints | undefined {
  if (!item.points) return undefined;
  const active = new Set(activeTrades(item.connections));
  const kept: ItemPoints = {};
  for (const tr of TRADES) if (active.has(tr) && item.points[tr]) kept[tr] = item.points[tr];
  return tidy(kept);
}

function tidy(points: ItemPoints): ItemPoints | undefined {
  const out: ItemPoints = {};
  for (const tr of TRADES) {
    const o = points[tr];
    if (!o) continue;
    const clean: Record<string, unknown> = {};
    for (const k of OVERRIDE_KEYS) if (o[k] !== undefined) clean[k] = o[k];
    // A blank note is no note: kept, it would read as an override with nothing to reset.
    if (typeof clean.note === "string" && clean.note.trim() === "") delete clean.note;
    if (Object.keys(clean).length > 0) out[tr] = clean as PointOverride;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ---- Dimensions to the walls ----

/** A wall face a point is measured from. */
export interface WallRef {
  kind: "wall" | "partition";
  /** Index of the outer wall, or of the partition in `room.partitions`. */
  index: number;
  /** The partition's id. */
  id?: string;
  /** Distance from the face, at right angles (mm). */
  distance: number;
  /** The foot of the perpendicular on the face. */
  foot: Vec2;
}

/** Two faces count as turned against each other from this angle on (degrees). */
const MIN_TURN = 30;

interface Candidate extends WallRef {
  dir: Vec2;
}

/**
 * The faces a point is dimensioned from: the nearest wall face (or face of a full-height
 * partition) it sees at right angles, then the nearest one turned at least 30° against it. Lower
 * partitions are left out: a dimension from a parapet cannot be set out on site. Fewer than two
 * when the point sees fewer faces.
 */
export function wallRefs(room: Room, at: Vec2): WallRef[] {
  type Face = { kind: WallRef["kind"]; index: number; id?: string; a: Vec2; b: Vec2; dir: Vec2; inward: Vec2; length: number };
  const faces: Face[] = walls(room).map((w) => ({ kind: "wall", index: w.index, a: w.a, b: w.b, dir: w.dir, inward: w.inward, length: w.length }));
  room.partitions.forEach((p, index) => {
    if (p.height < room.height) return;
    for (const f of partitionFaces(p)) faces.push({ kind: "partition", index, id: p.id, a: f.a, b: f.b, dir: f.dir, inward: f.inward, length: f.length });
  });

  const found: Candidate[] = [];
  for (const f of faces) {
    if (f.length < EPS) continue;
    const rel = sub(at, f.a);
    const distance = dot(rel, f.inward);
    const along = dot(rel, f.dir);
    // In front of the face and within its length.
    if (distance < -EPS || along < -EPS || along > f.length + EPS) continue;
    const foot = add(f.a, scale(f.dir, along));
    // Another face between the point and this one hides it (a corner of an L-shaped room).
    if (faces.some((g) => g !== f && crossesStrictly(at, foot, g.a, g.b))) continue;
    found.push({ kind: f.kind, index: f.index, ...(f.id !== undefined ? { id: f.id } : {}), distance, foot, dir: f.dir });
  }
  found.sort((p, q) => p.distance - q.distance);
  const first = found[0];
  if (!first) return [];
  const minCos = Math.cos((MIN_TURN * Math.PI) / 180);
  const second = found.find((c) => Math.abs(dot(norm(c.dir), norm(first.dir))) <= minCos + EPS);
  return [first, second]
    .filter((c): c is Candidate => c !== undefined)
    .map((c): WallRef => ({ kind: c.kind, index: c.index, ...(c.id !== undefined ? { id: c.id } : {}), distance: c.distance, foot: c.foot }));
}

/** Do the segments p–q and a–b cross away from their ends (touching does not count)? */
function crossesStrictly(p: Vec2, q: Vec2, a: Vec2, b: Vec2): boolean {
  const tol = 1e-3;
  const d1 = cross(sub(q, p), sub(a, p));
  const d2 = cross(sub(q, p), sub(b, p));
  const d3 = cross(sub(b, a), sub(p, a));
  const d4 = cross(sub(b, a), sub(q, a));
  const lq = Math.hypot(q.x - p.x, q.y - p.y);
  const lb = Math.hypot(b.x - a.x, b.y - a.y);
  // Signed distances (mm) of each segment's ends from the other's line.
  return d1 * d2 < 0 && d3 * d4 < 0 && Math.abs(d1 / lq) > tol && Math.abs(d2 / lq) > tol && Math.abs(d3 / lb) > tol && Math.abs(d4 / lb) > tol;
}
