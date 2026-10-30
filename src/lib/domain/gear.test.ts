import { describe, expect, it } from 'vitest';
import {
  basketName,
  basketSummary,
  builtInFeatures,
  fitsMachines,
  grinderSummary,
  machineSummary,
  NEW_GEAR,
  readQuantity,
  readRange,
  trimmed,
  withoutRetiredPhases
} from './gear';
import { basketSpecSchema, grinderSpecSchema, machineSpecSchema } from './schemas';
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
  it('the type, then the switched-on phases and custom features in sentence case', () => {
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

  it('just the type when nothing is switched on', () => {
    expect(machineSummary({ type: 'lever', features: [] })).toBe('Lever');
  });
});

describe('grinderSummary', () => {
  it('dial mode and step', () => {
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
  it('brand · size, or the brand alone', () => {
    expect(basketName({ brand: 'VST', sizeG: 18000 })).toBe('VST · 18 g');
    expect(basketName({ brand: 'IMS', sizeG: 18500 })).toBe('IMS · 18.5 g');
    expect(basketName({ brand: 'Stock double' })).toBe('Stock double');
  });
});

describe('basketSummary', () => {
  it('type · diameter', () => {
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
  it('the machines whose group size matches the basket', () => {
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

describe('builtInFeatures', () => {
  it('a machine offers temperature, flat pressure and preinfusion, not the low bar phases', () => {
    expect(builtInFeatures().map((f) => f.key)).toEqual([
      'temperature',
      'flat_pressure',
      'preinfusion'
    ]);
    expect(NEW_GEAR.machine().features.map((f) => f.key)).toEqual([
      'temperature',
      'flat_pressure',
      'preinfusion'
    ]);
  });

  it('a low bar phase that is switched on stays, with its pressure', () => {
    const features = builtInFeatures({ low_bar_start: true });
    expect(features.map((f) => f.key)).toEqual([
      'temperature',
      'flat_pressure',
      'preinfusion',
      'low_bar_start'
    ]);
    expect(machineSpecSchema.safeParse({ ...NEW_GEAR.machine(), features }).success).toBe(true);
    expect(features[3].value).toMatchObject({ kind: 'phase', pressure: { step: 500 } });
  });
});

describe('withoutRetiredPhases', () => {
  it('low bar phases leave a machine once they are switched off; everything else stays', () => {
    const features = [
      feature('preinfusion', 'Preinfusion', false),
      feature('low_bar_start', 'Low bar start', true),
      feature('low_bar_end', 'Low bar end', false),
      feature('custom-1', 'Paddle', false)
    ];
    expect(withoutRetiredPhases(features).map((f) => f.key)).toEqual([
      'preinfusion',
      'low_bar_start',
      'custom-1'
    ]);
  });
});

describe('NEW_GEAR', () => {
  it('new gear starts from common values that pass its schema (the basket once it has a brand)', () => {
    expect(machineSpecSchema.parse(NEW_GEAR.machine())).toMatchObject({
      type: 'semi_auto',
      groupSizeMm: 58000
    });
    expect(
      NEW_GEAR.machine()
        .features.filter((f) => f.enabled)
        .map((f) => f.key)
    ).toEqual(['temperature', 'flat_pressure']);
    expect(grinderSpecSchema.parse(NEW_GEAR.grinder()).dial).toEqual({
      mode: 'stepless',
      step: 100,
      finest: 0,
      coarsest: 10000
    });
    expect(basketSpecSchema.safeParse(NEW_GEAR.basket()).success).toBe(false);
    expect(basketSpecSchema.parse({ ...NEW_GEAR.basket(), brand: 'VST' })).toMatchObject({
      shotSize: 'double'
    });
  });
});

describe('trimmed', () => {
  it('sizes without trailing zeros', () => {
    expect(trimmed(58000, 'mm')).toBe('58 mm');
    expect(trimmed(58500, 'mm')).toBe('58.5 mm');
    expect(trimmed(63250)).toBe('63.25');
  });
});

describe('readQuantity', () => {
  it('reads the number at the start of what was typed, with or without a unit', () => {
    expect(readQuantity('1 s')).toBe(1000);
    expect(readQuantity('0,5')).toBe(500);
    expect(readQuantity(' 2.25 ml ')).toBe(2250);
    expect(readQuantity('s')).toBeNull();
    expect(readQuantity('')).toBeNull();
  });
});

describe('readRange', () => {
  it('an empty range is optional, a typed one runs from low to high', () => {
    expect(readRange('')).toEqual({});
    expect(readRange('  ')).toEqual({});
    expect(readRange('0–30 s')).toEqual({ min: 0, max: 30000 });
    expect(readRange('0-30')).toEqual({ min: 0, max: 30000 });
    expect(readRange('0.5 – 2.5 bar')).toEqual({ min: 500, max: 2500 });
  });

  it('a range that is not low to high, or not a range, is refused', () => {
    expect(readRange('30–0')).toBeNull();
    expect(readRange('30')).toBeNull();
    expect(readRange('abc')).toBeNull();
  });
});
