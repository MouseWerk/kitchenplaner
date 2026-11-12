// A small ASCII DXF writer for AutoCAD 2000 (AC1015), the oldest version with units ($INSUNITS),
// lineweights and the object model (handles, owners, block records, layouts) that every current
// CAD program reads without converting. It knows only what the exports need: line types,
// layers, blocks with attribute definitions, block references with attributes, and the plain
// entities LINE, LWPOLYLINE, CIRCLE, ARC, TEXT and SOLID.
//
// Coordinates here are DXF coordinates (y up); `dxf.ts` maps a Drawing (y down) onto them.
//
// What makes a file open without a repair prompt: every object has a unique handle below
// $HANDSEED, and its owner (group 330) is a handle that exists; every table, block record and
// layout links back to the one that owns it; the model and paper space have a block record, a
// BLOCK/ENDBLK pair and a LAYOUT object in the ACAD_LAYOUT dictionary; the line types BYBLOCK,
// BYLAYER and CONTINUOUS, layer 0, text style STANDARD, dimension style STANDARD and the
// application ACAD exist. Plot styles are colour dependent ($PSTYLEMODE 1), so layers need no
// plot style objects and the file no classes.

/** CRLF throughout, as AutoCAD writes it. */
const EOL = "\r\n";

/** A point in DXF coordinates (mm, y up). */
export interface Pt {
  x: number;
  y: number;
}

interface Common {
  layer: string;
  /** Line type name; absent for BYLAYER. */
  ltype?: string;
  /** Lineweight in 1/100 mm (one of AutoCAD's standard weights); absent for BYLAYER. */
  lineweight?: number;
}

export interface DxfAttrib {
  tag: string;
  value: string;
  layer: string;
  /** Insertion point in the coordinates of the space the INSERT lies in. */
  p: Pt;
  height: number;
  rotation: number;
}

export type DxfEntity =
  | (Common & { type: "LINE"; a: Pt; b: Pt })
  | (Common & { type: "LWPOLYLINE"; pts: Pt[]; closed: boolean })
  | (Common & { type: "CIRCLE"; c: Pt; r: number })
  | (Common & { type: "ARC"; c: Pt; r: number; start: number; end: number })
  /** `halign`: 0 left, 1 centre, 2 right, 4 middle (both axes) at `p`. */
  | (Common & { type: "TEXT"; p: Pt; height: number; text: string; rotation?: number; halign?: 0 | 1 | 2 | 4 })
  | (Common & { type: "SOLID"; pts: [Pt, Pt, Pt] })
  | (Common & { type: "INSERT"; block: string; p: Pt; rotation: number; attribs: DxfAttrib[] });

/** An attribute definition of a block; its INSERTs carry one ATTRIB per definition. */
export interface DxfAttDef {
  tag: string;
  prompt: string;
  layer: string;
  /** Position in the block's own coordinates. */
  p: Pt;
  height: number;
  /** Invisible attributes are data (for extraction and lists), not drawn. */
  invisible: boolean;
}

export interface DxfBlock {
  name: string;
  entities: DxfEntity[];
  attdefs: DxfAttDef[];
}

export interface DxfLayer {
  name: string;
  /** AutoCAD colour index. */
  color: number;
  ltype: string;
  /** Lineweight in 1/100 mm; -3 for the default. */
  lineweight: number;
}

export interface DxfLinetype {
  name: string;
  description: string;
  /** Dash lengths (positive) and gaps (negative) in drawing units. */
  pattern: number[];
}

export interface DxfDocument {
  /** The drawing's extent in DXF coordinates. */
  extents: { minX: number; minY: number; maxX: number; maxY: number };
  linetypes: DxfLinetype[];
  /** Layer 0 is added in front when missing. */
  layers: DxfLayer[];
  blocks: DxfBlock[];
  /** The entities of the model space, in drawing order. */
  entities: DxfEntity[];
}

/** $INSUNITS value for millimetres. */
export const INSUNITS_MM = 4;

/** Line types every AC1015 file has, whatever it uses. */
const STANDARD_LTYPES: DxfLinetype[] = [
  { name: "BYBLOCK", description: "", pattern: [] },
  { name: "BYLAYER", description: "", pattern: [] },
  { name: "CONTINUOUS", description: "Solid line", pattern: [] },
];

