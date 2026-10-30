import { describe, expect, it } from 'vitest';
import { isStepChoice, STEP_CHOICES } from './settings';

describe('STEP_CHOICES', () => {
  it('dose, yield and time each offer 0.1, 0.5 and 1', () => {
    expect(STEP_CHOICES).toEqual({
      dose: [100, 500, 1000],
      yield: [100, 500, 1000],
      time: [100, 500, 1000]
    });
  });

  it('the defaults (0.1 g, 0.1 g, 1 s) are among the choices', () => {
    expect(STEP_CHOICES.dose).toContain(100);
    expect(STEP_CHOICES.yield).toContain(100);
    expect(STEP_CHOICES.time).toContain(1000);
  });
});

describe('isStepChoice', () => {
  it('accepts only the offered steps', () => {
    expect(isStepChoice('dose', 500)).toBe(true);
    expect(isStepChoice('time', 100)).toBe(true);
    expect(isStepChoice('dose', 200)).toBe(false);
    expect(isStepChoice('yield', 0)).toBe(false);
    expect(isStepChoice('time', Number.NaN)).toBe(false);
  });
});
