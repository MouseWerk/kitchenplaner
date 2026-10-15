// The floor plan: the drawing of `model/plan.ts` and, in the arrange mode, selecting and moving
// equipment as in Blender: click and frame selection, dragging with snapping guides, the modal
// G (grab) and R (rotate) operators, Shift+D, and dropping catalog entries. In the room mode the
// room editor (RoomEditLayer.tsx) lies above the drawing and takes all input; the plan only draws.
// Above both lies the measure tool while it is on (MeasureLayer.tsx). A right click without
// moving opens the context menu of the mode (planMenu.ts); a right drag pans.

import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from "react";
import { DrawingShapes, SCREEN_PAPER_SCALE } from "../components/DrawingSvg";
import { catalogEntry, kindOf, placementOf, wallSnapReach } from "../kinds/registry";
import { checkProject } from "../model/checks";
import { add, area, bounds, footprint, itemsInFrame, partitionOutline, pointInPolygon, round, scale, snapItem, snapValue, sub, walls, type Box } from "../model/geometry";
import { snapGroupGuides, snapItemGuides, type Guide } from "../model/snapGuides";
import { planDrawing } from "../model/plan";
import { RoomEditLayer } from "./RoomEditLayer";
import { MeasureLayer } from "./MeasureLayer";
import { arrangeMenu, roomMenu } from "./planMenu";
import { ContextMenu, type ContextEntry } from "../components/ContextMenu";
import { useMeasuring } from "../lib/measureTool";
import { itemFromCatalog } from "../model/project";
import type { Item, Project, Vec2 } from "../model/types";
import { drawingBounds, mm, type Drawing, type Shape } from "../render/drawing";
import { useStore } from "../store/store";
import { toScreen, toWorld, useViewport, type Viewport } from "../lib/viewport";
import { num, useT } from "../lib/i18n";
import { grabDelta, operatorKey, operatorLabel, rotateAngle, startGrab, startRotate, type ModalOp } from "../lib/modal";
import { setModeKeyHandler } from "../lib/shortcuts";
import {
  applyTransform,
  beginDuplicate,
  beginTransform,
  cancelTransform,
  combineSelection,
  confirmTransform,
  registerOperator,
  rotateItemAround,
  selectionCentre,
  type SelectMode,
  type TransformSession,
} from "../lib/commands";

/** MIME type of a catalog entry dragged from the sidebar. */
export const CATALOG_DRAG_TYPE = "application/x-kitchenplaner-catalog";
/** Pointer movement (px) before a press becomes a drag or a selection frame. */
const DRAG_THRESHOLD = 3;
/** Distance dimensions of the selected item reach this far at most (mm). */
const MAX_DISTANCE_DIM = 20_000;
/** Snapping reaches this far on screen (px), at most `SNAP_MAX_MM`. */
const SNAP_PX = 8;
const SNAP_MAX_MM = 150;
/** Guide lines reach this far beyond what they align (px). */
const GUIDE_OVERSHOOT = 12;
/** Half the size of the snap marks and the selection corner handles (px). */
const MARK_R = 3.5;
const CORNER_R = 2.5;
/** The readout sits this far right and below the cursor (px). */
const READOUT_OFFSET = 16;

type Drag =
  | { kind: "pan"; start: Vec2; ox: number; oy: number; button: number }
  | {
      kind: "items";
      start: Vec2;
      screen: Vec2;
      /** Set when the press became a drag. */
      session: TransformSession | null;
      /** Unregisters the drag's cancel (lib/commands.ts registerOperator). */
      done: (() => void) | null;
      /** A Shift/Ctrl click on a selected item takes it out of the selection, unless it becomes a drag. */
      toggleOff: string | null;
    }
  | { kind: "frame"; start: Vec2; screen: Vec2; end: Vec2; active: boolean; mode: SelectMode };

/** A running G or R operator. */
interface Running {
  op: ModalOp;
  session: TransformSession;
  /** Centre of the selection at the start: where the grab line starts. */
  anchor: Vec2;
  /** Unregisters the operator's cancel. */
  done: () => void;
}

