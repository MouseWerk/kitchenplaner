// The choices of the plan set dialog (paper, scale, sheets): remembered per computer like the
// app settings (`settings.ts`), not part of a project. A failing storage only loses the choice.

import { DEFAULT_PLAN_SET, sanitizePlanSetOptions, type PlanSetOptions } from "../render/planSet";

const KEY = "kitchenplaner.planSet.v1";

export function loadPlanSetOptions(): PlanSetOptions {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizePlanSetOptions(JSON.parse(raw)) : { ...DEFAULT_PLAN_SET, elevations: [...DEFAULT_PLAN_SET.elevations] };
  } catch {
    return { ...DEFAULT_PLAN_SET, elevations: [...DEFAULT_PLAN_SET.elevations] };
  }
}

export function savePlanSetOptions(opts: PlanSetOptions) {
  try {
    localStorage.setItem(KEY, JSON.stringify(opts));
  } catch {
    // Storage unavailable: the choice holds until the dialog closes.
  }
}
