import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { decodePng, decodeWinAnsi, encodeWinAnsi, fitText, PdfDocument, PT_PER_MM, textWidth } from "./pdf";
import { pathPoints, readPdf } from "./testPdf";

const DATE = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));

describe("WinAnsi text", () => {
  it("maps umlauts, ß, €, °, × and typographic quotes to their WinAnsi bytes", () => {
    expect(encodeWinAnsi("äöüÄÖÜß")).toEqual([0xe4, 0xf6, 0xfc, 0xc4, 0xd6, 0xdc, 0xdf]);
    expect(encodeWinAnsi("€ ° ×")).toEqual([0x80, 0x20, 0xb0, 0x20, 0xd7]);
    expect(encodeWinAnsi("„“–…")).toEqual([0x84, 0x93, 0x96, 0x85]);
    expect(encodeWinAnsi("m³/h")).toEqual([0x6d, 0xb3, 0x2f, 0x68]);
    for (const s of ["Kühlzelle 2,5 m² • 12 °C", "Preis 1.234,50 €", "1200 × 700 × 900", "„Spülküche“ – Größe"]) {
      expect(decodeWinAnsi(encodeWinAnsi(s))).toBe(s);
    }
  });

  it("falls back for characters outside WinAnsi instead of dropping or mangling them", () => {
    const back = (s: string) => decodeWinAnsi(encodeWinAnsi(s));
    // Typographic spaces (Intl puts U+202F in German numbers), minus, comparison signs.
    expect(back("1 234 mm")).toBe("1 234 mm");
    expect(back("−5 ≤ 3 ≥ 1")).toBe("-5 <= 3 >= 1");
    expect(back("⌀ 50")).toBe("Ø 50");
    // Letters with an accent WinAnsi lacks lose the accent; letters without a base become "?".
    expect(back("Łódź")).toBe("?ódz");
    expect(back("Ő")).toBe("O");
    // One question mark per character, also for characters outside the BMP.
    expect(back("厨房")).toBe("??");
    expect(back("a\u{1F600}b")).toBe("a?b");
    // Control characters become spaces.
    expect(back("a\tb\nc")).toBe("a b c");
  });

  it("measures text with Helvetica's widths, accented letters as wide as their base", () => {
    expect(textWidth("a", 10)).toBeCloseTo(5.56);
    expect(textWidth("ä", 10)).toBeCloseTo(textWidth("a", 10));
    expect(textWidth("W", 10, "bold")).toBeCloseTo(9.44);
    expect(textWidth("ii", 10)).toBeLessThan(textWidth("mm", 10));
  });

  it("shortens text with an ellipsis to fit a width", () => {
    expect(fitText("Kombidämpfer", 100, 2.5)).toBe("Kombidämpfer");
    const s = fitText("Kombidämpfer mit Untergestell", 20, 2.5);
    expect(s.endsWith("…")).toBe(true);
    expect(textWidth(s, 2.5)).toBeLessThanOrEqual(20);
  });
});

