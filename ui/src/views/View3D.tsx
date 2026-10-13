// The 3D view: the room and the equipment in perspective or orthographic, Blender-like
// navigation, moving items in the arrange mode, a walk-through, a height cut and a view cube.
// The three.js side lives in `three/engine.ts`; this component holds the overlay and passes the
// store's state to the engine.

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Box, Eye, Footprints, Layers, Maximize, Scissors, Sparkles, Square } from "lucide-react";
import { useStore } from "../store/store";
import { num, useT, type TKey } from "../lib/i18n";
import { Engine, type Quality, type Status } from "../three/engine";
import type { ViewName } from "../three/navigation";
import { registerCapture } from "../three/capture";
import "../styles/view3d.css";

/** The quality setting is a per-computer preference: integrated graphics may want Standard. */
const QUALITY_KEY = "kitchenplaner.view3d.quality";
/** Lowest cut height (mm): below a worktop the cut shows little. */
const SECTION_MIN = 300;
/** Cut height when the cut is switched on (mm): above the equipment, below hoods and ceiling. */
const SECTION_DEFAULT = 2200;
const SECTION_STEP = 50;

function readQuality(): Quality {
  try {
    return localStorage.getItem(QUALITY_KEY) === "high" ? "high" : "standard";
  } catch {
    return "standard";
  }
}

function writeQuality(q: Quality): void {
  try {
    localStorage.setItem(QUALITY_KEY, q);
  } catch {
    // Without storage the setting lasts until the window closes.
  }
}

/** The faces of the view cube: which view a click shows, and where the face sits on the cube. */
const CUBE_FACES: { view: ViewName; key: TKey; face: string }[] = [
  { view: "front", key: "view3d.face.front", face: "front" },
  { view: "back", key: "view3d.face.back", face: "back" },
  { view: "right", key: "view3d.face.right", face: "right" },
  { view: "left", key: "view3d.face.left", face: "left" },
  { view: "top", key: "view3d.face.top", face: "top" },
];

