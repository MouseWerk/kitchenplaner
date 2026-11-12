# Design: connection points (B4) and installation plan (P1, P2) for 0.3

Status: accepted (owner, 2026-11-12): derived points with overrides only in the file; heat release and the hood airflow check as typical values; the other decisions in section 8 as recommended. Based on file format version 3 and
359 catalog entries (about 95 of them without connection values). The DXF export already writes
AC1015 with trade layers, and the plan set is built by `render/planSet.ts`.

## 0. Principles

1. **One source of truth per value.**
   - `Item.connections` stays the unit's load and supply values: kW, V, gas kW, water and drain flags, m³/h. The equipment list and the totals keep using it.
   - Connection points are derived from it: a unit has a point for trade T exactly when its connections switch T on (`activeTrades`).
   - Ticking a connection in the inspector adds the point. There is no second list to keep in sync.
2. **The file stores only what the planner changed.**
   - A point's position and its values (current, fuse, DN, and so on) are derived at runtime from catalog rules plus the item's size, rotation and connections.
   - `Item.points` holds overrides only.
   - A v3 file has no overrides, so it shows derived points and otherwise opens exactly as before.
3. **Positions keep their distance from an edge.**
   - Catalog defaults are anchors: so many mm from the left, centre or right; from the back, centre or front; and in height from the floor, from the unit's lower edge, or from its top.
   - A point keeps its distance from that edge when the unit is resized.
4. **Point ids come from the stable Pos.** A point is named `<Pos>.<code>`, for example „12.E“ or „12.AW“. Plans, the table, the CSV and the DXF therefore agree.
5. **Lean.** Only what a Fachplaner puts on an installation plan:
   - Every point: position and height above the finished floor.
   - Electric: kW, V, phases, current, fuse, connection type.
   - Pipes and ducts: DN.
   - Drains: greasy or not.
   - Air: m³/h.
   - Steam: kg/h.
   - Remote refrigeration: kW.
   - Heat release is a value per unit, not per point.

## 1. Data model

### 1.1 Additions to `ui/src/model/types.ts`

```ts
/** Trades of connection points, in the order of lists, files, layers and the inspector. */
export type Trade =
  | "electric"      // E  Elektro
  | "gas"           // G  Gas
  | "coldWater"     // KW Kaltwasser
  | "hotWater"      // WW Warmwasser
  | "softWater"     // EW enthärtetes Wasser
  | "drain"         // AW Abwasser (Geräteablauf)
  | "floorDrain"    // BA Bodenablauf
  | "exhaust"       // AB Abluft
  | "supply"        // ZU Zuluft
  | "steam"         // D  Dampf
  | "refrigeration";// K  Kälte (Verbund/remote)

export interface Connections {
  // existing: electricKw, voltage, gasKw, coldWater, hotWater, drain, floorDrain, exhaustM3h
  softWater?: boolean;
  supplyM3h?: number;
  steamKgH?: number;
  refrigerationKw?: number;
}

export type Plug = "fixed" | "schuko" | "cee16" | "cee32" | "cee63";

/** What the planner changed of one connection point; what is left out follows the catalog. */
export interface PointOverride {
  /** Distance from the unit's left edge, seen from the front (mm). */
  x?: number;
  /** Distance from the unit's back edge (mm); more than the depth lies in front of the unit. */
  y?: number;
  /** Height above the finished floor („ü. FFB“, mm). */
  z?: number;
  currentA?: number;
  fuseA?: number;
  plug?: Plug;
  /** Nominal size: DN of a pipe, diameter of a duct (mm). */
  dn?: number;
  /** Drain carries greasy water (to the grease separator). */
  greasy?: boolean;
  note?: string;
}
export type ItemPoints = Partial<Record<Trade, PointOverride>>;

export interface HeatRelease { sensibleKw?: number; latentKw?: number }
// Item gains: points?: ItemPoints; heat?: HeatRelease;
```

Overrides are measured from the left and back edges, because data sheets give them that way and
the value then stays right when the unit is resized.

### 1.2 `ui/src/model/trades.ts` (new)

- **`TRADES`:** the list of all trades.
- **`TRADE_GROUP`:** maps each trade to its group:
  - KW, WW, EW, AW and BA → sanitary
  - AB and ZU → ventilation
  - D and K → special
  - E and G → their own groups
- **`TRADE_GROUPS`, `PointFilter`:** the list of groups, and the filter type (`"all"` or a group).
- **`activeTrades(c)`:**
  - `electricKw > 0`, `gasKw > 0`, `exhaustM3h > 0`, `supplyM3h > 0`, `steamKgH > 0` and `refrigerationKw > 0` each switch their trade on;
  - each water or drain flag switches its own trade on.
