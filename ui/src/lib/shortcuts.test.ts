import { afterEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
vi.mock("./actions", () => ({
  saveFile: () => calls.push("save"),
  openFile: () => calls.push("open"),
  newFile: () => calls.push("new"),
}));

const { handleShortcut, isMac, setModeKeyHandler } = await import("./shortcuts");
const { useStore } = await import("../store/store");

afterEach(() => {
  calls.length = 0;
  document.body.innerHTML = "";
});

describe("file shortcuts", () => {
  it.each(["s", "o", "n"])("let a focused field apply its edit before Mod+%s runs", (k) => {
    const field = document.createElement("input");
    document.body.append(field);
    field.addEventListener("blur", () => calls.push("blur"));
    field.focus();
    const e = new KeyboardEvent("keydown", { key: k, ctrlKey: !isMac, metaKey: isMac, bubbles: true });
    field.dispatchEvent(e);
    expect(handleShortcut(e, () => {})).toBe(true);
    expect(calls).toEqual(["blur", k === "s" ? "save" : k === "o" ? "open" : "new"]);
  });
});

describe("mode key handler", () => {
  const press = (key: string, init: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
    return { e, handled: handleShortcut(e, () => calls.push("fit")) };
  };

  afterEach(() => {
    setModeKeyHandler(null);
    useStore.getState().setMode("arrange");
  });

  it("sees keys first and stops the generic shortcuts when it takes them", () => {
    const seen: string[] = [];
    setModeKeyHandler((e) => {
      seen.push(e.key);
      return e.key === "f";
    });
    const { e, handled } = press("f");
    expect(handled).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    expect(calls).toEqual([]);
    expect(press("1").handled).toBe(true);
    expect(seen).toEqual(["f", "1"]);
  });

  it("is not asked while typing in a field", () => {
    let asked = false;
    setModeKeyHandler(() => (asked = true));
    const field = document.createElement("input");
    document.body.append(field);
    const e = new KeyboardEvent("keydown", { key: "g", bubbles: true });
    field.dispatchEvent(e);
    handleShortcut(e, () => {});
    expect(asked).toBe(false);
  });

  it("is removed by its own cleanup only", () => {
    const first = () => true;
    const dispose = setModeKeyHandler(first);
    setModeKeyHandler(() => false);
    dispose();
    // The second handler is still registered and declines: the generic shortcut runs.
    expect(press("f").handled).toBe(true);
    expect(calls).toEqual(["fit"]);
  });

  it("leaves the editing keys to the room mode's handler", () => {
    useStore.getState().setMode("room");
    for (const key of ["a", "x", "Delete", "Escape", "r", "ArrowLeft"]) expect(press(key).handled, key).toBe(false);
    expect(press("a", { ctrlKey: !isMac, metaKey: isMac }).handled).toBe(false);
  });

  it("selects all with A and nothing with Alt+A in the arrange mode", () => {
    const st = useStore.getState();
    st.load({ ...st.project, items: [{ ...itemStub("i1", 1) }, { ...itemStub("i2", 2) }] }, null);
    press("a");
    expect(useStore.getState().selection.items).toEqual(["i1", "i2"]);
    press("a", { altKey: true, code: "KeyA" });
    expect(useStore.getState().selection.items).toEqual([]);
    useStore.getState().select({ items: ["i1"] });
    press("x");
    expect(useStore.getState().project.items.map((i) => i.id)).toEqual(["i2"]);
  });
});

function itemStub(id: string, pos = 1) {
  return { id, pos, catalogId: "x", name: id, x: 0, y: 0, rotation: 0, width: 600, depth: 600, height: 900, elevation: 0, connections: {} };
}
