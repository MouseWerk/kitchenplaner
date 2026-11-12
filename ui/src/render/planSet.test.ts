import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { t } from "../lib/i18n";
import { equipmentRows, equipmentTotals, formatNumber, withSimultaneity } from "../model/equipment";
import { heightText, pointRows, pointValuesText, wallRefName } from "../model/pointList";
import { projectPoints } from "../model/points";
import { parseProject } from "../model/serialize";
import { TRADE_GROUPS, tradeGroupName } from "../model/trades";
import { FACINGS, type Project } from "../model/types";
import type { Drawing } from "./drawing";
import { PdfDocument, PT_PER_MM } from "./pdf";
import {
  checkPlanSet,
  DEFAULT_PLAN_SET,
  drawDrawing,
  electricSum,
  installationGroups,
  PAPER_SIZES,
  planSetPdf,
  sanitizePlanSetOptions,
  scaleDrawing,
  sheetFrame,
  SheetTooSmall,
  wallSheetWalls,
  type PlanSetOptions,
} from "./planSet";
import { pathPoints, readPdf, type ReadPage } from "./testPdf";

const DATE = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));
const ctx = { lang: "de" as const, cut: "wall" as const };
const example = (): Project => parseProject(readFileSync(resolve(__dirname, "../../../examples/Beispielkueche-Restaurant.kplan"), "utf8"));
/** The options without installation plans unless a test asks for them: the sheets as before 0.3. */
const opts = (patch: Partial<PlanSetOptions> = {}): PlanSetOptions => ({ ...DEFAULT_PLAN_SET, elevations: [...FACINGS], installation: [], ...patch });
/** Only the installation plans of `installation` and their tables. */
const installationOnly = (patch: Partial<PlanSetOptions> = {}): PlanSetOptions => opts({ plan: false, elevations: [], wallSheets: "none", list: false, installation: [...TRADE_GROUPS], ...patch });

/** A rectangular room `w` × `d` mm with nothing in it, as a drawing. */
const box = (w: number, d: number): Drawing => ({
  shapes: [
    {
      t: "poly",
      pen: "wall",
      closed: true,
      pts: [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: d },
        { x: 0, y: d },
      ],
    },
  ],
});

/** A minimal opaque RGBA PNG (2 × 1 px), as a canvas would give it. */
function tinyPng(): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: number[]) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const u32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const chunk = (type: string, data: number[]) => {
    const td = [...type].map((c) => c.charCodeAt(0)).concat(data);
    return [...u32(data.length), ...td, ...u32(crc(td))];
  };
  const idat = [...deflateSync(new Uint8Array([0, 200, 60, 40, 255, 20, 90, 200, 255]))];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk("IHDR", [...u32(2), ...u32(1), 8, 6, 0, 0, 0]), ...chunk("IDAT", idat), ...chunk("IEND", [])]);
}

