import { error, fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadSettings, saveStep } from '#lib/server/db/settings.ts';
import { importEverything, ImportError, isJournalEmpty } from '#lib/server/db/import.ts';
import { readImport } from '#lib/domain/import.ts';
import type { StepName } from '#lib/domain/settings.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings behind the gear on Home: the steps, your data (import only into an empty journal),
// Sign out and the version.
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  // Signing out clears this account's waiting shots, and asks first.
  const db = getDb();
  return {
    userId: locals.user.id,
    steps: loadSettings(db, locals.user.id).steps,
    canImport: isJournalEmpty(db, locals.user.id)
  };
};

const NAMES: readonly StepName[] = ['dose', 'yield', 'time'];

export const actions: Actions = {
  // A tapped step is saved at once.
  steps: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const data = await request.formData();
    const name = String(data.get('name') ?? '') as StepName;
    const step = Number(data.get('step'));
    if (!NAMES.includes(name) || !saveStep(getDb(), locals.user.id, name, step, Date.now()))
      return fail(400);
    return { saved: name };
  },

  // "Import everything": an export from another server into this new, empty journal.
  import: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || file.size === 0)
      return fail(400, { problem: 'Choose the file "Export everything" saved.' });
    const read = readImport(await file.text());
    if (!read.ok) return fail(400, { problem: read.problem });
    try {
      return { imported: importEverything(getDb(), locals.user.id, read.data, Date.now()) };
    } catch (problem) {
      if (problem instanceof ImportError) return fail(409, { problem: problem.message });
      // Ids already on this server, or anything else the database refused: nothing went in.
      console.error('Import failed', problem);
      return fail(400, { problem: 'This file could not be imported. Nothing was changed.' });
    }
  }
};
