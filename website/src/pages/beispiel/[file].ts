import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { EXPORTS } from '../../data/exports.mjs';

/** The example kitchen's exports, copied unchanged from pitch/exports/. */
export function getStaticPaths() {
  return EXPORTS.map((x) => ({ params: { file: x.name }, props: { path: x.path } }));
}

export const GET: APIRoute = async ({ props }) => new Response(await readFile((props as { path: string }).path));
