// A tiny PDF reader for the tests of the PDF writer and the plan set: it checks the file's
// structure (header, cross-reference offsets, object count, stream lengths) and hands back the
// pages with their size, decompressed content and text. Only what pdf.ts writes; not for use in
// the app.

import { inflateSync } from "node:zlib";
import { decodeWinAnsi, PT_PER_MM } from "./pdf";

export interface PdfObject {
  dict: string;
  stream?: Uint8Array;
}

export interface ReadPage {
  /** Size in mm. */
  width: number;
  height: number;
  dict: string;
  content: string;
  /** The text of every Tj, decoded from WinAnsi. */
  texts: string[];
}

export interface ReadPdf {
  objects: Map<number, PdfObject>;
  pages: ReadPage[];
  info: string;
}

const latin1 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
};

/** The bytes of a PDF literal string's inside (escapes resolved). */
export function unescapeLiteral(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== "\\") {
      out.push(c.charCodeAt(0));
      continue;
    }
    const n = s[++i];
    if (/[0-7]/.test(n)) {
      let oct = n;
      while (oct.length < 3 && /[0-7]/.test(s[i + 1] ?? "")) oct += s[++i];
      out.push(parseInt(oct, 8));
    } else out.push(({ n: 10, r: 13, t: 9, b: 8, f: 12 } as Record<string, number>)[n] ?? n.charCodeAt(0));
  }
  return out;
}

/** All Tj strings of a content stream, in order. */
export function textsOf(content: string): string[] {
  return [...content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => decodeWinAnsi(unescapeLiteral(m[1])));
}

const ref = (dict: string, key: string): number => {
  const m = new RegExp(`/${key} (\\d+) 0 R`).exec(dict);
  if (!m) throw new Error(`no /${key} in ${dict}`);
  return Number(m[1]);
};

/** Parses and checks a PDF; throws with a reason when the structure is broken. */
export function readPdf(bytes: Uint8Array): ReadPdf {
  const s = latin1(bytes);
  if (!s.startsWith("%PDF-1.")) throw new Error("no header");
  if (!s.endsWith("%%EOF\n")) throw new Error("no %%EOF at the end");
  const sx = /startxref\n(\d+)\n%%EOF\n$/.exec(s);
  if (!sx) throw new Error("no startxref");
  const xref = Number(sx[1]);
  if (!s.startsWith("xref\n", xref)) throw new Error("startxref does not point at the xref table");
  const head = /^xref\n0 (\d+)\n/.exec(s.slice(xref));
  if (!head) throw new Error("bad xref header");
  const count = Number(head[1]);
  const table = xref + head[0].length;
  if (s.slice(table, table + 20) !== "0000000000 65535 f \n") throw new Error("bad free entry");
  const objects = new Map<number, PdfObject>();
  for (let n = 1; n < count; n++) {
    const entry = s.slice(table + n * 20, table + n * 20 + 20);
    const m = /^(\d{10}) 00000 n \n$/.exec(entry);
    if (!m) throw new Error(`bad xref entry ${n}: ${JSON.stringify(entry)}`);
    const at = Number(m[1]);
    const start = `${n} 0 obj\n`;
    if (!s.startsWith(start, at)) throw new Error(`xref offset of object ${n} is wrong`);
    const body = at + start.length;
    const streamAt = s.indexOf("stream\n", body);
    const end = s.indexOf("endobj", body);
    if (end < 0) throw new Error(`object ${n} has no endobj`);
    if (streamAt >= 0 && streamAt < end) {
      const dict = s.slice(body, streamAt);
      const len = Number(/\/Length (\d+)/.exec(dict)?.[1]);
      const from = streamAt + "stream\n".length;
      if (!s.startsWith("\nendstream\nendobj", from + len)) throw new Error(`object ${n}: /Length does not match the stream`);
      let data: Uint8Array = bytes.subarray(from, from + len);
      if (dict.includes("/FlateDecode")) data = new Uint8Array(inflateSync(data));
      objects.set(n, { dict, stream: data });
    } else {
      objects.set(n, { dict: s.slice(body, end) });
    }
  }
  const trailer = /trailer\n(<<[\s\S]*?>>)\nstartxref/.exec(s);
  if (!trailer) throw new Error("no trailer");
  if (Number(/\/Size (\d+)/.exec(trailer[1])?.[1]) !== count) throw new Error("/Size differs from the xref count");
  const catalog = objects.get(ref(trailer[1], "Root"));
  if (!catalog?.dict.includes("/Type /Catalog")) throw new Error("no catalog");
  const tree = objects.get(ref(catalog.dict, "Pages"));
  if (!tree) throw new Error("no page tree");
  const kids = [...(/\/Kids \[([^\]]*)\]/.exec(tree.dict)?.[1] ?? "").matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]));
  if (Number(/\/Count (\d+)/.exec(tree.dict)?.[1]) !== kids.length) throw new Error("/Count differs from /Kids");
  const pages = kids.map((k) => {
    const page = objects.get(k);
    if (!page?.dict.includes("/Type /Page ")) throw new Error(`object ${k} is not a page`);
    const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(page.dict);
    if (!box) throw new Error("page without MediaBox");
    const content = objects.get(ref(page.dict, "Contents"))?.stream;
    if (!content) throw new Error("page without content stream");
    const text = latin1(content);
    return { width: Number(box[1]) / PT_PER_MM, height: Number(box[2]) / PT_PER_MM, dict: page.dict, content: text, texts: textsOf(text) };
  });
  const info = objects.get(ref(trailer[1], "Info"))?.dict ?? "";
  return { objects, pages, info };
}

/** Every point of the m, l and c operators of a content stream, in mm with y down. */
export function pathPoints(page: ReadPage): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (const line of page.content.split("\n")) {
    if (line.startsWith("BT") || line.startsWith("q ")) continue;
    let nums: number[] = [];
    for (const tok of line.split(/\s+/)) {
      if (/^-?[\d.]+$/.test(tok)) {
        nums.push(Number(tok));
        continue;
      }
      if (tok === "m" || tok === "l" || tok === "c") {
        for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i] / PT_PER_MM, y: page.height - nums[i + 1] / PT_PER_MM });
      }
      nums = [];
    }
  }
  return pts;
}
