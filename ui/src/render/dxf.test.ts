import { describe, expect, it } from "vitest";
import { CONNECTION_LAYER, DXF_ATTRIBUTES, drawingToDxf, dxfArcAngles, dxfLayers, dxfText, LABEL_LAYER, POINT_ATTRIBUTES, TRADE_LAYER, triangulate } from "./dxf";
import { blockEntities, checkDxf, entities, inserts, pairs, readDxf, undxf, val, vals, type ReadInsert } from "./testDxf";
import { expandDim, type Drawing } from "./drawing";
import { sheetDrawing } from "./svg";
import { symbolOf, symbolParts, SYMBOLS } from "./symbols";
import { exampleKitchen } from "../examples/exampleKitchen";
import { elevationDrawing } from "../model/elevation";
import { footprint, lRoom } from "../model/geometry";
import { itemHeat } from "../model/heat";
import { heightText, installationDrawing, pointDims } from "../model/installationPlan";
import { planDrawing } from "../model/plan";
import { pointLabel, projectPoints, type ConnectionPoint } from "../model/points";
import { testItem, testProject } from "../model/testProject";
import { TRADES } from "../model/trades";
import type { Item, Project, Trade, Vec2 } from "../model/types";

const plain = (d: Drawing) => readDxf(drawingToDxf(d, 50));

/** A kitchen with two equal ranges (one turned), a gas range, a sink, a hood and a column. */
function kitchen(): Project {
  const items: Item[] = [
    testItem("r1", "range-6", 1000, 500, 0, { pos: 1, name: "Herd 6 Platten" }),
    testItem("r2", "range-6", 3000, 2500, 90, { pos: 2, name: "Herd 6 Platten" }),
    testItem("r3", "range-6", 5000, 500, 0, { pos: 3, name: "Gasherd", energy: "gas", connections: { gasKw: 30.5 } }),
    testItem("s1", "sink-2", 7000, 2000, 270, { pos: 4, name: "Spüle „groß“", spec: { manufacturer: "Muster AG", model: "S-2", article: "12-34" } }),
    testItem("h1", "hood-wall", 2000, 550, 0, { pos: 5 }),
    testItem("c1", "column-round", 4000, 3000, 0, { pos: 6 }),
  ];
  return testProject(items);
}

const planDxf = (p: Project) => drawingToDxf(planDrawing(p, { showNames: true, showDims: true, paperScale: 50 }), 50, { items: p.items, view: "plan" });

describe("drawingToDxf file structure", () => {
  it("writes a valid AutoCAD 2000 file in millimetres", () => {
    const dxf = planDxf(kitchen());
    expect(checkDxf(dxf)).toEqual([]);
    const doc = readDxf(dxf);
    expect(val(doc.header.get("$ACADVER")!, 1)).toBe("AC1015");
    expect(val(doc.header.get("$INSUNITS")!, 70)).toBe("4");
    expect(val(doc.header.get("$MEASUREMENT")!, 70)).toBe("1");
    expect(dxf.endsWith("0\r\nEOF\r\n")).toBe(true);
  });

  it("is valid for an empty drawing, a drawing without items and a whole sheet", () => {
    expect(checkDxf(drawingToDxf({ shapes: [] }, 50))).toEqual([]);
    const p = kitchen();
    expect(checkDxf(drawingToDxf(planDrawing(p, { showNames: true, showDims: true }), 50))).toEqual([]);
    const s = sheetDrawing((ps) => planDrawing(p, { showNames: true, showDims: true, paperScale: ps }), p.info, "Grundriss", "de");
    expect(checkDxf(drawingToDxf(s.drawing, s.paperScale, { items: p.items, view: "plan" }))).toEqual([]);
  });

  it("catches what a CAD program would reject", () => {
    // The checker itself: bare line feeds, a missing layer and a duplicate handle are found.
    const dxf = planDxf(kitchen());
    expect(() => pairs(dxf.replace(/\r\n/g, "\n"))).toThrow();
    const broken = dxf.replace(/\r\n8\r\nBEMASSUNG\r\n/, "\r\n8\r\nNIRGENDS\r\n");
    expect(checkDxf(broken)).toContainEqual(expect.stringContaining("missing layer NIRGENDS"));
    const h = val(readDxf(dxf).sections.get("ENTITIES")![0].tags, 5)!;
    const h2 = val(readDxf(dxf).sections.get("ENTITIES")![1].tags, 5)!;
    expect(checkDxf(dxf.replace(`\r\n5\r\n${h2}\r\n`, `\r\n5\r\n${h}\r\n`))).toContainEqual(`handle ${h} used twice`);
  });

  it("defines every layer by trade with its colour and line type", () => {
    const doc = readDxf(planDxf(kitchen()));
    const layers = doc.sections.get("TABLES")!.filter((o) => o.type === "LAYER");
    expect(layers.map((l) => val(l.tags, 2))).toEqual(["0", ...dxfLayers()]);
    expect(dxfLayers()).toEqual(
      expect.arrayContaining(["WAENDE", "OEFFNUNGEN", "AUSSTATTUNG", "AUSSTATTUNG_OBEN", "DETAILS", "BESCHRIFTUNG", "BEMASSUNG", "RAHMEN", ...Object.values(CONNECTION_LAYER)]),
    );
    const overhead = layers.find((l) => val(l.tags, 2) === "AUSSTATTUNG_OBEN")!;
    expect(val(overhead.tags, 6)).toBe("DASHED");
    expect(val(layers.find((l) => val(l.tags, 2) === CONNECTION_LAYER.electric)!.tags, 62)).toBe("1");
    const ltypes = doc.sections.get("TABLES")!.filter((o) => o.type === "LTYPE").map((o) => val(o.tags, 2));
    expect(ltypes).toEqual(["BYBLOCK", "BYLAYER", "CONTINUOUS", "DASHED", "HIDDEN"]);
  });
});

