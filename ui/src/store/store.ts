// The app state: the open project with undo history, the selection and the view settings.
//
// Every change to the project goes through `change(label, fn)`, which records the previous
// project for undo. A drag records one step: `beginGesture()` at the start, `change(..., {gesture:
// true})` while moving, so all the moves of one drag undo together; `endGesture()` when it ends.

import { create } from "zustand";
import type { Facing, Item, Opening, Project, Room } from "../model/types";
import { newProject } from "../model/project";

/** How many steps undo keeps. */
const HISTORY_LIMIT = 200;

export type Layout = "plan" | "elevations" | "3d" | "split";

/**
 * Editing modes, as in Blender (Tab switches): "arrange" places and moves equipment (object
 * mode), "room" edits the room itself: outline corners, walls, partitions and openings (edit
 * mode). Each mode selects only its own things.
 */
export type Mode = "arrange" | "room";

/** The tool of the room mode: select and move, draw a new outline, draw partitions. */
export type RoomTool = "select" | "outline" | "partition";

export interface Selection {
  /** Selected items (ids); arrange mode. */
  items: string[];
  /** A selected opening (id); room mode. */
  opening: string | null;
  /** Selected outline corners (indices into room.points); room mode. */
  corners: number[];
  /** Selected partitions (ids); room mode. */
  partitions: string[];
}

const EMPTY_SELECTION: Selection = { items: [], opening: null, corners: [], partitions: [] };

export interface Prefs {
  /** Grid step for moving in the plan (mm), 0 for free placement. */
  grid: number;
  /** Shows item names next to the position numbers in the plan. */
  showNames: boolean;
  /** Shows dimensions in the plan. */
  showDims: boolean;
}

export interface AppState {
  project: Project;
  /** Counts `load` calls, so views can refit when a project is opened or created (even an identical one). */
  loadCount: number;
  /** Counts `markSaved` calls, so a running operator can tell that its state reached a file. */
  saveCount: number;
  /** Path of the file the project was opened from or saved to; null for a new project. */
  path: string | null;
  /** True when the project changed since it was opened or saved. */
  dirty: boolean;
  past: Project[];
  future: Project[];
  selection: Selection;
  layout: Layout;
  /** The elevation shown where only one fits (split layout, export). */
  facing: Facing;
  prefs: Prefs;
  mode: Mode;
  roomTool: RoomTool;
  /** The running operator or tool step as the status bar shows it ("G  X  500 mm"); null when idle. */
  status: string | null;

  change: (fn: (p: Project) => Project, opts?: { gesture?: boolean }) => void;
  /** Starts a drag: the next gesture change records the state before it. */
  beginGesture: () => void;
  /** Ends a drag started with `beginGesture`. */
  endGesture: () => void;
  /** True between `beginGesture` and `endGesture`; undo and redo wait until the drag ends. */
  isGestureActive: () => boolean;
  undo: () => void;
  redo: () => void;
  load: (project: Project, path: string | null) => void;
  markSaved: (path: string) => void;
  select: (sel: Partial<Selection>) => void;
  setLayout: (layout: Layout) => void;
  setFacing: (facing: Facing) => void;
  setPrefs: (prefs: Partial<Prefs>) => void;
  /** Switches the mode; the selection of the other mode is cleared. */
  setMode: (mode: Mode) => void;
  setRoomTool: (tool: RoomTool) => void;
  setStatus: (status: string | null) => void;

  // Shortcuts over `change`.
  updateItems: (ids: readonly string[], patch: (it: Item) => Partial<Item>, opts?: { gesture?: boolean }) => void;
  addItems: (items: Item[]) => void;
  removeSelected: () => void;
  updateRoom: (patch: (r: Room) => Partial<Room>, opts?: { gesture?: boolean }) => void;
  updateOpening: (id: string, patch: Partial<Opening>, opts?: { gesture?: boolean }) => void;
}

/** The next gesture change records the state before it (set by `beginGesture`). */
let gestureOpen = false;
/** A drag is in progress. */
let gestureActive = false;

