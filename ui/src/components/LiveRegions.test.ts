import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LiveRegions } from "./LiveRegions";
import { toast } from "../lib/toast";
import { announce } from "../lib/announce";
import { setLang } from "../lib/i18n";
import { useStore } from "../store/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("LiveRegions", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLang("de");
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(createElement(LiveRegions)));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useStore.getState().setMode("arrange");
  });

  const polite = () => host.querySelector("[data-live=polite]")!;
  const assertive = () => host.querySelector("[data-live=assertive]")!;

  it("keeps both regions in the document before anything is said, as live regions need", () => {
    expect(polite().getAttribute("role")).toBe("status");
    expect(assertive().getAttribute("role")).toBe("alert");
    expect(assertive().getAttribute("aria-live")).toBe("assertive");
  });

  it("reads an error toast out assertively and a notice politely", () => {
    act(() => toast("Datei konnte nicht gespeichert werden.", "danger"));
    expect(assertive().textContent).toContain("Datei konnte nicht gespeichert werden.");
    expect(polite().textContent).not.toContain("Datei konnte nicht gespeichert werden.");
    act(() => toast("Gespeichert."));
    expect(polite().textContent).toContain("Gespeichert.");
    expect(assertive().textContent).not.toContain("Gespeichert.");
  });

  it("adds a repeated message as a new node, so it is read again", () => {
    act(() => announce("Um 90° gedreht"));
    act(() => announce("Um 90° gedreht"));
    expect([...polite().querySelectorAll("p")].filter((p) => p.textContent === "Um 90° gedreht")).toHaveLength(2);
  });

  it("says which mode the editor switched to", () => {
    act(() => useStore.getState().setMode("room"));
    expect(polite().textContent).toContain("Modus: Raum");
    act(() => useStore.getState().setMode("arrange"));
    expect(polite().lastElementChild?.textContent).toBe("Modus: Einrichten");
  });
});
