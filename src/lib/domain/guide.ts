// The step-by-step start after sign-up: its steps in order, and what a page shows for one.

export const GUIDE_STEPS = ['machine', 'grinder', 'basket', 'setup', 'bean'] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];

/** "Step 2 of 5" under the page title, and "Next" as its button. */
export type Guide = { step: number; of: number };

export const guideOf = (step: GuideStep): Guide => ({
  step: GUIDE_STEPS.indexOf(step) + 1,
  of: GUIDE_STEPS.length
});
