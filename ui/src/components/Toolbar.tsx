// The top bar: file commands, undo, layouts, room editing, export and view settings.

import { useRef, useState } from "react";
import { Armchair, Box, Download, FilePlus2, FolderOpen, LayoutGrid, Map, MousePointer2, PanelTop, PenLine, Pentagon, Redo2, Ruler, Save, SlidersHorizontal, SquareSplitHorizontal, Undo2, type LucideIcon } from "lucide-react";
import { newFile, openFile, runExport, saveFile } from "../lib/actions";
import { cancelActiveOperator } from "../lib/commands";
import { currentLang, useT } from "../lib/i18n";
import { baseName } from "../lib/platform";
import { updateSettings, useSettings } from "../lib/settings";
import { keyLabel } from "../lib/shortcuts";
import { useCanCapture3d } from "../three/capture";
import { resolveElevation } from "../model/elevation";
import { elevationName } from "../model/elevationNames";
import { useStore, type Layout } from "../store/store";
import { Menu } from "./Menu";
import { PlanSetDialog } from "./PlanSetDialog";
import { openExampleKitchen } from "./Intro";
import { openIntro } from "../lib/intro";
import { toggleMeasuring, useMeasuring } from "../lib/measureTool";
import { useUpdateMenuEntries } from "./UpdateNotice";
import { useToolbarFit } from "./toolbarFit";

const LAYOUTS: { id: Layout; key: "view.plan" | "view.elevations" | "view.3d" | "view.split"; icon: LucideIcon }[] = [
  { id: "plan", key: "view.plan", icon: Map },
  { id: "elevations", key: "view.elevations", icon: PanelTop },
  { id: "3d", key: "view.3d", icon: Box },
  { id: "split", key: "view.split", icon: LayoutGrid },
];

