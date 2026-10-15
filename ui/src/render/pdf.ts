// A minimal PDF writer without dependencies: pages in millimetres, vector paths with strokes,
// dashes and fills, arcs as Bézier curves, text in the standard Helvetica fonts (WinAnsiEncoding,
// so no font is embedded), PNG images and compressed content streams. It writes what the plan
// set needs and nothing more; PDF 1.4, readable by every viewer.
//
// Coordinates are paper millimetres with the origin top left and y pointing down, as in the
// drawings; the writer converts them to PDF points (y up). 1 mm on the page is 1 mm on paper when
// printed at 100 %.

import type { Vec2 } from "../model/types";

/** A color as red, green, blue from 0 to 1. */
export type Rgb = readonly [number, number, number];

export const PT_PER_MM = 72 / 25.4;

export interface StrokeStyle {
  /** Line width (mm). */
  width: number;
  /** Dash pattern (mm): dash, gap, ...; none for a solid line. */
  dash?: readonly number[];
  color?: Rgb;
}

export interface PathStyle {
  stroke?: StrokeStyle;
  fill?: Rgb;
}

export type FontId = "regular" | "bold";

export interface TextStyle {
  /** Font size (mm). */
  size: number;
  anchor?: "start" | "middle" | "end";
  /** Rotation in degrees, clockwise on the page. */
  angle?: number;
  font?: FontId;
  color?: Rgb;
}

const BLACK: Rgb = [0, 0, 0];
const FONT_NAME: Record<FontId, string> = { regular: "Helvetica", bold: "Helvetica-Bold" };
const FONT_RES: Record<FontId, string> = { regular: "F1", bold: "F2" };

/** A number for a content stream: at most three decimals, no exponent, no "-0". */
function f(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? "0" : String(r);
}

// ---- WinAnsiEncoding

/** The characters WinAnsiEncoding puts at 0x80 to 0x9F (the rest of 0x20 to 0xFF is Latin-1). */
const WIN_ANSI_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
const WIN_ANSI_TO_UNICODE = new Map(Object.entries(WIN_ANSI_HIGH).map(([u, b]) => [b, Number(u)]));

/**
 * Stand-ins for characters outside WinAnsi that plans and lists use: typographic spaces become
 * spaces, the minus sign a hyphen, the diameter sign the letter Ø.
 */
const FALLBACK: Record<string, string> = {
  " ": " ", " ": " ", " ": " ", " ": " ", " ": " ", "​": "",
  "−": "-", "‑": "-", "‐": "-", "‒": "–", "―": "—",
  "⌀": "Ø", "≤": "<=", "≥": ">=", "→": "->", "←": "<-", "≈": "~",
  "′": "'", "″": '"', "­": "",
};

/** The WinAnsi byte of one character, or undefined when the encoding has none. */
function winAnsiByte(cp: number): number | undefined {
  if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff)) return cp;
  return WIN_ANSI_HIGH[cp];
}

/**
 * Text as WinAnsi bytes. Characters the encoding lacks fall back to a stand-in (`FALLBACK`), then
 * to the letter without its accent ("ł" has none, "ő" becomes "o"), else to "?"; control
 * characters (tabs, line breaks) become spaces.
 */
export function encodeWinAnsi(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    const b = winAnsiByte(cp);
    if (b !== undefined) {
      out.push(b);
      continue;
    }
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) {
      out.push(0x20);
      continue;
    }
    const sub = FALLBACK[ch];
    if (sub !== undefined) {
      out.push(...encodeWinAnsi(sub));
      continue;
    }
    const base = ch.normalize("NFD").replace(/\p{M}/gu, "");
    const bb = base.length > 0 && base !== ch ? [...base].map((c) => winAnsiByte(c.codePointAt(0) as number)) : [];
    if (bb.length > 0 && bb.every((v) => v !== undefined)) out.push(...(bb as number[]));
    else out.push(0x3f);
  }
  return out;
}

/** WinAnsi bytes back to text (for tests and the tiny reader in them). */
export function decodeWinAnsi(bytes: ArrayLike<number>): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCodePoint(WIN_ANSI_TO_UNICODE.get(bytes[i]) ?? bytes[i]);
  return s;
}

/** A PDF literal string of WinAnsi bytes, ASCII only (octal escapes above 0x7E). */
function literal(bytes: readonly number[]): string {
  let s = "(";
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += "\\" + String.fromCharCode(b);
    else if (b < 0x20 || b > 0x7e) s += "\\" + b.toString(8).padStart(3, "0");
    else s += String.fromCharCode(b);
  }
  return s + ")";
}

