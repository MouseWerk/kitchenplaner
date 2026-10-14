// The right panel: properties of the selected item, or in the room mode of the selected wall,
// corner, partition or opening; with nothing selected the project, the room, its openings, the
// connection totals and the plan check.

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Copy, DoorOpen, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { catalogEntry, kindOf, placementOf, type Placement } from "../kinds/registry";
import { checkProject } from "../model/checks";
import { bounds, MAX_LENGTH, lRoom, normalizeAngle, rectRoom, walls } from "../model/geometry";
import {
  changeOpeningKind,
  clampToHost,
  isValidOutline,
  lineAngle,
  MIN_PARTITION_LENGTH,
  moveCorner,
  newOpening,
  openingHost,
  partitionLength,
  selectedWall,
  setPartitionLength,
  setWallLength,
  updatePartition,
  type OpeningHostRef,
} from "../model/roomEdit";
import { removeRoomSelection } from "../views/RoomEditLayer";
import { newId, positions, variantPatch } from "../model/project";
import type { Connections, Item, Opening, OpeningKind, Partition, Project, Vec2 } from "../model/types";
import { selectedItems, useStore } from "../store/store";
import { num, useT, type TKey } from "../lib/i18n";
import { CheckField, DateField, NumberField, SelectField, TextField } from "./Fields";
import { duplicateSelected, rotateSelected } from "../lib/commands";

/** Smallest item size (mm). */
const MIN_SIZE = 10;

