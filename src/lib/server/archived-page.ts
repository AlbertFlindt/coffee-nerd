// The Archived pages' load and Restore action, shared by Gear, Puck prep and Tags.
import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import {
  loadArchived,
  restoreArchived,
  type ArchiveArea,
  type ArchivedKind
} from '#lib/server/db/archived.ts';
import { getDb } from '#lib/server/db/connection.ts';

const KINDS: Record<ArchiveArea, ArchivedKind[]> = {
  gear: ['gear'],
  'puck-prep': ['routine', 'step'],
  tags: ['tag']
};

export function archivedLoad(area: ArchiveArea) {
  return ({ locals }: Pick<RequestEvent, 'locals'>) => {
    if (!locals.user) error(401);
    return { groups: loadArchived(getDb(), locals.user.id, area) };
  };
}

export function restoreAction(area: ArchiveArea) {
  return async ({ locals, request }: Pick<RequestEvent, 'locals' | 'request'>) => {
    if (!locals.user) error(401);
    const form = await request.formData();
    const kind = String(form.get('kind') ?? '') as ArchivedKind;
    const id = String(form.get('id') ?? '');
    const result = KINDS[area].includes(kind)
      ? restoreArchived(getDb(), locals.user.id, kind, id, Date.now())
      : null;
    if (!result) return fail(404, { id, problem: 'This could not be restored. Try again.' });
    // A routine that no longer fit its steps opens in the builder, brought into range.
    if (result === 'fix') redirect(303, `/library/puck-prep/routine/${id}`);
    return null;
  };
}
