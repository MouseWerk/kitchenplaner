import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RoomEditLayer, wallDimMarks, wallLengthLabels } from "./RoomEditLayer";
import { SCREEN_PAPER_SCALE } from "../components/DrawingSvg";
import { wallDim } from "../model/plan";
import { expandDim } from "../render/drawing";
import { exampleKitchen } from "../examples/exampleKitchen";
import { dot, pointInPolygon, sub, walls } from "../model/geometry";
import { toScreen, toWorld } from "../lib/viewport";
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

describe("wallLengthLabels", () => {
  const p = exampleKitchen("de");
  const room = p.room;

  it.each([0.02, 0.08, 0.3])("puts every label outside the room beyond the wall, along it, none over another (k %f)", (k) => {
    const vp = { k, ox: 50, oy: 40 };
    const labels = wallLengthLabels(room, vp);
    const ws = walls(room);
    for (const l of labels) {
      const w = ws[l.index];
      const at = toWorld(vp, l.p);
      // Outside the inner outline, beyond the outer face of its own wall.
      expect(pointInPolygon(at, room.points)).toBe(false);
      expect(-dot(sub(at, w.a), w.inward)).toBeGreaterThan(room.wallThickness);
      // Along the wall, readable: horizontal walls 0 degrees, vertical ones 90.
      expect(Math.abs(l.angle)).toBe(Math.abs(w.dir.x) > 0.5 ? 0 : 90);
    }
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) expect(Math.hypot(labels[i].p.x - labels[j].p.x, labels[i].p.y - labels[j].p.y)).toBeGreaterThan(12);
  });

  it("labels every wall at a usual zoom in plain millimetres, as the plan's dimensions write them", () => {
    const vp = { k: 0.2, ox: 0, oy: 0 };
    const labels = wallLengthLabels(room, vp);
    expect(labels.map((l) => l.text)).toEqual(["13200", "6400", "6900", "3200", "6300", "9600"]);
    const dims = walls(room).map((w) => wallDim(room, w, SCREEN_PAPER_SCALE).text);
    expect(labels.map((l) => l.text)).toEqual(dims);
    // The north wall: outer face at y -300, the label (12 px high) 4 px clear of it.
    expect(toWorld(vp, labels[0].p).y).toBeCloseTo(-300 - 10 / 0.2);
  });

  it("leaves out the labels of walls too short on screen", () => {
    expect(wallLengthLabels(room, { k: 0.003, ox: 0, oy: 0 })).toEqual([]);
  });
});

describe("wallDimMarks", () => {
  const room = exampleKitchen("de").room;

  it.each([0.02, 0.08, 0.3])("marks the plan's own dimension text of each wall asked for (k %f)", (k) => {
    const vp = { k, ox: 50, oy: 40 };
    const ws = walls(room);
    const marks = wallDimMarks(room, vp, ws.map((w) => w.index), SCREEN_PAPER_SCALE);
    expect(marks.map((m) => m.index)).toEqual(ws.map((w) => w.index));
    for (const m of marks) {
      const text = expandDim(wallDim(room, ws[m.index], SCREEN_PAPER_SCALE), SCREEN_PAPER_SCALE).text;
      // The text's middle (half an x-height above its baseline point, across the text) lies in
      // the mark, the wall's middle does not: the mark sits on the dimension, not on the wall.
      const r = ((text.angle ?? 0) * Math.PI) / 180;
      const up = { x: Math.sin(r), y: -Math.cos(r) };
      const mid = { x: text.p.x + up.x * 0.36 * text.size * SCREEN_PAPER_SCALE, y: text.p.y + up.y * 0.36 * text.size * SCREEN_PAPER_SCALE };
      expect(pointInPolygon(toWorld(vp, toScreen(vp, mid)), m.pts.map((q) => toWorld(vp, q)))).toBe(true);
      const wallMid = { x: (ws[m.index].a.x + ws[m.index].b.x) / 2, y: (ws[m.index].a.y + ws[m.index].b.y) / 2 };
      expect(pointInPolygon(wallMid, m.pts.map((q) => toWorld(vp, q)))).toBe(false);
    }
  });
});

describe("room mode wall lengths", () => {
  // A tool left on by an earlier test would draw instead of hovering.
  beforeEach(() => act(() => st().setRoomTool("select")));
  const labels = () => [...host.querySelectorAll("text.room-label")].map((x) => x.textContent);

  it("with the plan's dimensions shown draws no length labels of its own and marks the selected wall's dimension", () => {
    act(() => st().setPrefs({ showDims: true }));
    expect(labels()).toEqual([]);
    expect(host.querySelectorAll(".room-dim-mark")).toHaveLength(0);
    act(() => st().select({ corners: [0, 1] }));
    expect(host.querySelectorAll(".room-dim-mark.is-selected")).toHaveLength(1);
  });

  it("marks the hovered wall's dimension, neutral and lighter than the selected one", () => {
    act(() => st().setPrefs({ showDims: true }));
    const room = st().project.room;
    const w = walls(room)[0];
    // In the middle of the wall band, half the thickness out from the inner face.
    const out = room.wallThickness / 2;
    move((w.a.x + w.b.x) / 2 - w.inward.x * out, (w.a.y + w.b.y) / 2 - w.inward.y * out);
    expect(host.querySelectorAll(".room-dim-mark.is-hover")).toHaveLength(1);
  });

  it("without the dimensions labels the walls in plain millimetres", () => {
    act(() => st().setPrefs({ showDims: false }));
    const lengths = walls(st().project.room).map((w) => String(Math.round(w.length)));
    expect(labels().length).toBeGreaterThan(0);
    for (const l of labels()) expect(lengths).toContain(l);
    expect(host.querySelectorAll(".room-dim-mark")).toHaveLength(0);
    act(() => st().setPrefs({ showDims: true }));
  });
});