// ---- Font metrics (Helvetica AFM widths, 1/1000 of the font size)

// prettier-ignore
const REGULAR_ASCII = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
// prettier-ignore
const BOLD_ASCII = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];
/** Widths of the WinAnsi characters above ASCII that are not an accented ASCII letter: regular, bold. */
const EXTRA_WIDTH: Record<string, [number, number]> = {
  "€": [556, 556], "‚": [222, 278], "ƒ": [556, 556], "„": [333, 500], "…": [1000, 1000], "†": [556, 556], "‡": [556, 556],
  "ˆ": [333, 333], "‰": [1000, 1000], "‹": [333, 333], "Œ": [1000, 1000], "‘": [222, 278], "’": [222, 278], "“": [333, 500],
  "”": [333, 500], "•": [350, 350], "–": [556, 556], "—": [1000, 1000], "˜": [333, 333], "™": [1000, 1000], "›": [333, 333],
  "œ": [944, 944], " ": [278, 278], "¡": [333, 333], "¢": [556, 556], "£": [556, 556], "¤": [556, 556], "¥": [556, 556],
  "¦": [260, 280], "§": [556, 556], "¨": [333, 333], "©": [737, 737], "ª": [370, 370], "«": [556, 556], "¬": [584, 584],
  "®": [737, 737], "¯": [333, 333], "°": [400, 400], "±": [584, 584], "²": [333, 333], "³": [333, 333], "´": [333, 333],
  "µ": [556, 611], "¶": [537, 556], "·": [278, 278], "¸": [333, 333], "¹": [333, 333], "º": [365, 365], "»": [556, 556],
  "¼": [834, 834], "½": [834, 834], "¾": [834, 834], "¿": [611, 611], "Æ": [1000, 1000], "Ð": [722, 722], "×": [584, 584],
  "Ø": [778, 778], "Þ": [667, 667], "ß": [611, 611], "æ": [889, 889], "ð": [556, 611], "÷": [584, 584], "ø": [611, 611],
  "þ": [556, 611],
};

function charWidth(byte: number, font: FontId): number {
  const ascii = font === "bold" ? BOLD_ASCII : REGULAR_ASCII;
  if (byte >= 0x20 && byte <= 0x7e) return ascii[byte - 0x20];
  const ch = decodeWinAnsi([byte]);
  const extra = EXTRA_WIDTH[ch];
  if (extra) return extra[font === "bold" ? 1 : 0];
  // Accented letters are as wide as their base letter.
  const base = ch.normalize("NFD").charCodeAt(0);
  return base >= 0x20 && base <= 0x7e ? ascii[base - 0x20] : 556;
}

/** The advance width of a text in mm at `size` (mm), as the viewer will set it. */
export function textWidth(text: string, size: number, font: FontId = "regular"): number {
  return (encodeWinAnsi(text).reduce((w, b) => w + charWidth(b, font), 0) * size) / 1000;
}

/** `text` shortened with an ellipsis so it is at most `maxWidth` mm wide. */
export function fitText(text: string, maxWidth: number, size: number, font: FontId = "regular"): string {
  if (textWidth(text, size, font) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 0 && textWidth(chars.join("") + "…", size, font) > maxWidth) chars.pop();
  return chars.length > 0 ? chars.join("").trimEnd() + "…" : "";
}

// ---- Compression

/** Runs bytes through a (de)compression stream, using only the stream's own ends. */
async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const written = writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => writer.close());
  const reader = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.length;
  }
  await written;
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** zlib (RFC 1950) compression, what FlateDecode expects; null where the runtime has no streams. */
export async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  return through(bytes, new CompressionStream("deflate"));
}

export async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("PDF: no DecompressionStream");
  return through(bytes, new DecompressionStream("deflate"));
}

// ---- PNG

