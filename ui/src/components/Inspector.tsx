// The right panel: properties of the selected item or opening; with nothing selected the
// project, the room, its openings, the connection totals and the plan check.

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Copy, DoorOpen, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { catalogEntry, isOverhead, kindOf } from "../model/catalog";
import { checkProject } from "../model/checks";
import { bounds, clampOpening, lRoom, normalizeAngle, rectRoom, walls } from "../model/geometry";
import { newId, positions } from "../model/project";
import type { Connections, Item, Opening, OpeningKind, Project } from "../model/types";
import { selectedItems, useStore } from "../store/store";
import { num, useT, type TKey } from "../lib/i18n";
import { CheckField, NumberField, SelectField, TextField } from "./Fields";
import { duplicateSelected, rotateSelected } from "../lib/commands";

/** Largest length accepted in a field (mm): 100 m. */
const MAX_LEN = 100_000;
/** Smallest item size (mm). */
const MIN_SIZE = 10;

export function Inspector() {
  const t = useT();
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const items = useMemo(() => selectedItems({ project, selection }), [project, selection]);
  const opening = project.room.openings.find((o) => o.id === selection.opening);

  return (
    <aside className="inspector" aria-label={t("inspector.title")}>
      <div className="inspector-scroll">
        {items.length === 1 ? (
          <ItemPanel item={items[0]} project={project} />
        ) : items.length > 1 ? (
          <MultiPanel count={items.length} />
        ) : opening ? (
          <OpeningPanel opening={opening} project={project} />
        ) : (
          <ProjectPanel project={project} />
        )}
      </div>
    </aside>
  );
}

function Section(props: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="insp-section">
      <div className="insp-section-head">
        <h3 className="eyebrow">{props.title}</h3>
        {props.actions}
      </div>
      {props.children}
    </section>
  );
}

