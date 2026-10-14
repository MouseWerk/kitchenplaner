import { describe, expect, it } from "vitest";
import { drawingToSvg, sheetDrawing, sheetSvg } from "./svg";
import type { Drawing } from "./drawing";
import { planDrawing } from "../model/plan";
import { elevationDrawing } from "../model/elevation";
import { rectRoom } from "../model/geometry";
import { testItem, testProject } from "../model/testProject";
import { exampleKitchen } from "../examples/exampleKitchen";

const box: Drawing = { shapes: [{ t: "poly", pen: "item", fill: "item", pts: rectRoom(1000, 500), closed: true }] };

describe("drawingToSvg", () => {
  it("sizes the document in paper millimetres at the given scale", () => {
    const svg = drawingToSvg(box, { paperScale: 50, margin: 0 });
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="20mm" height="10mm" viewBox="0 0 1000 500"');
    // Line widths scale with the paper: 0.35 mm at 1:50 is 17.5 drawing units.
    expect(svg).toContain('stroke-width="17.5"');
    const withMargin = drawingToSvg(box, { paperScale: 50 });
    expect(withMargin).toContain('width="40mm" height="30mm" viewBox="-500 -500 2000 1500"');
  });

  it("escapes text and uses a common font", () => {
    const d: Drawing = { shapes: [{ t: "text", pen: "item", p: { x: 0, y: 0 }, text: 'A<&>"B', size: 2.5, anchor: "middle" }] };
    const svg = drawingToSvg(d, { paperScale: 50 });
    expect(svg).toContain(">A&lt;&amp;&gt;&quot;B</text>");
    expect(svg).toContain('font-family="Arial, Helvetica, sans-serif"');
    expect(svg).toContain('font-size="125"');
  });

  it("draws arcs clockwise from a0 to a1, circled text and dimensions", () => {
    const d: Drawing = {
      shapes: [
        { t: "arc", pen: "swing", c: { x: 0, y: 0 }, r: 100, a0: 0, a1: 90 },
        { t: "text", pen: "item", p: { x: 0, y: 0 }, text: "7", size: 2.5, anchor: "middle", circled: true },
        { t: "dim", pen: "dim", a: { x: 0, y: 0 }, b: { x: 3000, y: 0 }, offset: 8, text: "3000" },
      ],
    };
    const svg = drawingToSvg(d, { paperScale: 50 });
    expect(svg).toContain('d="M100 0A100 100 0 0 1 0 100"');
    expect(svg).toMatch(/<circle cx="0" cy="-45" r="118.75"/);
    expect((svg.match(/<line /g) ?? []).length).toBe(5);
    expect(svg).toContain(">3000</text>");
  });
});

describe("sheetDrawing", () => {
  it("puts an 8 × 6 m plan on A3 at 1:50 with a title block", () => {
    const p = testProject([testItem("a", "table", 1600, 350)]);
    const plan = planDrawing(p, { showNames: true, showDims: true });
    const sheet = sheetDrawing(plan, p.info, "Grundriss", "de");
    expect(sheet.paperScale).toBe(50);
    expect(sheet.bounds.maxX - sheet.bounds.minX).toBeCloseTo(420 * 50);
    const svg = sheetSvg(plan, p.info, "Grundriss", "de");
    expect(svg).toContain('width="420mm" height="297mm"');
    for (const s of ["1:50", "Maße in mm", "Testküche", "Gasthaus Krone", "12.10.2026", "Grundriss", "Maßstab"]) expect(svg).toContain(`>${s}</text>`);
    // The frame is drawn with the frame pen (0.5 mm at 1:50).
    expect(sheet.drawing.shapes.filter((s) => s.pen === "frame" && s.t === "poly").length).toBeGreaterThanOrEqual(2);
  });

  it("chooses a coarser scale for a bigger room and labels in English", () => {
    const p = testProject();
    p.room.points = rectRoom(40000, 20000);
    const sheet = sheetDrawing(planDrawing(p, { showNames: false, showDims: true }), p.info, "Plan", "en");
    expect(sheet.paperScale).toBe(200);
    expect(sheet.drawing.shapes.some((s) => s.t === "text" && s.text === "Dimensions in mm")).toBe(true);
    expect(sheet.drawing.shapes.some((s) => s.t === "text" && s.text === "2026-10-12")).toBe(true);
  });

  it("lays a drawing given per scale out again for the scale the sheet prints it at", () => {
    const p = exampleKitchen("de");
    const asked: number[] = [];
    const sheet = sheetDrawing(
      (paperScale) => {
        asked.push(paperScale);
        return planDrawing(p, { showNames: false, showDims: true, paperScale });
      },
      p.info,
      "Grundriss",
      "de",
    );
    // 13.2 × 9.6 m with dimensions does not fit A3 at 1:50: printed at 1:75, laid out for 1:75.
    expect(sheet.paperScale).toBe(75);
    expect(asked).toEqual([20, 25, 50, 75]);
    const own = planDrawing(p, { showNames: false, showDims: true, paperScale: 75 }).shapes;
    expect(sheet.drawing.shapes.slice(0, own.length)).toEqual(own);
  });

  it("places an elevation at a detailed scale", () => {
    const p = testProject([testItem("a", "table", 1600, 350)]);
    const sheet = sheetDrawing(elevationDrawing(p, "north", { showDims: true }), p.info, "Ansicht Nord", "de");
    expect(sheet.paperScale).toBe(25);
  });
});
