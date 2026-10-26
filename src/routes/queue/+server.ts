import { error, json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { receiveQueued } from '#lib/server/queue.ts';
import type { RequestHandler } from './$types';

// The shots that waited on the phone arrive here, one change at a time (D-61, D-220 to D-224).
const STATUS = { saved: 200, gone: 410, refused: 422, 'other-account': 409 } as const;

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) error(401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const outcome = receiveQueued(getDb(), locals.user.id, body, Date.now());
  return json({ outcome }, { status: STATUS[outcome] });
};