function ItemPanel({ item, project }: { item: Item; project: Project }) {
  const t = useT();
  const st = useStore.getState();
  const pos = positions(project).get(item.id);
  const entry = catalogEntry(item.catalogId);
  const set = (patch: Partial<Item>) => st.updateItems([item.id], () => patch);
  const setConn = (patch: Partial<Connections>) => st.updateItems([item.id], (it) => ({ connections: { ...it.connections, ...patch } }));
  const c = item.connections;
  const overhead = isOverhead(kindOf(item.catalogId));

  return (
    <>
      <div className="insp-title">
        <span className="pos-badge">{pos}</span>
        <div>
          <div className="insp-name">{item.name}</div>
          {entry && <div className="insp-sub">{t(entry.name)}</div>}
        </div>
      </div>
      <Section title={t("inspector.item")}>
        <div className="grid">
          <TextField label={t("inspector.name")} value={item.name} onChange={(v) => set({ name: v })} wide />
          <NumberField label={t("inspector.width")} unit="mm" value={item.width} min={MIN_SIZE} max={MAX_LEN} step={10} onChange={(v) => set({ width: v })} />
          <NumberField label={t("inspector.depth")} unit="mm" value={item.depth} min={MIN_SIZE} max={MAX_LEN} step={10} onChange={(v) => set({ depth: v })} />
          <NumberField label={t("inspector.height")} unit="mm" value={item.height} min={MIN_SIZE} max={MAX_LEN} step={10} onChange={(v) => set({ height: v })} />
          <NumberField label={overhead ? t("inspector.mountHeight") : t("inspector.elevation")} unit="mm" value={item.elevation} min={0} max={MAX_LEN} step={10} onChange={(v) => set({ elevation: v })} />
        </div>
        {entry?.widths && (
          <div className="chips" role="group" aria-label={t("inspector.widths")}>
            {entry.widths.map((w) => (
              <button key={w} type="button" className={w === item.width ? "chip is-current" : "chip"} aria-pressed={w === item.width} onClick={() => set({ width: w })}>
                {w}
              </button>
            ))}
          </div>
        )}
      </Section>
      <Section title={t("inspector.position")}>
        <div className="grid">
          <NumberField label="X" unit="mm" value={item.x} step={10} onChange={(v) => set({ x: v })} />
          <NumberField label="Y" unit="mm" value={item.y} step={10} onChange={(v) => set({ y: v })} />
          <NumberField label={t("inspector.rotation")} unit="°" value={item.rotation} step={15} onChange={(v) => set({ rotation: normalizeAngle(v) })} />
          <div className="field">
            <span className="field-label" aria-hidden>
              &nbsp;
            </span>
            <div className="btn-row">
              <button type="button" className="icon-btn" title={t("inspector.rotateLeft")} aria-label={t("inspector.rotateLeft")} onClick={() => rotateSelected(-90)}>
                <RotateCcw size={16} strokeWidth={1.75} />
              </button>
              <button type="button" className="icon-btn" title={t("inspector.rotateRight")} aria-label={t("inspector.rotateRight")} onClick={() => rotateSelected(90)}>
                <RotateCw size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </Section>
      <Section title={t("inspector.connections")}>
        <div className="grid">
          <NumberField label={t("list.electric")} value={c.electricKw ?? 0} min={0} max={1000} step={0.1} digits={1} onChange={(v) => setConn({ electricKw: v || undefined })} />
          <SelectField
            label={t("list.voltage")}
            value={c.voltage ?? 0}
            options={[
              { value: 0, label: "–" },
              { value: 230, label: "230 V" },
              { value: 400, label: "400 V" },
            ]}
            onChange={(v) => setConn({ voltage: v || undefined })}
          />
          <NumberField label={t("list.gas")} value={c.gasKw ?? 0} min={0} max={1000} step={0.1} digits={1} onChange={(v) => setConn({ gasKw: v || undefined })} />
          <NumberField label={t("list.exhaust")} value={c.exhaustM3h ?? 0} min={0} max={100_000} step={100} onChange={(v) => setConn({ exhaustM3h: v || undefined })} />
        </div>
        <div className="checks">
          <CheckField label={t("inspector.coldWater")} checked={!!c.coldWater} onChange={(v) => setConn({ coldWater: v || undefined })} />
          <CheckField label={t("inspector.hotWater")} checked={!!c.hotWater} onChange={(v) => setConn({ hotWater: v || undefined })} />
          <CheckField label={t("list.drain")} checked={!!c.drain} onChange={(v) => setConn({ drain: v || undefined })} />
          <CheckField label={t("list.floorDrain")} checked={!!c.floorDrain} onChange={(v) => setConn({ floorDrain: v || undefined })} />
        </div>
      </Section>
      <Section title={t("list.note")}>
        <TextField label={t("list.note")} value={item.note ?? ""} onChange={(v) => set({ note: v || undefined })} wide multiline />
      </Section>
      <div className="insp-actions">
        <button type="button" className="btn" onClick={duplicateSelected}>
          <Copy size={15} strokeWidth={1.75} aria-hidden /> {t("inspector.duplicate")}
        </button>
        <button type="button" className="btn danger" onClick={() => useStore.getState().removeSelected()}>
          <Trash2 size={15} strokeWidth={1.75} aria-hidden /> {t("inspector.delete")}
        </button>
      </div>
    </>
  );
}

function MultiPanel({ count }: { count: number }) {
  const t = useT();
  return (
    <>
      <div className="insp-title">
        <div className="insp-name">{t("inspector.multi", { n: count })}</div>
      </div>
      <div className="insp-actions">
        <button type="button" className="btn" onClick={() => rotateSelected(90)}>
          <RotateCw size={15} strokeWidth={1.75} aria-hidden /> {t("inspector.rotateRight")}
        </button>
        <button type="button" className="btn" onClick={duplicateSelected}>
          <Copy size={15} strokeWidth={1.75} aria-hidden /> {t("inspector.duplicate")}
        </button>
        <button type="button" className="btn danger" onClick={() => useStore.getState().removeSelected()}>
          <Trash2 size={15} strokeWidth={1.75} aria-hidden /> {t("inspector.delete")}
        </button>
      </div>
    </>
  );
}

function wallLabel(t: (k: TKey, v?: Record<string, string | number>) => string, project: Project, index: number): string {
  const w = walls(project.room)[index];
  if (!w) return String(index + 1);
  // The compass side the wall stands on: opposite its inward normal.
  const n = w.inward;
  const side = Math.abs(n.x) > Math.abs(n.y) ? (n.x > 0 ? "west" : "east") : n.y > 0 ? "north" : "south";
  return t("inspector.wallN", { n: index + 1, side: t(`facing.${side}` as const), length: Math.round(w.length) });
}

