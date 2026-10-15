// The measure tool of the floor plan (M or the ruler in the toolbar, in both modes): an overlay
// above the plan that takes the pointer while the tool is on. A click sets the first point, a
// second click the end; each point snaps to corners and edge middles, then to edges of the room,
// the partitions and the equipment, then to the grid (Alt: free), and Shift holds the line to
// 45° steps. The result stays as a dimension line until the next click starts a new measurement.
// Escape, M or a right click ends the tool; dragging with the middle or right button pans.
//
// Measurements are temporary: they are not part of the project and leave no undo step.

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { DrawingShapes, SCREEN_PAPER_SCALE } from "../components/DrawingSvg";
import { constrainMeasure, measure, measureTargets, snapMeasurePoint, type MeasureSnap } from "../model/measure";
import type { Vec2 } from "../model/types";
import { mm, type Drawing } from "../render/drawing";
import { num, useT } from "../lib/i18n";
import { setMeasuring } from "../lib/measureTool";
import { setToolKeyHandler } from "../lib/shortcuts";
import { toScreen, toWorld, type Viewport } from "../lib/viewport";
import { useStore } from "../store/store";

/** Snapping reaches this far on screen (px), at most `SNAP_MAX_MM`. */
const SNAP_PX = 10;
const SNAP_MAX_MM = 150;
/** Pointer movement (px) before a right press becomes a pan instead of ending the tool. */
const DRAG_THRESHOLD = 3;
/** Half the size of the snap marker (px). */
const MARK_R = 4;
/** The readout sits this far right and below the cursor (px). */
const READOUT_OFFSET = 16;
/** Keys that keep working while the tool is on: the layouts and fitting the views. */
const PASS_KEYS = /^[1-4fF]$/;

export interface MeasureLayerProps {
  vp: Viewport;
  width: number;
  height: number;
  setVp: (vp: Viewport) => void;
  onCursor?: (p: Vec2 | null) => void;
}

interface Points {
  /** The first point; null before the first click. */
  a: Vec2 | null;
  /** The end point once it is set. */
  b: Vec2 | null;
  /** The snapped cursor; null outside the plan. */
  cursor: MeasureSnap | null;
}

type Pan = { client: Vec2; ox: number; oy: number; button: number; moved: boolean };

