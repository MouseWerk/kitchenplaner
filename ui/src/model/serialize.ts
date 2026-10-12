// Project files: pretty JSON with a fixed key order (readable diffs, stable files), and a strict
// parser that turns anything read from disk into a valid Project or a ProjectError.

import { catalogEntry } from "./catalog";
import { clampOpening, MAX_LENGTH } from "./geometry";
import { FORMAT_VERSION, newId } from "./project";
import { isUsableOutline, removeCoincidentCorners } from "./roomEdit";
import type { Connections, Item, Opening, OpeningKind, Project, ProjectInfo, Room, Vec2 } from "./types";
import { t, type TKey } from "../lib/i18n";

const FORMAT_ID = "kitchenplaner";

/** Defaults for a room that lacks them (the values of a new project). */
const DEFAULT_ROOM_HEIGHT = 3000;
const DEFAULT_WALL_THICKNESS = 240;

const OPENING_KINDS: readonly OpeningKind[] = ["door", "window", "passage"];
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
    info: { name: p.info.name, client: p.info.client, author: p.info.author, date: p.info.date },
    room: {
      points: p.room.points.map((q) => ({ x: q.x, y: q.y })),
      height: p.room.height,
      wallThickness: p.room.wallThickness,
      openings: p.room.openings.map((o) => ({ id: o.id, kind: o.kind, wall: o.wall, offset: o.offset, width: o.width, height: o.height, sill: o.sill })),
    },
    items: p.items.map((it) => {
      const connections: Record<string, number | boolean> = {};
      for (const k of CONNECTION_ORDER) {
        const v = it.connections[k];
        if (v !== undefined) connections[k] = v;
      }
      return {
        id: it.id,
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
  const items = itemsRaw.map((v, i) => parseItem(v, `items[${i}]`));

  // Ids must be unique across openings and items: selection and hit testing rely on them.
  const seen = new Set<string>();
  const unique = <T extends { id: string }>(x: T): T => {
    let id = x.id;
    while (id === "" || seen.has(id)) id = newId();
    seen.add(id);
    return id === x.id ? x : { ...x, id };
  };
  room.openings = room.openings.map(unique);

  return {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
    info: parseInfo(raw.info),
    room,
    items: items.map(unique),
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
  };
}

function parseRoom(v: unknown): Room {
  if (!isObject(v)) invalid("room", v);
  if (!Array.isArray(v.points) || v.points.length < 3) invalid("room.points", v.points);
  const points = v.points.map((p, i): Vec2 => {
    if (!isObject(p)) invalid(`room.points[${i}]`, p);
    return { x: num(p.x, `room.points[${i}].x`, "any"), y: num(p.y, `room.points[${i}].y`, "any") };
  });
  const openingsRaw = v.openings ?? [];
  if (!Array.isArray(openingsRaw)) invalid("room.openings", openingsRaw);
  const openings = openingsRaw.map((o, i) => parseOpening(o, `room.openings[${i}]`, points.length));
  // A corner repeated on the spot leaves a zero-length wall that snapping and drawing cannot
  // use; a room without a floor area cannot be edited at all.
  const room = removeCoincidentCorners({
    points,
    height: num(v.height, "room.height", "size", DEFAULT_ROOM_HEIGHT),
    wallThickness: num(v.wallThickness, "room.wallThickness", "size", DEFAULT_WALL_THICKNESS),
    openings,
  });
  if (!isUsableOutline(room.points)) invalid("room.points", v.points);
  // Openings sit inside their wall, as the editor keeps them.
  return { ...room, openings: room.openings.map((o) => clampOpening(room, o)) };
}

function parseOpening(v: unknown, path: string, wallCount: number): Opening {
  if (!isObject(v)) invalid(path, v);
  const kind = v.kind;
  if (typeof kind !== "string" || !(OPENING_KINDS as readonly string[]).includes(kind)) invalid(`${path}.kind`, kind);
  const wall = num(v.wall, `${path}.wall`, "nonNegative");
  if (!Number.isInteger(wall) || wall >= wallCount) invalid(`${path}.wall`, wall);
  return {
    id: str(v.id, `${path}.id`, ""),
    kind: kind as OpeningKind,
    wall,
    offset: num(v.offset, `${path}.offset`, "distance"),
    width: num(v.width, `${path}.width`, "size"),
    height: num(v.height, `${path}.height`, "size"),
    sill: num(v.sill, `${path}.sill`, "distance", 0),
  };
}

function parseItem(v: unknown, path: string): Item {
  if (!isObject(v)) invalid(path, v);
  const catalogId = str(v.catalogId, `${path}.catalogId`);
  // Sizes missing in the file come from the catalog; an unknown entry has nothing to offer.
  const entry = catalogEntry(catalogId);
  const item: Item = {
    id: str(v.id, `${path}.id`, ""),
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
  if (v.note !== undefined) item.note = str(v.note, `${path}.note`);
  return item;
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