- **`DN_SERIES`:**
  - water, gas and steam: 15, 20, 25, 32, 40, 50
  - drain: 40, 50, 70, 100, 125
  - floor drain: 100, 125, 150
  - ducts: 100 to 630
- **`FUSE_SERIES`:** 10 to 125 A.
- **`PLUGS`, `PLUG_RATING`:** the plug types and their ratings.
- **i18n keys:**
  - `trade.<id>` for the name;
  - `trade.<id>.code` for the code: German E, G, KW, WW, EW, AW, BA, AB, ZU, D, K; English E, G, CW, HW, SW, WD, FD, EX, SA, ST, RF;
  - `tradeGroup.<g>` for the group name.

### 1.3 Catalog defaults (`ui/src/kinds/parts/points.ts`)

```ts
export type Edge = "start" | "centre" | "end";   // x: left|centre|right seen from the front; y: back|centre|front
export type Level = "floor" | "bottom" | "top";
export interface Along { from: Edge; mm: number }
export interface Height { from: Level; mm: number }
export interface PointPlace { x: Along; y: Along; z: Height }
export interface PointDefault extends PointPlace { dn?: number | ((item: Item) => number); plug?: Plug; greasy?: boolean }
export type PointLayout = Partial<Record<Trade, Partial<PointDefault>>>;
export type ProfileId = "back" | "line" | "tall" | "tableTop" | "sink" | "dish" | "tilt" | "wallHung" | "overhead" | "flat";
export const PROFILES: Record<ProfileId, Record<Trade, PointPlace>>;
export function defaultPoints(item: Item): Partial<Record<Trade, PointDefault>>;
```

`CatalogEntry` gains an optional `points?: PointLayout` for the few entries that need their own.

### 1.4 Resolved points (`ui/src/model/points.ts`)

```ts
export interface PointValues { kw?; voltage?; phases?: 1 | 3; currentA?; fuseA?; plug?; dn?; m3h?; kgH?; greasy?; note? }
export interface ConnectionPoint {
  itemId: string; pos: number; trade: Trade;
  fromLeft: number; fromBack: number;   // in the unit (mm)
  at: Vec2;                             // on the plan, after rotation
  z: number;                            // above the finished floor
  values: PointValues;
  set: ReadonlySet<keyof PointOverride>; // the fields the planner set
}
export function itemPoints(item: Item): ConnectionPoint[];
export function projectPoints(items: readonly Item[], filter?: PointFilter): ConnectionPoint[];
export function pointLabel(p: ConnectionPoint, lang: Lang): string;    // „12.E“
export function currentOf(kw: number, voltage: number): number;        // 230 V: P/U; 400 V: P/(√3·U); cos φ = 1
export function fuseFor(currentA: number): number;                     // smallest of FUSE_SERIES ≥ current
export function setPoint(item: Item, trade: Trade, patch: Partial<PointOverride> | null): Pick<Item, "points">;
export function cleanPoints(item: Pick<Item, "points" | "connections">): ItemPoints | undefined;
export interface WallRef { kind: "wall" | "partition"; index: number; id?: string; distance: number; foot: Vec2 }
/** The nearest wall face (or full-height partition), then the nearest one turned at least 30° against it. */
export function wallRefs(room: Room, at: Vec2): WallRef[];
```

How the values are derived:

| Value | Derived from |
|---|---|
| Phases | 230 V gives 1N~, 400 V gives 3N~ |
| Current, fuse | `currentOf`, then `fuseFor` |
| Plug | catalog rule |
| Gas DN | gas kW: up to 25 kW DN 15, up to 50 kW DN 20, above that DN 25 |
| Duct size | m³/h at 6 m/s for exhaust and 3 m/s for supply, rounded up to the series |
| Water, drain and steam DN | catalog rules |

All of them are typical values. The UI shows them as placeholders, together with the existing typical-values note.

### 1.5 Heat release (`ui/src/model/heat.ts`)

`itemHeat(item)` estimates the sensible and latent heat release:
- **Inputs:** a heat class per kind (dry, wet, frying, dish, plug-in cooling, small, none) and a share of the connected kW.
- **Override:** `item.heat` replaces the estimate.
- **Sources:** these are own typical values, marked unsure. The VDI 2052 tables are not copied.

## 2. Defaults for 359 entries

