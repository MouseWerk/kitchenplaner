// A dropdown menu on a toolbar button: opens with click, Enter, Space or ArrowDown; arrows move,
// Escape closes and returns focus to the button.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type MenuEntry = { label: string; onSelect: () => void; hint?: string; checked?: boolean; disabled?: boolean } | "sep";

export function Menu(props: { label: ReactNode; title: string; entries: MenuEntry[]; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const first = list.current?.querySelector<HTMLButtonElement>("[role^=menuitem]:not(:disabled)");
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
        className={open ? "tb-btn is-open" : "tb-btn"}
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
        <div ref={list} id={id} role="menu" className={props.align === "end" ? "menu end" : "menu"} onKeyDown={onKey}>
          {props.entries.map((e, i) =>
            e === "sep" ? (
              <div key={i} className="menu-sep" role="separator" />
            ) : (
              <button
                key={i}
                type="button"
                role={e.checked === undefined ? "menuitem" : "menuitemcheckbox"}
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
