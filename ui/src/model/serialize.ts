// Project files: pretty JSON with a fixed key order (readable diffs, stable files), and a strict
// parser that turns anything read from disk into a valid Project or a ProjectError.

import { catalogEntry } from "../kinds/registry";
import { clampOpening, MAX_LENGTH } from "./geometry";
import { clampPartitionOpening, MAX_PARTITION_THICKNESS, MIN_PARTITION_THICKNESS } from "./partitions";
import { DEFAULT_SETTINGS, FORMAT_VERSION, MAX_SIMULTANEITY, MIN_SIMULTANEITY, newId, repairPositions } from "./project";
import { COINCIDENT_DISTANCE, isUsableOutline, removeCoincidentCorners } from "./roomEdit";
import { ENERGIES, type Connections, type DoorHinge, type DoorSwing, type Energy, type Item, type ItemSpec, type Opening, type OpeningKind, type Partition, type Project, type ProjectInfo, type ProjectSettings, type Room, type Vec2 } from "./types";
import { t, type TKey } from "../lib/i18n";

const FORMAT_ID = "kitchenplaner";

/** Defaults for a room that lacks them (the values of a new project). */
const DEFAULT_ROOM_HEIGHT = 3000;
const DEFAULT_WALL_THICKNESS = 240;

const OPENING_KINDS: readonly OpeningKind[] = ["door", "slidingDoor", "window", "passage", "hatch"];
const HINGES: readonly DoorHinge[] = ["start", "end"];
const SWINGS: readonly DoorSwing[] = ["in", "out"];
const LEAVES: readonly (1 | 2)[] = [1, 2];
/** Text fields of an item's product, in file order. */
const SPEC_TEXTS = ["manufacturer", "model", "article"] as const;
const CONNECTION_NUMBERS = ["electricKw", "voltage", "gasKw", "exhaustM3h"] as const;
const CONNECTION_FLAGS = ["coldWater", "hotWater", "drain", "floorDrain"] as const;
/** Key order of connections in the file. */
const CONNECTION_ORDER: readonly (keyof Connections)[] = ["electricKw", "voltage", "gasKw", "coldWater", "hotWater", "drain", "floorDrain", "exhaustM3h"];

/** A project file that cannot be opened; `key` is the message for the user, `detail` for logs. */
export class ProjectError extends Error {
  readonly key: TKey;
  readonly detail: string;

  constructor(key: TKey, detail = "") {
    super(detail ? `${key}: ${detail}` : key);
    this.name = "ProjectError";
    this.key = key;
    this.detail = detail;
  }
}

