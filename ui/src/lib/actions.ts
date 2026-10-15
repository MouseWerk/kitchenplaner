// File commands and exports, shared by the toolbar, the menus and the keyboard shortcuts.

import { elevationDrawing, type ElevationCut } from "../model/elevation";
import { equipmentCsv } from "../model/equipment";
import { planDrawing } from "../model/plan";
import { newProject } from "../model/project";
import { parseProject, serializeProject } from "../model/serialize";
import { FACINGS, type Facing, type Project } from "../model/types";
import { drawingBounds, TEXT, type Drawing, type Shape } from "../render/drawing";
import { drawingToDxf } from "../render/dxf";
import { svgToPng } from "../render/png";
import { planSetPdf, type PlanSetOptions } from "../render/planSet";
import { drawingToSvg, sheetDrawing } from "../render/svg";
import { canCapture3d, capture3dPng } from "../three/capture";
import { useStore } from "../store/store";
import { cancelActiveOperator } from "./commands";
import { errorText } from "./errors";
import { currentLang, t } from "./i18n";
import { addRecentFile, baseName, confirmDialog, openProjectFile, PDF_FILTER, PROJECT_FILTER, readProjectPath, safeFileName, saveBinary, saveText, type FileFilter } from "./platform";
import { toast } from "./toast";

const SVG: FileFilter = { name: "SVG", extensions: ["svg"] };
const DXF: FileFilter = { name: "DXF", extensions: ["dxf"] };
const PNG: FileFilter = { name: "PNG", extensions: ["png"] };
const CSV: FileFilter = { name: "CSV", extensions: ["csv"] };

/** Width of exported PNG images (px): sharp on a 4K screen and in an A4 printout. */
const PNG_WIDTH = 3200;
/** Width of the 3D image in the PDF plan set (px): about 150 dpi across an A2 sheet. */
const PDF_IMAGE_WIDTH = 2400;
/** Gap between the four elevations on one sheet (paper mm). */
const SHEET_GAP = 18;

/** Asks before the open project's changes would be lost; true when it may go ahead. */
export async function confirmDiscard(): Promise<boolean> {
  if (!useStore.getState().dirty) return true;
  return confirmDialog(t("file.discardQuestion"), t("app.name"), t("file.discard"), t("common.cancel"));
}

export async function newFile() {
  cancelActiveOperator();
  if (!(await confirmDiscard())) return;
  useStore.getState().load(newProject(), null);
}

export async function openFile() {
  cancelActiveOperator();
  if (!(await confirmDiscard())) return;
  try {
    const f = await openProjectFile();
    if (!f) return;
    loadText(f.text, f.path);
  } catch (e) {
    toast(errorText(e), "danger");
  }
}

export async function openPath(path: string) {
  cancelActiveOperator();
  if (!(await confirmDiscard())) return;
  try {
    const f = await readProjectPath(path);
    loadText(f.text, f.path);
  } catch (e) {
    toast(errorText(e), "danger");
  }
}

function loadText(text: string, path: string | null) {
  const project = parseProject(text);
  useStore.getState().load(project, path);
  if (path) void addRecentFile(path).catch(() => {});
  toast(t("file.opened", { name: path ? baseName(path) : project.info.name }));
}

/** Saves to the known path, or asks for one; returns whether it was saved. */
export async function saveFile(as = false): Promise<boolean> {
  // The toolbar works with the mouse while a G runs from the keyboard: what is saved, opened or
  // dropped is the project without the operator's half-done move, as after Escape.
  cancelActiveOperator();
  const { project, path } = useStore.getState();
  try {
    const written = await saveText(as ? null : path, `${safeFileName(project.info.name)}.kplan`, PROJECT_FILTER, serializeProject(project));
    if (!written) return false;
    useStore.getState().markSaved(written);
    void addRecentFile(written).catch(() => {});
    toast(t("file.saved", { name: baseName(written) }));
    return true;
  } catch (e) {
    toast(errorText(e), "danger");
    return false;
  }
}

export type ExportKind = "plan-svg" | "plan-dxf" | "plan-png" | "elevation-svg" | "elevation-dxf" | "elevations-svg" | "3d-png" | "list-csv";

