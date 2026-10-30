<script lang="ts">
  // A password field as a TextField, with a button at the right that shows or hides what was typed.
  import type { HTMLInputAttributes } from 'svelte/elements';

  let {
    label,
    id,
    hint,
    ...input
  }: {
    label: string;
    id: string;
    /** Shown at the right of the label, e.g. "At least 8 characters". */
    hint?: string;
  } & Omit<HTMLInputAttributes, 'type'> = $props();

  let shown = $state(false);
</script>

<div class="field">
  <div class="text">
    <div class="cn-caption label">
      <label for={id}>{label}</label>{#if hint}<span>{hint}</span>{/if}
    </div>
    <input {id} type={shown ? 'text' : 'password'} spellcheck="false" {...input} />
  </div>
  <button
    type="button"
    class="show cn-tap"
    aria-label="Show password"
    aria-pressed={shown}
    aria-controls={id}
    onclick={() => (shown = !shown)}
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {#if shown}<path d="M4 4l16 16" />{/if}
    </svg>
  </button>
</div>

<style>
  .field {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 56px;
    padding: 0 6px 0 14px;
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    display: flex;
    justify-content: space-between;
  }

  input {
    border: none;
    padding: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    min-width: 0;
  }

  input:focus-visible {
    outline: none;
  }

  .field:focus-within {
    box-shadow: 0 0 0 2px var(--amber);
  }

  .show {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--touch-min);
    height: var(--touch-min);
    border: none;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--ink-muted);
  }

  .show[aria-pressed='true'] {
    color: var(--ink);
  }
</style>
