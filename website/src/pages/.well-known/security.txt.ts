import type { APIRoute } from 'astro';
import { REPO_URL, absolute } from '../../data/site.mjs';

/** RFC 9116: where to report a vulnerability (the repository's private advisories, SECURITY.md). */
export const GET: APIRoute = () => {
  // Valid for a year from the build; every release and every website change builds the site again.
  const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
  return new Response(
    [
      `Contact: ${REPO_URL}/security/advisories/new`,
      `Expires: ${expires}`,
      `Policy: ${REPO_URL}/blob/main/SECURITY.md`,
      'Preferred-Languages: de, en',
      `Canonical: ${absolute('/.well-known/security.txt')}`,
      '',
    ].join('\n'),
  );
};
