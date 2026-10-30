import { error, json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { receiveQueued } from '#lib/server/queue.ts';
import type { RequestHandler } from './$types';

// The shots that waited on the phone arrive here, one change at a time.
const STATUS = { saved: 200, gone: 410, refused: 422, 'other-account': 409 } as const;

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) error(401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  try {
    const result = receiveQueued(getDb(), locals.user.id, body, Date.now());
    return json(result, { status: STATUS[result.outcome] });
  } catch (failure) {
    // An error of the app answers as the app, so the phone counts it toward "Not saved".
    console.error('Waiting shot failed:', failure);
    return json({ outcome: 'error' }, { status: 500 });
  }
};