About 260 entries have connections. Their points come from four sources; when two disagree, the later one in this list wins:
1. **A profile by placement:**
   - floor units use `back`;
   - table-top units use `tableTop`;
   - overhead units use `overhead`;
   - flat units use `flat`.
2. **A profile by category or group:**
   - sinks use `sink`;
   - dish machines use `dish`;
   - the cooking lines use `line`.
3. **`PROFILE_BY_KIND` and `LAYOUT_BY_KIND`** in `kinds/parts/pointRules.ts`:
   - tilting units use `tilt`;
   - hand wash basins and water heaters use `wallHung`;
   - fridges and combi ovens use `tall`;
   - conveyor dishwashers get their own layouts.
4. **`LAYOUT_BY_ENTRY` or `entry.points`:** for real exceptions only, expected to be fewer than 20.

Example profiles (mm):

| Profile | E | G | KW / WW / EW | AW | BA | AB / ZU |
|---|---|---|---|---|---|---|
| line | right 150, back 50, +300 | left 150, back 50, +300 | centre −100 / +100 / 0, back 50, +400 | centre, back 50, +200 | – | – |
| tall | right 150, back 50, +300 | left 150, +300 | back, +400 | back, +200 | – | top centre |
| tableTop | back centre, bottom +250 | – | bottom −300 | bottom −400 | – | – |
| sink | – | – | under the bowl ±100, +550 | under the bowl, +400 | – | – |
| tilt | right 150, +300 | left 150, +300 | right 300, back 50, +900 | – | centre, 300 in front, 0 | – |
| wallHung | top +100 | – | bottom −100 | bottom −150 | – | – |
| overhead | top, right 150 | – | – | bottom (condensate) | – | top centre, ZU left 300 |
| flat | – | – | – | centre, 0 | centre, 0 | – |

**Rules**
- **Soft water.** `SOFT_WATER_KINDS` covers combi ovens, steamers and coffee machines. `withConnectionRules(entry)` adds `softWater` at registry level, the way `withGasFlue` does; existing items keep what they have.
- **Greasy drains.** `GREASY_DRAIN`: the drains of cooking units, dish machines and pot sinks count as greasy. Those of hand wash basins, ice machines and condensate do not.
- **DN by kind.**
  - Water: DN 15, or DN 20 for conveyor dishwashers and tilting units.
  - Drain: DN 50, or DN 40 for hand wash basins and DN 70 for the pot washer.
  - Floor drain: DN 100.
- **Plug.** `plugFor(item, currentA)`:
  - Table-top, cooling and serving units up to 16 A get Schuko at 230 V and CEE16 at 400 V.
  - Up to 32 A at 400 V gets CEE32.
  - Everything else is a fixed connection.
  - `PLUG_BY_KIND` overrides the result.
- **Supply air.** The ventilation entries get explicit `supplyM3h` values. These are the only hand-written values. Remote refrigeration and steam are switched on by the planner.

**Contract tests** (per variant):
- **Trades:** the points' trades equal `activeTrades`.
- **Footprint:** points lie within the footprint, except a floor drain, which may lie up to 600 mm in front.
- **Height:**
  - flat points and floor drains sit at 0;
  - air points sit at the top;
  - the electric point of a table-top unit sits above the unit's lower edge.
- **Electric:** current, fuse and plug agree with each other.
- **Gas:** gas variants have a gas point with a DN, and electric variants have none.
- **Sizes:** every pipe and duct has a DN.
- **File round trip:** an item survives saving and loading with every point overridden.

**`pointRules.test.ts`:**
- every kind named in the rules exists;
- every soft-water kind has cold water;
- supply entries have a supply volume;
- every profile defines all trades.

## 3. File format version 4

- `FORMAT_VERSION = 4`. An 0.2 build would otherwise drop `points` and `heat`; with the new version it refuses the file as too new instead.
- **Item key order:** `… connections, energy, points, heat, spec, note`.
  - New `connections` keys go last: `softWater, supplyM3h, steamKgH, refrigerationKw`.
  - `points` are written in `TRADES` order.
  - Each override is written in the order `x, y, z, currentA, fuseA, plug, dn, greasy, note`.
  - Empty objects are left out.
- **Migration 3 → 4:** nothing to change. Old items get derived points, so they show exactly what they showed before.
- **Parsing:**
  - Coordinates must lie within `MAX_LENGTH`.
  - `currentA`, `fuseA` and `dn` must be greater than 0 and at most 2000.
  - `plug` must be one of `PLUGS`.
  - Anything damaged is `error.invalid`.
  - Unknown trade keys are dropped, and so are overrides of inactive trades.
  - `heat` values must not be negative.
