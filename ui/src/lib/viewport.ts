// Pan and zoom of a 2D view: drawing millimetres to screen pixels.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Box } from "../model/geometry";
import type { Vec2 } from "../model/types";

export interface Viewport {
  /** Screen pixels per drawing millimetre. */
  k: number;
  /** Screen position of the drawing origin. */
  ox: number;
  oy: number;
}

/** Zoom limits: 1 px per 50 m up to 2 px per mm. */
const MIN_K = 0.00002 * 1000;
const MAX_K = 2;
/** Space around a fitted drawing, in pixels. */
const FIT_PADDING = 40;
/** Zoom change per wheel notch (100 delta units in most browsers). */
const WHEEL_ZOOM = 1.0015;

export function fitViewport(box: Box, width: number, height: number, padding = FIT_PADDING): Viewport {
  const w = Math.max(box.maxX - box.minX, 1);
  const h = Math.max(box.maxY - box.minY, 1);
  const k = clamp(Math.min((width - 2 * padding) / w, (height - 2 * padding) / h), MIN_K, MAX_K);
  return { k, ox: width / 2 - ((box.minX + box.maxX) / 2) * k, oy: height / 2 - ((box.minY + box.maxY) / 2) * k };
}

export const toScreen = (v: Viewport, p: Vec2): Vec2 => ({ x: v.ox + p.x * v.k, y: v.oy + p.y * v.k });
export const toWorld = (v: Viewport, p: Vec2): Vec2 => ({ x: (p.x - v.ox) / v.k, y: (p.y - v.oy) / v.k });

/** Zooms by `factor` keeping the screen point `at` fixed. */
export function zoomAt(v: Viewport, at: Vec2, factor: number): Viewport {
  const k = clamp(v.k * factor, MIN_K, MAX_K);
  const f = k / v.k;
  return { k, ox: at.x - (at.x - v.ox) * f, oy: at.y - (at.y - v.oy) * f };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const fitTo = (box: FitBox, width: number, height: number) => fitViewport(typeof box === "function" ? box(width, height) : box, width, height);

/**
 * The viewport after the pane changed from `old` to `next` (pixels): fitted anew while the view
 * follows the pane (`auto`, the user has not panned or zoomed), else shifted so what was in the
 * middle stays there. A layout switch or a window resize thus re-fits an untouched plan.
 */
export function resizedViewport(vp: Viewport, old: { w: number; h: number }, next: { w: number; h: number }, auto: boolean, box: FitBox): Viewport {
  if (next.w <= 0 || next.h <= 0) return vp;
  if (auto) return fitTo(box, next.w, next.h);
  if (old.w <= 0 || old.h <= 0 || (old.w === next.w && old.h === next.h)) return vp;
  return { ...vp, ox: vp.ox + (next.w - old.w) / 2, oy: vp.oy + (next.h - old.h) / 2 };
}

/**
 * What a view fits: a box, or the box for a pane size, for a drawing whose annotations grow
 * when the pane is small (the elevations).
 */
export type FitBox = Box | ((width: number, height: number) => Box);

/**
 * The viewport of a view element: fits `box` on first layout and when `fitKey` changes, zooms
 * with the wheel (at the cursor) and keeps the centre when the element is resized.
 */
export function useViewport(box: FitBox, fitKey: unknown) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [vp, setVp] = useState<Viewport>({ k: 0.1, ox: 0, oy: 0 });
  const fitted = useRef<unknown>(Symbol());
  const boxRef = useRef(box);
  boxRef.current = box;
  // Until the user pans or zooms, the drawing follows the pane: refitted on every resize.
  const auto = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The last size seen here, outside React's state: the viewport follows it in the same
    // callback, never from inside a state updater (which React may run late or twice).
    let last = { w: 0, h: 0 };
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const next = { w: r.width, h: r.height };
      if (next.w === last.w && next.h === last.h) return;
      const old = last;
      last = next;
      const follow = auto.current;
      const box = boxRef.current;
      setVp((v) => resizedViewport(v, old, next, follow, box));
      setSize(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    if (fitted.current === fitKey) return;
    fitted.current = fitKey;
    auto.current = true;
    setVp(fitTo(boxRef.current, size.w, size.h));
  }, [fitKey, size.w, size.h]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      // Pixel, line and page deltas: normalise lines and pages to pixels.
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? r.height : 1;
      const factor = Math.pow(WHEEL_ZOOM, -e.deltaY * unit);
      auto.current = false;
      setVp((v) => zoomAt(v, { x: e.clientX - r.left, y: e.clientY - r.top }, factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const fit = useCallback(() => {
    auto.current = true;
    if (size.w > 0) setVp(fitTo(boxRef.current, size.w, size.h));
  }, [size.w, size.h]);

  /** Sets the viewport by a user action (pan): stops following the pane size. */
  const panTo = useCallback((v: Viewport) => {
    auto.current = false;
    setVp(v);
  }, []);

  return { ref, vp, setVp: panTo, size, fit };
}
