import { building } from '$app/env';
import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { hasAccount } from '#lib/server/auth/account.ts';
import { isCrossSiteWrite } from '#lib/server/auth/csrf.ts';
import { SESSION_COOKIE, sessionCookieOptions, validateSession } from '#lib/server/auth/session.ts';
import { getDb } from '#lib/server/db/connection.ts';
import { OFFLINE_COPY_HEADER } from '#lib/offline.ts';

// Open the database and apply migrations at startup, so a broken database fails fast.
export const init: ServerInit = () => {
  if (!building) getDb();
};

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  if (isCrossSiteWrite(event.request))
    return new Response('Cross-site form submissions are refused.', { status: 403 });
  if (pathname === '/health') return resolve(event);

  // D-219: a copy the service worker keeps for offline use changes nothing on the server or the phone.
  event.locals.offlineCopy = event.request.headers.get(OFFLINE_COPY_HEADER) === '1';
  if (event.locals.offlineCopy) {
    const response = await respond({ event, resolve });
    response.headers.delete('set-cookie');
    return response;
  }
  return respond({ event, resolve });
};

const respond: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  const db = getDb();
  const token = event.cookies.get(SESSION_COOKIE);
  event.locals.user = token ? validateSession(db, token, Date.now()) : null;

  if (event.locals.user && token) {
    // D-86: the cookie is renewed with the session, so a phone in daily use stays signed in.
    event.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(event.request));
    if (pathname === '/login' || pathname === '/welcome') redirect(303, '/');
    return resolve(event);
  }
  // Everything except /health needs the account (D-60). First run: create it (D-88); afterwards: sign in.
  const entry = hasAccount(db) ? '/login' : '/welcome';
  if (pathname !== entry) redirect(303, entry);
  return resolve(event);
};
