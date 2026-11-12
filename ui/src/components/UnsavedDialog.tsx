// The question before unsaved changes would be lost (lib/unsaved.ts). The focus starts on
// „Speichern“, so Enter keeps the work; Escape is „Abbrechen“. A dialog role, so the shortcuts
// rest while it is open (lib/shortcuts.ts).

import { useEffect, useRef } from "react";
import { useT } from "../lib/i18n";
import { useUnsavedQuestion } from "../lib/unsaved";

export function UnsavedDialog() {
  const t = useT();
  const q = useUnsavedQuestion();
  const dialog = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!q) return;
    returnFocus.current = document.activeElement;
    dialog.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      const back = returnFocus.current;
      returnFocus.current = null;
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    };
  }, [q]);

  if (!q) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      q.answer("cancel");
    } else if (e.key === "Tab") {
      const buttons = [...(dialog.current?.querySelectorAll<HTMLElement>("button") ?? [])];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  return (
    <div className="overlay">
      <div ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-text" onKeyDown={onKeyDown}>
        <h2 className="dialog-title" id="unsaved-title">
          {t("unsaved.title")}
        </h2>
        <p className="dialog-text" id="unsaved-text">
          {t("unsaved.question", { name: q.name })}
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn danger" onClick={() => q.answer("discard")}>
            {t("unsaved.dontSave")}
          </button>
          <button type="button" className="btn" onClick={() => q.answer("cancel")}>
            {t("common.cancel")}
          </button>
          <button type="button" className="btn primary" data-autofocus onClick={() => q.answer("save")}>
            {t("file.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
