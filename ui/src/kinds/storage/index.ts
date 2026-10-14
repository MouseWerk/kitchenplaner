import type { Area } from "../types";
import { dunnageRack } from "./dunnageRack";
import { entries } from "./entries";
import { ingredientBin } from "./ingredientBin";
import { knifeBar } from "./knifeBar";
import { rackTrolley15, rackTrolley20 } from "./rackTrolley";
import { shelving, shelving5, shelvingCorner, shelvingPerforated, shelvingSlatted } from "./shelving";
import { tallCabinet } from "./tallCabinet";
import { utensilRail } from "./utensilRail";
import { wallCabinet } from "./wallCabinet";
import { wallShelf, wallShelfDouble } from "./wallShelf";

export const storage: Area = {
  entries,
  kinds: [shelving, shelving5, shelvingPerforated, shelvingSlatted, shelvingCorner, dunnageRack, rackTrolley15, rackTrolley20, wallShelf, wallShelfDouble, wallCabinet, tallCabinet, ingredientBin, utensilRail, knifeBar],
};
