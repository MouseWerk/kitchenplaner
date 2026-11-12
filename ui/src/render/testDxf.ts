// A small DXF reader and checker for the tests of the DXF export: it splits the file into its
// sections and objects and checks what makes CAD programs open an AutoCAD 2000 file without
// repair: group codes and value types, unique handles below $HANDSEED, owners and pointers that
// exist, table counts, every referenced layer, line type, text style and block defined, and
// attributes that match their block's definitions. Only what dxfWriter.ts writes; not for use
// in the app.

export type Pair = [number, string];

export interface DxfObject {
  type: string;
  tags: Pair[];
}

export interface ReadDxf {
  /** The header variables with their value pairs. */
  header: Map<string, Pair[]>;
  /** The objects of each section (TABLES, BLOCKS, ENTITIES, OBJECTS, ...), in file order. */
  sections: Map<string, DxfObject[]>;
}

export const val = (tags: readonly Pair[], code: number) => tags.find(([c]) => c === code)?.[1];
export const vals = (tags: readonly Pair[], code: number) => tags.filter(([c]) => c === code).map(([, v]) => v);

/** The group code / value pairs; throws on a malformed file (odd line count, bad code, LF only). */
export function pairs(dxf: string): Pair[] {
  if (/[^\r]\n/.test(dxf)) throw new Error("line break without CR");
  const lines = dxf.split("\r\n");
  if (lines.at(-1) !== "") throw new Error("no final line break");
  lines.pop();
  if (lines.length % 2 !== 0) throw new Error("odd number of lines");
  const out: Pair[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    if (!/^\d{1,4}$/.test(lines[i])) throw new Error(`bad group code "${lines[i]}" at line ${i + 1}`);
    out.push([Number(lines[i]), lines[i + 1]]);
  }
  return out;
}

export function readDxf(dxf: string): ReadDxf {
  const ps = pairs(dxf);
  const header = new Map<string, Pair[]>();
  const sections = new Map<string, DxfObject[]>();
  let i = 0;
  const expect = (code: number, value?: string) => {
    const [c, v] = ps[i] ?? [];
    if (c !== code || (value !== undefined && v !== value)) throw new Error(`expected ${code} ${value ?? ""} at pair ${i}, got ${c} ${v}`);
    i++;
    return v;
  };
  while (i < ps.length && !(ps[i][0] === 0 && ps[i][1] === "EOF")) {
    expect(0, "SECTION");
    const name = expect(2)!;
    const objects: DxfObject[] = [];
    if (name === "HEADER") {
      while (!(ps[i][0] === 0 && ps[i][1] === "ENDSEC")) {
        const v = expect(9)!;
        const tags: Pair[] = [];
        while (ps[i][0] !== 9 && ps[i][0] !== 0) tags.push(ps[i++]);
        header.set(v, tags);
      }
    } else {
      while (!(ps[i][0] === 0 && ps[i][1] === "ENDSEC")) {
        const type = expect(0)!;
        const tags: Pair[] = [];
        while (ps[i][0] !== 0) tags.push(ps[i++]);
        objects.push({ type, tags });
      }
    }
    expect(0, "ENDSEC");
    sections.set(name, objects);
  }
  expect(0, "EOF");
  if (i !== ps.length) throw new Error("data after EOF");
  return { header, sections };
}

/** The value type a group code demands (DXF reference, "Group code value types"). */
function typeOf(code: number): "string" | "float" | "int" | "bool" | "handle" {
  if (code <= 9) return code === 5 ? "handle" : "string";
  if (code < 60) return "float";
  if (code < 100) return "int";
  if (code === 105) return "handle";
  if (code >= 110 && code < 150) return "float";
  if (code >= 170 && code < 180) return "int";
  if (code >= 210 && code < 240) return "float";
  if (code >= 270 && code < 290) return "int";
  if (code >= 290 && code < 300) return "bool";
  if (code >= 320 && code < 370) return "handle";
  if (code >= 370 && code < 390) return "int";
  if (code >= 390 && code < 400) return "handle";
  return "string";
}

const HEX = /^[0-9A-F]+$/;

