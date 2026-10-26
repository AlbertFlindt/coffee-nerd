// Shots that wait on the phone until they reach the server (D-61, D-220 to D-224, D-231 to D-233). Pure:
// the queue in the browser stores these entries, and the pages show them with what the server sent.
import type { ShotState } from '../components/shot-state';
import { recipeFingerprint, type RecipeIdentity, type RecipeMatch } from './fingerprint';
import { lastShotValues, type ShotValue } from './home';
import type { Prefill } from './prefill';
import { closestDose, type KnownRecipe } from './shot-form';
import type { Thousandths } from './units';

export type Steps = { dose: Thousandths; yield: Thousandths; time: Thousandths };

/** What the Journal and Home show of a waiting shot, as the form knew it at Save. */
export type WaitingShow = {
  beanName: string;
  /** The grinder dial's step, for the grind's decimals (D-07). */
  grindStep: Thousandths;
  steps: Steps;
  /** The recipe tag the form showed (D-16). */
  recipeTag: RecipeMatch;
  /** The score of the recipe's latest rated shot, the faint marker of the Rate sheet (D-12). */
  previousScore: number | null;
};

export type WaitingStatus = 'waiting' | 'refused';

/**
 * One shot on the phone: a new shot, an edit of a saved one, or a score given on the Rate sheet. One
 * entry per shot: a later change to the same shot replaces the earlier one (the latest change wins).
 */
export type WaitingEntry = {
  shotId: string;
  /** The account it belongs to: it is only ever sent for that account. */
  ownerId: string;
  kind: 'new' | 'edit' | 'rate';
  /** The shot's values, for a new shot and an edit. */
  shot: ShotState | null;
  show: WaitingShow | null;
  /** The score, for a score alone. */
  score: number | null;
  /** A new shot: the phone's time at Save (D-220). An edit or a score: the shot's own brew time. */
  brewedAt: number;
  queuedAt: number;
  /** Goes up with every change, so a change made while sending is not lost. */
  revision: number;
  /** Refused: the server did not take it; it stays until fixed or deleted (D-224). */
  status: WaitingStatus;
};

export type WaitingChange =
  /**
   * `fromWaiting`: saved from the form of a waiting shot (D-231). Once that shot has reached the server,
   * the change is sent as an edit.
   */
  | {
      kind: 'new' | 'edit';
      shot: ShotState;
      brewedAt: number;
      show: WaitingShow;
      fromWaiting?: boolean;
    }
  | { kind: 'rate'; shotId: string; score: number; brewedAt: number };

/** The entries after a change, in the order they were first queued. */
export function applyChange(
  entries: readonly WaitingEntry[],
  change: WaitingChange,
  ownerId: string,
  now: number
): WaitingEntry[] {
  const shotId = change.kind === 'rate' ? change.shotId : change.shot.id;
  const existing = entries.find((e) => e.shotId === shotId && e.ownerId === ownerId);
  const rest = entries.filter((e) => e !== existing);
  const revision = (existing?.revision ?? 0) + 1;

  let next: WaitingEntry;
  if (change.kind === 'rate') {
    next = existing
      ? existing.shot
        ? {
            ...existing,
            shot: { ...existing.shot, taste: { ...existing.shot.taste, score: change.score } },
            revision,
            status: 'waiting'
          }
        : { ...existing, score: change.score, revision, status: 'waiting' }
      : {
          shotId,
          ownerId,
          kind: 'rate',
          shot: null,
          show: null,
          score: change.score,
          brewedAt: change.brewedAt,
          queuedAt: now,
          revision,
          status: 'waiting'
        };
  } else if (existing) {
    // A score waiting alone stays when the edit was opened from a page that did not have it yet.
    const score = change.shot.taste.score ?? (existing.kind === 'rate' ? existing.score : null);
    next = {
      ...existing,
      kind: existing.kind === 'rate' ? 'edit' : existing.kind,
      shot: { ...change.shot, taste: { ...change.shot.taste, score } },
      show: change.show,
      score: null,
      revision,
      status: 'waiting'
    };
  } else {
    next = {
      shotId,
      ownerId,
      kind: change.kind === 'new' && change.fromWaiting ? 'edit' : change.kind,
      shot: change.shot,
      show: change.show,
      score: null,
      brewedAt: change.brewedAt,
      queuedAt: now,
      revision,
      status: 'waiting'
    };
  }
  const position = existing ? entries.indexOf(existing) : rest.length;
  return [...rest.slice(0, position), next, ...rest.slice(position)];
}