/** What the plan draws over the drawing while editing (all in plan millimetres). */
interface Live {
  guides: Guide[];
  marks: Vec2[];
  frame: { a: Vec2; b: Vec2; crossing: boolean } | null;
  readout: { at: Vec2; text: string } | null;
  /** The line of a running operator: from the anchor to where it is now, and its locked axis. */
  opLine: { a: Vec2; b: Vec2; axis: "x" | "y" | null } | null;
}

const IDLE: Live = { guides: [], marks: [], frame: null, readout: null, opLine: null };

export function PlanView(props: { fitSignal: number; onCursor?: (p: Vec2 | null) => void }) {
  const roomEdit = useStore((s) => s.mode === "room");
  const t = useT();
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const prefs = useStore((s) => s.prefs);
  const drawing = useMemo(() => planDrawing(project, { showNames: prefs.showNames, showDims: prefs.showDims, paperScale: SCREEN_PAPER_SCALE }), [project, prefs.showNames, prefs.showDims]);
  const issues = useMemo(() => checkProject(project), [project]);
  const box = useMemo(() => drawingBounds(drawing, SCREEN_PAPER_SCALE), [drawing]);
  const { ref, vp, setVp, size } = useViewport(box, props.fitSignal);
  const drag = useRef<Drag | null>(null);
  const running = useRef<Running | null>(null);
  /** The cursor on the plan (mm); null while it is outside. */
  const cursor = useRef<Vec2 | null>(null);
  const lastCursor = useRef<Vec2>({ x: 0, y: 0 });
  const alt = useRef(false);
  const space = useRef(false);
  /** B was pressed: the next press draws a selection frame, also on an item. */
  const boxPending = useRef(false);
  const vpRef = useRef(vp);
  vpRef.current = vp;
  const [hover, setHover] = useState<string | null>(null);
  const [live, setLive] = useState<Live>(IDLE);
  const [panning, setPanning] = useState(false);
  const measuring = useMeasuring();
  /** The open context menu: where (window pixels) and its entries. */
  const [menu, setMenu] = useState<{ at: Vec2; entries: ContextEntry[] } | null>(null);

  const warned = useMemo(() => new Set(issues.flatMap((i) => i.itemIds)), [issues]);
  const selected = useMemo(() => project.items.filter((i) => selection.items.includes(i.id)), [project.items, selection.items]);

  const overlay = useMemo<Drawing>(() => {
    const shapes: Shape[] = [];
    for (const it of project.items) {
      if (warned.has(it.id)) shapes.push({ t: "poly", pen: "detail", pts: footprint(it), closed: true, fill: "warning" });
    }
    if (!roomEdit && selected.length === 1 && placementOf(kindOf(selected[0].catalogId)) !== "overhead") shapes.push(...distanceDims(project, selected[0]));
    return { shapes };
  }, [project, selected, warned, roomEdit]);

  const point = (e: { clientX: number; clientY: number }): Vec2 => {
    const r = ref.current!.getBoundingClientRect();
    return toWorld(vpRef.current, { x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const reach = () => Math.min(SNAP_PX / vpRef.current.k, SNAP_MAX_MM);

  /** Moves the items of a session by a raw offset, snapped unless `free`; returns the applied offset and the guides. */
  const moveSession = (session: TransformSession, raw: Vec2, free: boolean, axis: "x" | "y" | null) => {
    const st = useStore.getState();
    const origin = [...session.origin.values()];
    const others = st.project.items.filter((i) => !session.origin.has(i.id));
    const grid = free ? 0 : st.prefs.grid;
    let delta = raw;
    let guides: Guide[] = [];
    let marks: Vec2[] = [];
    let rotation: number | null = null;
    if (!free && origin.length === 1) {
      const o = origin[0];
      const s = snapItemGuides({ ...o, x: o.x + raw.x, y: o.y + raw.y }, st.project.room, others, grid, reach(), wallSnapReach(kindOf(o.catalogId)));
      delta = { x: s.x - o.x, y: s.y - o.y };
      rotation = s.rotation;
      guides = s.guides;
      marks = s.marks;
    } else if (!free) {
      const d = { x: snapValue(raw.x, grid), y: snapValue(raw.y, grid) };
      const s = snapGroupGuides(
        origin.map((o) => ({ ...o, x: o.x + d.x, y: o.y + d.y })),
        st.project.room,
        others,
        reach(),
      );
      delta = { x: d.x + s.dx, y: d.y + s.dy };
      guides = s.guides;
      marks = s.marks;
    }
    // A locked axis keeps the other coordinate, and only the guides along the free axis.
    if (axis === "x") {
      delta = { x: delta.x, y: 0 };
      guides = guides.filter((g) => Math.abs(g.a.x - g.b.x) < 0.5);
    } else if (axis === "y") {
      delta = { x: 0, y: delta.y };
      guides = guides.filter((g) => Math.abs(g.a.y - g.b.y) < 0.5);
    }
    if (axis) marks = marks.filter((m) => guides.some((g) => Math.abs((axis === "x" ? g.a.x : g.a.y) - (axis === "x" ? m.x : m.y)) < 0.5));
    delta = { x: round(delta.x), y: round(delta.y) };
    applyTransform(session, (o) => ({ x: round(o.x + delta.x), y: round(o.y + delta.y), ...(rotation !== null && axis === null ? { rotation } : {}) }));
    return { delta, guides, marks };
  };

  /** Applies a running operator for the cursor and shows its line, readout and status. */
  const updateOperator = (run: Running, at: Vec2) => {
    const st = useStore.getState();
    const { op, session } = run;
    const screenAt = toScreen(vpRef.current, at);
    if (op.kind === "grab") {
      const typed = op.typed !== "" && op.typed !== "-";
      const axis = op.axis === "free" ? null : op.axis;
      // A typed value is exact; otherwise the move snaps like a mouse drag (Alt: free).
      const { delta, guides, marks } = moveSession(session, grabDelta(op, at, 0), alt.current || typed, axis);
      const text = axis === "x" ? `X ${num(delta.x)} mm` : axis === "y" ? `Y ${num(delta.y)} mm` : `${num(Math.hypot(delta.x, delta.y))} mm`;
      setLive({ guides, marks, frame: null, readout: { at: screenAt, text: op.typed ? `${text}  [${op.typed}]` : text }, opLine: { a: run.anchor, b: add(run.anchor, delta), axis } });
      // The label from the applied offset, so it shows what snapping made of the mouse move.
      st.setStatus(typed ? operatorLabel(op, at, st.prefs.grid, alt.current) : operatorLabel(op, add(op.start, delta), 0, alt.current));
    } else {
      const angle = rotateAngle(op, at, alt.current);
      applyTransform(session, (o) => rotateItemAround(o, op.pivot, angle));
      setLive({ ...IDLE, readout: { at: screenAt, text: `${num(angle, Number.isInteger(angle) ? 0 : 1)}°` }, opLine: { a: op.pivot, b: at, axis: null } });
      st.setStatus(operatorLabel(op, at, 0, alt.current));
    }
  };

  const endOperator = (confirm: boolean) => {
    const run = running.current;
    if (!run) return;
    running.current = null;
    run.done();
    if (confirm) confirmTransform(run.session);
    else cancelTransform(run.session);
    setLive(IDLE);
    useStore.getState().setStatus(null);
  };

  const startOperator = (kind: "grab" | "rotate" | "duplicate") => {
    const at = cursor.current;
    if (!at) return false;
    const session = kind === "duplicate" ? beginDuplicate() : beginTransform();
    if (!session) return false;
    const anchor = selectionCentre([...session.origin.values()]);
    const op = kind === "rotate" ? startRotate(anchor, at) : startGrab(at);
    running.current = { op, session, anchor, done: registerOperator(() => endOperator(false)) };
    setHover(null);
    updateOperator(running.current, at);
    return true;
  };

  const endDrag = (confirm: boolean) => {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (d?.kind === "items" && d.session) {
      d.done?.();
      if (confirm) confirmTransform(d.session);
      else cancelTransform(d.session);
    }
    if (d && d.kind !== "pan") {
      setLive(IDLE);
      useStore.getState().setStatus(null);
    }
  };

  // The keys of the arrange mode, seen before the generic shortcuts (lib/shortcuts.ts).
  const keyHandler = useRef<(e: KeyboardEvent) => boolean>(() => false);
  keyHandler.current = (e) => {
    const run = running.current;
    if (run) {
      const r = operatorKey(run.op, e.key);
      if (r === "confirm" || r === "cancel") endOperator(r === "confirm");
      else if (r) {
        run.op = r.op;
        updateOperator(run, lastCursor.current);
      }
      // Every other key waits until the operator ends.
      return true;
    }
    if (drag.current) {
      if (e.key === "Escape") endDrag(false);
      return true;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod || e.altKey || e.repeat) return false;
    const key = e.key.toLowerCase();
    if (boxPending.current && e.key === "Escape") {
      boxPending.current = false;
      useStore.getState().setStatus(null);
      return true;
    }
    // The operators work where the cursor is: over the plan.
    if (!cursor.current) return false;
    if (key === "g" && !e.shiftKey) return startOperator("grab");
    if (key === "r" && !e.shiftKey) return startOperator("rotate");
    if (key === "d" && e.shiftKey) return startOperator("duplicate");
    if (key === "b" && !e.shiftKey) {
      boxPending.current = true;
      useStore.getState().setStatus(t("plan.boxHint"));
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (roomEdit) return;
    return setModeKeyHandler((e) => keyHandler.current(e));
  }, [roomEdit]);

  // Space held over the plan pans with the left button; Alt is tracked for the operators.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      alt.current = e.altKey;
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName));
      if (e.key === " " && cursor.current && !running.current && !typing) {
        space.current = true;
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      alt.current = e.altKey;
      if (e.key === " ") space.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // Leaving the arrange mode (or the plan) in the middle of an operator or drag cancels it as
  // Escape does, as the room mode and the 3D view do: what was half moved goes back, the gesture
  // ends so undo is not left blocked, and the selection of the new mode stays as it is.
  const finishAll = useRef(() => {});
  finishAll.current = () => {
    if (running.current) endOperator(false);
    if (drag.current) endDrag(false);
    boxPending.current = false;
    setHover(null);
  };
  useEffect(() => {
    if (roomEdit) finishAll.current();
  }, [roomEdit]);
  useEffect(() => () => finishAll.current(), []);

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (roomEdit) return;
    const st = useStore.getState();
    alt.current = e.altKey;
    if (running.current) {
      e.preventDefault();
      if (e.button === 0) endOperator(true);
      else if (e.button === 2) endOperator(false);
      return;
    }
    if (drag.current?.kind === "items" && e.button === 2) {
      endDrag(false);
      return;
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    // Middle or right button, or Space held: pan.
    if (e.button === 1 || e.button === 2 || (e.button === 0 && space.current)) {
      drag.current = { kind: "pan", start: { x: e.clientX, y: e.clientY }, ox: vp.ox, oy: vp.oy, button: e.button };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;
    const p = point(e);
    cursor.current = p;
    lastCursor.current = p;
    const screen = { x: e.clientX, y: e.clientY };
    const toggle = e.ctrlKey || e.metaKey;
    const hit = boxPending.current ? null : hitItem(st.project.items, p, st.selection.items);
    if (hit) {
      const ids = st.selection.items;
      let toggleOff: string | null = null;
      if (e.shiftKey || toggle) {
        // Shift or Ctrl click toggles; a selected item leaves the selection on release, so it can still be dragged.
        if (ids.includes(hit.id)) toggleOff = hit.id;
        else st.select({ items: [...ids, hit.id], opening: null });
      } else if (!ids.includes(hit.id)) st.select({ items: [hit.id], opening: null });
      drag.current = { kind: "items", start: p, screen, session: null, done: null, toggleOff };
      return;
    }
    boxPending.current = false;
    if (st.status) st.setStatus(null);
    const mode: SelectMode = toggle ? "toggle" : e.shiftKey ? "add" : "replace";
    drag.current = { kind: "frame", start: p, screen, end: p, active: false, mode };
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (roomEdit) return;
    const p = point(e);
    cursor.current = p;
    lastCursor.current = p;
    alt.current = e.altKey;
    props.onCursor?.(p);
    const run = running.current;
    if (run) {
      updateOperator(run, p);
      return;
    }
    const d = drag.current;
    const st = useStore.getState();
    if (!d) {
      setHover(hitItem(st.project.items, p, st.selection.items)?.id ?? null);
      return;
    }
    const far = Math.hypot(e.clientX - (d.kind === "pan" ? d.start.x : d.screen.x), e.clientY - (d.kind === "pan" ? d.start.y : d.screen.y)) >= DRAG_THRESHOLD;
    switch (d.kind) {
      case "pan":
        setVp({ ...vp, ox: d.ox + e.clientX - d.start.x, oy: d.oy + e.clientY - d.start.y });
        break;
      case "items": {
        if (!d.session) {
          if (!far) return;
          d.session = beginTransform();
          d.toggleOff = null;
          if (!d.session) return;
          d.done = registerOperator(() => endDrag(false));
          setHover(null);
        }
        const { delta, guides, marks } = moveSession(d.session, sub(p, d.start), e.altKey, null);
        setLive({ ...IDLE, guides, marks, readout: { at: toScreen(vp, p), text: `${num(Math.hypot(delta.x, delta.y))} mm` } });
        break;
      }
      case "frame": {
        if (!d.active && !far) return;
        d.active = true;
        d.end = p;
        setHover(null);
        setLive({ ...IDLE, frame: { a: d.start, b: p, crossing: p.x < d.start.x } });
        break;
      }
    }
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (roomEdit) return;
    const d = drag.current;
    const st = useStore.getState();
    if (d?.kind === "pan" && d.button === 2 && e.type === "pointerup" && Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) < DRAG_THRESHOLD) {
      // A right click without moving: the menu for the item under the pointer, or for the selection.
      const hit = hitItem(st.project.items, point(e), st.selection.items);
      if (hit && !st.selection.items.includes(hit.id)) st.select({ items: [hit.id], opening: null });
      endDrag(true);
      setMenu({ at: { x: e.clientX, y: e.clientY }, entries: arrangeMenu() });
      return;
    }
    if (d?.kind === "items" && !d.session && d.toggleOff) {
      st.select({ items: st.selection.items.filter((id) => id !== d.toggleOff) });
    } else if (d?.kind === "frame") {
      if (d.active) {
        const hits = itemsInFrame(st.project.items, d.start, d.end);
        st.select({ items: combineSelection(st.selection.items, hits, d.mode), opening: null });
      } else if (d.mode === "replace") st.select({ items: [], opening: null });
    }
    endDrag(true);
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
    // Equipment belongs to the arrange mode: dropping some there switches to it.
    st.setMode("arrange");
    const draft = itemFromCatalog(entry, p.x, p.y);
    // Units snap flush to neighbours of the same placement (a slicer to other table-top units).
    const placement = placementOf(entry.kind);
    const others = st.project.items.filter((i) => placementOf(kindOf(i.catalogId)) === placement);
    const s = snapItem(draft, st.project.room, others, st.prefs.grid, true, wallSnapReach(entry.kind));
    st.addItems([{ ...draft, x: s.x, y: s.y, rotation: s.rotation }]);
  };

  const transform = `translate(${vp.ox} ${vp.oy}) scale(${vp.k})`;
  const operating = running.current !== null;
  const svgClass = roomEdit ? undefined : operating ? "is-operating" : live.frame || boxPending.current ? "is-framing" : hover ? "is-hovering-item" : undefined;

  return (
    <div
      ref={ref}
      className={panning ? "view2d is-panning" : "view2d"}
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
          className={svgClass}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => {
            cursor.current = null;
            setHover(null);
          }}
        >
          <GridPattern vp={vp} />
          <rect width={size.w} height={size.h} fill="url(#plan-grid)" />
          <g transform={transform}>
            <DrawingShapes drawing={drawing} />
            <DrawingShapes drawing={overlay} />
            {!roomEdit && selected.map((it) => <path key={it.id} d={polyPath(footprint(it))} className="draw-selected" />)}
            {!roomEdit && hover && !selection.items.includes(hover) && <HoverOutline item={project.items.find((i) => i.id === hover)} />}
          </g>
          {!roomEdit && <EditOverlay vp={vp} width={size.w} height={size.h} selected={selected} live={live} />}
        </svg>
      )}
      {!roomEdit && live.readout && (
        <div className="plan-readout" style={{ left: live.readout.at.x + READOUT_OFFSET, top: live.readout.at.y + READOUT_OFFSET }} aria-hidden>
          {live.readout.text}
        </div>
      )}
      {/* Room mode: the room editor lies above the plan and takes all pointer input (RoomEditLayer.tsx). */}
      {roomEdit && size.w > 0 && (
        <RoomEditLayer vp={vp} width={size.w} height={size.h} setVp={setVp} onCursor={props.onCursor} onMenu={(at, world, hit) => setMenu({ at, entries: roomMenu(world, hit) })} />
      )}
      {measuring && size.w > 0 && <MeasureLayer vp={vp} width={size.w} height={size.h} setVp={setVp} onCursor={props.onCursor} />}
      {menu && <ContextMenu at={menu.at} entries={menu.entries} label={t("contextMenu.title")} backLabel={t("contextMenu.back")} onClose={() => setMenu(null)} />}
    </div>
  );
}

