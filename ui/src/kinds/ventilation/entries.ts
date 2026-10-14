// Ventilation: canopy hoods above the cooking line, a condensing hood for combi ovens, ventilation
// ceiling modules, exhaust ducts and shafts. Exhaust volumes are typical starting points that
// scale with the length of the hood; the ventilation planner sets the real values.

import { withVariants } from "../parts/entries";
import { HOOD_ELEVATION } from "../parts/sizes";
import type { CatalogEntry } from "../types";

/** Usual lower edge of a ventilation ceiling (mm). */
const CEILING_ELEVATION = 2700;
/** Lower edge of an exhaust duct: on top of a canopy hood at the usual height (mm). */
const DUCT_ELEVATION = HOOD_ELEVATION + 450;
/** Lower edge of a condensing hood: on top of a floor-standing combi oven (mm). */
const COMBI_TOP = 1800;
/** Exhaust air of a ventilation ceiling per square metre (m³/h) and its fixed module depth (m). */
const CEILING_EXHAUST_PER_M2 = 600;
const CEILING_DEPTH = 1.6;

/** Values rounded: air to 10 m³/h, power to 10 W. */
const air = (v: number) => Math.round(v / 10) * 10;
const kw = (v: number) => Math.round(v * 100) / 100;

export const entries: readonly CatalogEntry[] = [
  withVariants(
    { id: "hood-wall", kind: "hood", category: "ventilation", name: "cat.hoodWall", description: "catDesc.hoodWall", width: 2400, depth: 1100, height: 450, elevation: HOOD_ELEVATION, widths: [1200, 1600, 2000, 2400, 2800, 3200, 3600], tags: ["abzugshaube", "dunstabzug", "wandhaube", "fettfilter", "canopy", "extraction", "hood"] },
    ({ width }) => ({ exhaustM3h: air((width / 2400) * 2600), electricKw: kw((width / 2400) * 0.1), voltage: 230 }),
  ),
  withVariants(
    { id: "hood-island", kind: "hoodIsland", category: "ventilation", name: "cat.hoodIsland", description: "catDesc.hoodIsland", width: 2400, depth: 2000, height: 450, elevation: HOOD_ELEVATION, widths: [1600, 2000, 2400, 2800, 3200, 3600], tags: ["abzugshaube", "dunstabzug", "inselhaube", "fettfilter", "canopy", "island", "extraction", "hood"] },
    ({ width }) => ({ exhaustM3h: air((width / 2400) * 4200), electricKw: kw((width / 2400) * 0.2), voltage: 230 }),
  ),
  { id: "condensing-hood", kind: "condensingHood", category: "ventilation", name: "cat.condensingHood", description: "catDesc.condensingHood", width: 900, depth: 1100, height: 300, elevation: COMBI_TOP, tags: ["kondensationshaube", "dampfhaube", "kombidämpfer", "brüden", "condensing hood", "combi oven", "steam"], connections: { electricKw: 0.4, voltage: 230, drain: true } },
  withVariants(
    { id: "vent-ceiling", kind: "ventCeiling", category: "ventilation", name: "cat.ventCeiling", description: "catDesc.ventCeiling", width: 2400, depth: 1600, height: 300, elevation: CEILING_ELEVATION, widths: [1200, 2400, 3600], tags: ["lüftungsdecke", "kassettendecke", "abluftdecke", "ventilated ceiling", "extraction", "ceiling"] },
    ({ width }) => ({ exhaustM3h: air((width / 1000) * CEILING_DEPTH * CEILING_EXHAUST_PER_M2), electricKw: kw((width / 1200) * 0.08), voltage: 230 }),
  ),
  { id: "exhaust-duct", kind: "exhaustDuct", category: "ventilation", name: "cat.exhaustDuct", description: "catDesc.exhaustDuct", width: 500, depth: 300, height: 550, elevation: DUCT_ELEVATION, widths: [400, 500, 600, 800], tags: ["abluftkanal", "lüftungskanal", "stutzen", "reinigungsöffnung", "duct", "exhaust"], connections: {} },
  { id: "vent-shaft", kind: "ventShaft", category: "ventilation", name: "cat.ventShaft", description: "catDesc.ventShaft", width: 600, depth: 600, height: 3000, elevation: 0, tags: ["schacht", "abluftschacht", "lüftungsschacht", "shaft", "riser"], connections: {} },
];
