import { describe, expect, it } from "vitest";
import { drawingToDxf, dxfArcAngles, dxfLayers, dxfText, triangulate } from "./dxf";
import type { Drawing } from "./drawing";
import { planDrawing } from "../model/plan";
import { testItem, testProject } from "../model/testProject";
import { lRoom } from "../model/geometry";
import type { Vec2 } from "../model/types";

/** The group code / value pairs of a DXF file. */
function pairs(dxf: string): [number, string][] {
  const lines = dxf.split("\r\n");
  const out: [number, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push([Number(lines[i]), lines[i + 1]]);
  return out;
}

/** The pairs of every entity of a type, from its "0 TYPE" up to the next "0". */
function entities(dxf: string, type: string): [number, string][][] {
  const ps = pairs(dxf);
  const out: [number, string][][] = [];
  for (let i = 0; i < ps.length; i++) {
    if (ps[i][0] !== 0 || ps[i][1] !== type) continue;
    const e: [number, string][] = [];
    for (let j = i + 1; j < ps.length && ps[j][0] !== 0; j++) e.push(ps[j]);
    out.push(e);
  }
  return out;
}

const val = (e: [number, string][], code: number) => e.find(([c]) => c === code)?.[1];

describe("drawingToDxf", () => {
  it("writes an R12 file with header, layers, line types and EOF", () => {
    const dxf = drawingToDxf(planDrawing(testProject([testItem("a", "hood-wall", 2000, 550)]), { showNames: true, showDims: true }), 50);
    const ps = pairs(dxf);
    expect(ps.at(-1)).toEqual([0, "EOF"]);
    expect(dxf.endsWith("EOF\r\n")).toBe(true);
    expect(dxf).not.toMatch(/[^\r]\n/);
    expect(ps).toContainEqual([1, "AC1009"]);
    const insunits = ps.findIndex(([c, v]) => c === 9 && v === "$INSUNITS");
    expect(ps[insunits + 1]).toEqual([70, "4"]);
    const layers = entities(dxf, "LAYER").map((e) => val(e, 2));
    expect(layers).toEqual(dxfLayers());
    expect(layers).toEqual(expect.arrayContaining(["WAENDE", "OEFFNUNGEN", "AUSSTATTUNG", "AUSSTATTUNG_OBEN", "DETAILS", "BEMASSUNG", "RAHMEN"]));
    expect(entities(dxf, "LTYPE").map((e) => val(e, 2))).toEqual(["CONTINUOUS", "DASHED", "HIDDEN"]);
    // The hood outline is dashed on the overhead layer.
    const hood = entities(dxf, "POLYLINE").find((e) => val(e, 8) === "AUSSTATTUNG_OBEN");
    expect(val(hood!, 6)).toBe("DASHED");
    // The wall ring is filled with SOLID triangles covering exactly its area.
    const solids = entities(dxf, "SOLID");
    const triArea = (e: [number, string][]) => {
      const [ax, ay, bx, by, cx, cy] = [10, 20, 11, 21, 12, 22].map((c) => Number(val(e, c)));
      return Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
    };
    expect(solids.reduce((s, e) => s + triArea(e), 0)).toBeCloseTo(8480 * 6480 - 8000 * 6000 - 1010 * 240, 0);
  });

  it("flips y so the plan's north is up", () => {
    const d: Drawing = { shapes: [{ t: "poly", pen: "item", pts: [{ x: 10, y: 100 }, { x: 20, y: 250.5 }], closed: false }] };
    const [line] = entities(drawingToDxf(d, 50), "LINE");
    expect([val(line, 10), val(line, 20), val(line, 11), val(line, 21)]).toEqual(["10", "-100", "20", "-250.5"]);
    expect(val(line, 8)).toBe("AUSSTATTUNG");
  });

  it("writes closed polygons as closed polylines", () => {
    const d: Drawing = { shapes: [{ t: "poly", pen: "wall", pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true }] };
    const dxf = drawingToDxf(d, 50);
    const [pl] = entities(dxf, "POLYLINE");
    expect(val(pl, 70)).toBe("1");
    expect(entities(dxf, "VERTEX")).toHaveLength(3);
    expect(entities(dxf, "SEQEND")).toHaveLength(1);
  });

  it("converts clockwise screen arcs to counter-clockwise DXF arcs", () => {
    // On screen from +x (east) clockwise to +y (down): the lower right quarter. With y up that
    // is the quarter from 270 to 360 degrees, counter-clockwise.
    expect(dxfArcAngles(0, 90)).toEqual({ start: 270, end: 0 });
    // A door swing from west (180) clockwise to up (270) is from 90 to 180 with y up.
    expect(dxfArcAngles(180, 270)).toEqual({ start: 90, end: 180 });
    const d: Drawing = { shapes: [{ t: "arc", pen: "swing", c: { x: 5, y: 5 }, r: 900, a0: 180, a1: 270 }] };
    const [arc] = entities(drawingToDxf(d, 50), "ARC");
    expect([val(arc, 10), val(arc, 20), val(arc, 40), val(arc, 50), val(arc, 51)]).toEqual(["5", "-5", "900", "90", "180"]);
  });

  it("writes text with paper height, escaped umlauts, rotation and alignment", () => {
    const d: Drawing = {
      shapes: [
        { t: "text", pen: "item", p: { x: 100, y: 200 }, text: "Kühlraum ß", size: 2.5, anchor: "middle", angle: -90 },
        { t: "text", pen: "item", p: { x: 0, y: 0 }, text: "left", size: 1.8, anchor: "start" },
      ],
    };
    const [a, b] = entities(drawingToDxf(d, 50), "TEXT");
    expect(val(a, 1)).toBe("K\\U+00FChlraum \\U+00DF");
    // 2.5 mm text at 1:50 is a 125 mm em; DXF heights are cap heights (0.7 em).
    expect(val(a, 40)).toBe("87.5");
    expect(val(a, 50)).toBe("90");
    expect(val(a, 72)).toBe("1");
    expect([val(a, 11), val(a, 21)]).toEqual(["100", "-200"]);
    expect(val(b, 72)).toBeUndefined();
    expect(val(b, 40)).toBe("63");
  });

  it("expands dimensions into lines and text", () => {
    const d: Drawing = { shapes: [{ t: "dim", pen: "dim", a: { x: 0, y: 0 }, b: { x: 3000, y: 0 }, offset: 8, text: "3000" }] };
    const dxf = drawingToDxf(d, 50);
    expect(entities(dxf, "LINE").filter((e) => val(e, 8) === "BEMASSUNG")).toHaveLength(5);
    expect(entities(dxf, "TEXT").map((e) => val(e, 1))).toEqual(["3000"]);
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

describe("drawingToDxf partitions", () => {
  it("writes a partition's band as filled wall on layer WAENDE", () => {
    const p = testProject();
    p.room.openings = [];
    p.room.partitions = [{ id: "n", a: { x: 3000, y: 0 }, b: { x: 3000, y: 2000 }, thickness: 100, height: 3000 }];
    const dxf = drawingToDxf(planDrawing(p, { showNames: false, showDims: false }), 50);
    const solids = entities(dxf, "SOLID");
    expect(solids.every((e) => val(e, 8) === "WAENDE")).toBe(true);
    const corners = (e: [number, string][]) => [10, 20, 11, 21, 12, 22].map((c) => Number(val(e, c)));
    // The partition's triangles lie in its band, x 2950 to 3050, y 0 to -2000 (y flipped).
    const inBand = solids.filter((e) => {
      const [ax, , bx, , cx] = corners(e);
      return [ax, bx, cx].every((x) => x >= 2950 - 1e-6 && x <= 3050 + 1e-6);
    });
    const triArea = (e: [number, string][]) => {
      const [ax, ay, bx, by, cx, cy] = corners(e);
      return Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
    };
    expect(inBand.reduce((s, e) => s + triArea(e), 0)).toBeCloseTo(100 * 2000, 0);
    // Its outline as a closed polyline on the same layer.
    expect(entities(dxf, "POLYLINE").filter((e) => val(e, 8) === "WAENDE")).toHaveLength(2);
  });
});