describe("drawingToDxf units as blocks", () => {
  it("inserts every unit once, one block per variant and size", () => {
    const p = kitchen();
    const doc = readDxf(planDxf(p));
    const ins = inserts(doc);
    expect(ins.map((i) => i.attribs.get("POS")).sort()).toEqual(p.items.map((it) => String(it.pos)).sort());
    const names = [...blockEntities(doc).keys()].filter((n) => !n.startsWith("*"));
    // The two electric ranges share a block though one is turned; the gas range has its own.
    const name = (it: Item) => `${it.catalogId}${it.energy ? `_${it.energy}` : ""}_${it.width}x${it.depth}`;
    expect(names.sort()).toEqual([...new Set(p.items.map(name))].sort());
    expect(names).toHaveLength(5);
    const byPos = new Map(ins.map((i) => [i.attribs.get("POS"), i]));
    expect(byPos.get("1")!.block).toBe(byPos.get("2")!.block);
    expect(byPos.get("3")!.block).toBe(name(p.items[2]));
    expect(new Set(ins.map((i) => i.block)).size).toBe(names.length);
  });

  it("places each reference at the unit's centre, turned with it", () => {
    const p = kitchen();
    const ins = new Map(inserts(readDxf(planDxf(p))).map((i) => [i.attribs.get("POS"), i]));
    for (const it of p.items) {
      const r = ins.get(String(it.pos))!;
      expect([r.x, r.y]).toEqual([it.x, -it.y]);
      // Clockwise on the plan is counter-clockwise in DXF.
      expect(r.rotation).toBe((360 - it.rotation) % 360);
    }
  });

  it("draws each unit where the plan does: block outline moved by its reference", () => {
    const p = kitchen();
    const doc = readDxf(planDxf(p));
    const blocks = blockEntities(doc);
    for (const r of inserts(doc)) {
      const it = p.items.find((x) => String(x.pos) === r.attribs.get("POS"))!;
      if (it.catalogId === "column-round") continue;
      const outline = blocks.get(r.block)!.find((o) => o.type === "LWPOLYLINE")!;
      const xs = vals(outline.tags, 10).map(Number);
      const ys = vals(outline.tags, 20).map(Number);
      const a = (r.rotation * Math.PI) / 180;
      const world = xs.map((x, i) => ({ x: r.x + x * Math.cos(a) - ys[i] * Math.sin(a), y: -(r.y + x * Math.sin(a) + ys[i] * Math.cos(a)) }));
      const fp = footprint(it);
      for (let i = 0; i < 4; i++) {
        expect(world[i].x).toBeCloseTo(fp[i].x, 3);
        expect(world[i].y).toBeCloseTo(fp[i].y, 3);
      }
    }
  });

  it("carries position, name, size and connection values as attributes on their trade layers", () => {
    const p = kitchen();
    const doc = readDxf(planDxf(p));
    const ins = new Map(inserts(doc).map((i) => [i.attribs.get("POS"), i]));
    const range = p.items[0];
    const r1 = ins.get("1")!.attribs;
    expect([...r1.keys()]).toEqual(DXF_ATTRIBUTES.map((a) => a.tag));
    expect(r1.get("BEZEICHNUNG")).toBe("Herd 6 Platten");
    expect(r1.get("KATALOG")).toBe("range-6");
    expect([r1.get("BREITE"), r1.get("TIEFE"), r1.get("HOEHE")]).toEqual([range.width, range.depth, range.height].map(String));
    expect(r1.get("ELEKTRO_KW")).toBe(String(range.connections.electricKw));
    expect(r1.get("SPANNUNG_V")).toBe(String(range.connections.voltage));
    const gas = ins.get("3")!.attribs;
    expect([gas.get("ENERGIE"), gas.get("GAS_KW"), gas.get("ELEKTRO_KW")]).toEqual(["Gas", "30.5", ""]);
    const sink = ins.get("4")!.attribs;
    // Umlauts and typographic quotes come back unchanged.
    expect(sink.get("BEZEICHNUNG")).toBe("Spüle „groß“");
    expect([sink.get("HERSTELLER"), sink.get("TYP"), sink.get("ARTIKELNR")]).toEqual(["Muster AG", "S-2", "12-34"]);
    expect(sink.get("KALTWASSER")).toBe(p.items[3].connections.coldWater ? "ja" : "nein");
    expect(ins.get("5")!.attribs.get("ABLUFT_M3H")).toBe(String(p.items[4].connections.exhaustM3h ?? ""));
    // Each attribute on its layer, invisible.
    const attribs = entities(doc, "ATTRIB");
    for (const a of DXF_ATTRIBUTES) {
      const of = attribs.filter((t) => val(t, 2) === a.tag);
      expect(of).toHaveLength(p.items.length);
      expect(of.every((t) => val(t, 8) === a.layer && val(t, 70) === "1")).toBe(true);
    }
    expect(DXF_ATTRIBUTES.find((a) => a.tag === "GAS_KW")!.layer).toBe(CONNECTION_LAYER.gas);
  });

  it("puts hanging units on their own layer and building parts with the walls", () => {
    const ins = new Map(inserts(readDxf(planDxf(kitchen()))).map((i) => [i.attribs.get("POS"), i]));
    expect(ins.get("1")!.layer).toBe("AUSSTATTUNG");
    expect(ins.get("5")!.layer).toBe("AUSSTATTUNG_OBEN");
    expect(ins.get("6")!.layer).toBe("WAENDE");
  });

  it("keeps position numbers, names and leaders out of the blocks, on the label layer", () => {
    const p = kitchen();
    const doc = readDxf(planDxf(p));
    const texts = entities(doc, "TEXT").filter((t) => val(t, 8) === LABEL_LAYER).map((t) => val(t, 1));
    for (const it of p.items) expect(texts).toContain(String(it.pos));
    expect(texts).toContain("Herd 6 Platten");
    for (const list of blockEntities(doc).values()) expect(list.some((o) => o.type === "TEXT")).toBe(false);
    // A crowded number gets a leader; it is a label too.
    const crowded = testProject([testItem("a", "prep-slicer", 1000, 1000, 0, { pos: 1 }), testItem("b", "prep-scale", 1000, 1000, 0, { pos: 2 }), testItem("c", "prep-mixer-10", 1000, 1000, 0, { pos: 3 })]);
    const d = planDrawing(crowded, { showNames: false, showDims: false });
    const leaders = d.shapes.filter((s) => s.label);
    const cdoc = readDxf(drawingToDxf(d, 50, { items: crowded.items, view: "plan" }));
    expect(entities(cdoc, "LWPOLYLINE").filter((t) => val(t, 8) === LABEL_LAYER).length + entities(cdoc, "LINE").filter((t) => val(t, 8) === LABEL_LAYER).length).toBe(leaders.length);
  });

  it("writes an elevation with its units as blocks too", () => {
    const p = kitchen();
    for (const facing of ["north", "east", "south", "west"] as const) {
      const d = elevationDrawing(p, facing, { showDims: true, paperScale: 50 });
      const dxf = drawingToDxf(d, 50, { items: p.items, view: "elevation" });
      expect(checkDxf(dxf)).toEqual([]);
      const shown = new Set(d.shapes.filter((s) => s.itemId && s.t !== "text").map((s) => s.itemId));
      const ins = inserts(readDxf(dxf));
      expect(ins).toHaveLength(shown.size);
      expect(ins.every((i) => i.rotation === 0 && i.block.includes("_ANSICHT_"))).toBe(true);
    }
  });
});

