// Benchmark of the 3D view and the catalog thumbnails, in Chromium driven by Playwright (the copy
// in website/node_modules). Prints a table; numbers are from this machine and its graphics.
//
//   node scripts/bench-3d.mjs                 # both parts, 3 runs each
//   node scripts/bench-3d.mjs --part=3d --runs=5
//   node scripts/bench-3d.mjs --part=thumbs
//   node scripts/bench-3d.mjs --write=<dir>   # also writes the stress projects as .kplan
//   node scripts/bench-3d.mjs --ui=<dir>      # another copy of ui/ (e.g. \`git archive\` of an
//                                             # older commit, node_modules linked), for a before
//
// 3D: the UI's dev server on its own port; the stress projects of 300 and 500 items
// (ui/src/three/stress.ts) are loaded into the store, and the engine's timing hook (`__view3d`,
// development builds only) draws frames back to back, with and without the shadow pass.
//
// Thumbnails: a production build, served by `vite preview`, opened twice with the same browser
// profile: the first start renders, the second finds what the first one kept. Measured from the
// page's own timeline: long tasks (main-thread work over 50 ms, the hitches) in the first 10 s,
// the time until every catalog row on screen shows its image, and the images rendered.

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const require = createRequire(join(root, "website", "package.json"));
const { chromium } = require("playwright");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const part = args.part ?? "all";
// Another copy of the UI to measure (an older commit for a before/after), with its node_modules.
const ui = args.ui ? resolve(args.ui) : join(root, "ui");
const runs = Number(args.runs ?? 3);
const sizes = (args.items ?? "300,500").split(",").map(Number);
const PORT = Number(args.port ?? 14917);
const OBSERVE_MS = 10_000;
// Real graphics in headless Chromium; without these it falls back to software rendering.
const GPU_ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "win32" ? ["--use-angle=d3d11"] : [])];
const VIEWPORT = { width: 1600, height: 1000 };

/**
 * The Chromium to drive: `--chromium=<path>`, else Playwright's own when its version is
 * installed, else the newest one in Playwright's browser folder (the website's Playwright may be
 * a version behind the browsers installed by another project).
 */
function chromiumPath() {
  if (args.chromium) return args.chromium;
  if (existsSync(chromium.executablePath())) return undefined;
  const dir =
    process.env.PLAYWRIGHT_BROWSERS_PATH ??
    (process.platform === "win32" ? join(process.env.LOCALAPPDATA ?? "", "ms-playwright") : process.platform === "darwin" ? join(homedir(), "Library", "Caches", "ms-playwright") : join(homedir(), ".cache", "ms-playwright"));
  const builds = existsSync(dir) ? readdirSync(dir).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1])) : [];
  for (const b of builds) {
    for (const exe of ["chrome-win64/chrome.exe", "chrome-win/chrome.exe", "chrome-linux64/chrome", "chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
      if (existsSync(join(dir, b, exe))) return join(dir, b, exe);
    }
  }
  return undefined;
}
const LAUNCH = { args: GPU_ARGS, executablePath: chromiumPath() };

const vite = join(ui, "node_modules", "vite", "bin", "vite.js");

function serve(argv) {
  const child = spawn(process.execPath, [vite, ...argv, "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { cwd: ui, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((ok, fail) => {
    let out = "";
    const onData = (d) => {
      // The port is printed in bold: compare without the colour codes.
      out += String(d).replace(/\[[0-9;]*m/g, "");
      if (out.includes(`127.0.0.1:${PORT}`)) ok(child);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => fail(new Error(`vite exited (${code}):\n${out}`)));
  });
}

function run(cmd, argv, cwd) {
  return new Promise((ok, fail) => {
    const child = spawn(cmd, argv, { cwd, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? ok() : fail(new Error(`${argv.join(" ")} failed (${code})`))));
  });
}

/** Stops a server this script started (its own PID only). */
function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.removeAllListeners("exit");
  child.kill();
}

