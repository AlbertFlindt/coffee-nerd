import { archivedLoad, restoreAction } from '#lib/server/archived-page.ts';
import type { Actions, PageServerLoad } from './$types';

// Archived: what was archived here, with Restore.
export const load: PageServerLoad = archivedLoad('puck-prep');

export const actions: Actions = { restore: restoreAction('puck-prep') };
