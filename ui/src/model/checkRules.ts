// The thresholds of the workplace checks (`clearances.ts`) and which units they apply to, in one
// place. Every value names the rule it follows; values marked UNSURE are the planner's usual
// practice or our own reading and should be confirmed (docs/ARCHITECTURE.md, "Plan check").
//
// Sources:
// - ASR A1.2 „Raumabmessungen und Bewegungsflächen“ (movement areas; own function areas of
//   equipment may overlap the worker's own movement area, 5.1.5).
// - ASR A1.8 „Verkehrswege“ (traffic routes).
// - DGUV Regel 110-002 „Arbeiten in Küchenbetrieben“ (formerly BGR 111), replaced in 2019 by DGUV
//   Regel 110-003 „Branche Küchenbetriebe“; its figures are still taken as the state of the art.
//   UNSURE whether 110-003 repeats each of them.
// - VDI 2052 „Raumlufttechnische Anlagen für Küchen“ (hoods).
// - Regulation (EC) 852/2004, Annex II, and the LMHV (hand-wash basins).
//
// The checks read these as advice for a planner, not as a certificate: a finding says what was
// measured and what the rule asks for, never that a norm is met. Lengths are millimetres.

/**
 * Free depth in front of a workplace (Bewegungsfläche): DGUV Regel 110-002, 3.2.1.4 (at least
 * 1.50 m² and nowhere narrower than 1.00 m), the same as ASR A1.2.
 */
export const MOVEMENT_DEPTH = 1000;
/** Width of that movement area along the unit's front (the same rule); in front of a narrow unit it reaches over its neighbours. */
export const MOVEMENT_WIDTH = 1000;

/**
 * Clear width of an aisle between two workplaces facing each other: a traffic route that includes
 * workplaces, DGUV Regel 110-002, 3.2.3.1 („mindestens 1,20 m“). UNSURE: many planners ask for
 * 1.50 m where both sides are worked at the same time; the roadmap wants this adjustable (P4).
 */
export const AISLE_WIDTH = 1200;

/**
 * Free depth in front of shelving, and the aisle between shelving rows facing each other: a store
 * is walked and loaded by hand, not worked at all day. ASR A1.8 allows about 0.75 to 1.00 m
 * between storage racks walked by few people. UNSURE: the section and the value within that range
 * are to be confirmed; where a trolley or a pallet truck drives between the racks it needs more.
 */
export const SHELF_AISLE = 800;

/**
 * Free depth in front of a door or passage of the room on each side it can be walked from: a
 * movement area as deep as the one at a workplace (ASR A1.8 keeps traffic routes to doors free;
 * the depth is ours). UNSURE.
 */
export const DOOR_APPROACH_DEPTH = 1000;

/**
 * Overhang of a hood over the cooking units below it on every open side: DGUV Regel 110-002,
 * 3.2.11.1 („umlaufend mindestens 0,2 m“, for a lower edge of 2.10 m), in line with VDI 2052.
 * Sides against a wall (or a partition at least `WALL_HEIGHT` high) need no overhang. UNSURE:
 * VDI 2052 asks for more overhang the higher the hood hangs; the check does not scale it.
 */
export const HOOD_OVERHANG = 200;
/**
 * Overhang on the door side of units with a door that releases steam: DGUV Regel 110-002,
 * 3.2.11.1 („mindestens 0,4 m an der Türseite“, e.g. combi steamers).
 */
export const HOOD_OVERHANG_DOOR = 400;

/**
 * A partition from this height on counts as a wall: it separates areas for the hand-wash rule,
 * and a hood may end at it. The usual lower edge of a hood (kinds/parts/sizes.ts).
 */
export const WALL_HEIGHT = 2000;

/**
 * Greatest distance from a production unit to a hand-wash basin in the same area (centre to
 * centre). Regulation (EC) 852/2004, Annex II, asks for enough basins placed where they are
 * needed, without a figure. UNSURE: our own value for „close to the workplace“.
 */
export const HANDWASH_DISTANCE = 8000;

/**
 * Free depth to tilt a pan or kettle forward: the pouring lip, a GN container or trolley under
 * it and the cook behind. UNSURE: usual planning value, no rule gives a figure.
 */
