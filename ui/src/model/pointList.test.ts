import { describe, expect, it } from "vitest";
import { currentText, heightText, pointRows, pointsCsv, pointValuesText, sizeText, wallRefName } from "./pointList";
import { projectPoints, wallRefs } from "./points";
import { testItem, testProject } from "./testProject";

const BOM = "﻿";

/** A range on the north wall (electric), a sink with a planner's drain override, a hood. */
function sample() {
  const p = testProject([
    testItem("r", "range-6", 4000, 450, 0, { name: "Herd; 6 Platten" }),
    testItem("s", "sink-2", 1500, 350, 0, { name: "=Spüle", points: { drain: { x: 400, greasy: true, note: "Fettabscheider; links" } } }),
    testItem("h", "hood-wall", 6000, 550, 0, { name: "Haube" }),
  ]);
  p.room.partitions = [{ id: "p1", a: { x: 7000, y: 2000 }, b: { x: 7000, y: 6000 }, thickness: 100, height: 3000 }];
  return p;
}

describe("pointRows", () => {
  it("lists every point by position and trade, with its id, unit and wall faces", () => {
    const p = sample();
    const rows = pointRows(p, "all", "de");
    const points = projectPoints(p.items);
    expect(rows.map((r) => r.point)).toEqual(points);
    expect(rows.map((r) => r.no)).toEqual(points.map((q) => `${q.pos}.${{ electric: "E", gas: "G", coldWater: "KW", hotWater: "WW", softWater: "EW", drain: "AW", floorDrain: "BA", exhaust: "AB", supply: "ZU", steam: "D", refrigeration: "K" }[q.trade]}`));
    expect(rows.find((r) => r.no === "1.E")?.name).toBe("Herd; 6 Platten");
    for (const r of rows) expect(r.walls).toEqual(wallRefs(p.room, r.point.at));
    // English ids use the English codes.
    expect(pointRows(p, "all", "en").find((r) => r.point.trade === "coldWater")?.no).toBe("2.CW");
  });

  it("follows the filter", () => {
    const p = sample();
    expect(pointRows(p, "electric").every((r) => r.point.trade === "electric")).toBe(true);
    expect(pointRows(p, "sanitary").map((r) => r.point.trade)).toEqual(projectPoints(p.items, "sanitary").map((q) => q.trade));
    expect(pointRows(p, "gas")).toEqual([]);
  });

  it("names walls and partitions as the inspector counts them", () => {
    expect(wallRefName({ kind: "wall", index: 0, distance: 0, foot: { x: 0, y: 0 } }, "de")).toBe("Wand 1");
    expect(wallRefName({ kind: "partition", index: 1, id: "p", distance: 0, foot: { x: 0, y: 0 } }, "en")).toBe("Partition 2");
  });
});

describe("pointsCsv", () => {
  it("writes German CSV with BOM, semicolons, decimal comma, whole mm and the typical-values note", () => {
    const p = sample();
    const csv = pointsCsv(p, "de");
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Nr.;Pos.;Bezeichnung;Gewerk;X;Y;Wand A;Abstand A;Wand B;Abstand B;Höhe ü. FFB;kW;V;Phasen;A;Absicherung;Anschlussart;DN;m³/h;kg/h;fetthaltig;Bemerkung");
    const rows = pointRows(p, "all", "de");
    expect(lines.length).toBe(rows.length + 3);
    // The range's electric point: 22.4 kW at 400 V, 32.3 A, 35 A fuse.
    const e = rows.find((r) => r.no === "1.E")!;
    const [a, b] = e.walls;
    expect(lines[1 + rows.indexOf(e)]).toBe(
      [
        "1.E",
        "1",
        '"Herd; 6 Platten"',
        "Elektro",
        String(Math.round(e.point.at.x)),
        String(Math.round(e.point.at.y)),
        a ? wallRefName(a, "de") : "",
        a ? String(Math.round(a.distance)) : "",
        b ? wallRefName(b, "de") : "",
        b ? String(Math.round(b.distance)) : "",
        String(Math.round(e.point.z)),
        "22,4",
        "400",
        "3",
        "32,3",
        "35",
        "Festanschluss",
        "",
        "",
        "",
        "",
        "",
      ].join(";"),
    );
    // The planner's drain: greasy, a note with the separator inside quotes, the name defused.
    const drain = lines.find((l) => l.startsWith("2.AW;"))!;
    expect(drain.startsWith("2.AW;2;'=Spüle;Abwasser;")).toBe(true);
    expect(drain.endsWith(';x;"Fettabscheider; links"')).toBe(true);
    // The hood: an air volume and a duct size, no electric values.
    const hood = lines.find((l) => l.startsWith("3.AB;"))!.split(";");
    expect(hood[18]).toBe(String(p.items[2].connections.exhaustM3h));
    expect(Number(hood[17])).toBeGreaterThanOrEqual(100);
    expect(hood.slice(11, 17)).toEqual(["", "", "", "", "", ""]);
    expect(lines.at(-2)).toBe(";;Anschlusswerte sind Richtwerte, Herstellerangaben prüfen.;;;;;;;;;;;;;;;;;;;");
  });

  it("writes English CSV with commas and a decimal point, and follows the filter", () => {
    const csv = pointsCsv(sample(), "en", "electric");
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("No.,Pos.,Description,Trade,X,Y,Wall A,Distance A,Wall B,Distance B,Height above FFL,kW,V,Phases,A,Fuse,Connection type,DN,m³/h,kg/h,greasy,Note");
    expect(lines[1].startsWith('1.E,1,Herd; 6 Platten,Electric,')).toBe(true);
    expect(lines[1]).toContain(",22.4,400,3,32.3,35,Fixed connection,");
    expect(lines.slice(1, -2).every((l) => /^\d+\.E,/.test(l))).toBe(true);
    expect(lines.at(-2)).toContain("Connection values are typical values; check the manufacturer’s data.");
  });

  it("writes only the header and the note for a plan without points", () => {
    const lines = pointsCsv(testProject([testItem("t", "table", 2000, 350)]), "de").slice(1).split("\r\n");
    expect(lines.length).toBe(3);
    expect(lines[2]).toBe("");
  });
});