- **`variantPatch`:** runs `cleanPoints`, so switching a unit from gas to electric drops its gas override. Undo brings it back.

## 4. UI

- **Inspector, „Anschlusswerte“:**
  - adds „Enthärtetes Wasser“;
  - behind „Weitere Anschlüsse“: „Zuluft (m³/h)“, „Dampf (kg/h)“, „Kälte (Verbund, kW)“;
  - adds „Wärmeabgabe sensibel / latent (kW)“, with the estimate as placeholder.
- **Inspector, new section „Anschlusspunkte“** (`components/PointsSection.tsx`):
  - One row per point: code, trade, a summary (for example „400 V 3N~ · 22,9 A · 25 A · Festanschluss“) and the height.
  - A disclosure per row opens these fields:
    - „Abstand links“, „Abstand hinten“, „Höhe ü. FFB“;
    - „Strom“, „Absicherung“, „Anschlussart“, „Nennweite“;
    - „fetthaltig“, „Notiz“.
  - Derived values show as placeholders.
  - „Zurücksetzen“ resets one point; „Alle Anschlusspunkte zurücksetzen“ resets them all.
  - Every edit is one undo step.
  - Styling stays neutral: a set value is marked by its text weight.
- **Plan symbols:**
  - 3 mm on paper, upright and black, told apart by shape.
  - Every installation sheet carries a legend and the note „Höhen in mm über Fertigfußboden (FFB)“.

  | Trade | Symbol | Guide (figure numbers unsure, to be checked) |
  |---|---|---|
  | E fixed | circle with a connection tail | DIN EN 60617-11 |
  | E Schuko / CEE | half circle with earth line; CEE with three ticks and rating | DIN EN 60617-11 |
  | KW / WW / EW | valve (two triangles) with code | DIN EN 806-1 / DIN 1988 |
  | AW | circle with a diagonal | DIN 1986-100 |
  | BA | square with an inscribed circle | DIN 1986-100 |
  | G | valve, one triangle filled, „G“ | DVGW-TRGI |
  | AB / ZU | circle with an X, arrow | DIN EN 12792 (unsure) |
  | D | valve, „D“ | – |
  | K | two small circles, „K“ | – |

  Labels show the id and the height below it (for example „12.E“ over „+300“), placed by a ring search. Each point gets two dimensions, measured from the faces that `wallRefs` returns. The height table repeats the same numbers and is the authoritative list.
- **Trade filter (P2):**
  - This is view state: `Prefs.points: "off" | PointFilter`, default off.
  - A radio group under „Ansicht“ offers „Anschlüsse aus / alle / nur Elektro / nur Sanitär / nur Gas / nur Lüftung / nur Kälte und Dampf“.
  - With a filter set, the equipment is drawn quietly (thin outlines, no fill, no symbols), and the points of the chosen group are drawn on top.

## 5. Outputs

- **Drawing.** `model/installationPlan.ts` provides `installationDrawing(project, { filter, paperScale, dims, legend, lang })`. It combines:
  - `planDrawing` with the new options `symbols: false` and `quiet: true`;
  - `pointsDrawing`;
  - `pointDims`;
  - the legend.
- **Shapes.** Point shapes carry `trade` and `point`, but no `itemId`, so they never land in a unit's DXF block. They use the new pen `"connection"`.
- **PDF plan set.**
  - One sheet „Installationsplan <Gewerk>“ per group that has points, each followed by „Anschlusstabelle <Gewerk>“.
  - Table columns: Nr., Pos., Bezeichnung, Abstand/Wand ×2, Höhe ü. FFB, Werte, Notiz.
  - The electric table ends with the Σ kW, both plain and with the simultaneity factor applied.
  - New options: `installation: TradeGroup[]` and `pointTables: boolean`.
  - One shared `drawTable` for the tables.
- **CSV.** `model/pointList.ts` with `pointRows` and `pointsCsv`.
  - Columns: Nr., Pos., Bezeichnung, Gewerk, X, Y, Wand A, Abstand A, Wand B, Abstand B, Höhe, kW, V, Phasen, A, Absicherung, Anschlussart, DN, m³/h, kg/h, fetthaltig, Notiz.
  - Same rules as the equipment CSV: BOM, separator per language, typical-values footer.
- **Equipment list.**
  - „EW“ appears in the water cell.
  - The CSV gains „Zuluft (m³/h)“ and „Wärme sensibel/latent (kW)“.
