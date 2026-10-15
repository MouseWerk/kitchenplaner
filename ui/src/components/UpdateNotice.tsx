// The notice of a new version (lib/updates.ts): a card above the status bar with the messages
// (App.tsx, Toasts), never a dialog, so planning goes on while it shows. Also the update entries
// of the settings menu.

import { Download } from "lucide-react";
import { useT } from "../lib/i18n";
import { updateSettings, useSettings } from "../lib/settings";
import { checkForUpdate, installUpdate, noticeVisible, percent, putOffUpdate, useUpdates } from "../lib/updates";
import type { MenuEntry } from "./Menu";

export function UpdateNotice() {
  const t = useT();
  const s = useUpdates();
  if (!s.available || !noticeVisible(s)) return null;
  const { version, manual } = s.available;
  const p = s.progress ? percent(s.progress) : null;
  return (
    <section className="update-notice" aria-label={t("update.available", { version })}>
      <div className="update-head">
        <Download size={15} strokeWidth={1.75} aria-hidden />
        <strong>{t("update.available", { version })}</strong>
      </div>
      {manual ? (
        <p className="update-text">{t("update.manual")}</p>
      ) : s.progress ? (
        <>
          <p className="update-text">{p === null ? t("update.downloading") : p < 100 ? t("update.downloadingPercent", { percent: p }) : t("update.installing")}</p>
          <div className="update-bar" role="progressbar" aria-label={t("update.downloading")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p ?? undefined}>
            <div className="update-bar-fill" style={{ width: `${p ?? 0}%` }} />
          </div>
        </>
      ) : (
        s.installFailed && <p className="update-text">{t("update.failed")}</p>
      )}
      {!s.progress && (
        <div className="btn-row update-actions">
          {!manual && (
            <button type="button" className="btn small primary" onClick={() => void installUpdate()}>
              {s.installFailed ? t("update.retry") : t("update.now")}
            </button>
          )}
          <button type="button" className="btn small" onClick={putOffUpdate}>
            {t("update.later")}
          </button>
        </div>
      )}
    </section>
  );
}

/** The settings menu's update entries; none in builds that do not look for updates. */
export function useUpdateMenuEntries(): MenuEntry[] {
  const t = useT();
  const s = useUpdates();
  const settings = useSettings();
  if (!s.supported) return [];
  return [
    "sep",
    {
      label: t("update.auto"),
      checked: settings.autoUpdate,
      onSelect: () => {
        updateSettings({ autoUpdate: !settings.autoUpdate });
        // Switched on: look now rather than in a few hours.
        if (!settings.autoUpdate) void checkForUpdate();
      },
    },
    { label: t("update.checkNow"), disabled: s.progress !== null, onSelect: () => void checkForUpdate(true) },
    ...(s.checkFailed ? [{ label: t("update.checkFailed"), disabled: true, onSelect: () => {} }] : []),
  ];
}
