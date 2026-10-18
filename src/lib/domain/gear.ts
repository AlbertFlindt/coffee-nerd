// Short texts about gear for the Gear page and the gear pages (D-38, D-48, D-49, D-150). Pure.
import type { BasketSpec, GrinderSpec, MachineSpec } from './schemas';
import { decimalsForStep, formatQuantity, formatNumber, type Thousandths } from './units';

const MACHINE_TYPE = {
  automatic: 'Automatic',
  semi_auto: 'Semi-auto',
  lever: 'Lever',
  manual: 'Manual'
};
const BASKET_TYPE = { precision: 'Precision', standard: 'Standard', pressurized: 'Pressurized' };

/** A size or weight without trailing zeros: 58 mm, 58.5 mm, 18.5 g. */
const trimmed = (value: Thousandths, unit: string) =>
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
