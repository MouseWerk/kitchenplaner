// The PNG export of the 3D view: the mounted view registers how to capture itself, exports call
// `capture3dPng`. Only one 3D view captures at a time; the last one mounted wins.

/** Renders the current 3D view as PNG bytes, optionally at a given width in pixels. */
export type CaptureFn = (widthPx?: number) => Promise<Uint8Array>;

let current: CaptureFn | null = null;

/** Registers the capture of a mounted 3D view; the returned function unregisters it. */
export function registerCapture(fn: CaptureFn): () => void {
  current = fn;
  return () => {
    // A view mounted later may have replaced this one; only remove our own registration.
    if (current === fn) current = null;
  };
}

/** True when a 3D view is mounted and can be captured. */
export function canCapture3d(): boolean {
  return current !== null;
}

/** PNG bytes of the current 3D view. Throws when no 3D view is mounted. */
export async function capture3dPng(widthPx?: number): Promise<Uint8Array> {
  if (!current) throw new Error("3D capture: no 3D view is open; show the 3D view to export it.");
  return current(widthPx);
}
