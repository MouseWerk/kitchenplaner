import { describe, expect, it } from "vitest";
import { heightText, installationDrawing, legendText, pointDims, pointsDrawing, pointSymbol, usedSymbols, type InstallationOptions } from "./installationPlan";
import { planDrawing, TEXT_ASCENT, TEXT_DESCENT } from "./plan";
import { pointLabel, projectPoints, type ConnectionPoint } from "./points";
import { distToSegment, roomFaces, type Box } from "./geometry";
import { TRADE_GROUP, TRADE_GROUPS, type PointFilter } from "./trades";
import { testItem, testProject } from "./testProject";
import type { Item, Project } from "./types";
import { exampleKitchen } from "../examples/exampleKitchen";
import { kindDef, kindOf } from "../kinds/registry";
import { drawingBounds, mm, TEXT, type DimShape, type Shape, type TextShape } from "../render/drawing";
import { textWidth } from "../render/pdf";
import { t } from "../lib/i18n";
import { CIRCLE_CENTER_RISE, CIRCLE_RADIUS } from "../render/svg";
import { SYMBOL_SIZE } from "../render/symbols";

const opts = (over: Partial<InstallationOptions> = {}): InstallationOptions => ({ filter: "all", paperScale: 50, dims: true, legend: true, lang: "de", ...over });
const key = (p: { itemId: string; trade: string }) => `${p.itemId}/${p.trade}`;
const pointShapes = (s: Shape[]) => s.filter((x) => x.point);
const symbolParts = (s: Shape[]) => pointShapes(s).filter((x) => x.t !== "text" && x.t !== "dim" && !x.label);
const legend = (s: Shape[]) => s.filter((x) => x.pen === "connection" && !x.point);
const texts = (s: Shape[]) => s.filter((x): x is TextShape => x.t === "text");

/** The boxes of the point labels (both lines together), as the drawing sets them (plan mm). */
function labelBoxes(shapes: Shape[], ps: number): { point: { itemId: string; trade: string }; box: Box }[] {
  const byPoint = new Map<string, TextShape[]>();
  for (const s of texts(shapes)) {
    if (!s.point) continue;
    const list = byPoint.get(key(s.point)) ?? [];
    list.push(s);
    byPoint.set(key(s.point), list);
  }
  return [...byPoint.values()].map((lines) => {
    const h = TEXT.small * ps;
    const w = Math.max(...lines.map((l) => textWidth(l.text, l.size) * ps));
    const ys = lines.map((l) => l.p.y);
    return { point: lines[0].point!, box: { minX: lines[0].p.x - w / 2, maxX: lines[0].p.x + w / 2, minY: Math.min(...ys) - TEXT_ASCENT * h, maxY: Math.max(...ys) + TEXT_DESCENT * h } };
  });
}

const overlap = (a: Box, b: Box) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

/**
 * A test kitchen with units against the north wall (1000 × 600, back on the wall face) and one
 * free, of every trade group, whose points are all set by hand.
 */
function setOut(): { project: Project; points: ConnectionPoint[] } {
  const size = { width: 1000, depth: 600 };
  const items: Item[] = [
    testItem("g", "table", 2000, 300, 0, { ...size, connections: { gasKw: 20 }, points: { gas: { x: 150, y: 50, z: 300 } } }),
    testItem("w", "table", 5000, 300, 0, { ...size, connections: { coldWater: true, drain: true }, points: { coldWater: { x: 100, y: 0, z: 550 }, drain: { x: 300, y: 100, z: 0 } } }),
    testItem("e", "table", 4000, 4000, 90, { ...size, connections: { electricKw: 11, voltage: 400, exhaustM3h: 800, steamKgH: 20 }, points: { electric: { x: 200, y: 400, z: 1200 } } }),
  ];
  const project = testProject(items);
  return { project, points: projectPoints(project.items) };
}

