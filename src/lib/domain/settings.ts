// Settings: the −/+ steps you can choose for dose, yield and time, in thousandths.

export type StepName = 'dose' | 'yield' | 'time';

/** 0.1, 0.5 or 1 (g for dose and yield, s for time). */
export const STEP_CHOICES: Record<StepName, readonly number[]> = {
  dose: [100, 500, 1000],
  yield: [100, 500, 1000],
  time: [100, 500, 1000]
};

export function isStepChoice(name: StepName, step: number): boolean {
  return STEP_CHOICES[name].includes(step);
}
