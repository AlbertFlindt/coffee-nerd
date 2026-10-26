import { describe, expect, it } from 'vitest';
import type { ShotState } from '../components/shot-state';
import { recipeFingerprint } from './fingerprint';
import {
  afterSend,
  applyChange,
  beanToOpen,
  SERVER_FAILED,
  journalWithWaiting,
  lastShotWithWaiting,
  queueRequest,
  sendOrder,
  startFromWaiting,
  startWithPending,
  type FormStart,
  type JournalLike,
  type WaitingEntry,
  type WaitingShow,
  waitingFormQuery,
  waitingShotOf
} from './waiting';

const ME = 'user-me';
const OTHER = 'user-other';
const BEAN = 'bean-guji';
const BEAN_2 = 'bean-kenya';
const MACHINE = 'machine-bianca';

const noTaste = { score: null, balance: null, body: null, sweetness: null, aftertaste: null };

const shot = (id: string, over: Partial<ShotState> = {}): ShotState => ({
  id,
  beanId: BEAN,
  machineId: MACHINE,
  grinderId: 'grinder',
  basketId: null,
  routineId: null,
  grind: 1600,
  dose: 18000,
  setup: { features: {}, routine: null },
  yield: 36000,
  time: 27000,
  taste: { ...noTaste },
  tagIds: [],
  newTagNames: [],
  notes: null,
  ...over
});

const show: WaitingShow = {
  beanName: 'Guji',
  grindStep: 100,
  steps: { dose: 100, yield: 500, time: 500 },
  recipeTag: { kind: 'new', changes: ['grind'] },
  previousScore: null
};

const queue = (...changes: Parameters<typeof applyChange>[1][]) =>
  changes.reduce<WaitingEntry[]>((all, c, i) => applyChange(all, c, ME, 1000 + i), []);

describe('applyChange', () => {
  it('D-220: a new shot waits with the time it was saved on the phone', () => {
    const [entry] = queue({ kind: 'new', shot: shot('s1'), brewedAt: 500, show });
    expect(entry).toMatchObject({ kind: 'new', brewedAt: 500, status: 'waiting', ownerId: ME });
  });

  it('D-231: changing a waiting shot keeps it new, with its brew time, and the latest values win', () => {
    const entries = queue(
      { kind: 'new', shot: shot('s1'), brewedAt: 500, show },
      { kind: 'new', shot: shot('s1', { grind: 1700 }), brewedAt: 900, show, fromWaiting: true }
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'new', brewedAt: 500, revision: 2 });
    expect(entries[0].shot!.grind).toBe(1700);
  });

  it('D-231: a change to a waiting shot that reached the server meanwhile is sent as an edit', () => {
    const [entry] = queue({
      kind: 'new',
      shot: shot('s1'),
      brewedAt: 500,
      show,
      fromWaiting: true
    });
    expect(entry.kind).toBe('edit');
  });

  it('D-223: a score given to a waiting shot goes into that shot', () => {
    const entries = queue(
      { kind: 'new', shot: shot('s1'), brewedAt: 500, show },
      { kind: 'rate', shotId: 's1', score: 8, brewedAt: 500 }
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('new');
    expect(entries[0].shot!.taste.score).toBe(8);
  });

  it('D-223: a score for a saved shot waits on its own; a second score replaces it', () => {
    const entries = queue(
      { kind: 'rate', shotId: 's1', score: 6, brewedAt: 500 },
      { kind: 'rate', shotId: 's1', score: 7, brewedAt: 500 }
    );
    expect(entries).toEqual([expect.objectContaining({ kind: 'rate', score: 7, revision: 2 })]);
  });

  it('D-223: an edit after a waiting score keeps the score when the edit has none', () => {
    const entries = queue(
      { kind: 'rate', shotId: 's1', score: 6, brewedAt: 500 },
      { kind: 'edit', shot: shot('s1', { grind: 1500 }), brewedAt: 500, show }
    );
    expect(entries[0]).toMatchObject({ kind: 'edit', score: null });
    expect(entries[0].shot!.taste.score).toBe(6);
  });

  it('D-224: changing a refused shot makes it wait again', () => {
    const [refused] = queue({ kind: 'new', shot: shot('s1'), brewedAt: 500, show });
    const entries = applyChange(
      [{ ...refused, status: 'refused' }],
      { kind: 'new', shot: shot('s1'), brewedAt: 900, show, fromWaiting: true },
      ME,
      2000
    );
    expect(entries[0].status).toBe('waiting');
  });
});

