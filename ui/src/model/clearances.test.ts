import { describe, expect, it } from "vitest";
import { checkProject } from "./checks";
import {
  AISLE_WIDTH,
  CONDENSING_HOOD_SERVES,
  DOOR_APPROACH_DEPTH,
  FUNCTION_AREAS,
  HANDWASH_DISTANCE,
  HANDWASH_KINDS,
  HOOD_KINDS,
  HOOD_OVERHANG,
  HOOD_OVERHANG_DOOR,
  MOVEMENT_DEPTH,
  NO_HOOD_KINDS,
  NOT_WORKPLACES,
  STEAM_DOOR_KINDS,
  FUNCTION_AREAS_BY_ENTRY,
  TWO_LEAF_ENTRIES,
  TILT_DEPTH,
  ROLL_IN_DEPTH,
  SHELF_AISLE,
  SHELVING_KINDS,
} from "./checkRules";
import { footprint, rectRoom } from "./geometry";
import { testItem, testProject } from "./testProject";
import { catalogEntry, KINDS } from "../kinds/registry";
import type { Item, Opening, Partition, Project } from "./types";

/** The findings whose key starts with one of `prefixes` (a rule's group). */
const only = (p: Project, ...prefixes: string[]) => checkProject(p).filter((i) => prefixes.some((k) => i.key.startsWith(k)));
const front = (p: Project) => only(p, "check.movement", "check.aisle", "check.function");

describe("the thresholds", () => {
  it("name only kinds and entries the catalog has", () => {
    const kinds = new Set(KINDS.map((k) => k.kind));
    const named = [
      ...Object.keys(FUNCTION_AREAS),
      ...HOOD_KINDS,
      ...NO_HOOD_KINDS,
      ...STEAM_DOOR_KINDS,
      ...HANDWASH_KINDS,
      ...NOT_WORKPLACES,
      ...SHELVING_KINDS,
      ...CONDENSING_HOOD_SERVES,
    ];
    expect(named.filter((k) => !kinds.has(k))).toEqual([]);
    expect([...Object.keys(FUNCTION_AREAS_BY_ENTRY), ...TWO_LEAF_ENTRIES].filter((id) => !catalogEntry(id))).toEqual([]);
  });

  it("keep the values of the rules they follow", () => {
    // DGUV Regel 110-002 3.2.1.4, 3.2.3.1 and 3.2.11.1 (docs/ARCHITECTURE.md, "Plan check").
    expect([MOVEMENT_DEPTH, AISLE_WIDTH, HOOD_OVERHANG, HOOD_OVERHANG_DOOR]).toEqual([1000, 1200, 200, 400]);
  });
});

