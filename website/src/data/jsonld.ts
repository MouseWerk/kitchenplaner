/**
 * schema.org structured data. Every indexable page gets one JSON-LD @graph: the WebSite and the
 * Organization (Mousewerk, from legal.mjs) on every page, the SoftwareApplication on the start
 * pages and a BreadcrumbList on the others. Nodes refer to each other by @id. No ratings or reviews:
 * there are none to show.
 */
import { getImage } from 'astro:assets';
import appIcon from '../../../src-tauri/icons/icon.png';
import { LEGAL } from './legal.mjs';
import { LICENSE_URL, LATEST_URL, REPO_URL, ROUTES, SITE_NAME, absolute } from './site.mjs';
import type { Downloads } from './release.mjs';
import { shot, type ShotName } from './shots';

type Node = Record<string, unknown>;
type Lang = 'de' | 'en';

export const ids = {
  website: absolute('/#website'),
  organization: absolute('/#organization'),
  app: absolute('/#software'),
};

export const graph = (nodes: Node[]) => JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\u003c');

export function website(lang: Lang): Node {
  return { '@type': 'WebSite', '@id': ids.website, url: absolute(ROUTES.home.de), name: SITE_NAME, inLanguage: lang, publisher: { '@id': ids.organization } };
}

export async function organization(): Promise<Node> {
  const logo = await getImage({ src: appIcon, format: 'png', width: 512 });
  // "34132 Kassel" -> postal code and town.
  const [postalCode, ...town] = (LEGAL.city ?? '').split(' ');
  return {
    '@type': 'Organization',
    '@id': ids.organization,
    name: (LEGAL.name ?? '').split(',')[0],
    legalName: LEGAL.name,
    logo: { '@type': 'ImageObject', url: absolute(logo.src), width: 512, height: 512 },
    email: LEGAL.email,
    ...(LEGAL.phone ? { telephone: LEGAL.phone } : {}),
    ...(LEGAL.vat ? { vatID: LEGAL.vat } : {}),
    address: { '@type': 'PostalAddress', streetAddress: LEGAL.street, postalCode, addressLocality: town.join(' '), addressCountry: 'DE' },
    sameAs: ['https://github.com/MouseWerk'],
  };
}

async function screenshot(name: ShotName, caption: string): Promise<Node> {
  const img = await getImage({ src: shot(name), format: 'webp', width: 1600, quality: 78 });
  return { '@type': 'ImageObject', url: absolute(img.src), caption };
}

export async function softwareApplication(lang: Lang, d: Downloads, text: { description: string; features: string[]; shots: [ShotName, string][] }): Promise<Node> {
  const date = d.latest?.publishedAt?.slice(0, 10);
  const files = d.buttons.filter((b) => b.file && /^(win|mac|linux)-/.test(b.id)).map((b) => b.href);
  return {
    '@type': 'SoftwareApplication',
    '@id': ids.app,
    name: SITE_NAME,
    description: text.description,
    url: absolute(ROUTES.home[lang]),
    image: absolute('/og/home.jpg'),
    screenshot: await Promise.all(text.shots.map(([n, c]) => screenshot(n, c))),
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Windows 10, Windows 11, macOS 11+, Linux',
    inLanguage: ['de', 'en'],
    featureList: text.features,
    isAccessibleForFree: true,
    license: LICENSE_URL,
    ...(d.latest ? { softwareVersion: d.latest.version, releaseNotes: d.latest.htmlUrl } : {}),
    ...(date ? { datePublished: date } : {}),
    downloadUrl: files.length ? files : LATEST_URL,
    installUrl: absolute(ROUTES.download[lang]),
    isBasedOn: { '@type': 'SoftwareSourceCode', codeRepository: REPO_URL, programmingLanguage: ['Rust', 'TypeScript'], license: LICENSE_URL },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', url: absolute(ROUTES.download[lang]) },
    author: { '@id': ids.organization },
    publisher: { '@id': ids.organization },
  };
}

export function breadcrumbs(lang: Lang, page: keyof typeof ROUTES, name: string, home: string): Node {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absolute(ROUTES[page][lang])}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: home, item: absolute(ROUTES.home[lang]) },
      { '@type': 'ListItem', position: 2, name, item: absolute(ROUTES[page][lang]) },
    ],
  };
}