describe("installation plan points", () => {
  it("draws every point of the example kitchen: a symbol, its id and its height", () => {
    const p = exampleKitchen("de");
    const pts = projectPoints(p.items);
    expect(pts.length).toBeGreaterThan(20);
    const shapes = installationDrawing(p, opts()).shapes;
    expect(new Set(symbolParts(shapes).map((s) => key(s.point!)))).toEqual(new Set(pts.map(key)));
    for (const pt of pts) {
      const lines = texts(shapes).filter((s) => s.point && key(s.point) === key(pt));
      expect(lines.map((l) => l.text)).toEqual([pointLabel(pt, "de"), heightText(pt.z)]);
      // The height under the id.
      expect(lines[1].p.y).toBeGreaterThan(lines[0].p.y);
    }
  });

  it("tags point shapes with their trade and point and never with an item", () => {
    const shapes = installationDrawing(exampleKitchen("de"), opts()).shapes;
    const ps = shapes.filter((s) => s.pen === "connection");
    expect(ps.length).toBeGreaterThan(0);
    for (const s of ps) {
      expect(s.itemId).toBeUndefined();
      if (s.point) expect(s.trade).toBe(s.point.trade);
    }
  });

  it("shows only the points of the filter's group", () => {
    const { project } = setOut();
    const p = { ...project, items: [...project.items, ...exampleKitchen("de").items.map((it) => ({ ...it, id: `x${it.id}`, pos: it.pos + 100 }))] };
    for (const g of TRADE_GROUPS) {
      const shapes = installationDrawing(p, opts({ filter: g })).shapes;
      const drawn = pointShapes(shapes);
      expect(drawn.length, g).toBeGreaterThan(0);
      for (const s of drawn) expect(TRADE_GROUP[s.trade!], g).toBe(g);
      expect(new Set(drawn.map((s) => key(s.point!)))).toEqual(new Set(projectPoints(p.items, g).map(key)));
    }
  });

  it("writes the id with the language's code and the height above the floor", () => {
    const { project } = setOut();
    const en = texts(pointsDrawing(project, "sanitary", 50, { lang: "en" }).shapes).map((s) => s.text);
    expect(en).toEqual(["2.CW", "+550", "2.WD", "±0"]);
    expect(heightText(300)).toBe("+300");
    expect(heightText(0.3)).toBe("±0");
    expect(heightText(-20)).toBe("-20");
  });

  it("draws symbols upright, whatever way the unit is turned", () => {
    const at = (rotation: number) => {
      const it = testItem("c", "table", 4000, 3000, rotation, { connections: { coldWater: true } });
      const p = testProject([it]);
      const pt = projectPoints(p.items)[0];
      return symbolParts(pointsDrawing(p, "all", 50).shapes).map((s) => JSON.stringify(s, (k, v) => (k === "x" ? Math.round((v - pt.at.x) * 1e6) : k === "y" ? Math.round((v - pt.at.y) * 1e6) : k === "c" ? { x: v.x, y: v.y } : v)));
    };
    expect(at(90)).toEqual(at(0));
    expect(at(225)).toEqual(at(0));
  });

  it("moves a crowded label away with a leader back to its symbol", () => {
    const items = [0, 1, 2, 3].map((i) => testItem(`t${i}`, "table", 4000, 3000, 0, { connections: { coldWater: true }, points: { coldWater: { x: 100, y: 0 } } }));
    const shapes = pointsDrawing(testProject(items), "all", 50).shapes;
    const leaders = shapes.filter((s) => s.t === "poly" && s.point && s.label);
    expect(leaders.length).toBeGreaterThanOrEqual(1);
    const boxes = labelBoxes(shapes, 50);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i].box, boxes[j].box)).toBe(false);
  });

  for (const ps of [50, 100]) {
    it(`keeps the labels of the example kitchen apart at 1:${ps}, off the symbols and the position numbers`, () => {
      const p = exampleKitchen("de");
      const shapes = installationDrawing(p, opts({ paperScale: ps })).shapes;
      const boxes = labelBoxes(shapes, ps);
      expect(boxes.length).toBe(projectPoints(p.items).length);
      const half = (SYMBOL_SIZE / 2) * ps;
      const symbols = projectPoints(p.items).map((pt) => ({ point: pt, box: { minX: pt.at.x - half, maxX: pt.at.x + half, minY: pt.at.y - half, maxY: pt.at.y + half } }));
      const numbers = texts(shapes)
        .filter((s) => s.circled)
        .map((s) => {
          const r = CIRCLE_RADIUS * s.size * ps;
          const cy = s.p.y - CIRCLE_CENTER_RISE * s.size * ps;
          return { minX: s.p.x - r, maxX: s.p.x + r, minY: cy - r, maxY: cy + r };
        });
      const clashes: string[] = [];
      boxes.forEach((a, i) => {
        boxes.forEach((b, j) => {
          if (j > i && overlap(a.box, b.box)) clashes.push(`${key(a.point)} ${key(b.point)}`);
        });
        for (const s of symbols) if (overlap(a.box, s.box)) clashes.push(`${key(a.point)} on symbol ${key(s.point)}`);
        for (const n of numbers) if (overlap(a.box, n)) clashes.push(`${key(a.point)} on a number`);
      });
      expect(clashes).toEqual([]);
    });
  }

  it("is the same every time", () => {
    const a = JSON.stringify(installationDrawing(exampleKitchen("de"), opts({ paperScale: 100 })));
    const b = JSON.stringify(installationDrawing(exampleKitchen("de"), opts({ paperScale: 100 })));
    expect(a).toBe(b);
  });
});

