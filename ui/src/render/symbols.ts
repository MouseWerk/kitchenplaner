// The plan symbols of connection points. Every symbol fits a 3 mm square on paper, centred on
// the point, stays upright whatever the unit's rotation, is drawn black with the "connection"
// pen and is told apart from the others by its shape alone (colour comes only from the DXF
// layers). The code of the trade is in the point's label beside it („12.KW“), so the symbol itself
// carries no letters: below the ISO 3098 smallest text height of 1.8 mm they could not be read.
//
// The shapes follow the usual German conventions as far as they are known here; each is marked
// where it is an own choice. They are to be checked by a Fachplaner before 0.3 ships.
//
// Coordinates are paper mm, y pointing down (the drawing's convention); `symbolShapes` scales
// them to the plan. The DXF export can build one block per symbol from `symbolParts`.

import type { Plug, Trade, Vec2 } from "../model/types";
import type { Shape } from "./drawing";

/** Side of the square a symbol fits into (paper mm). */
export const SYMBOL_SIZE = 3;
const H = SYMBOL_SIZE / 2;

/**
 * The symbols, in legend order (`TRADES`, electric by plug). The ids name the DXF blocks
 * (`KP_<id>`), which keep German names like the layers.
 */
export const SYMBOLS = ["E_FEST", "E_SCHUKO", "E_CEE", "G", "KW", "WW", "EW", "AW", "BA", "AB", "ZU", "D", "K"] as const;
export type SymbolId = (typeof SYMBOLS)[number];

/** One part of a symbol in paper mm around its centre; arcs run clockwise on screen from a0 to a1. */
export type SymbolPart =
  | { t: "line"; pts: Vec2[]; closed: boolean }
  | { t: "circle"; c: Vec2; r: number }
  | { t: "arc"; c: Vec2; r: number; a0: number; a1: number };

const SYMBOL_TRADE: Readonly<Record<SymbolId, Trade>> = {
  E_FEST: "electric",
  E_SCHUKO: "electric",
  E_CEE: "electric",
  G: "gas",
  KW: "coldWater",
  WW: "hotWater",
  EW: "softWater",
  AW: "drain",
  BA: "floorDrain",
  AB: "exhaust",
  ZU: "supply",
  D: "steam",
  K: "refrigeration",
};

const BY_TRADE: Readonly<Record<Exclude<Trade, "electric">, SymbolId>> = {
  gas: "G",
  coldWater: "KW",
  hotWater: "WW",
  softWater: "EW",
  drain: "AW",
  floorDrain: "BA",
  exhaust: "AB",
  supply: "ZU",
  steam: "D",
  refrigeration: "K",
};

/** The symbol of a point: by trade, an electric one by its connection type. */
export function symbolOf(trade: Trade, plug?: Plug): SymbolId {
  if (trade !== "electric") return BY_TRADE[trade];
  if (plug === "schuko") return "E_SCHUKO";
  if (plug === "cee16" || plug === "cee32" || plug === "cee63") return "E_CEE";
  return "E_FEST";
}

/** The trade a symbol stands for. */
export function symbolTrade(id: SymbolId): Trade {
  return SYMBOL_TRADE[id];
}

const v = (x: number, y: number): Vec2 => ({ x, y });
const line = (...pts: [number, number][]): SymbolPart => ({ t: "line", pts: pts.map(([x, y]) => v(x, y)), closed: false });
const poly = (...pts: [number, number][]): SymbolPart => ({ t: "line", pts: pts.map(([x, y]) => v(x, y)), closed: true });
const circle = (x: number, y: number, r: number): SymbolPart => ({ t: "circle", c: v(x, y), r });

/** Half height of a valve's triangles (paper mm). */
const VALVE_H = 0.9;
/** Spacing of the lines that fill the gas valve's triangle: closer than the pen is wide (0.25 mm). */
const FILL_STEP = 0.2;

/** A valve: two triangles meeting at their tips (DIN EN 806-1 / DIN 1988 Absperrarmatur). */
function valve(w: number, h: number): SymbolPart[] {
  return [poly([-w, -h], [-w, h], [0, 0]), poly([w, -h], [w, h], [0, 0])];
}

/** The left triangle of a valve filled with vertical lines; the renderers have no black fill. */
function filledLeft(w: number, h: number): SymbolPart[] {
  const out: SymbolPart[] = [];
  for (let x = -w + FILL_STEP / 2; x < -FILL_STEP / 2; x += FILL_STEP) {
    const y = (h * -x) / w;
    out.push(line([x, -y], [x, y]));
  }
  return out;
}

