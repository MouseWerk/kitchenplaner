// The floor plan: the drawing of `model/plan.ts`, plus selecting, dragging (with wall and edge
// snapping), dropping catalog entries, editing the room's corners and moving openings.

import { useMemo, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from "react";
import { DrawingShapes, SCREEN_PAPER_SCALE } from "../components/DrawingSvg";
import { catalogEntry, isOverhead, kindOf } from "../model/catalog";
import { checkProject } from "../model/checks";
import { add, area, bounds, dot, footprint, openingSpan, pointInPolygon, round, scale, snapItem, snapValue, sub, walls, type Box } from "../model/geometry";
import { planDrawing } from "../model/plan";
import { itemFromCatalog } from "../model/project";
import type { Item, Project, Vec2 } from "../model/types";
import { drawingBounds, mm, type Drawing, type Shape } from "../render/drawing";
import { useStore } from "../store/store";
import { toWorld, useViewport } from "../lib/viewport";
import { useT } from "../lib/i18n";

/** MIME type of a catalog entry dragged from the sidebar. */
export const CATALOG_DRAG_TYPE = "application/x-kitchenplaner-catalog";
/** Pointer movement (px) before a press on an item becomes a drag. */
const DRAG_THRESHOLD = 3;
/** Radius of the room corner handles (px). */
const HANDLE_R = 5;
/** Distance dimensions of the selected item reach this far at most (mm). */
const MAX_DISTANCE_DIM = 20_000;

type Drag =
  | { kind: "pan"; start: Vec2; ox: number; oy: number }
  | { kind: "items"; start: Vec2; origin: Map<string, Vec2>; moved: boolean; screen: Vec2 }
  | { kind: "corner"; index: number }
  | { kind: "opening"; id: string; wall: number };

export function PlanView(props: { roomEdit: boolean; fitSignal: number; onCursor?: (p: Vec2 | null) => void }) {
  const t = useT();
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const prefs = useStore((s) => s.prefs);
  const drawing = useMemo(() => planDrawing(project, { showNames: prefs.showNames, showDims: prefs.showDims, paperScale: SCREEN_PAPER_SCALE }), [project, prefs.showNames, prefs.showDims]);
  const issues = useMemo(() => checkProject(project), [project]);
  const box = useMemo(() => drawingBounds(drawing, SCREEN_PAPER_SCALE), [drawing]);
  const { ref, vp, setVp, size } = useViewport(box, props.fitSignal);
  const drag = useRef<Drag | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const warned = useMemo(() => new Set(issues.flatMap((i) => i.itemIds)), [issues]);
  const selected = useMemo(() => project.items.filter((i) => selection.items.includes(i.id)), [project.items, selection.items]);

  const overlay = useMemo<Drawing>(() => {
    const shapes: Shape[] = [];
    for (const it of project.items) {
      if (warned.has(it.id)) shapes.push({ t: "poly", pen: "detail", pts: footprint(it), closed: true, fill: "warning" });
    }
    if (selected.length === 1 && !isOverhead(kindOf(selected[0].catalogId))) shapes.push(...distanceDims(project, selected[0]));
    return { shapes };
  }, [project, selected, warned]);

  const point = (e: { clientX: number; clientY: number }): Vec2 => {
    const r = ref.current!.getBoundingClientRect();
    return toWorld(vp, { x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const st = useStore.getState();
    // Middle or right button, or Space held: pan.
    if (e.button === 1 || e.button === 2) {
      drag.current = { kind: "pan", start: { x: e.clientX, y: e.clientY }, ox: vp.ox, oy: vp.oy };
      return;
    }
    if (e.button !== 0) return;
    const corner = target.getAttribute("data-corner");
    if (corner !== null) {
      st.beginGesture();
      drag.current = { kind: "corner", index: Number(corner) };
      return;
    }
    const openingId = target.getAttribute("data-opening");
    if (openingId) {
      const o = st.project.room.openings.find((x) => x.id === openingId);
      st.select({ opening: openingId });
      if (o) {
        st.beginGesture();
        drag.current = { kind: "opening", id: openingId, wall: o.wall };
      }
      return;
    }
    const p = point(e);
    const hit = hitItem(st.project.items, p, st.selection.items);
    if (hit) {
      let ids = st.selection.items;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        ids = ids.includes(hit.id) ? ids.filter((x) => x !== hit.id) : [...ids, hit.id];
      } else if (!ids.includes(hit.id)) ids = [hit.id];
      st.select({ items: ids, opening: null });
      const origin = new Map(st.project.items.filter((i) => ids.includes(i.id)).map((i) => [i.id, { x: i.x, y: i.y }]));
      drag.current = { kind: "items", start: p, origin, moved: false, screen: { x: e.clientX, y: e.clientY } };
      return;
    }
    if (!e.shiftKey) st.select({ items: [], opening: null });
    drag.current = { kind: "pan", start: { x: e.clientX, y: e.clientY }, ox: vp.ox, oy: vp.oy };
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = point(e);
    props.onCursor?.(p);
    const d = drag.current;
    const st = useStore.getState();
    if (!d) {
      setHover(hitItem(st.project.items, p, st.selection.items)?.id ?? null);
      return;
    }
    switch (d.kind) {
      case "pan":
        setVp({ ...vp, ox: d.ox + e.clientX - d.start.x, oy: d.oy + e.clientY - d.start.y });
        break;
      case "items": {
        if (!d.moved && Math.hypot(e.clientX - d.screen.x, e.clientY - d.screen.y) < DRAG_THRESHOLD) return;
        if (!d.moved) {
          st.beginGesture();
          d.moved = true;
        }
        const grid = e.altKey ? 0 : st.prefs.grid;
        const delta = sub(p, d.start);
        const ids = [...d.origin.keys()];
        if (ids.length === 1) {
          const it = st.project.items.find((i) => i.id === ids[0]);
          const o = d.origin.get(ids[0])!;
          if (!it) return;
          const moving = { ...it, x: o.x + delta.x, y: o.y + delta.y };
          const others = st.project.items.filter((i) => i.id !== it.id && isOverhead(kindOf(i.catalogId)) === isOverhead(kindOf(it.catalogId)));
          const snapped = e.altKey ? { x: round(moving.x), y: round(moving.y), rotation: it.rotation } : snapItem(moving, st.project.room, others, grid, false);
          st.updateItems(ids, () => ({ x: snapped.x, y: snapped.y, rotation: snapped.rotation }), { gesture: true });
        } else {
          const dx = snapValue(delta.x, grid);
          const dy = snapValue(delta.y, grid);
          st.updateItems(ids, (it) => ({ x: round(d.origin.get(it.id)!.x + dx), y: round(d.origin.get(it.id)!.y + dy) }), { gesture: true });
        }
        break;
      }
      case "corner": {
        const grid = e.altKey ? 0 : st.prefs.grid;
        const q = { x: snapValue(p.x, grid), y: snapValue(p.y, grid) };
        st.updateRoom((r) => ({ points: r.points.map((pt, i) => (i === d.index ? q : pt)) }), { gesture: true });
        break;
      }
      case "opening": {
        const w = walls(st.project.room)[d.wall];
        const o = st.project.room.openings.find((x) => x.id === d.id);
        if (!w || !o) return;
        const grid = e.altKey ? 0 : st.prefs.grid;
        const along = snapValue(dot(sub(p, w.a), w.dir), grid);
        const offset = Math.min(Math.max(along, o.width / 2), w.length - o.width / 2);
        st.updateOpening(d.id, { offset: round(offset) }, { gesture: true });
        break;
      }
    }
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!props.roomEdit) return;
    // A double click on a wall adds a corner there.
    const p = point(e);
    const st = useStore.getState();
    const ws = walls(st.project.room);
    let best: { index: number; at: Vec2; d: number } | null = null;
    for (const w of ws) {
      const along = Math.min(Math.max(dot(sub(p, w.a), w.dir), 0), w.length);
      const at = add(w.a, scale(w.dir, along));
      const d = Math.hypot(at.x - p.x, at.y - p.y);
      if (d < st.project.room.wallThickness * 2 && (!best || d < best.d)) best = { index: w.index, at, d };
    }
    if (!best) return;
    const at = { x: round(snapValue(best.at.x, st.prefs.grid)), y: round(snapValue(best.at.y, st.prefs.grid)) };
    const idx = best.index;
    st.change((pr) => ({
      ...pr,
      room: {
        ...pr.room,
        points: [...pr.room.points.slice(0, idx + 1), at, ...pr.room.points.slice(idx + 1)],
        // Openings on later walls move one index on; openings on the split wall stay on its first half.
        openings: pr.room.openings.map((o) => (o.wall > idx ? { ...o, wall: o.wall + 1 } : o)),
      },
    }));
  };

  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes(CATALOG_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const onDrop = (e: DragEvent) => {
    const id = e.dataTransfer.getData(CATALOG_DRAG_TYPE);
    const entry = catalogEntry(id);
    if (!entry) return;
    e.preventDefault();
    const p = point(e);
    const st = useStore.getState();
    const draft = itemFromCatalog(entry, p.x, p.y);
    const others = st.project.items.filter((i) => isOverhead(kindOf(i.catalogId)) === isOverhead(entry.kind));
    const s = snapItem(draft, st.project.room, others, st.prefs.grid, true);
    st.addItems([{ ...draft, x: s.x, y: s.y, rotation: s.rotation }]);
  };

  const transform = `translate(${vp.ox} ${vp.oy}) scale(${vp.k})`;
  const room = project.room;
  const showRoomHandles = props.roomEdit;

  return (
    <div
      ref={ref}
      className="view2d"
      onDragOver={onDragOver}
      onDrop={onDrop}
      onContextMenu={(e) => e.preventDefault()}
      onPointerLeave={() => props.onCursor?.(null)}
      role="application"
      aria-label={t("view.plan")}
    >
      {size.w > 0 && (
        <svg
          width={size.w}
          height={size.h}
          className={hover ? "is-hovering-item" : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <GridPattern vp={vp} />
          <rect width={size.w} height={size.h} fill="url(#plan-grid)" />
          <g transform={transform}>
            <DrawingShapes drawing={drawing} />
            <DrawingShapes drawing={overlay} />
            {selected.map((it) => (
              <path key={it.id} d={polyPath(footprint(it))} className="draw-selected" />
            ))}
            {hover && !selection.items.includes(hover) && <HoverOutline item={project.items.find((i) => i.id === hover)} />}
            {room.openings.map((o) => {
              const span = openingSpan(room, o);
              const w = walls(room)[o.wall];
              if (!span || !w) return null;
              const out = scale(w.inward, -room.wallThickness);
              const pts = [span[0], span[1], add(span[1], out), add(span[0], out)];
              const sel = selection.opening === o.id;
              return <path key={o.id} d={polyPath(pts)} data-opening={o.id} className={sel ? "draw-opening-hit is-selected" : "draw-opening-hit"} />;
            })}
          </g>
          {showRoomHandles &&
            room.points.map((p, i) => {
              const sp = { x: vp.ox + p.x * vp.k, y: vp.oy + p.y * vp.k };
              return <circle key={i} cx={sp.x} cy={sp.y} r={HANDLE_R} data-corner={i} className="draw-handle" />;
            })}
        </svg>
      )}
    </div>
  );
}

function HoverOutline({ item }: { item: Item | undefined }) {
  if (!item) return null;
  return <path d={polyPath(footprint(item))} className="draw-hover" />;
}

function GridPattern({ vp }: { vp: { k: number; ox: number; oy: number } }) {
  // A 100 mm grid when zoomed in, 1 m otherwise; major lines every 1 m or 5 m.
  const minor = vp.k * 100 >= 8 ? 100 : 1000;
  const major = minor === 100 ? 1000 : 5000;
  const s = major * vp.k;
  const m = minor * vp.k;
  const lines = [];
  for (let i = 1; i < major / minor; i++) lines.push(<path key={i} d={`M${i * m} 0V${s}M0 ${i * m}H${s}`} stroke="var(--draw-grid)" strokeWidth={1} />);
  return (
    <defs>
      <pattern id="plan-grid" width={s} height={s} patternUnits="userSpaceOnUse" x={vp.ox % s} y={vp.oy % s}>
        {lines}
        <path d={`M0 0V${s}M0 0H${s}`} stroke="var(--draw-grid-major)" strokeWidth={1} />
      </pattern>
    </defs>
  );
}

function polyPath(pts: readonly Vec2[]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("") + "Z";
}

/**
 * The item under a point: the selected one when it is hit (so a selected item can be dragged out
 * from under a hood), else the smallest footprint containing the point.
 */
export function hitItem(items: readonly Item[], p: Vec2, selected: readonly string[]): Item | null {
  let best: Item | null = null;
  let bestArea = Infinity;
  for (const it of items) {
    const fp = footprint(it);
    if (!pointInPolygon(p, fp)) continue;
    if (selected.includes(it.id)) return it;
    const a = area(fp);
    if (a < bestArea) {
      best = it;
      bestArea = a;
    }
  }
  return best;
}

/**
 * Dimensions from the selected item's bounding box to the nearest wall or floor item in each
 * of the four directions: what a planner checks while placing (aisle widths, gaps).
 */
export function distanceDims(project: Project, item: Item): Shape[] {
  const b = bounds(footprint(item));
  const obstacles: [Vec2, Vec2][] = walls(project.room).map((w) => [w.a, w.b]);
  for (const o of project.items) {
    if (o.id === item.id || isOverhead(kindOf(o.catalogId))) continue;
    const fp = footprint(o);
    for (let i = 0; i < fp.length; i++) obstacles.push([fp[i], fp[(i + 1) % fp.length]]);
  }
  const mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const rays: { from: Vec2; dir: Vec2; offsetSign: number }[] = [
    { from: { x: b.minX, y: mid.y }, dir: { x: -1, y: 0 }, offsetSign: 1 },
    { from: { x: b.maxX, y: mid.y }, dir: { x: 1, y: 0 }, offsetSign: 1 },
    { from: { x: mid.x, y: b.minY }, dir: { x: 0, y: -1 }, offsetSign: 1 },
    { from: { x: mid.x, y: b.maxY }, dir: { x: 0, y: 1 }, offsetSign: 1 },
  ];
  const shapes: Shape[] = [];
  for (const r of rays) {
    const d = castRay(r.from, r.dir, obstacles, b);
    if (d === null || d < 1 || d > MAX_DISTANCE_DIM) continue;
    const to = add(r.from, scale(r.dir, d));
    shapes.push({ t: "dim", pen: "dim", a: r.from, b: to, offset: 0, text: mm(d) });
  }
  return shapes;
}

function castRay(from: Vec2, dir: Vec2, segments: readonly [Vec2, Vec2][], own: Box): number | null {
  let best: number | null = null;
  for (const [a, b] of segments) {
    const e = sub(b, a);
    const denom = dir.x * e.y - dir.y * e.x;
    if (Math.abs(denom) < 1e-9) continue;
    const w = sub(a, from);
    const tRay = (w.x * e.y - w.y * e.x) / denom;
    const u = (w.x * dir.y - w.y * dir.x) / denom;
    if (tRay < 0.5 || u < 0 || u > 1) continue;
    const hit = add(from, scale(dir, tRay));
    // Ignore hits inside the item's own box (a neighbour edge touching it).
    if (hit.x > own.minX + 0.5 && hit.x < own.maxX - 0.5 && hit.y > own.minY + 0.5 && hit.y < own.maxY - 0.5) continue;
    if (best === null || tRay < best) best = tRay;
  }
  return best;
}

