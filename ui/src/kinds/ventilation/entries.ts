// Ventilation: canopy hoods above the cooking line (plain, with UV technology or with supply air),
// a condensing hood for combi ovens, a vapour hood over the dishwasher, ventilation ceiling
// modules, a downdraft module for cooking islands, supply air outlets, the fire suppression line,
// the exhaust fan box, exhaust ducts and shafts. Exhaust volumes are typical starting points that
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

/** Lower edge of a vapour hood over a hood-type dishwasher (mm): over its opened hood. */
const DISH_HOOD_ELEVATION = 2050;
/** Lower edge of the fire suppression line: in the hood's plenum zone over the cooking line (mm). */
const SUPPRESSION_ELEVATION = 2050;
/** Lower edge of a fan box hung under a ceiling of a plant room or a ceiling void (mm). */
const FAN_BOX_ELEVATION = 2400;

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
  withVariants(
    { id: "hood-wall-uv", kind: "hoodUv", category: "ventilation", name: "cat.hoodWallUv", description: "catDesc.hoodWallUv", width: 2400, depth: 1100, height: 450, elevation: HOOD_ELEVATION, widths: [1600, 2000, 2400, 2800, 3200, 3600], tags: ["abzugshaube", "uv", "uv-c", "ozon", "fettabscheidung", "wandhaube", "canopy", "uv hood", "grease", "extraction"] },
    ({ width }) => ({ exhaustM3h: air((width / 2400) * 2600), electricKw: kw(0.1 + (width / 2400) * 0.3), voltage: 230 }),
  ),
  withVariants(
    { id: "hood-wall-supply", kind: "hoodSupply", category: "ventilation", name: "cat.hoodWallSupply", description: "catDesc.hoodWallSupply", width: 2400, depth: 1100, height: 450, elevation: HOOD_ELEVATION, widths: [1600, 2000, 2400, 2800, 3200, 3600], tags: ["abzugshaube", "zuluft", "zuluftschleier", "induktionshaube", "wandhaube", "canopy", "supply air", "make-up air", "extraction"] },
    ({ width }) => ({ exhaustM3h: air((width / 2400) * 2600), electricKw: kw((width / 2400) * 0.1), voltage: 230 }),
  ),
  withVariants(
    { id: "vent-ceiling-supply", kind: "ventCeilingSupply", category: "ventilation", name: "cat.ventCeilingSupply", description: "catDesc.ventCeilingSupply", width: 3600, depth: 1600, height: 300, elevation: CEILING_ELEVATION, widths: [1800, 3600, 5400], tags: ["lüftungsdecke", "zuluftdecke", "zuluft", "abluftdecke", "ventilated ceiling", "supply air", "extraction", "ceiling"] },
    ({ width }) => ({ exhaustM3h: air((width / 1000) * CEILING_DEPTH * CEILING_EXHAUST_PER_M2), electricKw: kw((width / 1800) * 0.08), voltage: 230 }),
  ),
  withVariants(
    { id: "dish-hood", kind: "dishHood", category: "ventilation", name: "cat.dishHood", description: "catDesc.dishHood", width: 1000, depth: 900, height: 400, elevation: DISH_HOOD_ELEVATION, widths: [800, 1000, 1200, 1600], tags: ["brüdenhaube", "dampfhaube", "spülmaschine", "haubenspülmaschine", "kondensat", "vapour hood", "dishwasher", "condensate"] },
    ({ width }) => ({ exhaustM3h: air((width / 1000) * 900), electricKw: 0.05, voltage: 230, drain: true }),
  ),
  withVariants(
    { id: "downdraft", kind: "downdraft", category: "ventilation", name: "cat.downdraft", description: "catDesc.downdraft", width: 400, depth: 900, height: 900, elevation: 0, widths: [400, 600, 800], tags: ["tischlüftung", "muldenlüftung", "downdraft", "kochinsel", "absaugung", "island", "extraction"] },
    ({ width }) => ({ exhaustM3h: air((width / 400) * 800), electricKw: kw((width / 400) * 0.25), voltage: 230 }),
  ),
  { id: "swirl-diffuser", kind: "swirlDiffuser", category: "ventilation", name: "cat.swirlDiffuser", description: "catDesc.swirlDiffuser", width: 600, depth: 600, height: 350, elevation: CEILING_ELEVATION, widths: [500, 600, 625], tags: ["drallauslass", "zuluft", "deckenauslass", "luftauslass", "swirl diffuser", "supply air", "make-up air", "ceiling"], connections: {} },
  { id: "displacement-outlet", kind: "displacementOutlet", category: "ventilation", name: "cat.displacementOutlet", description: "catDesc.displacementOutlet", width: 600, depth: 300, height: 1200, elevation: 0, widths: [500, 600, 800], tags: ["quellluftauslass", "quellauslass", "zuluft", "verdrängungslüftung", "displacement", "supply air", "make-up air"], connections: {} },
  withVariants(
    { id: "fire-suppression", kind: "fireSuppression", category: "ventilation", name: "cat.fireSuppression", description: "catDesc.fireSuppression", width: 2400, depth: 300, height: 400, elevation: SUPPRESSION_ELEVATION, widths: [1600, 2400, 3200, 4000], tags: ["löschanlage", "feuerlöschanlage", "küchenlöschanlage", "düsen", "brandschutz", "fire suppression", "nozzles", "wet chemical"] },
    () => ({ electricKw: 0.05, voltage: 230 }),
  ),
  withVariants(
    { id: "fan-box", kind: "fanBox", category: "ventilation", name: "cat.fanBox", description: "catDesc.fanBox", width: 1000, depth: 700, height: 650, elevation: FAN_BOX_ELEVATION, widths: [800, 1000, 1300], tags: ["ventilatorbox", "abluftventilator", "lüfterbox", "boxventilator", "fan box", "exhaust fan", "extraction"] },
    ({ width }) => ({ exhaustM3h: air((width / 1000) * 4000), electricKw: kw((width / 1000) * 1.5), voltage: 400 }),
  ),
];
