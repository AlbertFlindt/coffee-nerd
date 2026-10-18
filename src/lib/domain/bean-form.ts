// The Add bean form (D-41) as text, the way it is typed and shown, and reading it back into a bean.
import { altitudeText, parseAltitude } from './bean';
import { beanInputSchema, type BeanInput } from './schemas';
import { formatNumber, toThousandths } from './units';

/** Every field as typed; an empty string is not set. Roast date is "YYYY-MM-DD". */
export type BeanFormText = {
  name: string;
  roaster: string;
  countryCode: string;
  region: string;
  variety: string;
  process: string;
  altitude: string;
  roastLevel: string;
  roastDate: string;
  bagWeight: string;
  rebuyOfId: string;
};

/** A bean as the form starts from it; a new form or a re-buy has no roast date yet (D-138). */
export type BeanFormValues = Omit<BeanInput, 'roastDate'> & { roastDate: string | null };

const PROBLEM: Record<string, string> = {
  name: 'Name is required',
  roastDate: 'Roast date is required',
  altitude: 'Altitude: write it like 1,900–2,100 m',
  bagWeight: 'Bag weight: write it in grams, like 250'
};

/** Reads the typed form into a bean, or the problems to show above the button, in plain words. */
export function readBeanForm(text: BeanFormText): { bean: BeanInput } | { problems: string[] } {
  const problems = new Set<string>();
  const optional = (value: string) => (value.trim() === '' ? null : value.trim());

  const altitude = parseAltitude(text.altitude);
  if (altitude === 'invalid') problems.add(PROBLEM.altitude);
  let bagWeight: number | null = null;
  if (text.bagWeight.trim() !== '') {
    try {
      bagWeight = toThousandths(text.bagWeight.replace(',', '.'));
    } catch {
      problems.add(PROBLEM.bagWeight);
    }
  }

  const parsed = beanInputSchema.safeParse({
    name: text.name,
    roaster: optional(text.roaster),
    countryCode: optional(text.countryCode),
    region: optional(text.region),
    variety: optional(text.variety),
    process: optional(text.process),
    altitudeMinM: altitude && altitude !== 'invalid' ? altitude.min : null,
    altitudeMaxM: altitude && altitude !== 'invalid' ? altitude.max : null,
    roastLevel: optional(text.roastLevel),
    roastDate: text.roastDate,
    bagWeight,
    rebuyOfId: optional(text.rebuyOfId)
  });
  if (!parsed.success)
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      problems.add(PROBLEM[field] ?? `${field}: not valid`);
    }
  if (problems.size > 0) {
    // Shown in the order of the form.
    const order = Object.values(PROBLEM);
    return { problems: [...problems].sort((a, b) => order.indexOf(a) - order.indexOf(b)) };
  }
  return { bean: parsed.data! };
}

/** A bean as the form shows it: grams without trailing zeros, altitude as "1,900–2,100 m". */
export function beanFormText(values: BeanFormValues): BeanFormText {
  const grams = values.bagWeight;
  return {
    name: values.name,
    roaster: values.roaster ?? '',
    countryCode: values.countryCode ?? '',
    region: values.region ?? '',
    variety: values.variety ?? '',
    process: values.process ?? '',
    altitude: altitudeText(values.altitudeMinM, values.altitudeMaxM) ?? '',
    roastLevel: values.roastLevel ?? '',
    roastDate: values.roastDate ?? '',
    bagWeight: grams === null ? '' : formatNumber(grams, grams % 1000 === 0 ? 0 : 1),
    rebuyOfId: values.rebuyOfId ?? ''
  };
}
