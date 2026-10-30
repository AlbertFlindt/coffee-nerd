<script lang="ts">
  import ShotForm from '#lib/components/ShotForm.svelte';
  import type { WaitingEntry } from '#lib/domain/waiting.ts';
  import { waiting } from '#lib/shot-queue.svelte.ts';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  // An edit or a score still waiting on the phone for this shot is where the form starts. It is
  // read once the phone's shots are, so the form never shows the server's values first.
  const shotId = $derived(data.form.state === 'ready' ? data.form.edit?.shotId : undefined);
  let pending: WaitingEntry | null = $state.raw(null);
  let ready = $state(false);
  $effect(() => {
    if (!waiting.loaded || ready) return;
    const entry = waiting.entries.find((e) => e.shotId === shotId && e.ownerId === data.userId);
    pending = entry ? $state.snapshot(entry) : null;
    ready = true;
  });
</script>

<svelte:head><title>Edit shot · Coffee Nerd</title></svelte:head>

<!-- No key on the bean: switching it while editing keeps the values entered. -->
{#if ready}
  <ShotForm data={data.form} problems={form?.problems} origin={data.origin} {pending} />
{/if}
