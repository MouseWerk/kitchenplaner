// The equipment catalog in the left sidebar: search, categories, drag into the plan or click to
// place at a free spot. Every entry shows a small 3D preview of its model; hovering or focusing a
// row opens a larger preview with the dimensions and connection values next to the sidebar.
//
// The rows are one tab stop (a roving tabindex): Up and Down move between them, Home and End go
// to the first and the last, across the groups that are open.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { CATALOG, CATEGORIES, SUBGROUPS, type CatalogEntry, type CategoryId, type GroupId } from "../kinds/registry";
import { drainText, waterText } from "../model/equipment";
import { freeSpot } from "../model/freeSpot";
import { bounds } from "../model/geometry";
import { itemFromCatalog } from "../model/project";
import { useStore } from "../store/store";
import { announcePlaced, CATALOG_DRAG_TYPE } from "../views/PlanView";
import { currentLang, num, t as translate, useT } from "../lib/i18n";
import { PRIORITY, useThumbnail, type Priority } from "../three/thumbnails";

/** Thumbnail in a row and in the hover preview (CSS pixels). */
const ROW_THUMB = { w: 56, h: 44 } as const;
const PREVIEW_THUMB = { w: 240, h: 180 } as const;
/** Mouse hover waits this long before the preview opens; moving between rows then is instant. */
const HOVER_DELAY_MS = 350;
/** The preview stays this long after the pointer left a row. */
const LEAVE_GRACE_MS = 120;
/** Gap between the sidebar and the preview, and the preview's minimum distance to the window edge. */
const PREVIEW_GAP = 8;

/** "800 × 900 × 900" */
const dims = (e: CatalogEntry) => `${e.width} × ${e.depth} × ${e.height}`;

/**
 * True when every word of the query occurs in the entry's name, category, sub-group, dimensions or
 * tags. "x" and "×" are the same, so "800x900" finds 800 × 900 × 900.
 */
export function matchesQuery(entry: CatalogEntry, query: string, t: typeof translate = translate): boolean {
  const words = query.toLocaleLowerCase().replace(/×/g, "x").split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [t(entry.name), t(`category.${entry.category}` as const), ...(entry.group ? [t(`group.${entry.group}` as const)] : []), `${entry.width}x${entry.depth}x${entry.height}`, ...(entry.tags ?? [])]
    .join(" ")
    .toLocaleLowerCase();
  return words.every((w) => hay.includes(w));
}

/**
 * The entries of a sidebar group split into its sub-groups (in their order, empty ones left out),
 * or one part without a heading for a group without sub-groups.
 */
