import type { Area } from "../types";
import { condensingHood } from "./condensingHood";
import { entries } from "./entries";
import { exhaustDuct } from "./exhaustDuct";
import { hood, hoodIsland } from "./hood";
import { ventCeiling } from "./ventCeiling";
import { ventShaft } from "./ventShaft";

export const ventilation: Area = { entries, kinds: [hood, hoodIsland, condensingHood, ventCeiling, exhaustDuct, ventShaft] };
