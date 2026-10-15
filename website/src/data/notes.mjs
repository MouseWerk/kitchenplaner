/**
 * The changelog, made at build time from the release notes in docs/releases/v<version>.md (the same
 * files the GitHub releases are made from). The notes use a small part of Markdown: a title line,
 * paragraphs, "## " sections, "- " list items (continued on indented lines), `code`, **bold** and
 * [links](https://...). The "Checklist for Windows (manual)" section is for testing a release and
 * stays off the site.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compareVersions } from './release.mjs';

/**
 * @typedef {{ title: string, paragraphs: string[], items: string[] }} Section
 * @typedef {{ version: string, intro: string[], sections: Section[] }} Notes
 */

export const NOTES_DIR = resolve(process.cwd(), '..', 'docs', 'releases');

/** @param {string} s */
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * One line of Markdown to HTML: escaped first, then code spans (whose content stays literal),
 * bold and links to https addresses.
 * @param {string} text
 */
export function inline(text) {
  const parts = text.split(/(`[^`]+`)/);
  return parts
    .map((p, i) => {
      if (i % 2 === 1) return `<code>${escape(p.slice(1, -1))}</code>`;
      return escape(p)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
    })
    .join('');
}

/**
 * @param {string} version
 * @param {string} md
 * @returns {Notes}
 */
export function parseNotes(version, md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  // The first line names the release ("Kitchenplaner 0.1.0"); the page shows its own heading.
  if (lines[0] && !lines[0].startsWith('#') && !lines[0].startsWith('- ')) lines.shift();
  /** @type {Notes} */
  const notes = { version, intro: [], sections: [] };
  /** @type {Section | null} */
  let section = null;
  /** @type {string[] | null} */
  let block = null; // the paragraph or list item being collected
  let skip = false;
  const flush = () => {
    if (block && !skip) {
      const html = inline(block.join(' ').trim());
      if (block.isItem) section?.items.push(html) ?? notes.intro.push(html);
      else (section ? section.paragraphs : notes.intro).push(html);
    }
    block = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      flush();
      skip = /checklist/i.test(heading[1]);
      section = skip ? null : { title: heading[1].trim(), paragraphs: [], items: [] };
      if (section) notes.sections.push(section);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flush();
      block = Object.assign([line.replace(/^[-*]\s+/, '')], { isItem: true });
      continue;
    }
    if (block) block.push(line.trim());
    else block = [line.trim()];
  }
  flush();
  return notes;
}

/**
 * Every release note, newest first.
 * @param {string} [dir]
 * @returns {Promise<Notes[]>}
 */
export async function readNotes(dir = NOTES_DIR) {
  const files = (await readdir(dir)).filter((f) => /^v\d+(\.\d+)*\.md$/.test(f));
  const out = [];
  for (const f of files) out.push(parseNotes(f.slice(1, -3), await readFile(join(dir, f), 'utf8')));
  return out.sort((a, b) => compareVersions(b.version, a.version));
}
