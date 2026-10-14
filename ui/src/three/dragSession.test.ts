import { beforeEach, describe, expect, it } from "vitest";
import { applyTransform, beginTransform, cancelActiveOperator, cancelTransform } from "../lib/commands";
import { testItem, testProject } from "../model/testProject";
import { useStore } from "../store/store";
import { canStartItemDrag, ItemDragSession } from "./dragSession";

const st = () => useStore.getState();
const x = () => st().project.items[0].x;

beforeEach(() => {
  st().load(testProject([testItem("a1", "table", 3000, 3000)]), "/a.kplan");
  st().select({ items: ["a1"] });
});

describe("3D item drags", () => {
  it("are one undo step however often they move", () => {
    const d = new ItemDragSession(["a1"], () => {});
    for (let i = 1; i <= 5; i++) d.move({ x: i * 100, y: 0 }, true);
    d.confirm();
    expect(x()).toBe(3500);
    expect(st().past).toHaveLength(1);
    expect(st().isGestureActive()).toBe(false);
    st().undo();
    expect(x()).toBe(3000);
  });

  it("cancel (Escape, leaving the mode or the view) puts everything back without an undo step", () => {
    const d = new ItemDragSession(["a1"], () => {});
    d.move({ x: 700, y: 0 }, true);
    d.cancel();
    expect(x()).toBe(3000);
    expect(st().past).toEqual([]);
    expect(st().dirty).toBe(false);
    expect(st().isGestureActive()).toBe(false);
  });

  it("are ended by the file commands like any operator", () => {
    let told = 0;
    const d = new ItemDragSession(["a1"], () => told++);
    d.move({ x: 700, y: 0 }, true);
    cancelActiveOperator();
    expect(x()).toBe(3000);
    expect(told).toBe(1);
    // The engine's later pointer up finds nothing left to end.
    d.confirm();
    expect(x()).toBe(3000);
    expect(st().past).toEqual([]);
  });

  // A 3D drag in the middle of a G in the plan used to start a second session on top of it.
  it("do not start while another operator runs or a tool step shows in the status bar", () => {
    expect(canStartItemDrag()).toBe(true);
    const s = beginTransform()!;
    applyTransform(s, (o) => ({ x: o.x + 100 }));
    expect(canStartItemDrag()).toBe(false);
    cancelTransform(s);
    st().setStatus("B");
    expect(canStartItemDrag()).toBe(false);
    st().setStatus(null);
    st().setMode("room");
    expect(canStartItemDrag()).toBe(false);
  });
});