describe("drawingToDxf unit attributes", () => {
  it("keeps the attribute order of 0.2 and appends the new ones", () => {
    // Extraction templates read the attributes by position: never reorder, only append.
    expect(DXF_ATTRIBUTES.map((a) => a.tag)).toEqual([
      "POS",
      "BEZEICHNUNG",
      "KATALOG",
      "ENERGIE",
      "BREITE",
      "TIEFE",
      "HOEHE",
      "HERSTELLER",
      "TYP",
      "ARTIKELNR",
      "ELEKTRO_KW",
      "SPANNUNG_V",
      "GAS_KW",
      "KALTWASSER",
      "WARMWASSER",
      "ABLAUF",
      "BODENABLAUF",
      "ABLUFT_M3H",
      "ENTHAERTET",
      "ZULUFT_M3H",
      "DAMPF_KGH",
      "KAELTE_KW",
      "WAERME_S_KW",
      "WAERME_L_KW",
    ]);
  });

  it("writes softened water, supply air, steam, refrigeration and heat release", () => {
    const it0 = testItem("u", "range-6", 1000, 1000, 0, {
      pos: 1,
      connections: { electricKw: 12, voltage: 400, softWater: true, supplyM3h: 700, steamKgH: 25, refrigerationKw: 2.5 },
      heat: { sensibleKw: 3.2 },
    });
    const p = testProject([it0, testItem("v", "range-6", 3000, 1000, 0, { pos: 2 })]);
    const ins = new Map(inserts(readDxf(planDxf(p))).map((i) => [i.attribs.get("POS"), i.attribs]));
    const a = ins.get("1")!;
    expect([a.get("ENTHAERTET"), a.get("ZULUFT_M3H"), a.get("DAMPF_KGH"), a.get("KAELTE_KW")]).toEqual(["ja", "700", "25", "2.5"]);
    // The planner's sensible heat, the estimated latent heat.
    expect(a.get("WAERME_S_KW")).toBe("3.2");
    expect(a.get("WAERME_L_KW")).toBe(String(itemHeat(it0).latentKw));
    const b = ins.get("2")!;
    expect([b.get("ENTHAERTET"), b.get("ZULUFT_M3H"), b.get("DAMPF_KGH"), b.get("KAELTE_KW")]).toEqual(["nein", "", "", ""]);
    const attribs = entities(readDxf(planDxf(p)), "ATTRIB");
    const layerOf = (tag: string) => new Set(attribs.filter((t) => val(t, 2) === tag).map((t) => val(t, 8)));
    expect(layerOf("ENTHAERTET")).toEqual(new Set([CONNECTION_LAYER.water]));
    expect(layerOf("DAMPF_KGH")).toEqual(new Set([CONNECTION_LAYER.steam]));
    expect(layerOf("KAELTE_KW")).toEqual(new Set([CONNECTION_LAYER.refrigeration]));
  });
});

