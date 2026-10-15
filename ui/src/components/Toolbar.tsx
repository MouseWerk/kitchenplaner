// The top bar: file commands, undo, layouts, room editing, export and view settings.

import { useState } from "react";
import { Armchair, FilePlus2, FolderOpen, PenLine, Redo2, Ruler, Save, Undo2 } from "lucide-react";
import { newFile, openFile, runExport, saveFile } from "../lib/actions";
import { currentLang, useT } from "../lib/i18n";
import { baseName } from "../lib/platform";
import { updateSettings, useSettings } from "../lib/settings";
import { keyLabel } from "../lib/shortcuts";
import { useCanCapture3d } from "../three/capture";
import { useStore, type Layout } from "../store/store";
import { Menu } from "./Menu";
import { PlanSetDialog } from "./PlanSetDialog";
import { openExampleKitchen } from "./Intro";
import { openIntro } from "../lib/intro";
import { toggleMeasuring, useMeasuring } from "../lib/measureTool";
import { useUpdateMenuEntries } from "./UpdateNotice";

const LAYOUTS: { id: Layout; key: "view.plan" | "view.elevations" | "view.3d" | "view.split" }[] = [
  { id: "plan", key: "view.plan" },
  { id: "elevations", key: "view.elevations" },
  { id: "3d", key: "view.3d" },
  { id: "split", key: "view.split" },
];

const GRIDS = [0, 10, 50, 100, 250] as const;

