// The editor tools of the floor plan: the introduction, measuring, the context menu and aligning.

import assert from "node:assert/strict";
import { Key } from "../lib/harness.js";
import { appTest, clickAt, hover, INSPECTOR, panes, place, planRect, pressOnViews } from "../lib/kitchen.js";

/** Only the plan, as large as it gets. */
async function planOnly(app) {
  await pressOnViews(app, "1");
  await app.waitUntil(async () => JSON.stringify(await panes(app)) === '["Grundriss"]', "the plan layout did not open");
}

/**
 * A right click at `p` without moving. WebKitWebDriver (Linux) releases the right button as a
 * mouseup of button 0 with the right button still held: WebKit sends no pointerup, keeps the
 * button pressed and swallows the next clicks. There the click is dispatched in the page as the
 * pointer events a real right click delivers; WebView2 (Windows) gets it from the driver.
 */
async function rightClickAt(app, p) {
  const at = { x: Math.round(p.x), y: Math.round(p.y) };
  if (process.platform !== "linux") {
    await app.browser.action("pointer", { parameters: { pointerType: "mouse" } }).move(at).down({ button: 2 }).up({ button: 2 }).perform();
    return;
  }
  await app.exec(({ x, y }) => {
    const target = document.elementFromPoint(x, y);
    const init = { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 2, clientX: x, clientY: y };
    target.dispatchEvent(new PointerEvent("pointerdown", { ...init, buttons: 2 }));
    target.dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }));
  }, at);
}

const menuLabels = (app) => app.exec(() => [...document.querySelectorAll("[role=menu] [role=menuitem]")].map((b) => b.innerText.trim()));

appTest("the introduction opens again from the view menu and opens the example kitchen", async (app) => {
  await app.menu("Darstellung", "Einführung…");
  await app.waitFor(".intro[role=dialog]");
  // The step line is set in capitals (CSS), and innerText reads it so.
  assert.match(await app.textOf(await app.$(".intro")), /Schritt 1 von 6/i);
  await app.click("Weiter", ".intro");
  assert.match(await app.textOf(await app.$(".intro")), /Schritt 2 von 6/i);
  await app.click("Beispielküche öffnen", ".intro");
  await app.waitUntil(async () => (await app.planItems()).length > 20, "the example kitchen did not open");
  await app.waitUntil(() => app.exec(() => !document.querySelector(".intro")), "the introduction stayed open");
  await app.waitUntil(async () => /Restaurant/.test(await app.browser.getTitle()), "the window title does not name the example");
});

appTest("M measures between two points in the plan; Escape ends it", async (app) => {
  await planOnly(app);
  const r = await planRect(app);
  await app.blur();
  await hover(app, { x: r.cx, y: r.cy });
  await app.keys("m");
  await app.waitFor(".measure-layer");
  assert.equal(await app.exec(() => document.querySelector("header button[aria-label='Messen']").getAttribute("aria-pressed")), "true");
  await clickAt(app, { x: r.cx - 100, y: r.cy });
  await clickAt(app, { x: r.cx + 100, y: r.cy + 40 });
  await app.waitUntil(async () => /mm \(ΔX [\d.,-]+, ΔY [\d.,-]+\)/.test(await app.statusText()), `the status bar shows no measurement: „${await app.statusText()}“`);
  // Measuring changes nothing in the project.
  assert.equal(await app.exec(() => document.querySelector("header button[aria-label='Rückgängig']").disabled), true);
  await app.keys(Key.Escape);
  await app.waitUntil(() => app.exec(() => !document.querySelector(".measure-layer")), "Escape did not end the measure tool");
});

appTest("a right click opens the context menu; aligning from it is one undo step", async (app) => {
  await place(app, "Arbeitstisch frei stehend");
  await place(app, "Spültisch, 1 Becken");
  await planOnly(app);
  await pressOnViews(app, "a");
  await app.waitUntil(async () => /2 Geräte ausgewählt/.test(await app.textOf(await app.$(INSPECTOR))), "both items are not selected");
  // The inspector offers the align tools for the selection.
  assert.ok(await app.exec((sel) => !!document.querySelector(`${sel} button[aria-label='Oben ausrichten']`), INSPECTOR));
  const r = await planRect(app);
  await rightClickAt(app, { x: r.left + 20, y: r.top + 20 });
  await app.waitFor("[role=menu]");
  assert.deepEqual((await menuLabels(app)).slice(0, 3).map((l) => l.split("\n")[0]), ["Duplizieren", "90° nach rechts drehen", "90° nach links drehen"]);
  await app.click("Ausrichten und verteilen", "[role=menu]");
  await app.click("Oben ausrichten", "[role=menu]");
  await app.waitUntil(() => app.exec(() => !document.querySelector("[role=menu]")), "the menu stayed open");
  // Placing two items and aligning: undo takes the align back first, then the places.
  await app.click("Rückgängig", "header");
  await app.waitUntil(() => app.exec(() => !document.querySelector("header button[aria-label='Wiederholen']").disabled), "undo did not take the align back");
});