/** Runs one export; `facing` picks the elevation for the single-elevation exports. */
export async function runExport(kind: ExportKind, facing: Facing) {
  const { project, prefs } = useStore.getState();
  const base = safeFileName(project.info.name);
  const lang = currentLang();
  const facingName = t(`facing.${facing}` as const);
  try {
    let written: string | null = null;
    switch (kind) {
      case "plan-svg": {
        const s = sheetDrawing((paperScale) => planDrawing(project, { showNames: prefs.showNames, showDims: true, paperScale }), project.info, t("view.plan"), lang);
        written = await saveText(null, `${base} - ${t("view.plan")}.svg`, SVG, drawingToSvg(s.drawing, { paperScale: s.paperScale, bounds: s.bounds }));
        break;
      }
      case "plan-dxf": {
        const s = sheetDrawing((paperScale) => planDrawing(project, { showNames: prefs.showNames, showDims: true, paperScale }), project.info, t("view.plan"), lang);
        written = await saveText(null, `${base} - ${t("view.plan")}.dxf`, DXF, drawingToDxf(s.drawing, s.paperScale));
        break;
      }
      case "plan-png": {
        const s = sheetDrawing((paperScale) => planDrawing(project, { showNames: prefs.showNames, showDims: true, paperScale }), project.info, t("view.plan"), lang);
        const png = await svgToPng(drawingToSvg(s.drawing, { paperScale: s.paperScale, bounds: s.bounds }), PNG_WIDTH);
        written = await saveBinary(`${base} - ${t("view.plan")}.png`, PNG, png);
        break;
      }
      case "elevation-svg":
      case "elevation-dxf": {
        const title = t("view.elevation", { facing: facingName });
        const s = sheetDrawing((paperScale) => elevationDrawing(project, facing, { showDims: true, cut: prefs.elevationCut, paperScale }), project.info, title, lang);
        written =
          kind === "elevation-svg"
            ? await saveText(null, `${base} - ${title}.svg`, SVG, drawingToSvg(s.drawing, { paperScale: s.paperScale, bounds: s.bounds }))
            : await saveText(null, `${base} - ${title}.dxf`, DXF, drawingToDxf(s.drawing, s.paperScale));
        break;
      }
      case "elevations-svg": {
        const s = sheetDrawing((paperScale) => allElevations(project, prefs.elevationCut, paperScale), project.info, t("view.elevations"), lang);
        written = await saveText(null, `${base} - ${t("view.elevations")}.svg`, SVG, drawingToSvg(s.drawing, { paperScale: s.paperScale, bounds: s.bounds }));
        break;
      }
      case "3d-png": {
        const png = await capture3dPng(PNG_WIDTH);
        written = await saveBinary(`${base} - 3D.png`, PNG, png);
        break;
      }
      case "list-csv":
        written = await saveText(null, `${base} - ${t("list.title")}.csv`, CSV, equipmentCsv(project, lang));
        break;
    }
    if (written) toast(t("export.done", { name: baseName(written) }));
  } catch (e) {
    toast(errorText(e), "danger");
  }
}

/**
 * Writes the plan set as PDF after asking where; returns whether it was written. The 3D page is
 * left out when no 3D view is shown (the dialog says so). The elevations use the cut depth and
 * the plan prints names when the dialog asks for them.
 */
export async function exportPlanSet(opts: PlanSetOptions): Promise<boolean> {
  const { project, prefs } = useStore.getState();
  const lang = currentLang();
  try {
    const image = opts.view3d && canCapture3d() ? await capture3dPng(PDF_IMAGE_WIDTH) : null;
    const pdf = await planSetPdf(project, { ...opts, view3d: image !== null }, { lang, cut: prefs.elevationCut, image });
    const written = await saveBinary(`${safeFileName(project.info.name)} - ${t("planSet.fileName")}.pdf`, PDF_FILTER, pdf);
    if (written) toast(t("export.done", { name: baseName(written) }));
    return written !== null;
  } catch (e) {
    toast(errorText(e), "danger");
    return false;
  }
}

/**
 * The four elevations stacked on one drawing, each with its title above it, cut at `cut` and laid
 * out for `paperScale` (titles, gaps and position numbers are spaced in paper mm).
 */
export function allElevations(project: Project, cut: ElevationCut = "wall", paperScale = 50): Drawing {
  const shapes: Shape[] = [];
  let y = 0;
  for (const facing of FACINGS) {
    const d = elevationDrawing(project, facing, { showDims: true, cut, paperScale });
    const b = drawingBounds(d, paperScale);
    const dy = y - b.minY + TEXT.large * paperScale * 2;
    shapes.push({ t: "text", pen: "frame", p: { x: b.minX, y: y + TEXT.large * paperScale }, text: t("view.elevation", { facing: t(`facing.${facing}` as const) }), size: TEXT.large, anchor: "start" });
    for (const s of d.shapes) shapes.push(translate(s, 0, dy));
    y = dy + b.maxY + SHEET_GAP * paperScale;
  }
  return { shapes };
}

function translate(s: Shape, dx: number, dy: number): Shape {
  const m = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
  switch (s.t) {
    case "poly":
      return { ...s, pts: s.pts.map(m) };
    case "circle":
    case "arc":
      return { ...s, c: m(s.c) };
    case "text":
      return { ...s, p: m(s.p) };
    case "dim":
      return { ...s, a: m(s.a), b: m(s.b) };
  }
}

// Lives in errors.ts so it can be tested without the renderers; re-exported for existing callers.
export { errorText };