describe('sendOrder and queueRequest', () => {
  it('D-220: waiting shots are sent in the order they were brewed, only for their own account', () => {
    const entries = [
      ...queue(
        { kind: 'new', shot: shot('late'), brewedAt: 900, show },
        { kind: 'new', shot: shot('early'), brewedAt: 100, show }
      ),
      ...applyChange([], { kind: 'new', shot: shot('theirs'), brewedAt: 50, show }, OTHER, 1)
    ];
    expect(sendOrder(entries, ME).map((e) => e.shotId)).toEqual(['early', 'late']);
  });

  it('D-224: a refused shot is not sent again until it is fixed', () => {
    const [entry] = queue({ kind: 'new', shot: shot('s1'), brewedAt: 500, show });
    expect(sendOrder([{ ...entry, status: 'refused' }], ME)).toEqual([]);
  });

  it('D-220, D-223: a new shot sends its brew time; an edit and a score leave it to the server', () => {
    const [created, edited, rated] = queue(
      { kind: 'new', shot: shot('s1'), brewedAt: 500, show },
      { kind: 'edit', shot: shot('s2'), brewedAt: 400, show },
      { kind: 'rate', shotId: 's3', score: 9, brewedAt: 300 }
    );
    expect(queueRequest(created)).toEqual({
      ownerId: ME,
      kind: 'new',
      shot: shot('s1'),
      brewedAt: 500
    });
    expect(queueRequest(edited)).toEqual({ ownerId: ME, kind: 'edit', shot: shot('s2') });
    expect(queueRequest(rated)).toEqual({ ownerId: ME, kind: 'rate', shotId: 's3', score: 9 });
  });
});

const row = (id: string, brewedAt: number, over: Partial<JournalLike> = {}): JournalLike => ({
  id,
  brewedAt,
  beanName: 'Guji',
  grind: 1600,
  grindStep: 100,
  dose: 18000,
  yield: 36000,
  time: 27000,
  score: null,
  balance: null,
  recipeTag: { kind: 'reused', shotCount: 2 },
  previousScore: null,
  ...over
});

describe('journalWithWaiting', () => {
  const all = { beanId: null, recipeId: null, unrated: false };

  it('D-221: a waiting shot shows in the Journal at once, newest first, and opens its form', () => {
    const entries = queue({ kind: 'new', shot: shot('w1'), brewedAt: 3000, show });
    const rows = journalWithWaiting([row('s1', 2000)], entries, ME, all);
    expect(rows.map((r) => r.id)).toEqual(['w1', 's1']);
    expect(rows[0].waiting).toEqual({ status: 'waiting', form: { beanId: BEAN } });
    expect(rows[1].waiting).toBeUndefined();
  });

  it('D-223: a waiting score or edit shows on its row', () => {
    const entries = queue(
      { kind: 'rate', shotId: 's1', score: 7, brewedAt: 2000 },
      { kind: 'edit', shot: shot('s2', { grind: 1400 }), brewedAt: 1000, show }
    );
    const rows = journalWithWaiting([row('s1', 2000), row('s2', 1000)], entries, ME, all);
    expect(rows[0]).toMatchObject({ score: 7, waiting: { status: 'waiting', form: null } });
    expect(rows[1]).toMatchObject({
      grind: 1400,
      brewedAt: 1000,
      waiting: { status: 'waiting', form: { beanId: BEAN } }
    });
  });

  it('D-221: a waiting shot the server already has (its answer was lost) shows once', () => {
    const entries = queue({ kind: 'new', shot: shot('s1', { grind: 1400 }), brewedAt: 2000, show });
    const rows = journalWithWaiting([row('s1', 2000)], entries, ME, all);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ grind: 1400, waiting: { status: 'waiting' } });
  });

  it('D-224: a refused shot shows as not saved', () => {
    const [entry] = queue({ kind: 'new', shot: shot('w1'), brewedAt: 3000, show });
    const rows = journalWithWaiting([], [{ ...entry, status: 'refused' }], ME, all);
    expect(rows[0].waiting!.status).toBe('refused');
  });

  it('D-221: the filters apply to waiting shots; a recipe filter leaves them out', () => {
    const entries = queue(
      { kind: 'new', shot: shot('guji'), brewedAt: 3000, show },
      { kind: 'new', shot: shot('kenya', { beanId: BEAN_2 }), brewedAt: 3100, show },
      {
        kind: 'new',
        shot: shot('rated', { taste: { ...noTaste, score: 8 } }),
        brewedAt: 3200,
        show
      }
    );
    const ids = (filter: Parameters<typeof journalWithWaiting>[3]) =>
      journalWithWaiting([], entries, ME, filter).map((r) => r.id);
    expect(ids({ beanId: BEAN, recipeId: null, unrated: false })).toEqual(['rated', 'guji']);
    expect(ids({ beanId: null, recipeId: null, unrated: true })).toEqual(['kenya', 'guji']);
    expect(ids({ beanId: BEAN, recipeId: 'r1', unrated: false })).toEqual([]);
  });

  it('D-225: shots of another account are not shown', () => {
    const entries = applyChange([], { kind: 'new', shot: shot('w1'), brewedAt: 1, show }, OTHER, 1);
    expect(journalWithWaiting([], entries, ME, all)).toEqual([]);
  });
});

