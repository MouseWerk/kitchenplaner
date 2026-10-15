import { describe, expect, it } from "vitest";
import { parseProject, ProjectError, serializeProject } from "./serialize";
import { FORMAT_VERSION } from "./project";
import { testItem, testProject } from "./testProject";

function sample() {
  const p = testProject([testItem("a", "range-6", 4000, 450), testItem("b", "sink-2", 1500, 350, 0, { note: "Becken „links“; mit Zapfhahn" })]);
  p.items[1].name = "Spültisch – Ä, ö, ü, ß";
  return p;
}

function errorOf(text: string): ProjectError {
  try {
    parseProject(text);
  } catch (e) {
    if (e instanceof ProjectError) return e;
    throw e;
  }
  throw new Error("parseProject accepted the input");
}

function withRaw(edit: (raw: any) => void): string {
  const raw = JSON.parse(serializeProject(sample()));
  edit(raw);
  return JSON.stringify(raw);
}

describe("serializeProject", () => {
  it("writes pretty JSON with a trailing newline in a fixed key order", () => {
    const text = serializeProject(sample());
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.startsWith('{\n  "format": "kitchenplaner",\n  "version": 3,\n  "info": {')).toBe(true);
    // Shuffled keys in memory give the same file.
    const p = sample();
    const shuffled = { ...p, items: p.items.map((it) => Object.fromEntries(Object.entries(it).reverse()) as typeof it) };
    expect(serializeProject(shuffled)).toBe(text);
  });

  it("round-trips a project unchanged", () => {
    const p = sample();
    const back = parseProject(serializeProject(p));
    expect(back).toEqual(p);
    expect(serializeProject(back)).toBe(serializeProject(p));
  });
});

