<script lang="ts">
  import { resolve } from '$app/paths';
  import ShotForm from '#lib/components/ShotForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>New shot · Coffee Nerd</title></svelte:head>

{#if data.form.state === 'ready'}
  <!-- A new key per bean (D-94) or Brew next change starts the form from its own prefill. -->
  {#key `${data.form.bean.id}:${data.form.prefill.source}`}
    <ShotForm data={data.form} problems={form?.problems} />
  {/key}
{:else}
  <!-- Not designed yet (docs/open-items.md): nothing to brew with before My setup and a bean exist (D-88). -->
  <div class="empty">
    <header>
      <a class="back tap" href={resolve('/')} aria-label="Back">
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
      <h1 class="cn-type-title">New shot</h1>
      <span></span>
    </header>
    <div class="message">
      <h2 class="cn-type-heading">Nothing to brew with yet</h2>
      <p class="cn-type-body">
        {data.form.missing === 'setup'
          ? 'Add your gear and My setup in Library first; new shots start from them.'
          : 'Add a bean in Library first, or reopen a finished one.'}
      </p>
    </div>
  </div>
{/if}

<style>
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  header {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    align-items: center;
    height: 60px;
    padding: 0 var(--space-2);
  }

  h1 {
    margin: 0;
    text-align: center;
  }

  .back {
    width: var(--touch-min);
    height: var(--touch-min);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink);
  }

  .message {
    margin: var(--space-6) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  h2,
  p {
    margin: 0;
  }

  p {
    color: var(--ink-soft);
  }
</style>
