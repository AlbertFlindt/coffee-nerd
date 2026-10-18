import { describe, expect, it } from 'vitest';
import { gearProblems } from './gear-form';

describe('gearProblems', () => {
  it('D-20: problems in plain words, each once', () => {
    expect(gearProblems(['name: Too small', 'spec.dial: Finest and coarsest must differ'])).toEqual(
      ['Name is required', 'Finest and coarsest must differ']
    );
    expect(gearProblems(['spec.groupSizeMm: Expected number', 'spec.type: Invalid'])).toEqual([
      'Something on this page is not right'
    ]);
  });

  it('D-150: a basket has no name of its own, only the brand is named', () => {
    expect(gearProblems(['name: Too small', 'spec.brand: Too small'], 'basket')).toEqual([
      'Brand is required'
    ]);
  });

  it('D-150, D-159: a size or step interval of 0 is named', () => {
    expect(gearProblems(['spec.sizeG: Too small', 'spec.dial.step: Too small'], 'basket')).toEqual([
      'Size must be more than 0',
      'The step interval must be more than 0'
    ]);
  });
});
