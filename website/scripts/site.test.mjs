// Unit tests for the build-time data of the website: release notes, the GitHub releases and the
// checks of the catalogs and stylesheets. Run with `npm test` in website/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseNotes, inline, publishedNotes, readNotes, NOTES_DIR } from '../src/data/notes.mjs';
import { CATALOG_SIZES, catalogUnits } from '../src/data/catalog.mjs';
import { ANCHORS } from '../src/data/site.mjs';
import { toDownloads, compareVersions, available, shown } from '../src/data/release.mjs';
import { EXAMPLE_POSITIONS, examplePositions } from '../src/data/example.mjs';
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

test('the catalog size follows the release people download, not main', () => {
  assert.equal(catalogUnits('0.2.0'), 165);
  assert.equal(catalogUnits('0.2.1'), 359);
  assert.equal(catalogUnits('0.3.0'), 359);
  assert.equal(catalogUnits(null), null);
  assert.equal(catalogUnits('0.0.9'), null);
  // A site built while 0.2.0 is the latest release never claims the newer catalog.
  assert.equal(catalogUnits(toDownloads([rel('v0.2.0')]).latest?.version), 165);
});

test('every catalog size is the one its release notes state', async () => {
  for (const { since, units } of CATALOG_SIZES) {
    const md = await readFile(join(NOTES_DIR, `v${since}.md`), 'utf8');
    const line = md.split('\n').find((l) => /\bunits\b/.test(l) && new RegExp(`(^|\\D)${units}(\\D|$)`).test(l));
    assert.ok(line, `v${since}.md does not mention ${units} units`);
  }
});

test('feature texts carry no unit count of their own; the count comes from catalog.mjs', () => {
  for (const dict of [de, en]) {
    for (const f of dict.home.features.items) assert.ok(!/\d{3}/.test(f.title + f.text), f.title);
    assert.ok(dict.home.features.items.some((f) => 'titleUnknown' in f && f.title.includes('{units}')));
  }
});

test('the changelog shows notes of published releases only', async () => {
  const notes = [parseNotes('0.2.1', 'x'), parseNotes('0.2.0', 'x'), parseNotes('0.1.0', 'x')];
  assert.deepEqual(publishedNotes(notes, toDownloads([rel('v0.1.0'), rel('v0.2.0')])).map((n) => n.version), ['0.2.0', '0.1.0']);
  assert.equal(publishedNotes(notes, toDownloads(null)).length, 3);
  assert.ok((await readNotes()).length > 0);
});

test('the macOS updater archive is not offered as a download', () => {
  const r = rel('v0.2.1');
  r.assets.push(asset('Kitchenplaner_0.2.1_universal.app.tar.gz'), asset('Kitchenplaner_0.2.1_universal.app.tar.gz.sig'));
  for (const b of toDownloads([r]).buttons) assert.ok(!/\.app\.tar\.gz/.test(b.file ?? ''), b.file);
});

test('section anchors are in the language of their page', () => {
  for (const [k, v] of Object.entries(ANCHORS)) {
    assert.match(v.en, /^[a-z-]+$/, k);
    assert.ok(!/ae|oe|ue|fuer/.test(v.en), `${k}: ${v.en}`);
  }
});

test('an entry shows from its since on and before its until; old and new text never show together', () => {
  const at = (v) => toDownloads(v ? [rel(`v${v}`)] : null);
  const old = { until: '0.3.0' };
  const neu = { since: '0.3.0' };
  for (const [v, want] of [['0.2.3', [true, false]], ['0.3.0', [false, true]], ['0.3.1', [false, true]], [null, [true, false]]]) {
    assert.deepEqual([shown(at(v), old), shown(at(v), neu)], want, String(v));
  }
  assert.equal(shown(at('0.2.3'), {}), true);
});

/** The titles of the home page's „Außerdem“ list that a site built with a given release shows. */
const moreTitles = (dict, version) => dict.home.features.more.filter((m) => shown(toDownloads([rel(`v${version}`)]), m)).map((m) => m.title);

