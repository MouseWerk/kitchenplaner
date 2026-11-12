// Small 3D previews of catalog entries, rendered from the real item models (`buildItemObject`),
// merged as in the 3D view (`thumbnailModel`).
//
// One offscreen WebGL renderer draws them in idle slices and turns each into a PNG data URL,
// cached by catalog id, size and device pixel ratio. Only what is asked for is drawn: the hover
// preview first, then the rows on screen (and a few rows beyond its edges, CatalogPanel), then
// rows that scrolled away before their turn, those only when the main thread is really idle.
// A slice draws images while its time budget lasts (`SLICE_BUDGET_MS`, less when the browser
// says the frame has less left), so typing in the search field never waits for a batch.
//
// Rendered images are kept across sessions (thumbStore.ts): a later start of the same build
// shows them from the store and needs no renderer at all. A new renderer compiles the shaders of
// every shared material first, in parallel off the main thread where the browser can
// (KHR_parallel_shader_compile), so the first images do not stall on shader compilation.
//
// The look does not depend on the theme: the background is transparent, and the materials, the
// tone mapping and the lights are those of the 3D view (`LOOK` in look.ts), so a thumbnail looks
// like the unit in the room, one image serves the light and the dark sidebar and a theme switch
// costs nothing.
//
// The renderer holds a WebGL context (browsers allow only a handful per page, the 3D view needs
// one too). Thumbnails are cached, so the renderer is only needed while work is queued: it is
// disposed a few seconds after the queue runs dry and created again for the next request.
// Without WebGL every request ends as `unavailable` and the caller draws its own fallback. A
// render that throws (a lost context) costs the renderer, not the session: the next job starts
// a fresh one, and the entry is tried once more before it keeps the fallback.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { CatalogEntry } from "../kinds/registry";
import { itemFromCatalog } from "../model/project";
import { LOOK } from "./look";
import { disposeMerged, mergeItemObject } from "./merge";
import { buildItemObject, releaseShared, retainShared } from "./meshes";
import { getShared } from "./shared";
import { buildId, indexedDbStore, type ThumbStore } from "./thumbStore";

/** Direction from the model towards the camera: front right, above (a 3/4 isometric-ish view). */
const VIEW_AZIMUTH = THREE.MathUtils.degToRad(35);
const VIEW_ELEVATION = THREE.MathUtils.degToRad(26);
/** Empty border around the model, as a share of the image. */
const FIT_MARGIN = 0.08;
/** Key light (the 3D view's sun) relative to the model centre (metres): front left and high, so tops read light. */
const KEY_LIGHT_OFFSET = new THREE.Vector3(-1.2, 2.5, 1.8);
/** Disposes the renderer this long after the last job. */
const DISPOSE_AFTER_MS = 5000;
/** Idle callbacks wait at most this long, so a busy main thread still gets the rows on screen. */
const IDLE_TIMEOUT_MS = 60;
/** Most time one slice spends drawing (ms): a frame keeps room for the page's own work. */
const SLICE_BUDGET_MS = 8;
/** The kept images may take this long to load; a store that does not answer is skipped. */
const STORE_TIMEOUT_MS = 1500;
/** Renders of one thumbnail before it keeps the fallback. */
const MAX_ATTEMPTS = 2;

export type ThumbStatus = "loading" | "ready" | "unavailable";
export interface ThumbState {
  status: ThumbStatus;
  url: string | null;
}

/** Lower runs first. */
export const PRIORITY = { preview: 0, visible: 1, prefetch: 2 } as const;
export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

/** Turns one catalog entry into an image URL at the given pixel size; throws when it cannot. */
export type RenderFn = (entry: CatalogEntry, widthPx: number, heightPx: number) => string;
/**
 * Creates a renderer; throws when WebGL is unavailable. `prepare`, when there, readies it for
 * drawing without blocking (compiles its shaders); no image is drawn before it settles.
 */
export type RendererFactory = () => { render: RenderFn; dispose: () => void; prepare?: () => Promise<unknown> };

// ---------------------------------------------------------------------------------------------
// Framing

/** Unit vector from the target towards the camera. */
export function viewDirection(): THREE.Vector3 {
  const c = Math.cos(VIEW_ELEVATION);
  return new THREE.Vector3(Math.sin(VIEW_AZIMUTH) * c, Math.sin(VIEW_ELEVATION), Math.cos(VIEW_AZIMUTH) * c);
}

