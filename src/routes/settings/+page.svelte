<script lang="ts">
  // Settings (D-199): opened by the gear on Home. Until Settings is built (M11) it holds only "Sign out",
  // which ends this device's session (D-86), and the version (D-234). Not designed yet (docs/open-items.md).
  // D-225: signing out clears the phone, and asks first while shots wait to be sent.
  import { version } from '$app/env';
  import { resolve } from '$app/paths';
  import BottomSheet from '#lib/components/BottomSheet.svelte';
  import { versionText } from '#lib/domain/version.ts';
  import { clearWaiting, waiting } from '#lib/shot-queue.svelte.ts';
  import { forgetDrafts } from '#lib/shot-draft.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  let asking = $state(false);
  let leaving = $state(false);
  const count = $derived(waiting.entries.filter((e) => e.ownerId === data.userId).length);

  async function signOut(event: SubmitEvent) {
    event.preventDefault();
    if (count > 0 && !asking) {
      asking = true;
      return;
    }
    leaving = true;
    const response = await fetch('/logout', { method: 'POST' }).catch(() => null);
    // Signed out: the server sends the sign-in page. Only then is the phone cleared, so a sign-out
    // that could not reach the server deletes nothing (the "Offline" line says why).
    if (response?.redirected) {
      await clearWaiting(data.userId);
      forgetDrafts(data.userId);
      location.replace(response.url);
      return;
    }
    leaving = false;
    asking = false;
  }
</script>

<svelte:head><title>Settings · Coffee Nerd</title></svelte:head>

<header>
  <a class="back cn-tap" href={resolve('/')} aria-label="Back to Home">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"></path></svg
    >
  </a>
  <h1 class="cn-type-title">Settings</h1>
</header>

<main>
  <form method="POST" action="/logout" onsubmit={signOut}>
    <button class="cn-btn-secondary cn-tap" type="submit" disabled={leaving}>Sign out</button>
  </form>
  <p class="version cn-caption">{versionText(version)}</p>
</main>

{#if asking}
  <!-- D-225: not designed yet; the wording is approved by screenshot (docs/open-items.md). -->
  <BottomSheet
    short
    cover
    label="Sign out"
    closeLabel="Stay signed in"
    onclose={() => (asking = false)}
  >
    <h2 class="cn-type-heading sheet-title">
      {count === 1 ? '1 shot is' : `${count} shots are`} still waiting to send
    </h2>
    <p class="note cn-type-body">
      Signing out deletes {count === 1 ? 'it' : 'them'} from the phone. Stay signed in and open the app
      with a connection to send {count === 1 ? 'it' : 'them'} first.
    </p>
    <form method="POST" action="/logout" class="actions" onsubmit={signOut}>
      <button class="cn-btn-danger cn-tap-strong" type="submit" disabled={leaving}
        >Sign out and delete</button
      >
      <button class="cn-btn-primary cn-tap-strong" type="button" onclick={() => (asking = false)}
        >Stay signed in</button
      >
    </form>
  </BottomSheet>
{/if}

<style>
  header {
    display: grid;
    grid-template-columns: 48px 1fr;
    align-items: center;
    height: 60px;
    flex: none;
    padding: 0 var(--space-3) 0 var(--space-2);
  }

  .back {
    width: var(--touch-min);
    height: var(--touch-min);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--ink);
  }

  h1 {
    margin: 0;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--space-3) var(--space-5);
  }

  /* D-234: the version sits at the bottom of the page. */
  .version {
    margin: auto 0 var(--space-3);
    color: var(--ink-muted);
    text-align: center;
  }

  .sheet-title {
    margin: 4px 0 0;
  }

  .note {
    margin: -8px 0 8px;
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink-soft);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
</style>
