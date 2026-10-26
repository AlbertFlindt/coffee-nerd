import { describe, expect, it } from 'vitest';
import type { ShotState } from '../components/shot-state';
import { clearDrafts, draftForm, endDraft, keepDraft, restoreDraft, type Draft } from './draft';

const ME = 'user-me';
const OTHER = 'user-other';
const noTaste = { score: null, balance: null, body: null, sweetness: null, aftertaste: null };

const shot = (id: string, over: Partial<ShotState> = {}): ShotState => ({
  id,
  beanId: 'bean-guji',
  machineId: 'machine',
  grinderId: 'grinder',
  basketId: null,
  routineId: null,
  grind: 1600,
  dose: 18000,
  setup: { features: {}, routine: null },
  yield: 36000,
  time: 28000,
  taste: { ...noTaste },
  tagIds: [],
  newTagNames: [],
  notes: null,
  ...over
});

const NEW = draftForm(null);
const newId = () => 'fresh';
const BASIS = 'bean-guji:last_shot';

describe('the shot form draft', () => {
  it('D-226: a value entered is kept and restored when the form opens again', () => {
    const start = shot('s1');
    const drafts = keepDraft([], ME, NEW, BASIS, shot('s1', { grind: 1700 }), start);
    expect(restoreDraft(drafts, ME, NEW, BASIS, () => 's2')).toEqual({
      shot: shot('s2', { grind: 1700 }),
      drafts
    });
  });

  it("D-226, D-61: a new shot's draft opens with a new id, so a Save that reached the server is never dropped", () => {
    const drafts = keepDraft([], ME, NEW, BASIS, shot('saved', { grind: 1700 }), shot('saved'));
    expect(restoreDraft(drafts, ME, NEW, BASIS, newId).shot).toEqual(
      shot('fresh', { grind: 1700 })
    );
    // An edit is one shot: its id stays.
    const form = draftForm('s9');
    const edit = keepDraft([], ME, form, 'b', shot('s9', { notes: 'x' }), shot('s9'));
    expect(restoreDraft(edit, ME, form, 'b', newId).shot?.id).toBe('s9');
  });

  it('D-226: a form left as it opened keeps no draft', () => {
    const changed = keepDraft([], ME, NEW, BASIS, shot('s1', { grind: 1700 }), shot('s1'));
    expect(keepDraft(changed, ME, NEW, BASIS, shot('s1'), shot('s1'))).toEqual([]);
    // A new shot gets a new id each time the form opens: the id alone is no change.
    expect(keepDraft([], ME, NEW, BASIS, shot('s2'), shot('s1'))).toEqual([]);
  });

  it('D-226: Save and Back end the draft', () => {
    const drafts = keepDraft([], ME, NEW, BASIS, shot('s1', { grind: 1700 }), shot('s1'));
    expect(endDraft(drafts, ME, NEW)).toEqual([]);
    expect(restoreDraft(endDraft(drafts, ME, NEW), ME, NEW, BASIS, newId).shot).toBeNull();
  });

  it('D-226, D-94, D-43: another bean or "Use last shot recipe" starts a new shot again, without the draft', () => {
    const drafts = keepDraft([], ME, NEW, BASIS, shot('s1', { grind: 1700 }), shot('s1'));
    for (const basis of ['bean-kenya:last_shot', 'bean-guji:brew_next'])
      expect(restoreDraft(drafts, ME, NEW, basis, newId)).toEqual({ shot: null, drafts: [] });
  });

  it('D-226, D-113: an edit keeps its draft with another bean', () => {
    const form = draftForm('s9');
    const drafts = keepDraft([], ME, form, 'bean-guji', shot('s9', { time: 30000 }), shot('s9'));
    expect(restoreDraft(drafts, ME, form, 'bean-kenya', newId).shot).toEqual(
      shot('s9', { time: 30000 })
    );
    // The new shot's draft and the edit's are apart.
    expect(restoreDraft(drafts, ME, NEW, 'bean-guji', newId).shot).toBeNull();
  });

  it('D-226: one draft per form, the latest values winning', () => {
    let drafts: Draft[] = [];
    drafts = keepDraft(drafts, ME, NEW, BASIS, shot('s1', { grind: 1700 }), shot('s1'));
    drafts = keepDraft(drafts, ME, NEW, BASIS, shot('s1', { grind: 1800 }), shot('s1'));
    drafts = keepDraft(drafts, ME, draftForm('s9'), 'b', shot('s9', { notes: 'x' }), shot('s9'));
    expect(drafts).toHaveLength(2);
    expect(restoreDraft(drafts, ME, NEW, BASIS, newId).shot?.grind).toBe(1800);
  });

  it("D-225, D-226: drafts are the account's own, and signing out leaves none of them", () => {
    let drafts = keepDraft([], ME, NEW, BASIS, shot('s1', { grind: 1700 }), shot('s1'));
    drafts = keepDraft(drafts, OTHER, NEW, BASIS, shot('s2', { grind: 1500 }), shot('s2'));
    expect(restoreDraft(drafts, OTHER, NEW, BASIS, newId).shot?.grind).toBe(1500);
    expect(clearDrafts(drafts, ME).map((d) => d.ownerId)).toEqual([OTHER]);
  });
});
