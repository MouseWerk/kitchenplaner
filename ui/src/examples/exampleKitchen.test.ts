import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { exampleKitchen } from "./exampleKitchen";
import { catalogEntry, collides, kindOf, placementOf } from "../kinds/registry";
import { checkProject } from "../model/checks";
import { equipmentRows, equipmentTotals } from "../model/equipment";
import { area, convexOverlap, footprint, pointInPolygon } from "../model/geometry";
import { parseProject, serializeProject } from "../model/serialize";
import type { Lang } from "../lib/i18n";

const LANGS: readonly Lang[] = ["de", "en"];

/** The project files in `examples/` and their language. */
const FILES: Record<Lang, string> = { de: "Beispielkueche-Restaurant.kplan", en: "Example-Kitchen-Restaurant.kplan" };

describe("exampleKitchen", () => {
  it.each(LANGS)("passes the plan check without a finding (%s)", (lang) => {
    expect(checkProject(exampleKitchen(lang))).toEqual([]);
  });

  it.each(LANGS)("survives saving and opening unchanged (%s)", (lang) => {
    const p = exampleKitchen(lang);
    expect(parseProject(serializeProject(p))).toEqual(p);
  });

  it("is the same project on every call, in both languages but for names and notes", () => {
    expect(serializeProject(exampleKitchen("de"))).toBe(serializeProject(exampleKitchen("de")));
    const strip = (lang: Lang) => exampleKitchen(lang).items.map(({ name: _n, note: _o, ...rest }) => rest);
    expect(strip("en")).toEqual(strip("de"));
    const ids = exampleKitchen("de").items.map((it) => it.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only catalog entries, with the sizes and variants they offer", () => {
    for (const it of exampleKitchen("de").items) {
      const entry = catalogEntry(it.catalogId);
      expect(entry, it.catalogId).toBeDefined();
      if (!entry) continue;
      expect([entry.width, ...(entry.widths ?? [])], `${it.id} ${it.catalogId}`).toContain(it.width);
      if (entry.energy) expect(entry.energy).toContain(it.energy);
    }
  });

  it("is all-electric: no unit is connected to gas", () => {
    for (const it of exampleKitchen("de").items) expect(it.connections.gasKw ?? 0, it.id).toBe(0);
  });

  it("keeps every unit inside the room and the floor units clear of each other", () => {
    const p = exampleKitchen("de");
    const fps = p.items.map((it) => footprint(it));
    p.items.forEach((it, i) => {
      for (const q of fps[i]) expect(pointInPolygon(q, p.room.points), `${it.id} ${it.catalogId}`).toBe(true);
    });
    const placements = p.items.map((it) => placementOf(kindOf(it.catalogId)));
    for (let i = 0; i < p.items.length; i++) {
      for (let j = i + 1; j < p.items.length; j++) {
        if (!collides(placements[i], placements[j])) continue;
        expect(convexOverlap(fps[i], fps[j]), `${p.items[i].id} / ${p.items[j].id}`).toBe(false);
      }
    }
  });

  it("has plausible key figures for a restaurant kitchen of about 120 covers", () => {
    const p = exampleKitchen("de");
    const totals = equipmentTotals(equipmentRows(p));
    const m2 = area(p.room.points) / 1e6;
    // The figures of examples/README.md.
    console.info(`example kitchen: ${m2.toFixed(1)} m², ${p.items.length} items`, totals);
    expect(m2).toBeGreaterThan(90);
    expect(m2).toBeLessThan(130);
    expect(totals.gasKw).toBe(0);
    expect(totals.electricKw).toBeGreaterThan(200);
    expect(totals.electricKw).toBeLessThan(450);
    expect(totals.exhaustM3h).toBeGreaterThan(8000);
    expect(totals.exhaustM3h).toBeLessThan(16000);
    expect(totals.coldWater).toBeGreaterThan(10);
    expect(totals.floorDrain).toBe(2);
  });

  it.skipIf(process.env.KPLAN_WRITE_EXAMPLES === "1").each(LANGS)("matches the file in examples/ (%s)", (lang) => {
    const path = resolve(__dirname, "../../../examples", FILES[lang]);
    // Line endings may change on checkout; the content may not.
    expect(readFileSync(path, "utf8").replace(/\r\n/g, "\n")).toBe(serializeProject(exampleKitchen(lang)));
  });

  // Regenerates the files in examples/: `KPLAN_WRITE_EXAMPLES=1 npx vitest run src/examples` in ui/.
  it.runIf(process.env.KPLAN_WRITE_EXAMPLES === "1")("writes the example project files", () => {
    for (const lang of LANGS) writeFileSync(resolve(__dirname, "../../../examples", FILES[lang]), serializeProject(exampleKitchen(lang)), "utf8");
  });
});
