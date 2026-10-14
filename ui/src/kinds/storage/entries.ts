// Storage: shelving, rack trolleys, wall shelves and cabinets, bins and rails.

import { TABLE_WIDTHS, WALL_SHELF_ELEVATION } from "../parts/sizes";
import type { CatalogEntry } from "../types";

/** Width steps of shelving for dry stores and cold rooms (mm). */
const SHELVING_WIDTHS = [600, 800, 1000, 1200, 1400, 1600] as const;
/** Lower edge of a rail or knife bar on the wall above a work table (mm). */
const RAIL_ELEVATION = 1300;

export const entries: readonly CatalogEntry[] = [
  { id: "shelving", kind: "shelving", category: "storage", name: "cat.shelving", description: "catDesc.shelving", tags: ["regal", "lagerregal", "edelstahl", "stainless", "shelf", "rack"], width: 1200, depth: 500, height: 1800, elevation: 0, connections: {}, widths: TABLE_WIDTHS },
  { id: "shelving-5", kind: "shelving5", category: "storage", name: "cat.shelving5", description: "catDesc.shelving5", tags: ["regal", "lagerregal", "edelstahl", "stainless", "shelf", "rack"], width: 1200, depth: 500, height: 2000, elevation: 0, connections: {}, widths: SHELVING_WIDTHS },
  { id: "shelving-perforated", kind: "shelvingPerforated", category: "storage", name: "cat.shelvingPerforated", description: "catDesc.shelvingPerforated", tags: ["regal", "kühlraumregal", "gelocht", "lochblech", "perforated", "cold room", "shelf"], width: 1200, depth: 600, height: 1800, elevation: 0, connections: {}, widths: SHELVING_WIDTHS },
  { id: "shelving-alu", kind: "shelvingSlatted", category: "storage", name: "cat.shelvingAlu", description: "catDesc.shelvingAlu", tags: ["regal", "aluminium", "alu", "lamellen", "kühlraum", "slatted", "aluminum", "shelf"], width: 1000, depth: 400, height: 1800, elevation: 0, connections: {}, widths: SHELVING_WIDTHS },
  { id: "shelving-corner", kind: "shelvingCorner", category: "storage", name: "cat.shelvingCorner", description: "catDesc.shelvingCorner", tags: ["regal", "eckregal", "ecke", "corner", "shelf"], width: 1200, depth: 1200, height: 1800, elevation: 0, connections: {} },
  { id: "dunnage-rack", kind: "dunnageRack", category: "storage", name: "cat.dunnageRack", description: "catDesc.dunnageRack", tags: ["bodenrost", "bodenregal", "lagerpodest", "palette", "dunnage", "floor rack"], width: 1200, depth: 500, height: 300, elevation: 0, connections: {}, widths: SHELVING_WIDTHS },
  { id: "rack-trolley-15", kind: "rackTrolley15", category: "storage", name: "cat.rackTrolley15", description: "catDesc.rackTrolley15", tags: ["hordenwagen", "hordengestell", "gn", "gastronorm", "wagen", "fahrbar", "trolley", "rack"], width: 380, depth: 560, height: 1700, elevation: 0, connections: {} },
  { id: "rack-trolley-20", kind: "rackTrolley20", category: "storage", name: "cat.rackTrolley20", description: "catDesc.rackTrolley20", tags: ["hordenwagen", "hordengestell", "gn", "gastronorm", "wagen", "fahrbar", "trolley", "rack"], width: 560, depth: 700, height: 1800, elevation: 0, connections: {} },
  { id: "wall-shelf", kind: "wallShelf", category: "storage", name: "cat.wallShelf", description: "catDesc.wallShelf", tags: ["wandbord", "wandregal", "konsole", "wall shelf"], width: 1200, depth: 350, height: 300, elevation: WALL_SHELF_ELEVATION, connections: {}, widths: TABLE_WIDTHS },
  { id: "wall-shelf-double", kind: "wallShelfDouble", category: "storage", name: "cat.wallShelfDouble", description: "catDesc.wallShelfDouble", tags: ["wandbord", "wandregal", "etagen", "wall shelf", "double"], width: 1200, depth: 350, height: 600, elevation: WALL_SHELF_ELEVATION, connections: {}, widths: TABLE_WIDTHS },
  { id: "wall-cabinet-sliding", kind: "wallCabinet", category: "storage", name: "cat.wallCabinet", description: "catDesc.wallCabinet", tags: ["hängeschrank", "wandschrank", "schiebetüren", "wall cabinet", "sliding doors"], width: 1200, depth: 400, height: 650, elevation: WALL_SHELF_ELEVATION, connections: {}, widths: TABLE_WIDTHS },
  { id: "tall-cabinet", kind: "tallCabinet", category: "storage", name: "cat.tallCabinet", description: "catDesc.tallCabinet", tags: ["vorratsschrank", "hochschrank", "lagerschrank", "schrank", "tall cabinet", "store"], width: 1000, depth: 600, height: 2000, elevation: 0, connections: {}, widths: [600, 800, 1000, 1200] },
  { id: "ingredient-bin", kind: "ingredientBin", category: "storage", name: "cat.ingredientBin", description: "catDesc.ingredientBin", tags: ["zutatenwagen", "mehlwagen", "zutatenbehälter", "fahrbar", "mehl", "zucker", "ingredient bin", "flour"], width: 400, depth: 700, height: 720, elevation: 0, connections: {} },
  { id: "utensil-rail", kind: "utensilRail", category: "storage", name: "cat.utensilRail", description: "catDesc.utensilRail", tags: ["gerätereling", "reling", "hakenleiste", "haken", "utensil rail", "hooks"], width: 800, depth: 80, height: 350, elevation: RAIL_ELEVATION, connections: {}, widths: [400, 600, 800, 1000, 1200] },
  { id: "knife-bar", kind: "knifeBar", category: "storage", name: "cat.knifeBar", description: "catDesc.knifeBar", tags: ["messerleiste", "magnetleiste", "messer", "knife bar", "magnetic"], width: 450, depth: 50, height: 300, elevation: RAIL_ELEVATION, connections: {}, widths: [300, 450, 600] },
];