describe("sheet layout", () => {
  it("has the ISO paper sizes in both orientations, the title block inside the frame", () => {
    expect(sheetFrame("A3", "landscape")).toMatchObject({ width: 420, height: 297 });
    expect(sheetFrame("A3", "portrait")).toMatchObject({ width: 297, height: 420 });
    expect(sheetFrame("A0", "landscape")).toMatchObject({ width: 1189, height: 841 });
    for (const paper of PAPER_SIZES) {
      for (const o of ["landscape", "portrait"] as const) {
        const f = sheetFrame(paper, o);
        expect(f.title.minX).toBeGreaterThanOrEqual(f.frame.minX);
        expect(f.title.maxY).toBe(f.frame.maxY);
        expect(f.area.maxY).toBeLessThan(f.title.minY);
        expect(f.area.maxX - f.area.minX).toBeGreaterThan(100);
        expect(f.area.maxY - f.area.minY).toBeGreaterThan(100);
      }
    }
  });

  it("picks the most detailed scale that fits, and says when a fixed one does not", () => {
    const area = sheetFrame("A3", "landscape").area;
    // 10 × 6 m in an area of 374 × 216 mm: too large at 1:20 and 1:25 (400 × 240 mm), fits at 1:50.
    expect(scaleDrawing(() => box(10_000, 6000), area, "auto")).toMatchObject({ scale: 50, fits: true });
    expect(scaleDrawing(() => box(10_000, 6000), area, 20)).toMatchObject({ scale: 20, fits: false });
    expect(scaleDrawing(() => box(10_000, 6000), area, 100)).toMatchObject({ scale: 100, fits: true });
    // Even 1:200 is too fine for 200 m: auto reports it instead of clipping.
    expect(scaleDrawing(() => box(200_000, 1000), area, "auto")).toMatchObject({ scale: 200, fits: false });
  });

  it("draws at true scale: 5 m at 1:50 are 100 mm on the page, centred in the area", async () => {
    const doc = new PdfDocument();
    const f = sheetFrame("A3", "landscape");
    drawDrawing(doc.addPage(f.width, f.height), box(5000, 2000), 50, f.area);
    const page = readPdf(await doc.toBytes({ compress: false, date: DATE })).pages[0];
    const pts = pathPoints(page);
    expect(pts[1].x - pts[0].x).toBeCloseTo(100, 2);
    expect(pts[2].y - pts[1].y).toBeCloseTo(40, 2);
    expect((pts[0].x + pts[1].x) / 2).toBeCloseTo((f.area.minX + f.area.maxX) / 2, 2);
  });
});

