import { describe, expect, it } from "vitest";
import { CATALOG, catalogEntry, SUBGROUPS } from "../kinds/registry";
import { matchesQuery, subgroupsOf } from "./CatalogPanel";
import { setLang, t as translate } from "../lib/i18n";

const ids = (q: string) => CATALOG.filter((e) => matchesQuery(e, q)).map((e) => e.id);
const dims = (id: string) => {
  const e = catalogEntry(id)!;
  return `${e.width}x${e.depth}x${e.height}`;
};

// The catalog grows, so these check what must and must not be found rather than the whole list.
describe("catalog search", () => {
  setLang("de");

  it("matches names and tags, case-insensitively", () => {
    const found = ids("FRITTEUSE");
    expect(found).toEqual(expect.arrayContaining(["fryer-1", "fryer-2"]));
    expect(found).not.toContain("range-4");
    // Everything found is a fryer by its name or its search words.
    for (const id of found) {
      const e = catalogEntry(id)!;
      expect([translate(e.name), ...(e.tags ?? [])].join(" ").toLocaleLowerCase()).toContain("fritteuse");
    }
    // A tag finds the unit although its name does not say it.
    expect(ids("gully")).toEqual(expect.arrayContaining(["floor-drain", "floor-gully"]));
    for (const id of ids("gully")) {
      const e = catalogEntry(id)!;
      expect([translate(e.name), ...(e.tags ?? [])].join(" ").toLocaleLowerCase()).toContain("gully");
    }
  });

  it("matches category names", () => {
    const found = ids("lüftung");
    // Every unit of the group, and no unit of another group unless its words name it.
    const group = CATALOG.filter((e) => e.category === "ventilation").map((e) => e.id);
    expect(group.length).toBeGreaterThan(0);
    expect(found).toEqual(expect.arrayContaining(group));
    for (const id of found.filter((i) => !group.includes(i))) {
      const e = catalogEntry(id)!;
      expect([translate(e.name), ...(e.tags ?? [])].join(" ").toLocaleLowerCase()).toContain("lüftung");
    }
    expect(found).not.toContain("range-4");
    expect(found).not.toContain("column");
  });

  it("matches dimensions with x or ×, and every word must match", () => {
    expect(ids("400x400")).toEqual(expect.arrayContaining(["column", "column-round"]));
    expect(ids("400x400")).not.toContain("shaft");
    for (const id of ids("400x400")) expect(dims(id)).toContain("400x400");
    expect(ids("400 × 400")).toContain("column");
    expect(ids("850x850x1050")).toContain("combi-10");
    for (const id of ids("850x850x1050")) expect(dims(id)).toBe("850x850x1050");
    const cooking1200 = ids("kochen 1200");
    expect(cooking1200).toEqual(expect.arrayContaining(["range-6", "tilting-pan"]));
    // Both words must match: a cooking unit of another size and a 1200 table are not found.
    expect(cooking1200).not.toContain("range-4");
    expect(cooking1200).not.toContain("table");
    for (const id of cooking1200) expect(catalogEntry(id)!.category).toBe("cooking");
    expect(ids("fritteuse lüftung")).toEqual([]);
  });

  it("an empty query matches everything", () => {
    expect(ids("  ")).toHaveLength(CATALOG.length);
  });
});

describe("catalog sub-groups", () => {
  it("splits a large group into its sub-groups in their order, keeping every entry once", () => {
    const cooking = CATALOG.filter((e) => e.category === "cooking");
    const parts = subgroupsOf("cooking", cooking);
    expect(parts.map((p) => p.id)).toEqual(SUBGROUPS.cooking);
    expect(parts.flatMap((p) => p.entries).map((e) => e.id).sort()).toEqual(cooking.map((e) => e.id).sort());
    expect(parts[0].entries.map((e) => e.id)).toContain("range-6");
    expect(parts.find((p) => p.id === "line700")!.entries.map((e) => e.id)).toContain("fryer-700");
  });

  it("leaves out empty sub-groups and does not divide a small group", () => {
    const found = CATALOG.filter((e) => e.category === "cooking" && matchesQuery(e, "fritteuse"));
    expect(subgroupsOf("cooking", found).map((p) => p.id)).toEqual(["line900", "line700"]);
    const tables = CATALOG.filter((e) => e.category === "tables");
    expect(subgroupsOf("tables", tables)).toEqual([{ id: null, entries: tables }]);
  });
});
