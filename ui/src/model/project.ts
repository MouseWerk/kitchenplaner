// Creating projects and items.

import { catalogEntry, defaultVariant, variantConnections, type CatalogEntry, type Variant } from "../kinds/registry";
import { bounds, rectRoom } from "./geometry";
import type { Item, ItemSpec, Project, ProjectSettings } from "./types";
import { t } from "../lib/i18n";

/** The file format version this build writes (`serialize.ts` migrates older ones). */
export const FORMAT_VERSION = 3;

/**
 * Settings of a new project and of files written before version 3. Simultaneity 1 means the
 * plain sum: no norm gives a factor for kitchens, so the app assumes none until the planner sets
 * one, and the totals of an older file stay what they were.
 */
export const DEFAULT_SETTINGS: ProjectSettings = { simultaneity: 1 };

/** Range of the simultaneity factor (the project panel offers steps of 0.05). */
export const MIN_SIMULTANEITY = 0.1;
export const MAX_SIMULTANEITY = 1;

/** Default room: 8 × 6 m, 3 m high, 240 mm walls, one door in the south wall. */
export function newProject(today: Date = new Date()): Project {
  return {
    format: "kitchenplaner",
    version: FORMAT_VERSION,
    info: { name: t("app.untitled"), client: "", author: "", date: isoDate(today) },
    room: {
      points: rectRoom(8000, 6000),
      height: 3000,
      wallThickness: 240,
      openings: [{ id: newId(), kind: "door", wall: 2, offset: 6800, width: 1010, height: 2135, sill: 0 }],
      partitions: [],
    },
    items: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let counter = 0;

/** A short id, unique within a project and across sessions. */
export function newId(): string {
  counter = (counter + 1) % 1_000_000;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * A new item from a catalog entry, centred at (x, y): its default variant. It has no position
 * number yet (0): adding it to a project gives it one (`numberNew`).
 */
export function itemFromCatalog(entry: CatalogEntry, x: number, y: number, rotation = 0): Item {
  const v = defaultVariant(entry);
  return {
    id: newId(),
    pos: 0,
    catalogId: entry.id,
    name: t(entry.name),
    x,
    y,
    rotation,
    width: entry.width,
    depth: entry.depth,
    height: entry.height,
    elevation: entry.elevation,
    connections: variantConnections(entry, v),
    ...(v.energy !== undefined ? { energy: v.energy } : {}),
  };
}

/**
 * The change of an item switched to another variant of its entry (a width step or an energy).
 * The connection values follow the variant when the entry gives them per variant, or when the
 * energy changes; otherwise the item keeps its own (possibly edited) values.
 */
export function variantPatch(item: Item, entry: CatalogEntry, change: Partial<Variant>): Partial<Item> {
  const current = item.energy ?? entry.energy?.[0];
  const v: Variant = { width: change.width ?? item.width, energy: change.energy ?? current };
  const patch: Partial<Item> = { width: v.width };
  if (v.energy !== undefined) patch.energy = v.energy;
  if (entry.variantConnections || v.energy !== current) patch.connections = variantConnections(entry, v);
  return patch;
}

/** The position number of every item: the "Pos." of plan, elevations, checks and list. */
export function positions(project: Pick<Project, "items">): Map<string, number> {
  return new Map(project.items.map((it) => [it.id, it.pos]));
}

/** The number the next new item gets: one above the highest, so deleted numbers are not reused. */
export function nextPos(items: readonly Item[]): number {
  return items.reduce((m, it) => Math.max(m, it.pos), 0) + 1;
}

/**
 * `added` with new position numbers after those of `existing`, in their order: new, pasted and
 * duplicated items. A copy is another position, so it never keeps its original's number.
 */
export function numberNew(existing: readonly Item[], added: readonly Item[]): Item[] {
  const first = nextPos(existing);
  return added.map((it, i) => ({ ...it, pos: first + i }));
}

/**
 * Makes the position numbers valid: an item keeps its number when it is a whole number >= 1 that
 * no item before it in the list has; every other one gets the next free number above the highest,
 * in list order. Deterministic, so a damaged file always opens with the same numbers.
 */
export function repairPositions(items: readonly Item[]): Item[] {
  const seen = new Set<number>();
  const keep = items.map((it) => {
    const ok = Number.isInteger(it.pos) && it.pos >= 1 && !seen.has(it.pos);
    if (ok) seen.add(it.pos);
    return ok;
  });
  let next = Math.max(0, ...seen) + 1;
  return items.map((it, i) => (keep[i] ? it : { ...it, pos: next++ }));
}

/**
 * The items numbered 1 to n as a walk round the room: clockwise around the centre of the room,
 * starting in the top left (north-west) corner of the plan, so the numbers run along the walls as
 * a reader follows them. Items in the same direction from the centre go nearest first. The list
 * keeps its order; only the numbers change.
 */
export function renumberPositions(project: Pick<Project, "items" | "room">): Item[] {
  const b = bounds(project.room.points);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  // Plan y points down, so atan2 grows clockwise on screen; north-west is -135°.
  const START = (-3 * Math.PI) / 4;
  const key = (it: Item) => {
    let a = Math.atan2(it.y - cy, it.x - cx) - START;
    while (a < 0) a += 2 * Math.PI;
    while (a >= 2 * Math.PI) a -= 2 * Math.PI;
    // Round so items on one line along a wall do not reorder on float noise.
    return { a: Math.round(a * 1e6) / 1e6, d: Math.hypot(it.x - cx, it.y - cy) };
  };
  const order = project.items
    .map((it, i) => ({ it, i, k: key(it) }))
    .sort((p, q) => p.k.a - q.k.a || p.k.d - q.k.d || p.it.pos - q.it.pos || p.i - q.i);
  const pos = new Map(order.map((o, n) => [o.it.id, n + 1]));
  return project.items.map((it) => ({ ...it, pos: pos.get(it.id) ?? it.pos }));
}

/**
 * A product as the inspector stores it: text trimmed, empty fields and a price of 0 left out
 * (the price field shows 0 for "none"); undefined when nothing is left, so the file has no `spec`.
 */
export function cleanSpec(spec: ItemSpec): ItemSpec | undefined {
  const out: ItemSpec = {};
  for (const k of ["manufacturer", "model", "article"] as const) {
    const v = spec[k]?.trim();
    if (v) out[k] = v;
  }
  if (spec.price !== undefined && spec.price > 0) out.price = spec.price;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function entryOf(item: Item): CatalogEntry | undefined {
  return catalogEntry(item.catalogId);
}