function OpeningPanel({ opening, project }: { opening: Opening; project: Project }) {
  const t = useT();
  const st = useStore.getState();
  const set = (patch: Partial<Opening>) => st.updateOpening(opening.id, clampOpening(project.room, { ...opening, ...patch }));
  const kinds: OpeningKind[] = ["door", "window", "passage"];
  return (
    <>
      <div className="insp-title">
        <DoorOpen size={18} strokeWidth={1.75} aria-hidden />
        <div className="insp-name">{t(`opening.${opening.kind}` as const)}</div>
      </div>
      <Section title={t("inspector.opening")}>
        <div className="grid">
          <SelectField label={t("inspector.kind")} value={opening.kind} options={kinds.map((k) => ({ value: k, label: t(`opening.${k}` as const) }))} onChange={(v) => set({ kind: v, sill: v === "window" ? opening.sill || 900 : 0 })} />
          <SelectField label={t("inspector.wall")} value={opening.wall} options={project.room.points.map((_, i) => ({ value: i, label: wallLabel(t, project, i) }))} onChange={(v) => set({ wall: v })} />
          <NumberField label={t("inspector.offset")} unit="mm" value={opening.offset} min={0} max={MAX_LEN} step={10} onChange={(v) => set({ offset: v })} />
          <NumberField label={t("inspector.width")} unit="mm" value={opening.width} min={100} max={MAX_LEN} step={10} onChange={(v) => set({ width: v })} />
          <NumberField label={t("inspector.height")} unit="mm" value={opening.height} min={100} max={MAX_LEN} step={10} onChange={(v) => set({ height: v })} />
          <NumberField label={t("inspector.sill")} unit="mm" value={opening.sill} min={0} max={MAX_LEN} step={10} onChange={(v) => set({ sill: v })} />
        </div>
      </Section>
      <div className="insp-actions">
        <button type="button" className="btn danger" onClick={() => useStore.getState().removeSelected()}>
          <Trash2 size={15} strokeWidth={1.75} aria-hidden /> {t("inspector.delete")}
        </button>
      </div>
    </>
  );
}

/** The width and depth of a rectangular, axis-aligned room; null for other shapes. */
export function rectSize(project: Project): { w: number; d: number } | null {
  const p = project.room.points;
  if (p.length !== 4) return null;
  const b = bounds(p);
  const axis = p.every((q) => (Math.abs(q.x - b.minX) < 0.5 || Math.abs(q.x - b.maxX) < 0.5) && (Math.abs(q.y - b.minY) < 0.5 || Math.abs(q.y - b.maxY) < 0.5));
  return axis ? { w: b.maxX - b.minX, d: b.maxY - b.minY } : null;
}

