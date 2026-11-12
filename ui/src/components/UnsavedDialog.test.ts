import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { UnsavedDialog } from "./UnsavedDialog";
import { setLang } from "../lib/i18n";
import { askUnsaved, type UnsavedAnswer } from "../lib/unsaved";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].find((b) => b.textContent === label)!;

beforeEach(() => {
  setLang("de");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(createElement(UnsavedDialog)));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** Asks the question and waits until the dialog shows it; `answer` settles when it is answered. */
async function ask(name = "Kantine"): Promise<{ answer: Promise<UnsavedAnswer> }> {
  let answer!: Promise<UnsavedAnswer>;
  await act(async () => {
    answer = askUnsaved(name);
  });
  return { answer };
}

describe("the unsaved-changes dialog", () => {
  it("offers save, don't save and cancel, with the focus on saving", async () => {
    const { answer } = await ask();
    expect(dialog()?.textContent).toContain("„Kantine“");
    expect([...dialog()!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Nicht speichern", "Abbrechen", "Speichern"]);
    // Enter on the focused button keeps the work: it is „Speichern“, never „Nicht speichern“.
    expect(document.activeElement).toBe(button("Speichern"));
    act(() => button("Speichern").click());
    expect(await answer).toBe("save");
    expect(dialog()).toBeNull();
  });

  it("„Nicht speichern“ discards, Escape cancels", async () => {
    const { answer: first } = await ask();
    act(() => button("Nicht speichern").click());
    expect(await first).toBe("discard");
    const { answer: second } = await ask();
    act(() => void dialog()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(await second).toBe("cancel");
    expect(dialog()).toBeNull();
  });

  it("cancels a second question while the first is open", async () => {
    const { answer: first } = await ask();
    expect(await askUnsaved("Bar")).toBe("cancel");
    expect(dialog()?.textContent).toContain("„Kantine“");
    act(() => button("Abbrechen").click());
    expect(await first).toBe("cancel");
  });
});
