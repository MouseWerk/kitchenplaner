// Display language: German (default) and English. The strings live in `ui/src/locales/`
// (`de.ts` is the source of the key type, `en.ts` must have the same keys; a test checks it).
//
// `t(key, vars)` translates in the current language: `{name}` is replaced by `vars.name`, and a
// plural entry (`{ one, other }`) picks its form by `vars.n`. Components call `useT()`, which
// re-renders them when the language changes.

import { useSyncExternalStore } from "react";
import { de, type Msg } from "../locales/de";
import { en } from "../locales/en";

export type TKey = keyof typeof de;
export type Lang = "de" | "en";
export type TVars = Record<string, string | number>;

export const DICTS: Record<Lang, Record<TKey, Msg>> = { de, en };

/** "de" for a German locale tag („de“, „de-AT“, „de_CH.UTF-8“), else "en". */
export const langFromLocale = (tag: string | undefined | null): Lang => (/^de(?:$|[-_.@])/i.test(tag?.trim() ?? "") ? "de" : "en");

export function systemLang(): Lang {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  return langFromLocale(nav?.languages?.[0] ?? nav?.language);
}

let lang: Lang = "de";
let version = 0;
const listeners = new Set<() => void>();

export const currentLang = () => lang;

export function setLang(l: Lang) {
  if (typeof document !== "undefined") document.documentElement.lang = l;
  if (l === lang) return;
  lang = l;
  version++;
  for (const f of listeners) f();
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => void listeners.delete(f);
};

/** Translates `key` in the current language (or `in`). */
export function t(key: TKey, vars?: TVars, inLang: Lang = lang): string {
  const msg: Msg = DICTS[inLang][key] ?? DICTS.de[key] ?? key;
  let s: string;
  if (typeof msg === "string") s = msg;
  else {
    const n = Number(vars?.n ?? 0);
    s = new Intl.PluralRules(inLang).select(n) === "one" ? msg.one : msg.other;
  }
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? formatVar(vars[k], inLang) : m));
}

function formatVar(v: string | number, l: Lang): string {
  return typeof v === "number" ? v.toLocaleString(l === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 2 }) : v;
}

/** The translate function, re-rendering the component when the language changes. */
export function useT(): typeof t {
  useSyncExternalStore(subscribe, () => version);
  return t;
}

/** Formats a number in the display language (decimal comma in German). */
export function num(v: number, digits = 0): string {
  return v.toLocaleString(lang === "de" ? "de-DE" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * An ISO date ("2026-10-12") as the display language writes it: "12.10.2026" in German, the ISO
 * form in English (unambiguous on both sides of the Atlantic). Anything else comes back as is.
 */
export function formatDate(iso: string, inLang: Lang = lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return inLang === "de" ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/**
 * Reads a typed date back as ISO, tolerantly: year first ("2026-10-12", "2026/10/12") or day
 * first ("12.10.2026", "12/10/2026", "12-10-26", "1.2.2026"), with any of . / - or spaces between
 * the parts and a two-digit year in this century. "" for an empty text, null for anything that is
 * no real date.
 */
export function parseDate(text: string): string | null {
  const s = text.trim();
  if (!s) return "";
  const parts = s.split(/\s*[./\-\s]\s*/).filter((x) => x !== "");
  if (parts.length !== 3 || !parts.every((x) => /^\d+$/.test(x))) return null;
  const [y, mo, d] = parts[0].length === 4 ? parts : [parts[2], parts[1], parts[0]];
  const year = y.length === 2 ? 2000 + Number(y) : y.length === 4 ? Number(y) : NaN;
  const month = Number(mo);
  const day = Number(d);
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1) return null;
  // Day 0 of the next month is the last day of this one (UTC: no time zone shifts).
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
