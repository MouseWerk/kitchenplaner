// Building elements: parts of the building that stand in the room or are set into its floor,
// walls and ceiling.

import { FLUSH_HEIGHT } from "../parts/sizes";
import type { CatalogEntry } from "../types";

/** Lengths of drainage channels (mm). */
const CHANNEL_LENGTHS = [500, 1000, 1500, 2000, 3000] as const;

export const entries: readonly CatalogEntry[] = [
  { id: "column", kind: "column", category: "building", name: "cat.column", description: "catDesc.column", tags: ["stütze", "pfeiler", "säule", "column", "pillar"], width: 400, depth: 400, height: 3000, elevation: 0, connections: {} },
  { id: "column-round", kind: "columnRound", category: "building", name: "cat.columnRound", description: "catDesc.columnRound", tags: ["stütze", "rundstütze", "säule", "rund", "column", "round"], width: 400, depth: 400, height: 3000, elevation: 0, connections: {} },
  { id: "shaft", kind: "shaft", category: "building", name: "cat.shaft", description: "catDesc.shaft", tags: ["schacht", "installationsschacht", "steigschacht", "shaft", "riser"], width: 600, depth: 400, height: 3000, elevation: 0, connections: {} },
  { id: "floor-drain", kind: "floorDrain", category: "building", name: "cat.floorDrain", description: "catDesc.floorDrain", tags: ["bodenablauf", "gully", "ablauf", "bodeneinlauf", "floor drain"], width: 300, depth: 300, height: FLUSH_HEIGHT, elevation: 0, connections: { drain: true } },
  { id: "drain-channel-200", kind: "drainChannel", category: "building", name: "cat.drainChannel200", description: "catDesc.drainChannel", tags: ["rinne", "entwässerungsrinne", "bodenrinne", "kastenrinne", "drainage channel", "gutter"], width: 1000, depth: 200, height: FLUSH_HEIGHT, elevation: 0, connections: { drain: true }, widths: CHANNEL_LENGTHS },
  { id: "drain-channel-300", kind: "drainChannel", category: "building", name: "cat.drainChannel300", description: "catDesc.drainChannel", tags: ["rinne", "entwässerungsrinne", "bodenrinne", "kastenrinne", "drainage channel", "gutter"], width: 1500, depth: 300, height: FLUSH_HEIGHT, elevation: 0, connections: { drain: true }, widths: CHANNEL_LENGTHS },
  { id: "grease-separator", kind: "greaseSeparator", category: "building", name: "cat.greaseSeparator", description: "catDesc.greaseSeparator", tags: ["fettabscheider", "abscheider", "grease separator", "grease trap"], width: 1200, depth: 700, height: 1100, elevation: 0, connections: { drain: true, coldWater: true }, widths: [1000, 1200, 1600] },
  { id: "socket-panel", kind: "socketPanel", category: "building", name: "cat.socketPanel", description: "catDesc.socketPanel", tags: ["steckdose", "steckdosen", "cee", "starkstrom", "elektro", "socket", "outlet"], width: 300, depth: 90, height: 200, elevation: 1150, connections: {} },
  { id: "water-connection", kind: "waterConnection", category: "building", name: "cat.waterConnection", description: "catDesc.waterConnection", tags: ["wasseranschluss", "eckventil", "abfluss", "anschluss", "water connection", "valve"], width: 300, depth: 100, height: 200, elevation: 450, connections: { coldWater: true, hotWater: true, drain: true } },
  { id: "duct", kind: "duct", category: "building", name: "cat.duct", description: "catDesc.duct", tags: ["lüftungskanal", "kanal", "lüftung", "decke", "duct", "ventilation"], width: 2000, depth: 400, height: 300, elevation: 2500, connections: {}, widths: [1000, 1500, 2000, 3000, 4000] },
  { id: "platform", kind: "platform", category: "building", name: "cat.platform", description: "catDesc.platform", tags: ["podest", "sockel", "stufe", "platform", "plinth", "step"], width: 1200, depth: 800, height: 150, elevation: 0, connections: {}, widths: [800, 1000, 1200, 1600, 2000] },
];
