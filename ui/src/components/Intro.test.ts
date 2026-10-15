import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Intro, INTRO_STEPS, openExampleKitchen } from "./Intro";
import { introSeen, openIntro, resetIntroForTests } from "../lib/intro";
import { setLang } from "../lib/i18n";
import { handleShortcut } from "../lib/shortcuts";
import { newProject } from "../model/project";
import { useStore } from "../store/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root | null = null;
const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
const buttons = () => [...(dialog()?.querySelectorAll("button") ?? [])];
const button = (text: string) => buttons().find((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").includes(text))!;
const keydown = (el: Element, key: string, shiftKey = false) => act(() => void el.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true })));

function mount() {
  root = createRoot(host);
  act(() => root!.render(createElement(Intro)));
}

function unmount() {
  act(() => root?.unmount());
  root = null;
}

beforeEach(() => {
  setLang("de");
  localStorage.clear();
  resetIntroForTests();
  useStore.getState().load(newProject(new Date(2026, 9, 15)), null);
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmount();
  host.remove();
  document.body.innerHTML = "";
});

describe("the introduction", () => {
  it("shows on the first start only", () => {
    expect(introSeen()).toBe(false);
    mount();
    expect(dialog()).not.toBeNull();
    expect(dialog()!.getAttribute("aria-modal")).toBe("true");
    expect(introSeen()).toBe(true);
    keydown(dialog()!, "Escape");
    expect(dialog()).toBeNull();
    unmount();
    // The next start (a new session with the same storage) does not show it again.
    resetIntroForTests();
    mount();
    expect(dialog()).toBeNull();
    expect(localStorage.getItem("kitchenplaner.intro.v1")).toBe("seen");
  });

  it("opens again on request and walks through every step", () => {
    localStorage.setItem("kitchenplaner.intro.v1", "seen");
    mount();
    expect(dialog()).toBeNull();
    act(() => openIntro());
    expect(dialog()!.textContent).toContain(`Schritt 1 von ${INTRO_STEPS.length}`);
    for (let i = 1; i < INTRO_STEPS.length; i++) act(() => button("Weiter").click());
    expect(dialog()!.textContent).toContain(`Schritt ${INTRO_STEPS.length} von ${INTRO_STEPS.length}`);
    act(() => button("Zurück").click());
    expect(dialog()!.textContent).toContain(`Schritt ${INTRO_STEPS.length - 1} von`);
    act(() => button("Weiter").click());
    act(() => button("Los geht’s").click());
    expect(dialog()).toBeNull();
  });

  it("shows the keys as this computer labels them", () => {
    mount();
    act(() => button("Weiter").click());
    act(() => button("Weiter").click());
    const keys = [...dialog()!.querySelectorAll("kbd")].map((k) => k.textContent);
    expect(keys).toEqual(["G", "R", "X / Y", "0–9", "Eingabe", "Esc"]);
  });

  it("keeps the focus inside and gives it back when it closes", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    mount();
    const list = buttons();
    // Starts on the main button; Tab from the last wraps to the first and back.
    expect(document.activeElement).toBe(button("Weiter"));
    list[list.length - 1].focus();
    keydown(list[list.length - 1], "Tab");
    expect(document.activeElement).toBe(list[0]);
    keydown(list[0], "Tab", true);
    expect(document.activeElement).toBe(list[list.length - 1]);
    act(() => button("Schließen").click());
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(outside);
  });

  it("holds the app's shortcuts while it is open", () => {
    mount();
    const layout = useStore.getState().layout;
    act(() => void handleShortcut(new KeyboardEvent("keydown", { key: "3", bubbles: true }), () => {}));
    expect(useStore.getState().layout).toBe(layout);
  });

  it("opens the example kitchen in the display language", async () => {
    mount();
    await act(async () => {
      button("Beispielküche öffnen").click();
      await new Promise((r) => setTimeout(r, 50));
    });
    await act(async () => {
      for (let i = 0; i < 50 && useStore.getState().project.items.length === 0; i++) await new Promise((r) => setTimeout(r, 20));
    });
    const st = useStore.getState();
    expect(st.project.items.length).toBeGreaterThan(20);
    expect(st.project.info.name).toMatch(/Restaurant/);
    expect(st.dirty).toBe(false);
    expect(dialog()).toBeNull();
    setLang("en");
    await act(async () => void (await openExampleKitchen()));
    expect(useStore.getState().project.items.find((i) => i.note)?.note).not.toMatch(/[äöü]|Kochwand|Lager/);
  });
});
