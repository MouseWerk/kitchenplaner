/**
 * Phone crops of the screenshots in pitch/: the region of each 3840 x 2160 screenshot that reads
 * on a phone (the 3D kitchen, a part of the plan with numbers and dimensions, the catalog column,
 * the connection values). scripts/crops.mjs cuts them into src/assets/crops/ before every build;
 * Shot.astro offers them below 640 px instead of the whole app window. Regions in source pixels
 * (device scale 2), so a crop 1100 px wide stays sharp on a 360 px phone at 3x.
 * @type {Record<string, { left: number, top: number, width: number, height: number }>}
 */
export const CROPS = {
  '02-grundriss': { left: 1830, top: 290, width: 1180, height: 885 },
  '03-grundriss-kochinsel-auswahl': { left: 1800, top: 560, width: 1200, height: 740 },
  '04-3d-uebersicht': { left: 864, top: 624, width: 2064, height: 1080 },
  '05-3d-kochinsel': { left: 1000, top: 300, width: 1840, height: 1380 },
  '06-3d-begehen': { left: 800, top: 250, width: 2200, height: 1650 },
  '07-3d-von-oben': { left: 624, top: 240, width: 2460, height: 1720 },
  '08-ansichten': { left: 1908, top: 1109, width: 1320, height: 751 },
  '10-katalog-vorschau': { left: 0, top: 100, width: 1100, height: 860 },
  '11-operator-verschieben': { left: 792, top: 720, width: 1200, height: 816 },
  '12-raum-wand': { left: 2000, top: 96, width: 1840, height: 820 },
  '13-inspektor-kombidaempfer': { left: 3230, top: 980, width: 610, height: 510 },
  '16-ansicht-schnitttiefe': { left: 552, top: 100, width: 1344, height: 756 },
};
