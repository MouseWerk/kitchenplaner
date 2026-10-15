// Starts the real Kitchenplaner binary under tauri-driver and returns a WebdriverIO session. Every
// launch gets fresh, isolated data: its own app data folder (recent files, autosave backups), its
// own WebView storage (settings) and its own folder for the files a test saves and exports. A
// test of what survives a restart ends a run with `crash()` and starts the next one on the same
// folders with `launch({ reuse })`.
//
// The binary must be a debug build with the UI embedded (`npm --prefix ui run build`, then
// `cargo build -p kitchenplaner --features custom-protocol`); its path comes from
// KITCHENPLANER_APP. The app runs with KITCHENPLANER_E2E=1, which turns on the test hooks of
// debug builds (src-tauri/src/lib.rs, ui/src/lib/platform.ts): file dialogs take the path from
// `window.__E2E_NEXT_PATH__`, yes/no questions the answer from `window.__E2E_NEXT_ANSWER__`, and
// console errors and warnings are recorded in `window.__E2E_ERRORS__` / `__E2E_WARNINGS__`.

import { execFileSync, execSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { Key, remote } from "webdriverio";

export { Key };

const ROOT = path.resolve(import.meta.dirname, "../..");
const WINDOWS = process.platform === "win32";
export const APP = path.resolve(process.env.KITCHENPLANER_APP ?? path.join(ROOT, "target", "debug", WINDOWS ? "kitchenplaner.exe" : "kitchenplaner"));
export const SHOTS = process.env.KITCHENPLANER_SHOTS ?? path.join(ROOT, "e2e", "screenshots");
/** A private X display for this run (Linux). */
const DISPLAY = process.env.DISPLAY ?? ":99";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Starts Xvfb on DISPLAY unless a server answers there; stopped (by its PID) when the run ends. */
let xvfbChecked = false;
function ensureXvfb() {
  if (WINDOWS || process.platform === "darwin" || xvfbChecked) return;
  xvfbChecked = true;
  try {
    execSync(`xdpyinfo -display ${DISPLAY}`, { stdio: "ignore" });
    return;
  } catch {
    /* no server yet */
  }
  // Wide enough for the 1920 px layout guard.
  const x = spawn("Xvfb", [DISPLAY, "-screen", "0", "2560x1440x24", "-nolisten", "tcp"], { stdio: "ignore", detached: true });
  x.unref();
  process.on("exit", () => {
    try {
      process.kill(x.pid);
    } catch {
      /* gone */
    }
  });
  const until = Date.now() + 10000;
  for (;;) {
    try {
      execSync(`xdpyinfo -display ${DISPLAY}`, { stdio: "ignore" });
      return;
    } catch {
      if (Date.now() > until) throw new Error(`Xvfb did not start on ${DISPLAY}`);
      execSync("sleep 0.1");
    }
  }
}

/** Whether nothing listens on `port` (another run's driver may share the machine). */
const portFree = (port) =>
  new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, "127.0.0.1", () => srv.close(() => resolve(true)));
  });

/** A random port for tauri-driver whose native port (+1000) is free as well. */
async function driverPort() {
  for (let i = 0; i < 50; i++) {
    const port = 4444 + Math.floor(Math.random() * 500);
    if ((await portFree(port)) && (await portFree(port + 1000))) return port;
  }
  throw new Error("no free port for tauri-driver");
}

