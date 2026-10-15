// The main window: toolbar, catalog, the views in the chosen layout, inspector and status bar.

import { invoke } from "@tauri-apps/api/core";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { CatalogPanel } from "./components/CatalogPanel";
import { Inspector } from "./components/Inspector";
import { Menu } from "./components/Menu";
import { Toolbar } from "./components/Toolbar";
import { AutosaveStatus } from "./components/AutosaveStatus";
import { RecoveryDialog } from "./components/RecoveryDialog";
import { Intro } from "./components/Intro";
import { UpdateNotice } from "./components/UpdateNotice";
import { confirmDiscard, openPath } from "./lib/actions";
import { discardOwnBackup } from "./lib/autosave";
import { num, useT } from "./lib/i18n";
import { isTauri } from "./lib/platform";
import { handleShortcut } from "./lib/shortcuts";
import { dismissToast, useToasts } from "./lib/toast";
import { startUpdates } from "./lib/updates";
import { checkProject } from "./model/checks";
import { electricStatus } from "./model/equipment";
import { ELEVATION_CUTS, WALL_CUT_DEPTH, type ElevationCut } from "./model/elevation";
import { FACINGS, type Facing, type Vec2 } from "./model/types";
import { useStore } from "./store/store";
import { ElevationView } from "./views/ElevationView";
import { PlanView } from "./views/PlanView";

// three.js is the largest part of the bundle: loaded when a 3D pane is first shown.
const View3D = lazy(() => import("./views/View3D").then((m) => ({ default: m.View3D })));

