// The 3D view: the room and the equipment in perspective, orbit with the mouse, click to select.
//
// Rendering is on demand: a frame is drawn only when the scene, the camera, the size or the
// theme changes, never in a loop, so an idle 3D view costs no CPU or GPU time. Item models are
// rebuilt only for items whose object changed (the store replaces an item object on every edit
// and keeps the others), the room only when the room object changed.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ArrowDownToLine, Box, Eye, Layers, Maximize } from "lucide-react";
import type { Item, Project, Room } from "../model/types";
import { bounds } from "../model/geometry";
import { useStore } from "../store/store";
import { useT, type TKey } from "../lib/i18n";
import { buildItemObject, itemIdOf, MM_PER_UNIT, releaseShared, retainShared, setItemHighlight } from "../three/meshes";
import { applyCutaway, buildRoomObject, disposeRoomObject } from "../three/room";
import { registerCapture } from "../three/capture";
import "../styles/view3d.css";

/** Pointer movement (px) up to which a press and release counts as a click, not an orbit. */
const CLICK_TOLERANCE = 4;
/** Vertical field of view (degrees): moderate, close to a photo of a room. */
const FOV = 45;
/** Margin around the kitchen when fitting it into the view (share of the size). */
const FIT_MARGIN = 1.1;
/** Background when the theme token cannot be read. */
const FALLBACK_BACKGROUND = "#2a2b2f";
/** Selection box colour when the theme token cannot be read: neutral gray. */
const FALLBACK_HIGHLIGHT = "#9a9da4";
/** How far the selection box stands off the item (m), so it does not z-fight with its faces. */
const HIGHLIGHT_PAD = 0.01;
/** Edge length of the shadow map (px): soft enough and cheap. */
const SHADOW_MAP_SIZE = 1024;
/** Largest PNG width a capture renders (px); larger requests are reduced to it. */
const MAX_CAPTURE_WIDTH = 8192;
/** Keeps the camera from orbiting below the floor (rad short of horizontal). */
const FLOOR_ANGLE_MARGIN = 0.02;
/** A top view looks straight down but a hair off vertical, so the orbit keeps north up. */
const TOP_VIEW_TILT = 1e-3;

/** Blur of the reflected studio environment (0 sharp, 1 diffuse): a soft brushed-steel look. */
const ENVIRONMENT_BLUR = 0.04;
/** Strength of the environment light next to the sun and sky lights. */
const ENVIRONMENT_INTENSITY = 0.6;

type Preset = "perspective" | "top" | "front";

/** Camera directions from the target, three coordinates (z is south, so +z looks north). */
const PRESET_DIRECTION: Record<Preset, THREE.Vector3> = {
  perspective: new THREE.Vector3(0.75, 0.75, 1).normalize(),
  top: new THREE.Vector3(0, 1, TOP_VIEW_TILT).normalize(),
  front: new THREE.Vector3(0, 0.25, 1).normalize(),
};

type Status = "ok" | "unavailable" | "lost";

/** `fitSignal`: a change re-frames the view (fit shortcut, another project opened). */
export function View3D(props: { className?: string; fitSignal?: number }) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [status, setStatus] = useState<Status>("ok");
  const [cutaway, setCutaway] = useState(true);
  const project = useStore((s) => s.project);
  const selectedIds = useStore((s) => s.selection.items);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let engine: Engine;
    try {
      engine = new Engine(host, {
        onPick: (id, additive) => pick(id, additive),
        onStatus: setStatus,
        canvasLabel: t("view3d.canvas"),
      });
    } catch (e) {
      console.warn("3D view: WebGL is not available", e);
      setStatus("unavailable");
      return;
    }
    engineRef.current = engine;
    setStatus("ok");
    const unregister = registerCapture((w) => engine.capture(w));
    return () => {
      unregister();
      engine.dispose();
      engineRef.current = null;
    };
    // The engine lives as long as the component; `t` only names the canvas once.
  }, []);

  useEffect(() => engineRef.current?.setProject(project), [project]);
  useEffect(() => engineRef.current?.setSelection(selectedIds), [selectedIds]);
  useEffect(() => engineRef.current?.setCutaway(cutaway), [cutaway]);

  // The engine frames the first project itself; later loads start from the perspective view again,
  // the fit shortcut keeps the direction. Only changes after mounting count.
  const loadCount = useStore((s) => s.loadCount);
  const seen = useRef({ loadCount, fitSignal: props.fitSignal });
  useEffect(() => {
    const engine = engineRef.current;
    const last = seen.current;
    if (loadCount !== last.loadCount) engine?.preset("perspective");
    else if (props.fitSignal !== last.fitSignal) engine?.fit();
    seen.current = { loadCount, fitSignal: props.fitSignal };
  }, [loadCount, props.fitSignal]);

  const buttons: { key: TKey; icon: typeof Box; run: () => void }[] = [
    { key: "view3d.perspective", icon: Box, run: () => engineRef.current?.preset("perspective") },
    { key: "view3d.top", icon: ArrowDownToLine, run: () => engineRef.current?.preset("top") },
    { key: "view3d.front", icon: Eye, run: () => engineRef.current?.preset("front") },
    { key: "view3d.fit", icon: Maximize, run: () => engineRef.current?.fit() },
  ];

  return (
    <div className={`v3d ${props.className ?? ""}`}>
      <div ref={hostRef} className="v3d-host" />
      {status === "ok" ? (
        <div className="v3d-toolbar" role="toolbar" aria-label={t("view3d.toolbar")}>
          {buttons.map(({ key, icon: Icon, run }) => (
            <button key={key} type="button" className="v3d-btn" onClick={run} title={t(key)} aria-label={t(key)}>
              <Icon size={16} aria-hidden />
            </button>
          ))}
          <span className="v3d-sep" aria-hidden />
          <button
            type="button"
            className="v3d-btn"
            onClick={() => setCutaway((c) => !c)}
            title={t("view3d.cutaway")}
            aria-label={t("view3d.cutaway")}
            aria-pressed={cutaway}
          >
            <Layers size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <p className="v3d-message" role="status">
          {t(status === "lost" ? "view3d.contextLost" : "view3d.unavailable")}
        </p>
      )}
    </div>
  );
}

