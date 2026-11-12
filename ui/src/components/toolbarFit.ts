// How compact the top bar has to be to fit its window. The bar gives way in steps, least
// important first, and every step keeps the label as a tooltip and accessible name:
//   1. the layout buttons show icons only,
//   2. the room tools show icons only,
//   3. the Export and Display menus show icons only,
//   4. the mode buttons show icons only.
// The widths come from the rendered bar, so the steps fit any language and font; each width is
// measured once per mode and language and reused when the window grows again.

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export const TOOLBAR_LEVELS = 4;

/**
 * The room the title keeps at least (its padding, a short name and the unsaved dot) before the
 * bar gives way another step (px).
 */
export const TITLE_MIN = 190;

/**
 * The least compact level whose tool group fits into `room` px. `known[l]` is the group's width
 * at level `l`, if it was measured; an unmeasured level is tried before a more compact one.
 */
export function toolbarLevel(known: readonly (number | undefined)[], room: number, max = TOOLBAR_LEVELS): number {
  for (let l = 0; l < max; l++) {
    const w = known[l];
    if (w === undefined || w <= room) return l;
  }
  return max;
}

/**
 * The compact level for the bar `header`: `.toolbar-files` stays as it is, `.toolbar-tools` is
 * the group that gives way. `key` names what changes the tools' widths (mode, language).
 */
export function useToolbarFit(header: RefObject<HTMLElement | null>, key: string): number {
  const [level, setLevel] = useState(0);
  const levelRef = useRef(level);
  const keyRef = useRef(key);
  const known = useRef<{ key: string; widths: number[] }>({ key: "", widths: [] });
  levelRef.current = level;
  keyRef.current = key;

  const fit = useRef(() => {
    const el = header.current;
    const files = el?.querySelector<HTMLElement>(".toolbar-files");
    const tools = el?.querySelector<HTMLElement>(".toolbar-tools");
    if (!el || !files || !tools || el.clientWidth === 0) return;
    if (known.current.key !== keyRef.current) known.current = { key: keyRef.current, widths: [] };
    known.current.widths[levelRef.current] = tools.offsetWidth;
    const cs = getComputedStyle(el);
    const gap = parseFloat(cs.columnGap) || 0;
    const room = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - files.offsetWidth - 2 * gap - TITLE_MIN;
    const next = toolbarLevel(known.current.widths, room);
    if (next !== levelRef.current) setLevel(next);
  }).current;

  // Before the browser paints, so a step that does not fit never shows.
  useLayoutEffect(fit, [level, key, fit]);

  useEffect(() => {
    const el = header.current;
    if (!el) return;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => fit());
    observer?.observe(el);
    window.addEventListener("resize", fit);
    // The UI font arrives after the first layout and changes every width.
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (!alive) return;
      known.current = { key: "", widths: [] };
      fit();
    });
    return () => {
      alive = false;
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [header, fit]);

  return level;
}
