import type { Area } from "../types";
import { condensingHood } from "./condensingHood";
import { displacementOutlet, swirlDiffuser } from "./diffuser";
import { dishHood } from "./dishHood";
import { downdraft } from "./downdraft";
import { entries } from "./entries";
import { exhaustDuct } from "./exhaustDuct";
import { fanBox } from "./fanBox";
import { fireSuppression } from "./fireSuppression";
import { hood, hoodIsland, hoodSupply, hoodUv } from "./hood";
import { ventCeiling, ventCeilingSupply } from "./ventCeiling";
import { ventShaft } from "./ventShaft";

export const ventilation: Area = {
  entries,
  kinds: [hood, hoodIsland, hoodUv, hoodSupply, condensingHood, dishHood, ventCeiling, ventCeilingSupply, downdraft, swirlDiffuser, displacementOutlet, fireSuppression, fanBox, exhaustDuct, ventShaft],
};
