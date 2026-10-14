import { beforeEach, describe, expect, it } from "vitest";
import { CATALOG } from "../kinds/registry";
import { itemFromCatalog, newProject } from "../model/project";
import { testItem, testProject } from "../model/testProject";
import { useStore } from "../store/store";
import {
  applyTransform,
  beginDuplicate,
  beginTransform,
  cancelActiveOperator,
  cancelTransform,
  combineSelection,
  confirmTransform,
  registerOperator,
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

// A cancel used to put back the whole snapshot of the start: after an open, a save or an edit
// from elsewhere in the middle of the operator that brought back the old project under the new
// path, or claimed it saved.
describe("transform sessions and changes from elsewhere", () => {
  const named = (name: string, ...items: ReturnType<typeof testItem>[]) => ({ ...testProject(items), info: { ...testProject().info, name } });

  beforeEach(() => {
    st().load(named("A", testItem("a1", "table", 1000, 1000)), "/a.kplan");
    st().select({ items: ["a1"] });
  });

  it("G, open another file, Escape: the other file stays open, untouched", () => {
    const s = beginTransform()!;
    applyTransform(s, (o) => ({ x: o.x + 500 }));
    const b = named("B", testItem("b1", "table", 0, 0));
    st().load(b, "/b.kplan");
    cancelTransform(s);
    expect(st().project).toBe(b);
    expect(st().path).toBe("/b.kplan");
    expect(st().dirty).toBe(false);
    expect(st().past).toEqual([]);
    expect(st().isGestureActive()).toBe(false);
  });

  it("G, open another file, confirm without a move: the other file stays open", () => {
    const s = beginTransform()!;
    const b = named("B", testItem("b1", "table", 0, 0));
    st().load(b, "/b.kplan");
    confirmTransform(s);
    expect(st().project).toBe(b);
    expect(st().path).toBe("/b.kplan");
  });

  it("G, save, Escape: the move is taken back and the project counts as changed", () => {
    const s = beginTransform()!;
    applyTransform(s, (o) => ({ x: o.x + 500 }));
    st().markSaved("/a.kplan");
    cancelTransform(s);
    // The file holds x 1500; what is shown (1000) differs from it, so a later save must not be skipped.
    expect(st().project.items[0].x).toBe(1000);
    expect(st().dirty).toBe(true);
  });

  it("G without a move, save, Escape: nothing differs from the file", () => {
    const s = beginTransform()!;
    st().markSaved("/a.kplan");
    cancelTransform(s);
    expect(st().dirty).toBe(false);
  });

  it("G, an edit in the inspector, Escape: the edit stays and stays undoable", () => {
    const s = beginTransform()!;
    applyTransform(s, (o) => ({ x: o.x + 500 }));
    st().updateItems(["a1"], () => ({ name: "Pass" }));
    const edited = st().project;
    cancelTransform(s);
    expect(st().project).toBe(edited);
    expect(st().project.items[0].name).toBe("Pass");
    expect(st().dirty).toBe(true);
    expect(st().past.length).toBeGreaterThan(0);
    expect(st().isGestureActive()).toBe(false);
  });

  it("a mode switch in the middle cancels without bringing the old mode's selection along", () => {
    const s = beginTransform()!;
    applyTransform(s, (o) => ({ x: o.x + 500 }));
    st().setMode("room");
    cancelTransform(s);
    expect(st().project.items[0].x).toBe(1000);
    expect(st().mode).toBe("room");
    expect(st().selection.items).toEqual([]);
  });

  it("the file commands end a running operator first", async () => {
    const s = beginTransform()!;
    applyTransform(s, (o) => ({ x: o.x + 500 }));
    let cancelled = 0;
    const done = registerOperator(() => {
      cancelled++;
      cancelTransform(s);
    });
    cancelActiveOperator();
    expect(cancelled).toBe(1);
    expect(st().project.items[0].x).toBe(1000);
    // Once ended, the operator is gone: a second cancel does nothing, nor does its late unregister.
    cancelActiveOperator();
    done();
    expect(cancelled).toBe(1);
  });
});
