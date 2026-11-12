// Stress projects for the 3D benchmark (`scripts/bench-3d.mjs`) and the batching tests: a large
// kitchen generated from the catalog, the same on every run.
//
// The items take the catalog entries in order and start again after the last one, so a project
// of 300 has 300 different models and one of 500 has 141 repeats: fewer repeats than a real
// kitchen (rows of the same shelf or table), which makes it the harder case for sharing models.

import { CATALOG } from "../kinds/registry";
import { rectRoom } from "../model/geometry";
import { DEFAULT_SETTINGS, FORMAT_VERSION, itemFromCatalog } from "../model/project";
import type { Item, Project } from "../model/types";

/** Free floor between two rows and between an item and the next (mm). */
const AISLE = 1200;
const GAP = 100;
/** Width of a row before the next one starts (mm). */
const ROW = 24_000;

export function stressProject(count: number): Project {
  const items: Item[] = [];
  let x = AISLE;
  let y = AISLE;
  let rowDepth = 0;
  let row = 0;
  for (let i = 0; i < count; i++) {
    const entry = CATALOG[i % CATALOG.length];
    if (x + entry.width > ROW + AISLE) {
      x = AISLE;
      y += rowDepth + AISLE;
      rowDepth = 0;
      row++;
    }
    // Every other row faces the other way, as counters along both sides of an aisle do.
    const item = itemFromCatalog(entry, x + entry.width / 2, y + entry.depth / 2, row % 2 === 1 ? 180 : 0);
    items.push({ ...item, id: `s${i + 1}`, pos: i + 1 });
    x += entry.width + GAP;
    rowDepth = Math.max(rowDepth, entry.depth);
  }
  const width = ROW + 2 * AISLE;
  const depth = Math.ceil((y + rowDepth + AISLE) / 100) * 100;
  return {
    format: "kitchenplaner",
    version: FORMAT_VERSION,
    info: { name: `Stress ${count}`, client: "", author: "", date: "2026-11-12" },
    room: { points: rectRoom(width, depth), height: 3000, wallThickness: 240, openings: [], partitions: [] },
    items,
    settings: { ...DEFAULT_SETTINGS },
  };
}