describe("plan set check", () => {
  it("suggests the next scale and paper that fit when a fixed scale is too fine", () => {
    const c = checkPlanSet(example(), opts({ paper: "A4", scale: 20 }), ctx);
    expect(c.sheets.some((s) => !s.fits)).toBe(true);
    expect(c.fittingScale).toBeGreaterThan(20);
    expect(checkPlanSet(example(), opts({ paper: "A4", scale: c.fittingScale as PlanSetOptions["scale"] }), ctx).sheets.every((s) => s.fits)).toBe(true);
    expect(c.fittingPaper).toBeDefined();
    expect(checkPlanSet(example(), opts({ paper: c.fittingPaper, scale: 20 }), ctx).sheets.every((s) => s.fits)).toBe(true);
  });

  it("counts every sheet: plan, elevations, list pages and the 3D page", () => {
    const c = checkPlanSet(example(), opts(), ctx, true);
    expect(c.sheets.map((s) => s.title)).toEqual(["Grundriss", ...["Nord", "Ost", "Süd", "West"].map((f) => `Ansicht ${f} – Schnitttiefe 1.500 mm vor der Wand`)]);
    expect(c.listPages).toBeGreaterThanOrEqual(1);
    expect(c.total).toBe(5 + c.listPages + 1);
    expect(checkPlanSet(example(), opts({ plan: false, elevations: [], list: false }), ctx).total).toBe(0);
  });

  it("adds sheets of single walls by a rule: the slanted ones, every wall or none", () => {
    // The example kitchen has only right angles: no slanted wall, so no extra sheet by default.
    expect(checkPlanSet(example(), opts({ plan: false, list: false }), ctx).sheets).toHaveLength(4);
    const p = example();
    // Chamfer the north-west corner by 1 m: the chamfer runs from corner 0 to 1, „Wand 1“.
    const [a, ...rest] = p.room.points;
    p.room.points = [{ x: a.x, y: a.y + 1000 }, { x: a.x + 1000, y: a.y }, ...rest];
    p.room.openings = [];
    expect(wallSheetWalls(p.room, "slanted")).toEqual([0]);
    expect(wallSheetWalls(p.room, "none")).toEqual([]);
    expect(wallSheetWalls(p.room, "all")).toHaveLength(p.room.points.length);
    const titles = (wallSheets: PlanSetOptions["wallSheets"]) => checkPlanSet(p, opts({ plan: false, list: false, wallSheets }), ctx).sheets.map((s) => s.title.split(" – ")[0]);
    expect(titles("slanted")).toEqual(["Ansicht Nord", "Ansicht Ost", "Ansicht Süd", "Ansicht West", "Ansicht Wand 1"]);
    expect(titles("none")).toHaveLength(4);
    expect(titles("all")).toHaveLength(4 + p.room.points.length);
    // Only single walls, no compass view.
    expect(titles("all").filter((x) => x.includes("Wand"))).toHaveLength(p.room.points.length);
    expect(checkPlanSet(p, opts({ plan: false, list: false, elevations: [], wallSheets: "slanted" }), ctx).total).toBe(1);
  });

  it("reads stored options defensively", () => {
    expect(sanitizePlanSetOptions(null)).toEqual(DEFAULT_PLAN_SET);
    expect(sanitizePlanSetOptions({ wallSheets: "every" }).wallSheets).toBe("slanted");
    expect(sanitizePlanSetOptions({ wallSheets: "all" }).wallSheets).toBe("all");
    expect(sanitizePlanSetOptions({ paper: "A7", orientation: "diagonal", scale: 33, plan: "yes", elevations: ["west", "up", "north"] })).toEqual({ ...DEFAULT_PLAN_SET, elevations: ["north", "west"] });
    expect(sanitizePlanSetOptions({ paper: "A1", orientation: "portrait", scale: 75, list: false })).toMatchObject({ paper: "A1", orientation: "portrait", scale: 75, list: false });
  });

  it("reads the installation plans defensively: settings from before 0.3 get every group", () => {
    expect(DEFAULT_PLAN_SET).toMatchObject({ installation: ["electric", "sanitary", "gas", "ventilation", "special"], pointTables: true });
    // What 0.2 stored: no installation options at all.
    const old = { paper: "A2", orientation: "landscape", scale: "auto", plan: true, elevations: ["north"], wallSheets: "none", list: true, view3d: false, names: true };
    expect(sanitizePlanSetOptions(old)).toEqual({ ...old, installation: [...TRADE_GROUPS], pointTables: true });
    // Known groups in TRADE_GROUPS order, the rest dropped; an empty list stays empty.
    expect(sanitizePlanSetOptions({ installation: ["gas", "plumbing", 3, "electric", "gas"] }).installation).toEqual(["electric", "gas"]);
    expect(sanitizePlanSetOptions({ installation: [] }).installation).toEqual([]);
    expect(sanitizePlanSetOptions({ installation: "electric" }).installation).toEqual([...TRADE_GROUPS]);
    expect(sanitizePlanSetOptions({ pointTables: false }).pointTables).toBe(false);
    expect(sanitizePlanSetOptions({ pointTables: "no" }).pointTables).toBe(true);
    // Fresh arrays: changing what was read leaves the defaults alone.
    sanitizePlanSetOptions(null).installation.pop();
    expect(DEFAULT_PLAN_SET.installation).toHaveLength(5);
  });
});

