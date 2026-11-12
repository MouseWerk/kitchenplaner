// Steps of the Kitchenplaner UI shared by the tests, written against what a user sees: German
// texts from ui/src/locales/de.ts, ARIA roles and labels, and the `data-item` ids of the plan.

import { test } from "node:test";
import { appTestWith, Key } from "./harness.js";

export const appTest = appTestWith(test);

export const CATALOG = "aside[aria-label='Katalog']";
export const INSPECTOR = "aside[aria-label='Eigenschaften']";

/** Clicks a catalog entry (placed at a free spot by the app) and waits until the plan shows one more item. */
export async function place(app, name) {
  const before = (await app.planItems()).length;
  await app.click(name, CATALOG);
  await app.waitUntil(async () => (await app.planItems()).length === before + 1, `„${name}“ did not appear in the plan`);
  return app.planItems();
}

/** The status bar's item count („1 Gerät“, „3 Geräte“). */
export async function waitItemCount(app, n) {
  const re = new RegExp(`(^|\\s)${n} Ger(ä|ae)te?(\\s|$)`);
  await app.waitUntil(async () => re.test(await app.statusText()), `the status bar does not show ${n} item(s): „${await app.statusText()}“`);
}

/** The name of the item shown in the inspector (its „Bezeichnung“ field), or null. */
export async function inspectorName(app) {
  return app.exec((sel) => {
    const panel = document.querySelector(sel);
    const l = [...(panel?.querySelectorAll("label") ?? [])].find((x) => x.textContent.trim() === "Bezeichnung");
    return l ? document.getElementById(l.htmlFor)?.value ?? null : null;
  }, INSPECTOR);
}

/**
 * Types `text` into the inspector field `label` like a user (focus selects it) and confirms with
 * Enter, which keeps the focus in the field; then leaves it, so the next keys reach the views.
 */
export async function setField(app, label, text) {
  const input = await app.field(label);
  await input.click();
  await app.waitUntil(() => app.exec((e) => document.activeElement === e, input), `field „${label}“ did not take the focus`);
  // Focus selects the text, but the click's mouse-up may put the caret back: select it again.
  await app.keys([Key.Ctrl, "a"]);
  await app.type(text);
  await app.keys(Key.Enter);
  await app.waitUntil(() => app.exec((e) => document.activeElement === e, input), `field „${label}“ lost the focus on Enter`);
  await app.blur();
}

/**
 * The pressed button of a toolbar button group (aria-pressed), by the group's label. Its name: in
 * a narrow window the button shows only an icon and is named by aria-label, its innerText empty.
 */
export async function pressed(app, group) {
  return app.exec((group) => {
    const b = document.querySelector(`header [role=group][aria-label='${group}'] [aria-pressed=true]`);
    return b ? (b.getAttribute("aria-label") || b.innerText).trim() : null;
  }, group);
}

/** The titles of the view panes shown. */
export async function panes(app) {
  return app.exec(() => [...document.querySelectorAll("main section[aria-label]")].map((s) => s.getAttribute("aria-label")));
}

/** Presses a key with nothing focused, as on the views (shortcuts do not fire in fields). */
export async function pressOnViews(app, key) {
  await app.blur();
  await app.keys(key);
}

/** Presses a key with the floor plan focused, as after a click into it (Tab switches the mode only there). */
export async function pressOnPlan(app, key) {
  await app.exec(() => document.querySelector("section[aria-label='Grundriss'] [data-drawing]").focus());
  await app.keys(key);
}

// ---- Pointer input (real WebDriver pointer actions, in viewport CSS pixels).

const PLAN = "section[aria-label='Grundriss']";

/** The plan's drawing area in the viewport: { left, top, width, height, cx, cy }. */
export async function planRect(app) {
  return app.exec((sel) => {
    const svg = document.querySelector(`${sel} svg`);
    const r = svg.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }, PLAN);
}

/** The screen box of an item in the plan (all its shapes together). */
export async function itemRect(app, id) {
  return app.exec(
    (sel, id) => {
      const rs = [...document.querySelectorAll(`${sel} [data-item="${id}"]`)].map((e) => e.getBoundingClientRect()).filter((r) => r.width || r.height);
      if (!rs.length) return null;
      const left = Math.min(...rs.map((r) => r.left));
      const top = Math.min(...rs.map((r) => r.top));
      const right = Math.max(...rs.map((r) => r.right));
      const bottom = Math.max(...rs.map((r) => r.bottom));
      return { left, top, right, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 };
    },
    PLAN,
    id,
  );
}

const pt = (p) => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** Moves the mouse to `p` (in a few steps, as a hand does). */
export async function hover(app, p) {
  await app.browser.action("pointer", { parameters: { pointerType: "mouse" } }).move({ ...pt(p), duration: 50 }).perform();
}

/** A left click at `p`. */
export async function clickAt(app, p) {
  await app.browser.action("pointer", { parameters: { pointerType: "mouse" } }).move(pt(p)).down({ button: 0 }).up({ button: 0 }).perform();
}

/** Presses the left button at `from`, moves to `to` in steps and releases it there. */
export async function drag(app, from, to) {
  const a = app.browser.action("pointer", { parameters: { pointerType: "mouse" } }).move(pt(from)).down({ button: 0 });
  for (let i = 1; i <= 8; i++) a.move({ ...pt({ x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 }), duration: 20 });
  await a.up({ button: 0 }).perform();
}

/** A German number as the inspector shows it („1.600“, „-250“) as a number. */
export const germanNumber = (s) => Number(String(s).replace(/\./g, "").replace(",", "."));

// ---- Layouts, the plan's view and the room mode.

