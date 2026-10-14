// The equipment catalog in the left sidebar: search, categories, drag into the plan or click to
// place at a free spot. Every entry shows a small 3D preview of its model; hovering or focusing a
// row opens a larger preview with the dimensions and connection values next to the sidebar.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { CATALOG, CATEGORIES, kindOf, placementOf, wallSnapReach, type CatalogEntry } from "../kinds/registry";
import { drainText, waterText } from "../model/equipment";
import { bounds, convexOverlap, footprint, snapItem } from "../model/geometry";
import { itemFromCatalog } from "../model/project";
import type { Item } from "../model/types";
import { useStore } from "../store/store";
import { CATALOG_DRAG_TYPE } from "../views/PlanView";
import { currentLang, num, t as translate, useT } from "../lib/i18n";
import { prefetchThumbnails, PRIORITY, useThumbnail, type Priority } from "../three/thumbnails";

/** Thumbnail in a row and in the hover preview (CSS pixels). */
const ROW_THUMB = { w: 56, h: 44 } as const;
const PREVIEW_THUMB = { w: 240, h: 180 } as const;
/** Mouse hover waits this long before the preview opens; moving between rows then is instant. */
const HOVER_DELAY_MS = 350;
/** The preview stays this long after the pointer left a row. */
const LEAVE_GRACE_MS = 120;
/** Gap between the sidebar and the preview, and the preview's minimum distance to the window edge. */
const PREVIEW_GAP = 8;
/** The rest of the catalog is prefetched after the rows on screen asked for theirs. */
const PREFETCH_DELAY_MS = 150;

/** "800 × 900 × 900" */
const dims = (e: CatalogEntry) => `${e.width} × ${e.depth} × ${e.height}`;

/**
 * True when every word of the query occurs in the entry's name, category, dimensions or tags. "x" and
 * "×" are the same, so "800x900" finds 800 × 900 × 900.
 */
export function matchesQuery(entry: CatalogEntry, query: string, t: typeof translate = translate): boolean {
  const words = query.toLocaleLowerCase().replace(/×/g, "x").split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [t(entry.name), t(`category.${entry.category}` as const), `${entry.width}x${entry.depth}x${entry.height}`, ...(entry.tags ?? [])].join(" ").toLocaleLowerCase();
  return words.every((w) => hay.includes(w));
}

// ---------------------------------------------------------------------------------------------
// Visibility of rows in the scrolling list: one observer for all of them.

type Observe = (el: Element, onChange: (visible: boolean) => void) => () => void;
const VisibilityContext = createContext<Observe | null>(null);

function useVisibilityObserver(root: RefObject<HTMLElement | null>): Observe {
  const callbacks = useRef(new Map<Element, (visible: boolean) => void>());
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(
    () => () => {
      observer.current?.disconnect();
      observer.current = null;
    },
    [],
  );
  return useCallback<Observe>(
    (el, onChange) => {
      if (typeof IntersectionObserver === "undefined") {
        onChange(true);
        return () => {};
      }
      observer.current ??= new IntersectionObserver(
        (entries) => {
          for (const e of entries) callbacks.current.get(e.target)?.(e.isIntersecting);
        },
        // A row below the edge is about to scroll in: ask a little early.
        { root: root.current, rootMargin: "48px 0px" },
      );
      callbacks.current.set(el, onChange);
      observer.current.observe(el);
      return () => {
        callbacks.current.delete(el);
        observer.current?.unobserve(el);
      };
    },
    [root],
  );
}

// ---------------------------------------------------------------------------------------------

interface PreviewState {
  entry: CatalogEntry;
  row: HTMLElement;
}

