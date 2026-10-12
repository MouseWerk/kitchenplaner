// One elevation (Ansicht) of the room: read-only drawing with pan, zoom and click to select.

import { useMemo, useRef, type PointerEvent as RPointerEvent } from "react";
import { DrawingShapes, SCREEN_PAPER_SCALE } from "../components/DrawingSvg";
import { elevationDrawing } from "../model/elevation";
import type { Facing } from "../model/types";
import { drawingBounds } from "../render/drawing";
import { useStore } from "../store/store";
import { useViewport } from "../lib/viewport";
import { useT } from "../lib/i18n";

/** Pointer movement (px) that turns a click into a pan. */
const CLICK_SLOP = 4;

export function ElevationView(props: { facing: Facing; fitSignal: number }) {
  const t = useT();
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const showDims = useStore((s) => s.prefs.showDims);
  const drawing = useMemo(() => elevationDrawing(project, props.facing, { showDims, paperScale: SCREEN_PAPER_SCALE }), [project, props.facing, showDims]);
  const box = useMemo(() => drawingBounds(drawing, SCREEN_PAPER_SCALE), [drawing]);
  const { ref, vp, setVp, size } = useViewport(box, `${props.fitSignal}-${props.facing}`);
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
            <DrawingShapes drawing={drawing} />
            {selectedShapes.shapes.map((s, i) => (s.t === "poly" ? <path key={i} d={s.pts.map((p, j) => `${j ? "L" : "M"}${p.x} ${p.y}`).join("") + "Z"} className="draw-selected" /> : null))}
          </g>
        </svg>
      )}
    </div>
  );
}
