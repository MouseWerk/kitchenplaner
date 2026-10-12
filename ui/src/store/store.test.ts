import { beforeEach, describe, expect, it } from "vitest";
import { CATALOG } from "../model/catalog";
import { itemFromCatalog, newProject } from "../model/project";
import { useStore } from "./store";
import { duplicateSelected, nudgeSelected, rotateSelected } from "../lib/commands";
import { parseNumber } from "../components/Fields";

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
    st().undo();
    expect(st().project.items[0].x).toBe(1000);
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
  it("reads German and English number styles", () => {
    expect(parseNumber("1.200,5")).toBe(1200.5);
    expect(parseNumber("1,200.5")).toBe(1200.5);
    expect(parseNumber("850")).toBe(850);
    expect(parseNumber("0,5")).toBe(0.5);
    expect(parseNumber("900 mm")).toBe(900);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
});
