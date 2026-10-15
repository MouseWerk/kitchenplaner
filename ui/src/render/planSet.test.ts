import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { t } from "../lib/i18n";
import { equipmentRows, equipmentTotals } from "../model/equipment";
import { parseProject } from "../model/serialize";
import { FACINGS, type Project } from "../model/types";
import type { Drawing } from "./drawing";
import { PdfDocument, PT_PER_MM } from "./pdf";
import { checkPlanSet, DEFAULT_PLAN_SET, drawDrawing, PAPER_SIZES, planSetPdf, sanitizePlanSetOptions, scaleDrawing, sheetFrame, SheetTooSmall, type PlanSetOptions } from "./planSet";
import { pathPoints, readPdf } from "./testPdf";

const DATE = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));
const ctx = { lang: "de" as const, cut: "wall" as const };
const example = (): Project => parseProject(readFileSync(resolve(__dirname, "../../../examples/Beispielkueche-Restaurant.kplan"), "utf8"));
const opts = (patch: Partial<PlanSetOptions> = {}): PlanSetOptions => ({ ...DEFAULT_PLAN_SET, elevations: [...FACINGS], ...patch });

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
    expect(c.sheets.map((s) => s.title)).toEqual(["Grundriss", ...["Nord", "Ost", "Süd", "West"].map((f) => `Ansicht ${f} – Schnitttiefe Wand (1,5 m)`)]);
    expect(c.listPages).toBeGreaterThanOrEqual(1);
    expect(c.total).toBe(5 + c.listPages + 1);
    expect(checkPlanSet(example(), opts({ plan: false, elevations: [], list: false }), ctx).total).toBe(0);
  });

  it("reads stored options defensively", () => {
    expect(sanitizePlanSetOptions(null)).toEqual(DEFAULT_PLAN_SET);
    expect(sanitizePlanSetOptions({ paper: "A7", orientation: "diagonal", scale: 33, plan: "yes", elevations: ["west", "up", "north"] })).toEqual({ ...DEFAULT_PLAN_SET, elevations: ["north", "west"] });
    expect(sanitizePlanSetOptions({ paper: "A1", orientation: "portrait", scale: 75, list: false })).toMatchObject({ paper: "A1", orientation: "portrait", scale: 75, list: false });
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
    expect(titles[1]).toContain("Ansicht Nord – Schnitttiefe Wand (1,5 m)");
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
    expect(project.items.filter((it) => lastList.includes(String(it.pos))).length).toBeGreaterThanOrEqual(2);
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
