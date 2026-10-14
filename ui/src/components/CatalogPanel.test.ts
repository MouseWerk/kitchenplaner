import { describe, expect, it } from "vitest";
import { CATALOG, catalogEntry } from "../kinds/registry";
import { matchesQuery } from "./CatalogPanel";
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
    expect(ids("gully")).toEqual(["floor-drain"]);
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
