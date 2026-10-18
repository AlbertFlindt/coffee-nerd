// D-117: the Journal remembers its filters, so "Back" from a shot (and after deleting one) returns to the
// Journal as you left it. Kept in a cookie: it survives the edit form in between.
import type { Cookies } from '@sveltejs/kit';
import { isHttps } from './auth/csrf';

const COOKIE = 'journal-filters';
const KEYS = ['bean', 'recipe', 'unrated'] as const;

/** Called by the Journal on each visit with its URL. */
export function rememberJournalFilters(cookies: Cookies, url: URL, request: Request): void {
  const kept = new URLSearchParams();
  for (const key of KEYS) {
    const value = url.searchParams.get(key);
    if (value) kept.set(key, value);
  }
  cookies.set(COOKIE, kept.toString(), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(request)
  });
}

/** The Journal's last filters as a query, e.g. "bean=…&unrated=1"; empty without filters. */
export function journalFilters(cookies: Cookies): string {
  const kept = new URLSearchParams(cookies.get(COOKIE) ?? '');
  const query = new URLSearchParams();
  for (const key of KEYS) {
    const value = kept.get(key);
    if (value) query.set(key, value);
  }
  return query.toString();
}

/** "/journal" with the filters last used, for a redirect. */
export function journalWithFilters(cookies: Cookies): string {
  const query = journalFilters(cookies);
  return query ? `/journal?${query}` : '/journal';
}
