import { building } from '$app/env';
import type { ServerInit } from '@sveltejs/kit/hooks';
import { getDb } from '#lib/server/db/connection.ts';

// Open the database and apply migrations at startup, so a broken database fails fast.
export const init: ServerInit = () => {
  if (!building) getDb();
};
