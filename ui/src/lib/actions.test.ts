import { beforeEach, describe, expect, it, vi } from "vitest";
import { serializeProject, parseProject } from "../model/serialize";
import { testItem, testProject } from "../model/testProject";
import { useStore } from "../store/store";
import { applyTransform, beginTransform, cancelTransform, registerOperator } from "./commands";

// The native file dialogs and commands: what would be written and what the next open returns.
const disk = vi.hoisted(() => ({ written: new Map<string, string>(), next: null as { path: string; text: string } | null, whileWriting: null as (() => void) | null }));
// The unsaved-changes question (lib/unsaved.ts): its answer, and the names it was asked for.
const question = vi.hoisted(() => ({ answer: "cancel" as "save" | "discard" | "cancel", asked: [] as string[] }));
vi.mock("./unsaved", () => ({
  askUnsaved: async (name: string) => {
    question.asked.push(name);
    return question.answer;
  },
}));
vi.mock("./platform", async (orig) => ({
  ...(await orig<typeof import("./platform")>()),
  confirmDialog: async () => true,
  openProjectFile: async () => disk.next,
  readProjectPath: async () => disk.next!,
  addRecentFile: async () => {},
  saveText: async (path: string | null, name: string, _f: unknown, text: string) => {
    const to = path ?? `/${name}`;
    disk.written.set(to, text);
    disk.whileWriting?.();
    return to;
  },
}));

const { confirmDiscard, newFile, openFile, runExport, saveFile } = await import("./actions");

const st = () => useStore.getState();

/** Project A open from /a.kplan with its table selected and grabbed 500 mm to the right (G, not confirmed). */
function grabbing() {
  st().load(testProject([testItem("a1", "table", 1000, 1000)]), "/a.kplan");
  st().select({ items: ["a1"] });
  const s = beginTransform()!;
  applyTransform(s, (o) => ({ x: o.x + 500 }));
  const done = registerOperator(() => {
    done();
    cancelTransform(s);
  });
  return s;
}

beforeEach(() => {
  disk.written.clear();
  disk.next = null;
  disk.whileWriting = null;
  question.answer = "cancel";
  question.asked = [];
});

// The toolbar works with the mouse while an operator runs from the keyboard.
describe("file commands in the middle of an operator", () => {
  it("save writes the project without the half-done move and ends the operator", async () => {
    grabbing();
    await saveFile();
    expect(parseProject(disk.written.get("/a.kplan")!).items[0].x).toBe(1000);
    expect(st().project.items[0].x).toBe(1000);
    expect(st().dirty).toBe(false);
    expect(st().isGestureActive()).toBe(false);
  });

  it("open ends the operator first, so a later Escape cannot bring the old project back", async () => {
    const s = grabbing();
    const b = { ...testProject([testItem("b1", "table", 0, 0)]), info: { ...testProject().info, name: "B" } };
    disk.next = { path: "/b.kplan", text: serializeProject(b) };
    await openFile();
    expect(st().path).toBe("/b.kplan");
    expect(st().project.info.name).toBe("B");
    // The view's own Escape after the open: nothing of A comes back.
    cancelTransform(s);
    expect(st().project.info.name).toBe("B");
    expect(st().dirty).toBe(false);
    await saveFile();
    expect(parseProject(disk.written.get("/b.kplan")!).info.name).toBe("B");
  });

  it("new ends the operator first", async () => {
    grabbing();
    await newFile();
    expect(st().path).toBeNull();
    expect(st().project.items).toEqual([]);
    expect(st().isGestureActive()).toBe(false);
  });
});

describe("saving", () => {
  // The file used to be marked as saved with whatever the store held when the write ended.
  it("keeps edits made while the file was written marked as changed", async () => {
    st().load(testProject([testItem("a1", "table", 1000, 1000)]), "/a.kplan");
    st().updateItems(["a1"], () => ({ x: 1200 }));
    disk.whileWriting = () => st().updateItems(["a1"], () => ({ x: 1400 }));
    expect(await saveFile()).toBe(true);
    expect(parseProject(disk.written.get("/a.kplan")!).items[0].x).toBe(1200);
    expect(st().project.items[0].x).toBe(1400);
    expect(st().dirty).toBe(true);
  });
});

describe("exports in the middle of an operator", () => {
  it("end the operator first and export without the half-done move", async () => {
    grabbing();
    await runExport("list-csv", "north");
    expect(st().project.items[0].x).toBe(1000);
    expect(st().isGestureActive()).toBe(false);
  });
});

describe("the unsaved-changes question", () => {
  const changed = () => {
    st().load(testProject([testItem("a1", "table", 1000, 1000)]), "/a.kplan");
    st().updateItems(["a1"], () => ({ x: 1200 }));
  };

  it("is not asked for a saved project", async () => {
    st().load(testProject([]), "/a.kplan");
    expect(await confirmDiscard()).toBe(true);
    expect(question.asked).toEqual([]);
  });

  it("„Speichern“ saves and goes ahead, „Nicht speichern“ goes ahead, „Abbrechen“ stays", async () => {
    changed();
    question.answer = "cancel";
    expect(await confirmDiscard()).toBe(false);
    expect(question.asked).toEqual([st().project.info.name]);
    question.answer = "discard";
    expect(await confirmDiscard()).toBe(true);
    expect(disk.written.size).toBe(0);
    question.answer = "save";
    expect(await confirmDiscard()).toBe(true);
    expect(parseProject(disk.written.get("/a.kplan")!).items[0].x).toBe(1200);
    expect(st().dirty).toBe(false);
  });

  // Closing or quitting used to drop a value typed into a field but not applied yet, without asking.
  it("applies a value typed in the focused field first, and asks about it", async () => {
    st().load(testProject([testItem("a1", "table", 1000, 1000)]), "/a.kplan");
    const field = document.createElement("input");
    field.addEventListener("blur", () => st().updateItems(["a1"], () => ({ name: "Pass" })));
    document.body.append(field);
    field.focus();
    expect(await confirmDiscard()).toBe(false);
    field.remove();
    expect(question.asked).toHaveLength(1);
    expect(st().project.items[0].name).toBe("Pass");
  });
});
