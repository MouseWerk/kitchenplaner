import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RoomEditLayer } from "./RoomEditLayer";
import { setLang, t } from "../lib/i18n";
import { handleShortcut } from "../lib/shortcuts";
import { parseProject, serializeProject } from "../model/serialize";
import { testItem, testProject } from "../model/testProject";
import { useStore } from "../store/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The layer reads pointer positions relative to its box, which happy-dom puts at 0, 0: with this
// viewport a client pixel is 10 mm on the plan.
const VP = { k: 0.1, ox: 0, oy: 0 };

let host: HTMLDivElement;
let root: Root | null;
const st = () => useStore.getState();
const svg = () => host.querySelector("svg")!;

function mount() {
  root = createRoot(host);
  act(() => root!.render(createElement(RoomEditLayer, { vp: VP, width: 1000, height: 800, setVp: () => {} })));
}

function unmount() {
  act(() => root?.unmount());
  root = null;
}

/** A pointer event at plan millimetres `x`, `y`. */
function pointer(type: string, x: number, y: number, button = 0) {
  act(() => void svg().dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x * VP.k, clientY: y * VP.k, button, pointerId: 1 })));
}

const move = (x: number, y: number) => pointer("pointermove", x, y);
const click = (x: number, y: number) => {
  pointer("pointerdown", x, y);
  pointer("pointerup", x, y);
};
const leave = () => act(() => void svg().dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerId: 1 })));

function key(k: string) {
  const code = /^[0-9]$/.test(k) ? `Digit${k}` : k.length === 1 ? `Key${k.toUpperCase()}` : k;
  act(() => void handleShortcut(new KeyboardEvent("keydown", { key: k, code, bubbles: true }), () => {}));
}

beforeEach(() => {
  setLang("de");
  // happy-dom has no pointer capture; the layer only needs the call to exist.
  Element.prototype.setPointerCapture ??= () => {};
  host = document.createElement("div");
  document.body.append(host);
  st().load(testProject([testItem("a1", "table", 1000, 1000)]), "/a.kplan");
  st().setMode("room");
  mount();
});

afterEach(() => {
  unmount();
  host.remove();
});

describe("room mode G", () => {
  it("does not start without the cursor over the plan", () => {
    st().select({ corners: [1] });
    key("g");
    expect(st().isGestureActive()).toBe(false);
    move(4000, 3000);
    leave();
    key("g");
    expect(st().isGestureActive()).toBe(false);
    expect(st().project.room.points[1]).toEqual({ x: 8000, y: 0 });
    move(4000, 3000);
    key("g");
    expect(st().isGestureActive()).toBe(true);
    key("Escape");
  });

  it("keeps the last valid room where a corner would make none, and says why", () => {
    st().select({ corners: [0] });
    move(0, 0);
    key("g");
    move(1000, 1000);
    expect(st().project.room.points[0]).toEqual({ x: 1000, y: 1000 });
    // Onto the opposite corner: no floor left.
    move(8000, 6000);
    expect(st().project.room.points[0]).toEqual({ x: 1000, y: 1000 });
    expect(st().status).toContain(t("roomEdit.grabInvalid"));
    key("Enter");
    expect(st().project.room.points[0]).toEqual({ x: 1000, y: 1000 });
    // What was made opens again.
    expect(parseProject(serializeProject(st().project)).room.points).toEqual(st().project.room.points);
  });

  it("G, open another file, Escape: the other file stays", () => {
    st().select({ corners: [1] });
    move(8000, 0);
    key("g");
    move(8500, 0);
    expect(st().project.room.points[1]).toEqual({ x: 8500, y: 0 });
    const b = { ...testProject(), info: { ...testProject().info, name: "B" } };
    st().load(b, "/b.kplan");
    key("Escape");
    expect(st().project).toBe(b);
    expect(st().path).toBe("/b.kplan");
    expect(st().dirty).toBe(false);
  });

  it("leaving the mode in the middle cancels and brings no corner selection into the arrange mode", () => {
    st().select({ corners: [1] });
    move(8000, 0);
    key("g");
    move(8500, 0);
    st().setMode("arrange");
    // The plan unmounts the layer when the mode changes.
    unmount();
    expect(st().project.room.points[1]).toEqual({ x: 8000, y: 0 });
    expect(st().selection.corners).toEqual([]);
    expect(st().isGestureActive()).toBe(false);
    expect(st().past).toEqual([]);
  });
});

describe("outline tool", () => {
  it("closes the room when a typed last wall ends on the start point", () => {
    act(() => st().setRoomTool("outline"));
    click(1000, 1000);
    click(5000, 1000);
    click(5000, 4000);
    click(1000, 4000);
    // Towards the start, then 3000 typed: exactly onto the first point.
    move(1000, 2000);
    for (const k of "3000") key(k);
    key("Enter");
    expect(st().project.room.points).toEqual([
      { x: 1000, y: 1000 },
      { x: 5000, y: 1000 },
      { x: 5000, y: 4000 },
      { x: 1000, y: 4000 },
    ]);
  });
});
