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

/**
 * The viewport of a view element: fits `box` on first layout and when `fitKey` changes, zooms
 * with the wheel (at the cursor) and keeps the centre when the element is resized.
 */
export function useViewport(box: Box, fitKey: unknown) {
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
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize((old) => {
        if (auto.current) {
          if (r.width > 0 && r.height > 0) setVp(fitViewport(boxRef.current, r.width, r.height));
        } else if (old.w > 0 && old.h > 0 && (old.w !== r.width || old.h !== r.height)) {
          // Keep what was in the middle in the middle.
          setVp((v) => ({ ...v, ox: v.ox + (r.width - old.w) / 2, oy: v.oy + (r.height - old.h) / 2 }));
        }
        return { w: r.width, h: r.height };
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    if (fitted.current === fitKey) return;
    fitted.current = fitKey;
    auto.current = true;
    setVp(fitViewport(boxRef.current, size.w, size.h));
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
    if (size.w > 0) setVp(fitViewport(boxRef.current, size.w, size.h));
  }, [size.w, size.h]);

  /** Sets the viewport by a user action (pan): stops following the pane size. */
  const panTo = useCallback((v: Viewport) => {
    auto.current = false;
    setVp(v);
  }, []);

  return { ref, vp, setVp: panTo, size, fit };
}
