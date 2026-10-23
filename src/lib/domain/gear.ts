// Short texts about gear for the Gear page and the gear pages (D-38, D-48, D-49, D-150). Pure.
import type { BasketSpec, FeatureDefinition, GrinderSpec, MachineSpec } from './schemas';
import {
  decimalsForStep,
  formatQuantity,
  formatNumber,
  toThousandths,
  type Thousandths
} from './units';

const MACHINE_TYPE = {
  automatic: 'Automatic',
  semi_auto: 'Semi-auto',
  lever: 'Lever',
  manual: 'Manual'
};
const BASKET_TYPE = { precision: 'Precision', standard: 'Standard', pressurized: 'Pressurized' };

/** A size or weight without trailing zeros: 58 mm, 58.5 mm, 18.5 g (D-79). */
export const trimmed = (value: Thousandths, unit?: string) =>
  formatQuantity(value, {
    decimals: value % 1000 === 0 ? 0 : value % 100 === 0 ? 1 : value % 10 === 0 ? 2 : 3,
    unit
  });

/** "Semi-auto · Preinfusion, low bar start, low bar end": the switched-on phases and own features (D-38). */
export function machineSummary(
  spec: Pick<MachineSpec, 'type' | 'features'> & Partial<MachineSpec>
): string {
  const extras = spec.features
    .filter((f) => f.enabled && f.switchable)
    .map((f, i) => (i === 0 ? f.label : f.label.charAt(0).toLowerCase() + f.label.slice(1)));
  return extras.length > 0
    ? `${MACHINE_TYPE[spec.type]} · ${extras.join(', ')}`
    : MACHINE_TYPE[spec.type];
}

/** "Stepless · steps of 0.1" (D-38, D-48). */
export function grinderSummary(spec: Pick<GrinderSpec, 'dial'> & Partial<GrinderSpec>): string {
  const mode = spec.dial.mode === 'stepless' ? 'Stepless' : 'Stepped';
  return `${mode} · steps of ${formatNumber(spec.dial.step, decimalsForStep(spec.dial.step))}`;
}

/** "VST · 18 g", or the brand alone without a size (D-150). */
export function basketName(spec: { brand: string; sizeG?: Thousandths }): string {
  return spec.sizeG === undefined ? spec.brand : `${spec.brand} · ${trimmed(spec.sizeG, 'g')}`;
}

/** "Precision · 58 mm" (D-38, D-49). */
export function basketSummary(
  spec: Pick<BasketSpec, 'type' | 'diameterMm'> & Partial<BasketSpec>
): string {
  return spec.diameterMm === undefined
    ? BASKET_TYPE[spec.type]
    : `${BASKET_TYPE[spec.type]} · ${trimmed(spec.diameterMm, 'mm')}`;
}

/** D-49: "Fits Lelit Bianca" for the machines whose group size matches; null without a diameter. */
export function fitsMachines(
  diameterMm: Thousandths | undefined,
  machines: readonly { name: string; groupSizeMm?: Thousandths }[]
): string | null {
  if (diameterMm === undefined) return null;
  const fits = machines.filter((m) => m.groupSizeMm === diameterMm).map((m) => m.name);
  return fits.length > 0 ? `Fits ${fits.join(', ')}` : 'Fits none of your machines';
}

/** Low bar start and end are no longer offered; a machine keeps one only while it is switched on (D-184). */
const RETIRED_PHASES: readonly string[] = ['low_bar_start', 'low_bar_end'];

/**
 * The built-in machine features (D-44, data-model §3), with their switch in "What it can do":
 * temperature, flat pressure and preinfusion, plus a low bar phase only when it is switched on (D-184).
 */
export function builtInFeatures(
  enabled: Partial<Record<string, boolean>> = {}
): FeatureDefinition[] {
  const phase = (key: string, label: string, pressure: boolean): FeatureDefinition => ({
    key,
    label,
    builtIn: true,
    enabled: enabled[key] ?? false,
    switchable: true,
    value: pressure
      ? { kind: 'phase', step: 1000, pressure: { step: 500, min: 0, max: 12000 } }
      : { kind: 'phase', step: 1000 }
  });
  return withoutRetiredPhases([
    {
      key: 'temperature',
      label: 'Temperature',
      builtIn: true,
      enabled: enabled.temperature ?? false,
      switchable: false,
      value: { kind: 'number', unit: '°C', step: 1000 }
    },
    {
      key: 'flat_pressure',
      label: 'Flat pressure',
      builtIn: true,
      enabled: enabled.flat_pressure ?? false,
      switchable: false,
      value: { kind: 'number', unit: 'bar', step: 500 }
    },
    phase('preinfusion', 'Preinfusion', false),
    phase('low_bar_start', 'Low bar start', true),
    phase('low_bar_end', 'Low bar end', true)
  ]);
}

/** A machine's features without the low bar phases it has switched off (D-184). */
export function withoutRetiredPhases(features: FeatureDefinition[]): FeatureDefinition[] {
  return features.filter((f) => !RETIRED_PHASES.includes(f.key) || f.enabled);
}

/** What new gear starts with (D-158). */
export const NEW_GEAR = {
  machine: (): MachineSpec => ({
    type: 'semi_auto',
    groupSizeMm: 58000,
    features: builtInFeatures({ temperature: true, flat_pressure: true })
  }),
  grinder: (): GrinderSpec => ({
    type: 'electric',
    burrs: 'flat',
    dial: { mode: 'stepless', step: 100, finest: 0, coarsest: 10000 }
  }),
  basket: (): BasketSpec => ({
    brand: '',
    type: 'precision',
    shotSize: 'double',
    diameterMm: 58000
  })
};

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;

/** The number at the start of typed text, "1 s" → 1000; null when there is none (D-46). */
export function readQuantity(text: string): Thousandths | null {
  const match = new RegExp(`^\\s*(${NUMBER}|[.,]\\d+)`).exec(text);
  return match ? toThousandths(match[1]) : null;
}

/**
 * The optional range of an own feature, typed "0–30 s" (D-46). Nothing typed is no range ({}); null when
 * the text is not "low–high" or runs the wrong way round.
 */
export function readRange(text: string): { min?: Thousandths; max?: Thousandths } | null {
  if (text.trim() === '') return {};
  const match = new RegExp(`^\\s*(${NUMBER})\\s*[–—-]\\s*(${NUMBER})(?:\\s*\\D.*)?$`).exec(text);
  if (!match) return null;
  const [min, max] = [toThousandths(match[1]), toThousandths(match[2])];
  return min <= max ? { min, max } : null;
}
