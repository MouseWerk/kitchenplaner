/**
 * The releases of Kitchenplaner, read once at build time from the public GitHub API. The download
 * buttons link straight to the files of the latest release (their names carry the version, so a
 * .../releases/latest/download/<name> link cannot be written down ahead). When the API cannot be
 * read (offline build, rate limit), every button links to the latest release's page instead, which
 * is always right; the build only warns. The deploy workflow runs again after every release.
 *
 * GITHUB_TOKEN (optional, set in CI) raises the API rate limit. KP_RELEASES_JSON (optional) is the
 * path of a saved answer of /releases, for offline builds.
 */
import { readFile } from 'node:fs/promises';
import { LATEST_URL, REPO } from './site.mjs';

/**
 * @typedef {{ name: string, browser_download_url: string, size: number, state?: string }} ApiAsset
 * @typedef {{ tag_name: string, html_url: string, published_at: string | null, draft: boolean, prerelease: boolean, assets: ApiAsset[] }} ApiRelease
 * @typedef {{ version: string, tag: string, publishedAt: string | null, htmlUrl: string, assets: { name: string, href: string, size: number }[] }} Release
 * @typedef {{ id: string, file: string | null, href: string, size: number | null }} Button
 * @typedef {{ latest: Release | null, byTag: Map<string, Release>, buttons: Button[] }} Downloads
 */

/** The release files the site offers; names as written by .github/workflows/release.yml. */
export const WANTED = [
  { id: 'win-setup', match: /^Kitchenplaner_[\d.]+_x64-setup\.exe$/ },
  { id: 'mac-dmg', match: /^Kitchenplaner_[\d.]+_universal\.dmg$/ },
  { id: 'mac-app', match: /^Kitchenplaner_[\d.]+_universal\.app\.tar\.gz$/ },
  { id: 'linux-appimage', match: /^Kitchenplaner_[\d.]+_amd64\.AppImage$/ },
  { id: 'linux-deb', match: /^Kitchenplaner_[\d.]+_amd64\.deb$/ },
  { id: 'checksums', match: /^SHA256SUMS\.txt$/ },
  { id: 'example-de', match: /^Beispielkueche-Restaurant\.kplan$/ },
  { id: 'example-en', match: /^Example-Kitchen-Restaurant\.kplan$/ },
];

/**
 * Compares "0.10.0" with "0.9.1": negative when a < b.
 * @param {string} a
 * @param {string} b
 */
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * The site's view of the API answer: published releases only (no drafts, no pre-releases), the
 * highest version as the latest, and one button per wanted file.
 * @param {ApiRelease[] | null} api
 * @returns {Downloads}
 */
export function toDownloads(api) {
  /** @type {Map<string, Release>} */
  const byTag = new Map();
  for (const r of Array.isArray(api) ? api : []) {
    if (r.draft || r.prerelease || !/^v\d+(\.\d+)*$/.test(r.tag_name)) continue;
    byTag.set(r.tag_name, {
      version: r.tag_name.slice(1),
      tag: r.tag_name,
      publishedAt: r.published_at,
      htmlUrl: r.html_url,
      assets: r.assets
        .filter((a) => (a.state ?? 'uploaded') === 'uploaded')
        .map((a) => ({ name: a.name, href: a.browser_download_url, size: a.size })),
    });
  }
  const latest = [...byTag.values()].sort((a, b) => compareVersions(b.version, a.version))[0] ?? null;
  const buttons = WANTED.map((w) => {
    const a = latest?.assets.find((x) => w.match.test(x.name));
    return { id: w.id, file: a?.name ?? null, href: a?.href ?? latest?.htmlUrl ?? LATEST_URL, size: a?.size ?? null };
  });
  return { latest, byTag, buttons };
}

/** @returns {Promise<ApiRelease[] | null>} */
async function readApi() {
  const file = process.env.KP_RELEASES_JSON;
  if (file) return JSON.parse(await readFile(file, 'utf8'));
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'kitchenplaner-website-build' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, { headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.warn(`[release] GitHub API answered ${res.status}; the download buttons link to the latest release's page.`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`[release] GitHub API not reachable (${/** @type {Error} */ (e).message}); the download buttons link to the latest release's page.`);
    return null;
  }
}

/** @type {Promise<Downloads> | undefined} */
let cached;

/** @returns {Promise<Downloads>} */
export function getDownloads() {
  cached ??= readApi().then((api) => {
    const d = toDownloads(api);
    if (d.latest) console.log(`[release] ${d.latest.tag}: ${d.buttons.filter((b) => b.file).length} of ${d.buttons.length} files linked directly.`);
    return d;
  });
  return cached;
}

/**
 * @param {Downloads} d
 * @param {string} id
 */
export const button = (d, id) => /** @type {Button} */ (d.buttons.find((b) => b.id === id));

/**
 * @param {number | null} bytes
 * @param {'de' | 'en'} lang
 */
export function formatSize(bytes, lang) {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}

/**
 * @param {string | null} iso
 * @param {'de' | 'en'} lang
 */
export function formatDate(iso, lang) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
}
