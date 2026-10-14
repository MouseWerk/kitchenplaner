// The three.js side of the 3D view: renderer, scene, cameras, navigation, editing and walking.
//
// Rendering is on demand: a frame is drawn only when the scene, the camera, the size or the
// theme changes, never in a loop, so an idle 3D view costs no CPU or GPU time. The only loops
// are short ones the user drives: a camera move to a view (a quarter second) and walking while a
// movement key is held. Item models are rebuilt only for items whose object changed (the store
// replaces an item object on every edit and keeps the others), the room only when the room
// object changed. Each item model is merged per material (`merge.ts`), so a kitchen of forty
// items stays at a few hundred draw calls.
//
// Navigation follows Blender: left drag orbits, middle or right drag (or Shift + left) pans, the
// wheel zooms towards the cursor; 1 / 3 / 7 front, side and top (orthographic), 5 toggles the
// projection, F or the numpad dot frames the selection, Home everything. Keys act only while
// the pointer is over the view or the view has the focus, and they do not reach the window's
// shortcuts then (1 to 4 switch the layout there).

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Item, Project, Room } from "../model/types";
import { bounds } from "../model/geometry";
import { useStore, type Mode } from "../store/store";
import { buildItemObject, itemIdOf, MM_PER_UNIT, releaseShared, retainShared, setItemHighlight } from "./meshes";
import { applyCutaway, buildRoomObject, disposeRoomObject } from "./room";
import { disposeMerged, mergeItemObject } from "./merge";
import { applyRoomLook, buildContactShadows, disposeContactShadows, LOOK, RoomTextures } from "./look";
import { distanceFor, easeInOut, fitDistance, halfHeightAt, orthoHalfHeightForBox, slerpDirection, VIEW_DIRECTION, viewKeyAction, type ViewName } from "./navigation";
import { EYE_HEIGHT, intentOf, isWalkKey, look, startWalk, stepWalk, walkSpace, type WalkSpace, type WalkState } from "./walk";
import { canStartItemDrag, ItemDragSession } from "./dragSession";
import { captureSize, encodePng, PostChain } from "./post";
import { CUBE_FACE_NAMES, cubeFaces, type CubeFace } from "./viewCube";

/** Pointer movement (px) up to which a press and release counts as a click, not a drag. */
const CLICK_TOLERANCE = 4;
/** Vertical field of view (degrees): moderate, close to a photo of a room. */
const FOV = 45;
/** Field of view while walking: wider, as a person sees a room. */
const WALK_FOV = 65;
/** Margin around the kitchen when fitting it into the view (share of the size). */
const FIT_MARGIN = 1.1;
/** Margin around a single item when focusing it (double click). */
const FOCUS_MARGIN = 1.6;
/** Background when the theme token cannot be read. */
const FALLBACK_BACKGROUND = "#2a2b2f";
/** Outline colour when the token `--draw-outline-3d` cannot be read (the same dark gray). */
const FALLBACK_OUTLINE = "#2a2c30";
/** How far an outline stands off the item (m), so it does not z-fight with its faces. */
const OUTLINE_PAD = 0.008;
/** The hover outline is the selection outline, fainter; hidden edges of a selection show faintly. */
const HOVER_OPACITY = 0.45;
const HIDDEN_OPACITY = 0.25;
/** Largest PNG width a capture renders (px); larger requests are reduced to it. */
const MAX_CAPTURE_WIDTH = 8192;
/** Near plane (m): close enough for walking up to a counter, far enough for depth precision. */
const NEAR = 0.03;
/** Duration of a camera move to a view (ms). */
const MOVE_MS = 260;


export type Quality = "standard" | "high";

/**
 * Standard: shadow maps, contact shadows, MSAA, one render pass, fast on integrated graphics.
 * High: larger shadow map and ambient occlusion (GTAO) as a post pass.
 */
const QUALITY: Record<Quality, { shadowMap: number; ao: boolean }> = {
  standard: { shadowMap: 2048, ao: false },
  high: { shadowMap: 4096, ao: true },
};

export type Status = "ok" | "unavailable" | "lost";

export interface EngineCallbacks {
  onStatus: (s: Status) => void;
  onOrtho: (ortho: boolean) => void;
  onWalk: (walking: boolean) => void;
  canvasLabel: string;
}

/** A camera placement: what it looks at, from which direction, and how much it shows. */
interface View {
  target: THREE.Vector3;
  /** Unit vector from the target towards the camera. */
  dir: THREE.Vector3;
  /** Perspective distance from the target. */
  distance: number;
  /** Orthographic half height of the view (at zoom 1). */
  half: number;
}

interface ItemDrag {
  session: ItemDragSession;
  plane: THREE.Plane;
  start: THREE.Vector3;
  clickId: string;
}

