// The store side of dragging items in the 3D view: when a drag may start, and one transform
// session per drag (lib/commands.ts), so a drag is one undo step, Escape and leaving the mode
// put everything back as in the plan, and the file commands can end it first. The engine feeds
// it the pointer's way on the floor.

import { applyTransform, beginTransform, cancelTransform, confirmTransform, registerOperator, type TransformSession } from "../lib/commands";
import type { Vec2 } from "../model/types";
import { useStore } from "../store/store";
import { dragItems } from "./drag";

/**
 * May a press on an item start a drag? Not in the middle of another operator or drag (a G in the
 * plan, a grab in the room mode, a tool step shown in the status bar): its session would be
 * overwritten, and its cancel would put back a state without this drag's undo step.
 */
export function canStartItemDrag(): boolean {
  const st = useStore.getState();
  return st.mode === "arrange" && !st.isGestureActive() && st.status === null;
}

export class ItemDragSession {
  private session: TransformSession | null = null;
  private done: (() => void) | null = null;
  /** The places of the dragged items at the start. */
  private readonly origin: Map<string, Vec2>;

  /** `onCancelled` runs when the drag is cancelled from outside (a file command). */
  constructor(
    private readonly ids: readonly string[],
    private readonly onCancelled: () => void,
  ) {
    const items = useStore.getState().project.items.filter((i) => ids.includes(i.id));
    this.origin = new Map(items.map((i) => [i.id, { x: i.x, y: i.y }]));
  }

  /** True once the pointer moved the items. */
  get moved(): boolean {
    return this.session !== null;
  }

  /** Moves the items by `delta` (mm on the floor) from where they started; false when it cannot start. */
  move(delta: Vec2, free: boolean): boolean {
    if (!this.session) {
      useStore.getState().select({ items: [...this.ids], opening: null });
      this.session = beginTransform();
      if (!this.session) return false;
      this.done = registerOperator(() => {
        this.cancel();
        this.onCancelled();
      });
    }
    const st = useStore.getState();
    const moves = dragItems(st.project, this.origin, delta, st.prefs.grid, free);
    applyTransform(this.session, (o) => moves.get(o.id) ?? {});
    return true;
  }

  /** Ends the drag and keeps the move (one undo step). */
  confirm(): void {
    const s = this.end();
    if (s) confirmTransform(s);
  }

  /** Ends the drag and puts everything back as before it. */
  cancel(): void {
    const s = this.end();
    if (s) cancelTransform(s);
  }

  private end(): TransformSession | null {
    const s = this.session;
    this.session = null;
    this.done?.();
    this.done = null;
    return s;
  }
}
