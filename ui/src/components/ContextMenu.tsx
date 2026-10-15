// The context menu of the floor plan: opens at the pointer on a right click (without moving; a
// right drag pans), in the look and with the keys of the toolbar menus (Menu.tsx): arrows move,
// Enter picks, Escape or a click outside closes and the focus goes back where it was. An entry
// with `children` opens them in place, with a way back as the first entry.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { menuPosition } from "./Menu";

export type ContextEntry =
  | { label: string; onSelect: () => void; hint?: string; disabled?: boolean; danger?: boolean }
  | { label: string; children: ContextEntry[] }
  | "sep";

export function ContextMenu(props: { at: { x: number; y: number }; entries: ContextEntry[]; label: string; backLabel: string; onClose: () => void }) {
  const list = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<{ label: string; entries: ContextEntry[] } | null>(null);
  const [place, setPlace] = useState<CSSProperties>({ position: "fixed", left: props.at.x, top: props.at.y, visibility: "hidden" });
  const onClose = useRef(props.onClose);
  onClose.current = props.onClose;
  const entries = page?.entries ?? props.entries;

  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const at = { left: props.at.x, right: props.at.x, top: props.at.y, bottom: props.at.y };
    const p = menuPosition(at, { width: el.offsetWidth, height: el.scrollHeight }, { width: window.innerWidth, height: window.innerHeight }, "start");
    setPlace({ position: "fixed", left: p.left, top: p.top, right: "auto", maxHeight: p.maxHeight });
  }, [props.at.x, props.at.y, page]);

  // The focus goes into the menu and back where it was when it closes.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onDown = (e: PointerEvent) => {
      if (!list.current?.contains(e.target as Node)) onClose.current();
    };
    const onBlur = () => onClose.current();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("blur", onBlur);
      if (before?.isConnected) before.focus();
    };
  }, []);

  useEffect(() => {
    list.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();
  }, [page]);

  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => {
      e.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    };
    e.stopPropagation();
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      if (page && e.key === "Escape") setPage(null);
      else props.onClose();
    } else if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "ArrowLeft" && page) setPage(null);
  };

  return (
    <div ref={list} role="menu" aria-label={page?.label ?? props.label} className="menu context-menu" style={place} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}>
      {page && (
        <>
          <button type="button" role="menuitem" className="menu-item" onClick={() => setPage(null)}>
            <span className="menu-check" aria-hidden>
              <ChevronLeft size={13} strokeWidth={1.75} />
            </span>
            <span className="menu-label">{props.backLabel}</span>
          </button>
          <div className="menu-sep" role="separator" />
        </>
      )}
      {entries.map((e, i) =>
        e === "sep" ? (
          <div key={i} className="menu-sep" role="separator" />
        ) : "children" in e ? (
          <button key={i} type="button" role="menuitem" aria-haspopup="menu" className="menu-item" onClick={() => setPage({ label: e.label, entries: e.children })}>
            <span className="menu-check" aria-hidden />
            <span className="menu-label">{e.label}</span>
            <span className="menu-hint" aria-hidden>
              <ChevronRight size={13} strokeWidth={1.75} />
            </span>
          </button>
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={e.danger ? "menu-item is-danger" : "menu-item"}
            disabled={e.disabled}
            onClick={() => {
              props.onClose();
              e.onSelect();
            }}
          >
            <span className="menu-check" aria-hidden />
            <span className="menu-label">{e.label}</span>
            {e.hint && <span className="menu-hint">{e.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}
