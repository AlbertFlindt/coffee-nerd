<script lang="ts">
  // A labelled text field, as on the Add bean form (D-41): label above, value below, on a surface.
  import type { HTMLInputAttributes } from 'svelte/elements';

  let { label, id, ...input }: { label: string; id: string } & HTMLInputAttributes = $props();
</script>

<div class="field">
  <label for={id}>{label}</label>
  <input {id} {...input} />
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-height: 56px;
    padding: 0 14px;
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  label {
    font-size: 12px;
    color: var(--ink-muted);
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
</style>
