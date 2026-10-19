<script lang="ts">
  // The tag sheet on the Tags page (D-53, no design yet): "Add tag" asks a name and one of the five
  // families, Other to start (D-174). Tapping a note opens it: rename it, change the family of your own
  // notes (D-172), merge it into another note, or remove it (D-171), each with a confirmation. The
  // "Same tag twice?" card opens it on the merge confirmation (D-180).
  import { enhance } from '$app/forms';
  import { untrack } from 'svelte';
  import BottomSheet from '#lib/components/BottomSheet.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import { FAMILIES, type Family } from '#lib/domain/tags.ts';
  import type { TagItem } from '#lib/server/db/tags.ts';

  let {
    tag,
    others = [],
    into,
    onclose
  }: {
    /** The note being changed; without one the sheet adds a note. */
    tag?: TagItem;
    /** The notes it can be merged into. */
    others?: TagItem[];
    /** Opens straight on merging into this note, as the "Same tag twice?" card does (D-180). */
    into?: TagItem;
    onclose: () => void;
  } = $props();

  const editing = untrack(() => tag !== undefined);
  const builtIn = untrack(() => tag !== undefined && !tag.custom);
  const count = untrack(() => tag?.count ?? 0);
  const shots = (n: number) => `${n} ${n === 1 ? 'shot' : 'shots'}`;

  let name = $state(untrack(() => tag?.name ?? ''));
  let family: Family = $state(untrack(() => tag?.family ?? 'other'));
  /** What the sheet shows: the form, the list to merge into, or a confirmation. */
  let view: 'form' | 'merge' | 'remove' | TagItem = $state(untrack(() => into ?? 'form'));

  const problem = $derived(name.trim() === '' ? 'Name is required' : null);
  const familyLabel = $derived(FAMILIES.find((f) => f.family === family)?.label);

  let pending = $state(false);
  let serverProblems: string[] = $state([]);
  const submit = () => {
    pending = true;
    serverProblems = [];
    return async ({
      result,
      update
    }: {
      result: { type: string; data?: Record<string, unknown> };
      update: () => Promise<void>;
    }) => {
      pending = false;
      if (result.type === 'success' || result.type === 'redirect') {
        onclose();
        await update();
        return;
      }
      const refused = result.type === 'failure' ? result.data?.problems : undefined;
      serverProblems = Array.isArray(refused)
        ? refused.map(String)
        : ['Something on this page is not right'];
      view = 'form';
    };
  };
</script>

<BottomSheet
  short
  label={editing ? `Edit ${tag?.name}` : 'New tag'}
  closeLabel={editing ? 'Close without saving' : 'Close without adding'}
  {onclose}
