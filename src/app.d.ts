// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SignedInUser } from '#lib/server/auth/session.ts';

declare global {
  namespace App {
    interface Locals {
      /** The signed-in user, or null. */
      user: SignedInUser | null;
      /** A copy the service worker keeps for offline use: it takes no flash and sets no cookie. */
      offlineCopy: boolean;
    }
  }
}

export {};
