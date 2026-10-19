import { error, fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import {
  addTag,
  keepBoth,
  loadTags,
  mergeTag,
  removeTag,
  saveTag,
  TagRejected,
  type TagInput
} from '#lib/server/db/tags.ts';
import type { Family } from '#lib/domain/tags.ts';
import type { Actions, PageServerLoad } from './$types';

// Tags (screen 21, D-53): your flavor notes by family, the "Same tag twice?" card (D-173), "Add tag"
// (D-174) and the tag sheet: rename, family for your own notes, merge into another, remove (D-171, D-172).
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  return { page: loadTags(getDb(), locals.user.id) };
};

const GENERAL = 'Something on this page is not right';

/** Plain words for the problems (D-20). */
const PROBLEM: [RegExp, string][] = [
  [/^name: required/, 'Name is required'],
  [/^name: too long/, 'Name can be at most 40 letters'],
  [/^name: taken/, 'There is already a tag with this name'],
  [/^family: built in/, 'A built-in tag keeps its family']
];

function words(problems: string[]): string[] {
  return [...new Set(problems.map((p) => PROBLEM.find(([re]) => re.test(p))?.[1] ?? GENERAL))];
}

const field = (form: FormData, name: string) => String(form.get(name) ?? '');
const input = (form: FormData): TagInput => ({
  name: field(form, 'name'),
  family: field(form, 'family') as Family
});

function attempt(save: () => unknown) {
  try {
    save();
    return { saved: true };
  } catch (err) {
    if (!(err instanceof TagRejected)) throw err;
    return fail(400, { problems: words(err.problems) });
  }
}

const notFound = () => fail(404, { problems: ['This tag could not be found'] });

export const actions: Actions = {
  add: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const form = await request.formData();
    const ownerId = locals.user.id;
    return attempt(() => addTag(getDb(), ownerId, input(form), Date.now()));
  },
  save: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const form = await request.formData();
    const ownerId = locals.user.id;
    let found = true;
    const done = attempt(() => {
      found = saveTag(getDb(), ownerId, field(form, 'id'), input(form), Date.now());
    });
    return found ? done : notFound();
  },
  merge: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const form = await request.formData();
    return mergeTag(getDb(), locals.user.id, field(form, 'id'), field(form, 'into'))
      ? { saved: true }
      : notFound();
  },
  remove: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const form = await request.formData();
    return removeTag(getDb(), locals.user.id, field(form, 'id'), Date.now())
      ? { saved: true }
      : notFound();
  },
  keepBoth: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const form = await request.formData();
    return keepBoth(getDb(), locals.user.id, field(form, 'id'), field(form, 'other'))
      ? { saved: true }
      : notFound();
  }
};