describe("free space in front of units", () => {
  it("reports an aisle between two workplaces facing each other once, with both units", () => {
    // n: front at y 700. s faces north, its front 900 mm away.
    const p = testProject([testItem("n", "table", 2000, 350), testItem("s", "table", 2000, 1950, 180)]);
    expect(front(p)).toEqual([{ key: "check.aisle", vars: { a: 1, b: 2, measured: 900, required: AISLE_WIDTH }, itemIds: ["n", "s"] }]);
    p.items[1] = { ...p.items[1], y: 2250 };
    expect(front(p)).toEqual([]);
  });

  it("asks for a movement area 1 m deep in front of a workplace, naming what is in the way", () => {
    // A column 400 mm in front of the table's middle: no 1 m wide stretch in front of it is free.
    const p = testProject([testItem("t", "table", 2000, 350), testItem("c", "column", 2000, 1300)]);
    expect(front(p)).toEqual([{ key: "check.movement", vars: { pos: 1, measured: 400, required: MOVEMENT_DEPTH }, itemIds: ["t", "c"] }]);
    // Moved to the table's end, the column leaves a free stretch 1 m wide in front of it.
    p.items[1] = { ...p.items[1], x: 1600 - 1000 };
    expect(front(p)).toEqual([]);
  });

  it("measures to the nearest corner of an obstacle turned against the unit", () => {
    // A table 600 wide: every movement area in front of it covers the corner straight ahead.
    // Columns 400 × 400 turned by 45° and 105°, their nearest corner 400 mm in front, on and off
    // the bounds of the measuring cells.
    for (const rotation of [45, 105]) {
      for (const dx of [0, 20, 37.5]) {
        const column = testItem("c", "column", 0, 0, rotation);
        const corner = footprint(column).reduce((a, b) => (b.y < a.y ? b : a));
        const p = testProject([testItem("t", "table", 2000, 350, 0, { width: 600 }), { ...column, x: 2000 + dx - corner.x, y: 700 + 400 - corner.y }]);
        expect(front(p).map((i) => [i.key, i.vars.measured, i.itemIds])).toEqual([["check.movement", 400, ["t", "c"]]]);
      }
    }
  });

  it("counts a wall right at the front", () => {
    // Turned with its front to the north wall.
    const p = testProject([testItem("t", "table", 2000, 350, 180)]);
    expect(front(p)).toEqual([{ key: "check.movement", vars: { pos: 1, measured: 0, required: MOVEMENT_DEPTH }, itemIds: ["t"] }]);
  });

  it("does not count a dead corner beside a unit, nor neighbours standing further forward", () => {
    // The north table's west end is a dead corner behind the end of the west table; east of it 1 m is free.
    const corner = testProject([testItem("n", "table", 600, 350), testItem("w", "table", 350, 1400, -90)]);
    expect(front(corner)).toEqual([]);
    // A plate dispenser 470 deep between two counters 700 deep.
    const recess = testProject([testItem("a", "pass-counter", 800, 350), testItem("d", "plate-dispenser", 2020, 235), testItem("b", "pass-counter", 3240, 350)]);
    expect(front(recess)).toEqual([]);
  });

  it("leaves units that nobody works at, and units side by side in a row, alone", () => {
    const p = testProject([
      testItem("a", "table", 600, 350),
      testItem("b", "table", 1800, 350),
      testItem("u", "condensing-unit", 2950, 250),
      testItem("c", "column", 3600, 200),
    ]);
    expect(front(p)).toEqual([]);
  });

  it("asks for a narrower aisle between shelving rows and in front of shelving", () => {
    // n: front at y 500. s faces north, its front 900 mm away: wide enough between racks.
    const store = testProject([testItem("n", "shelving", 2000, 250), testItem("s", "shelving", 2000, 500 + 900 + 250, 180)]);
    expect(front(store)).toEqual([]);
    store.items[1] = { ...store.items[1], y: 500 + 700 + 250 };
    expect(front(store)).toEqual([{ key: "check.aisle", vars: { a: 1, b: 2, measured: 700, required: SHELF_AISLE }, itemIds: ["n", "s"] }]);
    // Shelving facing a work table: the table's aisle.
    const mixed = testProject([testItem("n", "shelving", 2000, 250), testItem("t", "table", 2000, 500 + 900 + 350, 180)]);
    expect(front(mixed).map((i) => [i.key, i.vars.required])).toEqual([["check.aisle", AISLE_WIDTH]]);
    // A column 850 mm in front of a shelf is enough, 700 mm is not.
    const column = testProject([testItem("s", "shelving", 2000, 250), testItem("c", "column", 2000, 500 + 850 + 200)]);
    expect(front(column)).toEqual([]);
    column.items[1] = { ...column.items[1], y: 500 + 700 + 200 };
    expect(front(column)).toEqual([{ key: "check.movement", vars: { pos: 1, measured: 700, required: SHELF_AISLE }, itemIds: ["s", "c"] }]);
  });

  it("asks nothing in front of pallets, crates and trolleys, which are still in the way of others", () => {
    // A euro pallet with its front to the north wall, and a rack trolley turned to a column.
    const p = testProject([testItem("e", "euro-pallet", 2000, 400, 180), testItem("r", "rack-trolley-15", 5000, 280), testItem("c", "column", 5000, 560 + 300 + 200)]);
    expect(front(p)).toEqual([]);
    // A table facing the pallet 600 mm away: a movement finding for the table, naming the pallet.
    const t = testProject([testItem("e", "euro-pallet", 2000, 400), testItem("t", "table", 2000, 800 + 600 + 350, 180)]);
    expect(front(t)).toEqual([{ key: "check.movement", vars: { pos: 2, measured: 600, required: MOVEMENT_DEPTH }, itemIds: ["t", "e"] }]);
  });

  it("asks for a door's function area over the whole width of the unit", () => {
    // A combi steamer 850 wide: its door sweeps 850 mm; a column 700 mm in front.
    const p = testProject([testItem("o", "combi-10", 2000, 425), testItem("c", "column", 2000, 850 + 700 + 200)]);
    expect(front(p)).toEqual([{ key: "check.functionDoor", vars: { pos: 1, measured: 700, required: 850 }, itemIds: ["o", "c"] }]);
    // Two leaves sweep half the width each.
    const fridge = testProject([testItem("f", "fridge-1400", 2000, 415), testItem("c", "column", 2000, 830 + 650 + 200)]);
    expect(front(fridge).map((i) => i.vars)).toEqual([{ pos: 1, measured: 650, required: 700 }]);
  });

  it("asks for room to tilt a pan and to wheel in a rack trolley, reported once per gap", () => {
    // A table faces the tilting pan 1100 mm away: the pan needs more than the aisle, and that is the finding.
    const pan = testProject([testItem("k", "tilting-pan", 2000, 450), testItem("t", "table", 2000, 900 + 1100 + 350, 180)]);
    expect(front(pan)).toEqual([{ key: "check.functionTilt", vars: { pos: 1, measured: 1100, required: TILT_DEPTH }, itemIds: ["k", "t"] }]);
    const rollIn = testProject([testItem("o", "combi-20", 2000, 450), testItem("c", "column", 2000, 900 + 1300 + 200)]);
    expect(front(rollIn)).toEqual([{ key: "check.functionRollIn", vars: { pos: 1, measured: 1300, required: ROLL_IN_DEPTH }, itemIds: ["o", "c"] }]);
  });
});

