// Appearance, language and update checks: stored per computer in the webview's storage (they are not part of a
// project). Applied instantly; a failing storage (private mode) only loses the choice.

import { useSyncExternalStore } from "react";
import { setLang, systemLang, type Lang } from "./i18n";

export type ThemeChoice = "system" | "light" | "dark";
export type LangChoice = "system" | Lang;

export interface AppSettings {
  theme: ThemeChoice;
  lang: LangChoice;
  /** Look for a newer version at start and every few hours (lib/updates.ts). */
  autoUpdate: boolean;
}

const KEY = "kitchenplaner.settings.v1";
const DEFAULTS: AppSettings = { theme: "system", lang: "system", autoUpdate: true };

let current: AppSettings = load();
const listeners = new Set<() => void>();

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<AppSettings>;
    return {
      theme: v.theme === "light" || v.theme === "dark" ? v.theme : "system",
      lang: v.lang === "de" || v.lang === "en" ? v.lang : "system",
      autoUpdate: v.autoUpdate !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

export function getSettings(): AppSettings {
  return current;
}

export function updateSettings(patch: Partial<AppSettings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage unavailable: the choice holds for this session.
  }
  applySettings();
  for (const f of listeners) f();
}

/** Puts the theme on <html> and switches the display language. */
export function applySettings() {
  const root = document.documentElement;
  if (current.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", current.theme);
  setLang(current.lang === "system" ? systemLang() : current.lang);
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => current,
  );
}
