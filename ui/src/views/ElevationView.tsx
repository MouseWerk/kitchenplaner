// One elevation (Ansicht) of the room: read-only drawing with pan, zoom and click to select.

import { useCallback, useMemo, useRef, type PointerEvent as RPointerEvent } from "react";
import { DrawingShapes, SCREEN_PAPER_SCALE } from "../components/DrawingSvg";
import { elevationDrawing } from "../model/elevation";
import type { Facing } from "../model/types";
import type { Box } from "../model/geometry";
import { drawingBounds, TEXT, type Drawing } from "../render/drawing";
import { useStore } from "../store/store";
import { fitViewport, useViewport } from "../lib/viewport";
import { useT } from "../lib/i18n";

/** Pointer movement (px) that turns a click into a pan. */
const CLICK_SLOP = 4;
/** The least height of normal text (position numbers, dimensions) on screen (px). */
const MIN_TEXT_PX = 10;
/** The coarsest annotation scale (2.5 times the screen's): in a tiny pane larger text would only
 * cover the drawing. */
const MAX_ANNOTATION_SCALE = 100;

/**
 * The paper scale an elevation is laid out for at zoom `k` (px per mm): the screen's 1:40 while
 * its text reads at that size, else coarser, so position numbers and dimensions keep at least
 * `MIN_TEXT_PX` when the drawing is small (a long wall in a quarter pane). In quarter-octave
 * steps, so zooming lays the drawing out again only now and then.
 */
export function annotationScale(k: number): number {
  const need = MIN_TEXT_PX / (TEXT.normal * k);
  if (!(need > SCREEN_PAPER_SCALE)) return SCREEN_PAPER_SCALE;
  const steps = Math.ceil(Math.log2(need / SCREEN_PAPER_SCALE) * 4 - 1e-9);
  return Math.min(MAX_ANNOTATION_SCALE, SCREEN_PAPER_SCALE * 2 ** (steps / 4));
}

/**
 * The box to fit an elevation into a `width` × `height` pane: laid out at the annotation scale
 * of the zoom it is fitted at. Larger text pushes the dimensions out and the zoom down, which
 * can ask for larger text again; the scale only grows, so a few rounds settle it.
 */
export function elevationFitBox(at: (paperScale: number) => Drawing, width: number, height: number): Box {
  let ps = SCREEN_PAPER_SCALE;
  let box = drawingBounds(at(ps), ps);
  for (let i = 0; i < 4; i++) {
    const next = annotationScale(fitViewport(box, width, height).k);
    if (next <= ps) break;
    ps = next;
    box = drawingBounds(at(ps), ps);
  }
  return box;
}

export function ElevationView(props: { facing: Facing; fitSignal: number }) {
  const t = useT();
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const showDims = useStore((s) => s.prefs.showDims);
  const cut = useStore((s) => s.prefs.elevationCut);
  const at = useCallback((paperScale: number) => elevationDrawing(project, props.facing, { showDims, cut, paperScale }), [project, props.facing, showDims, cut]);
  const fitBox = useCallback((w: number, h: number) => elevationFitBox(at, w, h), [at]);
  const { ref, vp, setVp, size } = useViewport(fitBox, `${props.fitSignal}-${props.facing}`);
  const paperScale = annotationScale(vp.k);
  const drawing = useMemo(() => at(paperScale), [at, paperScale]);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);

  // The selected items' shapes again, with the neutral selection tint on top.
  const selectedShapes = useMemo(() => {
    const ids = new Set(selection.items);
    return { shapes: drawing.shapes.filter((s) => s.itemId && ids.has(s.itemId) && s.t === "poly" && s.closed && s.pen !== "detail" && s.pen !== "hidden") };
  }, [drawing, selection.items]);

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pan.current = { x: e.clientX, y: e.clientY, ox: vp.ox, oy: vp.oy, moved: false };
  };
  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = pan.current;
    if (!p) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < CLICK_SLOP) return;
    p.moved = true;
    setVp({ ...vp, ox: p.ox + e.clientX - p.x, oy: p.oy + e.clientY - p.y });
  };
  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    const p = pan.current;
    pan.current = null;
    if (!p || p.moved || e.button !== 0) return;
    // The topmost item shape under the pointer (later shapes are nearer to the viewer).
    const hits = document.elementsFromPoint(e.clientX, e.clientY);
    const id = hits.map((el) => el.getAttribute("data-item")).find((x) => x);
    useStore.getState().select({ items: id ? [id] : [], opening: null });
  };

  return (
    <div ref={ref} className="view2d" role="img" aria-label={t("view.elevation", { facing: t(`facing.${props.facing}`) })}>
      {size.w > 0 && (
        <svg width={size.w} height={size.h} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onContextMenu={(e) => e.preventDefault()}>
          <g transform={`translate(${vp.ox} ${vp.oy}) scale(${vp.k})`}>
            <DrawingShapes drawing={drawing} paperScale={paperScale} />
            {selectedShapes.shapes.map((s, i) => (s.t === "poly" ? <path key={i} d={s.pts.map((p, j) => `${j ? "L" : "M"}${p.x} ${p.y}`).join("") + "Z"} className="draw-selected" /> : null))}
          </g>
        </svg>
      )}
    </div>
  );
}
