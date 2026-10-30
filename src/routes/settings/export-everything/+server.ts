import { error } from '@sveltejs/kit';
import { exportFileName } from '#lib/domain/export.ts';
import { getDb } from '#lib/server/db/connection.ts';
import { exportEverything } from '#lib/server/db/export.ts';
import { loadSettings } from '#lib/server/db/settings.ts';
import { download } from '#lib/server/download.ts';
import type { RequestHandler } from './$types';

// D-252: "Export everything" in Settings: all the account holds as one JSON file.
export const POST: RequestHandler = ({ locals }) => {
  if (!locals.user) error(401);
  const db = getDb();
  const { timeZone } = loadSettings(db, locals.user.id);
  const now = Date.now();
  return download(
    JSON.stringify(exportEverything(db, locals.user.id, now), null, 2) + '\n',
    exportFileName('everything', now, timeZone),
    'application/json; charset=utf-8'
  );
};
