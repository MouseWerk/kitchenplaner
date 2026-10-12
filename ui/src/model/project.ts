// Creating projects and items.

import { catalogEntry, type CatalogEntry } from "./catalog";
import { rectRoom } from "./geometry";
import type { Item, Project } from "./types";
import { t } from "../lib/i18n";

/** The file format version this build writes (`serialize.ts` migrates older ones). */
export const FORMAT_VERSION = 1;

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
    },
    items: [],
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

/** A new item from a catalog entry, centred at (x, y). */
export function itemFromCatalog(entry: CatalogEntry, x: number, y: number, rotation = 0): Item {
  return {
    id: newId(),
    catalogId: entry.id,
    name: t(entry.name),
    x,
    y,
    rotation,
    width: entry.width,
    depth: entry.depth,
    height: entry.height,
    elevation: entry.elevation,
    connections: { ...entry.connections },
  };
}

/** The position number of every item (1-based, in list order): the "Pos." of plan and list. */
export function positions(project: Pick<Project, "items">): Map<string, number> {
  return new Map(project.items.map((it, i) => [it.id, i + 1]));
}

export function entryOf(item: Item): CatalogEntry | undefined {
  return catalogEntry(item.catalogId);
}
