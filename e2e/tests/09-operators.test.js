// The arrange mode's modal operators and frame selection, driven with real pointer and key input.

import assert from "node:assert/strict";
import fs from "node:fs";
import { Key } from "../lib/harness.js";
import { appTest, drag, germanNumber, hover, INSPECTOR, itemRect, panes, place, planRect, pressOnViews, setField, waitItemCount } from "../lib/kitchen.js";

/** Only the plan, as large as it gets. */
async function planOnly(app) {
  await pressOnViews(app, "1");
  await app.waitUntil(async () => JSON.stringify(await panes(app)) === '["Grundriss"]', "the plan layout did not open");
}

const num = async (app, label) => germanNumber(await app.fieldValue(label));

appTest("G with X and a typed distance moves the selection exactly; Escape cancels", async (app) => {
  await place(app, "Arbeitstisch frei stehend");
  await planOnly(app);
  const x0 = await num(app, "X");
  const y0 = await num(app, "Y");
  const r = await planRect(app);
  await app.blur();
  // The operators work where the cursor is: over the plan.
  await hover(app, { x: r.cx, y: r.cy });

  // One key at a time: keys([...]) holds them all down, so a repeated digit would be a key repeat.
  await app.type("gx1000");
  await app.waitUntil(async () => /1000|1\.000/.test(await app.statusText()), `the status bar does not show the typed distance: „${await app.statusText()}“`);
  await app.keys(Key.Enter);
  await app.waitUntil(async () => (await num(app, "X")) === x0 + 1000, `X is ${await app.fieldValue("X")}, expected ${x0 + 1000}`);
  assert.equal(await num(app, "Y"), y0, "X lock moved Y too");

  // Escape puts it back where it was.
  await hover(app, { x: r.cx + 5, y: r.cy + 5 });
  await app.type("gy500");
  await app.waitUntil(async () => (await num(app, "Y")) === y0 + 500, "the running operator does not show its move");
  await app.keys(Key.Escape);
  await app.waitUntil(async () => (await num(app, "Y")) === y0, `Escape did not cancel: Y is ${await app.fieldValue("Y")}`);
  assert.equal(await num(app, "X"), x0 + 1000);

  // One undo step for the confirmed move.
  await app.click("Rückgängig", "header");
  await app.waitUntil(async () => (await num(app, "X")) === x0, "undo did not take the move back");
});

appTest("R with a typed angle rotates the selection", async (app) => {
  await place(app, "Arbeitstisch frei stehend");
  await planOnly(app);
  const r = await planRect(app);
  await app.blur();
  await hover(app, { x: r.cx, y: r.cy });
  await app.type("r90");
  await app.keys(Key.Enter);
  await app.waitUntil(async () => (await num(app, "Drehung")) === 90, `rotation is ${await app.fieldValue("Drehung")}`);
});

appTest("a frame left to right selects what lies fully inside, right to left what it touches", async (app) => {
  const [a] = await place(app, "Spültisch, 1 Becken");
  const ids = await place(app, "Arbeitstisch an der Wand");
  const b = ids.find((id) => id !== a);
  await planOnly(app);
  await app.blur();
  const ra = await itemRect(app, a);
  const rb = await itemRect(app, b);
  assert.ok(ra && rb, "items not drawn");
  // A box around the first item that reaches only halfway into the second one.
  const top = Math.min(ra.top, rb.top) - 15;
  const bottom = Math.max(ra.bottom, rb.bottom) + 15;
  const left = Math.min(ra.left, rb.left) - 15;
  const right = Math.max(ra.right, rb.right) + 15;
  const [first, second] = ra.left < rb.left ? [ra, rb] : [rb, ra];
  const half = second.cx;
  const selectedText = () => app.exec((sel) => document.querySelector(sel)?.innerText ?? "", INSPECTOR);
  // Nothing selected first: click empty floor (Escape clears the selection).
  await app.keys(Key.Escape);

  await drag(app, { x: first.left - 15, y: top }, { x: half, y: bottom });
  await app.waitUntil(async () => !/Geräte ausgewählt/.test(await selectedText()) && (await app.exec((sel) => !!document.querySelector(sel)?.querySelector("label"), INSPECTOR)), "left to right: no single item selected");
  const name = await app.fieldValue("Bezeichnung");
  assert.match(name, ra.left < rb.left ? /Spültisch/ : /Arbeitstisch/, "left to right selected the half-covered item");

  await app.keys(Key.Escape);
  await drag(app, { x: half, y: bottom }, { x: first.left - 15, y: top });
  await app.waitUntil(async () => /2 Geräte ausgewählt/.test(await selectedText()), "right to left: both items should be selected");

  // A frame around both selects both either way.
  await app.keys(Key.Escape);
  await drag(app, { x: left, y: top }, { x: right, y: bottom });
  await app.waitUntil(async () => /2 Geräte ausgewählt/.test(await selectedText()), "a frame around both did not select both");
});

// The toolbar works with the mouse while G runs from the keyboard. Opening another file used to
// leave the operator running; its Escape then brought the first project back under the second
// file's path, unmarked, so the next save overwrote the second file with it.
appTest("opening another file in the middle of G ends the operator; Escape and save keep the other file", async (app) => {
  const a = app.file("A.kplan");
  const b = app.file("B.kplan");
  await setField(app, "Projekt", "Projekt B");
  await app.nextPath(b);
  await app.menu("Datei", "Speichern unter…");
  await app.waitToast(/„B\.kplan“ gespeichert/);
  await app.click("Neues Projekt", "header");
  await setField(app, "Projekt", "Projekt A");
  await place(app, "Arbeitstisch frei stehend");
  await app.nextPath(a);
  await app.menu("Datei", "Speichern unter…");
  await app.waitToast(/„A\.kplan“ gespeichert/);

  await planOnly(app);
  const r = await planRect(app);
  await app.blur();
  await hover(app, { x: r.cx, y: r.cy });
  await app.type("gx1000");
  await app.waitUntil(async () => /1000|1\.000/.test(await app.statusText()), "G is not running");
  // Should the half-done move still count as a change, the question is answered with „discard“.
  await app.nextAnswer(true);
  await app.nextPath(b);
  await app.click("Öffnen…", "header");
  await app.waitToast(/„B\.kplan“ geöffnet/);
  await waitItemCount(app, 0);

  await hover(app, { x: r.cx, y: r.cy });
  await app.keys(Key.Escape);
  // B is open again, unchanged: its project name in the title, without the change mark.
  await app.waitUntil(async () => (await app.browser.getTitle()) === "Projekt B – Kitchenplaner", `title is „${await app.browser.getTitle()}“`);
  await waitItemCount(app, 0);
  assert.equal(await app.fieldValue("Projekt"), "Projekt B");

  await app.click("Speichern", "header");
  await app.waitToast(/„B\.kplan“ gespeichert/);
  const saved = JSON.parse(fs.readFileSync(b, "utf8"));
  assert.equal(saved.info.name, "Projekt B");
  assert.equal(saved.items.length, 0);
});