export class Engine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly persp = new THREE.PerspectiveCamera(FOV, 1, NEAR, 500);
  private readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, NEAR, 500);
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.persp;
  private orthoHalf = 5;
  /** True when a numpad view switched to orthographic; orbiting returns to perspective then. */
  private autoOrtho = false;
  private readonly controls: OrbitControls;
  private readonly sun = new THREE.DirectionalLight(0xffffff, LOOK.sunIntensity);
  private readonly itemsRoot = new THREE.Group();
  private readonly overlayRoot = new THREE.Group();
  private readonly items = new Map<string, { item: Item; object: THREE.Group }>();
  private contact: THREE.Mesh | null = null;
  private project: Project | null = null;
  private room: Room | null = null;
  private roomObject: THREE.Group | null = null;
  private readonly roomTextures = new RoomTextures();
  private sceneRadius = 5;
  private selection: readonly string[] = [];
  private hover: string | null = null;
  private mode: Mode = "arrange";
  private cutaway = true;
  private quality: Quality = "standard";
  /** The ambient occlusion chain of the high quality (`post.ts`); none in standard. */
  private post: PostChain | null = null;
  /** The canvas background (`--bg-canvas`), never tone mapped. */
  private background = new THREE.Color(FALLBACK_BACKGROUND);
  private framed = false;
  private readonly outlineBox: THREE.EdgesGeometry;
  private readonly selectedLine = new THREE.LineBasicMaterial({ color: FALLBACK_OUTLINE });
  /** The selection's edges behind other things, so a hidden selected item can still be found. */
  private readonly selectedHidden = new THREE.LineBasicMaterial({ color: FALLBACK_OUTLINE, transparent: true, opacity: HIDDEN_OPACITY, depthTest: false });
  private readonly hoverLine = new THREE.LineBasicMaterial({ color: FALLBACK_OUTLINE, transparent: true, opacity: HOVER_OPACITY });
  private frame = 0;
  private lost = false;
  private down: { x: number; y: number; button: number } | null = null;
  private drag: ItemDrag | null = null;
  private hoverFrame = 0;
  private lastPointer: { x: number; y: number } | null = null;
  private pointerInside = false;
  private anim: { from: View; to: View; start: number; frame: number } | null = null;
  private walk: WalkState | null = null;
  private walkSpace: WalkSpace | null = null;
  private walkSaved: { view: View; ortho: boolean } | null = null;
  private walkLook: { x: number; y: number; moved: boolean } | null = null;
  private readonly held = new Set<string>();
  private running = false;
  private walkFrame = 0;
  /** A frame was requested while the walk loop was scheduled: the loop draws it, also when it stops. */
  private walkPending = false;
  private lastStep = 0;
  private cube: HTMLElement | null = null;
  private cubeTransform = "";
  private readonly cleanup: (() => void)[] = [];
  private environment: THREE.Texture | null = null;
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    /** The view's root element: hover and focus there decide whether keys belong to the view. */
    private readonly root: HTMLElement,
    private readonly host: HTMLElement,
    private readonly cb: EngineCallbacks,
  ) {
    // Throws when WebGL is unavailable; the component shows a message then.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    retainShared();
    const r = this.renderer;
    r.setPixelRatio(window.devicePixelRatio);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = LOOK.toneMapping;
    r.toneMappingExposure = LOOK.exposure;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    // The scene stands still while the camera moves: the shadow map is drawn again only when
    // the scene changes (`updateShadows`), which halves the draw calls of an orbit.
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    const canvas = r.domElement;
    canvas.className = "v3d-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", cb.canvasLabel);
    host.appendChild(canvas);

    // The view's own pointer handling runs in the capture phase on the host, before the orbit
    // controls see the event, so dragging an item can keep the camera still.
    this.listenDom<PointerEvent>(host, "pointerdown", (e) => this.onPointerDown(e), true);

    this.controls = new OrbitControls(this.camera, canvas);
    // No damping: it needs a frame loop after every release; a still camera draws nothing.
    this.controls.enableDamping = false;
    // Down to the horizon (front and side views), never below the floor.
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 0.3;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    this.listen(this.controls, "change", () => this.requestRender());

    // Steel is a reflective material: without something to reflect it renders nearly black. A
    // neutral studio environment, prefiltered once, gives it its look at no per-frame cost.
    const pmrem = new THREE.PMREMGenerator(r);
    const studio = new RoomEnvironment();
    this.environment = pmrem.fromScene(studio, LOOK.environmentBlur).texture;
    studio.dispose();
    pmrem.dispose();
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = LOOK.environmentIntensity;

    const hemi = new THREE.HemisphereLight(LOOK.hemiSky, LOOK.hemiGround, LOOK.hemiIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.radius = 4;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.015;
    this.scene.add(hemi, this.sun, this.sun.target, this.itemsRoot, this.overlayRoot);
    // The box only gives the edges their shape: dispose it once they are taken.
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.outlineBox = new THREE.EdgesGeometry(box);
    box.dispose();
    this.applyQuality();

    this.listenDom<PointerEvent>(canvas, "pointermove", (e) => this.onPointerMove(e));
    this.listenDom<PointerEvent>(canvas, "pointerup", (e) => this.onPointerUp(e));
    this.listenDom<PointerEvent>(canvas, "pointercancel", (e) => this.onPointerUp(e));
    this.listenDom<MouseEvent>(canvas, "dblclick", (e) => this.onDoubleClick(e));
    this.listenDom<WheelEvent>(canvas, "wheel", () => this.cancelMove(), true);
    this.listenDom(root, "pointerenter", () => (this.pointerInside = true));
    this.listenDom(root, "pointerleave", () => {
      this.pointerInside = false;
      this.setHover(null);
    });
    // Keys: in the capture phase on the window, so the view takes its keys before the app's
    // shortcuts see them; only while the pointer is over the view or the focus is in it.
    this.listenDom<KeyboardEvent>(window, "keydown", (e) => this.onKeyDown(e), true);
    this.listenDom<KeyboardEvent>(window, "keyup", (e) => this.onKeyUp(e), true);
    this.listenDom(window, "blur", () => this.held.clear());
    this.listenDom(canvas, "webglcontextlost", (e) => {
      // Prevents the default so the browser may restore the context later.
      e.preventDefault();
      this.lost = true;
      cb.onStatus("lost");
    });
    this.listenDom(canvas, "webglcontextrestored", () => {
      this.lost = false;
      this.updateShadows();
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

  // -------------------------------------------------------------------------------------------
  // Model

  setProject(p: Project): void {
    this.project = p;
    if (p.room !== this.room) this.setRoom(p.room);
    const seen = new Set<string>();
    let changed = false;
    for (const item of p.items) {
      seen.add(item.id);
      const known = this.items.get(item.id);
      if (known?.item === item) continue;
      if (known) this.removeItem(known.object);
      const object = mergeItemObject(buildItemObject(item));
      this.itemsRoot.add(object);
      this.items.set(item.id, { item, object });
      changed = true;
    }
    for (const [id, known] of this.items) {
      if (seen.has(id)) continue;
      this.removeItem(known.object);
      this.items.delete(id);
      changed = true;
    }
    if (changed || !this.contact) {
      this.rebuildContactShadows(p.items);
      this.updateShadows();
    }
    this.walkSpace = null;
    if (!this.framed) {
      this.framed = true;
      this.jumpTo(this.viewFor(VIEW_DIRECTION.perspective, this.sceneBox()));
    }
    this.updateOverlays();
    this.requestRender();
  }

  setSelection(ids: readonly string[]): void {
    this.selection = ids;
    this.updateOverlays();
    this.requestRender();
  }

  setMode(mode: Mode): void {
    // Leaving the mode in the middle of a drag cancels it, as in the plan.
    if (mode !== this.mode) this.cancelDrag();
    this.mode = mode;
    if (mode !== "arrange") this.setHover(null);
  }

  setCutaway(on: boolean): void {
    this.cutaway = on;
    this.requestRender();
  }

  /** Cuts everything above `heightMm` away (null: no cut), to look into the room from above. */
  setSection(heightMm: number | null): void {
    this.renderer.clippingPlanes = heightMm === null ? [] : [new THREE.Plane(new THREE.Vector3(0, -1, 0), heightMm / MM_PER_UNIT)];
    // What is cut away casts no shadow either.
    this.updateShadows();
    this.requestRender();
  }

  setQuality(q: Quality): void {
    if (q === this.quality) return;
    this.quality = q;
    this.applyQuality();
    this.requestRender();
  }

  /** The element of the view cube; its faces follow the camera on every frame. */
  setCube(el: HTMLElement | null): void {
    this.cube = el;
    this.cubeTransform = "";
    this.requestRender();
  }

  // -------------------------------------------------------------------------------------------
  // Views

  /** Moves the camera to a named view, fitting the kitchen. Side and top views are orthographic. */
  preset(name: ViewName, animate = true): void {
    this.leaveWalk(false);
    const ortho = name !== "perspective";
    const view = this.viewFor(VIEW_DIRECTION[name], this.sceneBox());
    if (ortho !== this.isOrtho()) this.setProjection(ortho);
    this.autoOrtho = ortho;
    this.moveTo(view, animate);
  }

  /** Fits the kitchen into the view from the current direction. */
  fit(animate = true): void {
    this.leaveWalk(false);
    this.moveTo(this.viewFor(this.currentView().dir, this.sceneBox()), animate);
  }

  /** Fits the selected items, or the whole kitchen when nothing is selected. */
  frameSelection(): void {
    this.leaveWalk(false);
    const box = new THREE.Box3();
    for (const id of this.selection) {
      const known = this.items.get(id);
      if (known) box.union(new THREE.Box3().setFromObject(known.object));
    }
    if (box.isEmpty()) return this.fit();
    this.moveTo(this.viewFor(this.currentView().dir, box, FOCUS_MARGIN), true);
  }

  toggleOrtho(): void {
    if (this.walk) return;
    this.cancelMove();
    this.setProjection(!this.isOrtho());
    this.autoOrtho = false;
    this.requestRender();
  }

  isOrtho(): boolean {
    return this.camera === this.ortho;
  }

  // -------------------------------------------------------------------------------------------
  // Walking

  toggleWalk(): void {
    if (this.walk) this.leaveWalk(true);
    else this.enterWalk();
  }

  private enterWalk(): void {
    const p = this.project;
    if (!p) return;
    this.cancelMove();
    const t = this.controls.target;
    const at = { x: t.x * MM_PER_UNIT, y: t.z * MM_PER_UNIT };
    const c = this.camera.position;
    let facing = { x: t.x - c.x, y: t.z - c.z };
    const len = Math.hypot(facing.x, facing.y);
    // Straight down from the top: face north.
    facing = len > 1e-3 ? { x: facing.x / len, y: facing.y / len } : { x: 0, y: -1 };
    const state = startWalk(at, facing, this.space());
    if (!state) return;
    this.walkSaved = { view: this.currentView(), ortho: this.isOrtho() };
    if (this.isOrtho()) this.setProjection(false);
    this.walk = state;
    this.controls.enabled = false;
    this.persp.fov = WALK_FOV;
    this.persp.updateProjectionMatrix();
    this.setHover(null);
    this.applyWalkCamera();
    this.root.focus({ preventScroll: true });
    this.cb.onWalk(true);
    this.requestRender();
  }

  /** Leaves walk mode; `restore` returns to the view before walking (else the caller sets one). */
  private leaveWalk(restore: boolean): void {
    if (!this.walk) return;
    this.walk = null;
    this.walkLook = null;
    this.held.clear();
    cancelAnimationFrame(this.walkFrame);
    this.walkFrame = 0;
    this.persp.fov = FOV;
    this.persp.updateProjectionMatrix();
    this.controls.enabled = true;
    const saved = this.walkSaved;
    this.walkSaved = null;
    if (restore && saved) {
      if (saved.ortho) this.setProjection(true);
      this.jumpTo(saved.view);
    } else {
      // Orbit around a point in front of the eye.
      const dir = new THREE.Vector3();
      this.persp.getWorldDirection(dir);
      this.controls.target.copy(this.persp.position).addScaledVector(dir, 2);
      this.controls.update();
    }
    this.cb.onWalk(false);
    this.requestRender();
  }

  private space(): WalkSpace {
    if (!this.walkSpace) this.walkSpace = walkSpace(this.project?.room.points ?? [], this.project?.items ?? []);
    return this.walkSpace;
  }

  private applyWalkCamera(): void {
    const w = this.walk;
    if (!w) return;
    this.persp.position.set(w.x / MM_PER_UNIT, EYE_HEIGHT, w.y / MM_PER_UNIT);
    this.persp.rotation.set(w.pitch, w.yaw, 0, "YXZ");
    this.persp.updateMatrixWorld();
  }

  private walkLoop = (now: number): void => {
    this.walkFrame = 0;
    if (!this.walk || this.held.size === 0) {
      this.lastStep = 0;
      // The keys were let go: a frame asked for meanwhile (a change, a resize) still gets drawn.
      if (this.walkPending) this.requestRender();
      return;
    }
    // A long gap (a hidden window) must not teleport the walker.
    const dt = this.lastStep ? Math.min(0.05, (now - this.lastStep) / 1000) : 1 / 60;
    this.lastStep = now;
    this.walk = stepWalk(this.walk, intentOf(this.held, this.running), dt, this.space());
    this.applyWalkCamera();
    this.walkPending = false;
    this.draw();
    this.walkFrame = requestAnimationFrame(this.walkLoop);
  };

  // -------------------------------------------------------------------------------------------
  // Capture and life cycle

  /**
   * Renders the view into a PNG, at the shown size or `widthPx` wide with the same aspect. The
   * picture is drawn offscreen at its full size through a chain of its own (`post.ts`), with the
   * view's quality (ambient occlusion in high) and multisampling, never scaled from the canvas.
   */
  async capture(widthPx?: number): Promise<Uint8Array> {
    if (this.lost) throw new Error("3D capture: the graphics context is lost; try again in a moment.");
    const r = this.renderer;
    const gl = r.getContext();
    const maxSize = Math.min(MAX_CAPTURE_WIDTH, r.capabilities.maxTextureSize, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number);
    const { width: w, height: h } = captureSize(this.size(), r.getPixelRatio(), widthPx, maxSize);
    const chain = new PostChain(r, this.scene, this.camera, w, h, QUALITY[this.quality].ao);
    const target = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
    const pixels = new Uint8ClampedArray(w * h * 4);
    // Outlines and hover are editing aids, not part of the picture.
    this.overlayRoot.visible = false;
    try {
      if (this.roomObject) applyCutaway(this.roomObject, this.camera.position, this.cutaway);
      this.camera.updateMatrixWorld();
      chain.render(this.camera, this.background, target);
      r.readRenderTargetPixels(target, 0, 0, w, h, pixels);
    } finally {
      this.overlayRoot.visible = true;
      r.setRenderTarget(null);
      chain.dispose();
      target.dispose();
      this.requestRender();
    }
    return encodePng(pixels, w, h);
  }

  /**
   * Draws `frames` frames back to back, for the development timing hook: the mean time per
   * frame until the GPU is done, the mean CPU time of the draw calls, and the draw calls and
   * triangles of one frame.
   */
  measure(frames = 60, withShadows = false): { frameMs: number; cpuMs: number; calls: number; triangles: number } {
    const gl = this.renderer.getContext();
    const px = new Uint8Array(4);
    // Reading a pixel waits until the GPU is done; it costs a fixed stall, so it brackets the
    // whole run instead of each frame.
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    sync();
    let cpu = 0;
    let calls = 0;
    let triangles = 0;
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      const c0 = performance.now();
      this.renderer.info.reset();
      this.renderer.info.autoReset = false;
      // With shadows: a frame after an edit, when the shadow map is drawn again.
      if (withShadows) this.updateShadows();
      this.draw();
      this.renderer.info.autoReset = true;
      cpu += performance.now() - c0;
      calls = this.renderer.info.render.calls;
      triangles = this.renderer.info.render.triangles;
    }
    sync();
    return { frameMs: (performance.now() - t0) / frames, cpuMs: cpu / frames, calls, triangles };
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.hoverFrame);
    cancelAnimationFrame(this.walkFrame);
    this.cancelMove();
    this.cancelDrag();
    for (const f of this.cleanup) f();
    this.controls.dispose();
    this.clearOverlays();
    this.outlineBox.dispose();
    this.selectedLine.dispose();
    this.selectedHidden.dispose();
    this.hoverLine.dispose();
    if (this.roomObject) disposeRoomObject(this.roomObject);
    this.roomTextures.dispose();
    if (this.contact) disposeContactShadows(this.contact);
    for (const { object } of this.items.values()) disposeMerged(object);
    this.itemsRoot.clear();
    this.items.clear();
    this.disposeComposer();
    releaseShared();
    this.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // -------------------------------------------------------------------------------------------
  // Scene parts

  private setRoom(room: Room): void {
    if (this.roomObject) {
      this.scene.remove(this.roomObject);
      disposeRoomObject(this.roomObject);
    }
    this.room = room;
    this.roomObject = buildRoomObject(room);
    applyRoomLook(this.roomObject, this.roomTextures);
    this.scene.add(this.roomObject);
    this.placeSun(room);
    this.updateShadows();
    this.walkSpace = null;
  }

  private updateShadows(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  private removeItem(object: THREE.Group): void {
    this.itemsRoot.remove(object);
    disposeMerged(object);
  }

  private rebuildContactShadows(items: readonly Item[]): void {
    if (this.contact) {
      this.scene.remove(this.contact);
      disposeContactShadows(this.contact);
    }
    this.contact = buildContactShadows(items);
    this.scene.add(this.contact);
  }

  /**
   * Puts the sun high over the north-west of the room with its shadow box tight around the room,
   * so the shadow map's texels go to the room and not to empty space.
   */
  private placeSun(room: Room): void {
    const b = bounds(room.points.length > 0 ? room.points : [{ x: 0, y: 0 }]);
    const cx = (b.minX + b.maxX) / 2 / MM_PER_UNIT;
    const cz = (b.minY + b.maxY) / 2 / MM_PER_UNIT;
    const radius = Math.max(1, Math.hypot(b.maxX - b.minX, b.maxY - b.minY, room.height) / 2 / MM_PER_UNIT);
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx - radius * 0.5, radius * 2, cz - radius * 0.35);
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

  private applyQuality(): void {
    const q = QUALITY[this.quality];
    const size = Math.min(q.shadowMap, this.renderer.capabilities.maxTextureSize);
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      // A new size needs a new map; three creates it on the next render.
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.updateShadows();
    }
    this.disposeComposer();
    if (!q.ao) return;
    const { width, height } = this.size();
    const ratio = this.renderer.getPixelRatio();
    this.post = new PostChain(this.renderer, this.scene, this.camera, Math.floor(width * ratio), Math.floor(height * ratio), true);
  }

  /** Resizes the post-processing buffers to the canvas (CSS pixels, at the renderer's ratio). */
  private resizeComposer(width: number, height: number): void {
    const ratio = this.renderer.getPixelRatio();
    this.post?.setSize(Math.floor(width * ratio), Math.floor(height * ratio));
  }

  private disposeComposer(): void {
    this.post?.dispose();
    this.post = null;
  }

  // -------------------------------------------------------------------------------------------
  // Camera

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
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.sceneRadius = sphere.radius;
    // Zooming out stops well past the whole kitchen; the far plane covers that.
    this.controls.maxDistance = sphere.radius * 8;
    this.persp.far = this.ortho.far = sphere.radius * 20;
    this.persp.updateProjectionMatrix();
    return box;
  }

  private viewFor(dir: THREE.Vector3, box: THREE.Box3, margin = FIT_MARGIN): View {
    const vFov = THREE.MathUtils.degToRad(FOV);
    const aspect = this.persp.aspect;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    return {
      target: sphere.center.clone(),
      dir: dir.clone().normalize(),
      distance: fitDistance(sphere.radius, vFov, aspect, margin),
      half: orthoHalfHeightForBox(box, dir, aspect, margin),
    };
  }

  private currentView(): View {
    const target = this.controls.target.clone();
    const offset = this.camera.position.clone().sub(target);
    const dist = Math.max(offset.length(), 1e-6);
    const vFov = THREE.MathUtils.degToRad(FOV);
    const half = this.isOrtho() ? this.orthoHalf / this.ortho.zoom : halfHeightAt(dist, vFov);
    return { target, dir: offset.divideScalar(dist), distance: this.isOrtho() ? distanceFor(half, vFov) : dist, half };
  }

  private jumpTo(v: View): void {
    this.cancelMove();
    this.applyView(v);
  }

  private applyView(v: View): void {
    this.controls.target.copy(v.target);
    if (this.isOrtho()) {
      this.orthoHalf = v.half;
      this.ortho.zoom = 1;
      this.updateOrthoFrustum();
      // Far enough back that nothing of the kitchen is behind the near plane.
      this.ortho.position.copy(v.target).addScaledVector(v.dir, this.sceneRadius * 4);
    } else {
      this.persp.position.copy(v.target).addScaledVector(v.dir, v.distance);
    }
    this.camera.up.set(0, 1, 0);
    this.controls.update();
    this.requestRender();
  }

  /** A short eased move to a view; jumps when the user prefers reduced motion. */
  private moveTo(to: View, animate: boolean): void {
    this.cancelMove();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduced) return this.applyView(to);
    const from = this.currentView();
    const step = (now: number) => {
      if (!this.anim) return;
      const t = Math.min(1, (now - this.anim.start) / MOVE_MS);
      const k = easeInOut(t);
      this.applyView({
        target: from.target.clone().lerp(to.target, k),
        dir: slerpDirection(from.dir, to.dir, k),
        // Distances interpolate in log space, so zooming feels even at every scale.
        distance: Math.exp(THREE.MathUtils.lerp(Math.log(from.distance), Math.log(to.distance), k)),
        half: Math.exp(THREE.MathUtils.lerp(Math.log(from.half), Math.log(to.half), k)),
      });
      if (t < 1) {
        // `requestRender` stands aside while a move runs; the move draws its own frames.
        this.draw();
        this.anim.frame = requestAnimationFrame(step);
      } else {
        // The last frame goes the usual way, so it is the one the page keeps.
        this.anim = null;
        this.requestRender();
      }
    };
    this.anim = { from, to, start: performance.now(), frame: requestAnimationFrame(step) };
  }

  private cancelMove(): void {
    if (!this.anim) return;
    cancelAnimationFrame(this.anim.frame);
    this.anim = null;
  }

  /** Switches between perspective and orthographic, keeping the target and its scale. */
  private setProjection(ortho: boolean): void {
    if (ortho === this.isOrtho()) return;
    const v = this.currentView();
    this.camera = ortho ? this.ortho : this.persp;
    this.controls.object = this.camera;
    this.applyView(v);
    this.cb.onOrtho(ortho);
  }

  private updateOrthoFrustum(): void {
    const aspect = this.persp.aspect;
    this.ortho.left = -this.orthoHalf * aspect;
    this.ortho.right = this.orthoHalf * aspect;
    this.ortho.top = this.orthoHalf;
    this.ortho.bottom = -this.orthoHalf;
    this.ortho.updateProjectionMatrix();
  }

  // -------------------------------------------------------------------------------------------
  // Selection and hover outlines

  private clearOverlays(): void {
    for (const { object } of this.items.values()) {
      if (!object.userData.highlighted) continue;
      setItemHighlight(object, false);
      object.userData.highlighted = false;
    }
    this.overlayRoot.clear();
  }

  /** Neutral box edges along each selected item (turned with it), fainter ones on the hovered item. */
  private updateOverlays(): void {
    this.clearOverlays();
    for (const id of this.selection) {
      const known = this.items.get(id);
      if (!known) continue;
      setItemHighlight(known.object, true);
      known.object.userData.highlighted = true;
      this.addOutline(known.object, this.selectedLine);
      this.addOutline(known.object, this.selectedHidden);
    }
    if (this.hover && !this.selection.includes(this.hover)) {
      const known = this.items.get(this.hover);
      if (known) this.addOutline(known.object, this.hoverLine);
    }
  }

  private addOutline(object: THREE.Group, mat: THREE.LineBasicMaterial): void {
    const box = object.userData.localBox as THREE.Box3 | undefined;
    if (!box || box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()).addScalar(OUTLINE_PAD * 2);
    const centre = box.getCenter(new THREE.Vector3());
    const line = new THREE.LineSegments(this.outlineBox, mat);
    line.matrixAutoUpdate = false;
    line.matrix.compose(centre, new THREE.Quaternion(), size).premultiply(object.matrixWorld);
    line.raycast = () => {};
    this.overlayRoot.add(line);
  }

  private setHover(id: string | null): void {
    if (id === this.hover) return;
    this.hover = id;
    this.root.classList.toggle("is-hover", id !== null);
    this.updateOverlays();
    this.requestRender();
  }

  // -------------------------------------------------------------------------------------------
  // Pointer

  private pickAt(clientX: number, clientY: number): { id: string; point: THREE.Vector3 } | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const plane = this.renderer.clippingPlanes[0];
    for (const h of this.raycaster.intersectObjects(this.itemsRoot.children, true)) {
      // Parts cut away by the section are not there to click.
      if (plane && plane.distanceToPoint(h.point) < 0) continue;
      const id = itemIdOf(h.object);
      if (id) return { id, point: h.point };
    }
    return null;
  }

  private ndc(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  }

  private onPointerDown(e: PointerEvent): void {
    this.cancelMove();
    this.root.focus({ preventScroll: true });
    this.down = { x: e.clientX, y: e.clientY, button: e.button };
    if (e.button !== 0) return;
    const canvas = this.renderer.domElement;
    if (this.walk) {
      this.walkLook = { x: e.clientX, y: e.clientY, moved: false };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (this.mode !== "arrange" || e.shiftKey || e.ctrlKey || e.metaKey) return;
    if (!canStartItemDrag()) return;
    const hit = this.pickAt(e.clientX, e.clientY);
    if (!hit) return;
    // The press is on an item: a drag moves it (and the other selected ones), not the camera.
    this.controls.enabled = false;
    const st = useStore.getState();
    const ids = st.selection.items.includes(hit.id) ? [...st.selection.items] : [hit.id];
    if (!st.selection.items.includes(hit.id)) st.select({ items: ids, opening: null });
    this.drag = {
      // A file command in the middle ends the drag; the engine lets go of it then.
      session: new ItemDragSession(ids, () => this.releaseDrag()),
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -hit.point.y),
      start: hit.point.clone(),
      clickId: hit.id,
    };
    canvas.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    const moved = this.down !== null && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > CLICK_TOLERANCE;
    if (this.walkLook && this.walk) {
      this.walk = look(this.walk, e.clientX - this.walkLook.x, e.clientY - this.walkLook.y);
      this.walkLook = { x: e.clientX, y: e.clientY, moved: this.walkLook.moved || moved };
      this.applyWalkCamera();
      this.requestRender();
      return;
    }
    const d = this.drag;
    if (d) {
      if (!d.session.moved && !moved) return;
      this.raycaster.setFromCamera(this.ndc(e.clientX, e.clientY), this.camera);
      const p = this.raycaster.ray.intersectPlane(d.plane, new THREE.Vector3());
      if (!p) return;
      const delta = { x: (p.x - d.start.x) * MM_PER_UNIT, y: (p.z - d.start.z) * MM_PER_UNIT };
      if (!d.session.move(delta, e.altKey)) return this.releaseDrag();
      this.root.classList.add("is-dragging");
      return;
    }
    // Orbiting out of a numpad view goes back to perspective, as in Blender.
    if (moved && this.autoOrtho && this.down?.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      this.autoOrtho = false;
      this.setProjection(false);
    }
    if (e.buttons === 0) this.scheduleHover(e.clientX, e.clientY);
  }

  private scheduleHover(x: number, y: number): void {
    this.lastPointer = { x, y };
    if (this.hoverFrame || this.mode !== "arrange" || this.walk) return;
    // One pick per frame at most, however fast the pointer moves.
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      const p = this.lastPointer;
      if (!p || !this.pointerInside) return;
      this.setHover(this.pickAt(p.x, p.y)?.id ?? null);
    });
  }

  private onPointerUp(e: PointerEvent): void {
    const start = this.down;
    this.down = null;
    const click = !!start && start.button === 0 && e.button === 0 && Math.hypot(e.clientX - start.x, e.clientY - start.y) <= CLICK_TOLERANCE;
    if (this.walkLook) {
      this.walkLook = null;
      if (click) this.clickPick(e);
      return;
    }
    const d = this.drag;
    if (d) {
      const moved = d.session.moved;
      this.releaseDrag();
      if (moved) d.session.confirm();
      // A click on one of several selected items selects it alone.
      else if (click) useStore.getState().select({ items: [d.clickId], opening: null });
      return;
    }
    if (click) this.clickPick(e);
  }

  /** Lets go of a drag without ending its session (the caller ends it). */
  private releaseDrag(): void {
    if (!this.drag) return;
    this.drag = null;
    this.controls.enabled = true;
    this.root.classList.remove("is-dragging");
  }

  /** Cancels a running drag: the items go back to where they were, no undo step. */
  private cancelDrag(): void {
    const d = this.drag;
    if (!d) return;
    this.releaseDrag();
    d.session.cancel();
  }

  /** Selects the clicked item: alone, or toggled into the selection with Shift or Ctrl. */
  private clickPick(e: PointerEvent): void {
    // In the room mode the 3D view only shows; items are not selectable there. Nor in the middle
    // of an operator in the plan: it works on the selection it started with.
    if (this.mode !== "arrange" || useStore.getState().isGestureActive()) return;
    const id = this.pickAt(e.clientX, e.clientY)?.id ?? null;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const { selection, select } = useStore.getState();
    if (!id) {
      if (!additive) select({ items: [], opening: null });
      return;
    }
    if (!additive) return select({ items: [id], opening: null });
    const has = selection.items.includes(id);
    select({ items: has ? selection.items.filter((i) => i !== id) : [...selection.items, id], opening: null });
  }

  /** Double click on an item: the camera moves to it and orbits around it from then on. */
  private onDoubleClick(e: MouseEvent): void {
    if (this.walk) return;
    const hit = this.pickAt(e.clientX, e.clientY);
    const known = hit && this.items.get(hit.id);
    if (!known) return;
    this.moveTo(this.viewFor(this.currentView().dir, new THREE.Box3().setFromObject(known.object), FOCUS_MARGIN), true);
  }

  // -------------------------------------------------------------------------------------------
  // Keys

  private keysActive(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return false;
    // Nothing behind an open dialog or menu.
    if (document.querySelector("[role=menu], [role=dialog]")) return false;
    if (this.pointerInside) return true;
    // With the pointer elsewhere, a click into the view no longer claims the keys (1 switches
    // the layout over the plan again); keyboard focus on the view's controls and walking do.
    const active = document.activeElement;
    return !!active && this.root.contains(active) && (active !== this.root || this.walk !== null);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const consume = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    // Escape cancels a drag wherever the pointer went meanwhile; the view's own keys wait until it ends.
    if (this.drag) {
      if (e.key === "Escape") {
        consume();
        this.cancelDrag();
      }
      return;
    }
    if (!this.keysActive(e)) return;
    if (this.walk) {
      if (e.key === "Escape") {
        consume();
        this.leaveWalk(true);
        return;
      }
      this.running = e.shiftKey;
      if (isWalkKey(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        consume();
        this.held.add(e.code);
        if (!this.walkFrame) {
          this.lastStep = 0;
          this.walkFrame = requestAnimationFrame(this.walkLoop);
        }
        return;
      }
    }
    // A running operator (G, R) takes typed numbers as values; the view keeps out of its way.
    if (useStore.getState().status !== null) return;
    const action = viewKeyAction(e);
    if (!action) return;
    consume();
    if (e.repeat) return;
    switch (action.kind) {
      case "view":
        return this.preset(action.view);
      case "toggleOrtho":
        return this.toggleOrtho();
      case "frameSelection":
        return this.mode === "arrange" ? this.frameSelection() : this.fit();
      case "frameAll":
        return this.fit();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.held.delete(e.code);
    this.running = e.shiftKey;
  }

  // -------------------------------------------------------------------------------------------
  // Frame

  private readTheme(): void {
    this.background = cssColor(this.host, "--bg-canvas") ?? new THREE.Color(FALLBACK_BACKGROUND);
    this.scene.background = this.background;
    const outline = cssColor(this.host, "--draw-outline-3d") ?? new THREE.Color(FALLBACK_OUTLINE);
    for (const m of [this.selectedLine, this.selectedHidden, this.hoverLine]) m.color.copy(outline);
    this.requestRender();
  }

  private size(): { width: number; height: number } {
    return { width: Math.max(1, this.host.clientWidth), height: Math.max(1, this.host.clientHeight) };
  }

  private resize(): void {
    const { width, height } = this.size();
    this.renderer.setSize(width, height, false);
    this.resizeComposer(width, height);
    this.persp.aspect = width / height;
    this.persp.updateProjectionMatrix();
    this.updateOrthoFrustum();
    this.requestRender();
  }

  private requestRender(): void {
    // A running camera move or walk draws every frame anyway; the walk loop may stop before its
    // next frame, so it is told to draw this one in any case.
    if (this.walkFrame) {
      this.walkPending = true;
      return;
    }
    this.walkPending = false;
    if (this.frame || this.anim) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private draw(): void {
    if (this.lost) return;
    if (this.roomObject) applyCutaway(this.roomObject, this.camera.position, this.cutaway);
    this.camera.updateMatrixWorld();
    this.updateCube();
    if (this.post) {
      this.post.render(this.camera, this.background);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Turns the view cube like the world as the camera sees it: each face gets a 2D transform
   * (`viewCube.ts`), the faces turned away are hidden. `data-turn` tells tests the camera's turn.
   */
  private updateCube(): void {
    const cube = this.cube;
    if (!cube) return;
    const faces = cubeFaces(this.camera.quaternion);
    const key = CUBE_FACE_NAMES.map((f) => (faces[f].visible ? faces[f].transform : "")).join(";");
    if (key === this.cubeTransform) return;
    this.cubeTransform = key;
    for (const el of cube.querySelectorAll<HTMLElement>("[data-face]")) {
      const face = faces[el.dataset.face as CubeFace];
      if (!face) continue;
      el.style.transform = face.transform;
      el.style.visibility = face.visible ? "visible" : "hidden";
    }
    cube.dataset.turn = key;
  }

  private listen(target: THREE.EventDispatcher<{ change: object }>, type: "change", f: () => void): void {
    target.addEventListener(type, f);
    this.cleanup.push(() => target.removeEventListener(type, f));
  }

  /** Adds a DOM listener removed on dispose; WebGL context events are not in the typed map. */
  private listenDom<E extends Event>(el: EventTarget, type: string, f: (e: E) => void, capture = false): void {
    const l = f as EventListener;
    el.addEventListener(type, l, capture);
    this.cleanup.push(() => el.removeEventListener(type, l, capture));
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