/** The file content of a project: 2-space JSON in a fixed key order, ending with a newline. */
export function serializeProject(p: Project): string {
  const doc = {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
    info: {
      name: p.info.name,
      client: p.info.client,
      author: p.info.author,
      date: p.info.date,
      ...(p.info.drawingNo !== undefined ? { drawingNo: p.info.drawingNo } : {}),
      ...(p.info.revision !== undefined ? { revision: p.info.revision } : {}),
    },
    settings: { simultaneity: p.settings.simultaneity },
    room: {
      points: p.room.points.map((q) => ({ x: q.x, y: q.y })),
      height: p.room.height,
      wallThickness: p.room.wallThickness,
      openings: p.room.openings.map((o) => ({
        id: o.id,
        kind: o.kind,
        wall: o.wall,
        ...(o.partition !== undefined ? { partition: o.partition } : {}),
        offset: o.offset,
        width: o.width,
        height: o.height,
        sill: o.sill,
        ...(o.hinge !== undefined ? { hinge: o.hinge } : {}),
        ...(o.swing !== undefined ? { swing: o.swing } : {}),
        ...(o.leaves !== undefined ? { leaves: o.leaves } : {}),
      })),
      partitions: p.room.partitions.map((q) => ({ id: q.id, a: { x: q.a.x, y: q.a.y }, b: { x: q.b.x, y: q.b.y }, thickness: q.thickness, height: q.height })),
    },
    items: p.items.map((it) => {
      const connections: Record<string, number | boolean> = {};
      for (const k of CONNECTION_ORDER) {
        const v = it.connections[k];
        if (v !== undefined) connections[k] = v;
      }
      const spec: ItemSpec = {};
      for (const k of SPEC_TEXTS) if (it.spec?.[k] !== undefined) spec[k] = it.spec[k];
      if (it.spec?.price !== undefined) spec.price = it.spec.price;
      return {
        id: it.id,
        pos: it.pos,
        catalogId: it.catalogId,
        name: it.name,
        x: it.x,
        y: it.y,
        rotation: it.rotation,
        width: it.width,
        depth: it.depth,
        height: it.height,
        elevation: it.elevation,
        connections,
        ...(it.energy !== undefined ? { energy: it.energy } : {}),
        ...(Object.keys(spec).length > 0 ? { spec } : {}),
        ...(it.note !== undefined ? { note: it.note } : {}),
      };
    }),
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

/**
 * Reads a project file. Throws a ProjectError with `error.notProject` for anything that is not a
 * Kitchenplaner file, `error.tooNew` for a newer format version and `error.invalid` for a
 * damaged one. Unknown fields are dropped, missing optional ones get defaults, duplicate ids
 * are replaced by new ones, and unknown catalog ids are kept (they draw as a table).
 *
 * Versions: 1 has no partitions (read as none); 2 adds `room.partitions`, openings in a
 * partition (`partition`) and the opening kind "hatch". An item's optional `energy` ("electric" or
 * "gas") needs no new version: older builds drop it and draw the default variant. 3 adds the
 * stable position number `pos` of every item, its product `spec`, the opening kind "slidingDoor"
 * and a door's `hinge`, `swing` and `leaves`, `info.drawingNo` and `info.revision`, and
 * `settings.simultaneity`. Older files get the position numbers of their list order (what they
 * showed) and the simultaneity 1 (their totals stay the plain sums). Position numbers that are
 * not whole numbers >= 1 or repeat one before them are renumbered (`repairPositions`).
 */
export function parseProject(text: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    throw new ProjectError("error.notProject", `not JSON: ${(e as Error).message}`);
  }
  if (!isObject(raw) || raw.format !== FORMAT_ID) throw new ProjectError("error.notProject", "missing format id");
  const version = raw.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) invalid("version", version);
  if (version > FORMAT_VERSION) throw new ProjectError("error.tooNew", `version ${version}, this build reads up to ${FORMAT_VERSION}`);

  const room = parseRoom(raw.room);
  const itemsRaw = raw.items ?? [];
  if (!Array.isArray(itemsRaw)) invalid("items", itemsRaw);
  const items = itemsRaw.map((v, i) => parseItem(v, `items[${i}]`, version >= 3 ? undefined : i + 1));

  // Ids must be unique across partitions, openings and items: selection and hit testing rely on
  // them. Partitions go first and keep their ids, so an opening referring to a duplicated id
  // stays in the first partition of that id (the one `parseRoom` placed it in).
  const seen = new Set<string>();
  const unique = <T extends { id: string }>(x: T): T => {
    let id = x.id;
    while (id === "" || seen.has(id)) id = newId();
    seen.add(id);
    return id === x.id ? x : { ...x, id };
  };
  room.partitions = room.partitions.map(unique);
  room.openings = room.openings.map(unique);

  return {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
    info: parseInfo(raw.info),
    room,
    items: repairPositions(items.map(unique)),
    settings: parseSettings(raw.settings),
  };
}

