import type { Queryable } from './db/client';
import { loadShotForm } from './db/shot-form';

/**
 * The pages the phone keeps ready to open offline: Home, the Journal and the shot form for
 * every open bean, as "+" opens it from Home and from the Journal. Pages without a shot form
 * (no My setup yet) leave it out: "+" leads to the step-by-step start then.
 */
export function offlinePages(db: Queryable, ownerId: string, now = Date.now()): string[] {
  const pages = ['/', '/journal'];
  const form = loadShotForm(db, ownerId, undefined, now);
  if (form.state !== 'ready') return pages;
  pages.push('/shot/new', '/shot/new?from=journal');
  for (const { id } of form.openBeans)
    pages.push(`/shot/new?bean=${id}`, `/shot/new?bean=${id}&from=journal`);
  return pages;
}