const range = (xs, digits = 1) => {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return lo === hi ? lo.toFixed(digits) : `${lo.toFixed(digits)}–${hi.toFixed(digits)}`;
};

// ---------------------------------------------------------------------------------------------
// 3D

async function bench3d() {
  const browser = await chromium.launch(LAUNCH);
  const server = await serve([]).catch(async (e) => {
    await browser.close();
    throw e;
  });
  const rows = [];
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    const url = `http://127.0.0.1:${PORT}/`;
    await page.goto(url);
    const gpu = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown", multiDraw: !!gl?.getExtension("WEBGL_multi_draw") };
    });
    console.log(`GPU: ${gpu.renderer}; WEBGL_multi_draw: ${gpu.multiDraw}`);
    if (args.write) {
      mkdirSync(args.write, { recursive: true });
      for (const n of sizes) {
        const json = await page.evaluate(async (n) => {
          const { stressProject } = await import("/src/three/stress.ts");
          return JSON.stringify(stressProject(n), null, 2);
        }, n);
        writeFileSync(join(args.write, `stress-${n}.kplan`), json);
      }
    }
    for (const n of sizes) {
      const samples = [];
      for (let r = 0; r < runs; r++) {
        console.log(`3D: ${n} items, run ${r + 1} of ${runs}`);
        await page.goto(url);
        samples.push(
          await page.evaluate(async (n) => {
            const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
            const { useStore } = await import("/src/store/store.ts");
            const { stressProject } = await import("/src/three/stress.ts");
            useStore.getState().setLayout("3d");
            while (!window.__view3d) await frame();
            const engine = window.__view3d;
            const project = stressProject(n);
            const t0 = performance.now();
            useStore.getState().load(project, null);
            // The view takes the project in an effect after the next render, then builds in slices.
            while (engine.items.size < project.items.length || engine.pending.size > 0) await frame();
            const buildMs = performance.now() - t0;
            for (let i = 0; i < 5; i++) await frame();
            // Warm up once (programs compiled), then measure.
            engine.measure(10, true);
            const plain = engine.measure(120, false);
            const shadows = engine.measure(60, true);
            // The same view drawn by the items' own meshes instead of the batches (the drawing
            // before batch.ts), compared pixel by pixel.
            let diff = null;
            if (engine.batches) {
              const pixels = async (png) => {
                const bmp = await createImageBitmap(new Blob([png], { type: "image/png" }));
                const c = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d");
                c.drawImage(bmp, 0, 0);
                return c.getImageData(0, 0, bmp.width, bmp.height).data;
              };
              const own = (on) => {
                engine.batches.root.visible = !on;
                engine.itemsRoot.traverse((o) => {
                  if (o.isMesh && !(o.material.transparent)) o.visible = on;
                });
                engine.updateShadows();
              };
              const a = await pixels(await engine.capture(1200));
              own(true);
              const b = await pixels(await engine.capture(1200));
              own(false);
              let changed = 0;
              let max = 0;
              for (let i = 0; i < a.length; i += 4) {
                const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
                if (d > 0) changed++;
                max = Math.max(max, d);
              }
              diff = { changed: changed / (a.length / 4), max };
            }
            return { buildMs, plain, shadows, diff };
          }, n),
        );
      }
      rows.push({
        items: n,
        "build ms": range(samples.map((s) => s.buildMs), 0),
        "frame ms": range(samples.map((s) => s.plain.frameMs)),
        "cpu ms": range(samples.map((s) => s.plain.cpuMs)),
        calls: range(samples.map((s) => s.plain.calls), 0),
        "triangles k": range(samples.map((s) => s.plain.triangles / 1000), 0),
        "frame ms (shadows)": range(samples.map((s) => s.shadows.frameMs)),
        "calls (shadows)": range(samples.map((s) => s.shadows.calls), 0),
        ...(samples[0].diff ? { "pixels changed % (unbatched)": range(samples.map((s) => s.diff.changed * 100), 3), "max diff": range(samples.map((s) => s.diff.max), 0) } : {}),
      });
    }
  } finally {
    await browser.close();
    stop(server);
  }
  console.log(`\n3D view, ${runs} runs each (range):`);
  console.table(rows);
}

