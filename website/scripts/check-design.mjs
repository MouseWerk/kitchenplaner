// Design guard for the website's stylesheets (src/styles), like ui/src/styles/styles.test.ts for
// the app. A design rule that is not tested comes back:
// - colors and font weights come from tokens.css; no literal color elsewhere;
// - hover, current, active and focused states are a neutral tint: no accent- or status-colored
//   border, outline, box-shadow or glow;
// - no colored bars on the left (border-left with a color) anywhere;
// - focus rings only on :focus-visible, from the --focus-ring token; outline is never removed;
// - text contrast in both themes: WCAG AA (4.5:1) for every text token on every background token.
// Exits with 1 and a list of problems.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const DIR = fileURLToPath(new URL('../src/styles/', import.meta.url));

/** The innermost rules of a stylesheet: selector plus declarations. */
export function rules(css) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].replace(/\s+/g, ' ').trim(),
    decls: m[2]
      .split(';')
      .filter((d) => d.includes(':'))
      .map((d) => [d.slice(0, d.indexOf(':')).trim().toLowerCase(), d.slice(d.indexOf(':') + 1).trim()]),
  }));
}

const LITERAL = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|\b(white|black|red|green|blue|gray|grey|orange|yellow|purple)\b/i;
const STATE = /:hover|:focus|:active|\[aria-current|\[aria-selected|\[aria-pressed|:checked|\.active|\.current|\.selected/;

/** @returns {string[]} */
export function checkSheet(name, css) {
  const problems = [];
  const isTokens = name === 'tokens.css';
  for (const { selector, decls } of rules(css)) {
    if (/^(@|from\b|to\b|\d)/.test(selector)) continue;
    for (const [p, v] of decls) {
      const where = `${name}: ${selector} { ${p}: ${v} }`;
      if (!isTokens && !p.startsWith('--') && !/^(font-family|src|unicode-range|font-feature-settings)$/.test(p) && LITERAL.test(v)) problems.push(`${where}: literal color, use a token`);
      if (!isTokens && p === 'font-weight' && !/^var\(--fw-/.test(v)) problems.push(`${where}: use var(--fw-*)`);
      if (/^border-left(-color)?$/.test(p) && !/^(0|none)$/.test(v)) problems.push(`${where}: no bars on the left`);
      if (STATE.test(selector) && /^(border|border-color|outline|outline-color|box-shadow)/.test(p) && /--accent|--warning|--link|--danger|--success/.test(v)) problems.push(`${where}: colored frame on a state`);
      if (/^(outline)$/.test(p) && /^(none|0)$/.test(v)) problems.push(`${where}: outline removed`);
      if (p === 'outline' && !/^var\(--focus-ring\)$/.test(v)) problems.push(`${where}: focus ring not from --focus-ring`);
      if (p === 'outline' && !/:focus-visible/.test(selector)) problems.push(`${where}: focus ring outside :focus-visible`);
      if (/^(box-shadow|filter)$/.test(p) && /--accent/.test(v)) problems.push(`${where}: accent glow`);
      if (/^border-image/.test(p)) problems.push(`${where}: gradient border`);
    }
  }
  return problems;
}

/** Relative luminance of #rrggbb. */
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Text contrast of both themes, read from tokens.css. */
export function checkContrast(tokens) {
  const problems = [];
  const code = tokens.replace(/\/\*[\s\S]*?\*\//g, '');
  const light = code.match(/@media \(prefers-color-scheme: light\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const dark = code.replace(/@media[\s\S]*?\n\}/g, '');
  for (const [theme, block] of [['dark', dark], ['light', light]]) {
    const t = Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
    const pairs = [
      ...['--text', '--text-muted', '--text-faint', '--link'].flatMap((fg) => ['--bg', '--bg-alt', '--bg-raised'].map((bg) => [fg, bg])),
      ['--on-accent', '--accent'],
      ['--on-accent', '--accent-hover'],
      ['--text', '--bg-code'],
    ];
    for (const [fg, bg] of pairs) {
      if (!t[fg] || !t[bg]) {
        problems.push(`tokens.css (${theme}): ${fg} or ${bg} is not a #rrggbb color`);
        continue;
      }
      const c = contrast(t[fg], t[bg]);
      if (c < 4.5) problems.push(`tokens.css (${theme}): ${fg} on ${bg} has contrast ${c.toFixed(2)}:1 (needs 4.5:1)`);
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sheets = readdirSync(DIR).filter((f) => f.endsWith('.css'));
  const problems = sheets.flatMap((f) => checkSheet(f, readFileSync(join(DIR, f), 'utf8')));
  problems.push(...checkContrast(readFileSync(join(DIR, 'tokens.css'), 'utf8')));
  if (problems.length) {
    console.error(`[design] ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`[design] ${sheets.length} stylesheets follow the design rules; contrast is AA in both themes.`);
}
