import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeProject } from "../model/serialize";
import { testItem, testProject } from "../model/testProject";
import { useStore } from "../store/store";
import type { Project } from "../model/types";

const ui = vi.hoisted(() => ({ toasts: [] as { text: string; tone?: string }[], answer: true }));
vi.mock("./toast", () => ({ toast: (text: string, tone?: string) => ui.toasts.push({ text, tone }) }));
vi.mock("./platform", async (orig) => ({
  ...(await orig<typeof import("./platform")>()),
  confirmDialog: async () => ui.answer,
}));

const { AUTOSAVE_DELAY, AUTOSAVE_MAX_WAIT, autosaveStatus, backupDetails, browserBackend, discardOwnBackup, lastAutosave, restoreBackup, startAutosave } = await import("./autosave");
type Backend = import("./autosave").AutosaveBackend;
type Recoverable = import("./autosave").Recoverable;

const st = () => useStore.getState();

/** A backend that records what it is asked to do; `hold` keeps the next write pending. */
function fakeBackend() {
  const log: string[] = [];
  let release: (() => void) | null = null;
  const b = {
    log,
    written: [] as { text: string; path: string | null; name: string }[],
    fail: null as unknown,
    hold: false,
    restored: null as unknown,
    release: () => release?.(),
    async write(text: string, path: string | null, name: string) {
      if (b.hold) await new Promise<void>((r) => (release = r));
      if (b.fail) throw b.fail;
      log.push(`write ${name}`);
      b.written.push({ text, path, name });
    },
    async clear() {
      log.push("clear");
    },
    async list() {
      return [];
    },
    async restore(id: string) {
      log.push(`restore ${id}`);
      if (b.restored instanceof Error || (b.restored && !("text" in (b.restored as object)))) throw b.restored;
      return b.restored as Awaited<ReturnType<Backend["restore"]>>;
    },
    async discard(id: string) {
      log.push(`discard ${id}`);
    },
  };
  return b;
}

const rename = (name: string) => st().change((p: Project) => ({ ...p, info: { ...p.info, name } }));

let stop: () => void = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  ui.toasts.length = 0;
  ui.answer = true;
  st().load(testProject([testItem("a1", "table", 1000, 1000)]), "/a.kplan");
});

afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe("writing backups", () => {
  it("writes 5 s after the last change, not before, with the project, its path and name", async () => {
    const b = fakeBackend();
    stop = startAutosave(b);
    rename("Küche 1");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY - 1);
    expect(b.log).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(b.log).toEqual(["write Küche 1"]);
    expect(b.written[0].path).toBe("/a.kplan");
    expect(b.written[0].text).toBe(serializeProject(st().project));
  });

  it("waits for a pause, but no longer than 30 s while the editing goes on", async () => {
    const b = fakeBackend();
    stop = startAutosave(b);
    // A change every 2 s: never a 5 s pause.
    for (let i = 0; i < 14; i++) {
      rename(`K${i}`);
      await vi.advanceTimersByTimeAsync(2_000);
    }
    expect(b.log).toEqual([]);
    rename("K14");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MAX_WAIT - 28_000 - 1);
    expect(b.log).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    // The state at the time of the write, not of the first change.
    expect(b.log).toEqual(["write K14"]);
    // The next change starts a new wait.
    rename("K15");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    expect(b.log).toEqual(["write K14", "write K15"]);
  });

  it("writes nothing for a project without changes and clears on save, open and new", async () => {
    const b = fakeBackend();
    stop = startAutosave(b);
    st().select({ items: ["a1"] });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MAX_WAIT);
    expect(b.log).toEqual([]);

    rename("A");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    st().markSaved("/a.kplan");
    await vi.advanceTimersByTimeAsync(0);
    expect(b.log).toEqual(["write A", "clear"]);

    rename("B");
    st().load(testProject(), "/b.kplan");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MAX_WAIT);
    // Opened before the backup was due: the pending write is dropped.
    expect(b.log).toEqual(["write A", "clear", "clear"]);
  });

  it("a save during a running write clears after it, and the write is not repeated", async () => {
    const b = fakeBackend();
    stop = startAutosave(b);
    rename("A");
    b.hold = true;
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    st().markSaved("/a.kplan");
    b.release();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MAX_WAIT);
    expect(b.log).toEqual(["write A", "clear"]);
  });

  it("closing without saving removes the backup", async () => {
    const b = fakeBackend();
    stop = startAutosave(b);
    rename("A");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    rename("B");
    await discardOwnBackup();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MAX_WAIT);
    expect(b.log).toEqual(["write A", "clear"]);
  });

  it("tells about a failing backup once, not on every try", async () => {
    const b = fakeBackend();
    b.fail = { kind: "permissionDenied", path: "x.kplan", detail: null };
    stop = startAutosave(b);
    rename("A");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    rename("B");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    expect(ui.toasts.filter((x) => x.tone === "danger")).toHaveLength(1);
    expect(ui.toasts[0].text).toMatch(/automatische Sicherung/);
    // Once it works again, a new failure is shown again.
    b.fail = null;
    rename("C");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    b.fail = new Error("voll");
    rename("D");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    expect(ui.toasts.filter((x) => x.tone === "danger")).toHaveLength(2);
  });

  it("the status bar's time follows the backups and goes on save", async () => {
    const b = fakeBackend();
    stop = startAutosave(b);
    vi.setSystemTime(new Date("2026-10-15T14:32:10+02:00"));
    rename("A");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    expect(lastAutosave()).toBe(Date.now());
    expect(autosaveStatus(Date.now(), "de")).toBe("Automatisch gesichert 14:32");
    expect(autosaveStatus(Date.now(), "en")).toBe("Autosaved 14:32");
    st().markSaved("/a.kplan");
    await vi.advanceTimersByTimeAsync(0);
    expect(lastAutosave()).toBeNull();
  });
});