/** Everything wrong with an AC1015 file as these exports write it; empty when it is valid. */
export function checkDxf(dxf: string): string[] {
  const problems: string[] = [];
  for (const [code, v] of pairs(dxf)) {
    const t = typeOf(code);
    if (t === "float" && !/^-?\d+(\.\d+)?$/.test(v)) problems.push(`code ${code}: "${v}" is not a number`);
    if (t === "int" && !/^-?\d+$/.test(v)) problems.push(`code ${code}: "${v}" is not an integer`);
    if (t === "bool" && v !== "0" && v !== "1") problems.push(`code ${code}: "${v}" is not 0 or 1`);
    if (t === "handle" && !HEX.test(v)) problems.push(`code ${code}: "${v}" is not a handle`);
    if (t === "string" && /[^\x20-\x7e]/.test(v)) problems.push(`code ${code}: "${v}" has characters outside printable ASCII`);
  }
  const doc = readDxf(dxf);
  const names = [...doc.sections.keys()];
  if (names.join() !== "HEADER,CLASSES,TABLES,BLOCKS,ENTITIES,OBJECTS") problems.push(`sections ${names.join()}`);
  if (val(doc.header.get("$ACADVER") ?? [], 1) !== "AC1015") problems.push("not AC1015");

  // Handles: every object but ENDTAB has one, all unique, all below $HANDSEED.
  const all = [...doc.sections.values()].flat();
  const handles = new Map<string, DxfObject>();
  for (const o of all) {
    if (o.type === "ENDTAB") continue;
    const h = val(o.tags, o.type === "DIMSTYLE" ? 105 : 5);
    if (!h) {
      problems.push(`${o.type} without handle`);
      continue;
    }
    if (handles.has(h)) problems.push(`handle ${h} used twice`);
    handles.set(h, o);
  }
  const seed = parseInt(val(doc.header.get("$HANDSEED") ?? [], 5) ?? "0", 16);
  for (const h of handles.keys()) if (parseInt(h, 16) >= seed) problems.push(`handle ${h} not below $HANDSEED`);

  // Owners and pointers reach existing objects.
  for (const o of all) {
    for (const [code, v] of o.tags) {
      if ((code === 330 || code === 340 || code === 350) && v !== "0" && !handles.has(v)) problems.push(`${o.type}: pointer ${code} to missing ${v}`);
    }
    if (o.type !== "ENDTAB" && !o.tags.some(([c]) => c === 330)) problems.push(`${o.type} without owner`);
  }

  // Tables: their counts, and the names entities refer to.
  const tables = doc.sections.get("TABLES") ?? [];
  const records = new Map<string, Set<string>>();
  for (let i = 0; i < tables.length; i++) {
    if (tables[i].type !== "TABLE") continue;
    const kind = val(tables[i].tags, 2)!;
    const owner = val(tables[i].tags, 5);
    const set = new Set<string>();
    let j = i + 1;
    for (; tables[j].type !== "ENDTAB"; j++) {
      if (tables[j].type !== kind) problems.push(`${tables[j].type} inside table ${kind}`);
      if (val(tables[j].tags, 330) !== owner) problems.push(`${kind} ${val(tables[j].tags, 2)} not owned by its table`);
      set.add(val(tables[j].tags, 2)!);
    }
    if (Number(val(tables[i].tags, 70)) !== set.size) problems.push(`table ${kind} counts ${val(tables[i].tags, 70)}, has ${set.size}`);
    records.set(kind, set);
  }
  for (const kind of ["VPORT", "LTYPE", "LAYER", "STYLE", "VIEW", "UCS", "APPID", "DIMSTYLE", "BLOCK_RECORD"]) if (!records.has(kind)) problems.push(`no table ${kind}`);
  const has = (kind: string, name: string) => records.get(kind)?.has(name) ?? false;
  for (const name of ["BYBLOCK", "BYLAYER", "CONTINUOUS"]) if (!has("LTYPE", name)) problems.push(`no line type ${name}`);
  if (!has("LAYER", "0")) problems.push("no layer 0");
  if (!has("APPID", "ACAD")) problems.push("no application ACAD");
  for (const o of tables.filter((t) => t.type === "LAYER")) if (!has("LTYPE", val(o.tags, 6)!)) problems.push(`layer ${val(o.tags, 2)}: no line type ${val(o.tags, 6)}`);

  // Blocks: one BLOCK ... ENDBLK per block record, its entities owned by the record.
  const recordHandle = new Map((tables.filter((t) => t.type === "BLOCK_RECORD")).map((r) => [val(r.tags, 2)!, val(r.tags, 5)!]));
  const blocks = doc.sections.get("BLOCKS") ?? [];
  const attdefTags = new Map<string, string[]>();
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type !== "BLOCK") continue;
    const name = val(blocks[i].tags, 2)!;
    const owner = recordHandle.get(name);
    if (!owner) problems.push(`block ${name} without record`);
    const tags: string[] = [];
    let j = i;
    for (; blocks[j].type !== "ENDBLK"; j++) {
      if (val(blocks[j].tags, 330) !== owner) problems.push(`${blocks[j].type} in block ${name} not owned by its record`);
      if (blocks[j].type === "ATTDEF") tags.push(val(blocks[j].tags, 2)!);
    }
    if (val(blocks[j].tags, 330) !== owner) problems.push(`ENDBLK of ${name} not owned by its record`);
    if ((Number(val(blocks[i].tags, 70)) & 2) !== (tags.length > 0 ? 2 : 0)) problems.push(`block ${name}: attribute flag does not match`);
    attdefTags.set(name, tags);
  }
  for (const name of recordHandle.keys()) if (!attdefTags.has(name)) problems.push(`record ${name} without block`);

  // Entities: layers, line types, styles and blocks exist; model space entities are owned by it;
  // an INSERT's attributes follow it, match its block's definitions and end with a SEQEND.
  const drawn = [...blocks.filter((o) => o.type !== "BLOCK" && o.type !== "ENDBLK"), ...(doc.sections.get("ENTITIES") ?? [])];
  for (const o of drawn) {
    const layer = val(o.tags, 8);
    if (layer === undefined || !has("LAYER", layer)) problems.push(`${o.type} on missing layer ${layer}`);
    const lt = val(o.tags, 6);
    if (lt !== undefined && !has("LTYPE", lt)) problems.push(`${o.type} with missing line type ${lt}`);
    const st = val(o.tags, 7);
    if (st !== undefined && !has("STYLE", st)) problems.push(`${o.type} with missing style ${st}`);
  }
  const ents = doc.sections.get("ENTITIES") ?? [];
  const model = recordHandle.get("*Model_Space");
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.type === "ATTRIB" || e.type === "SEQEND") continue;
    if (val(e.tags, 330) !== model) problems.push(`${e.type} not owned by the model space`);
    if (e.type !== "INSERT") continue;
    const block = val(e.tags, 2)!;
    if (!has("BLOCK_RECORD", block)) problems.push(`INSERT of missing block ${block}`);
    if (val(e.tags, 66) !== "1") continue;
    const h = val(e.tags, 5);
    const tags: string[] = [];
    let j = i + 1;
    for (; j < ents.length && ents[j].type === "ATTRIB"; j++) {
      if (val(ents[j].tags, 330) !== h) problems.push(`ATTRIB not owned by its INSERT ${h}`);
      tags.push(val(ents[j].tags, 2)!);
    }
    if (ents[j]?.type !== "SEQEND" || val(ents[j].tags, 330) !== h) problems.push(`INSERT ${h} without SEQEND`);
    if (tags.join() !== (attdefTags.get(block) ?? []).join()) problems.push(`INSERT ${h}: attributes ${tags.join()} do not match block ${block}`);
    i = j;
  }

  // Objects: the root dictionary first, owned by nobody, with the layouts of both spaces.
  const objects = doc.sections.get("OBJECTS") ?? [];
  if (objects[0]?.type !== "DICTIONARY" || val(objects[0].tags, 330) !== "0") problems.push("OBJECTS does not start with the root dictionary");
  const layouts = objects.filter((o) => o.type === "LAYOUT");
  for (const space of ["*Model_Space", "*Paper_Space"]) {
    const rec = tables.find((t) => t.type === "BLOCK_RECORD" && val(t.tags, 2) === space);
    const layout = layouts.find((l) => vals(l.tags, 330).includes(recordHandle.get(space)!));
    if (!rec || !layout || val(rec.tags, 340) !== val(layout.tags, 5)) problems.push(`${space} and its layout do not point at each other`);
  }
  return problems;
}