export const TILT_DEPTH = 1200;
/** Free depth to wheel a rack trolley into a roll-in unit and stand behind it. UNSURE: usual planning value. */
export const ROLL_IN_DEPTH = 1500;
/** Depth of a door that folds down (oven under a range, deck oven, undercounter dishwasher). UNSURE. */
export const DROP_DOOR_DEPTH = 600;

/** A measured value this much short of the required one is rounding, not a finding. */
export const TOLERANCE = 1;

/** Why a unit needs free space in front beyond the movement area (a finding key each). */
export type FunctionKind = "door" | "tilt" | "rollIn" | "hood";

/**
 * Units with a door, lid or pan that opens towards the operator, with how deep that function
 * area reaches in front and why. ASR A1.2: it may overlap the operator's own movement area, so it
 * only adds where it is deeper or wider than that; it must be free over the unit's whole width.
 * A side-hinged door (`"leaf"`) reaches as deep as its leaf is wide: the unit's width, or half of
 * it for two leaves (`TWO_LEAF_ENTRIES`).
 */
export const FUNCTION_AREAS: Readonly<Record<string, { kind: FunctionKind; depth: number | "leaf" }>> = {
  // Side-hinged doors: ovens, cabinets.
  combiOven: { kind: "door", depth: "leaf" },
  convectionOven: { kind: "door", depth: "leaf" },
  steamer: { kind: "door", depth: "leaf" },
  cookHold1: { kind: "door", depth: "leaf" },
  cookHold2: { kind: "door", depth: "leaf" },
  smoker: { kind: "door", depth: "leaf" },
  fridge: { kind: "door", depth: "leaf" },
  freezer: { kind: "door", depth: "leaf" },
  fridgeHalf: { kind: "door", depth: "leaf" },
  fridgeGlass: { kind: "door", depth: "leaf" },
  fridgeFish: { kind: "door", depth: "leaf" },
  meatAgingCabinet: { kind: "door", depth: "leaf" },
  doughRetarder: { kind: "door", depth: "leaf" },
  blastChiller: { kind: "door", depth: "leaf" },
  proofer: { kind: "door", depth: "leaf" },
  // Doors folding down.
  range: { kind: "door", depth: DROP_DOOR_DEPTH },
  solidTop: { kind: "door", depth: DROP_DOOR_DEPTH },
  deckOven1: { kind: "door", depth: DROP_DOOR_DEPTH },
  deckOven2: { kind: "door", depth: DROP_DOOR_DEPTH },
  undercounterDishwasher: { kind: "door", depth: DROP_DOOR_DEPTH },
  frontLoaderCabinet: { kind: "door", depth: DROP_DOOR_DEPTH },
  // Tilting pans and kettles.
  tiltingPan: { kind: "tilt", depth: TILT_DEPTH },
  pressurePan: { kind: "tilt", depth: TILT_DEPTH },
  multiPan: { kind: "tilt", depth: TILT_DEPTH },
  kettle: { kind: "tilt", depth: TILT_DEPTH },
  kettleIndirect: { kind: "tilt", depth: TILT_DEPTH },
  kettleMixer: { kind: "tilt", depth: TILT_DEPTH },
  multiCooker: { kind: "tilt", depth: TILT_DEPTH },
  // Roll-in units for rack trolleys.
  fridgeRollIn: { kind: "rollIn", depth: ROLL_IN_DEPTH },
  freezerRollIn: { kind: "rollIn", depth: ROLL_IN_DEPTH },
  blastChillerRollIn: { kind: "rollIn", depth: ROLL_IN_DEPTH },
  // A hood-type dishwasher: the operator lifts the hood standing in front of the whole unit.
  dishwasher: { kind: "hood", depth: MOVEMENT_DEPTH },
};

/** Catalog entries of a kind listed above that work differently: the floor-standing 20 × GN combi takes a rack trolley. */
export const FUNCTION_AREAS_BY_ENTRY: Readonly<Record<string, { kind: FunctionKind; depth: number }>> = {
  "combi-20": { kind: "rollIn", depth: ROLL_IN_DEPTH },
};

