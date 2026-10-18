import { describe, expect, it } from 'vitest';
import { basketName, basketSummary, fitsMachines, grinderSummary, machineSummary } from './gear';
import type { FeatureDefinition } from './schemas';

const feature = (key: string, label: string, enabled: boolean, switchable = true) =>
  ({
    key,
    label,
    builtIn: !key.startsWith('custom-'),
    enabled,
    switchable,
    value: switchable ? { kind: 'phase', step: 1000 } : { kind: 'number', unit: '°C', step: 1000 }
  }) as FeatureDefinition;

describe('machineSummary', () => {
  it('D-38: the type, then the switched-on phases and custom features in sentence case', () => {
    const features = [
      feature('temperature', 'Temperature', true, false),
      feature('preinfusion', 'Preinfusion', true),
      feature('low_bar_start', 'Low bar start', true),
      feature('low_bar_end', 'Low bar end', true),
      feature('custom-1', 'Bloom pause', false)
    ];
    expect(machineSummary({ type: 'semi_auto', groupSizeMm: 58000, features })).toBe(
      'Semi-auto · Preinfusion, low bar start, low bar end'
    );
  });

  it('D-38: just the type when nothing is switched on', () => {
    expect(machineSummary({ type: 'lever', features: [] })).toBe('Lever');
  });
});

describe('grinderSummary', () => {
  it('D-38, D-48: dial mode and step', () => {
    const dial = { mode: 'stepless' as const, step: 100, finest: 0, coarsest: 16000 };
    expect(grinderSummary({ type: 'electric', burrs: 'flat', dial })).toBe(
      'Stepless · steps of 0.1'
    );
    expect(
      grinderSummary({
        type: 'hand',
        burrs: 'conical',
        dial: { ...dial, mode: 'stepped', step: 1000 }
      })
    ).toBe('Stepped · steps of 1');
  });
});

describe('basketName', () => {
  it('D-150: brand · size, or the brand alone', () => {
    expect(basketName({ brand: 'VST', sizeG: 18000 })).toBe('VST · 18 g');
    expect(basketName({ brand: 'IMS', sizeG: 18500 })).toBe('IMS · 18.5 g');
    expect(basketName({ brand: 'Stock double' })).toBe('Stock double');
  });
});

describe('basketSummary', () => {
  it('D-38, D-49: type · diameter', () => {
    expect(
      basketSummary({ brand: 'VST', type: 'precision', shotSize: 'double', diameterMm: 58000 })
    ).toBe('Precision · 58 mm');
    expect(
      basketSummary({ brand: 'VST', type: 'standard', shotSize: 'single', diameterMm: 58500 })
    ).toBe('Standard · 58.5 mm');
    expect(basketSummary({ brand: 'VST', type: 'pressurized', shotSize: 'single' })).toBe(
      'Pressurized'
    );
  });
});

describe('fitsMachines', () => {
  it('D-49: the machines whose group size matches the basket', () => {
    const machines = [
      { name: 'Lelit Bianca', groupSizeMm: 58000 },
      { name: 'Flair', groupSizeMm: 46000 },
      { name: 'Unknown', groupSizeMm: undefined }
    ];
    expect(fitsMachines(58000, machines)).toBe('Fits Lelit Bianca');
    expect(fitsMachines(51000, machines)).toBe('Fits none of your machines');
    expect(fitsMachines(undefined, machines)).toBeNull();
  });
});
