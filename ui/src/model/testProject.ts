// Fixed test fixtures for the model and render tests: no random ids, no clock.

import { catalogEntry } from "../kinds/registry";
import { rectRoom } from "./geometry";
import { DEFAULT_SETTINGS, FORMAT_VERSION } from "./project";
import type { Item, Project } from "./types";

/**
 * An 8 × 6 m room, 3 m high, 240 mm walls, a 1010 mm door in the south wall near the west end.
 * Items without a position number (0, as `testItem` makes them) get their place in the list.
 */
export function testProject(items: Item[] = []): Project {
  return {
    format: "kitchenplaner",
    version: FORMAT_VERSION,
    info: { name: "Testküche", client: "Gasthaus Krone", author: "MK", date: "2026-10-12" },
    room: {
      points: rectRoom(8000, 6000),
      height: 3000,
      wallThickness: 240,
      // Wall 2 runs from (8000, 6000) west to (0, 6000): offset 6800 puts the door at x 1200.
      openings: [{ id: "door1", kind: "door", wall: 2, offset: 6800, width: 1010, height: 2135, sill: 0 }],
      partitions: [],
    },
    items: items.map((it, i) => (it.pos === 0 ? { ...it, pos: i + 1 } : it)),
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** An item of a catalog entry with a fixed id; without `over.pos` numbered by `testProject`. */
export function testItem(id: string, catalogId: string, x: number, y: number, rotation = 0, over: Partial<Item> = {}): Item {
  const e = catalogEntry(catalogId);
  if (!e) throw new Error(`unknown catalog id ${catalogId}`);
  return {
    id,
    catalogId,
    name: catalogId,
    x,
    y,
    rotation,
    width: e.width,
    depth: e.depth,
    height: e.height,
    elevation: e.elevation,
    connections: { ...e.connections },
    pos: 0,
    ...over,
  };
}
