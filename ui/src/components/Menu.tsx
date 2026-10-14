// A dropdown menu on a toolbar button: opens with click, Enter, Space or ArrowDown; arrows move,
// Escape closes and returns focus to the button. The popup stays inside the window: it is placed
// fixed next to the button, shifted sideways and flipped above it when there is no room, so a
// menu in a small pane (which clips its overflow) is never cut off.

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * One entry, or a separator. `checked` makes it a check item; with `radio` as well it is one
 * choice of several (the current one checked), as a list of options in a pane header.
 */
export type MenuEntry = { label: string; onSelect: () => void; hint?: string; checked?: boolean; radio?: boolean; disabled?: boolean } | "sep";

/** Gap between the button and the popup, and the least distance to the window's edges (px). */
const GAP = 4;
const MARGIN = 8;

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where a popup of the given size goes next to its button (window pixels): below it, its start
 * or end edge on the button's, shifted to stay `MARGIN` inside the window; above the button when
 * it does not fit below and there is more room above. `maxHeight` is the room on that side.
 */
export function menuPosition(button: Rect, size: { width: number; height: number }, view: { width: number; height: number }, align: "start" | "end"): { left: number; top: number; maxHeight: number } {
  const want = align === "end" ? button.right - size.width : button.left;
  const left = Math.max(MARGIN, Math.min(want, view.width - MARGIN - size.width));
  const below = view.height - MARGIN - (button.bottom + GAP);
  const above = button.top - GAP - MARGIN;
  if (size.height > below && above > below) {
    const maxHeight = Math.max(0, above);
    return { left, top: button.top - GAP - Math.min(size.height, maxHeight), maxHeight };
  }
  return { left, top: button.bottom + GAP, maxHeight: Math.max(0, below) };
}

/** `className` replaces the button's class ("tb-btn", a toolbar button), e.g. for a pane header. */
export function Menu(props: { label: ReactNode; title: string; entries: MenuEntry[]; align?: "start" | "end"; className?: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const [place, setPlace] = useState<CSSProperties | undefined>(undefined);

  // Measured before the browser paints, so the popup never shows at the clipped spot first.
  useLayoutEffect(() => {
    if (!open) {
      setPlace(undefined);
      return;
    }
    const fit = () => {
      const b = btn.current?.getBoundingClientRect();
      const el = list.current;
      if (!b || !el) return;
      const p = menuPosition(b, { width: el.offsetWidth, height: el.scrollHeight }, { width: window.innerWidth, height: window.innerHeight }, props.align ?? "start");
      setPlace({ position: "fixed", left: p.left, top: p.top, right: "auto", maxHeight: p.maxHeight });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open, props.align]);

  useEffect(() => {
    if (!open) return;
    // A list of choices opens on the current one, as a select does.
    const first = list.current?.querySelector<HTMLButtonElement>("[role=menuitemradio][aria-checked=true]:not(:disabled)") ?? list.current?.querySelector<HTMLButtonElement>("[role^=menuitem]:not(:disabled)");
    first?.focus();
    const onDown = (e: PointerEvent) => {
      if (!list.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]:not(:disabled)") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div className="menu-anchor">
      <button
        ref={btn}
        type="button"
        className={`${props.className ?? "tb-btn"}${open ? " is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        title={props.title}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {props.label}
        <ChevronDown size={13} strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div ref={list} id={id} role="menu" className={props.align === "end" ? "menu end" : "menu"} style={place} onKeyDown={onKey}>
          {props.entries.map((e, i) =>
            e === "sep" ? (
              <div key={i} className="menu-sep" role="separator" />
            ) : (
              <button
                key={i}
                type="button"
                role={e.checked === undefined ? "menuitem" : e.radio ? "menuitemradio" : "menuitemcheckbox"}
                aria-checked={e.checked}
                className="menu-item"
                disabled={e.disabled}
                onClick={() => {
                  close();
                  e.onSelect();
                }}
              >
                <span className="menu-check" aria-hidden>
                  {e.checked ? "✓" : ""}
                </span>
                <span className="menu-label">{e.label}</span>
                {e.hint && <span className="menu-hint">{e.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