describe("restoring", () => {
  const backup: Recoverable = { id: "abc-1-0", path: "/alt/Küche.kplan", name: "Küche Süd", savedAt: 0, appVersion: "0.2.0", pathExists: true };
  const text = serializeProject({ ...testProject([testItem("r1", "table", 500, 500)]), info: { ...testProject().info, name: "Küche Süd" } });

  it("opens the backup as unsaved, with its file when that still exists", async () => {
    const b = fakeBackend();
    stop = startAutosave(b);
    b.restored = { text, path: backup.path, name: backup.name, savedAt: 0, appVersion: "0.2.0", pathExists: true };
    expect(await restoreBackup(backup)).toBe(true);
    expect(b.log).toEqual(["restore abc-1-0"]);
    expect(st().project.items.map((i) => i.id)).toEqual(["r1"]);
    expect(st().path).toBe("/alt/Küche.kplan");
    expect(st().dirty).toBe(true);
    expect(ui.toasts[0].text).toContain("Küche Süd");
    // Its own backup follows (the restored one is this app's own now).
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    expect(b.log).toEqual(["restore abc-1-0", "write Küche Süd"]);
  });

  it("opens it as a new project when its file is gone", async () => {
    const b = fakeBackend();
    stop = startAutosave(b);
    b.restored = { text, path: backup.path, name: backup.name, savedAt: 0, appVersion: "0.2.0", pathExists: false };
    expect(await restoreBackup({ ...backup, pathExists: false })).toBe(true);
    expect(st().path).toBeNull();
    expect(st().dirty).toBe(true);
  });

  it("asks before replacing unsaved changes, and keeps them when told so", async () => {
    const b = fakeBackend();
    stop = startAutosave(b);
    rename("Offen");
    ui.answer = false;
    expect(await restoreBackup(backup)).toBe(false);
    expect(b.log).toEqual([]);
    expect(st().project.info.name).toBe("Offen");
  });

  it("says so when another window took the backup first", async () => {
    const b = fakeBackend();
    stop = startAutosave(b);
    b.restored = { kind: "notFound", path: "abc-1-0.kplan", detail: null };
    expect(await restoreBackup(backup)).toBe(false);
    expect(ui.toasts[0].text).toMatch(/anderen Fenster/);
    expect(st().path).toBe("/a.kplan");
  });

  it("drops a backup the UI cannot read", async () => {
    const b = fakeBackend();
    stop = startAutosave(b);
    b.restored = { text: '{"format":"kitchenplaner","version":1,"room":7}', path: null, name: "", savedAt: 0, appVersion: "", pathExists: false };
    expect(await restoreBackup(backup)).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(b.log).toEqual(["restore abc-1-0", "clear"]);
    expect(ui.toasts[0].tone).toBe("danger");
    expect(st().path).toBe("/a.kplan");
  });

  it("describes a backup with its name, time and file", () => {
    const at = new Date("2026-10-15T14:32:00+02:00").getTime();
    expect(backupDetails({ ...backup, savedAt: at }, "de")).toEqual({ name: "Küche Süd", when: "Gesichert 15.10.2026, 14:32", file: "Datei „Küche.kplan“" });
    expect(backupDetails({ ...backup, savedAt: at, pathExists: false }, "de").file).toBe("„Küche.kplan“ gibt es nicht mehr, öffnet als neues Projekt");
    expect(backupDetails({ ...backup, savedAt: at, path: null, name: "" }, "en")).toEqual({ name: "Untitled project", when: "Saved 15 Oct 2026, 14:32", file: "Never saved" });
  });
});

