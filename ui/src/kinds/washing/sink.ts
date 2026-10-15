// Sink units (Spültische): an open table with its bowls at one end, the drainer with pressed
// grooves at the other, a mixer tap over each bowl and the drain with its trap under each bowl.
// One factory draws them all: one or two bowls by width with the drainer left or right or the
// bowls in the middle between two drainers, three bowls, and the pot sink with one deep, large
// bowl.

import { INSET as FRONT_INSET, TAP, TOP as FRONT_TOP } from "../parts/elevation";
import { openFrame, SHEET, tap, TOP, TOP_RADIUS, type Hole } from "../parts/mesh";
import { INSET, UPSTAND, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { bowlDrain, bowlSpans, drainerGrooves, drainerPlan, mid, overflow, type Side, type Span } from "./common";

/**
 * Sink width from which the unit has two bowls. Two 500 mm bowls with their rims take about
 * 1150 mm; from 1400 mm a usable drainer is left beside them (catalog: 1200 mm = 1, 1600 mm = 2).
 * The plan, the elevations and 3D all count bowls with `sinkBowlCount`, so a resized sink shows
 * the same number of bowls in every view.
 */
const TWO_BOWLS_FROM = 1400;

/** Number of bowls of a sink unit of the given width (mm). */
export function sinkBowlCount(width: number): number {
  return width >= TWO_BOWLS_FROM ? 2 : 1;
}

/** Height a tap rises above a sink's worktop (m; the elevation's `TAP`). */
export const TAP_RISE = TAP / 1000;
/** Rear upstand of a sink table in 3D: depth taken from the top and height above it (m). */
const UPSTAND_3D = 0.05;
const UPSTAND_HEIGHT = 0.04;
/** Front apron (Zarge) under the worktop (m) and its line in the elevation (mm). */
const APRON = 0.1;
/** Radius of the rolled front edge of the top (m). */
const EDGE = 0.012;

export interface SinkSpec {
  kind: string;
  /** Number of bowls of a sink of the given width (mm). */
  bowls: (width: number) => number;
  /** The end the bowls sit at, the drainer taking the rest of the top; or the middle, a drainer at each end. */
  at: Side | "centre";
  /** Inner bowl size (mm): along the width, from back to front, and its depth. */
  bowlW: number;
  bowlD: number;
  bowlDepth: number;
}

/** `n` bowls side by side in the middle of a top of width `w`, `margin` apart (any unit). */
function centreSpans(w: number, n: number, bowlW: number, margin: number): Span[] {
  // Leave at least a narrow drainer at each end.
  const bw = Math.max(0, Math.min(bowlW, (w * 0.6 - (n - 1) * margin) / n));
  const x0 = -(n * bw + (n - 1) * margin) / 2;
  return Array.from({ length: n }, (_, i) => ({ x0: x0 + i * (bw + margin), x1: x0 + i * (bw + margin) + bw }));
}

/** The bowls of a sink of the given layout (any unit). */
function spansOf(w: number, n: number, bowlW: number, at: Side | "centre", margin: number): Span[] {
  return at === "centre" ? centreSpans(w, n, bowlW, margin) : bowlSpans(w, n, bowlW, at, margin);
}

/** The drainers beside the bowls `spans` on a top from l to r: [x0, x1] pairs (any unit). */
function drainers(l: number, r: number, spans: readonly Span[], at: Side | "centre", margin: number): [number, number][] {
  const x0 = Math.min(...spans.map((b) => b.x0));
  const x1 = Math.max(...spans.map((b) => b.x1));
  const left: [number, number] = [l + margin, x0 - margin];
  const right: [number, number] = [x1 + margin, r - margin];
  return at === "centre" ? [left, right] : at === "right" ? [left] : [right];
}

/** A sink unit of the given layout. */
export function makeSink(spec: SinkSpec): KindDef {
  const { bowlW, bowlD, bowlDepth, at } = spec;
  return {
    kind: spec.kind,
    rise: TAP,
    plan(s) {
      const { w, d, B, F } = s;
      const n = spec.bowls(w);
      const spans = spansOf(w, n, bowlW, at, INSET);
      const bd = Math.min(bowlD, d - 2 * INSET - UPSTAND);
      const cy = (B + UPSTAND + F) / 2;
      for (const b of spans) {
        s.rect("detail", b.x0, cy - bd / 2, b.x1, cy + bd / 2);
        s.circle("detail", mid(b), cy, INSET / 2);
      }
      // A tap behind each bowl, as in 3D and the elevation; the drainer's grooves beside them.
      for (const b of spans) s.circle("detail", mid(b), B + UPSTAND / 2 + INSET / 2, INSET / 2);
      for (const [x0, x1] of drainers(s.L, s.R, spans, at, INSET)) drainerPlan(s, x0, x1, cy - bd / 2, cy + bd / 2);
      upstandLine(s);
    },
    elevation(f) {
      const { top } = f;
      const I = FRONT_INSET;
      const c = (f.l + f.r) / 2;
      f.worktop();
      f.line("detail", [f.l, top - APRON * 1000], [f.r, top - APRON * 1000]);
      // The bowls lie behind the apron: hidden, with the drain below each and a tap over it.
      const n = spec.bowls(f.w);
      for (const b of spansOf(f.w, n, bowlW, at, I)) {
        const x0 = c + b.x0;
        const x1 = c + b.x1;
        const xm = (x0 + x1) / 2;
        f.box("hidden", x0, x1, top - bowlDepth, top - FRONT_TOP);
        f.line("detail", [xm, top - bowlDepth], [xm, top - bowlDepth - 160], [xm - 60, top - bowlDepth - 160]);
        f.line("detail", [xm, top], [xm, top + TAP], [xm - I * 3, top + TAP], [xm - I * 3, top + TAP - 50]);
      }
      f.legsAndUndershelf();
    },
    mesh(p, s, item) {
      const n = spec.bowls(item.width);
      const margin = INSET / 1000;
      const depth = bowlDepth / 1000;
      const bd = Math.min(bowlD / 1000, s.d - 2 * margin - UPSTAND_3D);
      const zc = UPSTAND_3D / 2;
      const holes: Hole[] = spansOf(s.w, n, bowlW / 1000, at, margin).map((b) => ({ ...b, z0: zc - bd / 2, z1: zc + bd / 2 }));
      openFrame(p, s, s.h - TOP);
      p.topWithHoles("steel", s.w, s.d, s.h - TOP, s.h, holes);
      // Apron under the top at the front and the sides, and the rolled front edge.
      p.box("steel", -s.w / 2, s.w / 2, s.h - APRON, s.h - TOP, s.d / 2 - SHEET, s.d / 2);
      p.box("steel", -s.w / 2, -s.w / 2 + SHEET, s.h - APRON, s.h - TOP, -s.d / 2, s.d / 2);
      p.box("steel", s.w / 2 - SHEET, s.w / 2, s.h - APRON, s.h - TOP, -s.d / 2, s.d / 2);
      p.rod("steel", "x", 0, s.h - EDGE, s.d / 2 - EDGE, s.w, EDGE);
      for (const h of holes) {
        const cx = (h.x0 + h.x1) / 2;
        p.tub("steel", h.x0, h.x1, s.h - depth, s.h, h.z0, h.z1);
        bowlDrain(p, cx, (h.z0 + h.z1) / 2, s.h - depth, -s.d / 2);
        overflow(p, cx, h.z0 + SHEET, s.h);
      }
      // Pressed grooves in the drainer lead the water to the bowls.
      for (const [x0, x1] of drainers(-s.w / 2, s.w / 2, holes, at, margin)) drainerGrooves(p, x0, x1, s.h, zc - bd / 2, zc + bd / 2);
      // Upstand along the back wall, a mixer tap over each bowl.
      p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - TOP_RADIUS, s.h + UPSTAND_HEIGHT, -s.d / 2, -s.d / 2 + SHEET * 2, TOP_RADIUS, "top");
      for (const h of holes) tap(p, (h.x0 + h.x1) / 2, -s.d / 2, s.h, TAP_RISE);
    },
  };
}

/** A common 500 × 400 bowl, 250 mm deep. */
const BOWL = { bowlW: 500, bowlD: 400, bowlDepth: 250 };

/** One or two bowls by width at the right, the drainer at the left. */
export const sink = makeSink({ kind: "sink", bowls: sinkBowlCount, at: "right", ...BOWL });
/** One or two bowls by width at the left, the drainer at the right. */
export const sinkDrainerRight = makeSink({ kind: "sinkDrainerRight", bowls: sinkBowlCount, at: "left", ...BOWL });
/** Three bowls at the right (washing, rinsing, disinfecting), the drainer at the left. */
export const sinkThree = makeSink({ kind: "sinkThree", bowls: () => 3, at: "right", ...BOWL });
/** One or two bowls by width in the middle, a drainer at each end. */
export const sinkCentre = makeSink({ kind: "sinkCentre", bowls: (w) => (w >= 1800 ? 2 : 1), at: "centre", ...BOWL });
/** Pot sink (Topfspüle): one large, deep bowl for pots and GN containers, the drainer at the left. */
export const potSink = makeSink({ kind: "potSink", bowls: () => 1, at: "right", bowlW: 700, bowlD: 550, bowlDepth: 400 });
