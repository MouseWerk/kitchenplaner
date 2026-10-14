// The room mode of the floor plan (Blender's edit mode): an overlay above the plan drawing that
// takes all pointer input while the mode is "room". Tools:
//
// - select: click or frame corners, walls, partitions and openings; G grabs the selection
//   (X/Y lock, typed distance, Enter or click confirms, Escape or right click cancels), dragging
//   a handle moves it directly, a double click on a wall inserts a corner, Delete or X removes;
// - outline: draws a new room outline wall by wall (model/wallDraw.ts);
// - partition: draws partitions from end to end.
//
// Every edit is one undo step: a grab works on a snapshot of the room and is restored exactly on
// cancel (as the item transforms in lib/commands.ts do). Leaving the mode or the plan in the
// middle of a grab cancels it, as in the arrange mode.

import { useEffect, useReducer, useRef, type PointerEvent as RPointerEvent } from "react";
import { add, dist, dot, norm, round, scale, snapValue, sub, walls } from "../model/geometry";
import { newId } from "../model/project";
import {
  clampToHost,
  combine,
  deleteSelection,
  frameSelect,
  hitRoom,
  insertCorner,
  MIN_PARTITION_LENGTH,
  moveCorners,
  movePartitions,
  openingHost,
  updatePartition,
  type RoomHit,
  type SelectMode,
} from "../model/roomEdit";
import type { Partition, Room, Vec2 } from "../model/types";
import { closesOutline, isValidOutline, nextPoint, outlinePointAction, replaceOutline, snapPoint, type Guide, type Segment, type Snapped } from "../model/wallDraw";
import { parseNumber } from "../components/Fields";
import { noteOperatorChange, registerOperator, restoreSnapshot, takeSnapshot, type OperatorSnapshot } from "../lib/commands";
import { grabDelta, operatorKey, operatorLabel, startGrab, type GrabOp } from "../lib/modal";
import { setModeKeyHandler } from "../lib/shortcuts";
import { num, t, useT } from "../lib/i18n";
import { toast } from "../lib/toast";
import { toScreen, toWorld, type Viewport } from "../lib/viewport";
import { DIM_GAP } from "../model/plan";
import { TEXT } from "../render/drawing";
import { SCREEN_PAPER_SCALE } from "../components/DrawingSvg";
import { useStore, type AppState } from "../store/store";

export interface RoomEditLayerProps {
  vp: Viewport;
  /** Size of the plan pane in pixels. */
  width: number;
  height: number;
  /** Pans the plan (middle or right drag on the overlay). */
  setVp: (vp: Viewport) => void;
  onCursor?: (p: { x: number; y: number } | null) => void;
}

/** Pick distance around handles, walls and openings (px). */
const PICK_PX = 7;
/** Snap distance to corners, alignments and walls (px). */
const SNAP_PX = 10;
/** Pointer movement (px) before a press becomes a drag or a frame. */
const DRAG_THRESHOLD = 3;
/** Half the size of a corner handle (px). */
const HANDLE_HALF = 4;
/** Radius of a partition end handle (px). */
const END_R = 4.5;
/** Walls shorter than this on screen (px) get no length label. */
const LABEL_MIN_PX = 48;
/** New partitions (mm). */
const PARTITION_THICKNESS = 100;

interface Grab {
  kind: "grab";
  op: GrabOp;
  /** The state before the grab: what a cancel puts back. */
  snap: OperatorSnapshot;
  /** Unregisters the grab's cancel (lib/commands.ts registerOperator). */
  done: () => void;
  /** The room when the grab started; every update is computed from it. */
  origin: Room;
  corners: number[];
  partitions: string[];
  opening: string | null;
  /** A partition end dragged by its handle: only that end moves. */
  end: { id: string; end: "a" | "b" } | null;
  /** Started by dragging: releasing the button confirms. */
  byDrag: boolean;
}

type Interaction =
  | { kind: "pan"; client: Vec2; ox: number; oy: number }
  | { kind: "press"; hit: RoomHit | null; client: Vec2; world: Vec2; mode: SelectMode; wasSelected: boolean }
  | { kind: "frame"; from: Vec2; mode: SelectMode }
  | Grab;

interface Editor {
  inter: Interaction | null;
  /** Cursor in plan millimetres; null outside the plan (kept while a grab runs). */
  cursor: Vec2 | null;
  hover: RoomHit | null;
  /** Points of the outline being drawn, or the start of the partition being drawn. */
  draft: Vec2[];
  /** The length typed while drawing ("" when the mouse drives it). */
  typed: string;
  /** The snapped point of the running drawing or grab, with its guides. */
  snap: Snapped | null;
  closing: boolean;
  shift: boolean;
  alt: boolean;
}

