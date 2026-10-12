import { describe, expect, it } from "vitest";
import { csvField, csvText, equipmentCsv, equipmentRows, equipmentTotals } from "./equipment";
import { testItem, testProject } from "./testProject";

function sample() {
  return testProject([
    testItem("r", "range-6", 4000, 450, 0, { name: "Herd; 6 Platten" }),
    testItem("k", "kettle-150", 2000, 450, 0, { name: 'Kessel "groß"' }),
    testItem("h", "hood-wall", 3000, 550, 0, { name: "Haube", note: "Zeile 1\nZeile 2" }),
    testItem("t", "table", 6000, 350, 0, { name: "Tisch, Edelstahl", connections: { gasKw: 12.5 } }),
  ]);
}

const BOM = "﻿";

describe("equipmentRows", () => {
  it("lists every item with position and connections, and sums them", () => {
    const rows = equipmentRows(sample());
    expect(rows.map((r) => r.pos)).toEqual([1, 2, 3, 4]);
    expect(rows[1]).toMatchObject({ electricKw: 18, coldWater: true, hotWater: true, drain: false, floorDrain: true });
    expect(equipmentTotals(rows)).toEqual({ electricKw: 40.5, gasKw: 12.5, exhaustM3h: 2600, coldWater: 1, hotWater: 1, drain: 0, floorDrain: 1 });
  });
});

describe("equipmentCsv", () => {
  it("writes German CSV with BOM, semicolons, decimal comma and quoted fields", () => {
    const csv = equipmentCsv(sample(), "de");
    expect(csv.startsWith(BOM + "Pos.;Bezeichnung;B × T × H (mm);Elektro (kW);")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe('1;"Herd; 6 Platten";1200 × 900 × 900;22,4;400;;;;;');
    expect(lines[2]).toBe('2;"Kessel ""groß""";800 × 900 × 900;18;400;;KW, WW;Bodenablauf;;');
    // A line break inside a field stays inside its quotes.
    expect(csv).toContain(';2600;"Zeile 1\nZeile 2"\r\n');
    // The comma needs no quotes with a semicolon separator.
    expect(csv).toContain(";Tisch, Edelstahl;");
    expect(csv).toContain(";Summe;;40,5;;12,5;1 × KW, 1 × WW;1 × Bodenablauf;2600;\r\n");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("writes English CSV with commas and a decimal point", () => {
    const csv = equipmentCsv(sample(), "en");
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Pos.,Description,W × D × H (mm),Electric (kW),Voltage (V),Gas (kW),Water,Drain,Exhaust (m³/h),Note");
    expect(lines[1]).toBe("1,Herd; 6 Platten,1200 × 900 × 900,22.4,400,,,,,");
    expect(csv).toContain(',"Tisch, Edelstahl",');
    expect(csv).toContain(",Total,,40.5,,12.5,");
  });

  it("quotes only fields that need it", () => {
    expect(csvField("plain", ";")).toBe("plain");
    expect(csvField('a"b', ",")).toBe('"a""b"');
    expect(csvField("a\rb", ",")).toBe('"a\rb"');
    expect(csvField("Ä;Ö", ";")).toBe('"Ä;Ö"');
  });

  it("defuses names and notes a spreadsheet would run as a formula", () => {
    for (const start of ["=", "+", "-", "@", "\t", "\r"]) expect(csvText(`${start}1+1`)).toBe(`'${start}1+1`);
    expect(csvText("Herd")).toBe("Herd");
    expect(csvText("")).toBe("");
    // Only the first character matters.
    expect(csvText("A=B")).toBe("A=B");

    const p = testProject([
      testItem("x", "table", 1000, 350, 0, { name: '=HYPERLINK("http://example.invalid","x")', note: "@SUM(1)" }),
      testItem("y", "range-6", 3000, 450, 0, { name: "-Herd" }),
    ]);
    const lines = equipmentCsv(p, "en").slice(1).split("\r\n");
    // Defused first, then quoted as usual (the quotes and comma inside need it).
    expect(lines[1]).toBe(`1,"'=HYPERLINK(""http://example.invalid"",""x"")",1200 × 700 × 900,,,,,,,'@SUM(1)`);
    // Numbers stay numbers: no apostrophe in front of the values.
    expect(lines[2]).toBe("2,'-Herd,1200 × 900 × 900,22.4,400,,,,,");
  });
});