export function CatalogPanel() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const aside = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const observe = useVisibilityObserver(scroller);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const q = query.trim();

  const groups = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        id: c,
        entries: CATALOG.filter((e) => e.category === c && matchesQuery(e, q, t)),
      })).filter((g) => g.entries.length > 0),
    [q, t],
  );

  useEffect(() => {
    const id = setTimeout(() => prefetchThumbnails(CATALOG, ROW_THUMB.w, ROW_THUMB.h), PREFETCH_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  const open = useRef(false);
  open.current = preview !== null;
  const clearHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  useEffect(() => clearHover, []);

  const hide = useCallback(() => {
    clearHover();
    setPreview(null);
  }, []);

  const rowEvents: RowEvents = {
    onHover(entry, row) {
      clearHover();
      // Once a preview is open, moving to the next row follows at once.
      if (open.current) setPreview({ entry, row });
      else hoverTimer.current = setTimeout(() => setPreview({ entry, row }), HOVER_DELAY_MS);
    },
    onFocus(entry, row) {
      clearHover();
      setPreview({ entry, row });
    },
    onLeave() {
      // A short grace period lets the pointer cross the gap to the next row without a flicker.
      clearHover();
      if (open.current) hoverTimer.current = setTimeout(() => setPreview(null), LEAVE_GRACE_MS);
    },
    onEscape() {
      if (!open.current) return false;
      hide();
      return true;
    },
  };

  return (
    <aside ref={aside} className="sidebar" aria-label={t("catalog.title")}>
      <div className="sidebar-head">
        <h2 className="eyebrow">{t("catalog.title")}</h2>
        <label className="search">
          <Search size={14} strokeWidth={1.75} aria-hidden />
          <input type="search" value={query} placeholder={t("catalog.search")} onChange={(e) => setQuery(e.target.value)} aria-label={t("catalog.search")} />
        </label>
      </div>
      <div ref={scroller} className="sidebar-scroll" onScroll={preview ? hide : undefined}>
        <VisibilityContext.Provider value={observe}>
          {groups.length === 0 && <p className="empty">{t("catalog.noMatch")}</p>}
          {groups.map((g) => {
            const open = q !== "" || !closed.has(g.id);
            return (
              <section key={g.id} className="cat-group">
                <button
                  type="button"
                  className="cat-group-head"
                  aria-expanded={open}
                  onClick={() =>
                    setClosed((s) => {
                      const n = new Set(s);
                      if (n.has(g.id)) n.delete(g.id);
                      else n.add(g.id);
                      return n;
                    })
                  }
                >
                  {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                  <span>{t(`category.${g.id}` as const)}</span>
                  <span className="count">{g.entries.length}</span>
                </button>
                {open && (
                  <ul className="cat-list">
                    {g.entries.map((e) => (
                      <li key={e.id}>
                        <CatalogRow entry={e} events={rowEvents} described={preview?.entry.id === e.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </VisibilityContext.Provider>
      </div>
      <p className="sidebar-hint">{t("catalog.hint")}</p>
      {preview && preview.row.isConnected && <CatalogPreview entry={preview.entry} row={preview.row} sidebar={aside} />}
    </aside>
  );
}

interface RowEvents {
  onHover(entry: CatalogEntry, row: HTMLElement): void;
  onFocus(entry: CatalogEntry, row: HTMLElement): void;
  onLeave(): void;
  /** True when Escape closed the preview (then it closes nothing else). */
  onEscape(): boolean;
}

const PREVIEW_ID = "catalog-preview";

function CatalogRow({ entry, events, described }: { entry: CatalogEntry; events: RowEvents; described: boolean }) {
  const t = useT();
  const observe = useContext(VisibilityContext);
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => (observe && ref.current ? observe(ref.current, setVisible) : undefined), [observe]);

  return (
    <button
      ref={ref}
      type="button"
      className="cat-row"
      draggable
      aria-describedby={described ? PREVIEW_ID : undefined}
      onDragStart={(ev) => {
        events.onEscape();
        ev.dataTransfer.setData(CATALOG_DRAG_TYPE, entry.id);
        ev.dataTransfer.effectAllowed = "copy";
        // The unit itself follows the pointer when its thumbnail is ready.
        const img = ev.currentTarget.querySelector("img");
        if (img?.complete && img.naturalWidth > 0) ev.dataTransfer.setDragImage(img, ROW_THUMB.w / 2, ROW_THUMB.h / 2);
      }}
      onClick={() => placeAtFreeSpot(entry)}
      onMouseEnter={(ev) => events.onHover(entry, ev.currentTarget)}
      onMouseLeave={() => events.onLeave()}
      onFocus={(ev) => {
        // A click focuses the row too; the preview opens on keyboard focus only (hover covers the mouse).
        if (ev.currentTarget.matches(":focus-visible")) events.onFocus(entry, ev.currentTarget);
      }}
      onBlur={() => events.onLeave()}
      onKeyDown={(ev) => {
        if (ev.key === "Escape" && events.onEscape()) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      }}
      title={t("catalog.addTitle")}
    >
      <Thumbnail entry={entry} size={ROW_THUMB} priority={visible ? PRIORITY.visible : null} />
      <span className="cat-text">
        <span className="cat-name">{t(entry.name)}</span>
        <span className="cat-dims">{dims(entry)}</span>
      </span>
    </button>
  );
}

function Thumbnail({ entry, size, priority }: { entry: CatalogEntry; size: { w: number; h: number }; priority: Priority | null }) {
  const thumb = useThumbnail(entry, size.w, size.h, priority);
  return (
    <span className={`cat-thumb${thumb.status === "loading" ? " is-loading" : ""}`} style={{ width: size.w, height: size.h }} aria-hidden>
      {thumb.url ? <img src={thumb.url} alt="" width={size.w} height={size.h} draggable={false} /> : thumb.status === "unavailable" && <PlanSymbol entry={entry} size={size} />}
    </span>
  );
}

/** Without WebGL: the unit's footprint as in the plan, to scale within the thumbnail. */
function PlanSymbol({ entry, size }: { entry: CatalogEntry; size: { w: number; h: number } }) {
  const pad = 6;
  const s = Math.min((size.w - 2 * pad) / entry.width, (size.h - 2 * pad) / entry.depth);
  const w = entry.width * s;
  const d = entry.depth * s;
  const x = (size.w - w) / 2;
  const y = (size.h - d) / 2;
  return (
    <svg className="cat-thumb-plan" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
      <rect x={x} y={y} width={w} height={d} />
      {/* The front edge, as the plan marks the operating side. */}
      <line x1={x} y1={y + d - 2} x2={x + w} y2={y + d - 2} />
    </svg>
  );
}

function CatalogPreview({ entry, row, sidebar }: { entry: CatalogEntry; row: HTMLElement; sidebar: RefObject<HTMLElement | null> }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Next to the sidebar, centred on the row, kept inside the window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const r = row.getBoundingClientRect();
      const side = sidebar.current?.getBoundingClientRect() ?? r;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const maxLeft = window.innerWidth - w - PREVIEW_GAP;
      const maxTop = window.innerHeight - h - PREVIEW_GAP;
      setPos({
        left: Math.max(PREVIEW_GAP, Math.min(side.right + PREVIEW_GAP, maxLeft)),
        top: Math.max(PREVIEW_GAP, Math.min(r.top + r.height / 2 - h / 2, maxTop)),
      });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [entry, row, sidebar]);

  const c = entry.connections;
  const lang = currentLang();
  const rows: [string, string][] = [[t("list.dimensions"), dims(entry)]];
  if (entry.elevation > 0) rows.push([t("inspector.mountHeight"), `${num(entry.elevation)} mm`]);
  const facts = rows.length;
  if (c.electricKw) rows.push([t("list.electric"), num(c.electricKw, 1)]);
  if (c.voltage) rows.push([t("list.voltage"), String(c.voltage)]);
  if (c.gasKw) rows.push([t("list.gas"), num(c.gasKw, 1)]);
  const water = waterText({ coldWater: !!c.coldWater, hotWater: !!c.hotWater }, lang);
  if (water) rows.push([t("list.water"), water]);
  const drain = drainText({ drain: !!c.drain, floorDrain: !!c.floorDrain }, lang);
  if (drain) rows.push([t("list.drain"), drain]);
  if (c.exhaustM3h) rows.push([t("list.exhaust"), num(c.exhaustM3h)]);

  return createPortal(
    <div
      ref={ref}
      id={PREVIEW_ID}
      role="tooltip"
      className="cat-preview"
      style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }}
    >
      <Thumbnail entry={entry} size={PREVIEW_THUMB} priority={PRIORITY.preview} />
      <div className="cat-preview-name">{t(entry.name)}</div>
      {entry.description && <p className="cat-preview-description">{t(entry.description)}</p>}
      <dl className="cat-preview-facts">
        {rows.map(([k, v]) => (
          <div key={k} className="cat-preview-row">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {rows.length === facts && <p className="cat-preview-none">{t("catalog.noConnections")}</p>}
    </div>,
    document.body,
  );
}

/** Places an entry against the first wall stretch that has room, else in the middle of the room. */
export function placeAtFreeSpot(entry: CatalogEntry) {
  const st = useStore.getState();
  const { room, items } = st.project;
  const b = bounds(room.points);
  const centre = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const draft = itemFromCatalog(entry, centre.x, centre.y);
  const placement = placementOf(entry.kind);
  const others = items.filter((i) => placementOf(kindOf(i.catalogId)) === placement);
  // Try along the north wall first, left to right in grid steps, then the middle.
  const step = Math.max(st.prefs.grid, 50);
  for (let x = b.minX + entry.width / 2; x <= b.maxX - entry.width / 2; x += step) {
    const s = snapItem({ ...draft, x, y: b.minY + entry.depth / 2 }, room, others, st.prefs.grid, true, wallSnapReach(entry.kind));
    const candidate = { ...draft, ...s };
    if (!others.some((o) => overlapsItem(o, candidate))) {
      st.addItems([{ ...draft, x: s.x, y: s.y, rotation: s.rotation }]);
      return;
    }
  }
  st.addItems([draft]);
}

function overlapsItem(a: Item, b: Item): boolean {
  return convexOverlap(footprint(a), footprint(b));
}