describe("free space in front of doors", () => {
  /** The test room's door (south wall, x 695 to 1705) as given. */
  function withDoor(door: Partial<Opening>, items: Item[]) {
    const p = testProject(items);
    p.room.openings = [{ ...p.room.openings[0], ...door }];
    return p;
  }

  it("keeps 1 m in front of a door free on the room side, also where its leaf does not swing", () => {
    // 650 mm from the wall face; a sliding door has no swing square.
    expect(only(withDoor({ kind: "slidingDoor" }, [testItem("t", "table", 1200, 5000)]), "check.door")).toEqual([
      { key: "check.doorApproach", vars: { pos: 1, measured: 650, required: DOOR_APPROACH_DEPTH }, itemIds: ["t"] },
    ]);
    // A door opening out: the table 50 mm inside it.
    expect(only(withDoor({ swing: "out" }, [testItem("t", "table", 1200, 5600)]), "check.door").map((i) => i.vars.measured)).toEqual([50]);
    // In the swing square it is the door finding, not both.
    expect(only(withDoor({}, [testItem("t", "table", 1200, 5600)]), "check.door").map((i) => i.key)).toEqual(["check.doorBlocked"]);
    // Beside the opening, or 1 m away, is fine.
    expect(only(withDoor({ kind: "slidingDoor", hinge: "end" }, [testItem("a", "table", 2400, 5650, 180), testItem("b", "table", 1200, 4650)]), "check.door")).toEqual([]);
  });

  it("keeps both sides of a door in a partition free", () => {
    // A partition from the north wall 3 m south at x 3000; its door (y 1000 to 1900) opens east.
    const N: Partition = { id: "n", a: { x: 3000, y: 0 }, b: { x: 3000, y: 3000 }, thickness: 100, height: 3000 };
    const p = testProject([testItem("w", "table", 2300, 1450, 90)]);
    p.room.partitions = [N];
    p.room.openings.push({ id: "d", kind: "door", wall: 0, partition: "n", offset: 1450, width: 900, height: 2100, sill: 0 });
    // The west face is at x 2950, the table ends at x 2650.
    expect(only(p, "check.door")).toEqual([{ key: "check.doorApproach", vars: { pos: 1, measured: 300, required: DOOR_APPROACH_DEPTH }, itemIds: ["w"] }]);
  });
});

