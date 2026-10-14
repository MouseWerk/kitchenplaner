import { beforeEach, describe, expect, it, vi } from "vitest";
import { serializeProject, parseProject } from "../model/serialize";
import { testItem, testProject } from "../model/testProject";
import { useStore } from "../store/store";
import { applyTransform, beginTransform, cancelTransform, registerOperator } from "./commands";

// The native file dialogs and commands: what would be written and what the next open returns.
const disk = vi.hoisted(() => ({ written: new Map<string, string>(), next: null as { path: string; text: string } | null }));
vi.mock("./platform", async (orig) => ({
  ...(await orig<typeof import("./platform")>()),
  confirmDialog: async () => true,
  openProjectFile: async () => disk.next,
  readProjectPath: async () => disk.next!,
  addRecentFile: async () => {},
  saveText: async (path: string | null, name: string, _f: unknown, text: string) => {
    const to = path ?? `/${name}`;
    disk.written.set(to, text);
    return to;
  },
}));

const { newFile, openFile, saveFile } = await import("./actions");

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
