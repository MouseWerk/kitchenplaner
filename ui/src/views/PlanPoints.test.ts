import { describe, expect, it } from "vitest";
import { testItem, testProject } from "../model/testProject";
import { stressProject } from "../three/stress";
import { TRADE_GROUP } from "../model/trades";
import type { Shape } from "../render/drawing";
import { planPointLayer, planViewDrawing } from "./PlanView";

// The plan view with a trade filter (`Prefs.points`): the equipment quiet, the points on top.

const project = testProject([testItem("c", "combi-10", 2000, 2000, 0, { pos: 12 }), testItem("t", "table", 4000, 2000, 0, { pos: 13 })]);
const texts = (shapes: readonly Shape[]) => shapes.flatMap((s) => (s.t === "text" ? [s.text] : []));

describe("the plan view with connection points", () => {
  it("draws the equipment quietly only while points are shown", () => {
    const plain = planViewDrawing(project, { showNames: false, showDims: true, quiet: false });
    const quiet = planViewDrawing(project, { showNames: false, showDims: true, quiet: true });
    // The kind details (the combi's door, the table's lines) go; the outlines and numbers stay.
    expect(quiet.shapes.length).toBeLessThan(plain.shapes.length);
    expect(quiet.shapes.filter((s) => s.itemId === "c" && s.t === "poly" && s.closed).length).toBeGreaterThan(0);
    expect(texts(quiet.shapes)).toEqual(expect.arrayContaining(["12", "13"]));
  });

  it("shows the points of the filter's trades, labelled in the language", () => {
    const plan = planViewDrawing(project, { showNames: false, showDims: true, quiet: true });
    const trades = (filter: Parameters<typeof planPointLayer>[2]) => new Set(planPointLayer(project, plan, filter, "de").shapes.map((s) => s.trade));

    const all = planPointLayer(project, plan, "all", "de");
    expect(texts(all.shapes)).toEqual(expect.arrayContaining(["12.E", "12.KW", "12.AW"]));
    expect(all.shapes.every((s) => s.point?.itemId === "c" || s.point === undefined)).toBe(true);
    // Point shapes belong to no unit's block.
    expect(all.shapes.some((s) => s.itemId !== undefined)).toBe(false);

    expect([...trades("electric")]).toEqual(["electric"]);
    expect([...trades("sanitary")].every((tr) => tr && TRADE_GROUP[tr] === "sanitary")).toBe(true);
    expect(trades("gas").size).toBe(0);

    expect(texts(planPointLayer(project, plan, "sanitary", "en").shapes)).toEqual(expect.arrayContaining(["12.CW", "12.WD"]));
  });

  // The layer is laid out once per project, filter and language, at the screen's paper scale.
  it("lays out a large project quickly", () => {
    const big = stressProject(500);
    const p = { ...big, items: big.items.map((it, i) => (i % 2 ? it : { ...it, connections: { ...it.connections, electricKw: 10, voltage: 400, coldWater: true, hotWater: true, drain: true } })) };
    const plan = planViewDrawing(p, { showNames: false, showDims: true, quiet: true });
    const t0 = performance.now();
    const layer = planPointLayer(p, plan, "all", "de");
    const ms = performance.now() - t0;
    expect(layer.shapes.length).toBeGreaterThan(1000);
    expect(ms).toBeLessThan(400);
  });
});