/** A unit with every trade switched on, a turned one with a few, and a sink. */
function allTrades(): Project {
  const every = { electricKw: 15.9, voltage: 400, gasKw: 30, coldWater: true, hotWater: true, softWater: true, drain: true, floorDrain: true, exhaustM3h: 1200, supplyM3h: 800, steamKgH: 20, refrigerationKw: 3 };
  return testProject([
    testItem("a", "range-6", 2000, 1500, 0, { pos: 1, connections: every, points: { drain: { greasy: true } } }),
    testItem("b", "range-6", 5000, 3000, 90, { pos: 2, connections: { electricKw: 15.9, voltage: 400, coldWater: true, drain: true } }),
    testItem("c", "sink-2", 6500, 1000, 0, { pos: 3 }),
  ]);
}

const installation = (p: Project, ps = 50) => drawingToDxf(installationDrawing(p, { filter: "all", paperScale: ps, dims: true, legend: true, lang: "de" }), ps, { items: p.items, view: "plan" });
const pointInserts = (doc: ReturnType<typeof readDxf>) => inserts(doc).filter((i) => i.block.startsWith("KP_"));
const pointOf = (points: ConnectionPoint[], i: ReadInsert) => points.find((p) => pointLabel(p, "de") === i.attribs.get("NR"))!;