test('until 0.3.0 is published the feature list is the one of 0.2.x; with 0.3.0 it adds the connection points', () => {
  const before = ['Geräteliste mit Anschlusswerten', 'Prüfung', 'Export', 'Eine Datei pro Projekt', 'Plansatz als PDF', 'Hersteller und Preise',
    'Gleichzeitigkeitsfaktor', 'Türen nach DIN', 'Feste Positionsnummern', 'Sicherung und Updates', 'Hell und dunkel'];
  assert.deepEqual(moreTitles(de, '0.2.3'), before);
  assert.deepEqual(moreTitles(de, '0.2.2'), before);
  const after = moreTitles(de, '0.3.0');
  for (const t of ['Anschlusspunkte', 'Installationsplan', 'Prüfung der Anschlüsse', 'DXF für CAD', 'Eine Ansicht pro Wand']) assert.ok(after.includes(t), t);
  assert.equal(after.filter((t) => t === 'Prüfung').length, 1);
  assert.equal(moreTitles(en, '0.3.0').length, after.length);
  // The old check text is the one of 0.2.x, the new one says more.
  const check = (v) => de.home.features.more.find((m) => m.title === 'Prüfung' && shown(toDownloads([rel(`v${v}`)]), m)).text;
  assert.ok(!check('0.2.3').includes('Bewegungsflächen'));
  assert.ok(check('0.3.0').includes('Bewegungsflächen'));
});

test('since and until name versions that exist: not newer than the workspace version', async () => {
  const cargo = await readFile(join(NOTES_DIR, '..', '..', 'Cargo.toml'), 'utf8');
  const version = cargo.match(/\[workspace\.package\][^[]*?version\s*=\s*"([\d.]+)"/)?.[1];
  assert.ok(version, 'no version in Cargo.toml');
  const gates = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k of ['since', 'until']) if (typeof o[k] === 'string') gates.push(o[k]);
    for (const v of Object.values(o)) walk(v);
  };
  walk(de);
  walk(en);
  assert.ok(gates.length > 0);
  // A gate one minor version ahead is allowed: texts for the release being prepared.
  const [maj, min] = version.split('.').map(Number);
  for (const g of gates) assert.ok(compareVersions(g, `${maj}.${min + 1}.0`) <= 0, `gate ${g} is beyond ${version}`);
});

test('the example position count follows the release people download', () => {
  assert.equal(examplePositions('0.2.3'), 65);
  assert.equal(examplePositions('0.2.0'), 65);
  assert.equal(examplePositions('0.3.0'), 67);
  assert.equal(examplePositions('0.3.1'), 67);
  assert.equal(examplePositions(null), null);
  assert.equal(examplePositions('0.0.9'), null);
  assert.equal(examplePositions(toDownloads([rel('v0.2.3'), rel('v0.2.2')]).latest?.version), 65);
});

test('the newest example position count is the one of the example files in examples/', async () => {
  for (const name of ['Beispielkueche-Restaurant.kplan', 'Example-Kitchen-Restaurant.kplan']) {
    const file = JSON.parse(await readFile(join(NOTES_DIR, '..', '..', 'examples', name), 'utf8'));
    assert.equal(file.items.length, EXAMPLE_POSITIONS[0].positions, name);
  }
});

test('texts carry no position count of their own; it comes from example.mjs', () => {
  const strings = (o, out = []) => {
    if (typeof o === 'string') out.push(o);
    else if (o && typeof o === 'object') for (const v of Object.values(o)) strings(v, out);
    return out;
  };
  for (const dict of [de, en]) {
    const all = strings(dict);
    assert.ok(!all.some((s) => /\d+\s+(Positionen|positions)\b/.test(s)), dict.lang);
    assert.ok(all.filter((s) => s.includes('{positions}')).length >= 5, dict.lang);
  }
});
