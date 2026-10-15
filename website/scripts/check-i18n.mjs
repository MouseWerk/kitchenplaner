// Checks the text catalogs src/i18n/de.mjs and en.mjs: the same keys and list lengths, the same
// {placeholders}, and the typography of docs/i18n.md: German quotes „…“ in German and none in
// English, an ellipsis character instead of three dots, „Computer“ instead of „Rechner“, no emoji,
// no straight double quotes. Exits with 1 and a list of problems.
import { pathToFileURL } from 'node:url';
import { de } from '../src/i18n/de.mjs';
import { en } from '../src/i18n/en.mjs';

/** @returns {string[]} */
export function checkCatalogs(a, b) {
  const problems = [];
  const walk = (x, y, path) => {
    if (typeof x === 'string' || typeof y === 'string') {
      if (typeof x !== typeof y) return problems.push(`${path}: string in one language only`);
      const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
      if (ph(x) !== ph(y)) problems.push(`${path}: placeholders differ (${ph(x)} / ${ph(y)})`);
      return;
    }
    if (Array.isArray(x) !== Array.isArray(y)) return problems.push(`${path}: list in one language only`);
    if (Array.isArray(x) && x.length !== y.length) problems.push(`${path}: ${x.length} entries in German, ${y.length} in English`);
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    for (const k of keys) {
      if (!(k in x)) problems.push(`${path}.${k}: missing in German`);
      else if (!(k in y)) problems.push(`${path}.${k}: missing in English`);
      else walk(x[k], y[k], `${path}.${k}`);
    }
  };
  walk(a, b, 'de/en');

  const strings = (o, path, out = []) => {
    if (typeof o === 'string') out.push([path, o]);
    else for (const [k, v] of Object.entries(o)) strings(v, `${path}.${k}`, out);
    return out;
  };
  for (const [lang, dict] of [['de', a], ['en', b]]) {
    for (const [path, s] of strings(dict, lang)) {
      if (/\.\.\./.test(s)) problems.push(`${path}: three dots instead of „…“`);
      if (/\p{Extended_Pictographic}/u.test(s)) problems.push(`${path}: emoji`);
      if (/"/.test(s)) problems.push(`${path}: straight double quote`);
      if (/\s…/.test(s)) problems.push(`${path}: space before the ellipsis`);
      if (lang === 'de') {
        if (/Rechner/.test(s)) problems.push(`${path}: „Rechner“, use „Computer“`);
        const opens = (s.match(/„/g) ?? []).length;
        const closes = (s.match(/“/g) ?? []).length;
        if (opens !== closes) problems.push(`${path}: unbalanced „…“ quotes`);
        if (/”/.test(s)) problems.push(`${path}: English closing quote in German`);
      } else if (/„/.test(s)) problems.push(`${path}: German quote in English`);
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkCatalogs(de, en);
  if (problems.length) {
    console.error(`[i18n] ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log('[i18n] German and English catalogs match; typography is fine.');
}