describe("PDF writer", () => {
  it("writes a structurally valid file: header, xref offsets, object count, trailer", async () => {
    for (const compress of [true, false]) {
      const doc = new PdfDocument();
      doc.info = { title: "Küche – Plansatz", author: "Maurice" };
      doc.addPage(420, 297).text("Hallo", { x: 10, y: 10 }, { size: 5 });
      doc.addPage(210, 297).line({ x: 0, y: 0 }, { x: 10, y: 10 }, { width: 0.5 });
      const pdf = readPdf(await doc.toBytes({ compress, date: DATE }));
      // Catalog, page tree, two fonts, two pages with their content, info.
      expect(pdf.objects.size).toBe(9);
      expect(pdf.pages).toHaveLength(2);
      expect(pdf.pages[0].texts).toEqual(["Hallo"]);
      // Non-ASCII metadata as UTF-16 with a byte order mark.
      expect(pdf.info).toMatch(/\/Title <FEFF004B00FC/);
      expect(pdf.info).toContain("/Author (Maurice)");
      expect(pdf.info).toContain("/CreationDate (D:20261015120000Z)");
    }
  });

  it("gives every page its paper size in points, so 100 % prints true to size", async () => {
    const doc = new PdfDocument();
    doc.addPage(420, 297);
    doc.addPage(210, 297);
    doc.addPage(1189, 841);
    const pdf = readPdf(await doc.toBytes({ date: DATE }));
    expect(pdf.pages[0].dict).toContain("/MediaBox [0 0 1190.551 841.89]");
    expect(pdf.pages.map((p) => [Math.round(p.width), Math.round(p.height)])).toEqual([
      [420, 297],
      [210, 297],
      [1189, 841],
    ]);
  });

  it("places paths in millimetres from the top left", async () => {
    const doc = new PdfDocument();
    doc.addPage(297, 210).path(
      [
        { x: 10, y: 20 },
        { x: 110, y: 20 },
        { x: 110, y: 70 },
      ],
      true,
      { stroke: { width: 0.35, dash: [3, 1.5] }, fill: [0.5, 0.5, 0.5] },
    );
    const page = readPdf(await doc.toBytes({ compress: false, date: DATE })).pages[0];
    const pts = pathPoints(page);
    expect(pts[0].x).toBeCloseTo(10, 2);
    expect(pts[0].y).toBeCloseTo(20, 2);
    expect(pts[1].x - pts[0].x).toBeCloseTo(100, 2);
    expect(pts[2].y - pts[1].y).toBeCloseTo(50, 2);
    // Width and dashes in points; filled and stroked, closed.
    expect(page.content).toContain(`${Math.round(0.35 * PT_PER_MM * 1000) / 1000} w`);
    expect(page.content).toContain("[8.504 4.252] 0 d");
    expect(page.content).toContain("0.5 0.5 0.5 rg");
    expect(page.content).toMatch(/h B\n/);
  });

  it("draws circles and arcs as Bézier curves on the radius", async () => {
    const doc = new PdfDocument();
    const p = doc.addPage(200, 200);
    p.circle({ x: 100, y: 100 }, 40, { stroke: { width: 0.25 } });
    p.arc({ x: 50, y: 50 }, 20, 0, 90, { width: 0.25 });
    const page = readPdf(await doc.toBytes({ compress: false, date: DATE })).pages[0];
    const lines = page.content.split("\n");
    const circle = lines.find((l) => l.split(" c").length - 1 === 4);
    expect(circle).toBeDefined();
    const arc = lines.find((l) => l.split(" c").length - 1 === 1);
    expect(arc).toBeDefined();
    const pts = pathPoints({ ...page, content: circle as string });
    // Start and end points of the four quarters lie on the circle.
    for (const q of [pts[0], pts[3], pts[6], pts[9], pts[12]]) expect(Math.hypot(q.x - 100, q.y - 100)).toBeCloseTo(40, 2);
    // Clockwise on the page from +x: the quarter arc ends straight below the centre.
    const a = pathPoints({ ...page, content: arc as string });
    expect(a[0]).toMatchObject({ x: expect.closeTo(70, 2), y: expect.closeTo(50, 2) });
    expect(a[3]).toMatchObject({ x: expect.closeTo(50, 2), y: expect.closeTo(70, 2) });
  });

  it("writes text in WinAnsi with the standard fonts, anchored and rotated", async () => {
    const doc = new PdfDocument();
    const p = doc.addPage(100, 100);
    p.text("Spülküche (Größe) €", { x: 50, y: 50 }, { size: 5, anchor: "middle" });
    p.text("Wand", { x: 20, y: 80 }, { size: 3, angle: -90, font: "bold" });
    const bytes = await doc.toBytes({ compress: false, date: DATE });
    const pdf = readPdf(bytes);
    expect(pdf.pages[0].texts).toEqual(["Spülküche (Größe) €", "Wand"]);
    const fonts = [...pdf.objects.values()].map((o) => o.dict).filter((d) => d.includes("/Type /Font"));
    expect(fonts.join()).toContain("/BaseFont /Helvetica /Encoding /WinAnsiEncoding");
    expect(fonts.join()).toContain("/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding");
    // Middle anchor: the text starts half its width left of the point.
    const w = textWidth("Spülküche (Größe) €", 5);
    const tm = /1 0 0 1 ([\d.]+) ([\d.]+) Tm/.exec(pdf.pages[0].content);
    expect(Number(tm?.[1]) / PT_PER_MM).toBeCloseTo(50 - w / 2, 2);
    // Turned 90° counter-clockwise on the page: reads bottom to top.
    expect(pdf.pages[0].content).toContain("/F2 8.504 Tf 0 1 -1 0");
  });

  it("compresses content streams", async () => {
    const doc = new PdfDocument();
    const p = doc.addPage(100, 100);
    for (let i = 0; i < 200; i++) p.line({ x: i / 2, y: 0 }, { x: i / 2, y: 100 }, { width: 0.18 });
    const packed = await doc.toBytes({ date: DATE });
    const plain = await doc.toBytes({ compress: false, date: DATE });
    expect(packed.length).toBeLessThan(plain.length / 3);
    expect(readPdf(packed).pages[0].content).toBe(readPdf(plain).pages[0].content);
  });
});