describe("plan set PDF", () => {
  it("of the example kitchen: every sheet, title block, true scale, nothing outside the paper", async () => {
    const project = example();
    project.info.drawingNo = "K-101";
    project.info.revision = "B";
    const bytes = await planSetPdf(project, opts({ view3d: true }), { ...ctx, image: tinyPng(), date: DATE });
    // Look at it: KPLAN_PDF_OUT=<path> npx vitest run src/render/planSet.test.ts
    if (process.env.KPLAN_PDF_OUT) writeFileSync(process.env.KPLAN_PDF_OUT, bytes);
    const pdf = readPdf(bytes);
    const check = checkPlanSet(project, opts({ view3d: true }), ctx);
    expect(pdf.pages).toHaveLength(check.total);
    const m = pdf.pages.length;
    for (const [i, page] of pdf.pages.entries()) {
      expect([Math.round(page.width), Math.round(page.height)]).toEqual([420, 297]);
      const texts = page.texts;
      for (const s of ["Projekt", project.info.name, t("sheet.drawingNo", undefined, "de"), "K-101", t("sheet.revision", undefined, "de"), "B", "Maße in mm", `${i + 1} von ${m}`]) expect(texts, `page ${i + 1}`).toContain(s);
      expect(texts.some((s) => s.startsWith(t("data.typicalValues", undefined, "de").slice(0, 20)))).toBe(true);
      for (const p of pathPoints(page)) {
        expect(p.x).toBeGreaterThanOrEqual(-0.01);
        expect(p.x).toBeLessThanOrEqual(page.width + 0.01);
        expect(p.y).toBeGreaterThanOrEqual(-0.01);
        expect(p.y).toBeLessThanOrEqual(page.height + 0.01);
      }
    }
    const titles = pdf.pages.map((p) => p.texts);
    expect(titles[0]).toContain("Grundriss");
    expect(titles[0]).toContain(`1:${check.sheets[0].scale}`);
    expect(titles[1]).toContain("Ansicht Nord – Schnitttiefe 1.500 mm vor der Wand");
    expect(titles[5]).toContain("Geräteliste");
    expect(titles[5]).toContain("o. M.");
    // The list carries every item by position and name, and the totals.
    const listTexts = titles.slice(5, 5 + check.listPages).flat();
    for (const it of project.items) {
      expect(listTexts).toContain(String(it.pos));
      expect(listTexts.some((s) => s === it.name || (s.endsWith("…") && it.name.startsWith(s.slice(0, -1))))).toBe(true);
    }
    expect(listTexts).toContain("Summe");
    // The water and drain points in full, not cut to their narrow columns.
    const tot = equipmentTotals(equipmentRows(project));
    const points = listTexts.find((s) => s.startsWith("Wasser: "));
    expect(points).toBe(`Wasser: ${tot.coldWater} × KW, ${tot.hotWater} × WW · Abwasser: ${tot.drain} × Abwasser, ${tot.floorDrain} × Bodenablauf`);
    // Nothing of the list runs into the title block, and the totals share a page with rows.
    const frame = sheetFrame("A3", "landscape");
    for (const page of pdf.pages.slice(5, 5 + check.listPages)) {
      for (const m of page.content.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)) {
        const x = Number(m[1]) / PT_PER_MM;
        const y = page.height - Number(m[2]) / PT_PER_MM;
        if (y > frame.area.maxY + 0.01) expect(x).toBeGreaterThanOrEqual(frame.title.minX);
      }
    }
    const lastList = titles[4 + check.listPages];
    expect(lastList).toContain("Summe");
    // planSet.ts promises that at least one row moves with the totals, never the totals alone.
    expect(project.items.filter((it) => lastList.includes(String(it.pos))).length).toBeGreaterThanOrEqual(1);
    // The 3D view as the last page, as an image.
    expect(titles[m - 1]).toContain("3D");
    expect(pdf.pages[m - 1].content).toContain("/Im1 Do");
  });

  it("lists spec and price when an item has them, and reads odd values defensively", async () => {
    const project = example();
    const [a, b] = project.items;
    a.spec = { manufacturer: "Rational", model: "iCombi Pro 10-1/1", article: "CD1EERA.0000234", price: 14990.5 };
    // Values of the wrong type, as a hand-edited file may hold them.
    (b as unknown as { spec: unknown }).spec = { manufacturer: 42, model: null, price: "teuer" };
    const pdf = readPdf(await planSetPdf(project, opts({ plan: false, elevations: [] }), { ...ctx, date: DATE }));
    const texts = pdf.pages.flatMap((p) => p.texts);
    expect(texts).toContain(t("list.price", undefined, "de"));
    expect(texts).toContain("Rational · iCombi Pro 10-1/1 · Art.-Nr. CD1EERA.0000234");
    expect(texts).toContain("14.990,50");
    expect(texts).toContain("42");
    expect(texts.join("\n")).not.toContain("teuer");
  });

  it("leaves out the price column without prices, and writes English", async () => {
    const pdf = readPdf(await planSetPdf(example(), opts({ plan: false, elevations: ["north"] }), { ...ctx, lang: "en", date: DATE }));
    const texts = pdf.pages.flatMap((p) => p.texts);
    expect(texts).not.toContain(t("list.price", undefined, "en"));
    expect(texts).toContain("Equipment list");
    expect(texts).toContain("Dimensions in mm");
    expect(texts.some((s) => s.startsWith("1 of "))).toBe(true);
  });

  it("refuses a sheet that does not fit instead of clipping it", async () => {
    await expect(planSetPdf(example(), opts({ paper: "A4", scale: 20 }), { ...ctx, date: DATE })).rejects.toThrow(SheetTooSmall);
  });

  it("prints a fixed 1:50 in portrait on the smallest paper the check finds for it", async () => {
    const project = example();
    const c = checkPlanSet(project, opts({ paper: "A4", orientation: "portrait", scale: 50, elevations: [], list: false }), ctx);
    const paper = c.sheets[0].fits ? "A4" : c.fittingPaper;
    expect(paper).toBeDefined();
    const pdf = readPdf(await planSetPdf(project, opts({ paper, orientation: "portrait", scale: 50, elevations: [], list: false }), { ...ctx, date: DATE }));
    expect(pdf.pages).toHaveLength(1);
    expect(pdf.pages[0].texts).toContain("1:50");
    expect(pdf.pages[0].width).toBeLessThan(pdf.pages[0].height);
  });
});