describe("hoods over cooking units", () => {
  const hoods = (p: Project) => only(p, "check.hood");

  it("reports a cooking unit without a hood, but not units that do not cook", () => {
    expect(hoods(testProject([testItem("r", "range-6", 4000, 450)]))).toEqual([{ key: "check.hoodMissing", vars: { pos: 1 }, itemIds: ["r"] }]);
    expect(hoods(testProject([testItem("n", "neutral-900", 4000, 450), testItem("t", "table", 2000, 350)]))).toEqual([]);
    // Water baths and closed cookers do not; a waffle iron does.
    const small = testProject([testItem("t", "table", 2000, 350, 0, { width: 2400 }), testItem("s", "sous-vide", 1200, 300), testItem("r", "rice-cooker", 1700, 225), testItem("e", "egg-boiler", 2200, 190), testItem("w", "waffle-iron", 2800, 225)]);
    expect(hoods(small)).toEqual([{ key: "check.hoodMissing", vars: { pos: 5 }, itemIds: ["w"] }]);
    expect(hoods(testProject([testItem("b", "bain-marie", 4000, 450)]))).toEqual([]);
    // A table-top unit needs one as well.
    expect(hoods(testProject([testItem("t", "table", 2000, 350), testItem("g", "contact-grill", 2000, 225)]))).toEqual([
      { key: "check.hoodMissing", vars: { pos: 2 }, itemIds: ["g"] },
    ]);
  });

  it("gives the overhang at the front, the back and the sides against the one needed", () => {
    // A hood 1000 deep over a range 900 deep: 100 mm at the front.
    const short = testProject([testItem("r", "range-6", 4000, 450), testItem("h", "hood-wall", 4000, 500, 0, { depth: 1000 })]);
    expect(hoods(short)).toEqual([{ key: "check.hoodFront", vars: { pos: 1, hood: 2, measured: 100, required: HOOD_OVERHANG }, itemIds: ["r", "h"] }]);
    // As wide as the range: flush at the sides.
    const flush = testProject([testItem("r", "range-6", 4000, 450), testItem("h", "hood-wall", 4000, 550, 0, { width: 1200 })]);
    expect(hoods(flush).map((i) => [i.key, i.vars.measured])).toEqual([["check.hoodSide", 0]]);
    // Shifted west: it ends 300 mm inside the range's east side.
    const shifted = testProject([testItem("r", "range-6", 4000, 450), testItem("h", "hood-wall", 3700, 550, 0, { width: 1200 })]);
    expect(hoods(shifted).map((i) => [i.key, i.vars.measured, i.vars.required])).toEqual([["check.hoodSide", -300, HOOD_OVERHANG]]);
    // A unit standing free with a hood that only covers its own outline: the back too.
    const island = testProject([testItem("r", "range-6", 4000, 2000), testItem("h", "hood-island", 4000, 2000, 0, { width: 1600, depth: 900 })]);
    expect(hoods(island).map((i) => [i.key, i.vars.measured])).toEqual([["check.hoodFront", 0]]);
  });

  it("needs no overhang towards a wall, and takes hoods side by side as one", () => {
    // In the north-west corner: the west side against the wall.
    const corner = testProject([testItem("r", "range-6", 600, 450), testItem("h", "hood-wall", 800, 550, 0, { width: 1600 })]);
    expect(hoods(corner)).toEqual([]);
    // Two hoods meeting above the middle of the range.
    const two = testProject([testItem("r", "range-6", 4000, 450), testItem("a", "hood-wall", 3400, 550, 0, { width: 1200 }), testItem("b", "hood-wall", 4600, 550, 0, { width: 1200 })]);
    expect(hoods(two)).toEqual([]);
  });

  it("asks for more at the door of an oven, or takes its condensing hood", () => {
    // A combi steamer 800 deep under a hood 1100 deep: 300 at the front, 400 needed.
    const canopy = testProject([testItem("o", "combi-6", 2000, 400), testItem("h", "hood-wall", 2000, 550, 0, { width: 1600 })]);
    expect(hoods(canopy).map((i) => [i.key, i.vars.measured, i.vars.required])).toEqual([["check.hoodFront", 300, HOOD_OVERHANG_DOOR]]);
    const condensing = testProject([testItem("o", "combi-6", 2000, 400), testItem("h", "condensing-hood", 2000, 550)]);
    expect(hoods(condensing)).toEqual([]);
  });

  it("takes a downdraft module beside a hob, and no hood hanging below the unit's top", () => {
    const dd = testProject([testItem("i", "induction-4", 2000, 450), testItem("d", "downdraft", 2600, 450)]);
    expect(hoods(dd)).toEqual([]);
    const low = testProject([testItem("r", "range-6", 4000, 450), testItem("h", "hood-wall", 4000, 550, 0, { elevation: 800 })]);
    expect(hoods(low).map((i) => i.key)).toEqual(["check.hoodMissing"]);
  });
});

