import { error } from '@sveltejs/kit';
import { exportFileName, shotsCsv } from '#lib/domain/export.ts';
import { getDb } from '#lib/server/db/connection.ts';
import { exportShotRows } from '#lib/server/db/export.ts';
import { loadSettings } from '#lib/server/db/settings.ts';
import { download } from '#lib/server/download.ts';
import type { RequestHandler } from './$types';

// "Export shots" in Settings: the account's saved shots as a CSV file, one row each.
export const POST: RequestHandler = ({ locals }) => {
  if (!locals.user) error(401);
  const db = getDb();
  const { timeZone } = loadSettings(db, locals.user.id);
  return download(
    shotsCsv(exportShotRows(db, locals.user.id), timeZone),
    exportFileName('shots', Date.now(), timeZone),
    'text/csv; charset=utf-8'
  );
};
