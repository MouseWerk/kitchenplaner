// Facts about the site in one place. The public address: canonical links, hreflang, the sitemap and
// the preview images are built from it; SITE_URL in the environment overrides it (a test deploy).
export const SITE_URL = process.env.SITE_URL || 'https://kitchenplaner.mousewerk.de';

export const SITE_NAME = 'Kitchenplaner';
export const REPO = 'MouseWerk/kitchenplaner';
export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_URL = `${REPO_URL}/releases`;
export const LATEST_URL = `${RELEASES_URL}/latest`;
export const ISSUES_URL = `${REPO_URL}/issues`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

/**
 * Every page in both languages. German is the main language and the x-default.
 * @type {Record<'home' | 'example' | 'download' | 'changelog' | 'imprint' | 'privacy', { de: string, en: string }>}
 */
export const ROUTES = {
  home: { de: '/', en: '/en/' },
  example: { de: '/beispielkueche/', en: '/en/example-kitchen/' },
  download: { de: '/download/', en: '/en/download/' },
  changelog: { de: '/aenderungen/', en: '/en/changelog/' },
  imprint: { de: '/impressum/', en: '/en/legal-notice/' },
  privacy: { de: '/datenschutz/', en: '/en/privacy/' },
};

/** @param {string} path */
export const absolute = (path) => new URL(path, SITE_URL).href;