/**
 * Points an orthographic camera along `dir` at the box and sets its frustum so the box fills
 * an image of the given aspect (width / height) with `FIT_MARGIN` around it, centred.
 */
export function fitOrthoCamera(camera: THREE.OrthographicCamera, box: THREE.Box3, aspect: number, dir = viewDirection()): void {
  const centre = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
  camera.up.set(0, 1, 0);
  camera.position.copy(centre).addScaledVector(dir, radius * 4);
  camera.lookAt(centre);
  camera.updateMatrixWorld(true);

  // The box corners in camera space give the exact extent on screen.
  const inv = camera.matrixWorldInverse;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const p = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  let w = Math.max(maxX - minX, 1e-3);
  let h = Math.max(maxY - minY, 1e-3);
  // Widen the narrower side to the image aspect, then add the margin.
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  w /= 1 - 2 * FIT_MARGIN;
  h /= 1 - 2 * FIT_MARGIN;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  camera.left = cx - w / 2;
  camera.right = cx + w / 2;
  camera.top = cy + h / 2;
  camera.bottom = cy - h / 2;
  camera.near = 0.01;
  camera.far = radius * 8;
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------------------------
// The WebGL renderer

/**
 * The model of a catalog entry as the 3D view draws it: merged per material, with UVs in metres,
 * so the brushed grain has the size it has in the room instead of being stretched over each
 * panel. Its geometry is its own: dispose it with `disposeMerged`.
 */
export function thumbnailModel(entry: CatalogEntry): THREE.Group {
  return mergeItemObject(buildItemObject(itemFromCatalog(entry, 0, 0)));
}

/** The real renderer: one canvas with the studio environment and the lights of the 3D view. */
export const webglFactory: RendererFactory = () => {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  retainShared();
  r.setPixelRatio(1);
  r.setClearAlpha(0);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = LOOK.toneMapping;
  r.toneMappingExposure = LOOK.exposure;

  const scene = new THREE.Scene();
  // Steel needs something to reflect, as in the 3D view; prefiltered once per renderer.
  const pmrem = new THREE.PMREMGenerator(r);
  const studio = new RoomEnvironment();
  const environment = pmrem.fromScene(studio, LOOK.environmentBlur).texture;
  studio.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = LOOK.environmentIntensity;
  const hemi = new THREE.HemisphereLight(LOOK.hemiSky, LOOK.hemiGround, LOOK.hemiIntensity);
  const key = new THREE.DirectionalLight(0xffffff, LOOK.sunIntensity);
  scene.add(hemi, key);
  const camera = new THREE.OrthographicCamera();

  return {
    prepare() {
      // One small mesh per shared material, compiled against this scene (its lights and
      // environment), so the programs are those the models will use.
      const { box, mat } = getShared();
      const warm = new THREE.Group();
      for (const m of Object.values(mat)) warm.add(new THREE.Mesh(box, m));
      camera.position.set(0, 0, 5);
      camera.updateMatrixWorld();
      return r.compileAsync(warm, camera, scene);
    },
    render(entry, widthPx, heightPx) {
      const model = thumbnailModel(entry);
      scene.add(model);
      try {
        const box = new THREE.Box3().setFromObject(model);
        fitOrthoCamera(camera, box, widthPx / heightPx);
        // The key light sits at the same place relative to every unit: front left, above.
        const centre = box.getCenter(new THREE.Vector3());
        key.position.copy(centre).add(KEY_LIGHT_OFFSET);
        key.target.position.copy(centre);
        key.target.updateMatrixWorld();
        r.setSize(widthPx, heightPx, false);
        r.render(scene, camera);
        // Read back in the same task as the render: no preserveDrawingBuffer needed.
        return r.domElement.toDataURL("image/png");
      } finally {
        // The merged geometry is the model's own; the materials are shared and stay.
        scene.remove(model);
        disposeMerged(model);
      }
    },
    dispose() {
      environment.dispose();
      r.dispose();
      r.forceContextLoss();
      releaseShared();
    },
  };
};

// ---------------------------------------------------------------------------------------------
// Queue and cache

interface Job {
  key: string;
  entry: CatalogEntry;
  w: number;
  h: number;
  priority: Priority;
  /** Request order, so equal priorities run first come first served. */
  seq: number;
  /** Renders that threw so far. */
  failures: number;
}

type IdleHandle = { cancel: () => void };

/**
 * Runs `f` when the main thread is idle, with the time left in that idle period (ms); after
 * `timeout` at the latest when one is given, and then with no time left (one image only).
 */
function onIdle(f: (left: number) => void, timeout: number | null): IdleHandle {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback((d) => f(d.didTimeout ? 0 : d.timeRemaining()), timeout === null ? undefined : { timeout });
    return { cancel: () => cancelIdleCallback(id) };
  }
  const id = setTimeout(() => f(0), 0);
  return { cancel: () => clearTimeout(id) };
}