describe("drawingToDxf connection points", () => {
  it("defines one block per symbol, built from its parts, shared by every point using it", () => {
    const p = allTrades();
    const doc = readDxf(installation(p));
    const points = projectPoints(p.items);
    const used = new Set(points.map((q) => symbolOf(q.trade, q.values.plug)));
    const blocks = blockEntities(doc);
    const kp = [...blocks.keys()].filter((n) => n.startsWith("KP_"));
    expect(kp.sort()).toEqual([...used].map((id) => `KP_${id}`).sort());
    for (const id of used) {
      const ents = blocks.get(`KP_${id}`)!;
      expect(ents).toHaveLength(symbolParts(id).length);
      // On layer 0, so each reference shows on its own trade layer.
      expect(ents.every((e) => val(e.tags, 8) === "0")).toBe(true);
    }
    const ins = pointInserts(doc);
    expect(ins).toHaveLength(points.length);
    // Several units with cold water and drain points share those blocks.
    for (const trade of ["coldWater", "drain"] as const) {
      const of = ins.filter((i) => pointOf(points, i).trade === trade);
      expect(of.length).toBeGreaterThan(1);
      expect(new Set(of.map((i) => i.block)).size).toBe(1);
    }
    expect(SYMBOLS.map((id) => `KP_${id}`)).toEqual(expect.arrayContaining(kp));
  });

  it("draws the symbol at the export's paper scale, y flipped", () => {
    for (const ps of [50, 100]) {
      const doc = readDxf(installation(testProject([testItem("a", "range-6", 2000, 1500, 0, { pos: 1, connections: { refrigerationKw: 3 } })]), ps));
      const [k1, k2] = blockEntities(doc).get("KP_K")!;
      const parts = symbolParts("K");
      for (const [e, part] of [
        [k1, parts[0]],
        [k2, parts[1]],
      ] as const) {
        if (part.t !== "circle") throw new Error("K is two circles");
        expect([Number(val(e.tags, 10)), Number(val(e.tags, 20)), Number(val(e.tags, 40))]).toEqual([part.c.x * ps, -part.c.y * ps || 0, part.r * ps]);
      }
    }
  });

  it("inserts each point upright at its place, y flipped, on its trade's layer", () => {
    const p = allTrades();
    const points = projectPoints(p.items);
    const ins = pointInserts(readDxf(installation(p)));
    for (const i of ins) {
      const q = pointOf(points, i);
      expect(i.x).toBeCloseTo(q.at.x, 3);
      expect(i.y).toBeCloseTo(-q.at.y, 3);
      expect(i.rotation).toBe(0);
      expect(i.layer).toBe(TRADE_LAYER[q.trade]);
    }
    // Every trade is there, each on its layer.
    expect(new Set(ins.map((i) => pointOf(points, i).trade))).toEqual(new Set(TRADES));
  });

  it("carries the attributes of each trade with the point's values", () => {
    const head = ["NR", "POS", "GEWERK", "HOEHE_FFB_MM"];
    const expected: Record<Trade, string[]> = {
      electric: [...head, "KW", "SPANNUNG_V", "PHASEN", "STROM_A", "SICHERUNG_A", "ANSCHLUSSART"],
      gas: [...head, "KW", "DN"],
      coldWater: [...head, "DN"],
      hotWater: [...head, "DN"],
      softWater: [...head, "DN"],
      drain: [...head, "DN", "FETTHALTIG"],
      floorDrain: [...head, "DN", "FETTHALTIG"],
      exhaust: [...head, "M3H", "DN"],
      supply: [...head, "M3H", "DN"],
      steam: [...head, "KGH", "DN"],
      refrigeration: [...head, "KW"],
    };
    for (const trade of TRADES) expect(POINT_ATTRIBUTES[trade].map((a) => a.tag)).toEqual(expected[trade]);

    const p = allTrades();
    const doc = readDxf(installation(p));
    const points = projectPoints(p.items);
    const byNr = new Map(pointInserts(doc).map((i) => [i.attribs.get("NR"), i]));
    for (const q of points) {
      const a = byNr.get(pointLabel(q, "de"))!.attribs;
      expect([...a.keys()]).toEqual(expected[q.trade]);
      expect(a.get("POS")).toBe(String(q.pos));
      expect(a.get("HOEHE_FFB_MM")).toBe(String(Math.round(q.z)));
    }
    const e = byNr.get("1.E")!.attribs;
    expect([e.get("GEWERK"), e.get("KW"), e.get("SPANNUNG_V"), e.get("PHASEN"), e.get("STROM_A"), e.get("SICHERUNG_A")]).toEqual(["Elektro", "15.9", "400", "3", "22.9", "25"]);
    expect(e.get("ANSCHLUSSART")).toBeTruthy();
    const g = byNr.get("1.G")!.attribs;
    expect([g.get("GEWERK"), g.get("KW"), g.get("DN")]).toEqual(["Gas", "30", "20"]);
    expect(byNr.get("1.AW")!.attribs.get("FETTHALTIG")).toBe("ja");
    expect(byNr.get("1.AB")!.attribs.get("M3H")).toBe("1200");
    expect(byNr.get("1.ZU")!.attribs.get("M3H")).toBe("800");
    expect(byNr.get("1.D")!.attribs.get("KGH")).toBe("20");
    expect(byNr.get("1.K")!.attribs.get("KW")).toBe("3");
    expect(byNr.get("1.EW")!.attribs.get("GEWERK")).toBe("Enthärtetes Wasser");
    // Each attribute invisible and on its point's layer, whatever its block.
    const ents = doc.sections.get("ENTITIES")!;
    for (let i = 0; i < ents.length; i++) {
      if (ents[i].type !== "INSERT" || !val(ents[i].tags, 2)!.startsWith("KP_")) continue;
      for (let j = i + 1; ents[j].type === "ATTRIB"; j++) {
        expect(val(ents[j].tags, 8)).toBe(val(ents[i].tags, 8));
        expect(val(ents[j].tags, 70)).toBe("1");
      }
    }
  });

  it("adds the steam and refrigeration layers with their own colours", () => {
    const layers = readDxf(installation(allTrades()))
      .sections.get("TABLES")!
      .filter((o) => o.type === "LAYER");
    const colour = (name: string) => val(layers.find((l) => val(l.tags, 2) === name)!.tags, 62);
    expect([colour("ANSCHLUSS_DAMPF"), colour("ANSCHLUSS_KAELTE")]).toEqual(["200", "150"]);
    // Every trade layer has a colour no other layer has.
    const trade = new Set(Object.values(TRADE_LAYER));
    const colours = layers.filter((l) => trade.has(val(l.tags, 2)!)).map((l) => val(l.tags, 62));
    expect(new Set(colours).size).toBe(trade.size);
    expect(layers.filter((l) => !trade.has(val(l.tags, 2)!) && colours.includes(val(l.tags, 62)))).toEqual([]);
  });

  it("puts labels, leaders and dimensions on the trade's layer", () => {
    const p = allTrades();
    const doc = readDxf(installation(p));
    const texts = entities(doc, "TEXT").map((t) => ({ text: undxf(val(t, 1)!), layer: val(t, 8) }));
    for (const q of projectPoints(p.items)) {
      expect(texts).toContainEqual({ text: pointLabel(q, "de"), layer: TRADE_LAYER[q.trade] });
      expect(texts).toContainEqual({ text: heightText(q.z), layer: TRADE_LAYER[q.trade] });
    }
    // Each point dimension is five lines and its text on the trade layer; the other lines there
    // are the leaders and the legend's symbols (the points' own symbols are in their blocks).
    const drawing = installationDrawing(p, { filter: "all", paperScale: 50, dims: true, legend: true, lang: "de" });
    const dims = pointDims(p, "all");
    expect(dims.length).toBeGreaterThan(0);
    const lines = entities(doc, "LINE").concat(entities(doc, "LWPOLYLINE"));
    for (const layer of new Set(Object.values(TRADE_LAYER))) {
      const own = dims.filter((d) => TRADE_LAYER[d.trade!] === layer);
      const loose = drawing.shapes.filter((s) => s.t === "poly" && s.trade && TRADE_LAYER[s.trade] === layer && (!s.point || s.label)).length;
      expect(lines.filter((t) => val(t, 8) === layer)).toHaveLength(own.length * 5 + loose);
      for (const d of own) expect(texts).toContainEqual({ text: expandDim(d, 50).text.text, layer });
    }
    const plainPlan = readDxf(drawingToDxf(planDrawing(p, { showNames: false, showDims: true, paperScale: 50, symbols: false, quiet: true }), 50, { items: p.items, view: "plan" }));
    expect(entities(doc, "LINE").filter((t) => val(t, 8) === "BEMASSUNG")).toHaveLength(entities(plainPlan, "LINE").filter((t) => val(t, 8) === "BEMASSUNG").length);
  });

  it("keeps point shapes out of the units' blocks", () => {
    // The units' blocks are the same with and without the points drawn (handles aside).
    const p = allTrades();
    const drawing = installationDrawing(p, { filter: "all", paperScale: 50, dims: true, legend: true, lang: "de" });
    const unitBlocks = (d: Drawing) => {
      const out = [...blockEntities(readDxf(drawingToDxf(d, 50, { items: p.items, view: "plan" })))].filter(([name]) => !name.startsWith("KP_"));
      return out.map(([name, list]) => [name, list.map((e) => [e.type, e.tags.filter(([c]) => c !== 5 && c !== 330)])]);
    };
    expect(unitBlocks(drawing)).toEqual(unitBlocks({ shapes: drawing.shapes.filter((s) => !s.trade) }));
    expect(unitBlocks(drawing).length).toBeGreaterThan(2);
  });

  it("writes the points as plain geometry on their layer when the items are not given", () => {
    const p = allTrades();
    const doc = readDxf(drawingToDxf(installationDrawing(p, { filter: "all", paperScale: 50, dims: false, legend: false, lang: "de" }), 50));
    expect(inserts(doc)).toEqual([]);
    expect(entities(doc, "CIRCLE").filter((t) => val(t, 8) === CONNECTION_LAYER.refrigeration)).toHaveLength(2);
  });

  it("writes a valid file for the example kitchen at 1:50 and 1:100, every filter", () => {
    const p = exampleKitchen("de");
    for (const ps of [50, 100]) {
      for (const filter of ["all", "electric", "sanitary", "gas", "ventilation", "special"] as const) {
        const dxf = drawingToDxf(installationDrawing(p, { filter, paperScale: ps, dims: true, legend: true, lang: "de" }), ps, { items: p.items, view: "plan" });
        expect(checkDxf(dxf)).toEqual([]);
        expect(pointInserts(readDxf(dxf))).toHaveLength(projectPoints(p.items, filter).length);
      }
    }
    expect(checkDxf(installation(allTrades()))).toEqual([]);
  });
});

