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
});