>
  <div class="body">
    {#if view === 'form'}
      <h2>{editing ? tag?.name : 'New tag'}</h2>
      <TextField label="Name" id="tag-name" autocomplete="off" maxlength={40} bind:value={name} />

      {#if builtIn}
        <p class="hint">Built in · {familyLabel}. Only tags you added change family.</p>
      {:else}
        <fieldset>
          <legend>Family</legend>
          <div class="families" role="radiogroup" aria-label="Family">
            {#each FAMILIES as f (f.family)}
              <button
                type="button"
                role="radio"
                aria-checked={family === f.family}
                onclick={() => (family = f.family)}>{f.label}</button
              >
            {/each}
          </div>
        </fieldset>
      {/if}

      {#each [problem ? [problem] : serverProblems] as lines (lines)}
        {#each lines as line (line)}<p class="problem" role="status">{line}</p>{/each}
      {/each}

      <form method="POST" action={editing ? '?/save' : '?/add'} use:enhance={submit}>
        {#if editing}<input type="hidden" name="id" value={tag?.id} />{/if}
        <input type="hidden" name="name" value={name.trim()} />
        <input type="hidden" name="family" value={family} />
        <button type="submit" class="cn-btn-primary cn-tap-strong" disabled={!!problem || pending}
          >{editing ? 'Save tag' : 'Add tag'}</button
        >
      </form>

      {#if editing}
        <div class="quiet">
          {#if others.length > 0}
            <button type="button" class="cn-btn-quiet cn-tap" onclick={() => (view = 'merge')}
              >Merge into another tag</button
            >
          {/if}
          <button type="button" class="cn-btn-quiet cn-tap" onclick={() => (view = 'remove')}
            >Remove tag</button
          >
        </div>
      {/if}
    {:else if view === 'merge'}
      <h2>Merge {tag?.name} into</h2>
      <p class="note">Its shots get the tag you choose.</p>
      <div class="list">
        {#each others as other (other.id)}
          <button type="button" class="row cn-tap" onclick={() => (view = other)}>
            <span>{other.name}</span><span class="count">{shots(other.count)}</span>
          </button>
        {/each}
      </div>
      <button type="button" class="cn-btn-secondary cn-tap" onclick={() => (view = 'form')}
        >Back</button
      >
    {:else if view === 'remove'}
      {#if count > 0}
        <h2>Remove this tag?</h2>
        <p class="note">It leaves the Tasting chips and this page. Past shots keep it.</p>
      {:else}
        <h2>Delete this tag?</h2>
        <p class="note">No shot has used it. This cannot be undone.</p>
      {/if}
      <form class="confirm" method="POST" action="?/remove" use:enhance={submit}>
        <input type="hidden" name="id" value={tag?.id} />
        <button class="cn-btn-primary cn-tap-strong" type="submit" disabled={pending}
          >{count > 0 ? 'Remove tag' : 'Delete tag'}</button
        >
        <button class="cn-btn-secondary cn-tap" type="button" onclick={() => (view = 'form')}
          >Keep it</button
        >
      </form>
    {:else}
      <h2>Merge into {view.name}?</h2>
      <p class="note">
        {count > 0
          ? `Its ${shots(count)} get ${view.name} instead, and`
          : 'Nothing changes on your shots;'}
        {tag?.name} goes. This cannot be undone.
      </p>
      <form class="confirm" method="POST" action="?/merge" use:enhance={submit}>
        <input type="hidden" name="id" value={tag?.id} />
        <input type="hidden" name="into" value={view.id} />
        <button class="cn-btn-primary cn-tap-strong" type="submit" disabled={pending}>Merge</button>
        <button
          class="cn-btn-secondary cn-tap"
          type="button"
          onclick={() => (into ? onclose() : (view = 'merge'))}>Back</button
        >
      </form>
    {/if}
  </div>
</BottomSheet>

<style>
  .body {
    --surface: var(--surface-sheet-field);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-height: 0;
  }

  form {
    display: contents;
  }

  .confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .families {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .families button {
    height: var(--touch-min);
    border-radius: var(--radius-block);
    border: none;
    background: var(--surface);
    color: var(--ink);
    font-size: 14px;
    font-weight: 500;
  }

  .families button[aria-checked='true'] {
    background: var(--amber);
    color: var(--on-amber);
    font-weight: 700;
  }

  .quiet {
    display: flex;
    flex-direction: column;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 360px;
    border-radius: var(--radius-md);
    overflow-y: auto;
    scrollbar-width: none;
  }

  .list::-webkit-scrollbar {
    display: none;
  }

  .row {
    flex: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 52px;
    padding: 0 14px;
    border: none;
    background: var(--surface);
    color: var(--ink);
    font-size: 15px;
    font-weight: 500;
    text-align: left;
  }

  /* Screen 62: the count reads at the size of the name, muted. */
  .count {
    font-size: 15px;
    color: var(--ink-muted);
  }

  .note,
  .problem,
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--ink-soft);
  }

  /* Screen 61: the built-in line reads as the sheet's sentence. */
  .hint {
    margin: 0 2px;
    font-size: 14px;
    line-height: 1.45;
  }

  .problem {
    text-align: center;
    line-height: 1.4;
  }

  /* Screens 62–64: the line sits close under the title. */
  .note {
    margin: -8px 0 8px;
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink-soft);
  }

  button:disabled {
    opacity: 0.5;
  }
</style>
