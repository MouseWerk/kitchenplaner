// Usual sizes of professional kitchen equipment that several areas of the catalog share (mm).
// The catalog values are typical starting points, not the data of a manufacturer; every placed
// item can be resized and its connection values edited.

/** Standard working height of tables and cooking lines (mm). */
export const WORK_HEIGHT = 900;
/** Usual lower edge of wall shelves above the floor (mm). */
export const WALL_SHELF_ELEVATION = 1500;
/** Usual lower edge of a canopy hood above the floor (mm). */
export const HOOD_ELEVATION = 2000;
/**
 * Highest top of a unit set into the floor (floor drains, drainage channels, mm): its frame lies
 * flush with the tiles, so nothing stands proud to trip over.
 */
export const FLUSH_HEIGHT = 5;
/** Width steps of tables, sinks and shelves (mm). */
export const TABLE_WIDTHS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000] as const;
