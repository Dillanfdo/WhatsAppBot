export const WIZARD_STEPS = ["Basics", "Hours", "Resources", "Services", "Rules", "Policies", "Review"] as const;

/** Steps 2-7 can be resumed from a URL; step 1 only exists before the store is created. */
export const clampStep = (step: number): number =>
  Number.isFinite(step) ? Math.min(Math.max(Math.trunc(step), 2), WIZARD_STEPS.length) : 2;