describe("parseProject", () => {
  it("rejects text that is not a project", () => {
    expect(errorOf("not json").key).toBe("error.notProject");
    expect(errorOf("[1, 2]").key).toBe("error.notProject");
    expect(errorOf('{"format": "other"}').key).toBe("error.notProject");
  });

  it("rejects a file from a newer version", () => {
    expect(errorOf(withRaw((r) => (r.version = FORMAT_VERSION + 1))).key).toBe("error.tooNew");
  });

  it("rejects invalid numbers and structure", () => {
    const cases: ((r: any) => void)[] = [
      (r) => (r.items[0].width = null),
      (r) => (r.items[0].width = -5),
      (r) => (r.items[0].x = "12"),
      (r) => (r.room.height = 0),
      (r) => (r.room.points = r.room.points.slice(0, 2)),
      (r) => (r.room.openings[0].wall = 4),
      (r) => (r.room.openings[0].kind = "gate"),
      (r) => (r.items[0].connections.coldWater = "yes"),
      (r) => (r.items = {}),
      (r) => (r.version = 0.5),
    ];
    for (const edit of cases) expect(errorOf(withRaw(edit)).key).toBe("error.invalid");
    // NaN and Infinity are not JSON at all.
    expect(errorOf(serializeProject(sample()).replace('"x": 4000', '"x": NaN')).key).toBe("error.notProject");
    expect(() => parseProject(withRaw((r) => (r.items[0].width = 1e400)))).toThrow(ProjectError);
  });

  it("replaces duplicate ids with new unique ones", () => {
    const text = withRaw((r) => {
      r.items[1].id = "a";
      r.room.openings[0].id = "a";
    });
    const p = parseProject(text);
    const ids = [...p.room.openings.map((o) => o.id), ...p.items.map((i) => i.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(p.room.openings[0].id).toBe("a");
  });

  it("drops unknown fields, fills in defaults and keeps unknown catalog ids", () => {
    const text = JSON.stringify({
      format: "kitchenplaner",
      version: 1,
      extra: true,
      room: { points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }], future: 1 },
      items: [{ id: "f", catalogId: "future-robot", x: 100, y: 200, width: 500, depth: 400, height: 900, colour: "red" }, { catalogId: "table", x: 1000, y: 400 }],
    });
    const p = parseProject("﻿" + text);
    expect(p).not.toHaveProperty("extra");
    expect(p.room).toEqual({ points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }], height: 3000, wallThickness: 240, openings: [], partitions: [] });
    expect(p.items[0]).toEqual({ id: "f", pos: 1, catalogId: "future-robot", name: "future-robot", x: 100, y: 200, rotation: 0, width: 500, depth: 400, height: 900, elevation: 0, connections: {} });
    // Sizes missing in the file come from the catalog.
    expect(p.items[1]).toMatchObject({ catalogId: "table", width: 1200, depth: 700, height: 900 });
    expect(p.items[1].id).not.toBe("");
    expect(p.items[1].pos).toBe(2);
    expect(p.info.client).toBe("");
    expect(p.settings).toEqual({ simultaneity: 1 });
  });

  it("rejects sizes beyond 100 m", () => {
    const cases: ((r: any) => void)[] = [
      (r) => (r.items[0].width = 100_001),
      (r) => (r.items[0].depth = 1e9),
      (r) => (r.items[0].height = 2e5),
      (r) => (r.items[0].elevation = 1e6),
      (r) => (r.room.height = 1e7),
      (r) => (r.room.wallThickness = 1e6),
      (r) => (r.room.openings[0].width = 1e6),
      (r) => (r.room.openings[0].height = 1e6),
      (r) => (r.room.openings[0].sill = 1e6),
      (r) => (r.room.openings[0].offset = 1e6),
    ];
    for (const edit of cases) expect(errorOf(withRaw(edit)).key).toBe("error.invalid");
    // 100 m itself is still a size.
    expect(parseProject(withRaw((r) => (r.items[0].width = 100_000))).items[0].width).toBe(100_000);
  });

  it("rejects rooms without a floor area", () => {
    const cases: ((r: any) => void)[] = [
      // Three corners, two of them on one spot.
      (r) => (r.room.points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 0 }]),
      // All on one line.
      (r) => (r.room.points = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 4000, y: 0 }, { x: 3000, y: 0 }]),
      // A sliver: 4 m long, a twentieth of a millimetre wide.
      (r) => (r.room.points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 0.05 }, { x: 0, y: 0.05 }]),
    ];
    for (const edit of cases) {
      expect(
        errorOf(
          withRaw((r) => {
            edit(r);
            r.room.openings = [];
          }),
        ).key,
      ).toBe("error.invalid");
    }
  });

  // A crossing outline still has walls and a floor to edit; the plan check reports it instead.
  it("opens a self-crossing outline", () => {
    // Two lobes of different size, so the outline still encloses a floor area.
    const bowtie = [{ x: 0, y: 0 }, { x: 4000, y: 3000 }, { x: 4000, y: 0 }, { x: 0, y: 1000 }];
    const p = parseProject(
      withRaw((r) => {
        r.room.points = bowtie;
        r.room.openings = [];
      }),
    );
    expect(p.room.points).toEqual(bowtie);
  });

  it("drops corners that repeat the previous one and keeps the openings on their walls", () => {
    const p = parseProject(
      withRaw((r) => {
        // The rectangle with its second corner twice and the first one repeated at the end.
        r.room.points = [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 }, { x: 0, y: 0 }];
        // The door on the south wall, now wall 3; a window on the zero-length wall 1, which goes.
        r.room.openings = [
          { id: "door1", kind: "door", wall: 3, offset: 6800, width: 1010, height: 2135, sill: 0 },
          { id: "w0", kind: "window", wall: 1, offset: 0, width: 800, height: 1200, sill: 900 },
        ];
      }),
    );
    expect(p.room.points).toEqual([{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 }]);
    expect(p.room.openings).toEqual([{ id: "door1", kind: "door", wall: 2, offset: 6800, width: 1010, height: 2135, sill: 0 }]);
  });

  it("clamps openings into their wall", () => {
    const p = parseProject(
      withRaw((r) => {
        // Wall 1 is the 6 m east wall: an offset past its end and a width longer than the wall.
        r.room.openings = [
          { id: "a", kind: "window", wall: 1, offset: 9000, width: 1000, height: 1200, sill: 900 },
          { id: "b", kind: "passage", wall: 1, offset: 100, width: 7000, height: 2000, sill: 0 },
        ];
      }),
    );
    expect(p.room.openings.map((o) => [o.offset, o.width])).toEqual([
      [5500, 1000],
      [3000, 6000],
    ]);
  });

  it("rejects an item of an unknown kind without sizes", () => {
    const text = withRaw((r) => {
      r.items[0].catalogId = "future-robot";
      delete r.items[0].width;
    });
    expect(errorOf(text).key).toBe("error.invalid");
  });
});

