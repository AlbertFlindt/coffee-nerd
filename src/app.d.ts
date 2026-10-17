// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SignedInUser } from '#lib/server/auth/session.ts';

declare global {
  namespace App {
    interface Locals {
      /** The signed-in user, or null (D-60). */
      user: SignedInUser | null;
    }
  }
}

export {};