export function Inspector() {
  const t = useT();
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const roomMode = useStore((s) => s.mode === "room");
  const items = useMemo(() => selectedItems({ project, selection }), [project, selection]);
  const opening = project.room.openings.find((o) => o.id === selection.opening);
  const partition = selection.partitions.length === 1 && selection.corners.length === 0 ? project.room.partitions.find((w) => w.id === selection.partitions[0]) : undefined;
  const wall = selection.partitions.length === 0 ? selectedWall(project.room, selection.corners) : null;
  const roomCount = selection.corners.length + selection.partitions.length;

  return (
    <aside className="inspector" aria-label={t("inspector.title")}>
      <div className="inspector-scroll">
        {items.length === 1 ? (
          <ItemPanel item={items[0]} project={project} />
        ) : items.length > 1 ? (
          <MultiPanel count={items.length} />
        ) : opening ? (
          <OpeningPanel opening={opening} project={project} />
        ) : roomMode && partition ? (
          <PartitionPanel partition={partition} project={project} />
        ) : roomMode && wall !== null ? (
          <WallPanel index={wall} project={project} />
        ) : roomMode && selection.corners.length === 1 && selection.partitions.length === 0 ? (
          <CornerPanel index={selection.corners[0]} project={project} />
        ) : roomMode && roomCount > 0 ? (
          <RoomSelectionPanel count={roomCount} />
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

/** What the lower edge above the floor is called, by where the unit stands. */
const ELEVATION_LABEL: Record<Placement, TKey> = {
  floor: "inspector.elevation",
  flat: "inspector.elevation",
  tableTop: "inspector.standingHeight",
  overhead: "inspector.mountHeight",
};

function ItemPanel({ item, project }: { item: Item; project: Project }) {
  const t = useT();
  const st = useStore.getState();
  const pos = positions(project).get(item.id);
  const entry = catalogEntry(item.catalogId);
  const set = (patch: Partial<Item>) => st.updateItems([item.id], () => patch);
  const setConn = (patch: Partial<Connections>) => st.updateItems([item.id], (it) => ({ connections: { ...it.connections, ...patch } }));
  const c = item.connections;
  const placement = placementOf(kindOf(item.catalogId));

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
          <NumberField label={t("inspector.width")} unit="mm" value={item.width} min={MIN_SIZE} max={MAX_LENGTH} step={10} onChange={(v) => set({ width: v })} />
          <NumberField label={t("inspector.depth")} unit="mm" value={item.depth} min={MIN_SIZE} max={MAX_LENGTH} step={10} onChange={(v) => set({ depth: v })} />
          <NumberField label={t("inspector.height")} unit="mm" value={item.height} min={MIN_SIZE} max={MAX_LENGTH} step={10} onChange={(v) => set({ height: v })} />
          <NumberField label={t(ELEVATION_LABEL[placement])} unit="mm" value={item.elevation} min={0} max={MAX_LENGTH} step={10} onChange={(v) => set({ elevation: v })} />
        </div>
        {entry?.widths && (
          <div className="chips" role="group" aria-label={t("inspector.widths")}>
            {entry.widths.map((w) => (
              <button key={w} type="button" className={w === item.width ? "chip is-current" : "chip"} aria-pressed={w === item.width} onClick={() => set(variantPatch(item, entry, { width: w }))}>
                {w}
              </button>
            ))}
          </div>
        )}
        {entry?.energy && entry.energy.length > 1 && (
          <div className="chips" role="group" aria-label={t("inspector.energy")}>
            {entry.energy.map((e) => {
              const current = e === (item.energy ?? entry.energy?.[0]);
              return (
                <button key={e} type="button" className={current ? "chip is-current" : "chip"} aria-pressed={current} onClick={() => set(variantPatch(item, entry, { energy: e }))}>
                  {t(`energy.${e}`)}
                </button>
              );
            })}
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

type T = (k: TKey, v?: Record<string, string | number>) => string;

function wallLabel(t: T, project: Project, index: number): string {
  const w = walls(project.room)[index];
  if (!w) return String(index + 1);
  // The compass side the wall stands on: opposite its inward normal.
  const n = w.inward;
  const side = Math.abs(n.x) > Math.abs(n.y) ? (n.x > 0 ? "west" : "east") : n.y > 0 ? "north" : "south";
  return t("inspector.wallN", { n: index + 1, side: t(`facing.${side}` as const), length: Math.round(w.length) });
}

function partitionLabel(t: T, project: Project, id: string): string {
  const i = project.room.partitions.findIndex((w) => w.id === id);
  const w = project.room.partitions[i];
  return w ? t("inspector.partitionN", { n: i + 1, length: Math.round(partitionLength(w)) }) : "–";
}

/** The host of an opening as the inspector names it: its wall or its partition. */
function hostLabel(t: T, project: Project, o: Opening): string {
  return o.partition ? partitionLabel(t, project, o.partition) : wallLabel(t, project, o.wall);
}

const OPENING_KINDS: OpeningKind[] = ["door", "window", "passage", "hatch"];
const ADD_KINDS: OpeningKind[] = ["door", "window", "hatch"];

/** Adds a new opening of `kind` to its host and selects it (one undo step). */
function addOpening(kind: OpeningKind, host: OpeningHostRef) {
  const st = useStore.getState();
  const o = newOpening(st.project.room, newId(), kind, host);
  st.change((p) => ({ ...p, room: { ...p.room, openings: [...p.room.openings, o] } }));
  st.select({ corners: [], partitions: [], opening: o.id });
}

/** The "+ Tür", "+ Fenster", "+ Durchreiche" buttons for one host. */
function AddOpeningButtons({ host }: { host: OpeningHostRef }) {
  const t = useT();
  return (
    <div className="btn-row">
      {ADD_KINDS.map((k) => (
        <button key={k} type="button" className="btn small" onClick={() => addOpening(k, host)}>
          + {t(`opening.${k}` as const)}
        </button>
      ))}
    </div>
  );
}

function DeleteButton() {
  const t = useT();
  const remove = () => {
    const st = useStore.getState();
    if (st.mode === "room") removeRoomSelection();
    else st.removeSelected();
  };
  return (
    <div className="insp-actions">
      <button type="button" className="btn danger" onClick={remove}>
        <Trash2 size={15} strokeWidth={1.75} aria-hidden /> {t("inspector.delete")}
      </button>
    </div>
  );
}

function OpeningPanel({ opening, project }: { opening: Opening; project: Project }) {
  const t = useT();
  const st = useStore.getState();
  const room = project.room;
  const set = (patch: Partial<Opening>) => st.updateOpening(opening.id, clampToHost(room, { ...opening, ...patch }));
  const hostValue = opening.partition ? `p:${opening.partition}` : `w:${opening.wall}`;
  const hosts = [
    ...room.points.map((_, i) => ({ value: `w:${i}`, label: wallLabel(t, project, i) })),
    ...room.partitions.map((w) => ({ value: `p:${w.id}`, label: partitionLabel(t, project, w.id) })),
  ];
  const setHost = (v: string) => {
    const { partition: _, ...rest } = opening;
    const moved: Opening = v.startsWith("p:") ? { ...rest, partition: v.slice(2) } : { ...rest, wall: Number(v.slice(2)) };
    // Into the middle of the new host: the old offset means nothing there.
    const h = openingHost(room, moved);
    st.change((p) => ({ ...p, room: { ...p.room, openings: p.room.openings.map((o) => (o.id === opening.id ? clampToHost(room, { ...moved, offset: (h?.length ?? 0) / 2 }) : o)) } }));
  };
  return (
    <>
      <div className="insp-title">
        <DoorOpen size={18} strokeWidth={1.75} aria-hidden />
        <div className="insp-name">{t(`opening.${opening.kind}` as const)}</div>
      </div>
      <Section title={t("inspector.opening")}>
        <div className="grid">
          <SelectField label={t("inspector.kind")} value={opening.kind} options={OPENING_KINDS.map((k) => ({ value: k, label: t(`opening.${k}` as const) }))} onChange={(v) => st.updateOpening(opening.id, changeOpeningKind(opening, v))} />
          <SelectField label={t("inspector.host")} value={hostValue} options={hosts} onChange={setHost} />
          <NumberField label={t("inspector.offset")} unit="mm" value={opening.offset} min={0} max={MAX_LENGTH} step={10} onChange={(v) => set({ offset: v })} />
          <NumberField label={t("inspector.width")} unit="mm" value={opening.width} min={100} max={MAX_LENGTH} step={10} onChange={(v) => set({ width: v })} />
          <NumberField label={t("inspector.height")} unit="mm" value={opening.height} min={100} max={MAX_LENGTH} step={10} onChange={(v) => set({ height: v })} />
          <NumberField label={t("inspector.sill")} unit="mm" value={opening.sill} min={0} max={MAX_LENGTH} step={10} onChange={(v) => set({ sill: v })} />
        </div>
        {opening.kind === "hatch" && <p className="hint">{t("inspector.hatchHint")}</p>}
      </Section>
      <DeleteButton />
    </>
  );
}

function WallPanel({ index, project }: { index: number; project: Project }) {
  const t = useT();
  const st = useStore.getState();
  const w = walls(project.room)[index];
  if (!w) return null;
  const inWall = project.room.openings.filter((o) => !o.partition && o.wall === index);
  return (
    <>
      <div className="insp-title">
        <div className="insp-name">{wallLabel(t, project, index)}</div>
      </div>
      <Section title={t("inspector.wall")}>
        <div className="grid">
          <NumberField label={t("inspector.length")} unit="mm" value={Math.round(w.length * 10) / 10} min={100} max={MAX_LENGTH} step={10} onChange={(v) => st.updateRoom((r) => setWallLength(r, index, v))} />
          <NumberField label={t("inspector.angle")} unit="°" value={lineAngle(w.a, w.b)} digits={1} disabled onChange={() => {}} />
        </div>
        <p className="hint">{t("inspector.wallLengthHint")}</p>
        <p className="hint">{t("inspector.wallThicknessNote", { mm: project.room.wallThickness })}</p>
      </Section>
      <Section title={t("inspector.addOpening")}>
        <AddOpeningButtons host={{ wall: index }} />
        <OpeningList project={project} openings={inWall} />
      </Section>
    </>
  );
}

function PartitionPanel({ partition, project }: { partition: Partition; project: Project }) {
  const t = useT();
  const st = useStore.getState();
  const length = partitionLength(partition);
  const set = (patch: Partial<Partition>) => st.updateRoom((r) => updatePartition(r, partition.id, patch));
  const inside = project.room.openings.filter((o) => o.partition === partition.id);
  return (
    <>
      <div className="insp-title">
        <div className="insp-name">{partitionLabel(t, project, partition.id)}</div>
      </div>
      <Section title={t("inspector.partition")}>
        <div className="grid">
          <NumberField label={t("inspector.length")} unit="mm" value={Math.round(length * 10) / 10} min={MIN_PARTITION_LENGTH} max={MAX_LENGTH} step={10} onChange={(v) => st.updateRoom((r) => setPartitionLength(r, partition.id, v))} />
          <NumberField label={t("inspector.thickness")} unit="mm" value={partition.thickness} min={20} max={1000} step={10} onChange={(v) => set({ thickness: v })} />
          <NumberField label={t("inspector.height")} unit="mm" value={partition.height} min={100} max={project.room.height} step={50} onChange={(v) => set({ height: v })} />
          <NumberField label={t("inspector.angle")} unit="°" value={lineAngle(partition.a, partition.b)} digits={1} disabled onChange={() => {}} />
        </div>
        {partition.height < project.room.height && <p className="hint">{t("inspector.halfHeight")}</p>}
      </Section>
      <Section title={t("inspector.addOpening")}>
        <AddOpeningButtons host={{ partition: partition.id }} />
        <OpeningList project={project} openings={inside} />
      </Section>
      <DeleteButton />
    </>
  );
}

function CornerPanel({ index, project }: { index: number; project: Project }) {
  const t = useT();
  const st = useStore.getState();
  const p = project.room.points[index];
  if (!p) return null;
  const move = (to: Vec2) =>
    st.updateRoom((r) => {
      const next = moveCorner(r, index, to);
      return isValidOutline(next.points) ? next : r;
    });
  return (
    <>
      <div className="insp-title">
        <div className="insp-name">{t("inspector.cornerN", { n: index + 1 })}</div>
      </div>
      <Section title={t("inspector.position")}>
        <div className="grid">
          <NumberField label="X" unit="mm" value={p.x} step={10} onChange={(v) => move({ x: v, y: p.y })} />
          <NumberField label="Y" unit="mm" value={p.y} step={10} onChange={(v) => move({ x: p.x, y: v })} />
        </div>
      </Section>
      <DeleteButton />
    </>
  );
}

function RoomSelectionPanel({ count }: { count: number }) {
  const t = useT();
  return (
    <>
      <div className="insp-title">
        <div className="insp-name">{t("inspector.roomMulti", { n: count })}</div>
      </div>
      <p className="hint">{t("inspector.roomMultiHint")}</p>
      <DeleteButton />
    </>
  );
}

function OpeningList({ project, openings }: { project: Project; openings: readonly Opening[] }) {
  const t = useT();
  if (openings.length === 0) return null;
  return (
    <ul className="list">
      {openings.map((o) => (
        <li key={o.id}>
          <button type="button" className="list-row" onClick={() => useStore.getState().select({ corners: [], partitions: [], opening: o.id })}>
            <span>{t(`opening.${o.kind}` as const)}</span>
            <span className="muted">
              {hostLabel(t, project, o)} · {o.width}
            </span>
          </button>
        </li>
      ))}
    </ul>
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
    st.updateRoom((r) => {
      const next = { ...r, points: rectRoom(w, d).map((q) => ({ x: q.x + b.minX, y: q.y + b.minY })) };
      // Openings may now stick out of a shorter wall.
      return { ...next, openings: r.openings.map((o) => clampToHost(next, o)) };
    });
  };
  // A new shape drops the openings of the old outer walls; partitions and theirs stay.
  const reshape = (points: Vec2[]) => st.updateRoom((r) => ({ points, openings: r.openings.filter((o) => o.partition) }));

  return (
    <>
      <Section title={t("inspector.project")}>
        <div className="grid">
          <TextField label={t("sheet.project")} value={info.name} onChange={(v) => setInfo({ name: v })} wide />
          <TextField label={t("sheet.client")} value={info.client} onChange={(v) => setInfo({ client: v })} wide />
          <TextField label={t("sheet.author")} value={info.author} onChange={(v) => setInfo({ author: v })} />
          <DateField label={t("sheet.date")} value={info.date} onChange={(v) => setInfo({ date: v })} />
        </div>
      </Section>
      <Section title={t("inspector.room")}>
        <div className="grid">
          {rect ? (
            <>
              <NumberField label={t("inspector.width")} unit="mm" value={rect.w} min={1000} max={MAX_LENGTH} step={100} onChange={(v) => resize(v, rect.d)} />
              <NumberField label={t("inspector.depth")} unit="mm" value={rect.d} min={1000} max={MAX_LENGTH} step={100} onChange={(v) => resize(rect.w, v)} />
            </>
          ) : (
            <p className="hint wide">{t("inspector.freeShape", { n: project.room.points.length })}</p>
          )}
          <NumberField label={t("inspector.roomHeight")} unit="mm" value={project.room.height} min={2000} max={20_000} step={50} onChange={(v) => st.updateRoom(() => ({ height: v }))} />
          <NumberField label={t("inspector.wallThickness")} unit="mm" value={project.room.wallThickness} min={50} max={1000} step={10} onChange={(v) => st.updateRoom(() => ({ wallThickness: v }))} />
        </div>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={() => reshape(rectRoom(8000, 6000))}>
            {t("inspector.shapeRect")}
          </button>
          <button type="button" className="btn small" onClick={() => reshape(lRoom(10000, 8000, 4000, 3000))}>
            {t("inspector.shapeL")}
          </button>
        </div>
        <p className="hint">{t("inspector.roomEditHint")}</p>
      </Section>
      <Section title={t("inspector.openings")}>
        <AddOpeningButtons host={{ wall: 0 }} />
        {project.room.openings.length === 0 ? <p className="hint">{t("inspector.noOpenings")}</p> : <OpeningList project={project} openings={project.room.openings} />}
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
