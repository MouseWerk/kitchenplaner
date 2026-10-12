// File commands and exports, shared by the toolbar, the menus and the keyboard shortcuts.

import { elevationDrawing } from "../model/elevation";
import { equipmentCsv } from "../model/equipment";
import { planDrawing } from "../model/plan";
import { newProject } from "../model/project";
import { parseProject, ProjectError, serializeProject } from "../model/serialize";
import { FACINGS, type Facing, type Project } from "../model/types";
import { drawingBounds, TEXT, type Drawing, type Shape } from "../render/drawing";
import { drawingToDxf } from "../render/dxf";
import { svgToPng } from "../render/png";
import { drawingToSvg, sheetDrawing } from "../render/svg";
import { capture3dPng } from "../three/capture";
import { useStore } from "../store/store";
import { currentLang, t } from "./i18n";
import { addRecentFile, baseName, confirmDialog, openProjectFile, PROJECT_FILTER, readProjectPath, safeFileName, saveBinary, saveText, type FileFilter } from "./platform";
import { toast } from "./toast";

const SVG: FileFilter = { name: "SVG", extensions: ["svg"] };
const DXF: FileFilter = { name: "DXF", extensions: ["dxf"] };
const PNG: FileFilter = { name: "PNG", extensions: ["png"] };
const CSV: FileFilter = { name: "CSV", extensions: ["csv"] };

/** Width of exported PNG images (px): sharp on a 4K screen and in an A4 printout. */
const PNG_WIDTH = 3200;
/** Gap between the four elevations on one sheet (paper mm). */
const SHEET_GAP = 18;

/** Asks before the open project's changes would be lost; true when it may go ahead. */
export async function confirmDiscard(): Promise<boolean> {
  if (!useStore.getState().dirty) return true;
  return confirmDialog(t("file.discardQuestion"), t("app.name"), t("file.discard"), t("common.cancel"));
}

export async function newFile() {
  if (!(await confirmDiscard())) return;
  useStore.getState().load(newProject(), null);
}

export async function openFile() {
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
        const s = sheetDrawing(planDrawing(project, { showNames: prefs.showNames, showDims: true }), project.info, t("view.plan"), lang);
        written = await saveText(null, `${base} - ${t("view.plan")}.svg`, SVG, drawingToSvg(s.drawing, { paperScale: s.paperScale, bounds: s.bounds }));
        break;
      }
      case "plan-dxf": {
        const s = sheetDrawing(planDrawing(project, { showNames: prefs.showNames, showDims: true }), project.info, t("view.plan"), lang);
        written = await saveText(null, `${base} - ${t("view.plan")}.dxf`, DXF, drawingToDxf(s.drawing, s.paperScale));
        break;
      }
      case "plan-png": {
        const s = sheetDrawing(planDrawing(project, { showNames: prefs.showNames, showDims: true }), project.info, t("view.plan"), lang);
        const png = await svgToPng(drawingToSvg(s.drawing, { paperScale: s.paperScale, bounds: s.bounds }), PNG_WIDTH);
        written = await saveBinary(`${base} - ${t("view.plan")}.png`, PNG, png);
        break;
      }
      case "elevation-svg":
      case "elevation-dxf": {
        const title = t("view.elevation", { facing: facingName });
        const s = sheetDrawing(elevationDrawing(project, facing, { showDims: true }), project.info, title, lang);
        written =
          kind === "elevation-svg"
            ? await saveText(null, `${base} - ${title}.svg`, SVG, drawingToSvg(s.drawing, { paperScale: s.paperScale, bounds: s.bounds }))
            : await saveText(null, `${base} - ${title}.dxf`, DXF, drawingToDxf(s.drawing, s.paperScale));
        break;
      }
      case "elevations-svg": {
        const s = sheetDrawing(allElevations(project), project.info, t("view.elevations"), lang);
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

/** The four elevations stacked on one drawing, each with its title above it. */
export function allElevations(project: Project): Drawing {
  // Laid out for the screen scale; the sheet picks its own scale for the whole stack.
  const paperScale = 50;
  const shapes: Shape[] = [];
  let y = 0;
  for (const facing of FACINGS) {
    const d = elevationDrawing(project, facing, { showDims: true });
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

/** A message for the user from any error: project errors by their key, others with their text. */
export function errorText(e: unknown): string {
  if (e instanceof ProjectError) return t(e.key);
  const kind = typeof e === "object" && e && "kind" in e ? String((e as { kind: unknown }).kind) : null;
  if (kind === "tooLarge") return t("error.tooLarge");
  if (kind === "notUtf8" || kind === "notProject") return t("error.notProject");
  const msg = typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return t("error.generic", { message: msg });
}