describe("hand-wash basins", () => {
  const basins = (p: Project) => only(p, "check.handwash");

  it("asks for a basin where food is handled, once for the whole plan when there is none", () => {
    expect(basins(testProject([testItem("t", "table", 2000, 350), testItem("r", "range-6", 4000, 450)]))).toEqual([{ key: "check.handwashNone", vars: {}, itemIds: [] }]);
    // A store needs none; a table with its own basin is one.
    expect(basins(testProject([testItem("s", "shelving", 2000, 250)]))).toEqual([]);
    expect(basins(testProject([testItem("t", "table-handwash", 2000, 350)]))).toEqual([]);
  });

  it("gives the distance to the nearest basin against the greatest one", () => {
    // From (600, 350) to the basin on the south wall at (7600, 5825): 8887 mm.
    const p = testProject([testItem("t", "table", 600, 350), testItem("b", "handwash", 7600, 5825, 180)]);
    expect(basins(p)).toEqual([{ key: "check.handwashFar", vars: { pos: 1, basin: 2, measured: 8887, required: HANDWASH_DISTANCE }, itemIds: ["t", "b"] }]);
    p.items[1] = { ...p.items[1], x: 2600 };
    expect(basins(p)).toEqual([]);
  });

  it("does not count a basin behind a wall", () => {
    const p = testProject([testItem("t", "table", 2000, 350), testItem("b", "handwash", 6000, 175)]);
    p.room.partitions = [{ id: "x", a: { x: 4000, y: 0 }, b: { x: 4000, y: 6000 }, thickness: 100, height: 3000 }];
    expect(basins(p)).toEqual([{ key: "check.handwashArea", vars: { pos: 1 }, itemIds: ["t"] }]);
    // A half-height partition does not separate the areas.
    p.room.partitions[0].height = 1200;
    expect(basins(p)).toEqual([]);
  });
});