describe("installation plan dimensions", () => {
  it("measures each point from the nearest wall face and one across it", () => {
    const { project, points } = setOut();
    const ds = pointDims(project, "all");
    const gas = points.find((p) => p.trade === "gas")!;
    // The gas point of the table at (2000, 1000): 150 from its left, 50 from its back.
    const of = (p: ConnectionPoint) => ds.filter((d) => d.point && key(d.point) === key(p));
    expect(of(gas).map((d) => ({ a: d.a, b: d.b, text: d.text }))).toEqual([
      { a: { x: gas.at.x, y: 0 }, b: gas.at, text: mm(gas.at.y) },
      { a: { x: 0, y: gas.at.y }, b: gas.at, text: mm(gas.at.x) },
    ]);
    // A point on the north wall face is set out by the wall it sits on: one dimension, across.
    const cold = points.find((p) => p.trade === "coldWater")!;
    expect(cold.at.y).toBeCloseTo(0);
    expect(of(cold)).toHaveLength(1);
    expect(of(cold)[0].a.y).toBeCloseTo(cold.at.y);
    for (const d of ds) {
      expect(d.pen).toBe("connection");
      expect(d.itemId).toBeUndefined();
      expect(d.offset).toBe(0);
    }
  });

  it("runs every dimension of the example kitchen from a wall face to its point", () => {
    const p = exampleKitchen("de");
    const pts = new Map(projectPoints(p.items).map((pt) => [key(pt), pt]));
    const faces = roomFaces(p.room);
    const ds = installationDrawing(p, opts()).shapes.filter((s): s is DimShape => s.t === "dim" && !!s.point);
    expect(ds.length).toBeGreaterThan(pts.size);
    for (const d of ds) {
      const pt = pts.get(key(d.point!))!;
      expect(d.b).toEqual(pt.at);
      expect(Math.min(...faces.map((f) => distToSegment(d.a, f.a, f.b)))).toBeLessThan(1e-6);
      expect(d.text).toBe(mm(Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y)));
    }
  });

  it("leaves the dimensions out when they are off", () => {
    const shapes = installationDrawing(exampleKitchen("de"), opts({ dims: false })).shapes;
    expect(shapes.some((s) => s.t === "dim")).toBe(false);
  });
});

