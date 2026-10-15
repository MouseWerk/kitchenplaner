// Aligning and distributing the selected equipment (arrange mode, two or more items).
//
// Everything works on the axis-aligned bounding box of each item's footprint, so a turned unit
// lines up by what it covers on the plan, not by its centre. Aligning refers to the bounding box
// of the whole selection (as drawing programs do by default): the outermost item stays and the
// others move to it. Distributing and lining up keep the first item along the axis in place.
// Each command is one undo step; a command that changes nothing leaves none.

import { bounds, footprint, round, type Box } from "../model/geometry";
import type { Item, Vec2 } from "../model/types";
import { selectedItems, useStore } from "../store/store";

/** An edge or the middle of the selection's box: left/right/centreX along x, top/bottom/centreY along y. */
export type AlignEdge = "left" | "centreX" | "right" | "top" | "centreY" | "bottom";
export type AlignAxis = "x" | "y";

/** New centres by item id; only items that move are in it. */
export type Moves = Map<string, Vec2>;

const boxOf = (it: Item): Box => bounds(footprint(it));
const lo = (b: Box, axis: AlignAxis) => (axis === "x" ? b.minX : b.minY);
const hi = (b: Box, axis: AlignAxis) => (axis === "x" ? b.maxX : b.maxY);

function shifted(it: Item, axis: AlignAxis, by: number): Vec2 {
  return axis === "x" ? { x: round(it.x + by), y: it.y } : { x: it.x, y: round(it.y + by) };
}

function collect(items: readonly Item[], target: (it: Item) => Vec2): Moves {
  const moves: Moves = new Map();
  for (const it of items) {
    const p = target(it);
    if (Math.abs(p.x - it.x) > 1e-9 || Math.abs(p.y - it.y) > 1e-9) moves.set(it.id, p);
  }
  return moves;
}

/** Aligns the items' boxes on an edge or the middle of the box around all of them. */
export function alignItems(items: readonly Item[], edge: AlignEdge): Moves {
  if (items.length < 2) return new Map();
  const all = bounds(items.flatMap((it) => footprint(it)));
  const axis: AlignAxis = edge === "left" || edge === "centreX" || edge === "right" ? "x" : "y";
  return collect(items, (it) => {
    const b = boxOf(it);
    let by: number;
    if (edge === "left" || edge === "top") by = lo(all, axis) - lo(b, axis);
    else if (edge === "right" || edge === "bottom") by = hi(all, axis) - hi(b, axis);
    else by = (lo(all, axis) + hi(all, axis)) / 2 - (lo(b, axis) + hi(b, axis)) / 2;
    return shifted(it, axis, by);
  });
}

/** The items in order along the axis: by their box's start, then by their middle. */
function ordered(items: readonly Item[], axis: AlignAxis): { it: Item; b: Box }[] {
  return items
    .map((it) => ({ it, b: boxOf(it) }))
    .sort((p, q) => lo(p.b, axis) - lo(q.b, axis) || lo(p.b, axis) + hi(p.b, axis) - (lo(q.b, axis) + hi(q.b, axis)));
}

/**
 * Equal gaps between the items along the axis: the first and the last stay, the ones between
 * move. Needs three items; two have only one gap.
 */
export function distributeItems(items: readonly Item[], axis: AlignAxis): Moves {
  if (items.length < 3) return new Map();
  const list = ordered(items, axis);
  const first = list[0];
  const last = list[list.length - 1];
  const sizes = list.reduce((s, x) => s + hi(x.b, axis) - lo(x.b, axis), 0);
  const gap = (hi(last.b, axis) - lo(first.b, axis) - sizes) / (list.length - 1);
  const target = new Map<string, Vec2>();
  let at = hi(first.b, axis) + gap;
  for (const x of list.slice(1, -1)) {
    target.set(x.it.id, shifted(x.it, axis, at - lo(x.b, axis)));
    at += hi(x.b, axis) - lo(x.b, axis) + gap;
  }
  return collect(items, (it) => target.get(it.id) ?? { x: it.x, y: it.y });
}

/**
 * Lines the items up without gaps along the axis („Lückenlos aneinanderreihen“): the first
 * stays, each next one moves against the end of the one before, in their order along the axis.
 */
export function packItems(items: readonly Item[], axis: AlignAxis): Moves {
  if (items.length < 2) return new Map();
  const list = ordered(items, axis);
  const target = new Map<string, Vec2>();
  let at = hi(list[0].b, axis);
  for (const x of list.slice(1)) {
    target.set(x.it.id, shifted(x.it, axis, at - lo(x.b, axis)));
    at += hi(x.b, axis) - lo(x.b, axis);
  }
  return collect(items, (it) => target.get(it.id) ?? { x: it.x, y: it.y });
}

/** Applies moves to the project as one undo step (none when nothing moves). */
function applyMoves(moves: Moves) {
  if (moves.size === 0) return;
  useStore.getState().updateItems([...moves.keys()], (it) => moves.get(it.id) ?? {});
}

export function alignSelected(edge: AlignEdge) {
  applyMoves(alignItems(selectedItems(useStore.getState()), edge));
}

export function distributeSelected(axis: AlignAxis) {
  applyMoves(distributeItems(selectedItems(useStore.getState()), axis));
}

export function packSelected(axis: AlignAxis) {
  applyMoves(packItems(selectedItems(useStore.getState()), axis));
}
