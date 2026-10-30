// The Add bean and Edit bean actions: the posted form as text, read and saved.
import { fail } from '@sveltejs/kit';
import { readBeanForm, type BeanFormText } from '#lib/domain/bean-form.ts';
import type { BeanInput } from '#lib/domain/schemas.ts';
import { BeanRejected } from '#lib/server/db/beans.ts';

const FIELDS: (keyof BeanFormText)[] = [
  'name',
  'roaster',
  'countryCode',
  'region',
  'variety',
  'process',
  'altitude',
  'roastLevel',
  'roastDate',
  'bagWeight',
  'rebuyOfId'
];

/** Reads the posted form and saves it with `save`; a problem returns the form with what to fix. */
export async function saveBeanForm(request: Request, save: (bean: BeanInput) => void) {
  const posted = await request.formData();
  const text = Object.fromEntries(
    FIELDS.map((field) => [field, String(posted.get(field) ?? '')])
  ) as BeanFormText;
  const read = readBeanForm(text);
  if ('problems' in read) return fail(400, { problems: read.problems });
  try {
    save(read.bean);
  } catch (err) {
    if (!(err instanceof BeanRejected)) throw err;
    const problems = err.problems.map((p) =>
      p === 'roastDate: after today'
        ? 'Roast date cannot be after today'
        : 'This bean could not be saved'
    );
    return fail(400, { problems });
  }
  return null;
}