const LOADING: ThumbState = { status: "loading", url: null };
const UNAVAILABLE: ThumbState = { status: "unavailable", url: null };

/** Timings of the current batch (dev only), from the first request until the queue is empty. */
interface Stats {
  start: number;
  first: number | null;
  count: number;
  max: number;
  setup: number;
  /** Time until the renderer's shaders were compiled (off the main thread where possible). */
  prepare: number;
}

export class ThumbnailQueue {
  private readonly cache = new Map<string, ThumbState>();
  private readonly jobs = new Map<string, Job>();
  private readonly listeners = new Set<() => void>();
  /** Thumbnails drawn again after the page could not show them (`failed`). */
  private readonly redrawn = new Set<string>();
  private renderer: ReturnType<RendererFactory> | null = null;
  private unavailable = false;
  private idle: IdleHandle | null = null;
  private disposeTimer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private stats: Stats | null = null;
  /** The renderer's `prepare` while it runs: no image is drawn until it settles. */
  private preparing: Promise<void> | null = null;
  /** The store's images while they load: nothing is rendered that the store may have. */
  private loading: Promise<void> | null = null;
  private loaded = false;
  /** Running mean of the time per image (ms), to fit images into a slice's budget. */
  private renderMs = 4;

  constructor(
    private readonly factory: RendererFactory,
    private readonly log: ((msg: string) => void) | null = null,
    private readonly store: ThumbStore | null = null,
  ) {}

  static key(id: string, w: number, h: number, dpr: number): string {
    return `${id}@${w}x${h}@${dpr}`;
  }

  /** The cached state of a thumbnail; `loading` until it is rendered or found unavailable. */
  get(key: string): ThumbState {
    return this.cache.get(key) ?? (this.unavailable ? UNAVAILABLE : LOADING);
  }

  subscribe = (f: () => void): (() => void) => {
    this.listeners.add(f);
    return () => void this.listeners.delete(f);
  };

  /**
   * Asks for a thumbnail of `w` × `h` CSS pixels at `dpr`. A queued job moves up when asked again
   * with a higher priority; a cached or unavailable one does nothing.
   */
  request(entry: CatalogEntry, w: number, h: number, dpr: number, priority: Priority): string {
    const key = ThumbnailQueue.key(entry.id, w, h, dpr);
    if (this.cache.has(key) || this.unavailable) return key;
    const job = this.jobs.get(key);
    if (job) {
      if (priority < job.priority) {
        job.priority = priority;
        job.seq = this.seq++;
      }
    } else {
      this.jobs.set(key, { key, entry, w: Math.round(w * dpr), h: Math.round(h * dpr), priority, seq: this.seq++, failures: 0 });
      if (this.log && !this.stats) this.stats = { start: performance.now(), first: null, count: 0, max: 0, setup: 0, prepare: 0 };
    }
    this.load();
    this.schedule();
    return key;
  }

  /** Loads the kept images, once, on the first request; until then nothing is rendered. */
  private load(): void {
    if (this.loaded || this.loading || !this.store) return;
    const none = new Map<string, Blob>();
    const loading: Promise<void> = Promise.race([
      this.store.load().catch(() => none),
      new Promise<Map<string, Blob>>((ok) => setTimeout(() => ok(none), STORE_TIMEOUT_MS)),
    ]).then((images) => {
        // Reset meanwhile (tests): the images belong to a queue that is gone.
        if (this.loading !== loading) return;
        for (const [key, blob] of images) {
          if (this.cache.has(key)) continue;
          this.cache.set(key, { status: "ready", url: URL.createObjectURL(blob) });
          this.jobs.delete(key);
        }
        this.loading = null;
        this.loaded = true;
        if (images.size > 0) this.emit();
        this.schedule();
      });
    this.loading = loading;
  }