/** Fridges with two leaves side by side: each sweeps half the width. */
export const TWO_LEAF_ENTRIES: ReadonlySet<string> = new Set(["fridge-1400", "freezer-1400"]);

/** Catalog areas whose floor units are workplaces: they need a movement area in front. */
export const WORKPLACE_CATEGORIES: ReadonlySet<string> = new Set(["cooking", "cooling", "washing", "tables", "prep", "serving", "storage"]);
/**
 * Kinds in those areas nobody works at: machines that are only serviced, and what is moved or
 * stacked rather than worked at (pallets, crates, trolleys, mobile racks and bins, dispensers on
 * castors). They are still obstacles in front of the others.
 */
export const NOT_WORKPLACES: ReadonlySet<string> = new Set([
  "condensingUnit",
  "waterSoftener",
  // Storage: delivery, crates, trolleys and mobile racks.
  "euroPallet",
  "crates",
  "crateDolly",
  "sackTruck",
  "rackTrolley15",
  "rackTrolley20",
  "plateTrolley",
  "ingredientBin",
  "mobileShelving",
  // Washing: trolleys and the mobile basket dispenser.
  "rackTrolley",
  "rackDispenser",
  "cleaningTrolley",
  "cutlerySoakTrolley",
  "trayReturnTrolley",
  // Serving: plate and tray dispensers on castors.
  "plateDispenser",
  "plateDispenserHeated",
  "trayStand",
]);

/**
 * Shelving and racks: their free space in front, and the aisle between two of them, is
 * `SHELF_AISLE` instead of a workplace's movement area. Facing a workplace, the workplace's aisle
 * applies.
 */
export const SHELVING_KINDS: ReadonlySet<string> = new Set([
  "shelving",
  "shelving5",
  "shelvingCorner",
  "shelvingPerforated",
  "shelvingSlatted",
  "coldRoomShelving",
  "gnShelving",
  "breadRack",
  "wineRack",
  "trayRack",
  "dunnageRack",
]);

/** Hoods over cooking units (VDI 2052): canopies and ventilated ceilings. */
export const HOOD_KINDS: ReadonlySet<string> = new Set(["hood", "hoodIsland", "hoodUv", "hoodSupply", "ventCeiling", "ventCeilingSupply"]);
/** A condensing hood sits on the oven it serves and replaces the canopy for it (catalog: „für Kombidämpfer“). */
export const CONDENSING_HOOD_KIND = "condensingHood";
export const CONDENSING_HOOD_SERVES: ReadonlySet<string> = new Set(["combiOven", "convectionOven"]);
/** A downdraft module extracts at the cooking units it stands beside in the line. */
export const DOWNDRAFT_KIND = "downdraft";

/**
 * Cooking units that need no hood although they are in the cooking area: no cooking at all
 * (neutral elements, cabinets, covers), only holding warm, closed units without vapour worth
 * extracting, pizza ovens with their own flue, and small water baths and cookers that stay below
 * boiling or keep their lid on. UNSURE for the microwave, the pizza ovens and the water baths: the
 * ventilation planner decides. Units that fry or bake on a plate (waffle iron, crêpe maker,
 * contact grill) give off fat vapour and keep needing one.
 */
export const NO_HOOD_KINDS: ReadonlySet<string> = new Set([
  "lineNeutral",
  "lineCabinet",
  "lineHeatedCabinet",
  "hobCover",
  "holdingCabinet",
  "cookHold1",
  "microwave",
  "domeOven",
  "rotatingOven",
  // Water baths and closed cookers. UNSURE.
  "bainMarie",
  "sousVide",
  "riceCooker",
  "eggBoiler",
]);

/** Units with a door that releases steam: they need `HOOD_OVERHANG_DOOR` at the front. */
export const STEAM_DOOR_KINDS: ReadonlySet<string> = new Set(["combiOven", "convectionOven", "steamer", "steamerTable", "deckOven1", "deckOven2", "smoker"]);

// --- Connection points and gas (pointChecks.ts; the gas hood rule in clearances.ts) ------------
//
// Sources: DVGW-Arbeitsblatt G 631 „Installation von gewerblichen Gasverbrauchseinrichtungen“ and
// the DVGW-TRGI (gas units in kitchens). UNSURE: the clauses are to be confirmed; the other values
// are our own planning values (docs/design/connections-0.3.md, section 6).