function invalid(path: string, value: unknown): never {
  let shown: string;
  try {
    shown = JSON.stringify(value) ?? String(value);
  } catch {
    shown = String(value);
  }
  throw new ProjectError("error.invalid", `${path}: ${shown.slice(0, 80)}`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, path: string, fallback?: string): string {
  if (v === undefined && fallback !== undefined) return fallback;
  if (typeof v !== "string") invalid(path, v);
  return v;
}

/**
 * "size" and "distance" are lengths in mm: positive or at least 0, and at most MAX_LENGTH, so a
 * damaged file cannot open with a 10 km table.
 */
type NumRule = "any" | "positive" | "nonNegative" | "size" | "distance";

function num(v: unknown, path: string, rule: NumRule, fallback?: number): number {
  if (v === undefined && fallback !== undefined) return fallback;
  if (typeof v !== "number" || !Number.isFinite(v)) invalid(path, v);
  if ((rule === "positive" || rule === "size") && !(v > 0)) invalid(path, v);
  if ((rule === "nonNegative" || rule === "distance") && !(v >= 0)) invalid(path, v);
  if ((rule === "size" || rule === "distance") && v > MAX_LENGTH) invalid(path, v);
  return v;
}

function parseInfo(v: unknown): ProjectInfo {
  const o = v === undefined ? {} : v;
  if (!isObject(o)) invalid("info", v);
  return {
    name: str(o.name, "info.name", t("app.untitled")),
    client: str(o.client, "info.client", ""),
    author: str(o.author, "info.author", ""),
    date: str(o.date, "info.date", ""),
    ...(o.drawingNo !== undefined ? { drawingNo: str(o.drawingNo, "info.drawingNo") } : {}),
    ...(o.revision !== undefined ? { revision: str(o.revision, "info.revision") } : {}),
  };
}

function parseSettings(v: unknown): ProjectSettings {
  if (v === undefined) return { ...DEFAULT_SETTINGS };
  if (!isObject(v)) invalid("settings", v);
  const simultaneity = num(v.simultaneity, "settings.simultaneity", "positive", DEFAULT_SETTINGS.simultaneity);
  if (simultaneity < MIN_SIMULTANEITY || simultaneity > MAX_SIMULTANEITY) invalid("settings.simultaneity", simultaneity);
  return { simultaneity };
}

/** A value that must be one of `allowed`; absent stays absent. */
function oneOf<T>(v: unknown, path: string, allowed: readonly T[]): T | undefined {
  if (v === undefined) return undefined;
  if (!allowed.includes(v as T)) invalid(path, v);
  return v as T;
}

function parseRoom(v: unknown): Room {
  if (!isObject(v)) invalid("room", v);
  if (!Array.isArray(v.points) || v.points.length < 3) invalid("room.points", v.points);
  const points = v.points.map((p, i): Vec2 => parsePoint(p, `room.points[${i}]`));
  const partitionsRaw = v.partitions ?? [];
  if (!Array.isArray(partitionsRaw)) invalid("room.partitions", partitionsRaw);
  const partitions = partitionsRaw.map((p, i) => parsePartition(p, `room.partitions[${i}]`));
  const openingsRaw = v.openings ?? [];
  if (!Array.isArray(openingsRaw)) invalid("room.openings", openingsRaw);
  // Each opening remembers its place in the file, so the list keeps its order below.
  type Ordered = Opening & { order: number };
  const openings: Ordered[] = openingsRaw.map((o, i) => ({ ...parseOpening(o, `room.openings[${i}]`, points.length), order: i }));
  // A corner repeated on the spot leaves a zero-length wall that snapping and drawing cannot
  // use; a room without a floor area cannot be edited at all. Openings in a partition do not
  // depend on the outline and stay out of that repair.
  const room = removeCoincidentCorners({
    points,
    height: num(v.height, "room.height", "size", DEFAULT_ROOM_HEIGHT),
    wallThickness: num(v.wallThickness, "room.wallThickness", "size", DEFAULT_WALL_THICKNESS),
    partitions,
    openings: openings.filter((o) => o.partition === undefined),
  });
  if (!isUsableOutline(room.points)) invalid("room.points", v.points);
  // Openings sit inside their wall, as the editor keeps them. One in a partition that does not
  // exist (a hand-edited file) has no place to go and is dropped, like one on a zero-length
  // wall; the first partition of an id is the one that keeps it (a partition without an id
  // gets a new one, so nothing can refer to it).
  const byId = new Map<string, Partition>();
  for (const p of partitions) if (p.id !== "" && !byId.has(p.id)) byId.set(p.id, p);
  const placed: Ordered[] = (room.openings as Ordered[]).map((o) => ({ ...clampOpening(room, o), order: o.order }));
  for (const o of openings) {
    const host = o.partition === undefined ? undefined : byId.get(o.partition);
    if (host) placed.push({ ...clampPartitionOpening(host, o), order: o.order });
  }
  placed.sort((x, y) => x.order - y.order);
  return { ...room, openings: placed.map(({ order: _, ...o }) => o) };
}

function parsePoint(p: unknown, path: string): Vec2 {
  if (!isObject(p)) invalid(path, p);
  return { x: num(p.x, `${path}.x`, "any"), y: num(p.y, `${path}.y`, "any") };
}

function parsePartition(v: unknown, path: string): Partition {
  if (!isObject(v)) invalid(path, v);
  const a = parsePoint(v.a, `${path}.a`);
  const b = parsePoint(v.b, `${path}.b`);
  // A partition needs a direction (both ends apart) and a length the app can draw.
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(length >= COINCIDENT_DISTANCE && length <= MAX_LENGTH)) invalid(`${path}.b`, v.b);
  const thickness = num(v.thickness, `${path}.thickness`, "size");
  if (thickness < MIN_PARTITION_THICKNESS || thickness > MAX_PARTITION_THICKNESS) invalid(`${path}.thickness`, thickness);
  return { id: str(v.id, `${path}.id`, ""), a, b, thickness, height: num(v.height, `${path}.height`, "size") };
}

