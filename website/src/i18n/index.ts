import { de } from './de.mjs';
import { en } from './en.mjs';

export type Lang = 'de' | 'en';
export type Dict = typeof de;

export const dicts: Record<Lang, Dict> = { de, en: en as Dict };

/** Fills {name} placeholders. */
export const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