  /**
   * Called when a request is no longer wanted: a row that scrolled out of view goes back to
   * prefetch, a hover preview that closed before it was drawn is dropped.
   */
  demote(key: string): void {
    const job = this.jobs.get(key);
    if (!job) return;
    if (job.priority === PRIORITY.preview) this.jobs.delete(key);
    else job.priority = PRIORITY.prefetch;
  }

  /** Runs one job now (tests and the idle slice). Returns false when there was nothing to do. */
  step(): boolean {
    const job = this.next();
    if (!job || this.unavailable || this.loading || this.preparing) return false;
    if (!this.renderer) {
      // Creating the context and prefiltering the environment is a slice of its own, so no
      // single slice grows into a long task.
      const t0 = performance.now();
      let renderer: ReturnType<RendererFactory>;
      try {
        renderer = this.factory();
      } catch {
        this.unavailable = true;
        this.jobs.clear();
        this.emit();
        return false;
      }
      this.renderer = renderer;
      if (this.stats) this.stats.setup = performance.now() - t0;
      if (renderer.prepare) {
        const p0 = performance.now();
        const done = (): void => {
          // A renderer dropped meanwhile (reset, a lost context) has nothing to wait for.
          if (this.preparing !== preparing) return;
          this.preparing = null;
          if (this.stats) this.stats.prepare = performance.now() - p0;
          this.schedule();
        };
        // A compile that fails shows up as a failed render and is handled there.
        const preparing: Promise<void> = Promise.resolve()
          .then(() => renderer.prepare!())
          .then(done, done);
        this.preparing = preparing;
      }
      return true;
    }
    this.jobs.delete(job.key);
    const t0 = performance.now();
    let state: ThumbState;
    try {
      const url = this.renderer.render(job.entry, job.w, job.h);
      state = { status: "ready", url };
      this.store?.save(job.key, url);
    } catch {
      // Most likely the context is gone: the renderer goes with it, the next job starts a fresh
      // one. The entry gets one more try; a model that fails again keeps the fallback.
      const broken = this.renderer;
      this.renderer = null;
      try {
        broken.dispose();
      } catch {
        // A lost context may fail to dispose; it is dropped either way.
      }
      job.failures++;
      if (job.failures < MAX_ATTEMPTS) {
        this.jobs.set(job.key, job);
        return true;
      }
      state = UNAVAILABLE;
    }
    this.cache.set(job.key, state);
    const ms = performance.now() - t0;
    this.renderMs = this.renderMs * 0.8 + ms * 0.2;
    if (this.stats) {
      this.stats.count++;
      this.stats.max = Math.max(this.stats.max, ms);
      this.stats.first ??= performance.now() - this.stats.start;
    }
    this.emit();
    return true;
  }

  /**
   * The page could not show a thumbnail (a kept image that does not decode): it is forgotten,
   * in the store as well, and drawn again once. Failing again, it keeps the fallback.
   */
  failed(entry: CatalogEntry, w: number, h: number, dpr: number, priority: Priority): void {
    const key = ThumbnailQueue.key(entry.id, w, h, dpr);
    const state = this.cache.get(key);
    if (state?.status !== "ready") return;
    if (state.url?.startsWith("blob:")) URL.revokeObjectURL(state.url);
    this.store?.drop?.(key);
    if (this.redrawn.has(key)) {
      this.cache.set(key, UNAVAILABLE);
      this.emit();
      return;
    }
    this.redrawn.add(key);
    this.cache.delete(key);
    this.emit();
    this.request(entry, w, h, dpr, priority);
  }

  /** Disposes the renderer and forgets everything (tests). */
  reset(): void {
    this.idle?.cancel();
    this.idle = null;
    if (this.disposeTimer) clearTimeout(this.disposeTimer);
    this.disposeTimer = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.preparing = null;
    for (const s of this.cache.values()) if (s.url?.startsWith("blob:")) URL.revokeObjectURL(s.url);
    this.cache.clear();
    this.jobs.clear();
    this.redrawn.clear();
    this.unavailable = false;
    this.stats = null;
    this.loading = null;
    this.loaded = false;
  }

