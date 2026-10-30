import { describe, expect, it } from 'vitest';
import { gearProblems } from './gear-form';

describe('gearProblems', () => {
  it('problems in plain words, each once', () => {
    expect(gearProblems(['name: Too small', 'spec.dial: Finest and coarsest must differ'])).toEqual(
      ['Name is required', 'Finest and coarsest must differ']
    );
    expect(gearProblems(['spec.groupSizeMm: Expected number', 'spec.type: Invalid'])).toEqual([
      'Something on this page is not right'
    ]);
  });

  it('a basket has no name of its own, only the brand is named', () => {
    expect(gearProblems(['name: Too small', 'spec.brand: Too small'], 'basket')).toEqual([
      'Brand is required'
    ]);
  });

  it('a size or step interval of 0 is named', () => {
    expect(gearProblems(['spec.sizeG: Too small', 'spec.dial.step: Too small'], 'basket')).toEqual([
      'Size must be more than 0',
      'The step interval must be more than 0'
    ]);
  });

  it('a feature that shots have used cannot be deleted, in plain words', () => {
    expect(gearProblems(['spec.features: used'], 'machine')).toEqual([
      'A feature that shots have used cannot be deleted, change its kind or unit, or lose an option'
    ]);
    expect(gearProblems(['spec.features.5.label: Too small'], 'machine')).toEqual([
      'Each feature needs a name, and names must differ'
    ]);
  });
});