/** Selection corners, snapping guides, the selection frame and the operator line, in screen pixels. */
function EditOverlay({ vp, width, height, selected, live }: { vp: Viewport; width: number; height: number; selected: readonly Item[]; live: Live }) {
  const s = (p: Vec2) => toScreen(vp, p);
  const frame = live.frame && bounds([s(live.frame.a), s(live.frame.b)]);
  const line = live.opLine;
  return (
    <g className="plan-edit" aria-hidden>
      {selected.flatMap((it) =>
        footprint(it).map((c, i) => {
          const p = s(c);
          return <rect key={`${it.id}-${i}`} x={p.x - CORNER_R} y={p.y - CORNER_R} width={CORNER_R * 2} height={CORNER_R * 2} className="plan-corner" />;
        }),
      )}
      {line?.axis && (
        <path
          d={line.axis === "x" ? `M0 ${s(line.a).y}H${width}` : `M${s(line.a).x} 0V${height}`}
          className="plan-axis"
        />
      )}
      {line && <path d={`M${s(line.a).x} ${s(line.a).y}L${s(line.b).x} ${s(line.b).y}`} className="plan-op-line" />}
      {live.guides.map((g, i) => {
        const a = s(g.a);
        const b = s(g.b);
        const dir = norm2(sub(b, a));
        const p = sub(a, scale(dir, GUIDE_OVERSHOOT));
        const q = add(b, scale(dir, GUIDE_OVERSHOOT));
        return <path key={i} d={`M${p.x} ${p.y}L${q.x} ${q.y}`} className={`plan-guide is-${g.kind}`} />;
      })}
      {live.marks.map((m, i) => {
        const p = s(m);
        return <path key={i} d={`M${p.x - MARK_R} ${p.y - MARK_R}L${p.x + MARK_R} ${p.y + MARK_R}M${p.x - MARK_R} ${p.y + MARK_R}L${p.x + MARK_R} ${p.y - MARK_R}`} className="plan-mark" />;
      })}
      {frame && <rect x={frame.minX} y={frame.minY} width={frame.maxX - frame.minX} height={frame.maxY - frame.minY} className={live.frame!.crossing ? "plan-frame is-crossing" : "plan-frame"} />}
    </g>
  );
}