export function App() {
  const t = useT();
  const layout = useStore((s) => s.layout);
  const facing = useStore((s) => s.facing);
  const [fitSignal, setFitSignal] = useState(0);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [secondFacing, setSecondFacing] = useState<Facing>("east");
  // The introduction waits until the question about backups is answered (or there are none).
  const [recoverySettled, setRecoverySettled] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      handleShortcut(e, () => setFitSignal((n) => n + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A new or opened project is fitted into every view, also when it replaces an identical one.
  const loadCount = useStore((s) => s.loadCount);
  useEffect(() => setFitSignal((n) => n + 1), [loadCount]);

  useDesktopIntegration();
  useEffect(() => startUpdates(), []);

  const plan = (
    <Pane title={t("view.plan")} key="plan">
      <PlanView fitSignal={fitSignal} onCursor={setCursor} />
    </Pane>
  );
  const three = (
    <Pane title={t("view.3d")} key="3d">
      <Suspense fallback={<div className="pane-loading">{t("view.loading3d")}</div>}>
        <View3D fitSignal={fitSignal} />
      </Suspense>
    </Pane>
  );
  const elevation = (f: Facing, onFacing: (f: Facing) => void, key: string) => (
    <Pane
      title={t("view.elevation", { facing: t(`facing.${f}` as const) })}
      key={key}
      controls={
        <>
          <CutSelect />
          <FacingSwitch value={f} onChange={onFacing} />
        </>
      }
    >
      <ElevationView facing={f} fitSignal={fitSignal} />
    </Pane>
  );

  let panes: React.ReactNode;
  switch (layout) {
    case "plan":
      panes = plan;
      break;
    case "3d":
      panes = three;
      break;
    case "elevations":
      panes = FACINGS.map((f) => (
        <Pane title={t("view.elevation", { facing: t(`facing.${f}` as const) })} key={f} controls={<CutSelect />}>
          <ElevationView facing={f} fitSignal={fitSignal} />
        </Pane>
      ));
      break;
    case "split":
      panes = [plan, three, elevation(facing, useStore.getState().setFacing, "e1"), elevation(secondFacing, setSecondFacing, "e2")];
      break;
  }

  return (
    <div className="app">
      <Toolbar />
      <CatalogPanel />
      <main className={`views layout-${layout}`}>{panes}</main>
      <Inspector />
      <StatusBar cursor={cursor} />
      <Toasts />
      <RecoveryDialog onSettled={() => setRecoverySettled(true)} />
      <Intro ready={recoverySettled} />
    </div>
  );
}

function Pane(props: { title: string; children: React.ReactNode; controls?: React.ReactNode }) {
  return (
    <section className="pane" aria-label={props.title}>
      <div className="pane-head">
        <h2 className="pane-title">{props.title}</h2>
        {props.controls}
      </div>
      <div className="pane-body">{props.children}</div>
    </section>
  );
}

function FacingSwitch(props: { value: Facing; onChange: (f: Facing) => void }) {
  const t = useT();
  return (
    <div className="seg small" role="group" aria-label={t("view.facing")}>
      {FACINGS.map((f) => (
        <button key={f} type="button" className={props.value === f ? "seg-btn is-current" : "seg-btn"} aria-pressed={props.value === f} onClick={() => props.onChange(f)} title={t(`facing.${f}` as const)}>
          {t(`facing.${f}` as const).slice(0, 1)}
        </button>
      ))}
    </div>
  );
}

/**
 * How deep the elevations reach into the room; one setting for all of them and the exports. The
 * app's own menu rather than a native select: its list stays inside the window and in the app's
 * look on every system (GTK draws a native list in its own theme).
 */
function CutSelect() {
  const t = useT();
  const cut = useStore((s) => s.prefs.elevationCut);
  const label = (c: ElevationCut) => t(`view.cut.${c}` as const, { m: num(WALL_CUT_DEPTH / 1000, 1) });
  return (
    <Menu
      className="tb-btn pane-menu"
      align="end"
      label={label(cut)}
      title={t("view.cut")}
      entries={ELEVATION_CUTS.map((c) => ({ label: label(c), checked: c === cut, radio: true, onSelect: () => useStore.getState().setPrefs({ elevationCut: c }) }))}
    />
  );
}

function StatusBar(props: { cursor: Vec2 | null }) {
  const t = useT();
  const project = useStore((s) => s.project);
  const grid = useStore((s) => s.prefs.grid);
  const mode = useStore((s) => s.mode);
  const status = useStore((s) => s.status);
  const issues = useMemo(() => checkProject(project), [project]);
  return (
    <footer className="statusbar">
      <span className="status-cell mono">{props.cursor ? `X ${Math.round(props.cursor.x)}  Y ${Math.round(props.cursor.y)}` : " "}</span>
      <span className="status-cell">{grid > 0 ? t("settings.grid", { mm: grid }) : t("settings.gridOff")}</span>
      <span className="status-cell mode">{t(mode === "room" ? "mode.room" : "mode.arrange")}</span>
      {status ? <span className="status-cell mono">{status}</span> : <span className="status-cell">{t(mode === "room" ? "mode.roomHint" : "mode.arrangeHint")}</span>}
      <span className="status-spacer" />
      <AutosaveStatus />
      <span className="status-cell">{t("status.items", { n: project.items.length })}</span>
      <span className="status-cell">{electricStatus(project)}</span>
      {issues.length > 0 && (
        <span className="status-cell warn">
          <AlertTriangle size={13} strokeWidth={1.75} aria-hidden /> {t("status.issues", { n: issues.length })}
        </span>
      )}
    </footer>
  );
}

function Toasts() {
  const t = useT();
  const toasts = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      <UpdateNotice />
      {toasts.map((x) => (
        <div key={x.id} className={x.tone === "danger" ? "toast danger" : "toast"}>
          {x.tone === "danger" && <AlertTriangle size={15} strokeWidth={1.75} aria-hidden />}
          <span>{x.text}</span>
          <button type="button" className="toast-close" onClick={() => dismissToast(x.id)} aria-label={t("common.close")}>
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Window title, the unsaved-changes question on close, and a project passed at start (file association). */
function useDesktopIntegration() {
  const name = useStore((s) => s.project.info.name);
  const dirty = useStore((s) => s.dirty);
  useEffect(() => {
    document.title = `${dirty ? "* " : ""}${name} – Kitchenplaner`;
    if (isTauri()) {
      void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().setTitle(document.title)).catch(() => {});
    }
  }, [name, dirty]);

  useEffect(() => {
    if (!isTauri()) {
      const onBefore = (e: BeforeUnloadEvent) => {
        if (useStore.getState().dirty) e.preventDefault();
      };
      window.addEventListener("beforeunload", onBefore);
      return () => window.removeEventListener("beforeunload", onBefore);
    }
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const off = await win.onCloseRequested(async (event) => {
        event.preventDefault();
        // Closing without saving: the discarded changes must not come back as a backup.
        if (await confirmDiscard()) await discardOwnBackup().then(() => win.destroy());
      });
      // Quitting the app (Cmd+Q on macOS) closes no window first, so the shell holds the exit and
      // asks here; "confirm_exit" lets it go.
      const { listen } = await import("@tauri-apps/api/event");
      const offExit = await listen("exit-requested", async () => {
        if (await confirmDiscard()) await discardOwnBackup().then(() => invoke("confirm_exit"));
      });
      if (cancelled) {
        off();
        offExit();
      } else
        unlisten = () => {
          off();
          offExit();
        };
      const startup = await invoke<string | null>("startup_file").catch(() => null);
      if (startup && !cancelled) void openPath(startup);
      // macOS hands files opened while the app runs over as an event (the shell's "open-file").
      const offOpen = await listen<string>("open-file", (e) => void openPath(e.payload));
      if (cancelled) offOpen();
      else {
        const offClose = unlisten;
        unlisten = () => {
          offClose?.();
          offOpen();
        };
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
