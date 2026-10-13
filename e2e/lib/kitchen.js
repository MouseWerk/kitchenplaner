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

/** Types `text` into the inspector field `label` like a user (focus selects it) and confirms with Enter. */
export async function setField(app, label, text) {
  const input = await app.field(label);
  await input.click();
  await app.waitUntil(() => app.exec((e) => document.activeElement === e, input), `field „${label}“ did not take the focus`);
  // Focus selects the text, but the click's mouse-up may put the caret back: select it again.
  await app.keys([Key.Ctrl, "a"]);
  await app.type(text);
  await app.keys(Key.Enter);
  await app.waitUntil(() => app.exec((e) => document.activeElement !== e, input), `field „${label}“ kept the focus after Enter`);
}

/** The pressed button of a toolbar button group (aria-pressed), by the group's label. */
export async function pressed(app, group) {
  return app.exec((group) => {
    const g = document.querySelector(`header [role=group][aria-label='${group}']`);
    return g?.querySelector("[aria-pressed=true]")?.innerText.trim() ?? null;
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
