import { error } from '@sveltejs/kit';
import { exportFileName } from '#lib/domain/export.ts';
import { getDb } from '#lib/server/db/connection.ts';
import { backupDatabase } from '#lib/server/db/export.ts';
import { loadSettings } from '#lib/server/db/settings.ts';
import { download } from '#lib/server/download.ts';
import type { RequestHandler } from './$types';

// "Download backup" in Settings: the whole database as one file, without sign-ins.
export const POST: RequestHandler = ({ locals }) => {
  if (!locals.user) error(401);
  const db = getDb();
  const { timeZone } = loadSettings(db, locals.user.id);
  return download(
    new Uint8Array(backupDatabase(db)),
    exportFileName('backup', Date.now(), timeZone),
    'application/vnd.sqlite3'
  );
};
