// Screenshots and exports of the example kitchen for presentations. Not part of the test suite:
// it drives the real app (debug build, test hooks on) through the same harness as the tests, only
// with what a user does (toolbar, menus, keys, pointer), and saves full-window PNGs into
// pitch/ and real exports into pitch/exports/. Run in the Linux container: e2e/docker/pitch.sh.
//
// Every wait is for a condition: toasts gone, catalog previews rendered, the 3D camera at rest.

import fs from "node:fs";
import path from "node:path";
import { Key, launch } from "../lib/harness.js";
import { CATALOG, clickAt, drag, hover, INSPECTOR, panes, pressOnViews } from "../lib/kitchen.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.resolve(process.env.PITCH_OUT ?? path.join(ROOT, "pitch"));
const EXPORTS = path.join(OUT, "exports");
const EXAMPLE = path.join(ROOT, "examples", "Beispielkueche-Restaurant.kplan");
const WIDTH = Number(process.env.PITCH_WIDTH ?? 2560);
const HEIGHT = Number(process.env.PITCH_HEIGHT ?? 1440);
/** Only these shots (numbers), e.g. PITCH_ONLY=4,5 while working on them; exports run with "x". */
const ONLY = process.env.PITCH_ONLY ? new Set(process.env.PITCH_ONLY.split(",").map((s) => s.trim())) : null;
const want = (n) => !ONLY || ONLY.has(String(n));

const PLAN = "section[aria-label='Grundriss']";
const V3D = "section[aria-label='3D']";
/** The cooking island's units (without its two hoods) in the example (ui/src/examples/exampleKitchen.ts). */
const ISLAND = { minX: 7600, minY: 2400, maxX: 12000, maxY: 4200 };

fs.mkdirSync(EXPORTS, { recursive: true });
const app = await launch({ width: WIDTH, height: HEIGHT });
const b = app.browser;
const log = (s) => console.log(`[pitch] ${s}`);

