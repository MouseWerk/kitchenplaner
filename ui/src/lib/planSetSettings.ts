// The choices of the plan set dialog (paper, scale, sheets, installation plans): remembered per
// computer like the app settings (`settings.ts`), not part of a project. A failing storage only
// loses the choice. Options added later read as their default from what an older version stored.

import { sanitizePlanSetOptions, type PlanSetOptions } from "../render/planSet";

const KEY = "kitchenplaner.planSet.v1";

export function loadPlanSetOptions(): PlanSetOptions {
  try {
    const raw = localStorage.getItem(KEY);
    return sanitizePlanSetOptions(raw ? JSON.parse(raw) : null);
  } catch {
    // The defaults as fresh arrays, never the shared DEFAULT_PLAN_SET.
    return sanitizePlanSetOptions(null);
  }
}

export function savePlanSetOptions(opts: PlanSetOptions) {
  try {
    localStorage.setItem(KEY, JSON.stringify(opts));
  } catch {
    // Storage unavailable: the choice holds until the dialog closes.
  }
}
