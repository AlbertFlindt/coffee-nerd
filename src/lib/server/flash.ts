// A one-time message carried to the next page in a short-lived cookie ("Shot saved", and the
// automatic finish with its Undo).
import type { Cookies } from '@sveltejs/kit';
import { z } from 'zod';
import { isHttps } from './auth/csrf';

const FLASH_COOKIE = 'flash';

const flashSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('saved') }),
  z.object({ kind: z.literal('finished'), beanId: z.string(), beanName: z.string() }),
  z.object({ kind: z.literal('reopened'), beanName: z.string() })
]);
export type Flash = z.infer<typeof flashSchema>;

export function setFlash(cookies: Cookies, request: Request, flash: Flash): void {
  cookies.set(FLASH_COOKIE, JSON.stringify(flash), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(request),
    maxAge: 60
  });
}

/** The message, once: reading it removes it. */
export function takeFlash(cookies: Cookies): Flash | null {
  const raw = cookies.get(FLASH_COOKIE);
  if (raw === undefined) return null;
  cookies.delete(FLASH_COOKIE, { path: '/' });
  try {
    const parsed = flashSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