/** The sample with a store behind a partition: a door and a hatch in it, a hatch in the east wall. */
function withPartitions() {
  const p = sample();
  p.room.partitions = [
    { id: "p1", a: { x: 5000, y: 0 }, b: { x: 5000, y: 6000 }, thickness: 100, height: 3000 },
    { id: "p2", a: { x: 5000, y: 3000 }, b: { x: 8000, y: 3000 }, thickness: 100, height: 1200 },
  ];
  p.room.openings = [
    { id: "d2", kind: "door", wall: 0, partition: "p1", offset: 1000, width: 900, height: 2100, sill: 0 },
    p.room.openings[0],
    { id: "h1", kind: "hatch", wall: 0, partition: "p1", offset: 4500, width: 1200, height: 800, sill: 900 },
    { id: "h2", kind: "hatch", wall: 1, offset: 1500, width: 1200, height: 800, sill: 900 },
  ];
  return p;
}

/** A project file as version 2 wrote it: no position numbers, products, settings or title data. */
function v2Raw(p = sample()): any {
  const raw = JSON.parse(serializeProject(p));
  raw.version = 2;
  delete raw.settings;
  delete raw.info.drawingNo;
  delete raw.info.revision;
  for (const it of raw.items) {
    delete it.pos;
    delete it.spec;
  }
  return raw;
}

function v1(edit: (raw: any) => void = () => {}): string {
  const raw = v2Raw();
  raw.version = 1;
  delete raw.room.partitions;
  edit(raw);
  return JSON.stringify(raw);
}

