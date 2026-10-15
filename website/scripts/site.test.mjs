// Unit tests for the build-time data of the website: release notes, the GitHub releases and the
// checks of the catalogs and stylesheets. Run with `npm test` in website/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotes, inline } from '../src/data/notes.mjs';
import { toDownloads, compareVersions, available } from '../src/data/release.mjs';
import { CROPS } from '../src/data/crops.mjs';
import { checkCatalogs } from './check-i18n.mjs';
import { checkSheet, checkContrast } from './check-design.mjs';
import { de } from '../src/i18n/de.mjs';
import { en } from '../src/i18n/en.mjs';

test('release notes: title skipped, intro, sections, items, checklist left out', () => {
  const md = [
    'Kitchenplaner 0.2.0',
    '',
    'Intro with `code` and <b>.',
    '',
    '## Improved',
    '',
    '- First item',
    '  continued.',
    '- „Grundriss“: **bold** and [a link](https://example.org/x).',
    '',
    '## Fixed',
    '',
    '- A fix.',
    '',
    '## Checklist for Windows (manual)',
    '',
    '- Download the installer.',
  ].join('\n');
  const n = parseNotes('0.2.0', md);
  assert.deepEqual(n.intro, ['Intro with <code>code</code> and &lt;b&gt;.']);
  assert.deepEqual(n.sections.map((s) => s.title), ['Improved', 'Fixed']);
  assert.deepEqual(n.sections[0].items, ['First item continued.', '„Grundriss“: <strong>bold</strong> and <a href="https://example.org/x" rel="noopener">a link</a>.']);
  assert.deepEqual(n.sections[1].items, ['A fix.']);
  assert.ok(!JSON.stringify(n).includes('Download the installer'));
});

test('inline markdown keeps code literal and drops non-https links', () => {
  assert.equal(inline('`**x**`'), '<code>**x**</code>');
  assert.equal(inline('[x](javascript:alert(1))'), '[x](javascript:alert(1))');
});

const asset = (name) => ({ name, browser_download_url: `https://github.com/d/${name}`, size: 1000, state: 'uploaded' });
const rel = (tag, extra = {}) => ({
  tag_name: tag, html_url: `https://github.com/r/${tag}`, published_at: '2026-10-15T05:58:50Z', draft: false, prerelease: false,
  assets: [asset(`Kitchenplaner_${tag.slice(1)}_x64-setup.exe`), asset(`Kitchenplaner_${tag.slice(1)}_universal.dmg`), asset('SHA256SUMS.txt')],
  ...extra,
});

test('downloads: the highest published version, drafts and pre-releases ignored', () => {
  const d = toDownloads([rel('v0.9.0'), rel('v0.10.0'), rel('v0.11.0', { draft: true }), rel('v0.12.0', { prerelease: true })]);
  assert.equal(d.latest?.version, '0.10.0');
  assert.equal(d.buttons.find((b) => b.id === 'win-setup')?.href, 'https://github.com/d/Kitchenplaner_0.10.0_x64-setup.exe');
  // A file the release does not have links to the release page.
  assert.equal(d.buttons.find((b) => b.id === 'linux-deb')?.href, 'https://github.com/r/v0.10.0');
  assert.deepEqual([...d.byTag.keys()].sort(), ['v0.10.0', 'v0.9.0']);
});

test('downloads without the API link every button to the latest release page', () => {
  const d = toDownloads(null);
  assert.equal(d.latest, null);
  for (const b of d.buttons) assert.equal(b.href, 'https://github.com/MouseWerk/kitchenplaner/releases/latest');
});

test('compareVersions orders numerically', () => {
  assert.ok(compareVersions('0.10.0', '0.9.1') > 0);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
});

test('the catalogs pass, and the check finds missing keys and bad typography', () => {
  assert.deepEqual(checkCatalogs(de, en), []);
  const p = checkCatalogs({ a: 'Speichern...', b: 'Der Rechner', c: '„offen' }, { a: 'Save…', b: 'x', d: 'y' });
  assert.ok(p.some((x) => x.includes('de/en.c: missing in English')));
  assert.ok(p.some((x) => x.includes('de/en.d: missing in German')));
  assert.ok(p.some((x) => x.includes('three dots')));
  assert.ok(p.some((x) => x.includes('Rechner')));
  assert.ok(p.some((x) => x.includes('unbalanced')));
});

test('the design guard finds accent frames, left bars, literal colors and removed focus', () => {
  const css = `
    .a:hover { border-color: var(--accent); }
    .b { border-left: 3px solid var(--text); }
    .c { color: #ff0000; }
    .d:focus { outline: none; }
    .e { font-weight: 700; }`;
  const p = checkSheet('x.css', css).join('\n');
  for (const s of ['colored frame', 'bars on the left', 'literal color', 'outline removed', 'var(--fw-*)']) assert.ok(p.includes(s), s);
  assert.deepEqual(checkContrast(':root { --text: #777777; --bg: #888888; }').filter((x) => x.includes('--text on --bg')).length, 1);
});

test('update files (.sig, latest.json) are never offered as downloads', () => {
  const r = rel('v0.2.0');
  r.assets.push(asset('Kitchenplaner_0.2.0_x64-setup.exe.sig'), asset('latest.json'), asset('Kitchenplaner_0.2.0_amd64.AppImage.sig'));
  const d = toDownloads([r]);
  for (const b of d.buttons) assert.ok(!/\.sig$|latest\.json$/.test(b.file ?? ''), b.file);
  assert.equal(d.buttons.find((b) => b.id === 'win-setup')?.file, 'Kitchenplaner_0.2.0_x64-setup.exe');
});

test('texts for a version show only once that version is published', () => {
  assert.equal(available(toDownloads([rel('v0.1.0')]), '0.2.0'), false);
  assert.equal(available(toDownloads([rel('v0.2.0')]), '0.2.0'), true);
  assert.equal(available(toDownloads(null), '0.2.0'), false);
  assert.equal(available(toDownloads(null), undefined), true);
});

test('phone crops lie inside the 3840 x 2160 screenshots and are wide enough to stay sharp', () => {
  for (const [name, c] of Object.entries(CROPS)) {
    assert.ok(c.left >= 0 && c.top >= 0 && c.left + c.width <= 3840 && c.top + c.height <= 2160, name);
    assert.ok(c.width >= 600, `${name} is only ${c.width} px wide`);
  }
});