try {
  const inner = await app.exec(() => [window.innerWidth, window.innerHeight, window.devicePixelRatio]);
  log(`window ${inner.join(" × ")}`);

  await theme("Dunkles Design");
  await openExample();

  // 1: everything at once, nothing selected: the inspector shows the project with its totals.
  await layout("Alle Ansichten");
  await facing(0, "Nord");
  await facing(1, "Ost");
  await ready3d();
  await quality(true);
  await zoom3d(2);
  await settle();
  if (want(1)) await shot("01-alle-ansichten");

  // 2: the plan alone, fitted.
  await layout("Grundriss");
  await fit();
  await settle();
  if (want(2)) await shot("02-grundriss");

  // 3: the cooking island framed (left to right: what lies fully inside).
  await selectIsland();
  await settle();
  if (want(3)) await shot("03-grundriss-kochinsel-auswahl");

  // 4: 3D from the south-east (the default perspective), walls towards the camera cut away.
  await clearSelection();
  await layout("3D");
  await ready3d();
  await quality(true);
  await zoom3d(3);
  await settle();
  if (want(4)) await shot("04-3d-uebersicht");

  // 5: the island framed in 3D: selected in the plan, F over the 3D view frames the selection.
  await layout("Grundriss");
  await selectIsland();
  await layout("3D");
  await ready3d();
  await keysOver3d("f");
  await clearSelection();
  await settle();
  if (want(5)) await shot("05-3d-kochinsel");

  // 6: walking. Start beside the hand wash station at the east wall, looking west along the aisle
  // between the cooking wall and the island: the right side view (3), the station framed (F),
  // then „Begehen“, which starts at the framed point looking the camera's way.
  await layout("Grundriss");
  await selectItem("ex-33");
  await layout("3D");
  await ready3d();
  await keysOver3d("3");
  await keysOver3d("f");
  await clearSelection();
  await toggle3d("Begehen", true);
  await lookDown(70);
  await settle();
  if (want(6)) await shot("06-3d-begehen");
  await keysOver3d(Key.Escape);

  // 7: straight from above (7), orthographic.
  await keysOver3d("7");
  await settle();
  if (want(7)) await shot("07-3d-von-oben");

  // 8: the four elevations.
  await layout("Ansichten");
  await fit();
  await settle();
  if (want(8)) await shot("08-ansichten");

  // 9: the north wall's elevation (the cooking wall), as its pane shows it.
  if (want(9)) await shotOf("section[aria-label='Ansicht Nord']", "09-ansicht-nord");

  // 10: the catalog searching „kombi“, with the large preview of the 20 GN combi steamer.
  await layout("Alle Ansichten");
  await ready3d();
  await catalogSearch("kombi");
  await catalogPreview("Kombidämpfer 20 × GN 1/1");
  await settle({ toasts: true, catalog: true, park: false });
  if (want(10)) await shot("10-katalog-vorschau");
  await clearSearch();

  // 11: G with X lock and a typed distance on the patisserie table group, before confirming.
  await layout("Grundriss");
  await fit();
  await frameSelect({ minX: 3250, minY: 3250, maxX: 5150, maxY: 4250 });
  await operator("gx-800");
  await settle({ park: false });
  if (want(11)) await shot("11-operator-verschieben");
  await app.keys(Key.Escape);
  await app.waitUntil(async () => !/-800|−800/.test(await app.statusText()), "Escape did not end the operator");

  // 12: room mode with the north wall selected: its panel and the wall lengths in the plan.
  await clearSelection();
  await app.click("Raum", "header [role=group][aria-label='Modus']");
  await app.waitUntil(async () => /Raum/.test(await app.statusText()), "room mode did not start");
  await selectWall(0);
  await settle();
  if (want(12)) await shot("12-raum-wand");
  await app.keys(Key.Escape);
  await app.click("Einrichten", "header [role=group][aria-label='Modus']");

  // 13: one item: the 20 GN combi steamer with sizes, energy variants and connection values.
  await layout("Alle Ansichten");
  await ready3d();
  await selectItem("ex-31");
  await settle();
  if (want(13)) await shot("13-inspektor-kombidaempfer");
  await clearSelection();

  // 14 and 15: the light theme.
  await theme("Helles Design");
  await layout("Alle Ansichten");
  await ready3d();
  await zoom3d(2);
  await settle();
  if (want(14)) await shot("14-hell-alle-ansichten");
  await layout("3D");
  await ready3d();
  await zoom3d(3);
  await settle();
  if (want(15)) await shot("15-hell-3d");

  // Exports through the „Exportieren“ menu (dark theme again for the 3D picture).
  if (want("x")) {
    await theme("Dunkles Design");
    await settle();
    await exportTo("Grundriss als SVG…", "grundriss.svg");
    await exportTo("Grundriss als DXF…", "grundriss.dxf");
    await exportTo("Grundriss als PNG…", "grundriss.png");
    await exportTo("Alle Ansichten als SVG…", "ansichten.svg");
    await exportTo("Geräteliste als CSV…", "geraeteliste.csv");
    await exportTo("3D-Ansicht als PNG…", "3d-ansicht.png");
  }

  const errors = await app.consoleErrors();
  const warnings = await app.consoleWarnings();
  if (errors?.length) log(`console errors:\n${errors.join("\n")}`);
  if (warnings?.length) log(`console warnings:\n${warnings.join("\n")}`);
  log("done");
} catch (e) {
  await b.saveScreenshot(path.join(OUT, "FAIL.png")).catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  await app.close();
}

// ---- Steps

async function openExample() {
  await app.nextAnswer(true);
  await app.nextPath(EXAMPLE);
  await app.click("Öffnen…", "header");
  await app.waitToast(/„Beispielkueche-Restaurant\.kplan“ geöffnet/);
  await app.waitUntil(async () => /65 Geräte/.test(await app.statusText()), "the example did not load");
}

async function theme(entry) {
  await app.menu("Darstellung", entry);
  const want = entry === "Helles Design" ? "light" : "dark";
  await app.waitUntil(() => app.exec((w) => document.documentElement.dataset.theme === w, want), `theme ${want} not applied`);
}

async function layout(name) {
  await app.click(name, "header [role=group][aria-label='Ansicht wählen']");
  await app.waitUntil(() => app.exec((n) => document.querySelector("header [role=group][aria-label='Ansicht wählen'] [aria-pressed=true]")?.innerText.trim() === n, name), `layout ${name} not shown`);
}

/** Sets the facing of the `index`-th elevation pane of the split layout. */
async function facing(index, name) {
  const ref = await app.waitUntil(
    () =>
      app.exec(
        (i, n) => {
          const groups = document.querySelectorAll("main [role=group][aria-label='Blickrichtung']");
          return [...(groups[i]?.querySelectorAll("button") ?? [])].find((x) => x.title === n) ?? null;
        },
        index,
        name,
      ),
    `no facing ${name} in pane ${index}`,
  );
  await (await b.$(ref)).click();
}

async function fit() {
  await pressOnViews(app, "f");
}