/** Selects the clicked item: alone, or toggled into the selection with Shift or Ctrl. */
function pick(id: string | null, additive: boolean): void {
  const { selection, select } = useStore.getState();
  if (!id) {
    if (!additive) select({ items: [], opening: null });
    return;
  }
  if (!additive) {
    select({ items: [id] });
    return;
  }
  const has = selection.items.includes(id);
  select({ items: has ? selection.items.filter((i) => i !== id) : [...selection.items, id] });
}

// ---------------------------------------------------------------------------------------------

interface EngineCallbacks {
  onPick: (id: string | null, additive: boolean) => void;
  onStatus: (s: Status) => void;
  canvasLabel: string;
}

/** The three.js side of the view: renderer, scene, camera and their life cycle. */
class Engine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 500);
  private readonly controls: OrbitControls;
  private readonly sun = new THREE.DirectionalLight(0xffffff, 1.8);
  private readonly itemsRoot = new THREE.Group();
  private readonly highlightRoot = new THREE.Group();
  private readonly items = new Map<string, { item: Item; object: THREE.Group }>();
  private room: Room | null = null;
  private roomObject: THREE.Group | null = null;
  private selection: readonly string[] = [];
  private cutaway = true;
  private framed = false;
  private highlightColor = new THREE.Color(FALLBACK_HIGHLIGHT);
  private frame = 0;
  private lost = false;
  private down: { x: number; y: number } | null = null;
  private readonly cleanup: (() => void)[] = [];
  private environment: THREE.Texture | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly cb: EngineCallbacks,
  ) {
    // Throws when WebGL is unavailable; the component shows a message then.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    retainShared();
    const r = this.renderer;
    r.setPixelRatio(window.devicePixelRatio);
    r.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral tone mapping keeps the steel gray instead of shifting it as ACES does.
    r.toneMapping = THREE.NeutralToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    const canvas = r.domElement;
    canvas.className = "v3d-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", cb.canvasLabel);
    host.appendChild(canvas);

    this.controls = new OrbitControls(this.camera, canvas);
    // No damping: it needs a frame loop after every release; a still camera draws nothing.
    this.controls.enableDamping = false;
    this.controls.maxPolarAngle = Math.PI / 2 - FLOOR_ANGLE_MARGIN;
    this.controls.screenSpacePanning = true;
    this.listen(this.controls, "change", () => this.requestRender());

    // Steel is a reflective material: without something to reflect it renders nearly black. A
    // neutral studio environment, prefiltered once, gives it its look at no per-frame cost.
    const pmrem = new THREE.PMREMGenerator(r);
    const studio = new RoomEnvironment();
    this.environment = pmrem.fromScene(studio, ENVIRONMENT_BLUR).texture;
    studio.dispose();
    pmrem.dispose();
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = ENVIRONMENT_INTENSITY;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a857c, 0.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    this.sun.shadow.radius = 3;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(hemi, this.sun, this.sun.target, this.itemsRoot, this.highlightRoot);

    this.listenDom<PointerEvent>(canvas, "pointerdown", (e) => {
      if (e.button === 0) this.down = { x: e.clientX, y: e.clientY };
    });
    this.listenDom<PointerEvent>(canvas, "pointerup", (e) => this.onPointerUp(e));
    this.listenDom(canvas, "webglcontextlost", (e) => {
      // Prevents the default so the browser may restore the context later.
      e.preventDefault();
      this.lost = true;
      cb.onStatus("lost");
    });
    this.listenDom(canvas, "webglcontextrestored", () => {
      this.lost = false;
      cb.onStatus("ok");
      this.requestRender();
    });

    const resize = new ResizeObserver(() => this.resize());
    resize.observe(host);
    this.cleanup.push(() => resize.disconnect());

    // Theme: the system scheme and the app's own `data-theme` switch both change the tokens.
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onTheme = () => this.readTheme();
    scheme.addEventListener("change", onTheme);
    this.cleanup.push(() => scheme.removeEventListener("change", onTheme));
    const themeObserver = new MutationObserver(onTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    this.cleanup.push(() => themeObserver.disconnect());

    this.readTheme();
    this.resize();
  }

  setProject(p: Project): void {
    if (p.room !== this.room) this.setRoom(p.room);
    const seen = new Set<string>();
    for (const item of p.items) {
      seen.add(item.id);
      const known = this.items.get(item.id);
      if (known?.item === item) continue;
      if (known) this.itemsRoot.remove(known.object);
      const object = buildItemObject(item);
      this.itemsRoot.add(object);
      this.items.set(item.id, { item, object });
    }
    for (const [id, known] of this.items) {
      if (seen.has(id)) continue;
      this.itemsRoot.remove(known.object);
      this.items.delete(id);
    }
    if (!this.framed) {
      this.framed = true;
      this.preset("perspective");
    }
    this.updateHighlight();
    this.requestRender();
  }

  setSelection(ids: readonly string[]): void {
    this.selection = ids;
    this.updateHighlight();
    this.requestRender();
  }

  setCutaway(on: boolean): void {
    this.cutaway = on;
    this.requestRender();
  }

  /** Moves the camera to a preset direction, fitting the kitchen. Jumps without animation. */
  preset(p: Preset): void {
    this.frameScene(PRESET_DIRECTION[p]);
  }

  /** Fits the kitchen into the view from the current direction. */
  fit(): void {
    const dir = this.camera.position.clone().sub(this.controls.target);
    this.frameScene(dir.lengthSq() > 0 ? dir.normalize() : PRESET_DIRECTION.perspective);
  }

  /** Renders the view into a PNG, at the shown size or `widthPx` wide with the same aspect. */
  async capture(widthPx?: number): Promise<Uint8Array> {
    if (this.lost) throw new Error("3D capture: the graphics context is lost; try again in a moment.");
    const r = this.renderer;
    const { width, height } = this.size();
    const ratio = r.getPixelRatio();
    const maxWidth = Math.min(MAX_CAPTURE_WIDTH, r.capabilities.maxTextureSize);
    const w = Math.round(Math.min(widthPx ?? width * ratio, maxWidth));
    const h = Math.max(1, Math.round((w * height) / width));
    r.setPixelRatio(1);
    r.setSize(w, h, false);
    this.draw();
    // `toBlob` takes the canvas content as it is now, right after the draw in the same task.
    const blob = await new Promise<Blob | null>((resolve) => r.domElement.toBlob(resolve, "image/png"));
    r.setPixelRatio(ratio);
    r.setSize(width, height, false);
    this.draw();
    if (!blob) throw new Error("3D capture: the canvas could not be encoded as PNG.");
    return new Uint8Array(await blob.arrayBuffer());
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    for (const f of this.cleanup) f();
    this.controls.dispose();
    this.clearHighlight();
    if (this.roomObject) disposeRoomObject(this.roomObject);
    this.itemsRoot.clear();
    this.items.clear();
    releaseShared();
    this.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // -------------------------------------------------------------------------------------------

  private setRoom(room: Room): void {
    if (this.roomObject) {
      this.scene.remove(this.roomObject);
      disposeRoomObject(this.roomObject);
    }
    this.room = room;
    this.roomObject = buildRoomObject(room);
    this.scene.add(this.roomObject);
    this.placeSun(room);
  }

  /** Puts the sun high over the north-west of the room with its shadow box around the room. */
  private placeSun(room: Room): void {
    const b = bounds(room.points);
    const cx = (b.minX + b.maxX) / 2 / MM_PER_UNIT;
    const cz = (b.minY + b.maxY) / 2 / MM_PER_UNIT;
    const radius = Math.hypot(b.maxX - b.minX, b.maxY - b.minY, room.height) / 2 / MM_PER_UNIT;
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx - radius * 0.6, radius * 2, cz - radius * 0.4);
    const cam = this.sun.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 0.1;
    cam.far = radius * 4;
    cam.updateProjectionMatrix();
    this.sun.target.updateMatrixWorld();
  }

  /** The box of the room and everything placed, in metres. */
  private sceneBox(): THREE.Box3 {
    const box = new THREE.Box3();
    if (this.room && this.room.points.length > 0) {
      const b = bounds(this.room.points);
      box.expandByPoint(new THREE.Vector3(b.minX / MM_PER_UNIT, 0, b.minY / MM_PER_UNIT));
      box.expandByPoint(new THREE.Vector3(b.maxX / MM_PER_UNIT, this.room.height / MM_PER_UNIT, b.maxY / MM_PER_UNIT));
    }
    if (this.itemsRoot.children.length > 0) box.union(new THREE.Box3().setFromObject(this.itemsRoot));
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
    return box;
  }

  private frameScene(dir: THREE.Vector3): void {
    const sphere = this.sceneBox().getBoundingSphere(new THREE.Sphere());
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const distance = (sphere.radius * FIT_MARGIN) / Math.sin(Math.min(vFov, hFov) / 2);
    this.controls.target.copy(sphere.center);
    this.camera.position.copy(sphere.center).addScaledVector(dir, distance);
    this.camera.near = Math.max(0.01, distance / 1000);
    this.camera.far = distance + sphere.radius * 4;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.requestRender();
  }

  private clearHighlight(): void {
    for (const { object } of this.items.values()) {
      if (!object.userData.highlighted) continue;
      setItemHighlight(object, false);
      object.userData.highlighted = false;
    }
    for (const c of this.highlightRoot.children) {
      if (c instanceof THREE.Box3Helper) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    }
    this.highlightRoot.clear();
  }

  /** A neutral tint and a neutral box outline on each selected item. */
  private updateHighlight(): void {
    this.clearHighlight();
    for (const id of this.selection) {
      const known = this.items.get(id);
      if (!known) continue;
      const box = new THREE.Box3().setFromObject(known.object).expandByScalar(HIGHLIGHT_PAD);
      setItemHighlight(known.object, true);
      known.object.userData.highlighted = true;
      const helper = new THREE.Box3Helper(box, this.highlightColor);
      helper.raycast = () => {};
      this.highlightRoot.add(helper);
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const start = this.down;
    this.down = null;
    if (!start || e.button !== 0) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_TOLERANCE) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObjects(this.itemsRoot.children, true).find((h) => h.object.visible);
    this.cb.onPick(hit ? itemIdOf(hit.object) : null, e.shiftKey || e.ctrlKey || e.metaKey);
  }

  private readTheme(): void {
    const bg = cssColor(this.host, "--bg-canvas") ?? new THREE.Color(FALLBACK_BACKGROUND);
    this.scene.background = bg;
    this.highlightColor = cssColor(this.host, "--text-muted") ?? new THREE.Color(FALLBACK_HIGHLIGHT);
    this.updateHighlight();
    this.requestRender();
  }

  private size(): { width: number; height: number } {
    return { width: Math.max(1, this.host.clientWidth), height: Math.max(1, this.host.clientHeight) };
  }

  private resize(): void {
    const { width, height } = this.size();
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private draw(): void {
    if (this.lost) return;
    if (this.roomObject) applyCutaway(this.roomObject, this.camera.position, this.cutaway);
    this.renderer.render(this.scene, this.camera);
  }

  private listen(target: THREE.EventDispatcher<{ change: object }>, type: "change", f: () => void): void {
    target.addEventListener(type, f);
    this.cleanup.push(() => target.removeEventListener(type, f));
  }

  /** Adds a DOM listener removed on dispose; WebGL context events are not in the typed map. */
  private listenDom<E extends Event>(el: EventTarget, type: string, f: (e: E) => void): void {
    const l = f as EventListener;
    el.addEventListener(type, l);
    this.cleanup.push(() => el.removeEventListener(type, l));
  }
}

/**
 * The colour of a CSS custom property as the browser resolves it. Painting it on a one-pixel
 * canvas accepts every colour syntax the browser knows (hex, rgb, oklch, color-mix), which
 * `THREE.Color` alone does not. Null when the property is unset or not a colour.
 */
function cssColor(el: HTMLElement, name: string): THREE.Color | null {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  if (!value) return null;
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  // An invalid colour leaves fillStyle unchanged; a sentinel tells the two cases apart.
  const sentinel = "#010203";
  ctx.fillStyle = sentinel;
  ctx.fillStyle = value;
  if (ctx.fillStyle === sentinel && value.toLowerCase() !== sentinel) return null;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}