export function Toolbar() {
  const t = useT();
  const lang = currentLang();
  const layout = useStore((s) => s.layout);
  const path = useStore((s) => s.path);
  const dirty = useStore((s) => s.dirty);
  const name = useStore((s) => s.project.info.name);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const facing = useStore((s) => s.facing);
  const prefs = useStore((s) => s.prefs);
  const mode = useStore((s) => s.mode);
  const roomTool = useStore((s) => s.roomTool);
  const settings = useSettings();
  const updateEntries = useUpdateMenuEntries();
  const [planSetOpen, setPlanSetOpen] = useState(false);
  const measuring = useMeasuring();
  // The 3D export renders the mounted 3D pane; layouts without one have nothing to capture.
  const can3d = useCanCapture3d();
  const st = useStore.getState();
  const k = (c: string) => keyLabel(c, lang);
  const facingName = t(`facing.${facing}` as const);

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button type="button" className="tb-icon" onClick={() => void newFile()} title={`${t("file.new")} (${k("Mod+N")})`} aria-label={t("file.new")}>
          <FilePlus2 size={17} strokeWidth={1.75} />
        </button>
        <button type="button" className="tb-icon" onClick={() => void openFile()} title={`${t("file.open")} (${k("Mod+O")})`} aria-label={t("file.open")}>
          <FolderOpen size={17} strokeWidth={1.75} />
        </button>
        <button type="button" className="tb-icon" onClick={() => void saveFile()} title={`${t("file.save")} (${k("Mod+S")})`} aria-label={t("file.save")}>
          <Save size={17} strokeWidth={1.75} />
        </button>
        <Menu
          label={t("file.more")}
          title={t("file.more")}
          entries={[
            { label: t("file.saveAs"), hint: k("Mod+Shift+S"), onSelect: () => void saveFile(true) },
          ]}
        />
        <span className="tb-sep" aria-hidden />
        <button type="button" className="tb-icon" onClick={st.undo} disabled={!canUndo} title={`${t("edit.undo")} (${k("Mod+Z")})`} aria-label={t("edit.undo")}>
          <Undo2 size={17} strokeWidth={1.75} />
        </button>
        <button type="button" className="tb-icon" onClick={st.redo} disabled={!canRedo} title={`${t("edit.redo")} (${k("Mod+Shift+Z")})`} aria-label={t("edit.redo")}>
          <Redo2 size={17} strokeWidth={1.75} />
        </button>
      </div>

      <div className="toolbar-title" title={path ?? undefined}>
        <span className="doc-name">{path ? baseName(path) : name}</span>
        {dirty && <span className="doc-dirty">{t("file.unsaved")}</span>}
      </div>

      <div className="toolbar-group">
        <div className="seg" role="group" aria-label={t("view.layout")}>
          {LAYOUTS.map((l, i) => (
            <button key={l.id} type="button" className={layout === l.id ? "seg-btn is-current" : "seg-btn"} aria-pressed={layout === l.id} onClick={() => st.setLayout(l.id)} title={`${t(l.key)} (${i + 1})`}>
              {t(l.key)}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label={t("mode.title")}>
          <button type="button" className={mode === "arrange" ? "seg-btn is-current" : "seg-btn"} aria-pressed={mode === "arrange"} onClick={() => st.setMode("arrange")} title={`${t("mode.arrangeHint")} (Tab)`}>
            <Armchair size={15} strokeWidth={1.75} aria-hidden /> {t("mode.arrange")}
          </button>
          <button type="button" className={mode === "room" ? "seg-btn is-current" : "seg-btn"} aria-pressed={mode === "room"} onClick={() => st.setMode("room")} title={`${t("mode.roomHint")} (Tab)`}>
            <PenLine size={15} strokeWidth={1.75} aria-hidden /> {t("mode.room")}
          </button>
        </div>
        {mode === "room" && (
          <div className="seg small" role="group" aria-label={t("roomTool.title")}>
            {(["select", "outline", "partition"] as const).map((tool) => (
              <button key={tool} type="button" className={roomTool === tool ? "seg-btn is-current" : "seg-btn"} aria-pressed={roomTool === tool} onClick={() => st.setRoomTool(tool)} title={t(`roomTool.${tool}Hint` as const)}>
                {t(`roomTool.${tool}` as const)}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="tb-icon"
          aria-pressed={measuring}
          disabled={layout !== "plan" && layout !== "split"}
          onClick={toggleMeasuring}
          title={`${t("measure.title")} (M)`}
          aria-label={t("measure.title")}
        >
          <Ruler size={17} strokeWidth={1.75} />
        </button>
        <Menu
          label={t("export.title")}
          title={t("export.title")}
          align="end"
          entries={[
            { label: t("export.planSetPdf"), onSelect: () => setPlanSetOpen(true) },
            "sep",
            { label: t("export.planSvg"), onSelect: () => void runExport("plan-svg", facing) },
            { label: t("export.planDxf"), onSelect: () => void runExport("plan-dxf", facing) },
            { label: t("export.planPng"), onSelect: () => void runExport("plan-png", facing) },
            "sep",
            { label: t("export.elevationSvg", { facing: facingName }), onSelect: () => void runExport("elevation-svg", facing) },
            { label: t("export.elevationDxf", { facing: facingName }), onSelect: () => void runExport("elevation-dxf", facing) },
            { label: t("export.elevationsSvg"), onSelect: () => void runExport("elevations-svg", facing) },
            "sep",
            { label: t("export.png3d"), disabled: !can3d, onSelect: () => void runExport("3d-png", facing) },
            "sep",
            { label: t("export.listCsv"), onSelect: () => void runExport("list-csv", facing) },
          ]}
        />
        <Menu
          label={t("view.settings")}
          title={t("view.settings")}
          align="end"
          entries={[
            { label: t("settings.showDims"), checked: prefs.showDims, onSelect: () => st.setPrefs({ showDims: !prefs.showDims }) },
            { label: t("settings.showNames"), checked: prefs.showNames, onSelect: () => st.setPrefs({ showNames: !prefs.showNames }) },
            "sep",
            ...GRIDS.map((g) => ({ label: g === 0 ? t("settings.gridOff") : t("settings.grid", { mm: g }), checked: prefs.grid === g, onSelect: () => st.setPrefs({ grid: g }) })),
            "sep" as const,
            { label: t("settings.themeSystem"), checked: settings.theme === "system", onSelect: () => updateSettings({ theme: "system" }) },
            { label: t("settings.themeLight"), checked: settings.theme === "light", onSelect: () => updateSettings({ theme: "light" }) },
            { label: t("settings.themeDark"), checked: settings.theme === "dark", onSelect: () => updateSettings({ theme: "dark" }) },
            "sep" as const,
            { label: t("settings.langSystem"), checked: settings.lang === "system", onSelect: () => updateSettings({ lang: "system" }) },
            { label: "Deutsch", checked: settings.lang === "de", onSelect: () => updateSettings({ lang: "de" }) },
            { label: "English", checked: settings.lang === "en", onSelect: () => updateSettings({ lang: "en" }) },
            "sep" as const,
            { label: t("intro.show"), onSelect: openIntro },
            { label: t("intro.example"), onSelect: () => void openExampleKitchen() },
            ...updateEntries,
          ]}
        />
      </div>
      {planSetOpen && <PlanSetDialog onClose={() => setPlanSetOpen(false)} />}
    </header>
  );
}

