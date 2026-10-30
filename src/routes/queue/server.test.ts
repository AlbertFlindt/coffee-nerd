import { describe, expect, it, vi } from 'vitest';

vi.mock('#lib/server/db/connection.ts', () => ({ getDb: () => ({}) }));
vi.mock('#lib/server/queue.ts', () => ({
  receiveQueued: () => {
    throw new Error('The database is locked.');
  }
}));

const { POST } = await import('./+server');

describe('the shot queue', () => {
  it('an error of the app answers as JSON, so the phone counts it as a failed try', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const request = new Request('http://localhost/queue', { method: 'POST', body: '{}' });
    const response = await POST({ locals: { user: { id: 'u1' } }, request } as never);
    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('json');
    expect(await response.json()).toEqual({ outcome: 'error' });
  });
});