describe("installation plans and connection tables", () => {
  /** The title in a page's title block (the text after the „Zeichnung“ label). */
  const titleOf = (page: ReadPage) => page.texts[page.texts.indexOf(t("sheet.drawing", undefined, "de")) + 1];
  /** Whether a page's texts contain `s`, whole or shortened with an ellipsis to fit its cell. */
  const shows = (texts: string[], s: string) => texts.some((x) => x === s || (x.endsWith("…") && s.startsWith(x.slice(0, -1))));

  /** A project whose only units are `n` copies of a purely electric unit of the example. */
  const electricOnly = (n: number): Project => {
    const p = example();
    const unit = p.items.find((it) => (it.connections.electricKw ?? 0) > 0 && !it.connections.coldWater && !it.connections.drain && !it.connections.exhaustM3h);
    expect(unit).toBeDefined();
    const u = unit!;
    p.items = Array.from({ length: n }, (_, i) => ({ ...u, id: `e${i}`, pos: i + 1, points: undefined, x: 1000 + (i % 10) * (u.width + 50), y: 1000 + Math.floor(i / 10) * 1200 }));
    return p;
  };

  it("adds a sheet only for the trade groups with points, after the plan and before the elevations", () => {
    const project = example();
    const groups = TRADE_GROUPS.filter((g) => projectPoints(project.items, g).length > 0);
    // The example kitchen is all-electric and has no steam or remote refrigeration.
    expect(groups).toEqual(["electric", "sanitary", "ventilation"]);
    expect(installationGroups(project, DEFAULT_PLAN_SET)).toEqual(groups);
    expect(installationGroups(project, { installation: ["gas", "special", "sanitary"] })).toEqual(["sanitary"]);
    const c = checkPlanSet(project, opts({ installation: [...TRADE_GROUPS], list: false }), ctx);
    expect(c.sheets.map((s) => s.title.split(" – ")[0])).toEqual(["Grundriss", "Installationsplan Elektro", "Installationsplan Sanitär", "Installationsplan Lüftung", "Ansicht Nord", "Ansicht Ost", "Ansicht Süd", "Ansicht West"]);
    expect(c.tablePages).toBeGreaterThanOrEqual(3);
    expect(c.total).toBe(8 + c.tablePages);
    // Without tables only the sheets; without groups that have points nothing of it.
    expect(checkPlanSet(project, opts({ installation: [...TRADE_GROUPS], pointTables: false, list: false }), ctx)).toMatchObject({ tablePages: 0, total: 8 });
    expect(checkPlanSet(project, installationOnly({ installation: ["gas", "special"] }), ctx).total).toBe(0);
    expect(checkPlanSet(project, installationOnly({ installation: ["ventilation"] }), ctx)).toMatchObject({ sheets: [{ title: "Installationsplan Lüftung" }], tablePages: 1, total: 2 });
    // A gas unit brings the gas sheet.
    const gas = project.items.find((it) => (it.connections.electricKw ?? 0) > 0)!;
    gas.connections = { ...gas.connections, gasKw: 12 };
    expect(installationGroups(project, DEFAULT_PLAN_SET)).toEqual(["electric", "sanitary", "gas", "ventilation"]);
  });

  it("prints each installation plan followed by its table, with legend, scale and the points by row", async () => {
    const project = example();
    const o = opts({ installation: [...TRADE_GROUPS], elevations: ["north"] });
    const check = checkPlanSet(project, o, ctx);
    const pdf = readPdf(await planSetPdf(project, o, { ...ctx, date: DATE }));
    expect(pdf.pages).toHaveLength(check.total);
    const titles = pdf.pages.map(titleOf);
    const pages = (title: string) => pdf.pages.filter((p) => titleOf(p) === title);
    // The order of the sheets, a table's pages one after another right after its plan.
    const order = titles.filter((s, i) => s !== titles[i - 1]);
    expect(order).toEqual([
      "Grundriss",
      "Installationsplan Elektro",
      "Anschlusstabelle Elektro",
      "Installationsplan Sanitär",
      "Anschlusstabelle Sanitär",
      "Installationsplan Lüftung",
      "Anschlusstabelle Lüftung",
      "Ansicht Nord – Schnitttiefe 1.500 mm vor der Wand",
      "Geräteliste",
    ]);
    for (const g of ["electric", "sanitary", "ventilation"] as const) {
      const name = tradeGroupName(g, "de");
      const [sheet] = pages(`Installationsplan ${name}`);
      const fit = check.sheets.find((s) => s.title === `Installationsplan ${name}`)!;
      expect(sheet.texts).toContain(`1:${fit.scale}`);
      expect(sheet.texts).toContain("Legende");
      expect(sheet.texts).toContain("Höhen in mm über Fertigfußboden (FFB)");
      // Every point of the group as a label on its sheet and as a row of its table, in order.
      const rows = pointRows(project, g, "de");
      for (const r of rows) expect(sheet.texts).toContain(r.no);
      const table = pages(`Anschlusstabelle ${name}`);
      expect(table.every((p) => p.texts.includes("o. M."))).toBe(true);
      const cells = table.flatMap((p) => p.texts);
      expect(cells.filter((s) => /^\d+\.[A-Z]+$/.test(s))).toEqual(rows.map((r) => r.no));
      for (const k of ["Nr.", "Pos.", "Bezeichnung", "Abstand/Wand", "Höhe ü. FFB", "Werte", "Bemerkung"]) expect(table[0].texts).toContain(k);
      // Name, height, values and distances as the model gives them.
      const first = rows[0];
      expect(shows(table[0].texts, first.name)).toBe(true);
      expect(table[0].texts).toContain(heightText(first.point.z));
      expect(shows(table[0].texts, pointValuesText(first.point, "de"))).toBe(true);
      expect(shows(table[0].texts, `${Math.round(first.walls[0].distance)} / ${wallRefName(first.walls[0], "de")}`)).toBe(true);
    }
    // The sums only under the electric table.
    expect(pages("Anschlusstabelle Sanitär").flatMap((p) => p.texts)).not.toContain("Summe (kW)");
  });

  it("splits a long table into pages, the sums never alone on the last one", async () => {
    // A4 landscape holds 20 rows of 6 mm under the header, the last page 18 and the two rows of
    // sums: with one point more, the last point moves on to stand with the sums.
    const o = installationOnly({ paper: "A4", installation: ["electric"] });
    const frame = sheetFrame("A4", "landscape");
    for (const [n, pages] of [
      [18, 1],
      [19, 2],
      [38, 2],
      [39, 3],
    ] as const) {
      const project = electricOnly(n);
      const check = checkPlanSet(project, o, ctx);
      expect(check.tablePages, `${n} points`).toBe(pages);
      const pdf = readPdf(await planSetPdf(project, o, { ...ctx, date: DATE }));
      expect(pdf.pages).toHaveLength(1 + pages);
      const table = pdf.pages.slice(1);
      const ids = table.map((p) => p.texts.filter((s) => /^\d+\.E$/.test(s)));
      expect(ids.flat()).toEqual(Array.from({ length: n }, (_, i) => `${i + 1}.E`));
      expect(ids.every((x) => x.length > 0 && x.length <= 20)).toBe(true);
      expect(table[table.length - 1].texts).toContain("Summe (kW)");
      expect(table.slice(0, -1).some((p) => p.texts.includes("Summe (kW)"))).toBe(false);
      // Nothing of the table runs into the title block.
      for (const page of table) {
        for (const m of page.content.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)) {
          const x = Number(m[1]) / PT_PER_MM;
          const y = page.height - Number(m[2]) / PT_PER_MM;
          if (y > frame.area.maxY + 0.01) expect(x).toBeGreaterThanOrEqual(frame.title.minX);
        }
      }
    }
  });

  it("ends the electric table with the connected load, plain and with the simultaneity factor", async () => {
    const project = example();
    project.settings = { simultaneity: 0.65 };
    const sum = equipmentTotals(equipmentRows(project)).electricKw;
    expect(electricSum(pointRows(project, "electric"))).toBe(sum);
    expect(electricSum([])).toBe(0);
    const pdf = readPdf(await planSetPdf(project, installationOnly({ installation: ["electric"] }), { ...ctx, date: DATE }));
    const last = pdf.pages[pdf.pages.length - 1].texts;
    const at = last.indexOf("Summe (kW)");
    expect(at).toBeGreaterThan(0);
    expect(last[at + 1]).toBe(formatNumber(sum, "de"));
    expect(last[at + 2]).toBe("Mit Gleichzeitigkeit 0,65 (kW)");
    expect(last[at + 3]).toBe(formatNumber(withSimultaneity(sum, 0.65), "de"));
    // English: decimal point and the English labels.
    const en = readPdf(await planSetPdf(project, installationOnly({ installation: ["electric"] }), { ...ctx, lang: "en", date: DATE }));
    const enTexts = en.pages.flatMap((p) => p.texts);
    expect(enTexts).toContain("Installation plan Electric");
    expect(enTexts).toContain("Connection table Electric");
    expect(enTexts).toContain("With simultaneity 0.65 (kW)");
    expect(enTexts).toContain(String(withSimultaneity(sum, 0.65)));
  });

  it("refuses an installation plan that does not fit, like any other sheet", async () => {
    const project = example();
    const o = installationOnly({ paper: "A4", scale: 20, installation: ["sanitary"] });
    const c = checkPlanSet(project, o, ctx);
    expect(c.sheets).toEqual([{ title: "Installationsplan Sanitär", scale: 20, fits: false }]);
    expect(c.fittingScale).toBeGreaterThan(20);
    expect(c.fittingPaper).toBeDefined();
    expect(checkPlanSet(project, { ...o, scale: c.fittingScale as PlanSetOptions["scale"] }, ctx).sheets.every((s) => s.fits)).toBe(true);
    await expect(planSetPdf(project, o, { ...ctx, date: DATE })).rejects.toThrow("Installationsplan Sanitär passt bei 1:20 nicht auf A4.");
    // The legend stands beside the plan: an installation plan never fits at a finer scale.
    const plan = checkPlanSet(project, opts({ elevations: [], list: false }), ctx).sheets[0];
    const inst = checkPlanSet(project, installationOnly({ installation: ["electric"] }), ctx).sheets[0];
    expect(inst.scale).toBeGreaterThanOrEqual(plan.scale);
  });
});
