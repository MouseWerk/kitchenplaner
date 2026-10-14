// Food preparation: work tables, cabinets and drawer units (sidebar group "tables"), and
// preparation machines (group "prep"). Table-top machines stand on a work table: their elevation
// is the working height.

import { TABLE_WIDTHS, WORK_HEIGHT } from "../parts/sizes";
import type { CatalogEntry } from "../types";

/** Width steps of cabinets with sliding doors (two leaves need about 1 m). */
const SLIDING_WIDTHS = [1000, 1200, 1400, 1600, 1800, 2000] as const;
/** Width steps of corner tables. */
const CORNER_WIDTHS = [600, 700, 800, 900] as const;

/** Heated cabinet: about 1.2 kW per metre of width, at 230 V (rounded to 0.1 kW). */
function heatedKw(width: number): number {
  return Math.round((width / 1000) * 12) / 10;
}

export const entries: readonly CatalogEntry[] = [
  // Work tables and cabinets
  { id: "table", kind: "wallTable", category: "tables", name: "cat.table", description: "catDesc.table", tags: ["arbeitstisch", "tisch", "wandtisch", "aufkantung", "grundboden", "work table", "wall table", "bench"], width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: TABLE_WIDTHS },
  { id: "table-open", kind: "wallTableOpen", category: "tables", name: "cat.tableOpen", description: "catDesc.tableOpen", tags: ["arbeitstisch", "tisch", "ohne grundboden", "unterfahrbar", "work table", "open"], width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: TABLE_WIDTHS },
  { id: "table-drawer", kind: "tableDrawer", category: "tables", name: "cat.tableDrawer", description: "catDesc.tableDrawer", tags: ["arbeitstisch", "schublade", "schubfach", "work table", "drawer"], width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: TABLE_WIDTHS },
  { id: "table-sink", kind: "tableSink", category: "tables", name: "cat.tableSink", description: "catDesc.tableSink", tags: ["arbeitstisch", "becken", "spülbecken", "gemüsespüle", "work table", "sink", "bowl"], width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: { coldWater: true, hotWater: true, drain: true }, widths: TABLE_WIDTHS },
  { id: "table-island", kind: "worktable", category: "tables", name: "cat.tableIsland", description: "catDesc.tableIsland", tags: ["arbeitstisch", "inseltisch", "mittelblock", "work table", "island"], width: 1600, depth: 900, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: TABLE_WIDTHS },
  { id: "table-corner-left", kind: "cornerTableLeft", category: "tables", name: "cat.tableCornerLeft", description: "catDesc.tableCorner", tags: ["ecktisch", "eckverbindung", "arbeitstisch", "corner table", "corner"], width: 700, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: CORNER_WIDTHS },
  { id: "table-corner-right", kind: "cornerTableRight", category: "tables", name: "cat.tableCornerRight", description: "catDesc.tableCorner", tags: ["ecktisch", "eckverbindung", "arbeitstisch", "corner table", "corner"], width: 700, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: CORNER_WIDTHS },
  { id: "table-mobile", kind: "mobileTable", category: "tables", name: "cat.tableMobile", description: "catDesc.tableMobile", tags: ["arbeitstisch", "fahrbar", "rollen", "beistelltisch", "mobile table", "castors", "trolley"], width: 1000, depth: 600, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: [800, 1000, 1200, 1400] },
  { id: "table-cabinet", kind: "cabinet", category: "tables", name: "cat.tableCabinet", description: "catDesc.tableCabinet", tags: ["arbeitsschrank", "unterschrank", "flügeltüren", "work cabinet", "cupboard", "hinged doors"], width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: TABLE_WIDTHS },
  { id: "table-cabinet-island", kind: "cabinetIsland", category: "tables", name: "cat.tableCabinetIsland", description: "catDesc.tableCabinetIsland", tags: ["arbeitsschrank", "mittelblock", "insel", "work cabinet", "island"], width: 1600, depth: 800, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: TABLE_WIDTHS },
  { id: "table-cabinet-sliding", kind: "cabinetSliding", category: "tables", name: "cat.tableCabinetSliding", description: "catDesc.tableCabinetSliding", tags: ["arbeitsschrank", "schiebetüren", "unterschrank", "work cabinet", "sliding doors"], width: 1400, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: SLIDING_WIDTHS },
  { id: "table-cabinet-drawers", kind: "cabinetDrawers", category: "tables", name: "cat.tableCabinetDrawers", description: "catDesc.tableCabinetDrawers", tags: ["arbeitsschrank", "schubladen", "schubladenblock", "work cabinet", "drawers"], width: 1400, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: [1200, 1400, 1600, 1800, 2000] },
  { id: "table-drawers", kind: "drawers", category: "tables", name: "cat.tableDrawers", description: "catDesc.tableDrawers", tags: ["schubladen", "schubladenblock", "schubladenschrank", "drawer unit", "drawers"], width: 600, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {} },
  { id: "table-heated", kind: "heatedCabinet", category: "tables", name: "cat.tableHeated", description: "catDesc.tableHeated", tags: ["wärmeschrank", "warmhalteschrank", "tellerwärmer", "heated cabinet", "hot cupboard", "warming"], width: 1400, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: { electricKw: heatedKw(1400), voltage: 230 }, widths: SLIDING_WIDTHS, variantConnections: ({ width }) => ({ electricKw: heatedKw(width), voltage: 230 }) },

  // Preparation machines
  { id: "prep-veg-cutter", kind: "vegCutter", category: "prep", name: "cat.prepVegCutter", description: "catDesc.prepVegCutter", tags: ["gemüseschneider", "gemüseschneidemaschine", "gemüse", "schneiden", "vegetable cutter", "veg prep"], width: 400, depth: 600, height: 650, elevation: WORK_HEIGHT, connections: { electricKw: 0.75, voltage: 230 } },
  { id: "prep-slicer", kind: "slicer", category: "prep", name: "cat.prepSlicer", description: "catDesc.prepSlicer", tags: ["aufschnittmaschine", "schneidemaschine", "wurst", "käse", "slicer", "meat slicer"], width: 550, depth: 600, height: 450, elevation: WORK_HEIGHT, connections: { electricKw: 0.25, voltage: 230 } },
  { id: "prep-mixer-10", kind: "mixerTable", category: "prep", name: "cat.prepMixer10", description: "catDesc.prepMixer", tags: ["rührmaschine", "planetenrührwerk", "knetmaschine", "teig", "mixer", "planetary mixer"], width: 420, depth: 500, height: 700, elevation: WORK_HEIGHT, connections: { electricKw: 0.5, voltage: 230 } },
  { id: "prep-mixer-40", kind: "mixerFloor", category: "prep", name: "cat.prepMixer40", description: "catDesc.prepMixer", tags: ["rührmaschine", "planetenrührwerk", "knetmaschine", "teig", "mixer", "planetary mixer"], width: 600, depth: 800, height: 1400, elevation: 0, connections: { electricKw: 2.2, voltage: 400 } },
  { id: "prep-mixer-60", kind: "mixerFloor", category: "prep", name: "cat.prepMixer60", description: "catDesc.prepMixer", tags: ["rührmaschine", "planetenrührwerk", "knetmaschine", "teig", "mixer", "planetary mixer"], width: 650, depth: 900, height: 1550, elevation: 0, connections: { electricKw: 3, voltage: 400 } },
  { id: "prep-mincer", kind: "mincer", category: "prep", name: "cat.prepMincer", description: "catDesc.prepMincer", tags: ["fleischwolf", "wolf", "hackfleisch", "mincer", "meat grinder"], width: 300, depth: 550, height: 500, elevation: WORK_HEIGHT, connections: { electricKw: 1.5, voltage: 400 } },
  { id: "prep-cutter", kind: "cutter", category: "prep", name: "cat.prepCutter", description: "catDesc.prepCutter", tags: ["kutter", "tischkutter", "zerkleinern", "cutter", "food processor"], width: 350, depth: 450, height: 500, elevation: WORK_HEIGHT, connections: { electricKw: 1, voltage: 230 } },
  { id: "prep-vacuum-table", kind: "vacuumTable", category: "prep", name: "cat.prepVacuumTable", description: "catDesc.prepVacuum", tags: ["vakuumierer", "vakuumiergerät", "vakuum", "sous vide", "vacuum packer"], width: 500, depth: 600, height: 450, elevation: WORK_HEIGHT, connections: { electricKw: 0.75, voltage: 230 } },
  { id: "prep-vacuum-floor", kind: "vacuumFloor", category: "prep", name: "cat.prepVacuumFloor", description: "catDesc.prepVacuum", tags: ["vakuumierer", "vakuumiergerät", "vakuum", "sous vide", "vacuum packer"], width: 750, depth: 650, height: 1000, elevation: 0, connections: { electricKw: 1.5, voltage: 400 } },
  { id: "prep-scale", kind: "benchScale", category: "prep", name: "cat.prepScale", description: "catDesc.prepScale", tags: ["waage", "küchenwaage", "tischwaage", "scale", "bench scale"], width: 350, depth: 400, height: 130, elevation: WORK_HEIGHT, connections: { electricKw: 0.01, voltage: 230 } },
  { id: "prep-scale-platform", kind: "platformScale", category: "prep", name: "cat.prepScalePlatform", description: "catDesc.prepScalePlatform", tags: ["waage", "bodenwaage", "plattformwaage", "wareneingang", "scale", "platform scale"], width: 600, depth: 600, height: 1000, elevation: 0, connections: { electricKw: 0.01, voltage: 230 } },
  { id: "prep-dough-sheeter", kind: "doughSheeter", category: "prep", name: "cat.prepDoughSheeter", description: "catDesc.prepDoughSheeter", tags: ["ausrollmaschine", "teigausrollmaschine", "teig", "bäckerei", "konditorei", "dough sheeter"], width: 2400, depth: 900, height: 1150, elevation: 0, connections: { electricKw: 0.75, voltage: 400 }, widths: [2000, 2400, 2800] },
  { id: "prep-peeler", kind: "peeler", category: "prep", name: "cat.prepPeeler", description: "catDesc.prepPeeler", tags: ["kartoffelschäler", "schälmaschine", "kartoffeln", "potato peeler", "peeler"], width: 500, depth: 750, height: 1000, elevation: 0, connections: { electricKw: 0.55, voltage: 400, coldWater: true, drain: true } },
];