/** A number for DXF: four decimals at most, no exponent, no "-0". */
export function dxfNumber(v: number): string {
  const r = Math.round(v * 10000) / 10000;
  return r === 0 ? "0" : r.toFixed(4).replace(/\.?0+$/, "");
}

/**
 * Text for an AC1015 file: characters above ASCII as \U+XXXX (files before AutoCAD 2007 are not
 * UTF-8; every reader decodes this escape), line breaks as spaces. Characters outside the Basic
 * Multilingual Plane cannot be written and become "?".
 */
export function dxfText(s: string): string {
  let out = "";
  for (const ch of s.replace(/[\r\n\t]+/g, " ")) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 32) continue;
    if (cp <= 127) out += ch;
    else if (cp <= 0xffff) out += `\\U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
    else out += "?";
  }
  return out;
}

class Out {
  readonly lines: string[] = [];

  pair(code: number, value: string | number) {
    this.lines.push(String(code), typeof value === "number" ? dxfNumber(value) : value);
  }

  /** A 3D point: x at `code`, y at `code + 10`, z (0) at `code + 20`. */
  point(code: number, p: Pt) {
    this.pair(code, p.x);
    this.pair(code + 10, p.y);
    this.pair(code + 20, 0);
  }

  /** The persistent reactor of an object owned by a dictionary, then the owner itself. */
  reactorOwner(owner: string) {
    this.pair(102, "{ACAD_REACTORS");
    this.pair(330, owner);
    this.pair(102, "}");
    this.pair(330, owner);
  }
}

/** Hands out handles: hexadecimal, unique, counting from 1. */
class Handles {
  private next = 1;

  take(): string {
    return (this.next++).toString(16).toUpperCase();
  }

  /** The value of $HANDSEED: larger than every handle taken. */
  get seed(): string {
    return this.next.toString(16).toUpperCase();
  }
}

/** The document as an ASCII DXF file, AutoCAD 2000 (AC1015), in millimetres. */
export function writeDxf(doc: DxfDocument): string {
  const hs = new Handles();
  // Objects referenced before they are written get their handles first.
  const H = {
    root: hs.take(),
    groups: hs.take(),
    layouts: hs.take(),
    mlineStyles: hs.take(),
    plotSettings: hs.take(),
    mlineStandard: hs.take(),
    layoutModel: hs.take(),
    layoutPaper: hs.take(),
  };
  const layers = doc.layers.some((l) => l.name === "0") ? doc.layers : [{ name: "0", color: 7, ltype: "CONTINUOUS", lineweight: -3 }, ...doc.layers];
  const linetypes = [...STANDARD_LTYPES, ...doc.linetypes.filter((l) => !STANDARD_LTYPES.some((s) => s.name === l.name))];

  const tables = new Out();
  const records = writeTables(tables, hs, H, doc, layers, linetypes);
  const blocks = new Out();
  writeBlocks(blocks, hs, records, doc.blocks);
  const entities = new Out();
  for (const e of doc.entities) writeEntity(entities, hs, records.modelSpace, e);
  const objects = new Out();
  writeObjects(objects, H, records, doc.extents);

  const header = new Out();
  writeHeader(header, doc.extents, hs.seed);

  const out = new Out();
  section(out, "HEADER", header);
  section(out, "CLASSES", new Out());
  section(out, "TABLES", tables);
  section(out, "BLOCKS", blocks);
  section(out, "ENTITIES", entities);
  section(out, "OBJECTS", objects);
  out.pair(0, "EOF");
  return out.lines.join(EOL) + EOL;
}

function section(out: Out, name: string, body: Out) {
  out.pair(0, "SECTION");
  out.pair(2, name);
  out.lines.push(...body.lines);
  out.pair(0, "ENDSEC");
}

function writeHeader(out: Out, box: DxfDocument["extents"], seed: string) {
  const v = (name: string) => out.pair(9, name);
  v("$ACADVER");
  out.pair(1, "AC1015");
  v("$ACADMAINTVER");
  out.pair(70, 6);
  v("$DWGCODEPAGE");
  out.pair(3, "ANSI_1252");
  v("$INSBASE");
  out.point(10, { x: 0, y: 0 });
  v("$EXTMIN");
  out.point(10, { x: box.minX, y: box.minY });
  v("$EXTMAX");
  out.point(10, { x: box.maxX, y: box.maxY });
  v("$LIMMIN");
  out.pair(10, box.minX);
  out.pair(20, box.minY);
  v("$LIMMAX");
  out.pair(10, box.maxX);
  out.pair(20, box.maxY);
  v("$LTSCALE");
  out.pair(40, 1);
  // Normal: attributes show or hide as each one is set (ours are data, so hidden).
  v("$ATTMODE");
  out.pair(70, 1);
  v("$TEXTSTYLE");
  out.pair(7, "STANDARD");
  v("$CLAYER");
  out.pair(8, "0");
  v("$CELTYPE");
  out.pair(6, "BYLAYER");
  v("$CECOLOR");
  out.pair(62, 256);
  v("$DIMSTYLE");
  out.pair(2, "STANDARD");
  // Decimal lengths in whole millimetres, decimal degrees, metric.
  v("$LUNITS");
  out.pair(70, 2);
  v("$LUPREC");
  out.pair(70, 0);
  v("$AUNITS");
  out.pair(70, 0);
  v("$MEASUREMENT");
  out.pair(70, 1);
  v("$INSUNITS");
  out.pair(70, INSUNITS_MM);
  // Lineweights are part of the drawing (ISO 128 widths per pen); show them.
  v("$LWDISPLAY");
  out.pair(290, 1);
  v("$PSTYLEMODE");
  out.pair(290, 1);
  v("$HANDSEED");
  out.pair(5, seed);
}

interface Records {
  modelSpace: string;
  paperSpace: string;
  /** Block name → handle of its BLOCK_RECORD. */
  blocks: Map<string, string>;
}

type Pre = { layoutModel: string; layoutPaper: string };

function tableHead(out: Out, name: string, handle: string, count: number) {
  out.pair(0, "TABLE");
  out.pair(2, name);
  out.pair(5, handle);
  out.pair(330, "0");
  out.pair(100, "AcDbSymbolTable");
  out.pair(70, count);
}

function record(out: Out, type: string, handle: string, table: string, subclass: string) {
  out.pair(0, type);
  out.pair(5, handle);
  out.pair(330, table);
  out.pair(100, "AcDbSymbolTableRecord");
  out.pair(100, subclass);
}

function endTable(out: Out) {
  out.pair(0, "ENDTAB");
}

function writeTables(out: Out, hs: Handles, pre: Pre, doc: DxfDocument, layers: DxfLayer[], linetypes: DxfLinetype[]): Records {
  // VPORT: the active viewport, zoomed to the drawing so the file opens showing all of it.
  const box = doc.extents;
  const w = Math.max(box.maxX - box.minX, 1);
  const h = Math.max(box.maxY - box.minY, 1);
  let t = hs.take();
  tableHead(out, "VPORT", t, 1);
  record(out, "VPORT", hs.take(), t, "AcDbViewportTableRecord");
  out.pair(2, "*ACTIVE");
  out.pair(70, 0);
  out.pair(10, 0);
  out.pair(20, 0);
  out.pair(11, 1);
  out.pair(21, 1);
  out.pair(12, (box.minX + box.maxX) / 2);
  out.pair(22, (box.minY + box.maxY) / 2);
  out.pair(13, 0);
  out.pair(23, 0);
  out.pair(14, 10);
  out.pair(24, 10);
  out.pair(15, 10);
  out.pair(25, 10);
  out.pair(16, 0);
  out.pair(26, 0);
  out.pair(36, 1);
  out.pair(17, 0);
  out.pair(27, 0);
  out.pair(37, 0);
  out.pair(40, h * 1.1);
  out.pair(41, w / h);
  out.pair(42, 50);
  out.pair(43, 0);
  out.pair(44, 0);
  out.pair(50, 0);
  out.pair(51, 0);
  out.pair(71, 0);
  out.pair(72, 1000);
  out.pair(73, 1);
  out.pair(74, 3);
  out.pair(75, 0);
  out.pair(76, 0);
  out.pair(77, 0);
  out.pair(78, 0);
  out.pair(281, 0);
  out.pair(65, 1);
  out.point(110, { x: 0, y: 0 });
  out.point(111, { x: 1, y: 0 });
  out.point(112, { x: 0, y: 1 });
  out.pair(79, 0);
  out.pair(146, 0);
  endTable(out);

  t = hs.take();
  tableHead(out, "LTYPE", t, linetypes.length);
  for (const lt of linetypes) {
    record(out, "LTYPE", hs.take(), t, "AcDbLinetypeTableRecord");
    out.pair(2, lt.name);
    out.pair(70, 0);
    out.pair(3, lt.description);
    out.pair(72, 65);
    out.pair(73, lt.pattern.length);
    out.pair(40, lt.pattern.reduce((s, e) => s + Math.abs(e), 0));
    for (const e of lt.pattern) {
      out.pair(49, e);
      out.pair(74, 0);
    }
  }
  endTable(out);

  t = hs.take();
  tableHead(out, "LAYER", t, layers.length);
  for (const l of layers) {
    record(out, "LAYER", hs.take(), t, "AcDbLayerTableRecord");
    out.pair(2, l.name);
    out.pair(70, 0);
    out.pair(62, l.color);
    out.pair(6, l.ltype);
    out.pair(370, l.lineweight);
  }
  endTable(out);

  t = hs.take();
  tableHead(out, "STYLE", t, 1);
  record(out, "STYLE", hs.take(), t, "AcDbTextStyleTableRecord");
  out.pair(2, "STANDARD");
  out.pair(70, 0);
  out.pair(40, 0);
  out.pair(41, 1);
  out.pair(50, 0);
  out.pair(71, 0);
  out.pair(42, 2.5);
  out.pair(3, "txt");
  out.pair(4, "");
  endTable(out);

  t = hs.take();
  tableHead(out, "VIEW", t, 0);
  endTable(out);
  t = hs.take();
  tableHead(out, "UCS", t, 0);
  endTable(out);

  t = hs.take();
  tableHead(out, "APPID", t, 1);
  record(out, "APPID", hs.take(), t, "AcDbRegAppTableRecord");
  out.pair(2, "ACAD");
  out.pair(70, 0);
  endTable(out);

  // DIMSTYLE: the table lists its records' handles, and a record's own handle is group 105.
  t = hs.take();
  const standardDim = hs.take();
  tableHead(out, "DIMSTYLE", t, 1);
  out.pair(100, "AcDbDimStyleTable");
  out.pair(71, 1);
  out.pair(340, standardDim);
  out.pair(0, "DIMSTYLE");
  out.pair(105, standardDim);
  out.pair(330, t);
  out.pair(100, "AcDbSymbolTableRecord");
  out.pair(100, "AcDbDimStyleTableRecord");
  out.pair(2, "STANDARD");
  out.pair(70, 0);
  endTable(out);

  t = hs.take();
  const names = ["*Model_Space", "*Paper_Space", ...doc.blocks.map((b) => b.name)];
  tableHead(out, "BLOCK_RECORD", t, names.length);
  const handles = new Map<string, string>();
  for (const name of names) {
    const handle = hs.take();
    handles.set(name, handle);
    record(out, "BLOCK_RECORD", handle, t, "AcDbBlockTableRecord");
    out.pair(2, name);
    out.pair(340, name === "*Model_Space" ? pre.layoutModel : name === "*Paper_Space" ? pre.layoutPaper : "0");
  }
  endTable(out);

  const blocks = new Map(doc.blocks.map((b) => [b.name, handles.get(b.name)!]));
  return { modelSpace: handles.get("*Model_Space")!, paperSpace: handles.get("*Paper_Space")!, blocks };
}

function blockBegin(out: Out, hs: Handles, owner: string, name: string, flags: number, paper = false) {
  out.pair(0, "BLOCK");
  out.pair(5, hs.take());
  out.pair(330, owner);
  out.pair(100, "AcDbEntity");
  if (paper) out.pair(67, 1);
  out.pair(8, "0");
  out.pair(100, "AcDbBlockBegin");
  out.pair(2, name);
  out.pair(70, flags);
  out.point(10, { x: 0, y: 0 });
  out.pair(3, name);
  out.pair(1, "");
}

function blockEnd(out: Out, hs: Handles, owner: string, paper = false) {
  out.pair(0, "ENDBLK");
  out.pair(5, hs.take());
  out.pair(330, owner);
  out.pair(100, "AcDbEntity");
  if (paper) out.pair(67, 1);
  out.pair(8, "0");
  out.pair(100, "AcDbBlockEnd");
}

/** Block flag: the block has attribute definitions. */
const BLOCK_HAS_ATTRIBUTES = 2;
/** Attribute flag: not drawn. */
const ATTRIB_INVISIBLE = 1;

function writeBlocks(out: Out, hs: Handles, records: Records, blocks: DxfBlock[]) {
  blockBegin(out, hs, records.modelSpace, "*Model_Space", 0);
  blockEnd(out, hs, records.modelSpace);
  blockBegin(out, hs, records.paperSpace, "*Paper_Space", 0, true);
  blockEnd(out, hs, records.paperSpace, true);
  for (const b of blocks) {
    const owner = records.blocks.get(b.name)!;
    blockBegin(out, hs, owner, b.name, b.attdefs.length > 0 ? BLOCK_HAS_ATTRIBUTES : 0);
    for (const e of b.entities) writeEntity(out, hs, owner, e);
    for (const a of b.attdefs) {
      entityHead(out, hs.take(), owner, "ATTDEF", { layer: a.layer });
      out.pair(100, "AcDbText");
      out.point(10, a.p);
      out.pair(40, a.height);
      out.pair(1, "");
      out.pair(7, "STANDARD");
      out.pair(100, "AcDbAttributeDefinition");
      out.pair(3, dxfText(a.prompt));
      out.pair(2, a.tag);
      out.pair(70, a.invisible ? ATTRIB_INVISIBLE : 0);
      out.pair(73, 0);
    }
    blockEnd(out, hs, owner);
  }
}

function entityHead(out: Out, handle: string, owner: string, type: string, c: Common) {
  out.pair(0, type);
  out.pair(5, handle);
  out.pair(330, owner);
  out.pair(100, "AcDbEntity");
  out.pair(8, c.layer);
  if (c.ltype) out.pair(6, c.ltype);
  if (c.lineweight !== undefined) out.pair(370, c.lineweight);
}

function writeEntity(out: Out, hs: Handles, owner: string, e: DxfEntity) {
  const handle = hs.take();
  entityHead(out, handle, owner, e.type, e);
  switch (e.type) {
    case "LINE":
      out.pair(100, "AcDbLine");
      out.point(10, e.a);
      out.point(11, e.b);
      return;
    case "LWPOLYLINE":
      out.pair(100, "AcDbPolyline");
      out.pair(90, e.pts.length);
      out.pair(70, e.closed ? 1 : 0);
      for (const p of e.pts) {
        out.pair(10, p.x);
        out.pair(20, p.y);
      }
      return;
    case "CIRCLE":
      out.pair(100, "AcDbCircle");
      out.point(10, e.c);
      out.pair(40, e.r);
      return;
    case "ARC":
      out.pair(100, "AcDbCircle");
      out.point(10, e.c);
      out.pair(40, e.r);
      out.pair(100, "AcDbArc");
      out.pair(50, e.start);
      out.pair(51, e.end);
      return;
    case "TEXT": {
      out.pair(100, "AcDbText");
      out.point(10, e.p);
      out.pair(40, e.height);
      out.pair(1, dxfText(e.text));
      if (e.rotation) out.pair(50, e.rotation);
      out.pair(7, "STANDARD");
      const just = e.halign ?? 0;
      // Aligned text is placed at its alignment point (11); 10 is recomputed by the reader.
      if (just !== 0) {
        out.pair(72, just);
        out.point(11, e.p);
      }
      out.pair(100, "AcDbText");
      return;
    }
    case "SOLID": {
      const [a, b, c] = e.pts;
      out.pair(100, "AcDbTrace");
      out.point(10, a);
      out.point(11, b);
      out.point(12, c);
      // A triangle repeats its last corner as the fourth.
      out.point(13, c);
      return;
    }
    case "INSERT":
      out.pair(100, "AcDbBlockReference");
      if (e.attribs.length > 0) out.pair(66, 1);
      out.pair(2, e.block);
      out.point(10, e.p);
      if (e.rotation) out.pair(50, e.rotation);
      if (e.attribs.length === 0) return;
      for (const a of e.attribs) {
        entityHead(out, hs.take(), handle, "ATTRIB", { layer: a.layer });
        out.pair(100, "AcDbText");
        out.point(10, a.p);
        out.pair(40, a.height);
        out.pair(1, dxfText(a.value));
        if (a.rotation) out.pair(50, a.rotation);
        out.pair(7, "STANDARD");
        out.pair(100, "AcDbAttribute");
        out.pair(2, a.tag);
        out.pair(70, ATTRIB_INVISIBLE);
        out.pair(73, 0);
      }
      entityHead(out, hs.take(), handle, "SEQEND", { layer: e.layer });
      return;
  }
}

function dictionary(out: Out, handle: string, owner: string, entries: [string, string][], ownedByDictionary: boolean) {
  out.pair(0, "DICTIONARY");
  out.pair(5, handle);
  if (ownedByDictionary) out.reactorOwner(owner);
  else out.pair(330, owner);
  out.pair(100, "AcDbDictionary");
  out.pair(281, 1);
  for (const [name, h] of entries) {
    out.pair(3, name);
    out.pair(350, h);
  }
}

/** Plot type "layout", paper in millimetres, A3 landscape for the paper space layout. */
function layout(out: Out, handle: string, owner: string, name: string, tab: number, flags: number, blockRecord: string, box: DxfDocument["extents"]) {
  out.pair(0, "LAYOUT");
  out.pair(5, handle);
  out.reactorOwner(owner);
  out.pair(100, "AcDbPlotSettings");
  out.pair(1, "");
  out.pair(2, "none_device");
  out.pair(4, "");
  out.pair(6, "");
  for (const code of [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 140, 141]) out.pair(code, 0);
  out.pair(142, 1);
  out.pair(143, 1);
  out.pair(70, flags);
  out.pair(72, 1);
  out.pair(73, 0);
  out.pair(74, 5);
  out.pair(7, "");
  out.pair(75, 16);
  out.pair(147, 1);
  out.pair(100, "AcDbLayout");
  out.pair(1, name);
  out.pair(70, 1);
  out.pair(71, tab);
  out.pair(10, 0);
  out.pair(20, 0);
  out.pair(11, 420);
  out.pair(21, 297);
  out.point(12, { x: 0, y: 0 });
  out.point(14, { x: box.minX, y: box.minY });
  out.point(15, { x: box.maxX, y: box.maxY });
  out.pair(146, 0);
  out.point(13, { x: 0, y: 0 });
  out.point(16, { x: 1, y: 0 });
  out.point(17, { x: 0, y: 1 });
  out.pair(76, 0);
  out.pair(330, blockRecord);
}

function writeObjects(out: Out, H: Pre & Record<"root" | "groups" | "layouts" | "mlineStyles" | "plotSettings" | "mlineStandard", string>, records: Records, box: DxfDocument["extents"]) {
  dictionary(
    out,
    H.root,
    "0",
    [
      ["ACAD_GROUP", H.groups],
      ["ACAD_LAYOUT", H.layouts],
      ["ACAD_MLINESTYLE", H.mlineStyles],
      ["ACAD_PLOTSETTINGS", H.plotSettings],
    ],
    false,
  );
  dictionary(out, H.groups, H.root, [], true);
  dictionary(
    out,
    H.layouts,
    H.root,
    [
      ["Layout1", H.layoutPaper],
      ["Model", H.layoutModel],
    ],
    true,
  );
  dictionary(out, H.mlineStyles, H.root, [["Standard", H.mlineStandard]], true);
  dictionary(out, H.plotSettings, H.root, [], true);

  out.pair(0, "MLINESTYLE");
  out.pair(5, H.mlineStandard);
  out.reactorOwner(H.mlineStyles);
  out.pair(100, "AcDbMlineStyle");
  out.pair(2, "Standard");
  out.pair(70, 0);
  out.pair(3, "");
  out.pair(62, 256);
  out.pair(51, 90);
  out.pair(52, 90);
  out.pair(71, 2);
  for (const offset of [0.5, -0.5]) {
    out.pair(49, offset);
    out.pair(62, 256);
    out.pair(6, "BYLAYER");
  }

  // Plot layout flags as AutoCAD sets them for a new model and paper space.
  layout(out, H.layoutModel, H.layouts, "Model", 0, 1712, records.modelSpace, box);
  layout(out, H.layoutPaper, H.layouts, "Layout1", 1, 688, records.paperSpace, box);
}
