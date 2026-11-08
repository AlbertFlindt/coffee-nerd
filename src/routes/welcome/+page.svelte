<script lang="ts">
  // First run: a new journal, or moving one from another Coffee Nerd with its "Export everything"
  // file. Either way the account is created here. The choice and the file row are built without a
  // design (docs/design-gaps.md).
  import { onMount } from 'svelte';
  import AuthScreen from '#lib/components/AuthScreen.svelte';
  import PasswordField from '#lib/components/PasswordField.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import type { PageProps } from './$types';

  let { form }: PageProps = $props();
  // The time zone decides what "Today" means (docs/SPEC.md §1.8); without JavaScript the server uses UTC.
  let timeZone = $state('UTC');
  onMount(() => (timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone));

  // svelte-ignore state_referenced_locally
  let moving = $state(form?.moving ?? false);
  let fileName = $state<string | null>(null);
  const CHOICES = [
    { value: false, label: 'New journal' },
    { value: true, label: 'Move my journal' }
  ];
</script>

<svelte:head><title>Create your account · Coffee Nerd</title></svelte:head>

<AuthScreen
  title="Create your account"
  intro={moving
    ? 'Bring your journal from another Coffee Nerd.'
    : 'One account keeps your journal private.'}
  action={moving ? 'Create account and import' : 'Create account'}
  note="Everything stays on this server. Nothing is sent anywhere else."
  error={form?.error}
  upload={moving}
>
  <div class="cn-seg" role="radiogroup" aria-label="How to start">
    {#each CHOICES as { value, label } (label)}
      <button
        type="button"
        role="radio"
        aria-checked={moving === value}
        onclick={() => (moving = value)}>{label}</button
      >
    {/each}
  </div>
  <input type="hidden" name="start" value={moving ? 'move' : 'new'} />
  <TextField
    label="Name"
    id="name"
    name="name"
    autocomplete="username"
    required
    value={form?.name ?? ''}
  />
  <PasswordField
    label="Password"
    hint="At least 8 characters"
    id="password"
    name="password"
    autocomplete="new-password"
    minlength={8}
    required
  />
  <PasswordField
    label="Password again"
    id="repeat"
    name="repeat"
    autocomplete="new-password"
    required
  />
  {#if moving}
    <label class="file-row cn-tap">
      <span class="file-name">Export everything file</span>
      <span class="file-line">{fileName ?? 'Choose the file saved on your old server'}</span>
      <input
        class="file"
        type="file"
        name="file"
        accept=".json,application/json"
        onchange={(event) => (fileName = event.currentTarget.files?.[0]?.name ?? null)}
      />
    </label>
  {/if}
  <input type="hidden" name="timeZone" value={timeZone} />
</AuthScreen>

<style>
  .file-row {
    position: relative;
    min-height: 64px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--ink);
  }

  .file-name {
    font-size: 15px;
    font-weight: 600;
  }

  .file-line {
    font-size: 13px;
    color: var(--ink-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The file picker opens from the whole row; the input itself is not drawn. */
  .file {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
</style>