- **DXF.**
  - **Symbols:** one symbol block per symbol, from `KP_E_FEST` to `KP_K`. Each point is an INSERT on its trade layer.
  - **Attributes:**
    - every point: NR, POS, GEWERK, HOEHE_FFB_MM;
    - electric points: KW, SPANNUNG_V, PHASEN, STROM_A, SICHERUNG_A, ANSCHLUSSART;
    - other trades: DN, FETTHALTIG, M3H, KGH, KW, as they apply.
  - **Layers:** labels and dimensions go on the trade layer. New layers `ANSCHLUSS_DAMPF` and `ANSCHLUSS_KAELTE`.
  - **Unit attributes:** new attributes are appended after the existing ones.
- **Exports.**
  - „Installationsplan als SVG / DXF / PNG…“ and „Anschlussliste als CSV…“.
  - Exports follow the trade filter; „aus“ means all trades.

## 6. Plan check additions (`model/pointChecks.ts`)

| Key | Rule | Value | Source |
|---|---|---|---|
| `check.gasNoHood` | Gas unit under no canopy hood or ventilation ceiling. A condensing hood or downdraft does not count, and the hood-exempt kinds are not exempt here. Replaces the general hood finding for that unit. | – | DVGW G 631 / TRGI (clause unsure) |
| `check.gasShutoffMissing` | The project has gas points but no gas emergency shut-off | – | DVGW G 631 (unsure) |
| `check.islandSupply` | A water, drain or gas point that stands too far from any wall and has no floor box, media column, shaft or column within reach. A height of 0 counts as „from the floor“. | 300 / 1000 | own, unsure |
| `check.floorDrainMissing` | A floor drain point with no gully, floor drain or channel within reach | 600 | own |
| `check.hoodAirflow` | Per hood: the heat of the units under it × simultaneity × air per kW, compared with the hood's airflow. Worded as „gemessen … nötig …“ and marked as a typical value. | own, calibrated so that the example passes | own, unsure |
| `check.pointOutside` | A point lies outside the room or inside a partition (air points excepted) | – | – |

The 500-unit time budget of the plan check must still hold.

## 7. Waves and file ownership

The locale files are owned by wave 0. That developer adds all keys known so far, plus one marked block per later developer in both languages. Each later developer appends only inside their own block.

### Wave 0: contracts (one developer, merged before everything else)

**Owns:**
- `model/types.ts`
- `model/trades.ts` (new)
- `model/points.ts` (new, the full implementation, including `wallRefs`, `setPoint` and `cleanPoints`)
- `kinds/parts/points.ts` (types plus the placement fallback profiles)
- `kinds/types.ts`
- `render/drawing.ts` and `render/style.ts`
- `render/svg.ts` and `components/DrawingSvg.tsx` (the new pen only)
- the locales
- `docs/i18n.md`: glossary for Anschlusspunkt, Installationsplan, Anschlusstabelle, Gewerk, ü. FFB, Absicherung, Festanschluss and Nennweite

**Tests:**
- `trades.test.ts`
- `points.test.ts`:
  - `currentOf(15.9, 400) = 22.9`
  - `fuseFor(22.9) = 25`
  - a 90° turn
  - resizing keeps the override
  - resets
  - `cleanPoints`
  - `wallRefs` in a rectangle and next to a 45° wall
- the pen in `svg.test.ts`

### Wave 1: four developers in parallel

**A, catalog defaults**
- Owns: `kinds/parts/points.ts` (profiles), `kinds/parts/pointRules.ts`, `kinds/registry.ts` (`withConnectionRules`), `kinds/ventilation/entries.ts`, `contract.test.ts`, `pointRules.test.ts`, `kinds/README.md`.

**B, file format and lists**
- Owns: `serialize.ts`, `project.ts`, `equipment.ts`, `pointList.ts`, the v3 fixture, and the examples, regenerated as version 4.
- Tests:
  - key order and round trip;
  - the v3 fixture writes back identical except for its version;
  - v1 and v2 still open;
  - damaged input is refused;
  - version 5 is too new;
  - switching from gas to electric drops the gas override;
  - the CSV.

**C, drawing and symbols**
- Owns: `render/symbols.ts`, `model/installationPlan.ts`, and `model/plan.ts` (`symbols`, `quiet`).
- Tests: symbols centred at every scale; the filter; every point of the example drawn; dimensions measured from wall faces; no overlapping labels at 1:50 and 1:100; the legend; deterministic output.

