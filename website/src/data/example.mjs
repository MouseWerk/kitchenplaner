/**
 * The number of positions of the example kitchen, per release: the one place the site takes it
 * from ({positions} in the catalogs). The example file people download is that of the latest
 * release, so the site shows that release's number, never main's. A release that changes the
 * example kitchen adds a row here; scripts/site.test.mjs checks the newest row against the example
 * file in examples/.
 */
import { compareVersions } from './release.mjs';

/** Newest first. */
export const EXAMPLE_POSITIONS = [
  { since: '0.3.0', positions: 67 },
  { since: '0.1.0', positions: 65 },
];

/**
 * The positions shown in the screenshots and exports in pitch/, which are older than the example
 * of the latest release. Their alt texts name this number; change it when pitch/ is taken again.
 */
export const PITCH_POSITIONS = 65;

/**
 * The number of positions of the example kitchen of a version, or null when the version is unknown
 * (no API at build time) or older than every row.
 * @param {string | null | undefined} version
 */
export function examplePositions(version) {
  if (!version) return null;
  return EXAMPLE_POSITIONS.find((r) => compareVersions(version, r.since) >= 0)?.positions ?? null;
}