export interface RawImage {
  width: number;
  height: number;
  /** 8-bit RGB, row by row, without alpha. */
  rgb: Uint8Array;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * Decodes an 8-bit PNG (gray, RGB, palette, with or without alpha; not interlaced) to RGB,
 * transparent pixels laid on white paper. Throws on anything else.
 */
export async function decodePng(png: Uint8Array): Promise<RawImage> {
  if (png.length < 8 || PNG_SIGNATURE.some((b, i) => png[i] !== b)) throw new Error("PNG: bad signature");
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let width = 0;
  let height = 0;
  let colorType = -1;
  let palette: Uint8Array | null = null;
  let paletteAlpha: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  for (let at = 8; at + 8 <= png.length; ) {
    const len = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const depth = data[8];
      colorType = data[9];
      if (depth !== 8 || data[12] !== 0 || !(colorType in CHANNELS)) throw new Error("PNG: only 8-bit, non-interlaced images");
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") paletteAlpha = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + len;
  }
  if (!width || !height || idat.length === 0) throw new Error("PNG: no image data");
  const joined = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  let o = 0;
  for (const d of idat) {
    joined.set(d, o);
    o += d.length;
  }
  const raw = await inflate(joined);
  const ch = CHANNELS[colorType];
  const stride = width * ch;
  if (raw.length < height * (stride + 1)) throw new Error("PNG: truncated image data");
  const px = unfilter(raw, width, height, ch);
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, n = width * height; i < n; i++) {
    let r: number, g: number, b: number, a = 255;
    const s = i * ch;
    if (colorType === 0 || colorType === 4) {
      r = g = b = px[s];
      if (colorType === 4) a = px[s + 1];
    } else if (colorType === 3) {
      const k = px[s];
      if (!palette || k * 3 + 2 >= palette.length) throw new Error("PNG: bad palette");
      [r, g, b] = [palette[k * 3], palette[k * 3 + 1], palette[k * 3 + 2]];
      if (paletteAlpha && k < paletteAlpha.length) a = paletteAlpha[k];
    } else {
      [r, g, b] = [px[s], px[s + 1], px[s + 2]];
      if (colorType === 6) a = px[s + 3];
    }
    // On white: c·a + 255·(1 − a).
    rgb[i * 3] = Math.round((r * a + 255 * (255 - a)) / 255);
    rgb[i * 3 + 1] = Math.round((g * a + 255 * (255 - a)) / 255);
    rgb[i * 3 + 2] = Math.round((b * a + 255 * (255 - a)) / 255);
  }
  return { width, height, rgb };
}

/** Reverses the PNG row filters (None, Sub, Up, Average, Paeth) of 8-bit samples. */
function unfilter(raw: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[row + x - bpp] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= bpp && y > 0 ? out[prev + x - bpp] : 0;
      let pred = 0;
      if (type === 1) pred = a;
      else if (type === 2) pred = b;
      else if (type === 3) pred = (a + b) >> 1;
      else if (type === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (type !== 0) throw new Error("PNG: bad filter");
      out[row + x] = (raw[src + x] + pred) & 0xff;
    }
  }
  return out;
}

// ---- Document

/** An image added to a document; draw it on any page with `PdfPage.image`. */
export interface PdfImage {
  readonly id: number;
  readonly width: number;
  readonly height: number;
}

interface StoredImage extends PdfImage {
  raw: RawImage;
}

export class PdfPage {
  /** Paper size (mm). */
  readonly width: number;
  readonly height: number;
  private readonly ops: string[] = ["1 J 1 j"];
  readonly fonts = new Set<FontId>();
  readonly images = new Set<number>();
  private lw = -1;
  private dash = "[] 0 d";
  private strokeColor = "0 0 0 RG";
  private fillColor = "0 0 0 rg";

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /** The page's content stream operators. */
  content(): string {
    return this.ops.join("\n") + "\n";
  }

  private X(x: number): string {
    return f(x * PT_PER_MM);
  }

  private Y(y: number): string {
    return f((this.height - y) * PT_PER_MM);
  }

  private pt(p: Vec2): string {
    return `${this.X(p.x)} ${this.Y(p.y)}`;
  }

  private setStroke(s: StrokeStyle) {
    if (s.width !== this.lw) {
      this.lw = s.width;
      this.ops.push(`${f(s.width * PT_PER_MM)} w`);
    }
    const dash = s.dash && s.dash.length > 0 ? `[${s.dash.map((d) => f(d * PT_PER_MM)).join(" ")}] 0 d` : "[] 0 d";
    if (dash !== this.dash) {
      this.dash = dash;
      this.ops.push(dash);
    }
    const c = s.color ?? BLACK;
    const rg = `${f(c[0])} ${f(c[1])} ${f(c[2])} RG`;
    if (rg !== this.strokeColor) {
      this.strokeColor = rg;
      this.ops.push(rg);
    }
  }

  private setFill(c: Rgb) {
    const rg = `${f(c[0])} ${f(c[1])} ${f(c[2])} rg`;
    if (rg !== this.fillColor) {
      this.fillColor = rg;
      this.ops.push(rg);
    }
  }