  get hasRenderer(): boolean {
    return this.renderer !== null;
  }

  get pending(): number {
    return this.jobs.size;
  }

  private next(): Job | null {
    let best: Job | null = null;
    for (const j of this.jobs.values()) {
      if (!best || j.priority < best.priority || (j.priority === best.priority && j.seq < best.seq)) best = j;
    }
    return best;
  }

  private schedule(): void {
    if (this.disposeTimer) {
      clearTimeout(this.disposeTimer);
      this.disposeTimer = null;
    }
    if (this.idle || this.loading || this.preparing) return;
    if (this.jobs.size === 0) {
      this.drained();
      return;
    }
    // Rows that scrolled away wait for a truly idle main thread; what is on screen does not.
    const urgent = this.next()!.priority < PRIORITY.prefetch;
    this.idle = onIdle(
      (left) => {
        this.idle = null;
        const start = performance.now();
        const budget = Math.min(SLICE_BUDGET_MS, left);
        // One step at least, then more images while the next one is likely to fit the budget.
        // Creating a renderer ends the slice: that is a slice of its own.
        for (;;) {
          const creates = this.renderer === null;
          if (!this.step() || creates || this.jobs.size === 0 || performance.now() - start + this.renderMs >= budget) break;
        }
        this.schedule();
      },
      urgent ? IDLE_TIMEOUT_MS : null,
    );
  }

  private drained(): void {
    const s = this.stats;
    // A single hover preview is not worth a line.
    if (s && this.log && s.count > 1) {
      const total = performance.now() - s.start;
      this.log(
        `catalog thumbnails: ${s.count} rendered in ${total.toFixed(0)} ms (renderer setup ${s.setup.toFixed(1)} ms, ` +
          `shaders ready after ${s.prepare.toFixed(0)} ms, first ready after ${(s.first ?? 0).toFixed(0)} ms, slowest ${s.max.toFixed(1)} ms)`,
      );
    }
    this.stats = null;
    if (this.renderer) {
      this.disposeTimer = setTimeout(() => {
        this.disposeTimer = null;
        this.renderer?.dispose();
        this.renderer = null;
      }, DISPOSE_AFTER_MS);
    }
  }

  private emit(): void {
    for (const f of this.listeners) f();
  }
}

/** The app's queue. Timings are logged in development builds only; images are kept in the others. */
export const thumbnails = new ThumbnailQueue(
  webglFactory,
  import.meta.env.DEV ? (m) => console.info(m) : null,
  (() => {
    const build = buildId(import.meta.env.DEV, import.meta.url);
    return build === null ? null : indexedDbStore(build);
  })(),
);

/**
 * Thumbnail of `entry` at `w` × `h` CSS pixels; requested while `priority` is not null.
 * `onError` goes on the `<img>`: an image that does not load is drawn again once.
 */
export function useThumbnail(entry: CatalogEntry, w: number, h: number, priority: Priority | null): ThumbState & { onError: () => void } {
  const dpr = useDevicePixelRatio();
  const key = ThumbnailQueue.key(entry.id, w, h, dpr);
  const state = useSyncExternalStore(thumbnails.subscribe, () => thumbnails.get(key));
  useEffect(() => {
    if (priority === null) return;
    thumbnails.request(entry, w, h, dpr, priority);
    return () => thumbnails.demote(key);
  }, [entry, w, h, dpr, priority, key]);
  const onError = useCallback(() => thumbnails.failed(entry, w, h, dpr, priority ?? PRIORITY.visible), [entry, w, h, dpr, priority]);
  return { ...state, onError };
}

function currentDpr(): number {
  // Rounded to quarter steps so a zoom of 1.0000001 does not miss the cache.
  return Math.max(1, Math.round((typeof window === "undefined" ? 1 : window.devicePixelRatio || 1) * 4) / 4);
}

/** The device pixel ratio, updated when the window moves to another screen or zooms. */
function useDevicePixelRatio(): number {
  return useSyncExternalStore(subscribeDpr, currentDpr);
}

function subscribeDpr(f: () => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  let mq: MediaQueryList | null = null;
  const watch = () => {
    mq?.removeEventListener("change", onChange);
    mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mq.addEventListener("change", onChange);
  };
  const onChange = () => {
    watch();
    f();
  };
  watch();
  return () => mq?.removeEventListener("change", onChange);
}