/** A PNG of the given pixels (RGBA), every row with a different filter type. */
function makePng(width: number, height: number, rgba: number[]): Uint8Array {
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
  const stride = width * 4;
  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    const type = y % 5;
    raw.push(type);
    for (let x = 0; x < stride; x++) {
      const v = rgba[y * stride + x];
      const a = x >= 4 ? rgba[y * stride + x - 4] : 0;
      const b = y > 0 ? rgba[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? rgba[(y - 1) * stride + x - 4] : 0;
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      const pred = [0, a, b, (a + b) >> 1, paeth][type];
      raw.push((v - pred) & 255);
    }
  }
  const idat = [...deflateSync(new Uint8Array(raw))];
  const ihdr = [...u32(width), ...u32(height), 8, 6, 0, 0, 0];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk("IHDR", ihdr), ...chunk("IDAT", idat), ...chunk("IEND", [])]);
}

describe("PNG images", () => {
  const W = 3;
  const H = 6;
  // Opaque colors and one fully transparent pixel (lies on white paper).
  const rgba: number[] = [];
  for (let i = 0; i < W * H; i++) rgba.push((i * 40) % 256, (i * 90) % 256, (i * 13) % 256, i === 4 ? 0 : 255);

  it("decodes every PNG row filter and lays transparency on white", async () => {
    const img = await decodePng(makePng(W, H, rgba));
    expect([img.width, img.height]).toEqual([W, H]);
    for (let i = 0; i < W * H; i++) {
      const want = i === 4 ? [255, 255, 255] : rgba.slice(i * 4, i * 4 + 3);
      expect([...img.rgb.subarray(i * 3, i * 3 + 3)]).toEqual(want);
    }
  });

  it("refuses what is no PNG", async () => {
    await expect(decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).rejects.toThrow(/PNG/);
  });

  it("embeds an image as an RGB XObject placed in millimetres", async () => {
    const doc = new PdfDocument();
    const img = await doc.addPng(makePng(W, H, rgba));
    doc.addPage(100, 100).image(img, 10, 20, 30, 60);
    const pdf = readPdf(await doc.toBytes({ date: DATE }));
    const xobj = [...pdf.objects.values()].find((o) => o.dict.includes("/Subtype /Image"));
    expect(xobj?.dict).toContain(`/Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8`);
    expect(xobj?.stream?.length).toBe(W * H * 3);
    expect(pdf.pages[0].dict).toMatch(/\/XObject << \/Im1 \d+ 0 R >>/);
    // 30 × 60 mm, its lower left corner 20 + 60 mm below the top.
    const k = PT_PER_MM;
    expect(pdf.pages[0].content).toContain(`q ${Math.round(30 * k * 1000) / 1000} 0 0 ${Math.round(60 * k * 1000) / 1000} ${Math.round(10 * k * 1000) / 1000} ${Math.round(20 * k * 1000) / 1000} cm /Im1 Do Q`);
  });
});