/** Only the plan, as large as it gets, and settled at that size. */
export async function planOnly(app) {
  await pressOnViews(app, "1");
  await app.waitUntil(async () => JSON.stringify(await panes(app)) === '["Grundriss"]', "the plan layout did not open");
  await planView(app);
}

/**
 * The plan's view transform once it holds still (the plan refits while its pane settles): the
 * drawing group's `translate(ox oy) scale(k)` and the drawing area's corner on screen.
 */
export async function planView(app) {
  let last = null;
  return app.waitUntil(
    async () => {
      const v = await app.exec((sel) => {
        const svg = document.querySelector(`${sel} svg`);
        const g = svg?.querySelector(":scope > g[transform]");
        const m = /translate\(\s*([-\d.e+]+)[\s,]+([-\d.e+]+)\s*\)\s*scale\(\s*([-\d.e+]+)\s*\)/.exec(g?.getAttribute("transform") ?? "");
        if (!m) return null;
        const r = svg.getBoundingClientRect();
        return { left: r.left, top: r.top, ox: Number(m[1]), oy: Number(m[2]), k: Number(m[3]) };
      }, PLAN);
      const still = v && last && JSON.stringify(v) === JSON.stringify(last);
      last = v;
      return still ? v : false;
    },
    "the plan's view did not settle",
  );
}

/** Where a point of the plan (mm) is on screen (viewport pixels). */
export async function planToScreen(app, p) {
  const v = await planView(app);
  return { x: v.left + v.ox + p.x * v.k, y: v.top + v.oy + p.y * v.k };
}

/** Raum mode by its key (Tab on the plan). */
export async function roomMode(app) {
  await pressOnPlan(app, Key.Tab);
  await app.waitUntil(async () => (await pressed(app, "Modus")) === "Raum", "Tab did not switch to Raum");
}

/**
 * The square handles of the room mode on screen, in order: the room's corners with the select
 * tool, the points drawn so far with the outline tool.
 */
export async function roomHandles(app) {
  return app.exec(
    (sel) =>
      [...document.querySelectorAll(`${sel} .room-layer rect.room-handle`)].map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }),
    PLAN,
  );
}

// ---- The inspector and the window's announcements.

/** The title of the inspector's panel („Wand 2 (Ost, 3.000 mm)“, „Tür“, „2 Geräte ausgewählt“). */
export async function panelTitle(app) {
  return app.exec((sel) => document.querySelector(`${sel} .insp-name`)?.innerText.trim() ?? null, INSPECTOR);
}

/** The position number („Pos.“) of the item the inspector shows, or null. */
export async function selectedPos(app) {
  return app.exec((sel) => {
    const b = document.querySelector(`${sel} .pos-badge`);
    return b ? Number(b.innerText.trim()) : null;
  }, INSPECTOR);
}

/** The texts of the polite live region (what a screen reader hears after a command). */
export async function announced(app) {
  return app.exec(() => [...document.querySelectorAll("[data-live=polite] p")].map((p) => p.textContent));
}

// ---- Files.

/** „Speichern unter…“ into `name` in the test's folder; returns the saved project. */
export async function saveAs(app, name) {
  await app.nextPath(app.file(name));
  await app.menu("Datei", "Speichern unter…");
  await app.waitToast(new RegExp(`„${escapeRe(name)}“ gespeichert`));
  return JSON.parse((await app.waitFile(name)).toString("utf8"));
}

/** Runs an entry of the „Exportieren“ menu into `name` and returns the file's bytes. */
export async function exportFile(app, entry, name) {
  await app.nextPath(app.file(name));
  await app.menu("Exportieren", entry);
  await app.waitToast(new RegExp(`„${escapeRe(name)}“ exportiert`));
  return app.waitFile(name);
}

/** `s` as a literal in a regular expression. */
export const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---- Dragging from the catalog.

/**
 * Drags the catalog entry `name` into the plan and drops it at `at` (viewport pixels). The drag
 * and drop events are dispatched in the page with the data the catalog row sets: WebDriver's
 * pointer actions do not start a native HTML drag in WebKitGTK or WebView2. Returns whether the
 * plan accepted the drag over it and took the drop.
 */
export async function dropFromCatalog(app, name, at) {
  return app.exec(
    (catalog, name, x, y) => {
      const row = [...document.querySelectorAll(`${catalog} .cat-row`)].find((r) => r.querySelector(".cat-name")?.textContent.trim() === name);
      if (!row) return { error: `no catalog row „${name}“` };
      // A stand-in for the browser's DataTransfer, which pages cannot fill on every engine.
      const data = new Map();
      const dt = {
        dropEffect: "none",
        effectAllowed: "all",
        get types() {
          return [...data.keys()];
        },
        setData: (type, value) => void data.set(type, String(value)),
        getData: (type) => data.get(type) ?? "",
        clearData: () => data.clear(),
        setDragImage: () => {},
        files: [],
        items: [],
      };
      const fire = (target, type, px, py) => {
        const ev = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: px, clientY: py, button: 0 });
        Object.defineProperty(ev, "dataTransfer", { value: dt });
        target.dispatchEvent(ev);
        return ev.defaultPrevented;
      };
      const r = row.getBoundingClientRect();
      fire(row, "dragstart", r.left + r.width / 2, r.top + r.height / 2);
      const target = document.elementFromPoint(x, y);
      if (!target?.closest("section[aria-label='Grundriss']")) return { error: `the drop point is not on the plan but on ${target?.tagName}.${target?.className}` };
      fire(target, "dragenter", x, y);
      const accepted = fire(target, "dragover", x, y);
      const dropped = fire(target, "drop", x, y);
      fire(row, "dragend", x, y);
      return { accepted, dropped };
    },
    CATALOG,
    name,
    Math.round(at.x),
    Math.round(at.y),
  );
}
