// Opening files that are no usable project: a damaged one, one from a newer version, one that is
// no project at all, a cut-off one and one with another extension. Each gets its message (a
// cut-off project counts as damaged), and the project that was open stays open, saved to the same
// file as before.

import assert from "node:assert/strict";
import fs from "node:fs";
import { formatVersion, Key } from "../lib/harness.js";
import { appTest, escapeRe, place, pressOnViews, saveAs, setField, waitItemCount } from "../lib/kitchen.js";

const TITLE = "Bleibt offen – Kitchenplaner";

appTest("broken, too new and foreign files give their message and keep the open project", async (app) => {
  await setField(app, "Projekt", "Bleibt offen");
  const ids = await place(app, "Handwaschbecken");
  const saved = await saveAs(app, "offen.kplan");
  await app.waitUntil(async () => (await app.browser.getTitle()) === TITLE, `title is „${await app.browser.getTitle()}“`);

  const write = (name, text) => fs.writeFileSync(app.file(name), text);
  // The envelope is right (the Rust core lets it through), the content is not.
  write("kaputt.kplan", JSON.stringify({ ...saved, items: "keine Liste" }));
  write("neuer.kplan", JSON.stringify({ ...saved, version: formatVersion() + 1 }));
  write("notiz.kplan", "Einkaufsliste: Mehl, Eier, Butter\n");
  // A file cut off in the middle (a copy that broke off) is no JSON any more.
  const full = JSON.stringify(saved);
  write("halb.kplan", full.slice(0, Math.floor(full.length / 2)));
  write("liste.txt", JSON.stringify(saved));

  const cases = [
    ["kaputt.kplan", /Die Projektdatei ist beschädigt und kann nicht geöffnet werden\./],
    ["neuer.kplan", /mit einer neueren Version von Kitchenplaner gespeichert\. Aktualisiere die App/],
    ["notiz.kplan", /„notiz\.kplan“ ist kein Kitchenplaner-Projekt\./],
    // Cut off, it was a project all the same: damaged, not foreign.
    ["halb.kplan", /Die Projektdatei ist beschädigt und kann nicht geöffnet werden\./],
    ["liste.txt", /„liste\.txt“ hat nicht die passende Dateiendung/],
  ];
  for (const [name, message] of cases) {
    // The messages of the cases before go first: two cases share a text.
    await app.exec(() => document.querySelectorAll(".toasts .toast .toast-close").forEach((b) => b.click()));
    await app.waitUntil(() => app.exec(() => document.querySelectorAll(".toasts .toast").length === 0), "the earlier messages did not close");
    await app.nextPath(app.file(name));
    await app.click("Öffnen…", "header");
    await app.waitToast(message);
    // Nothing of it was loaded: the same project, unchanged and still saved.
    await waitItemCount(app, 1);
    assert.deepEqual(await app.planItems(), ids, `opening ${name} changed the items`);
    assert.equal(await app.browser.getTitle(), TITLE, `opening ${name} changed the window title`);
    assert.doesNotMatch(await app.exec(() => [...document.querySelectorAll(".toasts .toast")].map((e) => e.innerText).join("\n")), new RegExp(`„${escapeRe(name)}“ geöffnet`));
  }
  // Nothing was unsaved, so nothing was asked.
  assert.deepEqual(await app.asked(), []);
  await pressOnViews(app, Key.Escape);
  assert.equal(await app.fieldValue("Projekt"), "Bleibt offen");

  // Saving still writes to the open project's own file.
  await place(app, "Arbeitstisch an der Wand");
  await app.click("Speichern", "header");
  await app.waitToast(/„offen\.kplan“ gespeichert/);
  await app.waitUntil(() => JSON.parse(fs.readFileSync(app.file("offen.kplan"), "utf8")).items.length === 2, "the open project's file did not get the new item");
  assert.equal(JSON.parse(fs.readFileSync(app.file("kaputt.kplan"), "utf8")).items, "keine Liste", "the damaged file was overwritten");
});
