import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testProject } from "../model/testProject";
import { useStore } from "../store/store";

// The question before installing, the save it may start, and the messages.
const ui = vi.hoisted(() => ({ answer: true, asked: [] as string[], saved: true, saves: 0, toasts: [] as string[] }));
vi.mock("./platform", async (orig) => ({
  ...(await orig<typeof import("./platform")>()),
  confirmDialog: async (message: string) => {
    ui.asked.push(message);
    return ui.answer;
  },
}));
vi.mock("./actions", () => ({
  commitFocusedField: () => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement) el.blur();
  },
  saveFile: async () => {
    ui.saves++;
    if (ui.saved) useStore.getState().markSaved("/a.kplan");
    return ui.saved;
  },
}));
vi.mock("./toast", () => ({ toast: (text: string) => ui.toasts.push(text) }));

const { CHECK_INTERVAL, checkForUpdate, getUpdateState, installUpdate, noticeVisible, percent, putOffUpdate, startUpdates } = await import("./updates");
const { updateSettings } = await import("./settings");
const { t } = await import("./i18n");
type UpdaterApi = import("./updates").UpdaterApi;
type UpdateInfo = import("./updates").UpdateInfo;

/**
 * A shell that offers `offer`, records checks, downloads and installs, and reports progress.
 * `duringDownload` runs while the download is under way (the user planning on).
 */
function fakeUpdater(offer: UpdateInfo | null, opts: { enabled?: boolean; failCheck?: boolean; failInstall?: boolean; duringDownload?: () => void } = {}) {
  const calls = { checks: 0, downloads: 0, installs: 0 };
  const api: UpdaterApi = {
    enabled: async () => opts.enabled ?? true,
    check: async () => {
      calls.checks++;
      if (opts.failCheck) throw { kind: "io", path: null, detail: "offline" };
      return offer;
    },
    download: async (onProgress) => {
      calls.downloads++;
      onProgress({ downloaded: 50, total: 200 });
      expect(getUpdateState().progress).toEqual({ downloaded: 50, total: 200 });
      opts.duringDownload?.();
    },
    install: async () => {
      calls.installs++;
      if (opts.failInstall) throw { kind: "io", path: null, detail: "signature" };
    },
  };
  return { api, calls };
}

const settle = () => new Promise((r) => setTimeout(r, 0));
let stop: () => void = () => {};

beforeEach(() => {
  Object.assign(ui, { answer: true, asked: [], saved: true, saves: 0, toasts: [] });
  updateSettings({ autoUpdate: true });
  useStore.getState().load(testProject([]), "/a.kplan");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("looking for updates", () => {
  it("checks at start and shows a newer version", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: false });
    stop = startUpdates(api);
    await settle();
    expect(calls.checks).toBe(1);
    const s = getUpdateState();
    expect(s.supported).toBe(true);
    expect(s.available).toEqual({ version: "0.2.1", manual: false });
    expect(noticeVisible(s)).toBe(true);
  });

  it("checks again every few hours while running", async () => {
    vi.useFakeTimers();
    const { api, calls } = fakeUpdater(null);
    stop = startUpdates(api);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.checks).toBe(1);
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL);
    expect(calls.checks).toBe(2);
    // Switched off: the timer keeps running but asks nothing.
    updateSettings({ autoUpdate: false });
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL);
    expect(calls.checks).toBe(2);
  });

  it("does not check with the setting off, but the menu still can", async () => {
    updateSettings({ autoUpdate: false });
    const { api, calls } = fakeUpdater(null);
    stop = startUpdates(api);
    await settle();
    expect(calls.checks).toBe(0);
    expect(getUpdateState().supported).toBe(true);
    await checkForUpdate(true);
    expect(calls.checks).toBe(1);
    expect(ui.toasts).toEqual([t("update.upToDate")]);
  });

  it("never checks in a build without updates, in the browser or under the end-to-end tests", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: false }, { enabled: false });
    stop = startUpdates(api);
    await settle();
    expect(calls.checks).toBe(0);
    expect(getUpdateState().supported).toBe(false);
    stop();
    // No shell given and no Tauri page (vitest runs in happy-dom): nothing starts.
    stop = startUpdates();
    await settle();
    expect(getUpdateState().supported).toBe(false);
  });

  it("a failed check is quiet: logged and noted for the menu, no message", async () => {
    const { api } = fakeUpdater(null, { failCheck: true });
    stop = startUpdates(api);
    await settle();
    expect(getUpdateState().checkFailed).toBe(true);
    expect(getUpdateState().available).toBeNull();
    expect(ui.toasts).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("„Später“ hides the version until a newer one comes or the user asks", async () => {
    let offer: UpdateInfo = { version: "0.2.1", manual: false };
    const api: UpdaterApi = { enabled: async () => true, check: async () => offer, download: async () => {}, install: async () => {} };
    stop = startUpdates(api);
    await settle();
    putOffUpdate();
    expect(noticeVisible(getUpdateState())).toBe(false);
    await checkForUpdate();
    expect(noticeVisible(getUpdateState())).toBe(false);
    offer = { version: "0.2.2", manual: false };
    await checkForUpdate();
    expect(noticeVisible(getUpdateState())).toBe(true);
    putOffUpdate();
    await checkForUpdate(true);
    expect(noticeVisible(getUpdateState())).toBe(true);
  });
});

