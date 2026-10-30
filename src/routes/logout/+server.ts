import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, signOut } from '#lib/server/auth/session.ts';
import { getDb } from '#lib/server/db/connection.ts';
import type { RequestHandler } from './$types';

// Signing out ends this device's session only.
export const POST: RequestHandler = ({ cookies }) => {
  const token = cookies.get(SESSION_COOKIE);
  if (token) signOut(getDb(), token);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  redirect(303, '/login');
};
