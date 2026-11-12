// The connection points of one unit in the inspector: a row per point (id, trade, its values in
// short, the height), each a disclosure that opens the point's fields. The points are derived
// (`model/points.ts`); a field the planner leaves empty shows the derived value as its placeholder,
// a typed value becomes an override in `Item.points` and shows in a heavier weight. Every edit and
// every reset is one undo step.

import { useId, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { MAX_LENGTH } from "../model/geometry";
import { currentText, heightText, pointValuesText, sizeText } from "../model/pointList";
import { itemPoints, pointLabel, setPoint, type ConnectionPoint } from "../model/points";
import { DN_SERIES, FUSE_SERIES, PLUGS, plugName, tradeName } from "../model/trades";
import type { Item, PointOverride, Trade } from "../model/types";
import { useStore } from "../store/store";
import { currentLang, useT } from "../lib/i18n";
import { CheckField, OptionalNumberField, OptionalSelectField, Section, TextField } from "./Fields";

/** The highest current, fuse or nominal size a file accepts (`serialize.ts`). */
const MAX_RATING = 2000;

export function PointsSection({ item }: { item: Item }) {
  // Re-renders on a language switch, which changes the codes in the point ids.
  const t = useT();
  const lang = currentLang();
  const base = useId();
  const points = useMemo(() => itemPoints(item), [item]);
  const [open, setOpen] = useState<ReadonlySet<Trade>>(new Set());
  if (points.length === 0) return null;

  const rowId = (trade: Trade) => `${base}-row-${trade}`;
  const toggle = (trade: Trade) => {
    const next = new Set(open);
    if (!next.delete(trade)) next.add(trade);
    setOpen(next);
  };
  const resetAll = () => {
    useStore.getState().updateItems([item.id], () => ({ points: undefined }));
    // The button goes with the overrides; the focus stays in the section.
    setTimeout(() => document.getElementById(rowId(points[0].trade))?.focus(), 0);
  };

  return (
    <Section title={t("inspector.points")}>
      <ul className="list points">
        {points.map((p) => {
          const expanded = open.has(p.trade);
          const panel = `${base}-panel-${p.trade}`;
          const name = tradeName(p.trade);
          return (
            <li key={p.trade}>
              <button
                type="button"
                id={rowId(p.trade)}
                className={p.set.size > 0 ? "list-row point-row has-set" : "list-row point-row"}
                aria-expanded={expanded}
                // The panel exists only while open, so it is named only then.
                aria-controls={expanded ? panel : undefined}
                onClick={() => toggle(p.trade)}
              >
                <ChevronRight className="point-chevron" size={14} strokeWidth={1.75} aria-hidden />
                <span className="point-main">
                  <span className="point-head">
                    <span className="point-code">{pointLabel(p)}</span> {name}
                  </span>
                  <span className="point-summary">{pointValuesText(p, lang, { withKw: false })}</span>
                </span>
                <span className="muted" title={t("point.height")}>
                  {heightText(p.z)}
                </span>
              </button>
              {expanded && (
                <div id={panel} className="point-panel" role="group" aria-label={`${pointLabel(p)} ${name}`}>
                  <PointFields item={item} point={p} onReset={() => setTimeout(() => document.getElementById(rowId(p.trade))?.focus(), 0)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {item.points && (
        <div className="btn-row">
          <button type="button" className="btn small" onClick={resetAll}>
            {t("point.resetAll")}
          </button>
        </div>
      )}
    </Section>
  );
}

/** The fields of one point; `onReset` runs after „Zurücksetzen“, whose button then goes away. */
function PointFields({ item, point, onReset }: { item: Item; point: ConnectionPoint; onReset: () => void }) {
  const t = useT();
  const trade = point.trade;
  const o: PointOverride = item.points?.[trade] ?? {};
  const edit = (patch: Partial<PointOverride> | null) => useStore.getState().updateItems([item.id], (it) => setPoint(it, trade, patch));
  /** The point as it would be without the planner's value of `key`: what that field derives to. */
  const derived = (key: keyof PointOverride): ConnectionPoint => {
    if (!point.set.has(key)) return point;
    return itemPoints({ ...item, ...setPoint(item, trade, { [key]: undefined }) }).find((p) => p.trade === trade) ?? point;
  };
  const v = point.values;
  const series = DN_SERIES[trade];
  const dDn = derived("dn").values.dn;
  const dCurrent = derived("currentA").values.currentA ?? 0;
  const dFuse = derived("fuseA").values.fuseA;
  const dPlug = derived("plug").values.plug;
  const dGreasy = derived("greasy").values.greasy ?? false;
  const mm = { unit: "mm", step: 10, min: -MAX_LENGTH, max: MAX_LENGTH } as const;

  return (
    <>
      <div className="grid">
        <OptionalNumberField label={t("point.fromLeft")} {...mm} value={o.x} derived={derived("x").fromLeft} onChange={(x) => edit({ x })} />
        <OptionalNumberField label={t("point.fromBack")} {...mm} value={o.y} derived={derived("y").fromBack} onChange={(y) => edit({ y })} />
        <OptionalNumberField label={t("point.height")} {...mm} value={o.z} derived={derived("z").z} onChange={(z) => edit({ z })} />
        {trade === "electric" && (
          <>
            <OptionalNumberField
              label={t("point.current")}
              unit="A"
              digits={1}
              step={1}
              min={0.1}
              max={MAX_RATING}
              value={o.currentA}
              derived={dCurrent}
              placeholder={currentText(dCurrent, v.kw, currentLang()).replace(/ A$/, "")}
              onChange={(currentA) => edit({ currentA })}
            />
            <OptionalSelectField
              label={t("point.fuse")}
              value={o.fuseA}
              derivedLabel={dFuse !== undefined ? `${dFuse} A` : "–"}
              options={FUSE_SERIES.map((f) => ({ value: f, label: `${f} A` }))}
              format={(f) => `${f} A`}
              onChange={(fuseA) => edit({ fuseA })}
            />
            <OptionalSelectField
              label={t("point.plug")}
              value={o.plug}
              derivedLabel={dPlug ? plugName(dPlug) : "–"}
              options={PLUGS.map((p) => ({ value: p, label: plugName(p) }))}
              format={(p) => plugName(p)}
              onChange={(plug) => edit({ plug })}
            />
          </>
        )}
        {series && (
          <OptionalSelectField
            label={t("point.dn")}
            value={o.dn}
            derivedLabel={dDn !== undefined ? sizeText(trade, dDn) : "–"}
            options={series.map((d) => ({ value: d, label: sizeText(trade, d) }))}
            format={(d) => sizeText(trade, d)}
            onChange={(dn) => edit({ dn })}
          />
        )}
      </div>
      {(trade === "drain" || trade === "floorDrain") && (
        <div className="checks">
          {/* A tick back to what the catalog says is no override. */}
          <CheckField label={t("point.greasy")} checked={v.greasy ?? false} set={o.greasy !== undefined} onChange={(g) => edit({ greasy: g === dGreasy ? undefined : g })} />
        </div>
      )}
      <TextField label={t("point.note")} value={o.note ?? ""} onChange={(note) => edit({ note })} wide />
      {point.set.size > 0 && (
        <div className="btn-row">
          <button
            type="button"
            className="btn small"
            onClick={() => {
              edit(null);
              onReset();
            }}
          >
            {t("point.reset")}
          </button>
        </div>
      )}
    </>
  );
}
