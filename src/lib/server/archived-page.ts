// The Archived pages' load and Restore action (D-188), shared by Gear, Puck prep and Tags.
import { error, fail, type RequestEvent } from '@sveltejs/kit';
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
    if (!KINDS[area].includes(kind)) return fail(400);
    if (!restoreArchived(getDb(), locals.user.id, kind, id, Date.now())) return fail(404);
    return null;
  };
}