describe("format version 2", () => {
  it("writes the partitions and the openings' partition after the wall", () => {
    const text = serializeProject(withPartitions());
    const raw = JSON.parse(text);
    expect(raw.version).toBe(3);
    expect(raw.room.partitions[0]).toEqual({ id: "p1", a: { x: 5000, y: 0 }, b: { x: 5000, y: 6000 }, thickness: 100, height: 3000 });
    expect(Object.keys(raw.room.openings[0])).toEqual(["id", "kind", "wall", "partition", "offset", "width", "height", "sill"]);
    // Openings in outer walls carry no partition key at all.
    expect(Object.keys(raw.room.openings[1])).not.toContain("partition");
    expect(Object.keys(raw.room)).toEqual(["points", "height", "wallThickness", "openings", "partitions"]);
  });

  it("round-trips partitions, their openings and hatches unchanged, in their order", () => {
    const p = withPartitions();
    const back = parseProject(serializeProject(p));
    expect(back).toEqual(p);
    expect(serializeProject(back)).toBe(serializeProject(p));
  });

  it("reads a version 1 file as a room without partitions and writes it back as version 3", () => {
    const p = parseProject(v1());
    expect(p.version).toBe(3);
    expect(p.room.partitions).toEqual([]);
    expect(p.room.openings).toEqual(sample().room.openings);
    // The position numbers are the list order the file showed.
    expect(p.items).toEqual(sample().items);
    expect(p.items.map((i) => i.pos)).toEqual([1, 2]);
    expect(p.settings).toEqual({ simultaneity: 1 });
    expect(JSON.parse(serializeProject(p)).version).toBe(3);
    // Old, new, old shape again: the content survives the migration.
    expect(parseProject(serializeProject(p))).toEqual(p);
  });

  it("rejects a version 4 file as too new", () => {
    expect(errorOf(withRaw((r) => (r.version = 4))).key).toBe("error.tooNew");
  });

  it("rejects damaged partitions", () => {
    const withP = (edit: (q: any) => void) => {
      const raw = JSON.parse(serializeProject(withPartitions()));
      edit(raw.room.partitions[0]);
      return JSON.stringify(raw);
    };
    const cases: ((q: any) => void)[] = [
      (q) => (q.thickness = 19),
      (q) => (q.thickness = 1001),
      (q) => (q.thickness = "100"),
      (q) => delete q.thickness,
      (q) => (q.height = 0),
      (q) => (q.height = 1e6),
      (q) => delete q.height,
      (q) => (q.b = { ...q.a }),
      (q) => (q.b = { x: q.a.x + 0.5, y: q.a.y }),
      (q) => (q.b = { x: q.a.x + 100_001, y: q.a.y }),
      (q) => (q.a = { x: "1", y: 0 }),
      (q) => (q.a = null),
      (q) => delete q.b,
    ];
    for (const edit of cases) expect(errorOf(withP(edit)).key).toBe("error.invalid");
    expect(errorOf(withRaw((r) => (r.room.partitions = {}))).key).toBe("error.invalid");
    expect(errorOf(withRaw((r) => (r.room.partitions = [5]))).key).toBe("error.invalid");
    // The limits themselves are fine.
    expect(parseProject(withP((q) => (q.thickness = 20))).room.partitions[0].thickness).toBe(20);
    expect(parseProject(withP((q) => (q.thickness = 1000))).room.partitions[0].thickness).toBe(1000);
  });

  it("accepts hatches and rejects a partition reference that is not a string", () => {
    expect(parseProject(withRaw((r) => (r.room.openings[0].kind = "hatch"))).room.openings[0].kind).toBe("hatch");
    expect(errorOf(serializeProject(withPartitions()).replace('"partition": "p1"', '"partition": 1')).key).toBe("error.invalid");
  });

  it("drops openings in a partition that does not exist and keeps the others", () => {
    const raw = JSON.parse(serializeProject(withPartitions()));
    raw.room.openings[0].partition = "gone";
    const p = parseProject(JSON.stringify(raw));
    expect(p.room.openings.map((o) => o.id)).toEqual(["door1", "h1", "h2"]);
  });

  it("clamps openings into their partition, whatever their wall index says", () => {
    const raw = JSON.parse(serializeProject(withPartitions()));
    // p2 is 3000 long; wall 7 does not exist but is not used for an opening in a partition.
    raw.room.openings = [
      { id: "x", kind: "window", wall: 7, partition: "p2", offset: 9000, width: 1000, height: 1000, sill: 900 },
      { id: "y", kind: "passage", partition: "p2", offset: 100, width: 5000, height: 2000, sill: 0 },
    ];
    const p = parseProject(JSON.stringify(raw));
    expect(p.room.openings.map((o) => [o.offset, o.width])).toEqual([
      [2500, 1000],
      [1500, 3000],
    ]);
    expect(p.room.openings[1].wall).toBe(0);
  });

  it("gives duplicate partition ids new ones and keeps the openings in the first", () => {
    const raw = JSON.parse(serializeProject(withPartitions()));
    raw.room.partitions[1].id = "p1";
    raw.items[0].id = "p1";
    const p = parseProject(JSON.stringify(raw));
    const ids = [...p.room.partitions.map((q) => q.id), ...p.room.openings.map((o) => o.id), ...p.items.map((i) => i.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(p.room.partitions[0].id).toBe("p1");
    expect(p.room.partitions[1].id).not.toBe("p1");
    // The door at offset 1000 still sits in the 6 m partition p1, not clamped into the 3 m one.
    expect(p.room.openings.find((o) => o.id === "h1")).toMatchObject({ partition: "p1", offset: 4500 });
  });

  it("keeps openings in partitions when a repeated corner is removed", () => {
    const raw = JSON.parse(serializeProject(withPartitions()));
    raw.room.points = [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 }];
    // The door in the south wall is wall 3 in that outline, the hatch in the east wall wall 2.
    raw.room.openings[1].wall = 3;
    raw.room.openings[3].wall = 2;
    const p = parseProject(JSON.stringify(raw));
    expect(p.room.openings).toEqual(withPartitions().room.openings);
  });
});

describe("item energy", () => {
  it("writes the energy of an item after its connections and reads it back", () => {
    const p = testProject([testItem("g", "range-4", 2000, 450, 0, { energy: "gas", connections: { gasKw: 21, electricKw: 0.1, voltage: 230 } })]);
    const text = serializeProject(p);
    expect(text).toContain('"gasKw": 21\n      },\n      "energy": "gas"');
    expect(parseProject(text)).toEqual(p);
  });

  it("leaves it out for units without variants and rejects an unknown energy", () => {
    expect(serializeProject(testProject([testItem("t", "table", 2000, 450)]))).not.toContain("energy");
    const raw = JSON.parse(serializeProject(testProject([testItem("g", "range-4", 2000, 450, 0, { energy: "gas" })])));
    raw.items[0].energy = "steam";
    expect(errorOf(JSON.stringify(raw)).key).toBe("error.invalid");
  });
});

/** The sample with every field of version 3: products, door details, a sliding door, title data, a factor. */
function v3Sample() {
  const p = sample();
  p.items[0] = { ...p.items[0], pos: 7, spec: { manufacturer: "Muster GmbH", model: "HX 6", article: "123-456", price: 4890.5 } };
  p.items[1] = { ...p.items[1], pos: 3, spec: { price: 0 } };
  p.room.openings = [
    { ...p.room.openings[0], hinge: "end", swing: "out", leaves: 2 },
    { id: "s1", kind: "slidingDoor", wall: 0, offset: 2000, width: 1200, height: 2135, sill: 0 },
  ];
  p.info = { ...p.info, drawingNo: "K-101", revision: "B" };
  p.settings = { simultaneity: 0.65 };
  return p;
}

describe("format version 3", () => {
  it("writes position, product, door details, title data and settings in a fixed order", () => {
    const raw = JSON.parse(serializeProject(v3Sample()));
    expect(raw.version).toBe(3);
    expect(Object.keys(raw)).toEqual(["format", "version", "info", "settings", "room", "items"]);
    expect(raw.info).toMatchObject({ drawingNo: "K-101", revision: "B" });
    expect(raw.settings).toEqual({ simultaneity: 0.65 });
    expect(Object.keys(raw.items[0]).slice(0, 3)).toEqual(["id", "pos", "catalogId"]);
    expect(raw.items[0].spec).toEqual({ manufacturer: "Muster GmbH", model: "HX 6", article: "123-456", price: 4890.5 });
    expect(Object.keys(raw.room.openings[0])).toEqual(["id", "kind", "wall", "offset", "width", "height", "sill", "hinge", "swing", "leaves"]);
    expect(raw.room.openings[1].kind).toBe("slidingDoor");
  });

  it("leaves out what is not set", () => {
    const raw = JSON.parse(serializeProject(sample()));
    expect(raw.info).not.toHaveProperty("drawingNo");
    expect(raw.info).not.toHaveProperty("revision");
    expect(raw.items[0]).not.toHaveProperty("spec");
    expect(raw.room.openings[0]).not.toHaveProperty("hinge");
    // An empty product is no product.
    const p = sample();
    p.items[0] = { ...p.items[0], spec: {} };
    expect(JSON.parse(serializeProject(p)).items[0]).not.toHaveProperty("spec");
  });

  it("round-trips every new field unchanged", () => {
    const p = v3Sample();
    const back = parseProject(serializeProject(p));
    expect(back).toEqual(p);
    expect(serializeProject(back)).toBe(serializeProject(p));
  });

  it("reads a version 2 file: numbers from the list order, the plain sums", () => {
    const raw = v2Raw(withPartitions());
    // A version 2 file knows no `pos`; one there (a hand edit) does not count.
    raw.items[0].pos = 9;
    const p = parseProject(JSON.stringify(raw));
    expect(p.version).toBe(3);
    expect(p.items.map((i) => [i.id, i.pos])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    expect(p.settings).toEqual({ simultaneity: 1 });
    expect(p.room).toEqual(withPartitions().room);
    const again = JSON.parse(serializeProject(p));
    expect(again.version).toBe(3);
    expect(again.items.map((i: any) => i.pos)).toEqual([1, 2]);
  });

  it("repairs repeated, missing and broken position numbers the same way every time", () => {
    const raw = JSON.parse(serializeProject(testProject(["a", "b", "c", "d", "e", "f"].map((id, i) => testItem(id, "table", 1000 + i * 1300, 350)))));
    raw.items[0].pos = 4;
    raw.items[1].pos = 4;
    delete raw.items[2].pos;
    raw.items[3].pos = 0;
    raw.items[4].pos = 2.5;
    raw.items[5].pos = 2;
    const text = JSON.stringify(raw);
    const p = parseProject(text);
    // The first 4 and the 2 keep their numbers; the others follow the highest, in list order.
    expect(p.items.map((i) => i.pos)).toEqual([4, 5, 6, 7, 8, 2]);
    expect(parseProject(text).items.map((i) => i.pos)).toEqual([4, 5, 6, 7, 8, 2]);
  });

  it("rejects damaged products, door details and settings", () => {
    const cases: ((r: any) => void)[] = [
      (r) => (r.items[0].pos = "1"),
      (r) => (r.items[0].pos = null),
      (r) => (r.items[0].spec = "Muster"),
      (r) => (r.items[0].spec = { manufacturer: 5 }),
      (r) => (r.items[0].spec = { price: -1 }),
      (r) => (r.items[0].spec = { price: "12,50" }),
      (r) => (r.items[0].spec = { price: null }),
      (r) => (r.room.openings[0].hinge = "left"),
      (r) => (r.room.openings[0].swing = "up"),
      (r) => (r.room.openings[0].leaves = 3),
      (r) => (r.room.openings[0].leaves = "2"),
      (r) => (r.info.drawingNo = 101),
      (r) => (r.info.revision = null),
      (r) => (r.settings = []),
      (r) => (r.settings = { simultaneity: 0.05 }),
      (r) => (r.settings = { simultaneity: 1.2 }),
      (r) => (r.settings = { simultaneity: "0,7" }),
      (r) => (r.settings = { simultaneity: 0 }),
    ];
    for (const edit of cases) expect(errorOf(withRaw(edit)).key, edit.toString()).toBe("error.invalid");
    expect(() => parseProject(serializeProject(sample()).replace('"pos": 1,', '"pos": 1e400,'))).toThrow(ProjectError);
  });

  it("accepts the limits of the simultaneity factor and a missing one", () => {
    expect(parseProject(withRaw((r) => (r.settings = { simultaneity: 0.1 }))).settings.simultaneity).toBe(0.1);
    expect(parseProject(withRaw((r) => (r.settings = { simultaneity: 1 }))).settings.simultaneity).toBe(1);
    expect(parseProject(withRaw((r) => delete r.settings)).settings.simultaneity).toBe(1);
    expect(parseProject(withRaw((r) => (r.settings = {}))).settings.simultaneity).toBe(1);
  });

  it("accepts sliding doors and the door details", () => {
    const p = parseProject(withRaw((r) => Object.assign(r.room.openings[0], { kind: "slidingDoor", hinge: "start", swing: "in", leaves: 1 })));
    expect(p.room.openings[0]).toMatchObject({ kind: "slidingDoor", hinge: "start", swing: "in", leaves: 1 });
  });
});