function ProjectPanel({ project }: { project: Project }) {
  const t = useT();
  const st = useStore.getState();
  const info = project.info;
  const setInfo = (patch: Partial<Project["info"]>) => st.change((p) => ({ ...p, info: { ...p.info, ...patch } }));
  const rect = rectSize(project);
  const issues = useMemo(() => checkProject(project), [project]);
  const pos = positions(project);
  const totals = useMemo(() => connectionTotals(project.items), [project.items]);

  const resize = (w: number, d: number) => {
    const b = bounds(project.room.points);
    st.updateRoom((r) => ({ points: rectRoom(w, d).map((q) => ({ x: q.x + b.minX, y: q.y + b.minY })), openings: r.openings.map((o) => o) }));
    // Openings may now stick out of a shorter wall.
    st.change((p) => ({ ...p, room: { ...p.room, openings: p.room.openings.map((o) => clampOpening(p.room, o)) } }), { gesture: true });
  };

  const addOpening = (kind: OpeningKind) => {
    const w = walls(project.room)[0];
    const width = kind === "window" ? 1200 : 1010;
    const o: Opening = { id: newId(), kind, wall: 0, offset: (w?.length ?? width) / 2, width, height: kind === "window" ? 1200 : 2135, sill: kind === "window" ? 900 : 0 };
    st.change((p) => ({ ...p, room: { ...p.room, openings: [...p.room.openings, clampOpening(p.room, o)] } }));
    st.select({ opening: o.id });
  };

  return (
    <>
      <Section title={t("inspector.project")}>
        <div className="grid">
          <TextField label={t("sheet.project")} value={info.name} onChange={(v) => setInfo({ name: v })} wide />
          <TextField label={t("sheet.client")} value={info.client} onChange={(v) => setInfo({ client: v })} wide />
          <TextField label={t("sheet.author")} value={info.author} onChange={(v) => setInfo({ author: v })} />
          <TextField label={t("sheet.date")} type="date" value={info.date} onChange={(v) => setInfo({ date: v })} />
        </div>
      </Section>
      <Section title={t("inspector.room")}>
        <div className="grid">
          {rect ? (
            <>
              <NumberField label={t("inspector.width")} unit="mm" value={rect.w} min={1000} max={MAX_LEN} step={100} onChange={(v) => resize(v, rect.d)} />
              <NumberField label={t("inspector.depth")} unit="mm" value={rect.d} min={1000} max={MAX_LEN} step={100} onChange={(v) => resize(rect.w, v)} />
            </>
          ) : (
            <p className="hint wide">{t("inspector.freeShape", { n: project.room.points.length })}</p>
          )}
          <NumberField label={t("inspector.roomHeight")} unit="mm" value={project.room.height} min={2000} max={20_000} step={50} onChange={(v) => st.updateRoom(() => ({ height: v }))} />
          <NumberField label={t("inspector.wallThickness")} unit="mm" value={project.room.wallThickness} min={50} max={1000} step={10} onChange={(v) => st.updateRoom(() => ({ wallThickness: v }))} />
        </div>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={() => st.updateRoom(() => ({ points: rectRoom(8000, 6000), openings: [] }))}>
            {t("inspector.shapeRect")}
          </button>
          <button type="button" className="btn small" onClick={() => st.updateRoom(() => ({ points: lRoom(10000, 8000, 4000, 3000), openings: [] }))}>
            {t("inspector.shapeL")}
          </button>
        </div>
        <p className="hint">{t("inspector.roomEditHint")}</p>
      </Section>
      <Section
        title={t("inspector.openings")}
        actions={
          <div className="btn-row">
            <button type="button" className="btn small" onClick={() => addOpening("door")}>
              + {t("opening.door")}
            </button>
            <button type="button" className="btn small" onClick={() => addOpening("window")}>
              + {t("opening.window")}
            </button>
          </div>
        }
      >
        {project.room.openings.length === 0 ? (
          <p className="hint">{t("inspector.noOpenings")}</p>
        ) : (
          <ul className="list">
            {project.room.openings.map((o) => (
              <li key={o.id}>
                <button type="button" className="list-row" onClick={() => st.select({ opening: o.id })}>
                  <span>{t(`opening.${o.kind}` as const)}</span>
                  <span className="muted">
                    {wallLabel(t, project, o.wall)} · {o.width}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t("inspector.totals")}>
        <dl className="totals">
          <dt>{t("list.electric")}</dt>
          <dd>{num(totals.electricKw, 1)}</dd>
          <dt>{t("list.gas")}</dt>
          <dd>{num(totals.gasKw, 1)}</dd>
          <dt>{t("list.exhaust")}</dt>
          <dd>{num(totals.exhaustM3h)}</dd>
          <dt>{t("inspector.waterPoints")}</dt>
          <dd>{totals.water}</dd>
          <dt>{t("inspector.drainPoints")}</dt>
          <dd>{totals.drains}</dd>
          <dt>{t("inspector.itemCount")}</dt>
          <dd>{project.items.length}</dd>
        </dl>
      </Section>
      <Section title={t("inspector.check")}>
        {issues.length === 0 ? (
          <p className="notice ok">
            <CheckCircle2 size={15} strokeWidth={1.75} aria-hidden /> {t("check.none")}
          </p>
        ) : (
          <ul className="list">
            {issues.map((i, n) => (
              <li key={n}>
                <button type="button" className="list-row notice warn" onClick={() => st.select({ items: i.itemIds })}>
                  <AlertTriangle size={15} strokeWidth={1.75} aria-hidden />
                  <span>{t(i.key, i.vars)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {pos.size === 0 && <p className="hint">{t("inspector.emptyHint")}</p>}
      </Section>
    </>
  );
}

export function connectionTotals(items: readonly Item[]) {
  let electricKw = 0;
  let gasKw = 0;
  let exhaustM3h = 0;
  let water = 0;
  let drains = 0;
  for (const it of items) {
    const c = it.connections;
    electricKw += c.electricKw ?? 0;
    gasKw += c.gasKw ?? 0;
    exhaustM3h += c.exhaustM3h ?? 0;
    if (c.coldWater || c.hotWater) water++;
    if (c.drain || c.floorDrain) drains++;
  }
  return { electricKw, gasKw, exhaustM3h, water, drains };
}