/** `fitSignal`: a change re-frames the view (fit shortcut, another project opened). */
export function View3D(props: { className?: string; fitSignal?: number }) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [status, setStatus] = useState<Status>("ok");
  const [cutaway, setCutaway] = useState(true);
  const [ortho, setOrtho] = useState(false);
  const [walking, setWalking] = useState(false);
  const [quality, setQuality] = useState<Quality>(readQuality);
  const [section, setSection] = useState<number | null>(null);
  const project = useStore((s) => s.project);
  const selectedIds = useStore((s) => s.selection.items);
  const mode = useStore((s) => s.mode);
  const roomHeight = project.room.height;

  useEffect(() => {
    const root = rootRef.current;
    const host = hostRef.current;
    if (!root || !host) return;
    let engine: Engine;
    try {
      engine = new Engine(root, host, {
        onStatus: setStatus,
        onOrtho: setOrtho,
        onWalk: setWalking,
        canvasLabel: t("view3d.canvas"),
      });
    } catch (e) {
      console.warn("3D view: WebGL is not available", e);
      setStatus("unavailable");
      return;
    }
    engineRef.current = engine;
    setStatus("ok");
    engine.setCube(cubeRef.current);
    const unregister = registerCapture((w) => engine.capture(w));
    // Development builds expose the engine for frame time measurements from the console.
    if (import.meta.env.DEV) (window as unknown as { __view3d?: Engine }).__view3d = engine;
    return () => {
      unregister();
      engine.dispose();
      engineRef.current = null;
    };
    // The engine lives as long as the component; `t` only names the canvas once.
  }, []);

  useEffect(() => engineRef.current?.setProject(project), [project]);
  useEffect(() => engineRef.current?.setSelection(selectedIds), [selectedIds]);
  useEffect(() => engineRef.current?.setMode(mode), [mode]);
  useEffect(() => engineRef.current?.setCutaway(cutaway), [cutaway]);
  useEffect(() => {
    engineRef.current?.setQuality(quality);
    writeQuality(quality);
  }, [quality]);
  // The cut never stands above the room (a lower room after an edit).
  const cut = section === null ? null : Math.min(section, roomHeight);
  useEffect(() => engineRef.current?.setSection(cut), [cut]);
  useEffect(() => engineRef.current?.setCube(cubeRef.current), [status]);

  // The engine frames the first project itself; later loads start from the perspective view again,
  // the fit shortcut keeps the direction. Only changes after mounting count.
  const loadCount = useStore((s) => s.loadCount);
  const seen = useRef({ loadCount, fitSignal: props.fitSignal });
  useEffect(() => {
    const engine = engineRef.current;
    const last = seen.current;
    if (loadCount !== last.loadCount) engine?.preset("perspective", false);
    else if (props.fitSignal !== last.fitSignal) engine?.fit();
    seen.current = { loadCount, fitSignal: props.fitSignal };
  }, [loadCount, props.fitSignal]);

  const label = (key: TKey, keys?: string) => (keys ? `${t(key)} (${keys})` : t(key));
  const views: { key: TKey; keys?: string; icon: typeof Box; run: () => void }[] = [
    { key: "view3d.perspective", icon: Box, run: () => engineRef.current?.preset("perspective") },
    { key: "view3d.top", keys: "7", icon: ArrowDownToLine, run: () => engineRef.current?.preset("top") },
    { key: "view3d.front", keys: "1", icon: Eye, run: () => engineRef.current?.preset("front") },
    { key: "view3d.fit", keys: "F", icon: Maximize, run: () => engineRef.current?.fit() },
  ];
  const toggles: { key: TKey; keys?: string; icon: typeof Box; on: boolean; run: () => void }[] = [
    { key: "view3d.ortho", keys: "5", icon: Square, on: ortho, run: () => engineRef.current?.toggleOrtho() },
    { key: "view3d.cutaway", icon: Layers, on: cutaway, run: () => setCutaway((c) => !c) },
    { key: "view3d.section", icon: Scissors, on: cut !== null, run: () => setSection((s) => (s === null ? Math.min(SECTION_DEFAULT, roomHeight) : null)) },
    { key: "view3d.walk", icon: Footprints, on: walking, run: () => engineRef.current?.toggleWalk() },
    { key: "view3d.quality", icon: Sparkles, on: quality === "high", run: () => setQuality((q) => (q === "high" ? "standard" : "high")) },
  ];

  return (
    <div ref={rootRef} className={`v3d ${props.className ?? ""}`} tabIndex={-1}>
      <div ref={hostRef} className="v3d-host" />
      {status === "ok" ? (
        <>
          <div className="v3d-bar">
            <div className="v3d-toolbar" role="toolbar" aria-label={t("view3d.toolbar")}>
              {views.map(({ key, keys, icon: Icon, run }) => (
                <button key={key} type="button" className="v3d-btn" onClick={run} title={label(key, keys)} aria-label={t(key)}>
                  <Icon size={16} aria-hidden />
                </button>
              ))}
              <span className="v3d-sep" aria-hidden />
              {toggles.map(({ key, keys, icon: Icon, on, run }) => (
                <button key={key} type="button" className="v3d-btn" onClick={run} title={label(key, keys)} aria-label={t(key)} aria-pressed={on}>
                  <Icon size={16} aria-hidden />
                </button>
              ))}
            </div>
            {cut !== null && (
              <label className="v3d-section">
                <span>{t("view3d.sectionHeight")}</span>
                <input
                  type="range"
                  min={SECTION_MIN}
                  max={roomHeight}
                  step={SECTION_STEP}
                  value={cut}
                  onChange={(e) => setSection(Number(e.target.value))}
                />
                <output>{num(cut / 1000, 2)} m</output>
              </label>
            )}
          </div>
          <div className="v3d-cube-wrap" role="group" aria-label={t("view3d.cube")}>
            <div ref={cubeRef} className="v3d-cube">
              {CUBE_FACES.map(({ view, key, face }) => (
                <button key={face} type="button" className={`v3d-face v3d-face-${face}`} onClick={() => engineRef.current?.preset(view)} title={t(key)}>
                  {t(key)}
                </button>
              ))}
              <span className="v3d-face v3d-face-bottom" aria-hidden />
            </div>
          </div>
          {walking && (
            <p className="v3d-hint" role="status">
              {t("view3d.walkHint")}
            </p>
          )}
        </>
      ) : (
        <p className="v3d-message" role="status">
          {t(status === "lost" ? "view3d.contextLost" : "view3d.unavailable")}
        </p>
      )}
    </div>
  );
}