/** What is sent for this account, in the order the shots were brewed (D-220); refused ones wait for a fix. */
export function sendOrder(entries: readonly WaitingEntry[], ownerId: string): WaitingEntry[] {
  return entries
    .filter((e) => e.ownerId === ownerId && e.status === 'waiting')
    .sort((a, b) => a.brewedAt - b.brewedAt || a.queuedAt - b.queuedAt);
}

export type QueueRequest =
  | { ownerId: string; kind: 'new'; shot: ShotState; brewedAt: number }
  | { ownerId: string; kind: 'edit'; shot: ShotState }
  | { ownerId: string; kind: 'rate'; shotId: string; score: number };

/** What the phone sends for an entry. An edit and a score keep the shot's brew time on the server. */
export function queueRequest(entry: WaitingEntry): QueueRequest {
  const { ownerId } = entry;
  if (entry.kind === 'rate')
    return { ownerId, kind: 'rate', shotId: entry.shotId, score: entry.score! };
  if (entry.kind === 'edit') return { ownerId, kind: 'edit', shot: entry.shot! };
  return { ownerId, kind: 'new', shot: entry.shot!, brewedAt: entry.brewedAt };
}

/** The shots of this account on the phone, newest brewed first. */
function mine(entries: readonly WaitingEntry[], ownerId: string) {
  return entries
    .filter((e) => e.ownerId === ownerId)
    .sort((a, b) => b.brewedAt - a.brewedAt || b.queuedAt - a.queuedAt);
}

/** A shot as the Journal shows it (the server's row). */
export type JournalLike = {
  id: string;
  brewedAt: number;
  beanName: string;
  grind: Thousandths;
  grindStep: Thousandths;
  dose: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
  score: number | null;
  balance: number | null;
  recipeTag: RecipeMatch;
  previousScore: number | null;
};

/** How a shot on the phone is shown: "Waiting to send" or "Not saved" (D-221, D-224). */
export type Waiting = {
  status: WaitingStatus;
  /** A shot that is not on the server opens its form on the phone (D-224, D-231). */
  form: { beanId: string } | null;
};

/** A shot or an edit opens its form on the phone (D-231, D-224); a score alone has no form of its own. */
function formOf(entry: WaitingEntry): Waiting['form'] {
  return entry.shot ? { beanId: entry.shot.beanId } : null;
}

function shownValues(shot: ShotState, show: WaitingShow) {
  return {
    beanName: show.beanName,
    grind: shot.grind,
    grindStep: show.grindStep,
    dose: shot.dose,
    yield: shot.yield,
    time: shot.time,
    score: shot.taste.score,
    balance: shot.taste.balance,
    recipeTag: show.recipeTag,
    previousScore: show.previousScore
  };
}

/**
 * The Journal with the shots on the phone (D-221, D-224): a waiting edit or score shows on its row, and
 * a new shot gets a row of its own where the filters let it in. A recipe filter leaves new shots out:
 * their recipe is only known once the server has them.
 */