export const useStore = create<AppState>((set, get) => ({
  project: newProject(),
  loadCount: 0,
  saveCount: 0,
  path: null,
  dirty: false,
  past: [],
  future: [],
  selection: EMPTY_SELECTION,
  layout: "split",
  facing: "north",
  prefs: { grid: 50, showNames: false, showDims: true },
  mode: "arrange",
  roomTool: "select",
  status: null,

  change(fn, opts) {
    const before = get().project;
    const after = fn(before);
    if (after === before) return;
    const record = !opts?.gesture || gestureOpen;
    gestureOpen = false;
    set((s) => ({
      project: after,
      dirty: true,
      past: record ? [...s.past, before].slice(-HISTORY_LIMIT) : s.past,
      // Any change makes the redo steps stale, recorded or not.
      future: [],
    }));
  },

  beginGesture() {
    gestureOpen = true;
    gestureActive = true;
  },

  endGesture() {
    gestureOpen = false;
    gestureActive = false;
  },

  isGestureActive() {
    return gestureActive;
  },

  undo() {
    // Mid-drag the next move would apply onto the restored project and skip recording it.
    if (gestureActive) return;
    const { past, project, future } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], dirty: true, selection: keepExisting(get().selection, prev) });
  },

  redo() {
    if (gestureActive) return;
    const { past, project, future } = get();
    const next = future[0];
    if (!next) return;
    set({ project: next, past: [...past, project], future: future.slice(1), dirty: true, selection: keepExisting(get().selection, next) });
  },

  load(project, path) {
    gestureOpen = false;
    gestureActive = false;
    set((s) => ({ project, path, dirty: false, past: [], future: [], selection: EMPTY_SELECTION, loadCount: s.loadCount + 1 }));
  },

  markSaved(path) {
    set((s) => ({ path, dirty: false, saveCount: s.saveCount + 1 }));
  },

  select(sel) {
    set((s) => {
      const next = { ...s.selection, ...sel };
      // Items belong to the arrange mode, the rest to the room mode: never both at once.
      if (sel.items && sel.items.length > 0) Object.assign(next, { opening: null, corners: [], partitions: [] });
      if (sel.opening || (sel.corners && sel.corners.length > 0) || (sel.partitions && sel.partitions.length > 0)) next.items = [];
      return { selection: next };
    });
  },

  setMode(mode) {
    if (mode === get().mode) return;
    set({ mode, roomTool: "select", status: null, selection: EMPTY_SELECTION });
  },

  setRoomTool(roomTool) {
    set({ roomTool, status: null });
  },

  setStatus(status) {
    set({ status });
  },

  setLayout(layout) {
    set({ layout });
  },

  setFacing(facing) {
    set({ facing });
  },

  setPrefs(prefs) {
    set((s) => ({ prefs: { ...s.prefs, ...prefs } }));
  },

  updateItems(ids, patch, opts) {
    const wanted = new Set(ids);
    get().change((p) => ({ ...p, items: p.items.map((it) => (wanted.has(it.id) ? { ...it, ...patch(it) } : it)) }), opts);
  },

  addItems(items) {
    get().change((p) => ({ ...p, items: [...p.items, ...items] }));
    get().select({ items: items.map((i) => i.id) });
  },

  removeSelected() {
    const { selection } = get();
    if (selection.items.length > 0) {
      const gone = new Set(selection.items);
      get().change((p) => ({ ...p, items: p.items.filter((it) => !gone.has(it.id)) }));
    } else if (selection.opening || selection.partitions.length > 0) {
      const opening = selection.opening;
      const parts = new Set(selection.partitions);
      get().change((p) => ({
        ...p,
        room: {
          ...p.room,
          partitions: p.room.partitions.filter((w) => !parts.has(w.id)),
          // Openings go with their partition.
          openings: p.room.openings.filter((o) => o.id !== opening && !(o.partition && parts.has(o.partition))),
        },
      }));
    }
    // Corners are removed by the room mode, which keeps the outline valid and moves openings.
    set({ selection: { ...EMPTY_SELECTION, corners: selection.corners } });
  },

  updateRoom(patch, opts) {
    get().change((p) => ({ ...p, room: { ...p.room, ...patch(p.room) } }), opts);
  },

  updateOpening(id, patch, opts) {
    get().change((p) => ({ ...p, room: { ...p.room, openings: p.room.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) } }), opts);
  },
}));

function keepExisting(sel: Selection, p: Project): Selection {
  const ids = new Set(p.items.map((i) => i.id));
  const parts = new Set(p.room.partitions.map((w) => w.id));
  return {
    items: sel.items.filter((id) => ids.has(id)),
    opening: sel.opening && p.room.openings.some((o) => o.id === sel.opening) ? sel.opening : null,
    corners: sel.corners.filter((i) => i < p.room.points.length),
    partitions: sel.partitions.filter((id) => parts.has(id)),
  };
}

/** The selected items of a state. */
export function selectedItems(s: Pick<AppState, "project" | "selection">): Item[] {
  const ids = new Set(s.selection.items);
  return s.project.items.filter((i) => ids.has(i.id));
}