// ---------------------------------------------------------------------------------------------
// Thumbnails

/** Counts the images handed out by canvases and keeps the long tasks, from the first script on. */
function instrument() {
  window.__bench = { longtasks: [], encoded: 0, encodedAt: [] };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__bench.longtasks.push({ start: e.startTime, ms: e.duration });
  }).observe({ type: "longtask", buffered: true });
  const count = (proto, name) => {
    const f = proto?.[name];
    if (!f) return;
    proto[name] = function (...a) {
      window.__bench.encoded++;
      window.__bench.encodedAt.push(performance.now());
      return f.apply(this, a);
    };
  };
  count(HTMLCanvasElement.prototype, "toDataURL");
  count(HTMLCanvasElement.prototype, "toBlob");
  count(globalThis.OffscreenCanvas?.prototype, "convertToBlob");
}

async function startOnce(profile) {
  const context = await chromium.launchPersistentContext(profile, { ...LAUNCH, viewport: VIEWPORT });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.addInitScript(instrument);
    await page.goto(`http://127.0.0.1:${PORT}/`);
    return await page.evaluate(async (observeMs) => {
      const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
      let visibleReady = null;
      const end = performance.now() + observeMs;
      while (performance.now() < end) {
        if (visibleReady === null) {
          const scroller = document.querySelector(".sidebar-scroll");
          const box = scroller?.getBoundingClientRect();
          const rows = [...document.querySelectorAll(".cat-row")].filter((r) => {
            const b = r.getBoundingClientRect();
            return box && b.bottom > box.top && b.top < box.bottom && b.height > 0;
          });
          const ready = rows.length > 0 && rows.every((r) => r.querySelector(".cat-thumb img")?.complete);
          if (ready) visibleReady = performance.now();
        }
        await frame();
      }
      const lt = window.__bench.longtasks;
      const at = window.__bench.encodedAt;
      // Long tasks that drew a thumbnail; the others are the app's own start (and the 3D view).
      const thumbTasks = lt.filter((e) => at.some((t) => t >= e.start && t <= e.start + e.ms));
      return {
        thumbTasks: thumbTasks.length,
        thumbLongest: thumbTasks.reduce((m, e) => Math.max(m, e.ms), 0),
        visibleReady,
        longtasks: lt.length,
        longMs: lt.reduce((s, e) => s + e.ms, 0),
        longest: lt.reduce((m, e) => Math.max(m, e.ms), 0),
        encoded: window.__bench.encoded,
      };
    }, OBSERVE_MS);
  } finally {
    await context.close();
  }
}

async function benchThumbs() {
  const out = mkdtempSync(join(tmpdir(), "kp-bench-dist-"));
  await run(process.execPath, [vite, "build", "--outDir", out, "--emptyOutDir", "--logLevel", "warn"], ui);
  const server = await serve(["preview", "--outDir", out]);
  const rows = [];
  try {
    for (let r = 0; r < runs; r++) {
      const profile = mkdtempSync(join(tmpdir(), "kp-bench-profile-"));
      try {
        for (const start of ["first start", "second start"]) {
          const s = await startOnce(profile);
          rows.push({ start, "rows on screen ready ms": s.visibleReady?.toFixed(0) ?? "never", "long tasks": s.longtasks, "long task ms": s.longMs.toFixed(0), "longest ms": s.longest.toFixed(0), "of them drawing thumbnails": s.thumbTasks, "longest of those ms": s.thumbLongest.toFixed(0), "images rendered": s.encoded });
        }
      } finally {
        rmSync(profile, { recursive: true, force: true });
      }
    }
  } finally {
    stop(server);
    rmSync(out, { recursive: true, force: true });
  }
  console.log(`\nCatalog thumbnails, first ${OBSERVE_MS / 1000} s after opening the page:`);
  console.table(rows);
}

if (part === "all" || part === "3d") await bench3d();
if (part === "all" || part === "thumbs") await benchThumbs();
