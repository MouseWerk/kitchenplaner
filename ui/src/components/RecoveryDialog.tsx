// The question at start when an earlier run ended with unsaved changes (lib/autosave.ts). Lists
// the backups (project, time, file); „Wiederherstellen“ opens the chosen one as an unsaved
// project, „Verwerfen…“ asks once more (starting on „Abbrechen“) and deletes it. Escape closes the
// dialog without deciding: the backups are offered again at the next start. `onSettled` tells the
// app when the question is over (or there was nothing to ask), so the introduction can follow.

import { useEffect, useRef, useState } from "react";
import { backupDetails, discardBackup, findRecoverable, restoreBackup, type Recoverable } from "../lib/autosave";
import { useT } from "../lib/i18n";

export function RecoveryDialog({ onSettled }: { onSettled?: () => void }) {
  const t = useT();
  const [backups, setBackups] = useState<Recoverable[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<Element | null>(null);
  const settled = useRef(onSettled);
  useEffect(() => {
    settled.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    let cancelled = false;
    void findRecoverable().then((found) => {
      if (cancelled) return;
      if (found.length === 0) {
        settled.current?.();
        return;
      }
      returnFocus.current = document.activeElement;
      setBackups(found);
      setChosen(found[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = backups.length > 0;
  // The safe choice has the focus: „Wiederherstellen“ first, „Abbrechen“ in the discard question.
  useEffect(() => {
    if (open) dialog.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [open, confirming]);

  if (!open) return null;
  const current = backups.find((b) => b.id === chosen) ?? backups[0];

  const close = () => {
    setBackups([]);
    setConfirming(false);
    if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus();
    settled.current?.();
  };

  const restore = async () => {
    setBusy(true);
    const done = await restoreBackup(current);
    setBusy(false);
    if (done) close();
  };

  const discard = async () => {
    setBusy(true);
    await discardBackup(current);
    setBusy(false);
    setConfirming(false);
    const rest = backups.filter((b) => b.id !== current.id);
    if (rest.length === 0) close();
    else {
      setBackups(rest);
      setChosen(rest[0].id);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (confirming) setConfirming(false);
      else close();
    } else if (e.key === "Tab") trapFocus(e, dialog.current);
  };

  const several = backups.length > 1;
  return (
    <div className="overlay">
      <div ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title" onKeyDown={onKeyDown}>
        <h2 className="dialog-title" id="recovery-title">
          {t("autosave.title")}
        </h2>
        {confirming ? (
          <p className="dialog-text">{t("autosave.discardQuestion", { name: backupDetails(current).name })}</p>
        ) : (
          <>
            <p className="dialog-text">{t("autosave.intro")}</p>
            <div className="recovery-list" role={several ? "radiogroup" : undefined} aria-label={several ? t("autosave.backups") : undefined}>
              {backups.map((b) => {
                const d = backupDetails(b);
                const body = (
                  <span className="recovery-text">
                    <span className="recovery-name">{d.name}</span>
                    <span className="recovery-meta">{d.when}</span>
                    <span className="recovery-meta">{d.file}</span>
                  </span>
                );
                return several ? (
                  <label key={b.id} className={b.id === current.id ? "recovery-entry is-current" : "recovery-entry"}>
                    <input type="radio" name="recovery" checked={b.id === current.id} onChange={() => setChosen(b.id)} />
                    {body}
                  </label>
                ) : (
                  <div key={b.id} className="recovery-entry">
                    {body}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="dialog-actions">
          {confirming ? (
            <>
              <button type="button" className="btn" data-autofocus onClick={() => setConfirming(false)} disabled={busy}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn danger" onClick={() => void discard()} disabled={busy}>
                {t("file.discard")}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={() => setConfirming(true)} disabled={busy}>
                {t("autosave.discard")}
              </button>
              <button type="button" className="btn primary" data-autofocus onClick={() => void restore()} disabled={busy}>
                {t("autosave.restore")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Keeps Tab and Shift+Tab inside the dialog. */
function trapFocus(e: React.KeyboardEvent, root: HTMLElement | null) {
  const items = [...(root?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? [])];
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