**D, plan check and heat**
- Owns: `model/heat.ts`, `model/pointChecks.ts`, `checkRules.ts`, `checks.ts`, `clearances.ts`.
- Tests:
  - a positive and a negative case for every rule;
  - the example kitchen gets no new findings;
  - the time budget holds.

### Wave 2: four developers in parallel

**E, inspector**
- Owns: `PointsSection.tsx`, `Inspector.tsx`, `Fields.tsx`, `app.css`.

**F, plan view, filter and exports**
- Owns: `store.ts` (`Prefs.points`), `PlanView.tsx`, `Toolbar.tsx`, `actions.ts`, and a new e2e test that walks through placing a combi, editing a point, seeing it in the plan and exporting it.

**G, PDF**
- Owns: `planSet.ts`, `PlanSetDialog.tsx`, `planSetSettings.ts`, `plan-set.css`, their tests, and `13-plan-set.test.js`.

**H, DXF**
- Owns: `dxf.ts`, `dxfWriter.ts`, `testDxf.ts`, `dxf.test.ts`.

### Wave 3: finish

**3D (G4)**
- `three/points.ts`: coloured stubs per trade.
- `three/engine.ts`.

**Docs**
- `ARCHITECTURE.md`.
- The roadmap: B4, P1, P2 and G4.
- Release notes, written only when the release goes out.

**By hand**
- Open the export in AutoCAD, BricsCAD, LibreCAD and QCAD.
- Have a Fachplaner review the symbols.

## 8. Owner decisions (recommended default first)

Decided 2026-11-12: 1 derived with overrides; 4 ship as typical values, to be confirmed by a ventilation planner later; 2, 3, 5, 6, 7 as recommended. The aisle between facing workplaces stays 1200 mm.

1. **Derived points with overrides only in the file** (recommended), or points written into the file when a unit is created.
   - With derived points, fixing a catalog rule moves the points of old plans that were not overridden. Such changes go into the release notes.
2. **One point per trade per unit for 0.3.** Recommended: yes. The format is keyed by trade, so it can grow later.
3. **Overrides measured from the left edge as seen from the front, from the back edge, and as height above the finished floor.** Recommended: yes.
4. **Heat release and the hood airflow check use own typical values**, marked as advice and not as proof.
   - Recommended: ship them after a check by a ventilation planner.
   - Otherwise: leave both out.
5. **Sheet grouping:** Elektro; Sanitär (KW, WW, EW, AW, BA); Gas; Lüftung; Kälte und Dampf. Each sheet is followed by its table. Recommended: as listed.
6. **Symbols black and told apart by shape**, with colour only through the DXF layers. Recommended: yes.
7. **Own thresholds for the new checks.** Recommended: ship them as unsure own values with their sources noted. The thresholds are:
   - wall reach 300, island reach 1000, floor drain reach 600;
   - the gas-without-hood and gas-shut-off rules.

Out of scope for 0.3:
- points in the elevations;
- several points per trade;
- dragging points in the plan;
- the gas type as a project setting;
- chain dimensions along the walls.

## Wave 0 done (2026-11-12)

The contracts are in place; `tsc` and the full vitest run are green. The file format is still
version 3: `serialize.ts` writes and reads items through fixed key lists, so `points`, `heat` and
the new `connections` keys are ignored (not written, not read) until wave 1-B raises the version.

### Exported API

`model/types.ts`
- `Trade`, `Plug`, `PointOverride`, `ItemPoints`, `HeatRelease`.
- `Connections` gains `softWater`, `supplyM3h`, `steamKgH`, `refrigerationKw`.
- `Item` gains `points?: ItemPoints` and `heat?: HeatRelease`.

`model/trades.ts`
- `TRADES`, `TradeGroup`, `TRADE_GROUPS` (`electric, sanitary, gas, ventilation, special`, the order of the plan set), `TRADE_GROUP`, `PointFilter`.
- `inFilter(trade, filter)`, `activeTrades(c)`.
- `DN_SERIES: Partial<Record<Trade, number[]>>` (per trade; none for electric and refrigeration), `FUSE_SERIES` (10, 13, 16, 20, 25, 32, 35, 40, 50, 63, 80, 100, 125), `PLUGS`, `PLUG_RATING` (`fixed` is `Infinity`).
- `tradeName(trade, lang?)`, `tradeCode(trade, lang?)`, `tradeGroupName(group, lang?)`, `plugName(plug, lang?)`.