export function journalWithWaiting<T extends JournalLike>(
  shots: readonly T[],
  entries: readonly WaitingEntry[],
  ownerId: string,
  filter: { beanId: string | null; recipeId: string | null; unrated: boolean }
): (JournalLike & { waiting?: Waiting })[] {
  const byId = new Map(mine(entries, ownerId).map((e) => [e.shotId, e]));
  const rows: (JournalLike & { waiting?: Waiting })[] = shots.map((s) => {
    // Also a new shot the server already has (its answer was lost): one row, with the phone's values.
    const entry = byId.get(s.id);
    if (!entry) return s;
    byId.delete(s.id);
    const changed =
      entry.kind === 'rate'
        ? { ...s, score: entry.score }
        : { ...s, ...shownValues(entry.shot!, entry.show!), brewedAt: s.brewedAt };
    return { ...changed, waiting: { status: entry.status, form: formOf(entry) } };
  });
  for (const entry of byId.values()) {
    if (entry.kind !== 'new' || filter.recipeId !== null) continue;
    const shot = entry.shot!;
    if (filter.beanId !== null && shot.beanId !== filter.beanId) continue;
    if (filter.unrated && shot.taste.score !== null) continue;
    rows.push({
      id: entry.shotId,
      brewedAt: entry.brewedAt,
      ...shownValues(shot, entry.show!),
      waiting: { status: entry.status, form: formOf(entry) }
    });
  }
  return rows
    .filter((r) => !filter.unrated || r.score === null)
    .sort((a, b) => b.brewedAt - a.brewedAt);
}

/** Home's Last shot card (the server's). */
export type LastShotLike = {
  id: string;
  brewedAt: number;
  score: number | null;
  previousScore: number | null;
  values: { left: ShotValue[]; right: ShotValue[] };
  recipeTag: RecipeMatch;
};

/**
 * Home's Last shot card with the shots on the phone (D-221, D-233): a new waiting shot of this bean is
 * the last shot, and a waiting edit or score of the last shot shows on it.
 */
export function lastShotWithWaiting<T extends LastShotLike>(
  last: T | null,
  beanId: string,
  entries: readonly WaitingEntry[],
  ownerId: string
): (LastShotLike & { waiting?: Waiting }) | null {
  const phone = mine(entries, ownerId);
  const newest = phone.find(
    (e) =>
      e.kind === 'new' &&
      e.shot!.beanId === beanId &&
      (!last || (e.brewedAt >= last.brewedAt && e.shotId !== last.id))
  );
  if (newest) {
    const shot = newest.shot!;
    const show = newest.show!;
    return {
      id: newest.shotId,
      brewedAt: newest.brewedAt,
      score: shot.taste.score,
      previousScore: show.previousScore,
      values: lastShotValues(
        { ...shot, balance: shot.taste.balance },
        { ...show.steps, grind: show.grindStep }
      ),
      recipeTag: show.recipeTag,
      waiting: { status: newest.status, form: formOf(newest) }
    };
  }
  if (!last) return null;
  const entry = phone.find((e) => e.shotId === last.id);
  if (!entry) return last;
  if (entry.kind === 'rate')
    return { ...last, score: entry.score, waiting: { status: entry.status, form: null } };
  const shot = entry.shot!;
  const show = entry.show!;
  return {
    ...last,
    score: shot.taste.score,
    values: lastShotValues(
      { ...shot, balance: shot.taste.balance },
      { ...show.steps, grind: show.grindStep }
    ),
    recipeTag: show.recipeTag,
    waiting: { status: entry.status, form: formOf(entry) }
  };
}

const identity = (shot: ShotState): RecipeIdentity => ({
  machineId: shot.machineId,
  grinderId: shot.grinderId,
  basketId: shot.basketId,
  routineId: shot.routineId,
  grind: shot.grind,
  dose: shot.dose,
  setup: shot.setup
});

/** The waiting new shots of this account still to reach the server, newest brewed first. */
function waitingNew(entries: readonly WaitingEntry[], ownerId: string) {
  return mine(entries, ownerId).filter((e) => e.kind === 'new' && e.status === 'waiting');
}

