<script lang="ts">
  // Settings: opened by the gear on Home. The dose, yield and time steps, the
  // backup and the exports, "Sign out", which ends this device's session, and the
  // version. Built without a design.
  // Signing out clears the phone, and asks first while shots wait to be sent.
  import { version } from '$app/env';
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import { STEP_CHOICES, type StepName } from '#lib/domain/settings.ts';
  import { decimalsForStep, formatQuantity } from '#lib/domain/units.ts';
  import { versionText } from '#lib/domain/version.ts';
  import { clearWaiting, waiting } from '#lib/shot-queue.svelte.ts';
  import { forgetDrafts } from '#lib/shot-draft.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  let asking = $state(false);
  let leaving = $state(false);
  const count = $derived(waiting.entries.filter((e) => e.ownerId === data.userId).length);

  const STEPS: { name: StepName; label: string; unit: string }[] = [
    { name: 'dose', label: 'Dose', unit: 'g' },
    { name: 'yield', label: 'Yield', unit: 'g' },
    { name: 'time', label: 'Time', unit: 's' }
  ];
  const DATA = [
    {
      action: '/settings/backup',
      name: 'Download backup',
      line: 'A copy of everything, to keep safe'
    },
    {
      action: '/settings/export-shots',
      name: 'Export shots',
      line: 'A spreadsheet file (CSV), one row per shot'
    },
    {
      action: '/settings/export-everything',
      name: 'Export everything',
      line: 'All your data as a JSON file'
    }
  ];

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
  <section aria-labelledby="steps-title">
    <h2 id="steps-title" class="cn-label">Steps</h2>
    <p class="cn-caption hint">What one tap on − or + changes on the shot form</p>
    {#each STEPS as { name, label, unit } (name)}
      <form class="step" method="POST" action="?/steps" use:enhance>
        <input type="hidden" name="name" value={name} />
        <span class="step-name" id="step-{name}">{label}</span>
        <div class="cn-seg" role="radiogroup" aria-labelledby="step-{name}">
          {#each STEP_CHOICES[name] as step (step)}
            <button
              type="submit"
              name="step"
              value={step}
              role="radio"
              aria-checked={data.steps[name] === step}
              >{formatQuantity(step, { decimals: decimalsForStep(step), unit })}</button
            >
          {/each}
        </div>
      </form>
    {/each}
  </section>

  <section aria-labelledby="data-title">
    <h2 id="data-title" class="cn-label">Your data</h2>
    <!-- Plain forms, so the browser saves the file and the page stays. -->
    {#each DATA as { action, name, line } (action)}
      <form method="POST" {action}>
        <button class="data cn-tap" type="submit">
          <span class="data-name">{name}</span>
          <span class="data-line">{line}</span>
        </button>
      </form>
    {/each}
  </section>

  <form class="sign-out" method="POST" action="/logout" onsubmit={signOut}>
    <button class="cn-btn-secondary cn-tap" type="submit" disabled={leaving}>Sign out</button>
  </form>
  <p class="version cn-caption">{versionText(version)}</p>
</main>

{#if asking}
  <!-- Not designed yet; the wording is approved by screenshot. -->
  <ConfirmDialog label="Sign out" closeLabel="Stay signed in" onclose={() => (asking = false)}>
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
  </ConfirmDialog>
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
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-2) var(--space-5) var(--space-3);
  }

  section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  h2 {
    margin: 0;
  }

  .hint {
    margin: -4px 0 0;
  }

  .step {
    display: grid;
    grid-template-columns: 64px 1fr;
    align-items: center;
    gap: var(--space-2);
  }

  .step-name {
    font-size: 15px;
    font-weight: 600;
  }

  .data {
    width: 100%;
    min-height: 64px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 2px;
    padding: var(--space-3) var(--space-4);
    border: none;
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--ink);
    text-align: left;
  }

  .data-name {
    font-size: 15px;
    font-weight: 600;
  }

  .data-line {
    font-size: 13px;
    color: var(--ink-muted);
  }

  /* The version sits at the bottom of the page. */
  .version {
    margin: auto 0 0;
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
