/**
 * The size of the app's catalog, per release: the one place the site takes the number of units
 * from ({units} in the catalogs). The site shows the number of the release people download, so a
 * catalog that grows on main shows only once its release is published. A new release that changes
 * the catalog adds a row here; scripts/site.test.mjs checks every row against that version's
 * release notes (docs/releases/v<since>.md), which say the number.
 */
import { compareVersions } from './release.mjs';

/** Newest first. */
export const CATALOG_SIZES = [
  { since: '0.2.1', units: 359 },
  { since: '0.1.0', units: 165 },
];

/**
 * The number of units in the catalog of a version, or null when the version is unknown (no API at
 * build time) or older than every row.
 * @param {string | null | undefined} version
 */
export function catalogUnits(version) {
  if (!version) return null;
  return CATALOG_SIZES.find((r) => compareVersions(version, r.since) >= 0)?.units ?? null;
}