describe("point values as text", () => {
  it("writes a point's values in one line", () => {
    expect(pointValuesText({ trade: "electric", values: { kw: 15.9, voltage: 400, phases: 3, currentA: 22.9, fuseA: 25, plug: "fixed" } }, "de")).toBe("15,9 kW · 400 V 3N~ · 22,9 A · 25 A · Festanschluss");
    expect(pointValuesText({ trade: "electric", values: { kw: 2.5, voltage: 230, phases: 1, currentA: 10.9, fuseA: 13, plug: "schuko" } }, "en")).toBe("2.5 kW · 230 V 1N~ · 10.9 A · 13 A · Schuko");
    expect(pointValuesText({ trade: "drain", values: { dn: 50, greasy: true } }, "de")).toBe("DN 50 · fetthaltig");
    expect(pointValuesText({ trade: "coldWater", values: { dn: 15 } }, "de")).toBe("DN 15");
    expect(pointValuesText({ trade: "exhaust", values: { m3h: 1200, dn: 280 } }, "de")).toBe("1200 m³/h · Ø 280");
    expect(pointValuesText({ trade: "supply", values: { m3h: 1820, dn: 450 } }, "en")).toBe("1820 m³/h · Ø 450");
    expect(pointValuesText({ trade: "gas", values: { kw: 12.5, dn: 15 } }, "de")).toBe("12,5 kW · DN 15");
    expect(pointValuesText({ trade: "steam", values: { kgH: 25.5, dn: 20 } }, "de")).toBe("25,5 kg/h · DN 20");
    expect(pointValuesText({ trade: "refrigeration", values: { kw: 3.2 } }, "en")).toBe("3.2 kW");
  });

  it("leaves out only the electric load without kW, never a gas or refrigeration load", () => {
    const electric = { trade: "electric" as const, values: { kw: 15.9, voltage: 400, phases: 3 as const, currentA: 22.9, fuseA: 25, plug: "fixed" as const } };
    expect(pointValuesText(electric, "de", { withKw: false })).toBe("400 V 3N~ · 22,9 A · 25 A · Festanschluss");
    expect(pointValuesText({ trade: "gas", values: { kw: 43, dn: 25 } }, "de", { withKw: false })).toBe("43 kW · DN 25");
    expect(pointValuesText({ trade: "refrigeration", values: { kw: 1.2 } }, "de", { withKw: false })).toBe("1,2 kW");
  });

  it("does not group thousands", () => {
    expect(pointValuesText({ trade: "exhaust", values: { m3h: 12600, dn: 630 } }, "de")).toBe("12600 m³/h · Ø 630");
    expect(heightText(1200)).toBe("+1200");
  });

  it("writes a tiny load's current as „< 0,1 A“, not as no load", () => {
    expect(currentText(0, 0.01, "de")).toBe("< 0,1 A");
    expect(currentText(0, 0.01, "en")).toBe("< 0.1 A");
    expect(currentText(0, 0, "de")).toBe("0 A");
    expect(currentText(22.9, 15.9, "de")).toBe("22,9 A");
    expect(pointValuesText({ trade: "electric", values: { kw: 0.01, voltage: 230, phases: 1, currentA: 0, fuseA: 10, plug: "schuko" } }, "de")).toBe("0,01 kW · 230 V 1N~ · < 0,1 A · 10 A · Schuko");
  });

  it("sizes a duct by its diameter and a pipe by its DN", () => {
    expect(sizeText("exhaust", 280)).toBe("Ø 280");
    expect(sizeText("supply", 315)).toBe("Ø 315");
    expect(sizeText("gas", 20)).toBe("DN 20");
    expect(sizeText("drain", 50)).toBe("DN 50");
  });

  it("writes heights as plans do: signed whole mm, the floor as ±0", () => {
    expect(heightText(300)).toBe("+300");
    expect(heightText(0.3)).toBe("±0");
    expect(heightText(-20)).toBe("-20");
  });
});
