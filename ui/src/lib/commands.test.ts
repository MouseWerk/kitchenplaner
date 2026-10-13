import { beforeEach, describe, expect, it } from "vitest";
import { CATALOG } from "../model/catalog";
import { itemFromCatalog, newProject } from "../model/project";
import { useStore } from "../store/store";
import {
  applyTransform,
  beginDuplicate,
  beginTransform,
  cancelTransform,
  combineSelection,
  confirmTransform,
  rotateItemAround,
  selectionCentre,
} from "./commands";

const st = () => useStore.getState();

beforeEach(() => {
  st().load(newProject(new Date(2026, 9, 12)), null);
});

/** Two items, both selected, after one recorded step (the add). */
function twoItems() {
  const a = itemFromCatalog(CATALOG[0], 1000, 1000);
  const b = itemFromCatalog(CATALOG[0], 3000, 1000);
  st().addItems([a, b]);
  return [a, b];
}

describe("combineSelection", () => {
  it("replaces, adds and toggles", () => {
    expect(combineSelection(["a", "b"], ["c"], "replace")).toEqual(["c"]);
    expect(combineSelection(["a", "b"], ["b", "c"], "add")).toEqual(["a", "b", "c"]);
    expect(combineSelection(["a", "b"], ["b", "c"], "toggle")).toEqual(["a", "c"]);
  });
});

describe("rotation around a pivot", () => {
  it("turns position and rotation clockwise on the plan", () => {
    const [a] = twoItems();
    expect(rotateItemAround(a, { x: 2000, y: 1000 }, 90)).toEqual({ x: 2000, y: 0, rotation: 90 });
    expect(rotateItemAround({ ...a, rotation: 270 }, { x: 1000, y: 1000 }, 90)).toEqual({ x: 1000, y: 1000, rotation: 0 });
  });

  it("pivots a group around the centre of its box, a single item around itself", () => {
    const [a, b] = twoItems();
    expect(selectionCentre([a, b])).toEqual({ x: 2000, y: 1000 });
    expect(selectionCentre([a])).toEqual({ x: 1000, y: 1000 });
  });
});

describe("transform sessions (G, R, mouse drags)", () => {
  it("record the whole transform as one undo step", () => {
    const [a] = twoItems();
    const steps = st().past.length;
    const s = beginTransform()!;
    for (let i = 1; i <= 5; i++) applyTransform(s, (o) => ({ x: o.x + i * 100 }));
    confirmTransform(s);
    expect(st().past.length).toBe(steps + 1);
    expect(st().project.items.find((i) => i.id === a.id)!.x).toBe(1500);
    st().undo();
    expect(st().project.items.find((i) => i.id === a.id)!.x).toBe(1000);
  });

  it("cancel restores the exact state before, without an undo step", () => {
    twoItems();
    const before = st().project;
    const past = st().past;
    const s = beginTransform()!;
    applyTransform(s, (o) => rotateItemAround(o, { x: 0, y: 0 }, 45));
    cancelTransform(s);
    expect(st().project).toBe(before);
    expect(st().past).toBe(past);
    expect(st().isGestureActive()).toBe(false);
  });

  it("a transform that ends where it started leaves no undo step", () => {
    twoItems();
    const steps = st().past.length;
    const s = beginTransform()!;
    applyTransform(s, (o) => ({ x: o.x + 100 }));
    applyTransform(s, (o) => ({ x: o.x }));
    confirmTransform(s);
    expect(st().past.length).toBe(steps);
  });

  it("Shift+D adds copies and moves them in one undo step; cancel takes them away again", () => {
    const [a, b] = twoItems();
    const steps = st().past.length;
    const s = beginDuplicate()!;
    expect(st().project.items).toHaveLength(4);
    expect(st().selection.items).not.toContain(a.id);
    applyTransform(s, (o) => ({ y: o.y + 500 }));
    confirmTransform(s);
    expect(st().past.length).toBe(steps + 1);
    expect(st().project.items.filter((i) => i.y === 1500)).toHaveLength(2);
    st().undo();
    expect(st().project.items.map((i) => i.id)).toEqual([a.id, b.id]);

    st().select({ items: [a.id] });
    const c = beginDuplicate()!;
    cancelTransform(c);
    expect(st().project.items).toHaveLength(2);
    expect(st().selection.items).toEqual([a.id]);
  });

  it("start nothing without a selection", () => {
    expect(beginTransform()).toBeNull();
    expect(beginDuplicate()).toBeNull();
  });
});