describe('lastShotWithWaiting', () => {
  const last = {
    id: 's1',
    brewedAt: 2000,
    score: null,
    previousScore: null,
    values: { left: [], right: [] },
    recipeTag: { kind: 'reused' as const, shotCount: 1 }
  };

  it("D-221, D-233: a waiting shot of Home's bean is the Last shot, with its values", () => {
    const entries = queue({ kind: 'new', shot: shot('w1'), brewedAt: 3000, show });
    const card = lastShotWithWaiting(last, BEAN, entries, ME)!;
    expect(card).toMatchObject({ id: 'w1', brewedAt: 3000, waiting: { status: 'waiting' } });
    expect(card.values.left[0]).toEqual({ label: 'Grind', value: '1.6' });
  });

  it("D-233: a waiting shot of another bean leaves Home's Last shot as it is", () => {
    const entries = queue({
      kind: 'new',
      shot: shot('w1', { beanId: BEAN_2 }),
      brewedAt: 3000,
      show
    });
    expect(lastShotWithWaiting(last, BEAN, entries, ME)).toBe(last);
  });

  it('D-223: a waiting score shows on the Last shot', () => {
    const entries = queue({ kind: 'rate', shotId: 's1', score: 9, brewedAt: 2000 });
    expect(lastShotWithWaiting(last, BEAN, entries, ME)).toMatchObject({
      id: 's1',
      score: 9,
      waiting: { status: 'waiting', form: null }
    });
  });
});

describe('D-222: the next shot starts from a waiting shot', () => {
  const form = (): FormStart & { openBeans: { id: string }[] } => ({
    prefill: {
      source: 'last_shot',
      beanId: BEAN,
      machineId: MACHINE,
      grinderId: 'grinder',
      basketId: null,
      routineId: null,
      grind: 1500,
      dose: 18000,
      yield: 36000,
      time: 26000,
      setup: { features: {}, routine: null },
      taste: { ...noTaste }
    },
    bean: { id: BEAN },
    openBeans: [{ id: BEAN }, { id: BEAN_2 }],
    recipes: [],
    lastShot: null
  });

  it('D-222, D-11: the form starts from the newest waiting shot of the bean, without its taste', () => {
    const entries = queue(
      { kind: 'new', shot: shot('w1', { grind: 1600 }), brewedAt: 3000, show },
      {
        kind: 'new',
        shot: shot('w2', { grind: 1700, time: 29000, taste: { ...noTaste, score: 7 } }),
        brewedAt: 4000,
        show
      }
    );
    const start = startFromWaiting(form(), entries, ME);
    expect(start.prefill).toMatchObject({ grind: 1700, time: 29000, source: 'last_shot' });
    expect(start.prefill.taste.score).toBeNull();
    expect(start.lastShot).toMatchObject({ recipe: { grind: 1700 }, time: 29000 });
  });

  it('D-222, D-16: the recipe tag counts waiting shots as the server will', () => {
    const entries = queue(
      { kind: 'new', shot: shot('w1'), brewedAt: 3000, show },
      { kind: 'new', shot: shot('w2', { taste: { ...noTaste, score: 6 } }), brewedAt: 4000, show }
    );
    const start = startFromWaiting(form(), entries, ME);
    expect(start.recipes).toEqual([
      expect.objectContaining({
        fingerprint: recipeFingerprint({ ...shot('w1') }),
        shotCount: 2,
        lastScore: 6,
        lastBrewedAt: 4000
      })
    ]);
  });

  it('D-222: a refused shot, a shot of another bean and an edit change nothing', () => {
    const [refused] = queue({ kind: 'new', shot: shot('w1'), brewedAt: 3000, show });
    const other = queue({
      kind: 'new',
      shot: shot('w2', { beanId: BEAN_2 }),
      brewedAt: 3000,
      show
    });
    const start = form();
    expect(startFromWaiting(start, [{ ...refused, status: 'refused' }], ME)).toBe(start);
    expect(startFromWaiting(start, other, ME)).toBe(start);
    const editing = { ...start, edit: {} };
    expect(
      startFromWaiting(editing, queue({ kind: 'new', shot: shot('w3'), brewedAt: 1, show }), ME)
    ).toBe(editing);
  });

  it('D-222, D-32: "+" opens the bean of the newest waiting shot, unless a bean was chosen', () => {
    const entries = queue({
      kind: 'new',
      shot: shot('w1', { beanId: BEAN_2 }),
      brewedAt: 3000,
      show
    });
    expect(beanToOpen(form(), false, entries, ME)).toBe(BEAN_2);
    expect(beanToOpen(form(), true, entries, ME)).toBeNull();
    expect(beanToOpen({ ...form(), openBeans: [{ id: BEAN }] }, false, entries, ME)).toBeNull();
  });
});