describe("drawingToDxf geometry", () => {
  it("flips y so the plan's north is up", () => {
    const [line] = entities(plain({ shapes: [{ t: "poly", pen: "item", pts: [{ x: 10, y: 100 }, { x: 20, y: 250.5 }], closed: false }] }), "LINE");
    expect([val(line, 10), val(line, 20), val(line, 11), val(line, 21)]).toEqual(["10", "-100", "20", "-250.5"]);
    expect(val(line, 8)).toBe("AUSSTATTUNG");
    expect(val(line, 370)).toBe("35");
  });

  it("writes closed polygons as closed lightweight polylines", () => {
    const [pl] = entities(plain({ shapes: [{ t: "poly", pen: "overhead", pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true }] }), "LWPOLYLINE");
    expect([val(pl, 90), val(pl, 70), val(pl, 6)]).toEqual(["3", "1", "DASHED"]);
    expect(vals(pl, 20)).toEqual(["0", "0", "-10"]);
  });

  it("converts clockwise screen arcs to counter-clockwise DXF arcs", () => {
    // On screen from +x (east) clockwise to +y (down): the lower right quarter. With y up that
    // is the quarter from 270 to 360 degrees, counter-clockwise.
    expect(dxfArcAngles(0, 90)).toEqual({ start: 270, end: 0 });
    // A door swing from west (180) clockwise to up (270) is from 90 to 180 with y up.
    expect(dxfArcAngles(180, 270)).toEqual({ start: 90, end: 180 });
    const [arc] = entities(plain({ shapes: [{ t: "arc", pen: "swing", c: { x: 5, y: 5 }, r: 900, a0: 180, a1: 270 }] }), "ARC");
    expect([val(arc, 10), val(arc, 20), val(arc, 40), val(arc, 50), val(arc, 51), val(arc, 8)]).toEqual(["5", "-5", "900", "90", "180", "OEFFNUNGEN"]);
  });

  it("writes text with paper height, escaped umlauts, rotation and alignment", () => {
    const doc = plain({
      shapes: [
        { t: "text", pen: "item", p: { x: 100, y: 200 }, text: "Kühlraum ß", size: 2.5, anchor: "middle", angle: -90 },
        { t: "text", pen: "item", p: { x: 0, y: 0 }, text: "left", size: 1.8, anchor: "start" },
      ],
    });
    const [a, b] = entities(doc, "TEXT");
    expect(val(a, 1)).toBe("K\\U+00FChlraum \\U+00DF");
    // 2.5 mm text at 1:50 is a 125 mm em; DXF heights are cap heights (0.7 em).
    expect(val(a, 40)).toBe("87.5");
    expect(val(a, 50)).toBe("90");
    expect(val(a, 72)).toBe("1");
    expect([val(a, 11), val(a, 21)]).toEqual(["100", "-200"]);
    expect(val(b, 72)).toBeUndefined();
    expect(val(b, 40)).toBe("63");
  });

  it("expands dimensions into lines and text on BEMASSUNG", () => {
    const doc = plain({ shapes: [{ t: "dim", pen: "dim", a: { x: 0, y: 0 }, b: { x: 3000, y: 0 }, offset: 8, text: "3000" }] });
    expect(entities(doc, "LINE").filter((e) => val(e, 8) === "BEMASSUNG")).toHaveLength(5);
    expect(entities(doc, "TEXT").map((e) => [val(e, 1), val(e, 8)])).toEqual([["3000", "BEMASSUNG"]]);
  });

  it("fills the wall ring with SOLID triangles covering exactly its area", () => {
    const doc = readDxf(drawingToDxf(planDrawing(testProject(), { showNames: false, showDims: false }), 50));
    const triArea = (e: [number, string][]) => {
      const [ax, ay, bx, by, cx, cy] = [10, 20, 11, 21, 12, 22].map((c) => Number(val(e, c)));
      return Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
    };
    const solids = entities(doc, "SOLID");
    expect(solids.every((e) => val(e, 8) === "WAENDE")).toBe(true);
    expect(solids.reduce((s, e) => s + triArea(e), 0)).toBeCloseTo(8480 * 6480 - 8000 * 6000 - 1010 * 240, 0);
  });

  it("writes a partition's band as filled wall on layer WAENDE", () => {
    const p = testProject();
    p.room.openings = [];
    p.room.partitions = [{ id: "n", a: { x: 3000, y: 0 }, b: { x: 3000, y: 2000 }, thickness: 100, height: 3000 }];
    const doc = readDxf(drawingToDxf(planDrawing(p, { showNames: false, showDims: false }), 50));
    const corners = (e: [number, string][]) => [10, 20, 11, 21, 12, 22].map((c) => Number(val(e, c)));
    const triArea = (e: [number, string][]) => {
      const [ax, ay, bx, by, cx, cy] = corners(e);
      return Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
    };
    // The partition's triangles lie in its band, x 2950 to 3050, y 0 to -2000 (y flipped).
    const inBand = entities(doc, "SOLID").filter((e) => {
      const [ax, , bx, , cx] = corners(e);
      return [ax, bx, cx].every((x) => x >= 2950 - 1e-6 && x <= 3050 + 1e-6);
    });
    expect(inBand.reduce((s, e) => s + triArea(e), 0)).toBeCloseTo(100 * 2000, 0);
    expect(entities(doc, "LWPOLYLINE").filter((e) => val(e, 8) === "WAENDE")).toHaveLength(2);
  });
});

