// Corner sink unit (Eckspültisch): a square open table for the corner of a room, the bowl in the
// back corner against both walls, an upstand along the back and the wall side, the drainer round
// the bowl (beside it and in front of it) and the mixer tap behind the bowl. Left and right say
// which back corner holds the bowl.

import { INSET as FRONT_INSET, TAP, TOP as FRONT_TOP } from "../parts/elevation";
import { openFrame, SHEET, tap, TOP, TOP_RADIUS, type Hole } from "../parts/mesh";
import { INSET, UPSTAND } from "../parts/plan";
import type { KindDef } from "../types";
import { bowlDrain, drainerGrooves, drainerPlan, overflow, type Side } from "./common";
import { TAP_RISE } from "./sink";

/** The bowl (mm): its size seen from above, at most, and its depth. */
const BOWL = 500;
const BOWL_DEPTH = 300;
/** Front apron under the top (m), rolled front edge (m) and the upstands (m) as on the sinks. */
const APRON = 0.1;
const EDGE = 0.012;
const UPSTAND_HEIGHT = 0.04;

/**
 * The bowl in the item frame (mm or m, `k` = 1 or 1/1000): in the back corner at `at`, behind
 * the upstands, at most half the width and the depth.
 */
function bowlOf(w: number, d: number, at: Side, k: number) {
  const margin = INSET * k;
  const up = UPSTAND * k;
  const size = Math.min(BOWL * k, w / 2 - margin - up, d / 2);
  const x0 = at === "left" ? -w / 2 + up + margin : w / 2 - up - margin - size;
  const y0 = -d / 2 + up + margin;
  return { x0, x1: x0 + size, y0, y1: y0 + size };
}

function makeCornerSink(kind: string, at: Side): KindDef {
  const sx = at === "left" ? -1 : 1;
  return {
    kind,
    rise: TAP,
    plan(s) {
      const b = bowlOf(s.w, s.d, at, 1);
      s.rect("detail", b.x0, b.y0, b.x1, b.y1);
      s.circle("detail", (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, INSET / 2);
      s.circle("detail", (b.x0 + b.x1) / 2, s.B + UPSTAND / 2 + INSET / 2, INSET / 2);
      // The drainer beside the bowl and in front of it.
      if (at === "left") drainerPlan(s, b.x1 + INSET, s.R - INSET, b.y0, b.y1);
      else drainerPlan(s, s.L + INSET, b.x0 - INSET, b.y0, b.y1);
      drainerPlan(s, s.L + INSET, s.R - INSET, b.y1 + INSET, s.F - INSET);
      // Upstands along the back and the wall side.
      const xu = at === "left" ? s.L + UPSTAND : s.R - UPSTAND;
      s.line("detail", [s.L, s.B + UPSTAND], [s.R, s.B + UPSTAND]);
      s.line("detail", [xu, s.B + UPSTAND], [xu, s.F]);
    },
    elevation(f) {
      const { top } = f;
      const c = (f.l + f.r) / 2;
      const b = bowlOf(f.w, f.item.depth, at, 1);
      f.worktop();
      f.line("detail", [f.l, top - APRON * 1000], [f.r, top - APRON * 1000]);
      const x0 = c + b.x0;
      const x1 = c + b.x1;
      const xm = (x0 + x1) / 2;
      f.box("hidden", x0, x1, top - BOWL_DEPTH, top - FRONT_TOP);
      f.line("detail", [xm, top - BOWL_DEPTH], [xm, top - BOWL_DEPTH - 160], [xm - 60, top - BOWL_DEPTH - 160]);
      f.line("detail", [xm, top], [xm, top + TAP], [xm - FRONT_INSET * 3, top + TAP], [xm - FRONT_INSET * 3, top + TAP - 50]);
      f.legsAndUndershelf();
    },
    mesh(p, s) {
      const b = bowlOf(s.w, s.d, at, 1 / 1000);
      const hole: Hole = { x0: b.x0, x1: b.x1, z0: b.y0, z1: b.y1 };
      const cx = (b.x0 + b.x1) / 2;
      const depth = BOWL_DEPTH / 1000;
      const margin = INSET / 1000;
      openFrame(p, s, s.h - TOP);
      p.topWithHoles("steel", s.w, s.d, s.h - TOP, s.h, [hole]);
      // Apron under the top at the front and the sides, and the rolled front edge.
      p.box("steel", -s.w / 2, s.w / 2, s.h - APRON, s.h - TOP, s.d / 2 - SHEET, s.d / 2);
      p.box("steel", -s.w / 2, -s.w / 2 + SHEET, s.h - APRON, s.h - TOP, -s.d / 2, s.d / 2);
      p.box("steel", s.w / 2 - SHEET, s.w / 2, s.h - APRON, s.h - TOP, -s.d / 2, s.d / 2);
      p.rod("steel", "x", 0, s.h - EDGE, s.d / 2 - EDGE, s.w, EDGE);
      p.tub("steel", hole.x0, hole.x1, s.h - depth, s.h, hole.z0, hole.z1);
      bowlDrain(p, cx, (hole.z0 + hole.z1) / 2, s.h - depth, -s.d / 2);
      overflow(p, cx, hole.z0 + SHEET, s.h);
      // The drainer beside the bowl and in front of it.
      if (at === "left") drainerGrooves(p, hole.x1 + margin, s.w / 2 - margin, s.h, hole.z0, hole.z1, 4);
      else drainerGrooves(p, -s.w / 2 + margin, hole.x0 - margin, s.h, hole.z0, hole.z1, 4);
      drainerGrooves(p, -s.w / 2 + margin * 2, s.w / 2 - margin * 2, s.h, hole.z1 + margin, s.d / 2 - margin, 3);
      // Upstands along the back and the wall side, the mixer tap over the bowl.
      p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - TOP_RADIUS, s.h + UPSTAND_HEIGHT, -s.d / 2, -s.d / 2 + SHEET * 2, TOP_RADIUS, "top");
      const xs = sx * (s.w / 2 - SHEET);
      p.roundedBox("steel", xs - SHEET, xs + SHEET, s.h - TOP_RADIUS, s.h + UPSTAND_HEIGHT, -s.d / 2 + SHEET * 2, s.d / 2 - TOP_RADIUS, TOP_RADIUS, "top");
      tap(p, cx, -s.d / 2, s.h, TAP_RISE);
    },
  };
}

export const cornerSinkLeft = makeCornerSink("cornerSinkLeft", "left");
export const cornerSinkRight = makeCornerSink("cornerSinkRight", "right");