  /** Strokes and fills the current path as the style says. */
  private paint(style: PathStyle, closed: boolean) {
    if (style.fill) this.setFill(style.fill);
    if (style.stroke) this.setStroke(style.stroke);
    const close = closed ? "h " : "";
    if (style.fill && style.stroke) this.ops.push(`${close}B`);
    else if (style.fill) this.ops.push(`${close}f`);
    else if (style.stroke) this.ops.push(`${close}S`);
    else this.ops.push("n");
  }

  /** A polyline or polygon (closed); a fill applies to closed paths only. */
  path(pts: readonly Vec2[], closed: boolean, style: PathStyle) {
    if (pts.length < 2) return;
    const d = pts.map((p, i) => `${this.pt(p)} ${i === 0 ? "m" : "l"}`).join(" ");
    this.ops.push(d);
    this.paint(closed ? style : { stroke: style.stroke }, closed);
  }

  rect(x: number, y: number, w: number, h: number, style: PathStyle) {
    this.path([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true, style);
  }

  line(a: Vec2, b: Vec2, stroke: StrokeStyle) {
    this.path([a, b], false, { stroke });
  }

  /** Bézier segments of an arc from a0 to a1 (degrees, clockwise on the page from +x). */
  private arcPath(c: Vec2, r: number, a0: number, a1: number, move: boolean): string {
    let sweep = a1 - a0;
    const parts = Math.max(1, Math.ceil(Math.abs(sweep) / 90 - 1e-9));
    sweep /= parts;
    const rad = (a: number) => (a * Math.PI) / 180;
    const at = (a: number): Vec2 => ({ x: c.x + r * Math.cos(rad(a)), y: c.y + r * Math.sin(rad(a)) });
    // The control points lie on the tangents at 4/3·tan(θ/4) of the radius: the standard
    // approximation, off by less than 0.03 % of the radius for a quarter circle.
    const k = (4 / 3) * Math.tan(rad(sweep) / 4) * r;
    let d = move ? `${this.pt(at(a0))} m` : "";
    for (let i = 0; i < parts; i++) {
      const s = a0 + i * sweep;
      const e = s + sweep;
      const p0 = at(s);
      const p3 = at(e);
      const p1 = { x: p0.x - k * Math.sin(rad(s)), y: p0.y + k * Math.cos(rad(s)) };
      const p2 = { x: p3.x + k * Math.sin(rad(e)), y: p3.y - k * Math.cos(rad(e)) };
      d += ` ${this.pt(p1)} ${this.pt(p2)} ${this.pt(p3)} c`;
    }
    return d.trim();
  }

  /** An open arc from a0 to a1 (degrees, clockwise on the page from +x, a1 > a0). */
  arc(c: Vec2, r: number, a0: number, a1: number, stroke: StrokeStyle) {
    let end = a1;
    while (end <= a0) end += 360;
    this.ops.push(this.arcPath(c, r, a0, end, true));
    this.paint({ stroke }, false);
  }

  circle(c: Vec2, r: number, style: PathStyle) {
    this.ops.push(this.arcPath(c, r, 0, 360, true));
    this.paint(style, true);
  }

  /** One line of text, its baseline through `p`. */
  text(text: string, p: Vec2, style: TextStyle) {
    const bytes = encodeWinAnsi(text);
    if (bytes.length === 0) return;
    const font = style.font ?? "regular";
    this.fonts.add(font);
    const w = (bytes.reduce((s, b) => s + charWidth(b, font), 0) * style.size) / 1000;
    const shift = style.anchor === "middle" ? w / 2 : style.anchor === "end" ? w : 0;
    // Clockwise on the page (y down) is counter-clockwise turned in PDF space (y up).
    const a = (-(style.angle ?? 0) * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // The anchor shift runs along the text's direction on the page.
    const x = p.x - shift * cos;
    const y = p.y + shift * sin;
    this.setFill(style.color ?? BLACK);
    const m = Math.abs(a) < 1e-9 ? `1 0 0 1 ${this.X(x)} ${this.Y(y)}` : `${f(cos)} ${f(sin)} ${f(-sin)} ${f(cos)} ${this.X(x)} ${this.Y(y)}`;
    this.ops.push(`BT /${FONT_RES[font]} ${f(style.size * PT_PER_MM)} Tf ${m} Tm ${literal(bytes)} Tj ET`);
  }

  /** An image stretched into the box (mm, top left corner at x, y). */
  image(img: PdfImage, x: number, y: number, w: number, h: number) {
    this.images.add(img.id);
    this.ops.push(`q ${f(w * PT_PER_MM)} 0 0 ${f(h * PT_PER_MM)} ${this.X(x)} ${this.Y(y + h)} cm /Im${img.id} Do Q`);
  }
}

export interface PdfInfo {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
}

/** A PDF text string: plain ASCII as a literal, anything else as UTF-16BE with a byte order mark. */
function textString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return literal([...s].map((c) => c.charCodeAt(0)));
  let hex = "FEFF";
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export interface PdfWriteOptions {
  /** Compress content streams and images (default true where the runtime can). */
  compress?: boolean;
  /** Creation date (default now); fixed in tests. */
  date?: Date;
}

export class PdfDocument {
  readonly pages: PdfPage[] = [];
  private readonly imgs: StoredImage[] = [];
  info: PdfInfo = {};

  /** A new page of `width` × `height` mm at the end of the document. */
  addPage(width: number, height: number): PdfPage {
    const page = new PdfPage(width, height);
    this.pages.push(page);
    return page;
  }

  addImage(raw: RawImage): PdfImage {
    const img: StoredImage = { id: this.imgs.length + 1, width: raw.width, height: raw.height, raw };
    this.imgs.push(img);
    return img;
  }

  async addPng(png: Uint8Array): Promise<PdfImage> {
    return this.addImage(await decodePng(png));
  }

  /** The finished file. */
  async toBytes(opts: PdfWriteOptions = {}): Promise<Uint8Array> {
    const compress = opts.compress ?? true;
    const enc = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const put = (b: Uint8Array | string) => {
      const bytes = typeof b === "string" ? latin1(b) : b;
      chunks.push(bytes);
      size += bytes.length;
    };
    const offsets: number[] = [];
    const obj = (n: number, body: string) => {
      offsets[n] = size;
      put(`${n} 0 obj\n${body}\nendobj\n`);
    };
    const stream = async (n: number, dict: string, data: Uint8Array) => {
      const packed = compress ? await deflate(data) : null;
      const bytes = packed ?? data;
      offsets[n] = size;
      put(`${n} 0 obj\n<< ${dict}${packed ? " /Filter /FlateDecode" : ""} /Length ${bytes.length} >>\nstream\n`);
      put(bytes);
      put(`\nendstream\nendobj\n`);
    };

    // Numbering: 1 catalog, 2 page tree, 3 and 4 the fonts, then the images, then per page the
    // page and its content, last the document info.
    const firstImage = 5;
    const firstPage = firstImage + this.imgs.length;
    const pageObj = (i: number) => firstPage + i * 2;
    const infoObj = firstPage + this.pages.length * 2;

    put("%PDF-1.4\n");
    // A comment with bytes above 127 tells transfer tools the file is binary.
    put(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, `<< /Type /Pages /Kids [${this.pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] /Count ${this.pages.length} >>`);
    obj(3, `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAME.regular} /Encoding /WinAnsiEncoding >>`);
    obj(4, `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAME.bold} /Encoding /WinAnsiEncoding >>`);
    for (const [i, img] of this.imgs.entries()) {
      await stream(firstImage + i, `/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8`, img.raw.rgb);
    }
    for (const [i, page] of this.pages.entries()) {
      const fonts = `/Font << /F1 3 0 R /F2 4 0 R >>`;
      const xobj = page.images.size > 0 ? ` /XObject << ${[...page.images].map((id) => `/Im${id} ${firstImage + id - 1} 0 R`).join(" ")} >>` : "";
      const box = `[0 0 ${f(page.width * PT_PER_MM)} ${f(page.height * PT_PER_MM)}]`;
      obj(pageObj(i), `<< /Type /Page /Parent 2 0 R /MediaBox ${box} /Resources << ${fonts}${xobj} >> /Contents ${pageObj(i) + 1} 0 R >>`);
      await stream(pageObj(i) + 1, "", enc.encode(page.content()));
    }
    const info = this.info;
    const entries = [
      info.title !== undefined ? `/Title ${textString(info.title)}` : "",
      info.author !== undefined ? `/Author ${textString(info.author)}` : "",
      info.subject !== undefined ? `/Subject ${textString(info.subject)}` : "",
      `/Creator ${textString(info.creator ?? "Kitchenplaner")}`,
      `/Producer ${textString("Kitchenplaner")}`,
      `/CreationDate ${textString(pdfDate(opts.date ?? new Date()))}`,
    ].filter(Boolean);
    obj(infoObj, `<< ${entries.join(" ")} >>`);

    const xref = size;
    const count = infoObj + 1;
    let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let n = 1; n < count; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
    put(table);
    put(`trailer\n<< /Size ${count} /Root 1 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

    const out = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  }
}

/** A string of code points below 256 as bytes (the PDF syntax around the streams is ASCII). */
function latin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