// A gas unit is used only under a hood or ventilated ceiling (`HOOD_KINDS`) that takes its flue
// gas: DVGW G 631 / TRGI, UNSURE which clause. A condensing hood or a downdraft module does not
// count for it, and the kinds of `NO_HOOD_KINDS` need one too when they burn gas.

/** The gas emergency shut-off (Gas-Notabsperrung) a plan with gas units needs: DVGW G 631. UNSURE: the clause. */
export const GAS_SHUTOFF_KIND = "gasShutoffBox";

/**
 * A water, drain or gas point this close to a wall face (outer wall or partition) is supplied
 * along the wall. UNSURE: own value.
 */
export const WALL_REACH = 300;
/**
 * Further from a wall, a point needs a floor box, a media column, a shaft or a column within this
 * distance (to its outline) to bring the pipe up; a drain may also run to a floor drain, gully or
 * channel. A point at height 0 counts as coming from the floor. UNSURE: own value.
 */
export const ISLAND_REACH = 1000;
/** What supplies a point away from the walls: floor boxes, media columns, shafts, columns. */
export const ISLAND_SUPPLY_KINDS: ReadonlySet<string> = new Set(["floorBox", "mediaColumn", "shaft", "column", "columnRound", "columnClad"]);

/** Floor drains, gullies and drainage channels: what a floor drain point (and an island drain) runs to. */
export const FLOOR_DRAIN_KINDS: ReadonlySet<string> = new Set(["floorDrain", "floorGully", "floorGullyBucket", "drainChannel"]);
/**
 * A floor drain point (in front of a tilting pan or kettle) needs a floor drain or channel within
 * this distance (to its outline). UNSURE: own value.
 */
export const FLOOR_DRAIN_REACH = 600;

/**
 * A point the planner moved may lie this far past its unit's outline (mm) before it counts as off
 * the unit: a connection stub on the back or side, a pipe into the wall a basin hangs on. Units
 * that were made smaller after a point was placed are what this finds. UNSURE: own value.
 */
export const POINT_OFF_UNIT = 50;
/**
 * A floor drain point may lie this far in front of its unit (mm): a tilting pan or kettle pours
 * forward. The catalog contract allows the same (kinds/contract.test.ts).
 */
export const FLOOR_DRAIN_FRONT = 600;

/**
 * Exhaust air a hood needs per kW of heat (sensible plus latent, `model/heat.ts`) released by the
 * units under it, after the project's simultaneity factor (m³/h per kW). UNSURE: own value, not
 * from the VDI 2052 tables; calibrated on the example kitchen (examples/README.md) so that it
 * passes at the catalog airflows. Its tightest hood is the west island hood: 4200 m³/h over about
 * 43.8 kW of heat (fryer, pasta cooker, bain-marie, solid top, chargrill, and its share of the
 * range and the griddle), 96 m³/h per kW; the east island hood has 138, the wall hood over the
 * tilting pan and the kettle 144. Rounded down to 90, so the example keeps about 6 % in hand. A
 * typical value, worded as such; a ventilation planner sizes the hoods.
 */
export const HOOD_AIR_PER_KW = 90;
/** The needed airflow is rounded up to this step (m³/h), as the catalog gives hood airflows. */
export const AIRFLOW_STEP = 10;

/** Hand-wash basins: on the wall, standing, or built into a table. */
export const HANDWASH_KINDS: ReadonlySet<string> = new Set(["handwash", "handwashKnee", "handwashStation", "handwashPedal", "tableHandwash"]);

/**
 * Where open food or dirty dishes are handled, so a hand-wash basin has to be close: the catalog
 * areas, and in the washing area only the sinks and the dish wash (not cleaning or hygiene
 * equipment), in serving all but self-service (guests serve themselves there).
 */
export const PRODUCTION_CATEGORIES: ReadonlySet<string> = new Set(["cooking", "tables", "prep", "washing", "serving"]);
export const NOT_PRODUCTION_GROUPS: ReadonlySet<string> = new Set(["hygiene", "cleaning", "selfService"]);
