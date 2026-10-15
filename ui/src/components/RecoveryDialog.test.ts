import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, Fragment, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { introSeen, resetIntroForTests } from "../lib/intro";
import { setLang } from "../lib/i18n";
import type { Recoverable } from "../lib/autosave";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The backups an earlier run left, and what restoring does.
const backups = vi.hoisted(() => ({ found: [] as Recoverable[], restored: 0 }));
vi.mock("../lib/autosave", async (orig) => ({
  ...(await orig<typeof import("../lib/autosave")>()),
  findRecoverable: async () => backups.found,
  restoreBackup: async () => {
    backups.restored++;
    return true;
  },
}));

const { RecoveryDialog } = await import("./RecoveryDialog");
const { Intro } = await import("./Intro");

const BACKUP: Recoverable = { id: "b1", path: null, name: "Kantine", savedAt: Date.UTC(2026, 9, 14, 10), appVersion: "0.2.0", pathExists: false };

/** The two start dialogs as the app wires them. */
function Start() {
  const [settled, setSettled] = useState(false);
  return createElement(Fragment, null, createElement(RecoveryDialog, { onSettled: () => setSettled(true) }), createElement(Intro, { ready: settled }));
}

let host: HTMLDivElement;
let root: Root;
const dialogs = () => [...document.querySelectorAll<HTMLElement>("[role=dialog]")];
const title = (d: HTMLElement) => document.getElementById(d.getAttribute("aria-labelledby")!)!.textContent;

beforeEach(() => {
  setLang("de");
  localStorage.clear();
  resetIntroForTests();
  backups.found = [];
  backups.restored = 0;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("the start dialogs", () => {
  it("open the introduction only after the recovery question is answered", async () => {
    backups.found = [BACKUP];
    await act(async () => root.render(createElement(Start)));
    // Only the question about the backup, and the introduction is not used up yet.
    expect(dialogs().map(title)).toEqual(["Nicht gespeicherte Änderungen wiederherstellen?"]);
    expect(introSeen()).toBe(false);
    const restore = [...dialogs()[0].querySelectorAll("button")].find((b) => b.textContent === "Wiederherstellen")!;
    await act(async () => restore.click());
    expect(backups.restored).toBe(1);
    expect(dialogs()).toHaveLength(1);
    expect(dialogs()[0].getAttribute("aria-labelledby")).toBe("intro-title");
  });

  it("open the introduction right away when there is nothing to recover, on the first start only", async () => {
    await act(async () => root.render(createElement(Start)));
    expect(dialogs()).toHaveLength(1);
    expect(dialogs()[0].getAttribute("aria-labelledby")).toBe("intro-title");
    act(() => root.unmount());
    // The next start, with a backup this time: only the recovery question, no introduction after it.
    resetIntroForTests();
    localStorage.setItem("kitchenplaner.intro.v1", "seen");
    backups.found = [BACKUP];
    root = createRoot(host);
    await act(async () => root.render(createElement(Start)));
    expect(dialogs()).toHaveLength(1);
    act(() => void dialogs()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(dialogs()).toHaveLength(0);
  });
});
