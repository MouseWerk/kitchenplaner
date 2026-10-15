// The plan set as PDF from the real app: the dialog's choices, the file written through the save
// dialog hook (`__E2E_NEXT_PATH__`), and what is in it (ui/src/render/planSet.ts).

import assert from "node:assert/strict";
import zlib from "node:zlib";
import { Key } from "../lib/harness.js";
import { appTest, place, pressOnViews, setField } from "../lib/kitchen.js";

const PROJECT = "Kantine Nordflügel";

/** `s` as a PDF literal string writes it: WinAnsi, other than ASCII as octal escapes. */
const pdfLiteral = (s) => [...s].map((c) => (c.charCodeAt(0) > 0x7e ? "\\" + c.charCodeAt(0).toString(8).padStart(3, "0") : c)).join("");

/** The texts of a PDF: its uncompressed parts and every FlateDecode stream inflated (latin1). */
function pdfText(bytes) {
  const raw = bytes.toString("latin1");
  let out = raw;
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    try {
      out += "\n" + zlib.inflateSync(bytes.subarray(start, end)).toString("latin1");
    } catch {
      /* not compressed */
    }
    re.lastIndex = end;
  }
  return out;
}

appTest("the plan set exports as PDF with the sheets the dialog counts", async (app) => {
  await place(app, "Arbeitstisch an der Wand");
  await place(app, "Spültisch, 1 Becken");
  // Nothing selected: the inspector shows the project.
  await pressOnViews(app, Key.Escape);
  await setField(app, "Projekt", PROJECT);

  await app.menu("Exportieren", "Plansatz als PDF…");
  const dialog = await app.waitFor("[role=dialog].plan-set");
  // „Grundriss: 1:50 · … · 7 Blätter“
  const summary = await app.waitUntil(async () => /(\d+) Bl(ä|a)tt(er)?\b/.exec(await app.textOf(dialog)), "the dialog shows no sheet count");
  const sheets = Number(summary[1]);
  assert.ok(sheets >= 6, `only ${sheets} sheets: plan, four elevations and the list are on by default`);

  await app.nextPath(app.file("plansatz.pdf"));
  await app.click("Exportieren…", "[role=dialog]");
  await app.waitToast(/„plansatz\.pdf“ exportiert/);
  await app.waitUntil(() => app.exec(() => !document.querySelector("[role=dialog]")), "the dialog stayed open after the export");
  const pdf = await app.waitFile("plansatz.pdf");

  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.ok(pdf.subarray(-8).toString("latin1").includes("%%EOF"), "the PDF is cut off");
  const text = pdfText(pdf);
  const pages = text.match(/\/Type \/Page\b(?!s)/g) ?? [];
  assert.equal(pages.length, sheets);
  assert.match(text, new RegExp(`/Count ${sheets}\\b`));
  // The title block names the project.
  assert.ok(text.includes(`(${pdfLiteral(PROJECT)})`), "the project name is not in the PDF");
});