/** Waits until the 3D pane shows a canvas. */
async function ready3d() {
  await app.waitUntil(async () => (await panes(app)).includes("3D"), "no 3D pane");
  await app.waitUntil(() => app.exec((s) => !!document.querySelector(`${s} canvas`), V3D), "the 3D view did not start (WebGL?)", 60000);
}

/** Switches a 3D toggle (by its accessible name) to `on`. */
async function toggle3d(name, on) {
  const sel = `${V3D} button[aria-label='${name}']`;
  const el = await app.waitFor(sel);
  if ((await el.getAttribute("aria-pressed")) !== String(on)) await el.click();
  await app.waitUntil(async () => (await el.getAttribute("aria-pressed")) === String(on), `${name} did not switch`);
}

async function quality(on) {
  await toggle3d("Hohe Qualität (Umgebungsverdeckung)", on);
}

/** Presses keys with the pointer over the 3D view (its keys act only then). */
async function keysOver3d(key) {
  const r = await app.exec((s) => {
    const x = document.querySelector(`${s} canvas`).getBoundingClientRect();
    return { x: x.left + x.width - 40, y: x.top + x.height - 40 };
  }, V3D);
  await hover(app, r);
  await app.keys(key);
  await camAtRest();
}

/** Zooms the 3D view in by `notches` wheel notches at the middle of the view (towards the kitchen). */
async function zoom3d(notches) {
  const c = await app.exec((s) => {
    const x = document.querySelector(`${s} canvas`).getBoundingClientRect();
    return { x: Math.round(x.left + x.width / 2), y: Math.round(x.top + x.height / 2) };
  }, V3D);
  await hover(app, c);
  for (let i = 0; i < notches; i++) {
    await b.action("wheel").scroll({ x: c.x, y: c.y, deltaX: 0, deltaY: -100, origin: "viewport" }).perform();
    await camAtRest();
  }
}

/** In walk mode: drags down on the view to look down by `px` pixels' worth. */
async function lookDown(px) {
  const c = await app.exec((s) => {
    const x = document.querySelector(`${s} canvas`).getBoundingClientRect();
    return { x: x.left + x.width / 2, y: x.top + x.height / 2 };
  }, V3D);
  await drag(app, c, { x: c.x, y: c.y + px });
  await camAtRest();
}