describe('the form of a waiting shot', () => {
  it('D-231: opens on the page the phone keeps for its bean, the shot named in the fragment', () => {
    const query = waitingFormQuery('0199-a', BEAN, 'journal');
    expect(query).toBe(`?bean=${BEAN}&from=journal#waiting=0199-a`);
    expect(waitingFormQuery('0199-a', BEAN, 'home')).toBe(`?bean=${BEAN}#waiting=0199-a`);
    expect(waitingShotOf(new URL(`https://x/shot/new${query}`).hash)).toBe('0199-a');
    expect(waitingShotOf('')).toBeNull();
  });
});

describe('afterSend', () => {
  const [entry] = queue({ kind: 'new', shot: shot('s1'), brewedAt: 500, show });

  it('D-61: a shot the server has is gone from the phone', () => {
    expect(afterSend([entry], entry, { kind: 'sent' })).toEqual({ entries: [], stop: false });
  });

  it('D-237: a refused shot keeps the reasons the server gave, and the next one is sent', () => {
    const { entries, stop } = afterSend([entry], entry, {
      kind: 'refused',
      problems: ['No grinder']
    });
    expect(entries).toEqual([{ ...entry, status: 'refused', problems: ['No grinder'] }]);
    expect(stop).toBe(false);
  });

  it('D-237: after three server errors in a row the shot is "Not saved" and the next one is sent', () => {
    let entries = [entry];
    for (const tries of [1, 2]) {
      const result = afterSend(entries, entries[0], { kind: 'failed' });
      expect(result.stop).toBe(true);
      expect(result.entries[0]).toEqual({ ...entry, failures: tries });
      entries = result.entries;
    }
    const third = afterSend(entries, entries[0], { kind: 'failed' });
    expect(third.stop).toBe(false);
    expect(third.entries[0]).toEqual({
      ...entry,
      failures: 3,
      status: 'refused',
      problems: [SERVER_FAILED]
    });
  });

  it('D-61: a change made while the shot was on its way is kept, and its count starts again', () => {
    const [changed] = applyChange(
      [entry],
      { kind: 'new', shot: shot('s1', { grind: 1700 }), brewedAt: 500, show },
      ME,
      2000
    );
    expect(afterSend([changed], entry, { kind: 'sent' }).entries).toEqual([changed]);
    const failed = afterSend(
      [{ ...entry, failures: 2, status: 'refused', problems: ['x'] }],
      entry,
      { kind: 'failed' }
    ).entries[0];
    const [again] = applyChange(
      [failed],
      { kind: 'new', shot: shot('s1'), brewedAt: 500, show },
      ME,
      3000
    );
    expect(again).toEqual(
      expect.objectContaining({ status: 'waiting', failures: 0, problems: [] })
    );
  });
});

describe('D-239: the edit page starts from what waits for the shot', () => {
  const saved = shot('s1', { grind: 1500, taste: { ...noTaste, score: 6 } });

  it('a waiting edit gives its values', () => {
    const [edit] = queue({ kind: 'edit', shot: shot('s1', { grind: 1700 }), brewedAt: 500, show });
    expect(startWithPending(saved, edit).grind).toBe(1700);
  });

  it('a waiting score goes into the saved values', () => {
    const [rate] = queue({ kind: 'rate', shotId: 's1', score: 9, brewedAt: 500 });
    expect(startWithPending(saved, rate)).toEqual({
      ...saved,
      taste: { ...saved.taste, score: 9 }
    });
  });

  it('nothing waiting leaves the saved values', () => {
    expect(startWithPending(saved, null)).toBe(saved);
  });
});
