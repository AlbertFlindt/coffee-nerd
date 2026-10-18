// The gear pages' actions (D-44, D-48, D-49, D-147, D-148): the posted page as JSON, saved, or the
// problems in plain words.
import { fail } from '@sveltejs/kit';
import { GearRejected, type GearInput } from '#lib/server/db/gear.ts';

/** Plain words for the schema's paths (D-20); anything else gets a general line. */
const PROBLEM: [RegExp, string][] = [
  [/^name/, 'Name is required'],
  [/^spec\.brand/, 'Brand is required'],
  [/^spec\.dial/, 'Finest and coarsest must differ'],
  [/^spec\.doseRange/, 'The dose range must run from low to high'],
  [/^spec\.features/, 'Each feature needs a name, and names must differ'],
  [/^gear: not found/, 'This gear could not be found']
];

export function gearProblems(problems: string[], kind?: string): string[] {
  // A basket's name is built from its brand (D-150), so a missing name is the missing brand.
  const relevant = kind === 'basket' ? problems.filter((p) => !p.startsWith('name')) : problems;
  const words = relevant.map(
    (p) =>
      PROBLEM.find(([pattern]) => pattern.test(p))?.[1] ?? 'Something on this page is not right'
  );
  return [...new Set(words)];
}

/** Reads the page's `payload` field and saves it with `save`; a problem returns the page with what to fix. */
export async function saveGearForm(request: Request, save: (input: GearInput) => void) {
  const raw = String((await request.formData()).get('payload') ?? '');
  let input: GearInput;
  try {
    input = JSON.parse(raw) as GearInput;
  } catch {
    return fail(400, { problems: ['Something on this page is not right'] });
  }
  try {
    save(input);
  } catch (err) {
    if (!(err instanceof GearRejected)) throw err;
    return fail(400, { problems: gearProblems(err.problems, input.kind) });
  }
  return null;
}