const ROOM_TOOLS: { id: "select" | "outline" | "partition"; icon: LucideIcon }[] = [
  { id: "select", icon: MousePointer2 },
  { id: "outline", icon: Pentagon },
  { id: "partition", icon: SquareSplitHorizontal },
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
  const facing = useStore((s) => resolveElevation(s.project.room, s.facing));
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
  const facingName = elevationName(facing);
  const header = useRef<HTMLElement>(null);
  // How far the bar gives way to fit the window (toolbarFit.ts); labels stay as tooltips.
  const level = useToolbarFit(header, `${mode} ${lang}`);
  const iconLayouts = level >= 1;
  const iconTools = level >= 2;
  const iconMenus = level >= 3;
  const iconModes = level >= 4;
  const docName = path ? baseName(path) : name;

  return (
    <header className="toolbar" ref={header}>
      <div className="toolbar-group toolbar-files">
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

      <div className="toolbar-title" title={path ?? docName}>
        <span className="doc-name">{docName}</span>
        {dirty && (
          <span className="doc-dirty" title={t("file.unsaved")}>
            <span className="dirty-dot" aria-hidden />
            <span className="doc-dirty-label">{t("file.unsaved")}</span>
          </span>
        )}
      </div>

      <div className="toolbar-group toolbar-tools">
        <div className="seg" role="group" aria-label={t("view.layout")}>
          {LAYOUTS.map((l, i) => (
            <button key={l.id} type="button" className={layout === l.id ? "seg-btn is-current" : "seg-btn"} aria-pressed={layout === l.id} onClick={() => st.setLayout(l.id)} title={`${t(l.key)} (${i + 1})`} aria-label={iconLayouts ? t(l.key) : undefined}>
              {iconLayouts ? <l.icon size={15} strokeWidth={1.75} aria-hidden /> : t(l.key)}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label={t("mode.title")}>
          <button type="button" className={mode === "arrange" ? "seg-btn is-current" : "seg-btn"} aria-pressed={mode === "arrange"} onClick={() => st.setMode("arrange")} title={`${t("mode.arrangeHint")} (Tab)`} aria-label={iconModes ? t("mode.arrange") : undefined}>
            <Armchair size={15} strokeWidth={1.75} aria-hidden /> {!iconModes && t("mode.arrange")}
          </button>
          <button type="button" className={mode === "room" ? "seg-btn is-current" : "seg-btn"} aria-pressed={mode === "room"} onClick={() => st.setMode("room")} title={`${t("mode.roomHint")} (Tab)`} aria-label={iconModes ? t("mode.room") : undefined}>
            <PenLine size={15} strokeWidth={1.75} aria-hidden /> {!iconModes && t("mode.room")}
          </button>
        </div>
        {mode === "room" && (
          <div className="seg small" role="group" aria-label={t("roomTool.title")}>
            {ROOM_TOOLS.map(({ id: tool, icon: Icon }) => (
              <button
                key={tool}
                type="button"
                className={roomTool === tool ? "seg-btn is-current" : "seg-btn"}
                aria-pressed={roomTool === tool}
                onClick={() => st.setRoomTool(tool)}
                title={iconTools ? `${t(`roomTool.${tool}` as const)}: ${t(`roomTool.${tool}Hint` as const)}` : t(`roomTool.${tool}Hint` as const)}
                aria-label={iconTools ? t(`roomTool.${tool}` as const) : undefined}
              >
                {iconTools ? <Icon size={14} strokeWidth={1.75} aria-hidden /> : t(`roomTool.${tool}` as const)}
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
          label={iconMenus ? <Download size={15} strokeWidth={1.75} aria-hidden /> : t("export.title")}
          ariaLabel={iconMenus ? t("export.title") : undefined}
          title={t("export.title")}
          align="end"
          entries={[
            {
              label: t("export.planSetPdf"),
              // The dialog and its export show the project without a running operator's half-done move.
              onSelect: () => {
                cancelActiveOperator();
                setPlanSetOpen(true);
              },
            },
            "sep",
            { label: t("export.planSvg"), onSelect: () => void runExport("plan-svg", facing) },
            { label: t("export.planDxf"), onSelect: () => void runExport("plan-dxf", facing) },
            { label: t("export.planPng"), onSelect: () => void runExport("plan-png", facing) },
            "sep",
            { label: t("export.elevationSvg", { facing: facingName }), onSelect: () => void runExport("elevation-svg", facing) },
            { label: t("export.elevationDxf", { facing: facingName }), onSelect: () => void runExport("elevation-dxf", facing) },
            { label: t("export.elevationsSvg"), onSelect: () => void runExport("elevations-svg", facing) },
            "sep",
            // Greyed out without a 3D pane: the hint says why, so the entry is not a dead end.
            { label: t("export.png3d"), hint: can3d ? undefined : t("export.needs3d"), disabled: !can3d, onSelect: () => void runExport("3d-png", facing) },
            "sep",
            { label: t("export.listCsv"), onSelect: () => void runExport("list-csv", facing) },
          ]}
        />
        <Menu
          label={iconMenus ? <SlidersHorizontal size={15} strokeWidth={1.75} aria-hidden /> : t("view.settings")}
          ariaLabel={iconMenus ? t("view.settings") : undefined}
          title={t("view.settings")}
          align="end"
          entries={[
            { label: t("settings.showDims"), checked: prefs.showDims, onSelect: () => st.setPrefs({ showDims: !prefs.showDims }) },
            { label: t("settings.showNames"), checked: prefs.showNames, onSelect: () => st.setPrefs({ showNames: !prefs.showNames }) },
            "sep",
            ...GRIDS.map((g) => ({ label: g === 0 ? t("settings.gridOff") : t("settings.grid", { mm: g }), checked: prefs.grid === g, radio: true, onSelect: () => st.setPrefs({ grid: g }) })),
            "sep" as const,
            { label: t("settings.themeSystem"), checked: settings.theme === "system", radio: true, onSelect: () => updateSettings({ theme: "system" }) },
            { label: t("settings.themeLight"), checked: settings.theme === "light", radio: true, onSelect: () => updateSettings({ theme: "light" }) },
            { label: t("settings.themeDark"), checked: settings.theme === "dark", radio: true, onSelect: () => updateSettings({ theme: "dark" }) },
            "sep" as const,
            { label: t("settings.langSystem"), checked: settings.lang === "system", radio: true, onSelect: () => updateSettings({ lang: "system" }) },
            { label: "Deutsch", checked: settings.lang === "de", radio: true, onSelect: () => updateSettings({ lang: "de" }) },
            { label: "English", checked: settings.lang === "en", radio: true, onSelect: () => updateSettings({ lang: "en" }) },
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

