// The question about unsaved changes. In the test build it takes its answer from the test
// (ui/src/lib/unsaved.ts, platform.ts `e2eAnswer`) and records the question, so
// these tests check what the app decides around it: when it asks, and what each answer does.

import assert from "node:assert/strict";
import { appTest, place, waitItemCount } from "../lib/kitchen.js";

// The app's own dialog (Speichern / Nicht speichern / Abbrechen); the test's yes is „Nicht speichern“.
const QUESTION = (name) => `Möchtest du die Änderungen an „${name}“ speichern? Ohne Speichern gehen sie verloren.`;

appTest("a new project asks before unsaved changes are lost", async (app) => {
  await place(app, "Arbeitstisch an der Wand");
  // „Abbrechen“: the project stays.
  await app.nextAnswer(false);
  await app.click("Neues Projekt", "header");
  await app.waitUntil(async () => (await app.asked()).length === 1, "no question before discarding the changes");
  assert.deepEqual(await app.asked(), [QUESTION("Unbenanntes Projekt")]);
  await waitItemCount(app, 1);
  // „Nicht speichern“: an empty project.
  await app.nextAnswer(true);
  await app.click("Neues Projekt", "header");
  await waitItemCount(app, 0);
  assert.equal((await app.asked()).length, 2);
  assert.equal(await app.browser.getTitle(), "Unbenanntes Projekt – Kitchenplaner");
});

appTest("opening another project asks first; cancelling keeps the open one", async (app) => {
  await place(app, "Handwaschbecken");
  await app.nextAnswer(false);
  await app.nextPath(app.file("never-read.kplan"));
  await app.click("Öffnen…", "header");
  await app.waitUntil(async () => (await app.asked()).length === 1, "no question before opening");
  // The file dialog was not even shown.
  assert.equal(await app.exec(() => window.__E2E_NEXT_PATH__), app.file("never-read.kplan"));
  await waitItemCount(app, 1);
});

appTest("closing the window with unsaved changes asks; cancel keeps it, discard closes it", async (app) => {
  await place(app, "Arbeitstisch an der Wand");
  const close = () => app.exec(() => void window.__TAURI_INTERNALS__.invoke("plugin:window|close", { label: "main" }));

  await app.nextAnswer(false);
  await close();
  await app.waitUntil(async () => (await app.asked()).length === 1, "closing did not ask about the unsaved changes");
  assert.deepEqual(await app.asked(), [QUESTION("Unbenanntes Projekt")]);
  // Still open and unchanged.
  await waitItemCount(app, 1);
  assert.ok((await app.browser.getTitle()).startsWith("* "));
  assert.deepEqual(await app.consoleErrors(), []);

  await app.nextAnswer(true);
  await close();
  // The window goes away: the session loses its page.
  await app.waitUntil(
    async () => {
      try {
        await app.browser.getTitle();
        return false;
      } catch {
        return true;
      }
    },
    "the window stayed open after „Nicht speichern“",
    15000,
  );
}, { appGone: true });

appTest("closing a saved project does not ask", async (app) => {
  await app.nextPath(app.file("saved.kplan"));
  await app.click("Speichern", "header");
  await app.waitFile("saved.kplan");
  await app.waitUntil(async () => !(await app.browser.getTitle()).startsWith("* "), "still marked as unsaved");
  await app.exec(() => void window.__TAURI_INTERNALS__.invoke("plugin:window|close", { label: "main" }));
  await app.waitUntil(
    async () => {
      try {
        await app.browser.getTitle();
        return false;
      } catch {
        return true;
      }
    },
    "the window stayed open",
    15000,
  );
}, { appGone: true });