async function waitForDriver(port, driver, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (driver.exitCode !== null) throw new Error(`tauri-driver exited with ${driver.exitCode}`);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/status`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  throw new Error(`tauri-driver did not answer on port ${port}`);
}

/**
 * Ends a process we started and everything it started (tauri-driver starts the native driver, which
 * starts the app). SIGKILL leaves the app no chance to clean up, as in a crash.
 */
function killTree(child, signal = "SIGTERM") {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (WINDOWS) execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-child.pid, signal);
  } catch {
    /* already gone */
  }
}

/** The environment of the app (inherited through tauri-driver and the native driver). */
function appEnv(dir) {
  ensureXvfb();
  return {
    ...process.env,
    KITCHENPLANER_E2E: "1",
    KITCHENPLANER_DATA_DIR: path.join(dir, "data"),
    // WebView storage (settings) per run. Windows: WebView2's user data folder; Linux: WebKitGTK's.
    WEBVIEW2_USER_DATA_FOLDER: path.join(dir, "webview"),
    ...(WINDOWS
      ? {}
      : {
          DISPLAY,
          XDG_DATA_HOME: path.join(dir, "xdg-data"),
          XDG_CACHE_HOME: path.join(dir, "xdg-cache"),
          XDG_CONFIG_HOME: path.join(dir, "xdg-config"),
          GDK_BACKEND: "x11",
          NO_AT_BRIDGE: "1",
          // Xvfb has no GPU: WebGL (3D view) through Mesa's software renderer, no DMA-BUF.
          LIBGL_ALWAYS_SOFTWARE: "1",
          WEBKIT_DISABLE_DMABUF_RENDERER: "1",
        }),
  };
}

/**
 * Starts the app. Returns helpers bound to its session; `close()` ends it and removes its folders.
 * `files` is an empty folder for the files the test saves, exports and opens. `reuse` is the `dir`
 * of an earlier run ended with `crash()`: the app starts again on its data, WebView storage and
 * files, as after a restart (the introduction was seen then, the language is already German).
 */
export async function launch({ width = 1440, height = 900, reuse = null } = {}) {
  if (!fs.existsSync(APP)) throw new Error(`app binary not found: ${APP} (build it, or set KITCHENPLANER_APP; see e2e/README.md)`);
  fs.mkdirSync(SHOTS, { recursive: true });
  if (reuse && !fs.existsSync(reuse)) throw new Error(`no earlier run in ${reuse}`);
  const dir = reuse ?? fs.mkdtempSync(path.join(os.tmpdir(), "kitchenplaner-e2e-"));
  const files = path.join(dir, "files");
  fs.mkdirSync(files, { recursive: true });
  const port = await driverPort();
  const args = ["--port", String(port), "--native-port", String(port + 1000)];
  // Windows: msedgedriver matching the installed WebView2 (e2e/README.md), from PATH or this variable.
  if (process.env.KITCHENPLANER_EDGEDRIVER) args.push("--native-driver", process.env.KITCHENPLANER_EDGEDRIVER);
  const driver = spawn("tauri-driver", args, { env: appEnv(dir), stdio: ["ignore", "ignore", "pipe"], detached: !WINDOWS });
  let driverErr = "";
  driver.stderr.on("data", (d) => (driverErr += d));
  let browser;
  try {
    await waitForDriver(port, driver);
    browser = await remote({
      hostname: "127.0.0.1",
      port,
      logLevel: "error",
      connectionRetryCount: 0,
      capabilities: { "wdio:enforceWebDriverClassic": true, "tauri:options": { application: APP } },
    });
  } catch (e) {
    killTree(driver);
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    throw new Error(`could not start the app: ${e.message}\n${driverErr}`);
  }

  const app = {
    browser,
    /** This run's folders; pass it as `reuse` to start again on them after `crash()`. */
    dir,
    files,
    /** A path in this run's file folder. */
    file: (name) => path.join(files, name),
    $: (sel) => browser.$(sel),
    $$: (sel) => browser.$$(sel),
    exec: (fn, ...a) => browser.execute(fn, ...a),

    async waitUntil(cond, message, timeout = 8000) {
      return browser.waitUntil(cond, { timeout, interval: 50, timeoutMsg: message });
    },
    /** Waits until `sel` is displayed and returns it. */
    async waitFor(sel, timeout = 8000) {
      const el = await browser.$(sel);
      await el.waitForDisplayed({ timeout, timeoutMsg: `${sel} not displayed after ${timeout} ms` });
      return el;
    },
    /** innerText via script (WebKit's getText() can be empty under user-select: none). */
    async textOf(el) {
      return (await browser.execute((e) => e.innerText, el)).trim();
    },
    /** A visible button whose text or accessible name contains `text`, inside `scope` (CSS). */
    async button(text, scope = "body") {
      const el = await browser.waitUntil(
        () =>
          browser.execute(
            (text, scope) => {
              const root = document.querySelector(scope);
              if (!root) return null;
              const all = [...root.querySelectorAll("button, [role^=menuitem]")];
              const shown = all.filter((b) => b.getClientRects().length > 0);
              const name = (b) => (b.getAttribute("aria-label") ?? "") + " " + b.innerText;
              return shown.find((b) => name(b).trim() === text || b.innerText.trim() === text) ?? shown.find((b) => name(b).includes(text)) ?? null;
            },
            text,
            scope,
          ),
        { timeout: 8000, interval: 50, timeoutMsg: `no button „${text}“ in ${scope}` },
      );
      return browser.$(el);
    },
    async click(text, scope) {
      const el = await app.button(text, scope);
      await el.waitForClickable({ timeout: 8000, timeoutMsg: `button „${text}“ not clickable` });
      await el.click();
      return el;
    },
    /** Opens the toolbar menu `menu` and chooses `entry`. */
    async menu(menu, entry) {
      await app.click(menu, "header");
      await app.click(entry, "[role=menu]");
    },
    /** The input of the inspector field labelled `label` (the first one with that label). */
    async field(label) {
      // A script returns a bare element reference; $() makes it a WebdriverIO element.
      const ref = await app.waitUntil(
        () =>
          browser.execute((label) => {
            const panel = document.querySelector("aside[aria-label='Eigenschaften']");
            const l = [...(panel?.querySelectorAll("label") ?? [])].find((x) => x.textContent.trim() === label);
            return (l && document.getElementById(l.htmlFor)) || null;
          }, label),
        `no inspector field „${label}“`,
      );
      return browser.$(ref);
    },
    async fieldValue(label) {
      return browser.execute((e) => e.value, await app.field(label));
    },
    /** Moves the keyboard focus out of every field, so shortcuts reach the app. */
    async blur() {
      await browser.execute(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    },
    async keys(k) {
      await browser.keys(k);
    },
    async type(text) {
      for (const ch of text) await browser.keys(ch);
    },
    /** Ids of the items drawn in the plan (`data-item` of the plan pane's shapes). */
    async planItems() {
      return browser.execute(() => {
        const pane = document.querySelector("section[aria-label='Grundriss']");
        return [...new Set([...(pane?.querySelectorAll("[data-item]") ?? [])].map((e) => e.getAttribute("data-item")).filter(Boolean))].sort();
      });
    },
    async statusText() {
      return browser.execute(() => document.querySelector("footer")?.innerText ?? "");
    },
    /** The next file dialog answers with `p` (an absolute path) instead of opening. */
    async nextPath(p) {
      await browser.execute((p) => (window.__E2E_NEXT_PATH__ = p), p);
    },
    /** The next yes/no question answers `yes`. */
    async nextAnswer(yes) {
      await browser.execute((a) => (window.__E2E_NEXT_ANSWER__ = a), yes);
    },
    /** The questions asked so far (texts). */
    async asked() {
      return browser.execute(() => window.__E2E_ASKED__ ?? []);
    },
    async consoleErrors() {
      return browser.execute(() => window.__E2E_ERRORS__ ?? null);
    },
    async consoleWarnings() {
      return browser.execute(() => window.__E2E_WARNINGS__ ?? null);
    },
    /** Waits for a toast whose text matches `pattern`. */
    async waitToast(pattern) {
      await app.waitUntil(
        async () => pattern.test(await browser.execute(() => [...document.querySelectorAll("[role=status]")].map((e) => e.innerText).join("\n"))),
        `no message matching ${pattern}`,
      );
    },
    /** Waits until `name` exists in the file folder and is complete (written atomically), returns its bytes. */
    async waitFile(name, timeout = 15000) {
      const p = app.file(name);
      await app.waitUntil(() => fs.existsSync(p), `${name} was not written`, timeout);
      return fs.readFileSync(p);
    },
    async shot(name) {
      await browser.saveScreenshot(path.join(SHOTS, `${name}.png`));
    },
    /**
     * Kills the app and its drivers at once, as a crash or power cut would, and keeps this run's
     * folders for `launch({ reuse: app.dir })`; the caller removes them with that run's `close()`.
     */
    async crash() {
      const gone = new Promise((r) => (driver.exitCode !== null || driver.signalCode !== null ? r() : driver.once("exit", r)));
      killTree(driver, "SIGKILL");
      await gone;
      ended = true;
    },
    async close() {
      if (!ended) {
        await browser.deleteSession().catch(() => {});
        killTree(driver);
        await new Promise((r) => (driver.exitCode !== null || driver.signalCode !== null ? r() : driver.once("exit", r)));
      }
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    },
  };
  let ended = false;

  try {
    await waitReady(app);
    if (!reuse) await closeIntro(app);
    await ensureGerman(app);
    await browser.setWindowSize(width, height).catch(() => {});
  } catch (e) {
    await app.shot("FAIL-launch").catch(() => {});
    await app.close();
    throw e;
  }
  return app;
}

async function waitReady(app) {
  await app.waitUntil(
    () => app.exec(() => !!document.querySelector("header") && !!document.querySelector("main") && !!document.querySelector("footer") && document.readyState === "complete"),
    "the main window did not render",
    20000,
  );
  const hooked = await app.exec(() => window.__KITCHENPLANER_E2E__ === true);
  if (!hooked) throw new Error("the test hooks are off: KITCHENPLANER_APP must be a debug build (they are compiled out of release builds)");
  // The first start loads the 3D view (three.js, shaders compiled in software under Xvfb), which
  // can hold the page for seconds: wait until it is there and the page draws frames again, so
  // the first clicks do not time out on a busy page.
  await app.waitUntil(
    () => app.exec(() => !document.querySelector(".pane-loading") && !!document.querySelector(".v3d-host canvas, .v3d-message")),
    "the 3D view did not load",
    60000,
  );
  await app.waitUntil(
    async () => {
      const ms = await app.browser.executeAsync((done) => {
        const t0 = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => done(performance.now() - t0)));
      });
      return ms < 250;
    },
    "the page did not settle after the start",
    60000,
  );
}

/**
 * Every run starts with fresh WebView storage, so the introduction opens as on a first start
 * (components/Intro.tsx): proves that, then closes it so the tests start on the bare window.
 * Tests of the introduction open it again from the view menu.
 */
async function closeIntro(app) {
  await app.waitUntil(() => app.exec(() => !!document.querySelector(".intro[role=dialog]")), "the introduction did not open on the first start");
  await app.exec(() => document.querySelector(".intro-head button").click());
  await app.waitUntil(() => app.exec(() => !document.querySelector(".intro[role=dialog]")), "the introduction did not close");
}

/**
 * The tests read German texts. The WebView's language follows the system (English in a bare
 * container): switch it the way a user does, in the „View“ menu (stored in this run's own WebView
 * storage). Not by a reload, which leaves Tauri warnings about lost callbacks in the console.
 */
async function ensureGerman(app) {
  if ((await app.exec(() => document.documentElement.lang)) === "de") return;
  await app.menu("View", "Deutsch");
  await app.waitUntil(() => app.exec(() => document.documentElement.lang === "de"), "the UI did not switch to German");
  // The first project got its name in English: start a new one, named in German.
  await app.click("Neues Projekt", "header");
  await app.waitUntil(async () => (await germanTitle(app)) === "Unbenanntes Projekt – Kitchenplaner", "the new project is not named in German");
}

const germanTitle = (app) => app.browser.getTitle();

/**
 * A test that runs against its own, freshly started app and leaves a screenshot and the page's
 * HTML in e2e/screenshots when it fails: `appTest("name", async (app, t) => { ... })`.
 * Options: `window` ({ width, height } at start), `timeout` (ms, default two minutes), `appGone`
 * (the test ends the app itself: no console check afterwards).
 */
export function appTestWith(test) {
  return (name, fn, opts = {}) =>
    test(name, { timeout: opts.timeout ?? 120000 }, async (t) => {
      const app = await launch(opts.window);
      try {
        await fn(app, t);
        // Every test also proves that nothing went wrong on the way (the shell records them).
        if (!opts.appGone) {
          const errors = await app.consoleErrors();
          if (errors?.length) throw new Error(`console errors:\n${errors.join("\n")}`);
        }
      } catch (e) {
        const slug = name.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
        await app.shot(`FAIL-${slug}`).catch(() => {});
        const html = await app.exec(() => document.documentElement.outerHTML).catch(() => "");
        if (html) fs.writeFileSync(path.join(SHOTS, `FAIL-${slug}.html`), html);
        throw e;
      } finally {
        await app.close();
      }
    });
}

/** The format version the UI writes (ui/src/model/project.ts), so the file check follows a bump. */
export function formatVersion() {
  const src = fs.readFileSync(path.join(ROOT, "ui", "src", "model", "project.ts"), "utf8");
  const m = /export const FORMAT_VERSION = (\d+);/.exec(src);
  if (!m) throw new Error("FORMAT_VERSION not found in ui/src/model/project.ts");
  return Number(m[1]);
}