export function MeasureLayer(props: MeasureLayerProps) {
  const t = useT();
  const project = useStore((s) => s.project);
  const loadCount = useStore((s) => s.loadCount);
  const targets = useMemo(() => measureTargets(project), [project]);
  const [pts, setPts] = useState<Points>({ a: null, b: null, cursor: null });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pan = useRef<Pan | null>(null);
  const vpRef = useRef(props.vp);
  vpRef.current = props.vp;
  const ptsRef = useRef(pts);
  ptsRef.current = pts;

  // A newly opened project starts without the old project's measurement.
  useEffect(() => setPts({ a: null, b: null, cursor: null }), [loadCount]);

  useEffect(
    () =>
      setToolKeyHandler((e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return false;
        if (e.key === "Escape" || e.key.toLowerCase() === "m") {
          setMeasuring(false);
          return true;
        }
        // The editing keys of the modes wait until the tool ends.
        return !PASS_KEYS.test(e.key) && e.key !== "Tab";
      }),
    [],
  );

  // The status bar tells what the next click does, or the result.
  const m = pts.a ? measure(pts.a, pts.b ?? pts.cursor?.p ?? pts.a) : null;
  const status = !pts.a ? t("measure.hintStart") : !pts.b ? t("measure.hintEnd") : null;
  const result = m && m.length > 0 ? t("measure.result", { length: fmt(m.length), dx: fmt(m.dx), dy: fmt(m.dy) }) : null;
  const statusText = result ? (status ? `${result}  ·  ${status}` : `${result}  ·  ${t("measure.hintAgain")}`) : status;
  useEffect(() => {
    useStore.getState().setStatus(statusText);
  }, [statusText]);
  useEffect(() => () => useStore.getState().setStatus(null), []);

  const worldOf = (e: { clientX: number; clientY: number }): Vec2 => {
    const r = svgRef.current!.getBoundingClientRect();
    return toWorld(vpRef.current, { x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const snapAt = (p: Vec2, e: { altKey: boolean; shiftKey: boolean }): MeasureSnap => {
    const st = useStore.getState();
    const radius = Math.min(SNAP_PX / vpRef.current.k, SNAP_MAX_MM);
    const s = e.altKey ? { p: { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }, kind: "free" as const } : snapMeasurePoint(p, targets, radius, st.prefs.grid);
    const { a, b } = ptsRef.current;
    return e.shiftKey && a && !b ? constrainMeasure(a, s) : s;
  };

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (e.button === 1 || e.button === 2) {
      pan.current = { client: { x: e.clientX, y: e.clientY }, ox: vpRef.current.ox, oy: vpRef.current.oy, button: e.button, moved: false };
      return;
    }
    if (e.button !== 0) return;
    const s = snapAt(worldOf(e), e);
    const { a, b } = ptsRef.current;
    // The first click, or a click after a finished measurement, starts a new one.
    if (!a || b) setPts({ a: s.p, b: null, cursor: s });
    else if (s.p.x !== a.x || s.p.y !== a.y) setPts({ a, b: s.p, cursor: s });
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = worldOf(e);
    props.onCursor?.(p);
    const pn = pan.current;
    if (pn) {
      const dx = e.clientX - pn.client.x;
      const dy = e.clientY - pn.client.y;
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) pn.moved = true;
      if (pn.moved) props.setVp({ ...vpRef.current, ox: pn.ox + dx, oy: pn.oy + dy });
      return;
    }
    const s = snapAt(p, e);
    setPts((q) => ({ ...q, cursor: s }));
  };

  const onPointerUp = () => {
    const pn = pan.current;
    pan.current = null;
    // A right click without moving ends the tool; a right drag only panned.
    if (pn && pn.button === 2 && !pn.moved) setMeasuring(false);
  };

  const { vp } = props;
  const S = (p: Vec2) => toScreen(vp, p);
  const end = pts.b ?? pts.cursor?.p ?? null;
  const drawing: Drawing = { shapes: [] };
  if (pts.a && end && m && m.length >= 1) drawing.shapes.push({ t: "dim", pen: "dim", a: pts.a, b: end, offset: 0, text: mm(m.length) });
  const c = pts.cursor && !pts.b ? pts.cursor : null;
  const cs = c && S(c.p);
  const readoutAt = pts.b ? S(pts.b) : cs;

  return (
    <>
      <svg
        ref={svgRef}
        className="measure-layer"
        width={props.width}
        height={props.height}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          props.onCursor?.(null);
          setPts((q) => ({ ...q, cursor: null }));
        }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={t("measure.title")}
      >
        <g transform={`translate(${vp.ox} ${vp.oy}) scale(${vp.k})`}>
          <DrawingShapes drawing={drawing} paperScale={SCREEN_PAPER_SCALE} />
        </g>
        <g className="plan-edit" aria-hidden>
          {[pts.a, pts.b].map((p, i) => {
            if (!p) return null;
            const q = S(p);
            return <circle key={i} cx={q.x} cy={q.y} r={MARK_R - 1} className="measure-point" />;
          })}
          {cs && c && <SnapMark at={cs} kind={c.kind} />}
        </g>
      </svg>
      {m && m.length > 0 && readoutAt && (
        <div className="plan-readout" style={{ left: readoutAt.x + READOUT_OFFSET, top: readoutAt.y + READOUT_OFFSET }} aria-hidden>
          {`${fmt(m.length)} mm   ΔX ${fmt(m.dx)}   ΔY ${fmt(m.dy)}`}
        </div>
      )}
    </>
  );
}

/** The marker at the cursor: a square on a corner, a cross on an edge, a small plus on the grid. */
function SnapMark({ at, kind }: { at: Vec2; kind: MeasureSnap["kind"] }) {
  const r = MARK_R;
  if (kind === "point") return <rect x={at.x - r} y={at.y - r} width={r * 2} height={r * 2} className="plan-mark" />;
  if (kind === "edge") return <path d={`M${at.x - r} ${at.y - r}L${at.x + r} ${at.y + r}M${at.x - r} ${at.y + r}L${at.x + r} ${at.y - r}`} className="plan-mark" />;
  const h = kind === "grid" ? r - 1 : r + 2;
  return <path d={`M${at.x - h} ${at.y}H${at.x + h}M${at.x} ${at.y - h}V${at.y + h}`} className="plan-mark" />;
}

const fmt = (v: number) => num(v, Number.isInteger(v) ? 0 : 1);
