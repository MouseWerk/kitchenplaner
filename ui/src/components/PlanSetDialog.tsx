// The plan set dialog („Plansatz als PDF…“): paper, orientation, scale and the sheets to print.
// It checks before exporting that every drawing fits its sheet at the chosen scale and offers the
// next scale or paper that fits, since a sheet never clips a drawing. The choices are remembered
// per computer.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { exportPlanSet } from "../lib/actions";
import { currentLang, useT } from "../lib/i18n";
import { loadPlanSetOptions, savePlanSetOptions } from "../lib/planSetSettings";
import { WALL_CUT_DEPTH } from "../model/elevation";
import { FACINGS, type Facing } from "../model/types";
import { checkPlanSet, PAPER_SIZES, PLAN_SCALES, type Orientation, type PaperSize, type PlanSetOptions, type ScaleChoice } from "../render/planSet";
import { useStore } from "../store/store";
import { useCanCapture3d } from "../three/capture";
import { CheckField, SelectField } from "./Fields";

const FOCUSABLE = 'button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function PlanSetDialog(props: { onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [opts, setOpts] = useState<PlanSetOptions>(loadPlanSetOptions);
  const [busy, setBusy] = useState(false);
  const project = useStore((s) => s.project);
  const cut = useStore((s) => s.prefs.elevationCut);
  const can3d = useCanCapture3d();
  const lang = currentLang();
  const view3d = opts.view3d && can3d;
  const check = useMemo(() => checkPlanSet(project, opts, { lang, cut }, view3d), [project, opts, lang, cut, view3d]);
  const tooBig = check.sheets.filter((s) => !s.fits);
  const empty = check.total === 0;

  const set = (patch: Partial<PlanSetOptions>) =>
    setOpts((o) => {
      const next = { ...o, ...patch };
      savePlanSetOptions(next);
      return next;
    });
  const toggleFacing = (f: Facing, on: boolean) => set({ elevations: FACINGS.filter((x) => (x === f ? on : opts.elevations.includes(x))) });

  // Focus moves into the dialog and back to where it was when it closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => before?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (!busy) props.onClose();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    // Tab stays inside the dialog.
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const run = async () => {
    setBusy(true);
    const ok = await exportPlanSet(opts);
    setBusy(false);
    if (ok) props.onClose();
  };

  const cutName = t(`view.cut.${cut}` as const, { m: WALL_CUT_DEPTH / 1000 });
  const scaleOptions: { value: ScaleChoice; label: string }[] = [{ value: "auto", label: t("planSet.scaleAuto") }, ...PLAN_SCALES.map((s) => ({ value: s, label: `1:${s}` }))];

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && props.onClose()}>
      <div ref={ref} className="dialog plan-set" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <h2 id={titleId} className="dialog-title">
          {t("planSet.title")}
        </h2>
        <div className="grid">
          <SelectField<PaperSize> label={t("planSet.paper")} value={opts.paper} options={PAPER_SIZES.map((p) => ({ value: p, label: p }))} onChange={(paper) => set({ paper })} />
          <SelectField<Orientation>
            label={t("planSet.orientation")}
            value={opts.orientation}
            options={[
              { value: "landscape", label: t("planSet.landscape") },
              { value: "portrait", label: t("planSet.portrait") },
            ]}
            onChange={(orientation) => set({ orientation })}
          />
          <SelectField<ScaleChoice> label={t("planSet.scale")} value={opts.scale} options={scaleOptions} onChange={(scale) => set({ scale })} />
        </div>

        <fieldset className="plan-set-sheets">
          <legend className="field-label">{t("planSet.sheets")}</legend>
          <div className="checks">
            <CheckField label={t("view.plan")} checked={opts.plan} onChange={(plan) => set({ plan })} />
            {FACINGS.map((f) => (
              <CheckField key={f} label={t("view.elevation", { facing: t(`facing.${f}` as const) })} checked={opts.elevations.includes(f)} onChange={(on) => toggleFacing(f, on)} />
            ))}
            <CheckField label={t("list.title")} checked={opts.list} onChange={(list) => set({ list })} />
            <label className="check">
              <input type="checkbox" checked={view3d} disabled={!can3d} onChange={(e) => set({ view3d: e.target.checked })} />
              <span>{t("view.3d")}</span>
            </label>
          </div>
          {opts.plan && <CheckField label={t("planSet.names")} checked={opts.names} onChange={(names) => set({ names })} />}
          {!can3d && <p className="hint">{t("planSet.view3dHint")}</p>}
          {opts.elevations.length > 0 && <p className="hint">{t("planSet.cutHint", { cut: cutName })}</p>}
        </fieldset>

        <div className="plan-set-status" aria-live="polite">
          {empty ? (
            <p className="hint">{t("planSet.nothing")}</p>
          ) : tooBig.length > 0 ? (
            <>
              {tooBig.map((s) => (
                <p key={s.title} className="plan-set-warning">
                  {t("planSet.tooSmall", { sheet: s.title, scale: s.scale, paper: opts.paper })}
                </p>
              ))}
              {check.fittingScale || check.fittingPaper ? (
                <div className="btn-row">
                  {check.fittingScale && (
                    <button type="button" className="btn small" onClick={() => set({ scale: check.fittingScale as ScaleChoice })}>
                      {t("planSet.useScale", { scale: check.fittingScale })}
                    </button>
                  )}
                  {check.fittingPaper && (
                    <button type="button" className="btn small" onClick={() => set({ paper: check.fittingPaper })}>
                      {t("planSet.usePaper", { paper: check.fittingPaper })}
                    </button>
                  )}
                </div>
              ) : (
                <p className="hint">{t("planSet.noFit")}</p>
              )}
            </>
          ) : (
            <p className="hint">
              {[...check.sheets.map((s) => t("planSet.sheetScale", { sheet: s.title, scale: s.scale })), t("planSet.summary", { n: check.total })].join(" · ")}
            </p>
          )}
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={props.onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button type="button" className="btn primary" onClick={() => void run()} disabled={busy || empty || tooBig.length > 0}>
            {t("planSet.export")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
