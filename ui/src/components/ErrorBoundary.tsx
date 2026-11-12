// The last line of defence: an error while rendering would otherwise leave an empty window. The
// boundary shows what happened instead, lets the user save unsaved changes (the store outlives
// the broken view) and reload the window. Errors outside rendering (a rejected promise, a thrown
// event handler) leave the window working; they are shown as an error message (`installErrorHandlers`).

import { Component, type ReactNode } from "react";
import { saveFile } from "../lib/actions";
import { t, useT } from "../lib/i18n";
import { toast } from "../lib/toast";
import { useStore } from "../store/store";
import { UnsavedDialog } from "./UnsavedDialog";

/** The text of anything thrown: an Error's message, else the value itself. */
export function thrownText(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === "string") return e;
  // An app command's error (`{ kind, path, detail }`) or another object with a message.
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; detail?: unknown };
    if (typeof o.message === "string" && o.message) return o.message;
    if (typeof o.detail === "string" && o.detail) return o.detail;
  }
  try {
    return JSON.stringify(e) ?? String(e);
  } catch {
    return String(e);
  }
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    // `null` would read as "no error": keep something to show.
    return { error: error ?? new Error("unknown error") };
  }

  render(): ReactNode {
    return this.state.error === null ? this.props.children : <CrashScreen error={this.state.error} />;
  }
}

function CrashScreen(props: { error: unknown }) {
  const t = useT();
  const dirty = useStore((s) => s.dirty);
  return (
    <>
      <div className="overlay">
        <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="crash-title" aria-describedby="crash-text">
          <h2 className="dialog-title" id="crash-title">
            {t("crash.title")}
          </h2>
          <p className="dialog-text" id="crash-text">
            {t(dirty ? "crash.unsaved" : "crash.text")}
          </p>
          <p className="dialog-text">{t("crash.message", { message: thrownText(props.error) })}</p>
          <div className="dialog-actions">
            {dirty && (
              <button type="button" className="btn primary" onClick={() => void saveFile()}>
                {t("file.save")}
              </button>
            )}
            <button type="button" className={dirty ? "btn" : "btn primary"} onClick={() => window.location.reload()}>
              {t("crash.reload")}
            </button>
          </div>
        </div>
      </div>
      {/* Closing the window still asks about unsaved changes (lib/closeGuard.ts): the app that
          shows the question is gone, so the crash screen shows it. */}
      <UnsavedDialog />
    </>
  );
}

/** The same message within this time (ms) is shown once: a failing loop must not fill the window. */
const REPEAT_MS = 5000;

/**
 * Shows errors no code caught (a rejected promise, a throwing event handler) as an error message,
 * so a failed action does not just do nothing. Returns the function that removes the handlers.
 */
export function installErrorHandlers(target: Window = window): () => void {
  let last = "";
  let lastAt = 0;
  const show = (e: unknown) => {
    const text = thrownText(e);
    const now = Date.now();
    if (text === last && now - lastAt < REPEAT_MS) return;
    last = text;
    lastAt = now;
    toast(t("crash.unexpected", { message: text }), "danger");
  };
  const onRejection = (e: PromiseRejectionEvent) => show(e.reason);
  // Only errors with an error object: the browser also reports harmless notices this way
  // ("ResizeObserver loop completed with undelivered notifications" carries none).
  const onError = (e: ErrorEvent) => {
    if (e.error != null) show(e.error);
  };
  target.addEventListener("unhandledrejection", onRejection);
  target.addEventListener("error", onError);
  return () => {
    target.removeEventListener("unhandledrejection", onRejection);
    target.removeEventListener("error", onError);
  };
}