const EMPTY_ROOM_SELECTION = { corners: [], partitions: [], opening: null };

/** Removes the selected corners, partitions and opening as one undo step; tells why when corners cannot go. */
export function removeRoomSelection(): boolean {
  const st = useStore.getState();
  const sel = st.selection;
  if (sel.corners.length === 0 && sel.partitions.length === 0 && !sel.opening) return false;
  const next = deleteSelection(st.project.room, sel);
  if (!next) {
    toast(t("roomEdit.cannotRemoveCorners"), "danger");
    return true;
  }
  st.change((p) => ({ ...p, room: next }));
  st.select(EMPTY_ROOM_SELECTION);
  return true;
}

/** The lines a partition end snaps onto: the outer walls and the faces of the other partitions. */
function snapSegments(room: Room, except?: string): Segment[] {
  const segs: Segment[] = walls(room).map((w) => ({ a: w.a, b: w.b }));
  for (const w of room.partitions) {
    if (w.id === except) continue;
    const d = norm(sub(w.b, w.a));
    const n = scale({ x: -d.y, y: d.x }, w.thickness / 2);
    segs.push({ a: add(w.a, n), b: add(w.b, n) }, { a: sub(w.a, n), b: sub(w.b, n) });
  }
  return segs;
}

/** Corners and partition ends to snap onto, without those of partition `except`. */
function snapCorners(room: Room, except?: string): Vec2[] {
  return [...room.points, ...room.partitions.filter((w) => w.id !== except).flatMap((w) => [w.a, w.b])];
}

function isSelected(hit: RoomHit, sel: AppState["selection"], room: Room): boolean {
  switch (hit.kind) {
    case "corner":
      return sel.corners.includes(hit.index);
    case "wall":
      return sel.corners.includes(hit.index) && sel.corners.includes((hit.index + 1) % room.points.length);
    case "partition":
    case "end":
      return sel.partitions.includes(hit.id);
    case "opening":
      return sel.opening === hit.id;
  }
}

function selectHit(hit: RoomHit, mode: SelectMode) {
  const st = useStore.getState();
  const sel = st.selection;
  if (hit.kind === "opening") {
    st.select({ ...EMPTY_ROOM_SELECTION, opening: mode === "toggle" && sel.opening === hit.id ? null : hit.id });
    return;
  }
  const n = st.project.room.points.length;
  const corners = hit.kind === "corner" ? [hit.index] : hit.kind === "wall" ? [hit.index, (hit.index + 1) % n] : [];
  const partitions = hit.kind === "partition" || hit.kind === "end" ? [hit.id] : [];
  if (mode === "replace") st.select({ corners, partitions, opening: null });
  else st.select({ corners: combine(sel.corners, corners, mode), partitions: combine(sel.partitions, partitions, mode), opening: null });
}

