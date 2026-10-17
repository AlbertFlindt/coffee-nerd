import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { isDatabaseReachable } from '#lib/server/db/client.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  const ok = isDatabaseReachable(getDb());
  return json({ status: ok ? 'ok' : 'error' }, { status: ok ? 200 : 503 });
};
