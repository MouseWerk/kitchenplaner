// The window's two hidden live regions (lib/announce.ts), and the announcements nobody calls
// for by hand: the editing mode after a switch (Tab, the toolbar, a drop from the catalog) and a
// new version (the notice card itself is no live region, see App.tsx, Toasts).

import { useEffect, useRef } from "react";
import { announce, useAnnouncements, type Politeness } from "../lib/announce";
import { useT } from "../lib/i18n";
import { noticeVisible, useUpdates } from "../lib/updates";
import { useStore } from "../store/store";

export function LiveRegions() {
  const t = useT();
  const messages = useAnnouncements();
  const mode = useStore((s) => s.mode);
  const updates = useUpdates();
  const version = updates.available && noticeVisible(updates) ? updates.available.version : null;

  const lastMode = useRef(mode);
  useEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    announce(t("announce.mode", { mode: t(mode === "room" ? "mode.room" : "mode.arrange") }));
  }, [mode, t]);

  useEffect(() => {
    if (version) announce(t("update.available", { version }));
  }, [version, t]);

  const region = (politeness: Politeness) => (
    <div className="sr-only" role={politeness === "assertive" ? "alert" : "status"} aria-live={politeness} aria-atomic="false" data-live={politeness}>
      {messages
        .filter((m) => m.politeness === politeness)
        .map((m) => (
          <p key={m.id}>{m.text}</p>
        ))}
    </div>
  );

  return (
    <>
      {region("polite")}
      {region("assertive")}
    </>
  );
}