describe("the workplace findings in the plan check", () => {
  it("come after the layout findings in a stable order: front, doors, hoods, hand-wash", () => {
    const p = testProject([
      testItem("tall", "table", 4000, 3000, 0, { height: 3500 }),
      testItem("t", "table", 6000, 350),
      testItem("c", "column", 6000, 1300),
      testItem("door", "table", 1200, 5000, 180),
      testItem("r", "range-6", 3000, 450),
    ]);
    p.room.openings[0] = { ...p.room.openings[0], kind: "slidingDoor" };
    expect(checkProject(p).map((i) => i.key)).toEqual(["check.tooHigh", "check.movement", "check.doorApproach", "check.hoodMissing", "check.handwashNone"]);
    expect(checkProject(p)).toEqual(checkProject(structuredClone(p)));
  });

  /**
   * Kitchens in a hall, 50 items each: lines of cooking units under hoods facing work tables across
   * an aisle, fridges and a basin. `turn` gives the rotation of the i-th table.
   */
  function hall(kitchens: number, turn: (i: number) => number): Project {
    const items: Item[] = [];
    const add = (id: string, catalogId: string, x: number, y: number, rotation = 0, over: Partial<Item> = {}) => items.push(testItem(id, catalogId, x, y, rotation, { pos: items.length + 1, ...over }));
    for (let k = 0; k < kitchens; k++) {
      const y = k * 4000;
      let x = 0;
      for (let i = 0; i < 20; i++) {
        const id = ["range-6", "fryer-2", "griddle", "tilting-pan", "combi-10"][i % 5];
        const w = catalogEntry(id)?.width ?? 0;
        add(`c${k}-${i}`, id, x + w / 2, y + 450);
        x += w;
      }
      add(`h${k}`, "hood-wall", x / 2, y + 550, 0, { width: x + 400 });
      for (let i = 0; i < 25; i++) add(`t${k}-${i}`, i % 5 === 4 ? "fridge-700" : "table", 600 + i * 1200, y + 3000, turn(i), i % 5 === 4 ? { width: 1200, depth: 700 } : {});
      for (let i = 0; i < 4; i++) add(`b${k}-${i}`, "handwash", 31000 + i * 600, y + 175);
    }
    const p = testProject(items);
    p.room = { ...p.room, points: rectRoom(40_000, 40_000), openings: [] };
    expect(p.items.length).toBe(kitchens * 50);
    return p;
  }

  /** The best of five runs of the whole plan check (ms), after one to warm up. */
  function timed(p: Project, what: string): number {
    checkProject(p);
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      checkProject(p);
      runs.push(performance.now() - t0);
    }
    const best = Math.min(...runs);
    console.info(`checkProject, ${p.items.length} items, ${what}: ${best.toFixed(1)} ms (runs ${runs.map((r) => r.toFixed(1)).join(", ")})`);
    return best;
  }

  // The plan check runs on every change; the target is well under 20 ms for 500 units on a desktop
  // (about 6 ms square, 9 ms turned, measured alone). A wall-clock limit that tight fails on busy or
  // slow CI machines, so the tests guard what a regression would break: the cost grows about
  // linearly (twice the units, at most three times the time; quadratic would be four), and stays
  // far from anything a user would notice.
  function expectScales(turn: (i: number) => number, what: string): void {
    const half = timed(hall(5, turn), what);
    const full = timed(hall(10, turn), what);
    expect(full).toBeLessThan(100);
    expect(full / Math.max(half, 1)).toBeLessThan(3);
  }

  it("checks 500 units quickly and in about linear time", () => {
    expectScales(() => 180, "square");
  });

  it("stays about linear where neighbours stand turned against each other", () => {
    // Every table or fridge turned by 45° or 105° from facing the line: the strips in front of all
    // of them, and of the cooking units across, meet slanted outlines.
    const turn = (i: number) => [180 + 45, 180 + 105][i % 2];
    expect(checkProject(hall(10, turn)).some((i) => i.key === "check.movement" || i.key === "check.aisle" || i.key.startsWith("check.function"))).toBe(true);
    expectScales(turn, "turned");
  });
});