/** The socket outlet: half circle open to the top, the protective contact line across it, the feed line up. */
function socket(): SymbolPart[] {
  const r = 1.2;
  const cy = H - r;
  return [{ t: "arc", c: v(0, cy), r, a0: 0, a1: 180 }, line([-r, cy - 0.4], [r, cy - 0.4]), line([0, cy - 0.4], [0, -H])];
}

const PARTS: Readonly<Record<SymbolId, readonly SymbolPart[]>> = {
  // Fixed connection (Geräteanschlussdose), DIN EN 60617-11: a circle with the connection tail.
  // The exact figure number is to be checked.
  E_FEST: [circle(0, -H + 1.1, 1.1), line([0, -H + 2.2], [0, H])],
  // Socket outlet with protective contact (Schutzkontaktsteckdose), DIN EN 60617-11-13.
  E_SCHUKO: socket(),
  // CEE socket: the socket with three ticks for three phases on its feed line (own choice for
  // telling it from Schuko; the rating is in the legend and the connection table, as it cannot
  // be read inside 3 mm).
  E_CEE: [...socket(), ...[-0.55, -0.85, -1.15].map((y) => line([-0.35, y + 0.2], [0.35, y - 0.2]))],
  // Gas valve with one triangle filled (DVGW-TRGI drawing practice; unsure).
  G: [...valve(H, VALVE_H), ...filledLeft(H, VALVE_H)],
  // Water valves (DIN EN 806-1): cold water plain; hot water with a bar through the seat and
  // softened water inside a circle are own choices so they differ by shape.
  KW: valve(H, VALVE_H),
  WW: [...valve(H, VALVE_H), line([0, -VALVE_H], [0, VALVE_H])],
  EW: [circle(0, 0, H), ...valve(1.05, 0.65)],
  // Drain point (Ablauf), DIN 1986-100: a circle with a diagonal (unsure of the figure).
  AW: [circle(0, 0, H), line([-H * Math.SQRT1_2, H * Math.SQRT1_2], [H * Math.SQRT1_2, -H * Math.SQRT1_2])],
  // Floor drain (Bodenablauf), DIN 1986-100: a square with a circle inside.
  BA: [poly([-H, -H], [H, -H], [H, H], [-H, H]), circle(0, 0, 1.1)],
  // Air outlets in plan (DIN EN 12792, unsure): exhaust a circle with an X, supply a circle with
  // an upright cross. The arrow of the guide is left out, it does not fit 3 mm next to the circle.
  AB: [circle(0, 0, H), line([-H * Math.SQRT1_2, -H * Math.SQRT1_2], [H * Math.SQRT1_2, H * Math.SQRT1_2]), line([-H * Math.SQRT1_2, H * Math.SQRT1_2], [H * Math.SQRT1_2, -H * Math.SQRT1_2])],
  ZU: [circle(0, 0, H), line([-H, 0], [H, 0]), line([0, -H], [0, H])],
  // Steam: a valve with the pipe running through it (own choice, no standard symbol known).
  D: [...valve(H, VALVE_H), line([-H, 0], [H, 0])],
  // Remote refrigeration: two small circles, suction and liquid line (own choice).
  K: [circle(-0.75, 0, 0.7), circle(0.75, 0, 0.7)],
};

/** The parts of a symbol, in paper mm around its centre. */
export function symbolParts(id: SymbolId): readonly SymbolPart[] {
  return PARTS[id];
}

/** What a symbol's shapes carry: the trade (DXF layer) and, on a plan, the point it draws. */
export interface SymbolTags {
  trade: Trade;
  point?: { itemId: string; trade: Trade };
}

/** A symbol on a plan at `at` (plan mm), `ps` drawing units per paper mm, upright. */
export function symbolShapes(id: SymbolId, at: Vec2, ps: number, tags: SymbolTags): Shape[] {
  const p = (q: Vec2): Vec2 => ({ x: at.x + q.x * ps, y: at.y + q.y * ps });
  return PARTS[id].map((part): Shape => {
    switch (part.t) {
      case "line":
        return { t: "poly", pen: "connection", ...tags, pts: part.pts.map(p), closed: part.closed };
      case "circle":
        return { t: "circle", pen: "connection", ...tags, c: p(part.c), r: part.r * ps };
      case "arc":
        return { t: "arc", pen: "connection", ...tags, c: p(part.c), r: part.r * ps, a0: part.a0, a1: part.a1 };
    }
  });
}