describe("browser backups", () => {
  /** A LockManager whose held locks are the given names. */
  const locksOf = (held: Set<string>) =>
    ({
      request: (name: string) => {
        held.add(name);
        return new Promise(() => {});
      },
      query: async () => ({ held: [...held].map((name) => ({ name, mode: "exclusive" as const })), pending: [] }),
    }) as unknown as LockManager;

  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("offers backups of closed tabs only, and one tab takes it over", async () => {
    const held = new Set<string>();
    const closed = browserBackend(localStorage, locksOf(new Set()));
    await closed.write("{}", null, "Geschlossen");
    const open = browserBackend(localStorage, locksOf(held));
    await open.write("{}", null, "Offen");
    const a = browserBackend(localStorage, locksOf(held));
    const b = browserBackend(localStorage, locksOf(held));

    const found = await a.list();
    expect(found.map((r) => r.name)).toEqual(["Geschlossen"]);
    expect(found[0]).toMatchObject({ path: null, pathExists: false });
    expect((await b.list()).map((r) => r.name)).toEqual(["Geschlossen"]);

    expect((await a.restore(found[0].id)).name).toBe("Geschlossen");
    await expect(b.restore(found[0].id)).rejects.toMatchObject({ kind: "notFound" });
    // Now a's own: a running tab's backup is offered to nobody.
    expect(await b.list()).toEqual([]);
    await a.clear();
    expect(Object.keys(localStorage).filter((k) => k.startsWith("kitchenplaner.autosave."))).toHaveLength(1);
  });

  it("removes damaged, old and surplus backups and keeps the newest five", async () => {
    let now = Date.UTC(2026, 9, 15);
    for (let i = 0; i < 7; i++) {
      const s = browserBackend(localStorage, undefined, () => now + i * 1000);
      await s.write("{}", null, `P${i}`);
    }
    const old = browserBackend(localStorage, undefined, () => now - 15 * 24 * 3600 * 1000);
    await old.write("{}", null, "alt");
    localStorage.setItem("kitchenplaner.autosave.kaputt", "{nicht json");
    localStorage.setItem("andere.einstellung", "bleibt");
    now += 10_000;
    const me = browserBackend(localStorage, undefined, () => now);
    expect((await me.list()).map((r) => r.name)).toEqual(["P6", "P5", "P4", "P3", "P2"]);
    expect(Object.keys(localStorage).filter((k) => k.startsWith("kitchenplaner.autosave."))).toHaveLength(5);
    expect(localStorage.getItem("andere.einstellung")).toBe("bleibt");
  });

  it("discard removes a backup for good", async () => {
    const closed = browserBackend(localStorage, undefined);
    await closed.write("{}", null, "A");
    const me = browserBackend(localStorage, undefined);
    const [r] = await me.list();
    await me.discard(r.id);
    expect(await me.list()).toEqual([]);
  });
});

describe("store", () => {
  it("load can open a project as not saved yet", () => {
    st().load(testProject(), "/x.kplan", { dirty: true });
    expect(st().dirty).toBe(true);
    st().load(testProject(), "/x.kplan");
    expect(st().dirty).toBe(false);
  });
});
