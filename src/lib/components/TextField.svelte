<script lang="ts">
  // A labelled text field, as on the Add bean form: label above, value below, on a surface.
  import type { HTMLInputAttributes } from 'svelte/elements';

  let {
    label,
    id,
    hint,
    plain = false,
    value = $bindable(),
    ...input
  }: {
    label: string;
    id: string;
    /** Shown at the right of the label, e.g. "Required". */
    hint?: string;
    /** A value in regular weight, as for optional fields on the Add bean form. */
    plain?: boolean;
  } & HTMLInputAttributes = $props();
</script>

<div class="field">
  <!-- The hint sits beside the label, not in it, so the field is named by its label alone. -->
  <div class="cn-caption label">
    <label for={id}>{label}</label>{#if hint}<span>{hint}</span>{/if}
  </div>
  <input {id} class:plain bind:value {...input} />
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

  .label {
    display: flex;
    justify-content: space-between;
  }

  input.plain {
    font-weight: 400;
  }

  input::placeholder {
    color: var(--ink-muted);
    font-weight: 400;
  }

  input:focus-visible {
    outline: none;
  }

  .field:focus-within {
    box-shadow: 0 0 0 2px var(--amber);
  }
</style>