describe("installation plan legend", () => {
  const rows = (shapes: Shape[]) => texts(legend(shapes)).filter((s) => s.trade).map((s) => s.text);

  for (const filter of ["all", "electric", "sanitary", "gas", "ventilation"] as PointFilter[]) {
    it(`lists exactly the symbols used (${filter}), with the note on heights`, () => {
      const { project } = setOut();
      const p = { ...project, items: [...project.items, ...exampleKitchen("de").items.map((it) => ({ ...it, id: `x${it.id}`, pos: it.pos + 100 }))] };
      const pts = projectPoints(p.items, filter);
      const shapes = installationDrawing(p, opts({ filter })).shapes;
      const used = usedSymbols(pts);
      expect(rows(shapes)).toEqual(used.map((id) => legendText(id, pts, "de")));
      expect(new Set(legend(shapes).filter((s) => s.t !== "text").map((s) => s.trade))).toEqual(new Set(pts.map((x) => x.trade)));
      expect(new Set(pts.map(pointSymbol))).toEqual(new Set(used));
      const notes = texts(legend(shapes)).filter((s) => !s.trade).map((s) => s.text);
      expect(notes).toEqual([t("legend.title", undefined, "de"), t("legend.heights", undefined, "de")]);
    });
  }

  it("names an electric symbol's connection types and lies beside the plan, inside the drawing", () => {
    const p = exampleKitchen("en");
    const pts = projectPoints(p.items);
    const shapes = installationDrawing(p, opts({ lang: "en" })).shapes;
    expect(rows(shapes).some((r) => r.startsWith("E Electric, "))).toBe(true);
    const plan = drawingBounds(planDrawing(p, { showNames: false, showDims: true, paperScale: 50, symbols: false, quiet: true }), 50);
    const all = drawingBounds({ shapes }, 50);
    // drawingBounds guesses text extents both ways of the anchor; the legend's texts start at it.
    const box = drawingBounds({ shapes: legend(shapes).filter((s) => s.t !== "text") }, 50);
    expect(Math.min(box.minX, ...texts(legend(shapes)).map((s) => s.p.x))).toBeGreaterThan(plan.maxX);
    expect(box.minX).toBeGreaterThanOrEqual(all.minX);
    expect(box.maxX).toBeLessThanOrEqual(all.maxX);
    expect(box.minY).toBeGreaterThanOrEqual(all.minY);
    expect(box.maxY).toBeLessThanOrEqual(all.maxY);
    expect(texts(legend(shapes)).map((s) => s.text)).toContain("Heights in mm above finished floor level (FFL)");
    expect(pts.length).toBeGreaterThan(0);
  });

  it("is left out when it is off", () => {
    expect(legend(installationDrawing(exampleKitchen("de"), opts({ legend: false })).shapes)).toEqual([]);
  });
});

describe("plan drawn quietly", () => {
  const p = exampleKitchen("de");
  const ids = new Set(p.items.map((it) => it.id));
  const itemShapes = (s: Shape[]) => s.filter((x) => x.itemId && ids.has(x.itemId) && x.t !== "text" && !x.label);

  it("has no fill and no kind details, and keeps the position numbers", () => {
    const shapes = planDrawing(p, { showNames: false, showDims: false, symbols: false, quiet: true }).shapes;
    for (const it of p.items) {
      const own = itemShapes(shapes).filter((s) => s.itemId === it.id);
      expect(own, it.catalogId).toHaveLength(1);
      if (kindDef(kindOf(it.catalogId)).structural) continue;
      expect(own[0].t === "poly" && (own[0].fill ?? "none"), it.catalogId).toBe("none");
      expect(["detail", "overhead"]).toContain(own[0].pen);
    }
    expect(texts(shapes).filter((s) => s.circled)).toHaveLength(p.items.length);
  });

  it("draws kind details and fills by default, and only drops the details without symbols", () => {
    const full = planDrawing(p, { showNames: false, showDims: false });
    const bare = planDrawing(p, { showNames: false, showDims: false, symbols: false });
    expect(itemShapes(full.shapes).length).toBeGreaterThan(p.items.length);
    expect(itemShapes(bare.shapes)).toHaveLength(p.items.length);
    expect(itemShapes(bare.shapes).some((s) => s.t === "poly" && s.fill === "item")).toBe(true);
  });
});
