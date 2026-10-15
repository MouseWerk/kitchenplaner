import { afterEach, describe, expect, it } from "vitest";
import { csvField, csvText, electricStatus, equipmentCsv, equipmentRows, equipmentTotals, formatPrice, withSimultaneity } from "./equipment";
import { setLang } from "../lib/i18n";
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
    expect(equipmentTotals(rows)).toEqual({ electricKw: 40.5, gasKw: 12.5, exhaustM3h: 2600, coldWater: 1, hotWater: 1, drain: 0, floorDrain: 1, price: 0 });
  });
});

describe("equipmentCsv", () => {
  it("writes German CSV with BOM, semicolons, decimal comma and quoted fields", () => {
    const csv = equipmentCsv(sample(), "de");
    expect(csv.startsWith(BOM + "Pos.;Bezeichnung;Hersteller;Typ;Artikel-Nr.;B × T × H (mm);Elektro (kW);")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0].endsWith(";Bemerkung;Preis netto (€)")).toBe(true);
    expect(lines[1]).toBe('1;"Herd; 6 Platten";;;;1200 × 900 × 900;22,4;400;;;;;;');
    // The 150 l kettle is 1000 wide: its 800 mm vessel does not fit an 800 module.
    expect(lines[2]).toBe('2;"Kessel ""groß""";;;;1000 × 900 × 900;18;400;;KW, WW;Bodenablauf;;;');
    // A line break inside a field stays inside its quotes.
    expect(csv).toContain(';2600;"Zeile 1\nZeile 2";\r\n');
    // The comma needs no quotes with a semicolon separator.
    expect(csv).toContain(";Tisch, Edelstahl;");
    expect(csv).toContain("\r\n;Summe;;;;;40,5;;12,5;1 × KW, 1 × WW;1 × Bodenablauf;2600;;\r\n");
    // Simultaneity 1 (the default): the same loads again, saying so.
    expect(csv).toContain("\r\n;Mit Gleichzeitigkeit 1;;;;;40,5;;12,5;;;;;\r\n");
    expect(csv).toContain("\r\n;Anschlusswerte sind Richtwerte, Herstellerangaben prüfen.;;;;;;;;;;;;\r\n");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("writes English CSV with commas and a decimal point", () => {
    const csv = equipmentCsv(sample(), "en");
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Pos.,Description,Manufacturer,Model,Article no.,W × D × H (mm),Electric (kW),Voltage (V),Gas (kW),Water,Drain,Exhaust (m³/h),Note,Net price (€)");
    expect(lines[1]).toBe("1,Herd; 6 Platten,,,,1200 × 900 × 900,22.4,400,,,,,,");
    expect(csv).toContain(',"Tisch, Edelstahl",');
    expect(csv).toContain(",Total,,,,,40.5,,12.5,");
    expect(csv).toContain(",Connection values are typical values; check the manufacturer's data.,");
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
    expect(lines[1]).toBe(`1,"'=HYPERLINK(""http://example.invalid"",""x"")",,,,1200 × 700 × 900,,,,,,,'@SUM(1),`);
    // Numbers stay numbers: no apostrophe in front of the values.
    expect(lines[2]).toBe("2,'-Herd,,,,1200 × 900 × 900,22.4,400,,,,,,");
    // The product is typed by the user too.
    const q = testProject([testItem("x", "table", 1000, 350, 0, { spec: { manufacturer: "=1+1", model: "+A", article: "-7" } })]);
    expect(equipmentCsv(q, "en").slice(1).split("\r\n")[1].startsWith("1,table,'=1+1,'+A,'-7,")).toBe(true);
  });
});

/** Items whose list order differs from their numbers, with products and prices. */
function specified() {
  return testProject([
    testItem("a", "range-6", 4000, 450, 0, { pos: 12, name: "Herd", spec: { manufacturer: "Muster GmbH", model: "HX 6", article: "A-1", price: 4890.5 } }),
    testItem("b", "table", 1000, 350, 0, { pos: 3, name: "Tisch", spec: { price: 1200 } }),
    testItem("c", "kettle-150", 2000, 450, 0, { pos: 7, name: "Kessel" }),
  ]);
}

afterEach(() => setLang("de"));

describe("equipment list with stable position numbers and products", () => {
  it("sorts the rows by position number, not by list order", () => {
    expect(equipmentRows(specified()).map((r) => [r.pos, r.name])).toEqual([
      [3, "Tisch"],
      [7, "Kessel"],
      [12, "Herd"],
    ]);
  });

  it("carries manufacturer, model, article number and price, and sums the prices", () => {
    const rows = equipmentRows(specified());
    expect(rows[2]).toMatchObject({ manufacturer: "Muster GmbH", model: "HX 6", article: "A-1", price: 4890.5 });
    expect(rows[1]).toMatchObject({ manufacturer: "", model: "", article: "" });
    expect(rows[1].price).toBeUndefined();
    expect(equipmentTotals(rows).price).toBe(6090.5);
  });

  it("writes the product columns, prices with two decimals and the price total", () => {
    const lines = equipmentCsv(specified(), "de").slice(1).split("\r\n");
    expect(lines[1]).toBe("3;Tisch;;;;1200 × 700 × 900;;;;;;;;1200,00");
    expect(lines[2].startsWith("7;Kessel;;;;")).toBe(true);
    expect(lines[2].endsWith(";;")).toBe(true);
    expect(lines[3]).toBe("12;Herd;Muster GmbH;HX 6;A-1;1200 × 900 × 900;22,4;400;;;;;;4890,50");
    expect(lines[4]).toBe(";Summe;;;;;40,4;;0;1 × KW, 1 × WW;1 × Bodenablauf;0;;6090,50");
    expect(equipmentCsv(specified(), "en")).toContain(",4890.50\r\n");
  });

  it("writes the loads with the project's simultaneity factor", () => {
    const p = { ...specified(), settings: { simultaneity: 0.6 } };
    const de = equipmentCsv(p, "de").slice(1).split("\r\n");
    expect(de[5]).toBe(";Mit Gleichzeitigkeit 0,6;;;;;24,24;;0;;;;;");
    const en = equipmentCsv(p, "en").slice(1).split("\r\n");
    expect(en[5]).toBe(",With simultaneity 0.6,,,,,24.24,,0,,,,,");
  });

  it("multiplies loads by the factor without float noise", () => {
    expect(withSimultaneity(40.4, 0.6)).toBe(24.24);
    expect(withSimultaneity(283.1, 1)).toBe(283.1);
    expect(withSimultaneity(0.1 + 0.2, 0.7)).toBe(0.21);
    expect(formatPrice(1234.5, "de")).toBe("1234,50");
    expect(formatPrice(0.005, "en")).toBe("0.01");
  });

  it("shows the factored load in the status bar and says so", () => {
    setLang("de");
    expect(electricStatus(specified())).toBe("40,4 kW");
    expect(electricStatus({ ...specified(), settings: { simultaneity: 0.6 } })).toBe("24,2 kW bei Gleichzeitigkeit 0,60");
    setLang("en");
    expect(electricStatus({ ...specified(), settings: { simultaneity: 0.75 } })).toBe("30.3 kW at simultaneity 0.75");
  });
});