/** Decodes the \U+XXXX escapes of a DXF string. */
export function undxf(s: string): string {
  return s.replace(/\\U\+([0-9A-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

export interface ReadInsert {
  handle: string;
  block: string;
  layer: string;
  x: number;
  y: number;
  rotation: number;
  /** Tag → decoded value. */
  attribs: Map<string, string>;
}

/** The block references of the model space with their attributes. */
export function inserts(doc: ReadDxf): ReadInsert[] {
  const ents = doc.sections.get("ENTITIES") ?? [];
  const out: ReadInsert[] = [];
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.type !== "INSERT") continue;
    const attribs = new Map<string, string>();
    for (let j = i + 1; ents[j]?.type === "ATTRIB"; j++) attribs.set(val(ents[j].tags, 2)!, undxf(val(ents[j].tags, 1) ?? ""));
    out.push({
      handle: val(e.tags, 5)!,
      block: val(e.tags, 2)!,
      layer: val(e.tags, 8)!,
      x: Number(val(e.tags, 10)),
      y: Number(val(e.tags, 20)),
      rotation: Number(val(e.tags, 50) ?? 0),
      attribs,
    });
  }
  return out;
}

/** The entities of each named block (without BLOCK, ENDBLK and ATTDEF). */
export function blockEntities(doc: ReadDxf): Map<string, DxfObject[]> {
  const out = new Map<string, DxfObject[]>();
  let current: DxfObject[] | null = null;
  for (const o of doc.sections.get("BLOCKS") ?? []) {
    if (o.type === "BLOCK") {
      current = [];
      out.set(val(o.tags, 2)!, current);
    } else if (o.type === "ENDBLK") current = null;
    else if (o.type !== "ATTDEF") current?.push(o);
  }
  return out;
}

/** The model space entities of a type (ATTRIB and SEQEND included when asked for). */
export function entities(doc: ReadDxf, type: string): Pair[][] {
  return (doc.sections.get("ENTITIES") ?? []).filter((o) => o.type === type).map((o) => o.tags);
}