export function RoomEditLayer(props: RoomEditLayerProps) {
  useT();
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const showDims = useStore((s) => s.prefs.showDims);
  const tool = useStore((s) => s.roomTool);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const vpRef = useRef(props.vp);
  vpRef.current = props.vp;
  const propsRef = useRef(props);
  propsRef.current = props;
  const ed = useRef<Editor>({ inter: null, cursor: null, hover: null, draft: [], typed: "", snap: null, closing: false, shift: false, alt: false });
  const [, bump] = useReducer((x: number) => x + 1, 0);

  // ---- Grab (G, or dragging a handle).

  const beginGrab = (byDrag: boolean, at: Vec2, end: Grab["end"] = null): boolean => {
    const st = useStore.getState();
    const sel = st.selection;
    if (!end && sel.corners.length === 0 && sel.partitions.length === 0 && !sel.opening) return false;
    const snap = takeSnapshot();
    st.beginGesture();
    ed.current.inter = {
      kind: "grab",
      op: startGrab(at),
      snap,
      done: registerOperator(() => endGrab(false)),
      origin: st.project.room,
      corners: end || sel.opening ? [] : sel.corners,
      partitions: end || sel.opening ? [] : sel.partitions,
      opening: end ? null : sel.opening,
      end,
      byDrag,
    };
    applyGrab();
    return true;
  };

  const applyGrab = () => {
    const g = ed.current.inter;
    if (g?.kind !== "grab") return;
    const st = useStore.getState();
    const e = ed.current;
    const cursor = e.cursor ?? g.op.start;
    const grid = e.alt ? 0 : st.prefs.grid;
    const radius = SNAP_PX / vpRef.current.k;
    const typed = g.op.typed === "" || g.op.typed === "-" ? null : parseNumber(g.op.typed);
    const base = g.origin;
    let room = base;
    let snap: Snapped | null = null;
    let label = operatorLabel(g.op, cursor, grid, false);
    if (g.end) {
      const w = base.partitions.find((x) => x.id === g.end!.id);
      if (!w) return;
      const p0 = w[g.end.end];
      const other = w[g.end.end === "a" ? "b" : "a"];
      let p: Vec2;
      if (typed !== null || g.op.axis !== "free") p = add(p0, grabDelta(g.op, cursor, grid));
      else {
        snap = nextPoint(other, add(p0, sub(cursor, g.op.start)), { grid, radius, corners: snapCorners(base, w.id), segments: snapSegments(base, w.id), free: e.shift, typed: null });
        p = snap.p;
      }
      room = updatePartition(base, w.id, { [g.end.end]: p });
    } else if (g.opening) {
      const o = base.openings.find((x) => x.id === g.opening);
      const h = o && openingHost(base, o);
      if (!o || !h) return;
      // Openings slide along their host: the typed value is the distance along it, the sign follows the mouse.
      const along = dot(sub(cursor, g.op.start), h.dir);
      const move = typed !== null ? typed * (along < 0 ? -1 : 1) : snapValue(along, grid);
      const moved = clampToHost(base, { ...o, offset: round(o.offset + move) });
      room = { ...base, openings: base.openings.map((x) => (x.id === o.id ? moved : x)) };
      label = `G${g.op.typed ? `  [${g.op.typed}]` : ""}  ${t("inspector.offset")} ${num(moved.offset)} mm`;
    } else {
      let delta = grabDelta(g.op, cursor, grid);
      // A single corner snaps onto the other corners and lines up with them.
      if (g.corners.length === 1 && g.partitions.length === 0 && typed === null && g.op.axis === "free" && !e.alt) {
        const i = g.corners[0];
        const p0 = base.points[i];
        snap = snapPoint(add(p0, sub(cursor, g.op.start)), { grid, radius, corners: snapCorners(base).filter((c) => c !== p0) });
        delta = sub(snap.p, p0);
      }
      const moved = moveCorners(base, g.corners, delta);
      if (moved === base && g.corners.length > 0 && (delta.x !== 0 || delta.y !== 0)) {
        // No room there (walls crossing, no floor): the last valid state stays, and the status says why.
        e.snap = null;
        st.setStatus(`${label}  ·  ${t("roomEdit.grabInvalid")}`);
        bump();
        return;
      }
      room = movePartitions(moved, g.partitions, delta);
    }
    e.snap = snap;
    if (room !== st.project.room) {
      st.change((p) => ({ ...p, room }), { gesture: true });
      noteOperatorChange(g.snap);
    }
    st.setStatus(label);
    bump();
  };

  const endGrab = (keep: boolean) => {
    const g = ed.current.inter;
    if (g?.kind !== "grab") return;
    const st = useStore.getState();
    g.done();
    st.endGesture();
    ed.current.inter = null;
    ed.current.snap = null;
    // A grab that changed nothing leaves no undo step.
    if (!keep || JSON.stringify(st.project.room) === JSON.stringify(g.snap.before.project.room)) restoreSnapshot(g.snap);
    st.setStatus(null);
    bump();
  };

  // ---- Drawing (outline and partition tools).

  const typedLength = () => {
    const s = ed.current.typed;
    return s === "" ? null : parseNumber(s);
  };

  /** Recomputes the snapped point of the drawing and the status line. */
  const updateDraw = () => {
    const e = ed.current;
    const st = useStore.getState();
    const tool = st.roomTool;
    if (tool === "select") return;
    const room = st.project.room;
    const grid = e.alt ? 0 : st.prefs.grid;
    const radius = SNAP_PX / vpRef.current.k;
    const typed = typedLength();
    const last = e.draft[e.draft.length - 1];
    e.closing = false;
    if (!e.cursor) e.snap = null;
    else if (tool === "outline") {
      const corners = [...room.points, ...e.draft];
      if (!last) e.snap = snapPoint(e.cursor, { grid, radius, corners });
      else if (typed === null && closesOutline(e.draft, e.cursor, radius)) {
        e.closing = true;
        e.snap = { p: e.draft[0], target: e.draft[0], guides: [] };
      } else {
        e.snap = nextPoint(last, e.cursor, { grid, radius, corners, free: e.shift, typed });
        // A typed length can end the last wall exactly on the start: that closes the room too.
        e.closing = outlinePointAction(e.draft, e.snap.p) === "close";
      }
    } else {
      const opts = { grid, radius, corners: snapCorners(room), segments: snapSegments(room) };
      e.snap = last ? nextPoint(last, e.cursor, { ...opts, free: e.shift, typed }) : snapPoint(e.cursor, opts);
    }
    const typedText = e.typed ? `  [${e.typed}]` : "";
    if (last && e.snap) {
      const length = num(dist(last, e.snap.p));
      st.setStatus(tool === "outline" ? `${t("roomEdit.wallN", { n: e.draft.length })}  ${length} mm${typedText}  ·  ${t("roomEdit.outlineKeys")}` : `${t("roomTool.partition")}  ${length} mm${typedText}  ·  ${t("roomEdit.partitionKeys")}`);
    } else st.setStatus(t(tool === "outline" ? "roomTool.outlineHint" : "roomTool.partitionHint"));
    bump();
  };

  const clearDraft = () => {
    ed.current.draft = [];
    ed.current.typed = "";
    updateDraw();
  };

  const finishOutline = () => {
    const pts = ed.current.draft;
    if (!isValidOutline(pts)) {
      toast(t("roomEdit.invalidOutline"), "danger");
      return;
    }
    const st = useStore.getState();
    st.change((p) => ({ ...p, room: replaceOutline(p.room, pts) }));
    st.select(EMPTY_ROOM_SELECTION);
    clearDraft();
  };

  /** Places the snapped point: the next outline corner, or a partition end. */
  const placePoint = () => {
    const e = ed.current;
    const st = useStore.getState();
    if (!e.snap) return;
    if (st.roomTool === "outline") {
      const action = e.closing ? "close" : outlinePointAction(e.draft, e.snap.p);
      if (action === "close") return finishOutline();
      // On a point already drawn: a wall without length, or a loop through the drawing.
      if (action === "reject") return;
      e.draft = [...e.draft, e.snap.p];
      e.typed = "";
      return updateDraw();
    }
    const a = e.draft[0];
    if (!a) {
      e.draft = [e.snap.p];
      return updateDraw();
    }
    if (dist(a, e.snap.p) < MIN_PARTITION_LENGTH) return;
    const w: Partition = { id: newId(), a, b: e.snap.p, thickness: PARTITION_THICKNESS, height: st.project.room.height };
    st.change((p) => ({ ...p, room: { ...p.room, partitions: [...p.room.partitions, w] } }));
    st.select({ ...EMPTY_ROOM_SELECTION, partitions: [w.id] });
    clearDraft();
  };

  const drawKey = (e: KeyboardEvent): boolean => {
    const s = ed.current;
    const tool = useStore.getState().roomTool;
    if (/^[0-9]$/.test(e.key) || ((e.key === "." || e.key === ",") && !/[.,]/.test(s.typed))) {
      // Digits are lengths here, never the layout keys.
      if (s.draft.length > 0) s.typed += e.key;
      updateDraw();
      return true;
    }
    switch (e.key) {
      case "Backspace":
        if (s.typed) s.typed = s.typed.slice(0, -1);
        else s.draft = s.draft.slice(0, -1);
        updateDraw();
        return true;
      case "Enter":
        if (s.typed && s.draft.length > 0) placePoint();
        else if (tool === "outline" && s.draft.length >= 3) finishOutline();
        return true;
      case "Escape":
        if (s.draft.length > 0 || s.typed) clearDraft();
        else useStore.getState().setRoomTool("select");
        return true;
    }
    if (e.code === "KeyC" && tool === "outline") {
      if (s.draft.length >= 3) finishOutline();
      return true;
    }
    return false;
  };

  // ---- Keys.

  const onKey = (e: KeyboardEvent): boolean => {
    const s = ed.current;
    const st = useStore.getState();
    const inter = s.inter;
    const mod = e.ctrlKey || e.metaKey;
    if (inter?.kind === "grab") {
      // Nothing else runs in the middle of a move (an undo would land on half of it).
      if (mod) return true;
      const r = operatorKey(inter.op, e.key);
      if (r === "confirm") endGrab(true);
      else if (r === "cancel") endGrab(false);
      else if (r && r.op.kind === "grab") {
        inter.op = r.op;
        applyGrab();
      }
      return true;
    }
    if (inter?.kind === "frame" && e.key === "Escape") {
      s.inter = null;
      bump();
      return true;
    }
    if (e.key === "Shift" || e.key === "Alt") {
      s.shift = e.shiftKey;
      s.alt = e.altKey;
      updateDraw();
      return false;
    }
    if (st.roomTool !== "select") return mod ? false : drawKey(e);
    if (mod) {
      if (e.code !== "KeyA") return false;
      st.select({ corners: st.project.room.points.map((_, i) => i), partitions: st.project.room.partitions.map((w) => w.id), opening: null });
      return true;
    }
    if (e.code === "KeyA") {
      if (e.altKey) st.select(EMPTY_ROOM_SELECTION);
      else st.select({ corners: st.project.room.points.map((_, i) => i), partitions: st.project.room.partitions.map((w) => w.id), opening: null });
      return true;
    }
    if (e.altKey) return false;
    // G works where the cursor is: over the plan (as in the arrange mode).
    if (e.code === "KeyG") return s.cursor ? beginGrab(false, s.cursor) : false;
    if (e.key === "Delete" || e.key === "Backspace" || e.code === "KeyX") return removeRoomSelection();
    if (e.key === "Escape") {
      const sel = st.selection;
      if (sel.corners.length === 0 && sel.partitions.length === 0 && !sel.opening) return false;
      st.select(EMPTY_ROOM_SELECTION);
      return true;
    }
    return false;
  };

  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;

  useEffect(() => {
    const off = setModeKeyHandler((e) => onKeyRef.current(e));
    // Items are dimmed while the room is edited.
    const host = svgRef.current?.parentElement;
    host?.classList.add("is-room-mode");
    return () => {
      off();
      host?.classList.remove("is-room-mode");
      const g = ed.current.inter;
      if (g?.kind === "grab") {
        g.done();
        useStore.getState().endGesture();
        restoreSnapshot(g.snap);
      }
      useStore.getState().setStatus(null);
    };
  }, []);

  // A new tool starts with an empty drawing.
  useEffect(() => {
    ed.current.draft = [];
    ed.current.typed = "";
    ed.current.snap = null;
    if (tool === "select") useStore.getState().setStatus(null);
    else updateDraw();
    // updateDraw reads everything from refs and the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // ---- Pointer.

  const worldOf = (ev: { clientX: number; clientY: number }): Vec2 => {
    const r = svgRef.current!.getBoundingClientRect();
    return toWorld(vpRef.current, { x: ev.clientX - r.left, y: ev.clientY - r.top });
  };

  const onPointerDown = (ev: RPointerEvent<SVGSVGElement>) => {
    const s = ed.current;
    const st = useStore.getState();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const p = worldOf(ev);
    s.cursor = p;
    s.shift = ev.shiftKey;
    s.alt = ev.altKey;
    if (s.inter?.kind === "grab" && !s.inter.byDrag) {
      endGrab(ev.button === 0);
      return;
    }
    if (ev.button === 1 || ev.button === 2) {
      s.inter = { kind: "pan", client: { x: ev.clientX, y: ev.clientY }, ox: vpRef.current.ox, oy: vpRef.current.oy };
      return;
    }
    if (ev.button !== 0) return;
    if (st.roomTool !== "select") {
      updateDraw();
      placePoint();
      return;
    }
    const hit = hitRoom(st.project.room, p, PICK_PX / vpRef.current.k);
    const mode: SelectMode = ev.shiftKey ? "add" : ev.ctrlKey || ev.metaKey ? "toggle" : "replace";
    const wasSelected = !!hit && isSelected(hit, st.selection, st.project.room);
    if (hit && !(mode === "replace" && wasSelected)) selectHit(hit, mode);
    s.inter = { kind: "press", hit, client: { x: ev.clientX, y: ev.clientY }, world: p, mode, wasSelected };
  };

  const onPointerMove = (ev: RPointerEvent<SVGSVGElement>) => {
    const s = ed.current;
    const st = useStore.getState();
    const p = worldOf(ev);
    s.cursor = p;
    s.shift = ev.shiftKey;
    s.alt = ev.altKey;
    props.onCursor?.(p);
    const inter = s.inter;
    if (inter?.kind === "pan") {
      propsRef.current.setVp({ ...vpRef.current, ox: inter.ox + ev.clientX - inter.client.x, oy: inter.oy + ev.clientY - inter.client.y });
      return;
    }
    if (inter?.kind === "press") {
      if (Math.hypot(ev.clientX - inter.client.x, ev.clientY - inter.client.y) < DRAG_THRESHOLD) return;
      const h = inter.hit;
      if (!h) s.inter = { kind: "frame", from: inter.world, mode: inter.mode };
      else if (h.kind === "end") beginGrab(true, inter.world, { id: h.id, end: h.end });
      else if (inter.mode === "toggle" && !isSelected(h, st.selection, st.project.room)) s.inter = null;
      else beginGrab(true, inter.world);
      bump();
      return;
    }
    if (inter?.kind === "grab") return applyGrab();
    if (inter?.kind === "frame") return bump();
    if (st.roomTool !== "select") return updateDraw();
    const hover = hitRoom(st.project.room, p, PICK_PX / vpRef.current.k);
    if (JSON.stringify(hover) !== JSON.stringify(s.hover)) {
      s.hover = hover;
      bump();
    }
  };

  const onPointerUp = (ev: RPointerEvent<SVGSVGElement>) => {
    const s = ed.current;
    const st = useStore.getState();
    const inter = s.inter;
    if (inter?.kind === "grab") {
      if (inter.byDrag) endGrab(true);
      return;
    }
    s.inter = null;
    if (inter?.kind === "frame") {
      const to = worldOf(ev);
      const box = { minX: Math.min(inter.from.x, to.x), maxX: Math.max(inter.from.x, to.x), minY: Math.min(inter.from.y, to.y), maxY: Math.max(inter.from.y, to.y) };
      // Dragged right to left: everything the frame touches.
      const picked = frameSelect(st.project.room, box, to.x < inter.from.x);
      const sel = st.selection;
      st.select({ corners: combine(sel.corners, picked.corners, inter.mode), partitions: combine(sel.partitions, picked.partitions, inter.mode), opening: null });
    } else if (inter?.kind === "press" && inter.mode === "replace") {
      // A plain click: only what was clicked stays selected (a press on a selection may have been the start of a drag).
      if (inter.hit) {
        if (inter.wasSelected) selectHit(inter.hit, "replace");
      } else st.select(EMPTY_ROOM_SELECTION);
    }
    bump();
  };

  const onDoubleClick = (ev: React.MouseEvent<SVGSVGElement>) => {
    const st = useStore.getState();
    if (st.roomTool !== "select") return;
    const p = worldOf(ev);
    const hit = hitRoom(st.project.room, p, PICK_PX / vpRef.current.k);
    if (hit?.kind !== "wall") return;
    const w = walls(st.project.room)[hit.index];
    const along = snapValue(dot(sub(p, w.a), w.dir), st.prefs.grid);
    const at = add(w.a, scale(w.dir, along));
    const split = insertCorner(st.project.room, hit.index, { x: round(at.x), y: round(at.y) }, st.prefs.grid);
    // Too close to an existing corner: nothing to add (and no empty undo step).
    if (!split) return;
    st.change((pr) => ({ ...pr, room: split }));
    st.select({ ...EMPTY_ROOM_SELECTION, corners: [hit.index + 1] });
  };

  const onPointerLeave = () => {
    const s = ed.current;
    s.hover = null;
    // A running grab keeps its last cursor, so it does not jump back to where it started.
    if (s.inter?.kind !== "grab") {
      s.cursor = null;
      updateDraw();
    }
    props.onCursor?.(null);
    bump();
  };

  // ---- Drawing.

  const { vp } = props;
  const S = (p: Vec2) => toScreen(vp, p);
  const pts = (list: readonly Vec2[]) => list.map((q) => `${S(q).x},${S(q).y}`).join(" ");
  const room = project.room;
  const ws = walls(room);
  const e = ed.current;
  const hover = e.inter ? null : e.hover;
  const n = room.points.length;
  const wallSelected = (i: number) => selection.corners.includes(i) && selection.corners.includes((i + 1) % n);
  const wallBand = (i: number) => {
    const w = ws[i];
    const out = scale(w.inward, -room.wallThickness);
    return [w.a, w.b, add(w.b, out), add(w.a, out)];
  };
  const partBand = (w: Partition, from = 0, to = dist(w.a, w.b)) => {
    const d = norm(sub(w.b, w.a));
    const nn = scale({ x: -d.y, y: d.x }, w.thickness / 2);
    const a = add(w.a, scale(d, from));
    const b = add(w.a, scale(d, to));
    return [add(a, nn), add(b, nn), sub(b, nn), sub(a, nn)];
  };
  const openingBand = (id: string): Vec2[] | null => {
    const o = room.openings.find((x) => x.id === id);
    if (!o) return null;
    if (o.partition) {
      const w = room.partitions.find((x) => x.id === o.partition);
      return w ? partBand(w, o.offset - o.width / 2, o.offset + o.width / 2) : null;
    }
    const w = ws[o.wall];
    if (!w) return null;
    const a = add(w.a, scale(w.dir, o.offset - o.width / 2));
    const b = add(w.a, scale(w.dir, o.offset + o.width / 2));
    const out = scale(w.inward, -room.wallThickness);
    return [a, b, add(b, out), add(a, out)];
  };
  const shapeOf = (h: RoomHit): Vec2[] | null => {
    if (h.kind === "wall") return wallBand(h.index);
    if (h.kind === "opening") return openingBand(h.id);
    if (h.kind === "partition" || h.kind === "end") {
      const w = room.partitions.find((x) => x.id === h.id);
      return w ? partBand(w) : null;
    }
    return null;
  };

  const tints: { key: string; pts: Vec2[]; cls: string }[] = [];
  ws.forEach((w) => wallSelected(w.index) && tints.push({ key: `w${w.index}`, pts: wallBand(w.index), cls: "room-tint is-selected" }));
  for (const w of room.partitions) if (selection.partitions.includes(w.id)) tints.push({ key: `p${w.id}`, pts: partBand(w), cls: "room-tint is-selected" });
  if (selection.opening) {
    const b = openingBand(selection.opening);
    if (b) tints.push({ key: "o", pts: b, cls: "room-tint is-selected" });
  }
  if (hover && !isSelected(hover, selection, room)) {
    const b = shapeOf(hover);
    if (b) tints.push({ key: "hover", pts: b, cls: "room-tint is-hover" });
  }

  const frame = e.inter?.kind === "frame" && e.cursor ? { a: S(e.inter.from), b: S(e.cursor), crossing: e.cursor.x < e.inter.from.x } : null;
  const guides: Guide[] = e.snap?.guides ?? [];
  const drawing = tool !== "select";
  const last = e.draft[e.draft.length - 1];
  const preview = drawing && e.snap ? e.snap.p : null;
  const cls = ["room-layer", drawing ? "is-drawing" : "", hover && (hover.kind === "corner" || hover.kind === "end") ? "is-over-handle" : hover ? "is-over-part" : ""].filter(Boolean).join(" ");

  return (
    <svg
      ref={svgRef}
      className={cls}
      width={props.width}
      height={props.height}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      onDoubleClick={onDoubleClick}
      onContextMenu={(ev) => ev.preventDefault()}
    >
      {tints.map((x) => (
        <polygon key={x.key} points={pts(x.pts)} className={x.cls} />
      ))}

      {wallLengthLabels(room, vp, showDims ? { gap: DIM_GAP * SCREEN_PAPER_SCALE, text: TEXT.normal * SCREEN_PAPER_SCALE } : null).map((l) => (
        <text key={`l${l.index}`} x={l.p.x} y={l.p.y} transform={`rotate(${l.angle} ${l.p.x} ${l.p.y})`} className="room-label" textAnchor="middle" dominantBaseline="central">
          {l.text}
        </text>
      ))}

      {guides.map((g, i) => {
        const a = S(g.from);
        const b = S(g.to);
        return <line key={`g${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="room-guide" />;
      })}

      {frame && <rect x={Math.min(frame.a.x, frame.b.x)} y={Math.min(frame.a.y, frame.b.y)} width={Math.abs(frame.b.x - frame.a.x)} height={Math.abs(frame.b.y - frame.a.y)} className={frame.crossing ? "room-frame is-crossing" : "room-frame"} />}

      {!drawing &&
        room.partitions.flatMap((w) =>
          (["a", "b"] as const).map((end) => {
            const c = S(w[end]);
            const sel = selection.partitions.includes(w.id);
            const hov = hover?.kind === "end" && hover.id === w.id && hover.end === end;
            return <circle key={`${w.id}${end}`} cx={c.x} cy={c.y} r={END_R} className={`room-handle${sel ? " is-selected" : ""}${hov ? " is-hover" : ""}`} />;
          }),
        )}

      {!drawing &&
        room.points.map((p, i) => {
          const c = S(p);
          const sel = selection.corners.includes(i);
          const hov = hover?.kind === "corner" && hover.index === i;
          return <rect key={`c${i}`} x={c.x - HANDLE_HALF} y={c.y - HANDLE_HALF} width={HANDLE_HALF * 2} height={HANDLE_HALF * 2} className={`room-handle${sel ? " is-selected" : ""}${hov ? " is-hover" : ""}`} />;
        })}

      {drawing && tool === "partition" && last && preview && dist(last, preview) > 0 && (
        <polygon points={pts(partBand({ id: "", a: last, b: preview, thickness: PARTITION_THICKNESS, height: 0 }))} className="room-draft-band" />
      )}
      {drawing && e.draft.length > 0 && <polyline points={pts(preview && !e.closing ? [...e.draft, preview] : e.closing ? [...e.draft, e.draft[0]] : e.draft)} className="room-draft" />}
      {drawing &&
        e.draft.map((p, i) => {
          const c = S(p);
          return <rect key={`d${i}`} x={c.x - HANDLE_HALF} y={c.y - HANDLE_HALF} width={HANDLE_HALF * 2} height={HANDLE_HALF * 2} className={i === 0 && e.closing ? "room-handle is-hover" : "room-handle"} />;
        })}
      {drawing && last && preview && dist(last, preview) > 0 && <LengthLabel a={S(last)} b={S(preview)} text={`${num(dist(last, preview))}${e.typed ? `  [${e.typed}]` : ""}`} />}
      {drawing && preview && (
        <circle cx={S(preview).x} cy={S(preview).y} r={3} className="room-cursor" />
      )}
      {e.snap?.target && <circle cx={S(e.snap.target).x} cy={S(e.snap.target).y} r={7} className="room-snap" />}
    </svg>
  );
}

/** Height of a wall length label across its wall, and the width of one of its characters (px). */
const LABEL_H = 12;
const LABEL_CHAR_W = 6.5;
/** Least gap between a wall length label and the wall's outer face (px). */
const LABEL_CLEAR = 4;

export interface WallLabel {
  index: number;
  text: string;
  /** Centre on screen (px). */
  p: Vec2;
  /** Rotation (degrees, screen), along the wall and never upside down. */
  angle: number;
}

/** The plan's wall dimensions as the length labels keep clear of them (drawing mm). */
export interface PlanDims {
  /** Distance of the first dimension row from the outer wall face. */
  gap: number;
  /** Height of the dimension text, centred on the wall's middle. */
  text: number;
}

/**
 * The length labels of the walls on screen: outside the room along each wall's outer face, beyond
 * the wall thickness, running along the wall. With the plan's dimensions shown (`dims`) a label
 * sits in the middle between the face and the first dimension row while it fits there; zoomed
 * out it sits just clear of the face and moves along the wall beside the dimension's own text.
 * A label that would cover one placed before it (longer walls first) or that does not fit its
 * wall is left out.
 */
export function wallLengthLabels(room: Pick<Room, "points" | "wallThickness">, vp: Viewport, dims: PlanDims | null): WallLabel[] {
  const ws = walls(room);
  const out: WallLabel[] = [];
  const boxes: { minX: number; maxX: number; minY: number; maxY: number }[] = [];
  const order = [...ws].sort((x, y) => y.length - x.length || x.index - y.index);
  for (const w of order) {
    const a = toScreen(vp, w.a);
    const b = toScreen(vp, w.b);
    const lenPx = Math.hypot(b.x - a.x, b.y - a.y);
    const text = num(Math.round(w.length));
    const textW = text.length * LABEL_CHAR_W;
    const facePx = room.wallThickness * vp.k;
    const gapPx = dims ? dims.gap * vp.k : 0;
    const inGap = dims !== null && gapPx >= LABEL_H + 2 * LABEL_CLEAR;
    const off = facePx + (inGap ? gapPx / 2 : LABEL_CLEAR + LABEL_H / 2);
    // Beside the dimension text (as wide as `mm` writes the length, 0.6 em a digit).
    const dimTextW = dims ? String(Math.round(w.length)).length * 0.6 * dims.text * vp.k : 0;
    const along = dims && !inGap ? dimTextW / 2 + textW / 2 + LABEL_CLEAR : 0;
    if (lenPx < Math.max(LABEL_MIN_PX, textW + 2 * LABEL_CLEAR + 2 * along)) continue;
    // Outwards on screen: the plan's y axis points down the screen like the screen's.
    const p = add(add(scale(add(a, b), 0.5), scale(w.inward, -off)), scale(norm(sub(b, a)), along));
    let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    else if (angle <= -90) angle += 180;
    const r = (angle * Math.PI) / 180;
    const hw = (Math.abs(Math.cos(r)) * textW + Math.abs(Math.sin(r)) * LABEL_H) / 2;
    const hh = (Math.abs(Math.sin(r)) * textW + Math.abs(Math.cos(r)) * LABEL_H) / 2;
    const box = { minX: p.x - hw, maxX: p.x + hw, minY: p.y - hh, maxY: p.y + hh };
    if (boxes.some((o) => o.minX < box.maxX && box.minX < o.maxX && o.minY < box.maxY && box.minY < o.maxY)) continue;
    boxes.push(box);
    out.push({ index: w.index, text, p, angle: Math.round(angle * 100) / 100 + 0 });
  }
  return out.sort((x, y) => x.index - y.index);
}

/** The length of the segment being drawn, beside its middle. */
function LengthLabel({ a, b, text }: { a: Vec2; b: Vec2; text: string }) {
  const d = norm(sub(b, a));
  // Left of the drawing direction on screen, so the label does not sit on the line.
  const m = add(scale(add(a, b), 0.5), scale({ x: d.y, y: -d.x }, 14));
  return (
    <text x={m.x} y={m.y} className="room-label is-live" textAnchor="middle" dominantBaseline="central">
      {text}
    </text>
  );
}