describe("triangulate", () => {
  const area = (ts: [Vec2, Vec2, Vec2][]) => ts.reduce((s, [a, b, c]) => s + Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2, 0);

  it("covers a concave polygon in either direction", () => {
    const l = lRoom(4000, 3000, 1000, 1000);
    expect(area(triangulate(l))).toBeCloseTo(4000 * 3000 - 1000 * 1000);
    expect(area(triangulate([...l].reverse()))).toBeCloseTo(4000 * 3000 - 1000 * 1000);
  });

  it("covers a closed wall ring with a zero-width seam", () => {
    const p = testProject();
    p.room.openings = [];
    const ring = planDrawing(p, { showNames: false, showDims: false }).shapes.find((s) => s.t === "poly" && s.fill === "wall");
    expect(area(triangulate((ring as { pts: Vec2[] }).pts))).toBeCloseTo(8480 * 6480 - 8000 * 6000);
  });
});

describe("dxfText", () => {
  it("escapes everything above ASCII and drops line breaks", () => {
    expect(dxfText("Maße ü")).toBe("Ma\\U+00DFe \\U+00FC");
    expect(dxfText("m³/h × 2")).toBe("m\\U+00B3/h \\U+00D7 2");
    expect(dxfText("a\nb")).toBe("a b");
    expect(dxfText("plain")).toBe("plain");
  });
});
