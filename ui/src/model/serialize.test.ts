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
    expect(text.startsWith('{\n  "format": "kitchenplaner",\n  "version": 2,\n  "info": {')).toBe(true);
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
    expect(p.items[0]).toEqual({ id: "f", catalogId: "future-robot", name: "future-robot", x: 100, y: 200, rotation: 0, width: 500, depth: 400, height: 900, elevation: 0, connections: {} });
    // Sizes missing in the file come from the catalog.
    expect(p.items[1]).toMatchObject({ catalogId: "table", width: 1200, depth: 700, height: 900 });
    expect(p.items[1].id).not.toBe("");
    expect(p.info.client).toBe("");
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

function v1(edit: (raw: any) => void = () => {}): string {
  const raw = JSON.parse(serializeProject(sample()));
  raw.version = 1;
  delete raw.room.partitions;
  edit(raw);
  return JSON.stringify(raw);
}

describe("format version 2", () => {
  it("writes version 2 with the partitions and the openings' partition after the wall", () => {
    const text = serializeProject(withPartitions());
    const raw = JSON.parse(text);
    expect(raw.version).toBe(2);
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

  it("reads a version 1 file as a room without partitions and writes it back as version 2", () => {
    const p = parseProject(v1());
    expect(p.version).toBe(2);
    expect(p.room.partitions).toEqual([]);
    expect(p.room.openings).toEqual(sample().room.openings);
    expect(p.items).toEqual(sample().items);
    expect(JSON.parse(serializeProject(p)).version).toBe(2);
    // Old, new, old shape again: the content survives the migration.
    expect(parseProject(serializeProject(p))).toEqual(p);
  });

  it("rejects a version 3 file as too new", () => {
    expect(errorOf(withRaw((r) => (r.version = 3))).key).toBe("error.tooNew");
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