function parseOpening(v: unknown, path: string, wallCount: number): Opening {
  if (!isObject(v)) invalid(path, v);
  const kind = v.kind;
  if (typeof kind !== "string" || !(OPENING_KINDS as readonly string[]).includes(kind)) invalid(`${path}.kind`, kind);
  const partition = v.partition === undefined ? undefined : str(v.partition, `${path}.partition`);
  // The wall index of an opening in a partition is not used; a missing one reads as 0.
  const wall = num(v.wall, `${path}.wall`, "nonNegative", partition !== undefined ? 0 : undefined);
  if (!Number.isInteger(wall) || (partition === undefined && wall >= wallCount)) invalid(`${path}.wall`, wall);
  const o: Opening = {
    id: str(v.id, `${path}.id`, ""),
    kind: kind as OpeningKind,
    wall,
    ...(partition !== undefined ? { partition } : {}),
    offset: num(v.offset, `${path}.offset`, "distance"),
    width: num(v.width, `${path}.width`, "size"),
    height: num(v.height, `${path}.height`, "size"),
    sill: num(v.sill, `${path}.sill`, "distance", 0),
  };
  const hinge = oneOf(v.hinge, `${path}.hinge`, HINGES);
  const swing = oneOf(v.swing, `${path}.swing`, SWINGS);
  const leaves = oneOf(v.leaves, `${path}.leaves`, LEAVES);
  if (hinge !== undefined) o.hinge = hinge;
  if (swing !== undefined) o.swing = swing;
  if (leaves !== undefined) o.leaves = leaves;
  return o;
}

/**
 * One item; `listPos` is the position number of a file before version 3 (its place in the list).
 * A missing number in a newer file reads as 0, which `repairPositions` replaces.
 */
function parseItem(v: unknown, path: string, listPos?: number): Item {
  if (!isObject(v)) invalid(path, v);
  const catalogId = str(v.catalogId, `${path}.catalogId`);
  // Sizes missing in the file come from the catalog; an unknown entry has nothing to offer.
  const entry = catalogEntry(catalogId);
  const item: Item = {
    id: str(v.id, `${path}.id`, ""),
    pos: listPos ?? num(v.pos, `${path}.pos`, "any", 0),
    catalogId,
    name: str(v.name, `${path}.name`, entry ? t(entry.name) : catalogId),
    x: num(v.x, `${path}.x`, "any"),
    y: num(v.y, `${path}.y`, "any"),
    rotation: num(v.rotation, `${path}.rotation`, "any", 0),
    width: num(v.width, `${path}.width`, "size", entry?.width),
    depth: num(v.depth, `${path}.depth`, "size", entry?.depth),
    height: num(v.height, `${path}.height`, "size", entry?.height),
    elevation: num(v.elevation, `${path}.elevation`, "distance", entry?.elevation ?? 0),
    connections: parseConnections(v.connections, `${path}.connections`),
  };
  if (v.energy !== undefined) {
    if (!ENERGIES.includes(v.energy as Energy)) invalid(`${path}.energy`, v.energy);
    item.energy = v.energy as Energy;
  }
  if (v.spec !== undefined) {
    const spec = parseSpec(v.spec, `${path}.spec`);
    if (Object.keys(spec).length > 0) item.spec = spec;
  }
  if (v.note !== undefined) item.note = str(v.note, `${path}.note`);
  return item;
}

function parseSpec(v: unknown, path: string): ItemSpec {
  if (!isObject(v)) invalid(path, v);
  const spec: ItemSpec = {};
  for (const k of SPEC_TEXTS) if (v[k] !== undefined) spec[k] = str(v[k], `${path}.${k}`);
  if (v.price !== undefined) spec.price = num(v.price, `${path}.price`, "nonNegative");
  return spec;
}

function parseConnections(v: unknown, path: string): Connections {
  if (v === undefined) return {};
  if (!isObject(v)) invalid(path, v);
  const c: Connections = {};
  for (const k of CONNECTION_NUMBERS) {
    if (v[k] !== undefined) c[k] = num(v[k], `${path}.${k}`, k === "voltage" ? "positive" : "nonNegative");
  }
  for (const k of CONNECTION_FLAGS) {
    if (v[k] === undefined) continue;
    if (typeof v[k] !== "boolean") invalid(`${path}.${k}`, v[k]);
    c[k] = v[k];
  }
  return c;
}