export function subgroupsOf(category: CategoryId, entries: readonly CatalogEntry[]): { id: GroupId | null; entries: CatalogEntry[] }[] {
  const order = SUBGROUPS[category];
  if (!order) return [{ id: null, entries: [...entries] }];
  return order.map((id) => ({ id, entries: entries.filter((e) => e.group === id) })).filter((p) => p.entries.length > 0);
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
        // Rows a few rows beyond the edges are about to scroll in: ask for them early. The rest
        // of the catalog is not drawn until it comes near (thumbnails.ts).
        { root: root.current, rootMargin: "240px 0px" },
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
  const searchRef = useRef<HTMLInputElement>(null);
  /** The row that holds the catalog's tab stop. */
  const [current, setCurrent] = useState<string | null>(null);
  const q = query.trim();

  const groups = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        id: c,
        entries: CATALOG.filter((e) => e.category === c && matchesQuery(e, q, t)),
      })).filter((g) => g.entries.length > 0),
    [q, t],
  );

  const hits = groups.reduce((n, g) => n + g.entries.length, 0);
  const isOpen = (id: string) => q !== "" || !closed.has(id);
  // The tab stop stays on its row while that row is shown, else it moves to the first row shown.
  const shown = groups.filter((g) => isOpen(g.id)).flatMap((g) => g.entries.map((e) => e.id));
  const tabStop = current !== null && shown.includes(current) ? current : (shown[0] ?? null);

  const clearSearch = () => {
    setQuery("");
    searchRef.current?.focus();
  };

  const onRowKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>(".cat-row");
    if (!row || e.altKey || e.ctrlKey || e.metaKey) return;
    const to = rovingTarget([...(scroller.current?.querySelectorAll<HTMLElement>(".cat-row") ?? [])], row, e.key);
    if (!to) return;
    // The window's shortcuts would nudge the selected units with the same arrows.
    e.preventDefault();
    e.stopPropagation();
    to.focus();
  };

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
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={t("catalog.search")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query !== "") {
                e.preventDefault();
                e.stopPropagation();
                setQuery("");
              }
            }}
            aria-label={t("catalog.search")}
          />
          {query !== "" && (
            <button type="button" className="icon-btn search-clear" onClick={clearSearch} title={t("catalog.clearSearch")} aria-label={t("catalog.clearSearch")}>
              <X size={14} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </label>
        <p className="sr-only" role="status">
          {q !== "" ? t("catalog.found", { n: hits }) : ""}
        </p>
      </div>
      <div ref={scroller} className="sidebar-scroll" onScroll={preview ? hide : undefined} onKeyDown={onRowKey}>
        <VisibilityContext.Provider value={observe}>
          {groups.length === 0 && (
            <div className="empty">
              <p>{t("catalog.noMatch")}</p>
              <button type="button" className="btn small" onClick={clearSearch}>
                {t("catalog.clearSearch")}
              </button>
            </div>
          )}
          {groups.map((g) => {
            const open = isOpen(g.id);
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
                  {open ? <ChevronDown size={14} strokeWidth={1.75} aria-hidden /> : <ChevronRight size={14} strokeWidth={1.75} aria-hidden />}
                  <span>{t(`category.${g.id}` as const)}</span>
                  <span className="count">{g.entries.length}</span>
                </button>
                {open &&
                  subgroupsOf(g.id, g.entries).map((part) => (
                    <div key={part.id ?? "all"} className="cat-part" role={part.id ? "group" : undefined} aria-label={part.id ? t(`group.${part.id}` as const) : undefined}>
                      {part.id && (
                        <h3 className="cat-subhead" aria-hidden title={t(`group.${part.id}` as const)}>
                          <span>{t(`group.${part.id}` as const)}</span>
                          <span className="count">{part.entries.length}</span>
                        </h3>
                      )}
                      <ul className="cat-list">
                        {part.entries.map((e) => (
                          <li key={e.id}>
                            <CatalogRow entry={e} events={rowEvents} described={preview?.entry.id === e.id} tabbable={e.id === tabStop} onCurrent={setCurrent} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
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

/** Where Up, Down, Home and End move from `row` among `rows`; null for any other key or at an end. */
export function rovingTarget<T>(rows: readonly T[], row: T, key: string): T | null {
  const i = rows.indexOf(row);
  if (i < 0 || rows.length === 0) return null;
  const to = key === "ArrowDown" ? i + 1 : key === "ArrowUp" ? i - 1 : key === "Home" ? 0 : key === "End" ? rows.length - 1 : -1;
  return to >= 0 && to < rows.length && to !== i ? rows[to] : null;
}

function CatalogRow({ entry, events, described, tabbable, onCurrent }: { entry: CatalogEntry; events: RowEvents; described: boolean; tabbable: boolean; onCurrent: (id: string) => void }) {
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
      tabIndex={tabbable ? 0 : -1}
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
        onCurrent(entry.id);
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
      {thumb.url ? <img src={thumb.url} alt="" width={size.w} height={size.h} draggable={false} onError={thumb.onError} /> : thumb.status === "unavailable" && <PlanSymbol entry={entry} size={size} />}
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

/**
 * Places an entry where the plan check has nothing to say about it (`freeSpot`): against a wall
 * when one has room, else free in the room; in the middle of the room only when it fits nowhere.
 */
export function placeAtFreeSpot(entry: CatalogEntry) {
  const st = useStore.getState();
  const b = bounds(st.project.room.points);
  const draft = itemFromCatalog(entry, (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
  const spot = freeSpot(st.project, draft, st.prefs.grid);
  st.addItems([spot ? { ...draft, ...spot } : draft]);
  announcePlaced(draft.id);
}