/** Waits until the 3D camera has stopped: the view cube keeps its turn over several frames. */
async function camAtRest() {
  if (!(await app.exec((s) => !!document.querySelector(`${s} canvas`), V3D))) return;
  await b.executeAsync((done) => {
    let last = null;
    let same = 0;
    const step = () => {
      const t = document.querySelector(".v3d-cube")?.dataset.turn ?? "";
      if (t === last) same++;
      else {
        same = 0;
        last = t;
      }
      if (same >= 6) done(true);
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/** Screen point of a plan point (mm), from the plan's own viewport transform. */
async function planPoint(p) {
  return app.exec(
    (s, p) => {
      const svg = document.querySelector(`${s} svg`);
      const g = svg.querySelector(":scope > g[transform]");
      const m = /translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([-\d.e]+)\)/.exec(g.getAttribute("transform"));
      const r = svg.getBoundingClientRect();
      return { x: r.left + Number(m[1]) + p.x * Number(m[3]), y: r.top + Number(m[2]) + p.y * Number(m[3]) };
    },
    PLAN,
    p,
  );
}

/** A frame from the top left to the bottom right of `box` (mm): selects what lies fully inside. */
async function frameSelect(box) {
  await app.blur();
  await app.keys(Key.Escape);
  const a = await planPoint({ x: box.minX, y: box.minY });
  const z = await planPoint({ x: box.maxX, y: box.maxY });
  await drag(app, a, z);
}

async function selectIsland() {
  // Wider than the units, but ending above the hoods' far edges, so the hoods are not inside.
  await frameSelect({ minX: ISLAND.minX - 300, minY: ISLAND.minY - 400, maxX: ISLAND.maxX + 100, maxY: ISLAND.maxY + 100 });
  await app.waitUntil(async () => /12 Geräte ausgewählt/.test(await inspectorText()), `island not selected: ${await inspectorText()}`);
}

async function selectItem(id) {
  if (!(await panes(app)).includes("Grundriss")) await layout("Grundriss");
  const c = await app.exec(
    (s, id) => {
      const rs = [...document.querySelectorAll(`${s} [data-item="${id}"]`)].map((e) => e.getBoundingClientRect()).filter((r) => r.width || r.height);
      const l = Math.min(...rs.map((r) => r.left));
      const t = Math.min(...rs.map((r) => r.top));
      const rr = Math.max(...rs.map((r) => r.right));
      const bb = Math.max(...rs.map((r) => r.bottom));
      return { x: (l + rr) / 2, y: (t + bb) / 2 };
    },
    PLAN,
    id,
  );
  await clickAt(app, c);
  await app.waitUntil(() => app.exec((s) => !!document.querySelector(s)?.querySelector("label"), INSPECTOR), `${id} not selected`);
}

async function clearSelection() {
  await app.blur();
  await app.keys(Key.Escape);
}

async function inspectorText() {
  return app.exec((s) => document.querySelector(s)?.innerText ?? "", INSPECTOR);
}

/** Starts an operator with the pointer over the plan and types its keys one by one. */
async function operator(keys) {
  const r = await app.exec((s) => {
    const x = document.querySelector(`${s} svg`).getBoundingClientRect();
    return { x: x.left + x.width * 0.4, y: x.top + x.height * 0.55 };
  }, PLAN);
  await hover(app, r);
  await app.type(keys);
  await app.waitUntil(async () => /800/.test(await app.statusText()), `the operator does not show the typed value: ${await app.statusText()}`);
}

/** Clicks the middle of wall `i` (from corner i to i + 1) in room mode. */
async function selectWall(i) {
  const pts = await app.exec((s) => [...document.querySelectorAll(`${s} rect.room-handle`)].map((h) => h.getBoundingClientRect()).map((r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })), PLAN);
  const a = pts[i];
  const z = pts[(i + 1) % pts.length];
  await clickAt(app, { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 });
  await app.waitUntil(async () => /Wand \d/.test(await inspectorText()), `no wall panel: ${await inspectorText()}`);
}

async function catalogSearch(text) {
  const input = await app.waitFor(`${CATALOG} input[type=search]`);
  await input.click();
  await app.type(text);
  await app.waitUntil(() => app.exec((s, t) => document.querySelector(`${s} input[type=search]`).value === t, CATALOG, text), "search not typed");
}

async function clearSearch() {
  const input = await app.waitFor(`${CATALOG} input[type=search]`);
  await input.click();
  await app.keys([Key.Ctrl, "a"]);
  await app.keys(Key.Backspace);
  await app.blur();
}

async function catalogPreview(name) {
  const row = await app.button(name, CATALOG);
  const r = await app.exec((e) => {
    const x = e.getBoundingClientRect();
    return { x: x.left + x.width * 0.6, y: x.top + x.height / 2 };
  }, row);
  await hover(app, r);
  await app.waitUntil(() => app.exec(() => !!document.querySelector(".cat-preview img")?.complete && document.querySelector(".cat-preview img").naturalWidth > 0), "the catalog preview did not open", 20000);
}

/**
 * Before a picture: no toast, the catalog's visible previews rendered, the pointer parked where
 * it hovers nothing, the 3D camera at rest and two frames drawn.
 */
async function settle({ toasts = true, catalog = true, park = true } = {}) {
  if (park) {
    const p = await app.exec(() => {
      const r = document.querySelector("footer .status-spacer")?.getBoundingClientRect() ?? document.querySelector("footer").getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await hover(app, p);
  }
  if (toasts) await app.waitUntil(() => app.exec(() => !document.querySelector(".toast")), "a message stays on screen", 15000);
  if (catalog)
    await app.waitUntil(
      () =>
        app.exec((s) => {
          const vh = window.innerHeight;
          return ![...document.querySelectorAll(`${s} .cat-thumb.is-loading`)].some((t) => {
            const r = t.getBoundingClientRect();
            return r.bottom > 0 && r.top < vh && r.width > 0;
          });
        }, CATALOG),
      "catalog previews still loading",
      120000,
    );
  await camAtRest();
  await b.executeAsync((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))));
}

async function shot(name) {
  const errorToast = await app.exec(() => !!document.querySelector(".toast.danger"));
  if (errorToast) throw new Error(`error message on screen before ${name}`);
  await b.saveScreenshot(path.join(OUT, `${name}.png`));
  log(name);
}

async function shotOf(sel, name) {
  const el = await app.waitFor(sel);
  await el.saveScreenshot(path.join(OUT, `${name}.png`));
  log(`${name} (pane)`);
}

async function exportTo(entry, name) {
  const target = path.join(EXPORTS, name);
  fs.rmSync(target, { force: true });
  await app.nextPath(target);
  await app.menu("Exportieren", entry);
  await app.waitToast(new RegExp(`„${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}“ exportiert`));
  await app.waitUntil(() => fs.existsSync(target), `${name} was not written`, 30000);
  log(`exports/${name} (${fs.statSync(target).size} bytes)`);
}