function norm2(v: Vec2): Vec2 {
  const l = Math.hypot(v.x, v.y);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
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
 * Dimensions from the selected item's bounding box to the nearest wall, partition or floor unit
 * in each of the four directions: what a planner checks while placing (aisle widths, gaps).
 */
export function distanceDims(project: Project, item: Item): Shape[] {
  const b = bounds(footprint(item));
  const obstacles: [Vec2, Vec2][] = walls(project.room).map((w) => [w.a, w.b]);
  const outline = (pts: Vec2[]) => {
    for (let i = 0; i < pts.length; i++) obstacles.push([pts[i], pts[(i + 1) % pts.length]]);
  };
  for (const p of project.room.partitions ?? []) outline(partitionOutline(p));
  for (const o of project.items) {
    if (o.id === item.id || placementOf(kindOf(o.catalogId)) !== "floor") continue;
    outline(footprint(o));
  }
  const mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const rays: { from: Vec2; dir: Vec2 }[] = [
    { from: { x: b.minX, y: mid.y }, dir: { x: -1, y: 0 } },
    { from: { x: b.maxX, y: mid.y }, dir: { x: 1, y: 0 } },
    { from: { x: mid.x, y: b.minY }, dir: { x: 0, y: -1 } },
    { from: { x: mid.x, y: b.maxY }, dir: { x: 0, y: 1 } },
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
