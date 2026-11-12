import { afterEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const announced = vi.hoisted(() => [] as string[]);
vi.mock("./announce", () => ({ announce: (text: string) => announced.push(text) }));
vi.mock("./actions", () => ({
  saveFile: () => calls.push("save"),
  openFile: () => calls.push("open"),
  newFile: () => calls.push("new"),
}));

const { handleShortcut, isMac, setModeKeyHandler } = await import("./shortcuts");
const { useStore } = await import("../store/store");
const { setLang } = await import("./i18n");

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

/** A key pressed on `target` (in the document), as the window's listener sees it. */
function keyOn(target: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return { e, handled: handleShortcut(e, () => calls.push("fit")) };
}

/** The last thing read out to screen readers. */
const lastAnnounced = () => announced.at(-1);

describe("Tab and the editing modes", () => {
  afterEach(() => useStore.getState().setMode("arrange"));

  const views = () => {
    document.body.innerHTML = `<main class="views"><section class="pane"><div class="pane-head"><button id="cut">Wand</button></div><div class="pane-body"><div id="plan" tabindex="0" data-drawing></div></div></section></main><input id="field">`;
    return { plan: document.getElementById("plan")!, cut: document.getElementById("cut")!, field: document.getElementById("field")! };
  };

  it("switches the mode while the drawing has the focus", () => {
    const { plan } = views();
    const { e, handled } = keyOn(plan, "Tab");
    expect(handled).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    expect(useStore.getState().mode).toBe("room");
    keyOn(plan, "Tab");
    expect(useStore.getState().mode).toBe("arrange");
  });

  it("moves the focus from a button inside the views, a field or the body, and keeps the mode", () => {
    const { cut, field } = views();
    for (const target of [cut, field, document.body]) {
      const { e, handled } = keyOn(target, "Tab");
      expect(handled, target.id || target.tagName).toBe(false);
      expect(e.defaultPrevented).toBe(false);
      expect(useStore.getState().mode).toBe("arrange");
    }
  });

  it("leaves Shift+Tab to the focus also on the drawing", () => {
    const { plan } = views();
    expect(keyOn(plan, "Tab", { shiftKey: true }).handled).toBe(false);
    expect(useStore.getState().mode).toBe("arrange");
  });
});

describe("F6 between the regions", () => {
  const layout = () => {
    document.body.innerHTML = `
      <header class="toolbar"><button id="new">Neu</button></header>
      <aside class="sidebar"><input id="search"><button id="row" tabindex="-1">Herd</button></aside>
      <main class="views"><div id="plan" tabindex="0" data-drawing></div><button id="cut">Wand</button></main>
      <aside class="inspector"><button id="del" disabled>Löschen</button><input id="name"></aside>`;
  };
  const focused = () => (document.activeElement as HTMLElement).id;

  it("goes forward with F6 and back with Shift+F6, also out of a field, wrapping around", () => {
    layout();
    expect(keyOn(document.body, "F6").handled).toBe(true);
    expect(focused()).toBe("new");
    keyOn(document.activeElement as HTMLElement, "F6");
    expect(focused()).toBe("search");
    keyOn(document.activeElement as HTMLElement, "F6");
    // The drawing itself, not the first button of the pane.
    expect(focused()).toBe("plan");
    keyOn(document.activeElement as HTMLElement, "F6");
    // Disabled controls are skipped.
    expect(focused()).toBe("name");
    keyOn(document.activeElement as HTMLElement, "F6");
    expect(focused()).toBe("new");
    keyOn(document.activeElement as HTMLElement, "F6", { shiftKey: true });
    expect(focused()).toBe("name");
  });
});

describe("arrows on a toolbar", () => {
  afterEach(() => useStore.getState().select({ items: [] }));

  it("move the focus between its buttons instead of nudging the selection", () => {
    const st = useStore.getState();
    st.load({ ...st.project, items: [itemStub("i1", 1)] }, null);
    useStore.getState().select({ items: ["i1"] });
    document.body.innerHTML = `<div role="toolbar"><button id="a">A</button><button id="b" disabled>B</button><button id="c">C</button></div><div class="seg" role="group"><button id="x">X</button><button id="y">Y</button></div>`;
    const el = (id: string) => document.getElementById(id)!;
    el("a").focus();
    expect(keyOn(el("a"), "ArrowRight").handled).toBe(true);
    expect(document.activeElement).toBe(el("c"));
    keyOn(el("c"), "ArrowRight");
    expect(document.activeElement).toBe(el("a"));
    keyOn(el("a"), "End");
    expect(document.activeElement).toBe(el("c"));
    keyOn(el("c"), "Home");
    expect(document.activeElement).toBe(el("a"));
    keyOn(el("x"), "ArrowLeft");
    expect(document.activeElement).toBe(el("y"));
    // The item did not move.
    expect(useStore.getState().project.items[0].x).toBe(0);
  });
});

describe("keyboard selection and what is read out", () => {
  afterEach(() => {
    announced.length = 0;
    useStore.getState().select({ items: [] });
  });

  it("N and Shift+N step through the items by position number", () => {
    setLang("de");
    const st = useStore.getState();
    st.load({ ...st.project, items: [itemStub("b", 3), itemStub("a", 1), itemStub("c", 7)] }, null);
    const press = (init: KeyboardEventInit = {}) => keyOn(document.body, "n", init).handled;
    expect(press()).toBe(true);
    expect(useStore.getState().selection.items).toEqual(["a"]);
    expect(lastAnnounced()).toBe("Pos. 1 a ausgewählt, 1 von 3");
    press();
    expect(useStore.getState().selection.items).toEqual(["b"]);
    press();
    press();
    expect(useStore.getState().selection.items).toEqual(["a"]);
    press({ shiftKey: true });
    expect(useStore.getState().selection.items).toEqual(["c"]);
    expect(lastAnnounced()).toBe("Pos. 7 c ausgewählt, 3 von 3");
  });

  it("reads out deleting, rotating and selecting everything", () => {
    setLang("de");
    const st = useStore.getState();
    st.load({ ...st.project, items: [itemStub("a", 1), itemStub("b", 2)] }, null);
    keyOn(document.body, "a");
    expect(lastAnnounced()).toBe("2 Geräte ausgewählt");
    keyOn(document.body, "r");
    expect(lastAnnounced()).toBe("Um 90° gedreht");
    keyOn(document.body, "Delete");
    expect(lastAnnounced()).toBe("2 Geräte gelöscht");
    expect(useStore.getState().project.items).toEqual([]);
  });
});

function itemStub(id: string, pos = 1) {
  return { id, pos, catalogId: "x", name: id, x: 0, y: 0, rotation: 0, width: 600, depth: 600, height: 900, elevation: 0, connections: {} };
}