`kinds/parts/points.ts`
- Types `Edge`, `Level`, `Along`, `Height`, `PointPlace`, `PointDefault`, `PointLayout`, `ProfileId`.
- `PROFILES` (every profile defines every trade), `defaultPoints(item): Record<Trade, PointDefault>` (all trades, `dn` functions already resolved).
- The hook for wave 1-A: `registerPointRule(rule)`, with `PointRule = (ctx: PointContext) => PointRuleResult | undefined`, `PointContext = { item, entry, kind, placement }`, `PointRuleResult = { profile?, layout? }`. Order: the placement profile, then the registered rules in registration order, then `entry.points`. A `profile` replaces the profile and every layout before it; a `layout` refines. `pointRules.ts` registers its rules (category or group, kind, entry) and must be imported once, for example from `registry.ts`.
- `alongPos(along, length)`, `heightPos(height, item)`.

`model/points.ts`
- `PointValues`, `ConnectionPoint`, `itemPoints(item)`, `projectPoints(items, filter = "all")` (sorted by Pos., then `TRADES` order), `pointLabel(p, lang?)`.
- `currentOf(kw, voltage)` (one decimal), `fuseFor(currentA)`, `phasesOf(voltage)`, `fitPlug(plug, phases, fuseA)`, `gasDn(kw)`, `ductSize(m3h, speed)`, `SINGLE_PHASE_MAX_KW`, `EXHAUST_SPEED`, `SUPPLY_SPEED`.
- `setPoint(item, trade, patch | null)`, `cleanPoints(item)`, `WallRef`, `wallRefs(room, at)`.

`kinds/types.ts`: `CatalogEntry.points?: PointLayout`.

`render/drawing.ts`: shapes may carry `trade?: Trade` and `point?: { itemId; trade }`; the pen `"connection"` is 0.25 mm solid (`style.ts`) and the line colour on screen (`DrawingSvg.tsx` now lists the colour of every pen). `LAYER_OF.connection` is `BESCHRIFTUNG`, a declared layer, only for connection shapes without a trade; wave H puts them on their trade's layer.

### Deviations and decisions

- **Plug fallback.** `PointDefault.plug` is the plug the catalog asks for; `fitPlug` grows it with the fuse (Schuko only on one phase, then CEE 16, CEE 32) and otherwise falls back to a fixed connection. Table-top units ask for Schuko by placement, so the rule „table-top up to 16 A Schuko or CEE 16, up to 32 A CEE 32, else fixed“ already holds for them; wave 1-A adds the cooling and serving units by asking for `schuko` in their layouts, and `PLUG_BY_KIND` sets a plug outright.
- **Without a voltage** a unit up to 3.6 kW counts as 230 V, above that as 400 V.
- **Fuses above 125 A** round up to the next 25 A instead of failing.
- **Base sizes.** Every unit starts with water and steam DN 15, drain DN 50, floor drain DN 100; gas and ducts are sized by load unless a rule gives `dn`. Drains are not greasy unless a rule says so.
- **`wallRefs`** uses only faces the point sees at right angles within their length, and skips a face hidden behind another wall or a full-height partition.
- **`setPoint`** drops an emptied note; `points` becomes undefined when no override is left.
- **Translation guard.** It fails on keys no code uses, so only the keys used now were added (`trade.*`, `trade.*.code`, `tradeGroup.*`, `plug.*`, through the name functions in `trades.ts`), plus the empty marked blocks `// ---- 0.3 A catalog` to `// ---- 0.3 H dxf` at the end of both catalogs. The codes „KW“ and „WW“ are “CW” and “HW” in English, while the equipment list's water cell says “Cold” and “Hot”: both are accepted exceptions in `translations.test.ts`.
- **English names.** The one-term check ties German and English: „Elektro“ is “Electric” (as `energy.electric`), „Abwasser“ is “Drain” (as `list.drain`), and „Kälte“ became „Kälte (Verbund)“ / “Remote refrigeration”, because “Refrigeration” is already the cooling category.

### Planned keys (add them in your block, in both languages)

Check each text against the one-term rule first: the same German text must have the same English
one. „Notiz“ / “Note” clashes with `list.note` („Bemerkung“ / “Note”), so use „Bemerkung“ in German.

