import { beforeEach, describe, expect, it } from "vitest";
import { CATALOG } from "../kinds/registry";
import { itemFromCatalog, newProject } from "../model/project";
import { useStore } from "./store";
import { duplicateSelected, nudgeSelected, rotateSelected } from "../lib/commands";
import { parseNumber } from "../components/Fields";
import { num, setLang, type Lang } from "../lib/i18n";

const st = () => useStore.getState();

beforeEach(() => {
  st().load(newProject(new Date(2026, 9, 12)), null);
});

describe("undo history", () => {
  it("undoes and redoes an added item", () => {
    const it0 = itemFromCatalog(CATALOG[0], 1000, 1000);
    st().addItems([it0]);
    expect(st().project.items).toHaveLength(1);
    expect(st().dirty).toBe(true);
    st().undo();
    expect(st().project.items).toHaveLength(0);
    expect(st().selection.items).toEqual([]);
    st().redo();
    expect(st().project.items).toHaveLength(1);
  });

  it("records a whole drag as one step", () => {
    const it0 = itemFromCatalog(CATALOG[0], 1000, 1000);
    st().addItems([it0]);
    st().beginGesture();
    for (let i = 1; i <= 5; i++) st().updateItems([it0.id], () => ({ x: 1000 + i * 100 }), { gesture: true });
    expect(st().project.items[0].x).toBe(1500);
    st().endGesture();
    st().undo();
    expect(st().project.items[0].x).toBe(1000);
  });

  it("ignores undo and redo while a drag is in progress", () => {
    const it0 = itemFromCatalog(CATALOG[0], 1000, 1000);
    st().addItems([it0]);
    st().beginGesture();
    st().updateItems([it0.id], () => ({ x: 1100 }), { gesture: true });
    expect(st().isGestureActive()).toBe(true);
    st().undo();
    expect(st().project.items[0].x).toBe(1100);
    st().updateItems([it0.id], () => ({ x: 1200 }), { gesture: true });
    st().endGesture();
    expect(st().isGestureActive()).toBe(false);
    // The whole drag is still one step, and the item is still there to undo after it.
    st().undo();
    expect(st().project.items[0].x).toBe(1000);
    st().undo();
    expect(st().project.items).toHaveLength(0);
  });

  it("ignores redo while a drag is in progress", () => {
    const it0 = itemFromCatalog(CATALOG[0], 1000, 1000);
    st().addItems([it0]);
    st().undo();
    st().beginGesture();
    st().redo();
    expect(st().project.items).toHaveLength(0);
    st().endGesture();
    st().redo();
    expect(st().project.items).toHaveLength(1);
  });

  it("drops the redo steps after a change that is not recorded", () => {
    const a = itemFromCatalog(CATALOG[0], 1000, 1000);
    st().addItems([a]);
    st().addItems([itemFromCatalog(CATALOG[1], 0, 0)]);
    st().undo();
    expect(st().future).toHaveLength(1);
    // A gesture change without `beginGesture` joins the previous step instead of recording one.
    st().updateItems([a.id], () => ({ x: 1500 }), { gesture: true });
    expect(st().future).toHaveLength(0);
  });

  it("drops the redo steps after a new change", () => {
    const it0 = itemFromCatalog(CATALOG[0], 1000, 1000);
    st().addItems([it0]);
    st().undo();
    st().addItems([itemFromCatalog(CATALOG[1], 0, 0)]);
    expect(st().future).toHaveLength(0);
  });

  it("starts clean after loading", () => {
    st().addItems([itemFromCatalog(CATALOG[0], 0, 0)]);
    st().load(newProject(), "C:/x.kplan");
    expect(st()).toMatchObject({ dirty: false, past: [], future: [], path: "C:/x.kplan" });
  });

  it("counts loads, also of an untouched new project", () => {
    const before = st().loadCount;
    st().load(newProject(), null);
    st().load(newProject(), null);
    expect(st().loadCount).toBe(before + 2);
  });
});

describe("selection commands", () => {
  it("rotates, nudges, duplicates and deletes the selection", () => {
    const a = itemFromCatalog(CATALOG[0], 1000, 1000);
    st().addItems([a]);
    rotateSelected(90);
    expect(st().project.items[0].rotation).toBe(90);
    rotateSelected(-180);
    expect(st().project.items[0].rotation).toBe(270);
    nudgeSelected(10, -100);
    expect(st().project.items[0]).toMatchObject({ x: 1010, y: 900 });
    duplicateSelected();
    expect(st().project.items).toHaveLength(2);
    expect(st().selection.items).toEqual([st().project.items[1].id]);
    expect(st().project.items[1].id).not.toBe(a.id);
    st().removeSelected();
    expect(st().project.items.map((i) => i.id)).toEqual([a.id]);
  });

  it("removes a selected opening", () => {
    const door = st().project.room.openings[0];
    st().select({ opening: door.id });
    st().removeSelected();
    expect(st().project.room.openings).toHaveLength(0);
  });
});

describe("parseNumber", () => {
  const langs: Lang[] = ["de", "en"];

  it.each(langs)("reads unambiguous numbers in either style (%s)", (lang) => {
    expect(parseNumber("1.200,5", lang)).toBe(1200.5);
    expect(parseNumber("1,200.5", lang)).toBe(1200.5);
    expect(parseNumber("850", lang)).toBe(850);
    expect(parseNumber("0,5", lang)).toBe(0.5);
    expect(parseNumber("0.5", lang)).toBe(0.5);
    expect(parseNumber("-12,5", lang)).toBe(-12.5);
    expect(parseNumber("900 mm", lang)).toBe(900);
    expect(parseNumber("1,2,3", lang)).toBeNull();
    expect(parseNumber("", lang)).toBeNull();
    expect(parseNumber("abc", lang)).toBeNull();
  });

  it("reads a lone separator as the display language uses it", () => {
    expect(parseNumber("1.200", "de")).toBe(1200);
    expect(parseNumber("1,200", "de")).toBe(1.2);
    expect(parseNumber("1,200", "en")).toBe(1200);
    expect(parseNumber("1.200", "en")).toBe(1.2);
    expect(parseNumber("1.234.567", "de")).toBe(1234567);
  });

  it.each(langs)("reads back every number as shown (%s)", (lang) => {
    setLang(lang);
    try {
      for (const v of [0, 5, 999, 1000, 1200, 12345, 100000, 1234567, -1200]) expect(parseNumber(num(v), lang)).toBe(v);
      for (const v of [0.5, 1200.5, 12345.67, 100000.1]) expect(parseNumber(num(v, 2), lang)).toBe(v);
      // The default language is the shown one.
      expect(parseNumber(num(1200))).toBe(1200);
    } finally {
      setLang("de");
    }
  });
});
