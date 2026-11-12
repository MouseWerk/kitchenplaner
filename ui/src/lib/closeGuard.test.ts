import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newProject } from "../model/project";
import { useStore } from "../store/store";

// The desktop shell: the window's close request, the app's exit request and the commands.
const shell = vi.hoisted(() => ({
  tauri: false,
  answer: true,
  asked: 0,
  onClose: null as ((e: { preventDefault: () => void }) => Promise<void>) | null,
  onExit: null as (() => Promise<void>) | null,
  destroyed: 0,
  commands: [] as string[],
  removed: 0,
}));
vi.mock("./platform", async (orig) => ({ ...(await orig<typeof import("./platform")>()), isTauri: () => shell.tauri }));
vi.mock("./actions", () => ({
  confirmDiscard: async () => {
    shell.asked++;
    return shell.answer;
  },
}));
vi.mock("./autosave", () => ({ discardOwnBackup: async () => {} }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: async (cmd: string) => void shell.commands.push(cmd) }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async (f: typeof shell.onClose) => {
      shell.onClose = f;
      return () => void shell.removed++;
    },
    destroy: async () => void shell.destroyed++,
  }),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: async (_name: string, f: typeof shell.onExit) => {
    shell.onExit = f;
    return () => void shell.removed++;
  },
}));

const { installCloseGuard } = await import("./closeGuard");

const settle = () => new Promise((r) => setTimeout(r, 0));
let remove: () => void = () => {};

beforeEach(() => {
  Object.assign(shell, { tauri: false, answer: true, asked: 0, onClose: null, onExit: null, destroyed: 0, commands: [], removed: 0 });
  useStore.getState().load(newProject(), null);
});

afterEach(() => remove());

describe("close guard", () => {
  it("in the browser, holds the page over unsaved changes only", () => {
    remove = installCloseGuard();
    const close = () => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(close()).toBe(false);
    useStore.getState().updateRoom((r) => ({ height: r.height + 100 }));
    expect(close()).toBe(true);
    remove();
    expect(close()).toBe(false);
  });

  it("asks on closing the window and on quitting, without any React tree (it outlives a crashed view)", async () => {
    shell.tauri = true;
    remove = installCloseGuard();
    await settle();
    const event = { preventDefault: vi.fn() };
    shell.answer = false;
    await shell.onClose!(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(shell.asked).toBe(1);
    expect(shell.destroyed).toBe(0);
    shell.answer = true;
    await shell.onClose!(event);
    expect(shell.destroyed).toBe(1);
    await shell.onExit!();
    expect(shell.asked).toBe(3);
    expect(shell.commands).toEqual(["confirm_exit"]);
  });

  it("removed before the shell answered: the listeners go as soon as they are there", async () => {
    shell.tauri = true;
    installCloseGuard()();
    await settle();
    expect(shell.removed).toBe(2);
  });
});