| Block | Key | German | English |
|---|---|---|---|
| B | `list.supply` | Zuluft (m³/h) | Supply air (m³/h) |
| B | `list.heat` | Wärme sensibel/latent (kW) | Heat sensible/latent (kW) |
| B | `pointList.no`, `.trade`, `.x`, `.y`, `.wallA`, `.distA`, `.wallB`, `.distB`, `.height`, `.kw`, `.voltage`, `.phases`, `.current`, `.fuse`, `.plug`, `.dn`, `.m3h`, `.kgH`, `.greasy`, `.note` | Nr., Gewerk, X, Y, Wand A, Abstand A, Wand B, Abstand B, Höhe ü. FFB, kW, V, Phasen, A, Absicherung, Anschlussart, DN, m³/h, kg/h, fetthaltig, Bemerkung | No., Trade, X, Y, Wall A, Distance A, Wall B, Distance B, Height above FFL, kW, V, Phases, A, Fuse, Connection type, DN, m³/h, kg/h, greasy, Note |
| C | `legend.title` | Legende | Legend |
| C | `legend.heights` | Höhen in mm über Fertigfußboden (FFB) | Heights in mm above finished floor level (FFL) |
| D | `check.gasNoHood` | Über dem Gasgerät Pos. {pos} hängt keine Abzugshaube oder Lüftungsdecke. | No canopy hood or ventilated ceiling hangs over the gas unit Pos. {pos}. |
| D | `check.gasShutoffMissing` | Im Plan fehlt eine Gas-Notabsperrung. | The plan has no gas emergency shut-off. |
| D | `check.islandSupply` | Der Anschluss {point} liegt {measured} mm von der nächsten Wand, ohne Bodentank, Mediensäule oder Schacht in Reichweite. | The connection {point} is {measured} mm from the nearest wall, with no floor box, service column or shaft within reach. |
| D | `check.floorDrainMissing` | Im Umkreis von {required} mm um den Bodenablauf {point} liegt kein Ablauf und keine Rinne. | No floor drain or channel lies within {required} mm of the floor drain point {point}. |
| D | `check.hoodAirflow` | Die Haube Pos. {hood} saugt {measured} m³/h ab, nötig sind etwa {required} m³/h (Richtwert). | The hood Pos. {hood} extracts {measured} m³/h; about {required} m³/h are needed (typical value). |
| D | `check.pointOutside` | Der Anschluss {point} liegt außerhalb des Raums oder in einer Trennwand. | The connection {point} lies outside the room or inside a partition. |
| E | `inspector.softWater` | Enthärtetes Wasser | Softened water |
| E | `inspector.moreConnections` | Weitere Anschlüsse | More connections |
| E | `inspector.supplyM3h`, `.steamKgH`, `.refrigerationKw` | Zuluft (m³/h), Dampf (kg/h), Kälte (Verbund, kW) | Supply air (m³/h), Steam (kg/h), Remote refrigeration (kW) |
| E | `inspector.heat` | Wärmeabgabe sensibel / latent (kW) | Heat release sensible / latent (kW) |
| E | `inspector.points` | Anschlusspunkte | Connection points |
| E | `point.fromLeft`, `.fromBack`, `.height`, `.current`, `.fuse`, `.plug`, `.dn`, `.greasy`, `.note` | Abstand links, Abstand hinten, Höhe ü. FFB, Strom, Absicherung, Anschlussart, Nennweite, fetthaltig, Bemerkung | From left, From back, Height above FFL, Current, Fuse, Connection type, Nominal size, greasy, Note |
| E | `point.reset`, `point.resetAll` | Zurücksetzen, Alle Anschlusspunkte zurücksetzen | Reset, Reset all connection points |
| F | `view.points` | Anschlüsse | Connections |
| F | `points.off`, `.all`, `.electric`, `.sanitary`, `.gas`, `.ventilation`, `.special` | Anschlüsse aus, alle, nur Elektro, nur Sanitär, nur Gas, nur Lüftung, nur Kälte und Dampf | Connections off, all, electric only, plumbing only, gas only, ventilation only, refrigeration and steam only |
| F | `export.installationSvg`, `.installationDxf`, `.installationPng`, `export.pointsCsv` | Installationsplan als SVG…, …DXF…, …PNG…, Anschlussliste als CSV… | Installation plan as SVG…, …DXF…, …PNG…, Connection list as CSV… |
| G | `planSet.installation`, `planSet.pointTable` | Installationsplan {group}, Anschlusstabelle {group} | Installation plan {group}, Connection table {group} |
| G | `planSet.col.no`, `.wall`, `.height`, `.values`, `.note`; `planSet.sumKw`, `planSet.sumKwFactored` | Nr., Abstand/Wand, Höhe ü. FFB, Werte, Bemerkung; Summe (kW), Mit Gleichzeitigkeit {f} (kW) | No., Distance/wall, Height above FFL, Values, Note; Total (kW), With simultaneity {f} (kW) |

H needs no keys: the DXF tags and prompts are German and fixed, like the existing ones.