describe("installing", () => {
  it("installs at once when everything is saved", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: false });
    stop = startUpdates(api);
    await settle();
    await installUpdate();
    expect(calls.installs).toBe(1);
    expect(ui.asked).toEqual([]);
    expect(ui.saves).toBe(0);
  });

  it("asks before the restart would lose changes, and saves first", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: false });
    stop = startUpdates(api);
    await settle();
    useStore.getState().load(testProject([]), "/a.kplan", { dirty: true });
    await installUpdate();
    expect(ui.asked).toEqual([t("update.saveFirst")]);
    expect(ui.saves).toBe(1);
    expect(calls.installs).toBe(1);
  });

  it("cancelled or not saved: no update", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: false });
    stop = startUpdates(api);
    await settle();
    useStore.getState().load(testProject([]), "/a.kplan", { dirty: true });
    ui.answer = false;
    await installUpdate();
    expect(ui.saves).toBe(0);
    ui.answer = true;
    ui.saved = false;
    await installUpdate();
    expect(ui.saves).toBe(1);
    expect(calls.installs).toBe(0);
    expect(getUpdateState().progress).toBeNull();
  });

  it("a failed install says so in the notice and may be tried again", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: false }, { failInstall: true });
    stop = startUpdates(api);
    await settle();
    await installUpdate();
    const s = getUpdateState();
    expect(s.installFailed).toBe(true);
    expect(s.progress).toBeNull();
    expect(noticeVisible(s)).toBe(true);
    await installUpdate();
    expect(calls.installs).toBe(2);
    // The shell dropped the failed one: the retry downloads again.
    expect(calls.downloads).toBe(2);
  });

  it("asks again when the project changed during the download, and keeps the download when cancelled", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: false }, { duringDownload: () => useStore.getState().updateRoom((r) => ({ height: r.height + 100 })) });
    stop = startUpdates(api);
    await settle();
    ui.answer = false;
    await installUpdate();
    // Saved before, changed during the download: asked once, not restarted over the change.
    expect(ui.asked).toEqual([t("update.saveFirst")]);
    expect(calls.installs).toBe(0);
    expect(useStore.getState().dirty).toBe(true);
    expect(getUpdateState().progress).toBeNull();
    // The next try uses the download it has, saves and installs.
    ui.answer = true;
    await installUpdate();
    expect(calls.downloads).toBe(1);
    expect(ui.saves).toBe(1);
    expect(calls.installs).toBe(1);
  });

  it("counts a value typed in a field but not applied yet as a change", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: false });
    stop = startUpdates(api);
    await settle();
    // A field that applies its text when it loses focus, as the inspector's do.
    const field = document.createElement("input");
    field.addEventListener("blur", () => useStore.getState().updateRoom((r) => ({ height: r.height + 100 })));
    document.body.append(field);
    field.focus();
    ui.answer = false;
    await installUpdate();
    field.remove();
    expect(ui.asked).toEqual([t("update.saveFirst")]);
    expect(calls.downloads).toBe(0);
    expect(calls.installs).toBe(0);
  });

  it("a new check drops a kept download", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: false }, { duringDownload: () => useStore.getState().updateRoom((r) => ({ height: r.height + 100 })) });
    stop = startUpdates(api);
    await settle();
    ui.answer = false;
    await installUpdate();
    await checkForUpdate();
    useStore.getState().load(testProject([]), "/a.kplan");
    await installUpdate();
    expect(calls.downloads).toBe(2);
  });

  it("a check under way when „Jetzt aktualisieren“ comes is waited for, so its answer cannot drop the download", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: false });
    stop = startUpdates(api);
    await settle();
    // The shell's order of events: a check's answer drops what was downloaded before it.
    const order: string[] = [];
    let answer: (v: UpdateInfo | null) => void = () => {};
    api.check = () => new Promise((r) => (answer = r));
    const download = api.download;
    api.download = async (p) => {
      order.push("download");
      await download(p);
    };
    const install = api.install;
    api.install = async () => {
      order.push("install");
      await install();
    };
    const check = checkForUpdate();
    const installing = installUpdate();
    await settle();
    expect(calls.downloads).toBe(0);
    // No second check while it installs.
    void checkForUpdate();
    order.push("answer");
    answer({ version: "0.2.1", manual: false });
    await Promise.all([check, installing]);
    expect(order).toEqual(["answer", "download", "install"]);
    expect(calls.installs).toBe(1);
  });

  it("the answer of a check under way names a newer version: that one shows, nothing is installed", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: false });
    stop = startUpdates(api);
    await settle();
    let answer: (v: UpdateInfo | null) => void = () => {};
    api.check = () => new Promise((r) => (answer = r));
    const check = checkForUpdate();
    const installing = installUpdate();
    await settle();
    answer({ version: "0.2.2", manual: false });
    await Promise.all([check, installing]);
    expect(calls.downloads).toBe(0);
    expect(calls.installs).toBe(0);
    const s = getUpdateState();
    expect(s.available?.version).toBe("0.2.2");
    expect(s.progress).toBeNull();
    expect(noticeVisible(s)).toBe(true);
  });

  it("a copy that cannot install the file itself is only told about it", async () => {
    const { api, calls } = fakeUpdater({ version: "0.2.1", manual: true });
    stop = startUpdates(api);
    await settle();
    await installUpdate();
    expect(calls.installs).toBe(0);
  });

  it("progress in percent once the size is known", () => {
    expect(percent({ downloaded: 50, total: 200 })).toBe(25);
    expect(percent({ downloaded: 50, total: null })).toBeNull();
    expect(percent({ downloaded: 300, total: 200 })).toBe(100);
  });
});

it("the setting is on by default, and off stays off", async () => {
  localStorage.removeItem("kitchenplaner.settings.v1");
  vi.resetModules();
  expect((await import("./settings")).getSettings().autoUpdate).toBe(true);
  localStorage.setItem("kitchenplaner.settings.v1", JSON.stringify({ autoUpdate: false }));
  vi.resetModules();
  expect((await import("./settings")).getSettings().autoUpdate).toBe(false);
});
