import assert from "node:assert/strict";
import fs from "node:fs";
import { appTest, place, setField, waitItemCount } from "../lib/kitchen.js";
import { formatVersion } from "../lib/harness.js";

const readText = (app, name) => fs.readFileSync(app.file(name), "utf8");

appTest("save as writes a .kplan file, and opening it brings the same items back", async (app) => {
  await setField(app, "Projekt", "Küche Krone");
  await place(app, "Arbeitstisch an der Wand");
  const ids = await place(app, "Kühlschrank GN 2/1");
  await app.waitUntil(async () => (await app.browser.getTitle()) === "* Küche Krone – Kitchenplaner", `title is „${await app.browser.getTitle()}“`);

  const target = app.file("Küche Krone.kplan");
  await app.nextPath(target);
  await app.menu("Datei", "Speichern unter…");
  await app.waitToast(/„Küche Krone\.kplan“ gespeichert/);
  const doc = JSON.parse((await app.waitFile("Küche Krone.kplan")).toString("utf8"));
  assert.equal(doc.format, "kitchenplaner");
  assert.equal(doc.version, formatVersion());
  assert.equal(doc.info.name, "Küche Krone");
  assert.deepEqual(doc.items.map((i) => i.id).sort(), ids);
  assert.ok(doc.items.every((i) => Number.isFinite(i.width) && Number.isFinite(i.x)), "items without sizes or positions");
  // Saved: no change mark, the file name in the title bar of the window.
  await app.waitUntil(async () => !(await app.browser.getTitle()).startsWith("* "), "the title still marks unsaved changes");

  // A new project (no question: nothing unsaved), then open the file again.
  await app.click("Neues Projekt", "header");
  await waitItemCount(app, 0);
  assert.deepEqual(await app.asked(), []);
  await app.nextPath(target);
  await app.click("Öffnen…", "header");
  await app.waitToast(/„Küche Krone\.kplan“ geöffnet/);
  await waitItemCount(app, 2);
  assert.deepEqual(await app.planItems(), ids);
  assert.equal(await app.fieldValue("Projekt"), "Küche Krone");
  assert.equal(await app.browser.getTitle(), "Küche Krone – Kitchenplaner");
});

appTest("save writes to the known file without asking again", async (app) => {
  const target = app.file("Plan.kplan");
  await app.nextPath(target);
  await app.click("Speichern", "header");
  await app.waitToast(/„Plan\.kplan“ gespeichert/);
  await app.waitFile("Plan.kplan");
  assert.equal(JSON.parse(await app.waitFile("Plan.kplan")).items.length, 0);

  const ids = await place(app, "Handwaschbecken");
  // No path offered this time: a dialog would cancel the save.
  await app.click("Speichern", "header");
  await app.waitUntil(() => JSON.parse(readText(app, "Plan.kplan")).items.length === 1, "Speichern did not write the item into the known file");
  assert.deepEqual(JSON.parse(readText(app, "Plan.kplan")).items.map((i) => i.id), ids);
});

appTest("a cancelled save dialog writes nothing and keeps the change mark", async (app) => {
  await place(app, "Handwaschbecken");
  // No path given: the dialog answers „cancel“ (and marks that it was asked by setting null).
  await app.exec(() => delete window.__E2E_NEXT_PATH__);
  await app.click("Speichern", "header");
  await app.waitUntil(() => app.exec(() => window.__E2E_NEXT_PATH__ === null), "the save dialog was not asked");
  assert.ok((await app.browser.getTitle()).startsWith("* "), "the change mark is gone");
  assert.deepEqual(fs.readdirSync(app.files), []);
});
