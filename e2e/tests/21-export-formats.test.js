// The exports 06-exports leaves out: the elevation as SVG and DXF and the floor plan as PNG. Each
// file must exist, be complete and be well-formed for its format.

import assert from "node:assert/strict";
import { appTest, exportFile, place } from "../lib/kitchen.js";

/** DXF is pairs of lines: a group code (an integer) and its value. Returns the pairs. */
function dxfPairs(text) {
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  assert.equal(lines.length % 2, 0, "the DXF has an odd number of lines");
  const pairs = [];
  for (let i = 0; i < lines.length; i += 2) {
    assert.match(lines[i].trim(), /^-?\d+$/, `line ${i + 1} is no group code: „${lines[i]}“`);
    pairs.push([Number(lines[i].trim()), lines[i + 1].trim()]);
  }
  return pairs;
}

appTest("the north elevation exports as SVG and as DXF, both complete", async (app) => {
  await place(app, "Arbeitstisch an der Wand");
  await place(app, "Spültisch, 1 Becken");

  const svg = (await exportFile(app, "Ansicht Nord als SVG…", "nord.svg")).toString("utf8");
  assert.match(svg, /<svg[^>]* width="[\d.]+mm" height="[\d.]+mm"/);
  assert.match(svg, /viewBox="[-\d.e]+ [-\d.e]+ [\d.e]+ [\d.e]+"/);
  assert.ok(svg.trimEnd().endsWith("</svg>"), "the SVG is cut off");
  assert.equal((svg.match(/<svg[\s>]/g) ?? []).length, (svg.match(/<\/svg>/g) ?? []).length, "unbalanced <svg> elements");
  // The sheet's title block names the view.
  assert.ok(svg.includes("Ansicht Nord"), "the SVG does not name the view");
  assert.ok((svg.match(/<(path|line|polyline|polygon|rect)\b/g) ?? []).length > 10, "the elevation draws almost nothing");

  const dxf = (await exportFile(app, "Ansicht Nord als DXF…", "nord.dxf")).toString("utf8");
  const pairs = dxfPairs(dxf);
  const values = pairs.filter(([code]) => code === 0).map(([, v]) => v);
  assert.deepEqual(pairs.slice(-1), [[0, "EOF"]]);
  // Every section ends, and the drawing has entities.
  assert.equal(values.filter((v) => v === "SECTION").length, values.filter((v) => v === "ENDSEC").length);
  const sections = pairs.filter(([code], i) => code === 2 && pairs[i - 1]?.[1] === "SECTION").map(([, v]) => v);
  assert.ok(sections.includes("ENTITIES"), `no ENTITIES section: ${sections.join(", ")}`);
  assert.ok(values.filter((v) => /^(LINE|POLYLINE|LWPOLYLINE|ARC|CIRCLE)$/.test(v)).length > 10, "the elevation has almost no lines");
  assert.ok(pairs.some(([code, v]) => code === 1 && v.includes("Ansicht Nord")), "the DXF does not name the view");
});

appTest("the floor plan exports as PNG at the export width", async (app) => {
  await place(app, "Arbeitstisch an der Wand");
  const png = await exportFile(app, "Grundriss als PNG…", "plan.png");
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // The first chunk is IHDR with width and height, the last one IEND: the file is complete.
  assert.equal(png.subarray(12, 16).toString("latin1"), "IHDR");
  assert.equal(png.readUInt32BE(16), 3200);
  const height = png.readUInt32BE(20);
  assert.ok(height > 1000 && height < 3200, `the sheet's height is ${height} px`);
  assert.equal(png.subarray(-8, -4).toString("latin1"), "IEND");
  // A drawing, not an empty white page: far larger than a blank image of that size compresses to.
  assert.ok(png.length > 20_000, `the PNG is suspiciously small (${png.length} bytes)`);
});
