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
import { UnsavedDialog } from "./components/UnsavedDialog";
import { LiveRegions } from "./components/LiveRegions";
import { openPath } from "./lib/actions";
import { setCursor, useCursor } from "./lib/cursor";
import { num, useT } from "./lib/i18n";
import { isTauri } from "./lib/platform";
import { handleShortcut } from "./lib/shortcuts";
import { dismissToast, useToasts } from "./lib/toast";
import { startUpdates } from "./lib/updates";
import { checkProject } from "./model/checks";
import { electricStatus } from "./model/equipment";
import { ELEVATION_CUTS, resolveElevation, WALL_CUT_DEPTH, type ElevationCut, type ElevationId } from "./model/elevation";
import { elevationTitle } from "./model/elevationNames";
import { FACINGS } from "./model/types";
import { useStore } from "./store/store";
import { ElevationSwitch, ElevationView } from "./views/ElevationView";
import { PlanView } from "./views/PlanView";

// three.js is the largest part of the bundle: loaded when a 3D pane is first shown.
const View3D = lazy(() => import("./views/View3D").then((m) => ({ default: m.View3D })));

export function App() {
  const t = useT();
  const layout = useStore((s) => s.layout);
  const facing = useStore((s) => s.facing);
  const [fitSignal, setFitSignal] = useState(0);
  const room = useStore((s) => s.project.room);
  const [secondFacing, setSecondFacing] = useState<ElevationId>("east");
  // The four panes of the elevations layout, each switchable to another view or a single wall.
  const [quad, setQuad] = useState<ElevationId[]>(() => [...FACINGS]);
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
  const elevation = (f: ElevationId, onFacing: (f: ElevationId) => void, key: string) => (
    <Pane
      title={elevationTitle(resolveElevation(room, f))}
      heading={t("view.elevationHead")}
      key={key}
      controls={
        <>
          <ElevationSwitch value={f} onChange={onFacing} />
          <span className="pane-spacer" />
          <CutSelect />
        </>
      }
    >
      <ElevationView view={f} fitSignal={fitSignal} />
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
      panes = quad.map((f, i) => elevation(f, (next) => setQuad((q) => q.map((x, j) => (j === i ? next : x))), `q${i}`));
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
      <StatusBar />
      <Toasts />
      <LiveRegions />
      <RecoveryDialog onSettled={() => setRecoverySettled(true)} />
      <Intro ready={recoverySettled} />
      <UnsavedDialog />
    </div>
  );
}

/**
 * A view with its head. `heading` is a shorter visible title when the controls already say the
 * rest (an elevation's chooser shows „Nord“ next to „Ansicht“); `title` names the pane in full.
 */
function Pane(props: { title: string; heading?: string; children: React.ReactNode; controls?: React.ReactNode }) {
  return (
    <section className="pane" aria-label={props.title}>
      <div className="pane-head">
        <h2 className="pane-title" title={props.title}>
          {props.heading ?? props.title}
        </h2>
        {props.controls}
      </div>
      <div className="pane-body">{props.children}</div>
    </section>
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
  const label = (c: ElevationCut) => t(`view.cut.${c}` as const, { mm: num(WALL_CUT_DEPTH) });
  return (
    <Menu
      className="tb-btn pane-menu"
      anchorClassName="pane-menu-shrink"
      align="end"
      label={<span className="pane-menu-label">{label(cut)}</span>}
      title={t("view.cut")}
      entries={ELEVATION_CUTS.map((c) => ({ label: label(c), checked: c === cut, radio: true, onSelect: () => useStore.getState().setPrefs({ elevationCut: c }) }))}
    />
  );
}

/** The cursor's place on the plan: its own component, so a pointer move re-renders only this. */
function CursorCell() {
  const cursor = useCursor();
  return <span className="status-cell mono">{cursor ? `X ${Math.round(cursor.x)}  Y ${Math.round(cursor.y)}` : " "}</span>;
}

function StatusBar() {
  const t = useT();
  const project = useStore((s) => s.project);
  const grid = useStore((s) => s.prefs.grid);
  const mode = useStore((s) => s.mode);
  const status = useStore((s) => s.status);
  const issues = useMemo(() => checkProject(project), [project]);
  return (
    <footer className="statusbar">
      <CursorCell />
      <span className="status-cell">{grid > 0 ? t("settings.grid", { mm: grid }) : t("settings.gridOff")}</span>
      <span className="status-cell mode">{t(mode === "room" ? "mode.room" : "mode.arrange")}</span>
      {/* The one cell that gives way when the bar is narrow; its title keeps the whole text. */}
      {status ? (
        <span className="status-cell mono hint" title={status}>
          {status}
        </span>
      ) : (
        <span className="status-cell hint" title={t(mode === "room" ? "mode.roomHint" : "mode.arrangeHint")}>
          {t(mode === "room" ? "mode.roomHint" : "mode.arrangeHint")}
        </span>
      )}
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
    // Not a live region: lib/toast.ts reads each message out through LiveRegions, errors assertively.
    <div className="toasts">
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

/**
 * Window title and a project passed at start (file association). The unsaved-changes question on
 * close is set up outside the app (lib/closeGuard.ts), so it outlives a crash of the view.
 */
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
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const startup = await invoke<string | null>("startup_file").catch(() => null);
      if (startup && !cancelled) void openPath(startup);
      // macOS hands files opened while the app runs over as an event (the shell's "open-file").
      const { listen } = await import("@tauri-apps/api/event");
      const offOpen = await listen<string>("open-file", (e) => void openPath(e.payload));
      if (cancelled) offOpen();
      else unlisten = offOpen;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
