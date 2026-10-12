// The equipment catalog in the left sidebar: search, categories, drag into the plan or click to
// place at a free spot.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { CATALOG, CATEGORIES, isOverhead, kindOf, type CatalogEntry } from "../model/catalog";
import { bounds, convexOverlap, footprint, snapItem } from "../model/geometry";
import { itemFromCatalog } from "../model/project";
import type { Item } from "../model/types";
import { useStore } from "../store/store";
import { CATALOG_DRAG_TYPE } from "../views/PlanView";
import { useT } from "../lib/i18n";

export function CatalogPanel() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const q = query.trim().toLocaleLowerCase();

  const groups = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        id: c,
        entries: CATALOG.filter((e) => e.category === c && (!q || t(e.name).toLocaleLowerCase().includes(q))),
      })).filter((g) => g.entries.length > 0),
    [q, t],
  );

  return (
    <aside className="sidebar" aria-label={t("catalog.title")}>
      <div className="sidebar-head">
        <h2 className="eyebrow">{t("catalog.title")}</h2>
        <label className="search">
          <Search size={14} strokeWidth={1.75} aria-hidden />
          <input type="search" value={query} placeholder={t("catalog.search")} onChange={(e) => setQuery(e.target.value)} aria-label={t("catalog.search")} />
        </label>
      </div>
      <div className="sidebar-scroll">
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
                      <CatalogRow entry={e} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="sidebar-hint">{t("catalog.hint")}</p>
    </aside>
  );
}

function CatalogRow({ entry }: { entry: CatalogEntry }) {
  const t = useT();
  return (
    <button
      type="button"
      className="cat-row"
      draggable
      onDragStart={(ev) => {
        ev.dataTransfer.setData(CATALOG_DRAG_TYPE, entry.id);
        ev.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => placeAtFreeSpot(entry)}
      title={t("catalog.addTitle")}
    >
      <span className="cat-name">{t(entry.name)}</span>
      <span className="cat-dims">
        {entry.width} × {entry.depth} × {entry.height}
      </span>
    </button>
  );
}

/** Places an entry against the first wall stretch that has room, else in the middle of the room. */
export function placeAtFreeSpot(entry: CatalogEntry) {
  const st = useStore.getState();
  const { room, items } = st.project;
  const b = bounds(room.points);
  const centre = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const draft = itemFromCatalog(entry, centre.x, centre.y);
  const others = items.filter((i) => isOverhead(kindOf(i.catalogId)) === isOverhead(entry.kind));
  // Try along the north wall first, left to right in grid steps, then the middle.
  const step = Math.max(st.prefs.grid, 50);
  for (let x = b.minX + entry.width / 2; x <= b.maxX - entry.width / 2; x += step) {
    const s = snapItem({ ...draft, x, y: b.minY + entry.depth / 2 }, room, others, st.prefs.grid, true);
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
