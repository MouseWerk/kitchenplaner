import { describe, expect, it } from "vitest";
import { CATALOG } from "../model/catalog";
import { matchesQuery } from "./CatalogPanel";
import { setLang } from "../lib/i18n";

const ids = (q: string) => CATALOG.filter((e) => matchesQuery(e, q)).map((e) => e.id);

describe("catalog search", () => {
  setLang("de");

  it("matches names, case-insensitively", () => {
    expect(ids("fritteuse")).toEqual(["fryer-2"]);
  });

  it("matches category names", () => {
    expect(ids("lüftung")).toEqual(["hood-wall", "hood-island"]);
  });

  it("matches dimensions with x or ×, and every word must match", () => {
    expect(ids("400x400")).toEqual(["column"]);
    expect(ids("400 × 400")).toContain("column");
    expect(ids("850x850x1050")).toEqual(["combi-10"]);
    expect(ids("kochen 1200")).toEqual(["range-6", "tilting-pan"]);
  });

  it("an empty query matches everything", () => {
    expect(ids("  ")).toHaveLength(CATALOG.length);
  });
});