/**
 * The bean "+" opens on (D-32, D-222): the bean of the newest waiting shot, as the server does once it
 * has the shot. Null when the form already shows it, the bean was chosen on the form (D-94), or the
 * bean is no longer open.
 */
export function beanToOpen(
  form: { bean: { id: string }; openBeans: readonly { id: string }[] },
  chosen: boolean,
  entries: readonly WaitingEntry[],
  ownerId: string
): string | null {
  if (chosen) return null;
  const newest = waitingNew(entries, ownerId)[0];
  if (!newest) return null;
  const beanId = newest.shot!.beanId;
  if (beanId === form.bean.id || !form.openBeans.some((b) => b.id === beanId)) return null;
  return beanId;
}

/** The parts of the shot form's data a waiting shot changes. */
export type FormStart = {
  prefill: Prefill;
  bean: { id: string };
  recipes: KnownRecipe[];
  lastShot:
    | ({ recipe: RecipeIdentity } & {
        dose?: Thousandths;
        yield: Thousandths | null;
        time: Thousandths | null;
      })
    | null;
  edit?: unknown;
};

/**
 * A new shot starts from the newest waiting shot of its bean, and the recipe tag judges it against it
 * (D-222, D-03): it is the last shot brewed. Its recipe counts among the bean's recipes as the server
 * will count it. Taste is never prefilled (D-11).
 */
export function startFromWaiting<T extends FormStart>(
  form: T,
  entries: readonly WaitingEntry[],
  ownerId: string
): T {
  if (form.edit) return form;
  const own = waitingNew(entries, ownerId).filter((e) => e.shot!.beanId === form.bean.id);
  const newest = own[0];
  if (!newest) return form;

  const recipes = form.recipes.map((r) => ({ ...r }));
  for (const entry of [...own].reverse()) {
    const shot = entry.shot!;
    const fingerprint = recipeFingerprint(identity(shot));
    const found = closestDose(
      shot.dose,
      recipes.filter((r) => r.machineId === shot.machineId && r.fingerprint === fingerprint)
    );
    if (found) {
      found.shotCount += 1;
      found.lastBrewedAt = entry.brewedAt;
      if (shot.taste.score !== null) found.lastScore = shot.taste.score;
    } else
      recipes.push({
        id: `waiting-${entry.shotId}`,
        machineId: shot.machineId,
        fingerprint,
        dose: shot.dose,
        lastBrewedAt: entry.brewedAt,
        shotCount: 1,
        lastScore: shot.taste.score
      });
  }

  const shot = newest.shot!;
  return {
    ...form,
    prefill: {
      source: 'last_shot',
      beanId: shot.beanId,
      machineId: shot.machineId,
      grinderId: shot.grinderId,
      basketId: shot.basketId,
      routineId: shot.routineId,
      grind: shot.grind,
      dose: shot.dose,
      yield: shot.yield,
      time: shot.time,
      // A copy as plain data, also when the entry is the page's own reactive state.
      setup: JSON.parse(JSON.stringify(shot.setup)),
      taste: { score: null, balance: null, body: null, sweetness: null, aftertaste: null }
    },
    recipes,
    lastShot: { recipe: identity(shot), dose: shot.dose, yield: shot.yield, time: shot.time }
  };
}

/**
 * The query and fragment of the shot form of a shot the server does not have yet (D-224, D-231), on the
 * page the phone keeps for its bean (`/shot/new`); which shot is in the fragment, which the server never sees.
 */
export function waitingFormQuery(
  shotId: string,
  beanId: string,
  from: 'home' | 'journal'
): `?${string}` {
  const query = new URLSearchParams({ bean: beanId });
  if (from === 'journal') query.set('from', 'journal');
  return `?${query}#waiting=${encodeURIComponent(shotId)}`;
}

/** The waiting shot a form address names, from its fragment. */
export function waitingShotOf(hash: string): string | null {
  const match = /^#waiting=(.+)$/.exec(hash);
  return match ? decodeURIComponent(match[1]) : null;
}
