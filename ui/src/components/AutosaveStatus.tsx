// The status bar's quiet note that the unsaved changes are backed up (lib/autosave.ts). It stays
// while there are unsaved changes and only its time moves on, instead of a message after every
// backup: someone who wonders whether the work is safe finds the answer there, everyone else is
// not interrupted every few seconds. It goes when the project is saved.

import { autosaveStatus, useLastAutosave } from "../lib/autosave";
import { useT } from "../lib/i18n";
import { useStore } from "../store/store";

export function AutosaveStatus() {
  const t = useT();
  const last = useLastAutosave();
  const dirty = useStore((s) => s.dirty);
  if (!dirty || last === null) return null;
  return (
    <span className="status-cell" title={t("autosave.statusHint")}>
      {autosaveStatus(last)}
    </span>
  );
}
