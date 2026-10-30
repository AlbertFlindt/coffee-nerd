<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import ShotForm from '#lib/components/ShotForm.svelte';
  import {
    beanToOpen,
    startFromWaiting,
    waitingShotOf,
    type WaitingEntry
  } from '#lib/domain/waiting.ts';
  import { waiting } from '#lib/shot-queue.svelte.ts';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  // A shot still on the phone opens here with its values (its id is in the fragment).
  const waitingId = $derived(waitingShotOf(page.url.hash));
  const waitingEntry = $derived(
    waitingId === null
      ? null
      : (waiting.entries.find((e) => e.shotId === waitingId && e.shot !== null) ?? null)
  );
  // "+" opens the bean of the newest waiting shot, as the server does once it has it.
  const beanToGo = $derived(
    waitingId !== null || !data.userId
      ? null
      : beanToOpen(data.form, page.url.searchParams.has('bean'), waiting.entries, data.userId)
  );
  // A new shot starts from the newest shot waiting on the phone, as from the last shot.
  const start = $derived(
    waitingId === null && data.userId
      ? startFromWaiting(data.form, waiting.entries, data.userId)
      : data.form
  );
  // The form is built once the shots waiting on the phone are read, so it never flashes the server's
  // values first and then the waiting shot's. The waiting shot is read once, so the form
  // stays as it is if the shot is sent or changed while it is open.
  let opened: WaitingEntry | null = $state.raw(null);
  const show = $derived(
    waiting.loaded && beanToGo === null && (waitingId === null || opened !== null)
  );

  $effect(() => {
    if (!waiting.loaded) return;
    if (waitingId !== null) {
      // Sent or deleted meanwhile: back to where it was opened from.
      if (!waitingEntry)
        goto(data.origin.from === 'journal' ? resolve('/journal') : resolve('/'), {
          replaceState: true
        });
      else if (!opened) opened = $state.snapshot(waitingEntry);
      return;
    }
    if (beanToGo) {
      const from = data.origin.from === 'journal' ? '&from=journal' : '';
      goto(resolve(`/shot/new?bean=${encodeURIComponent(beanToGo)}${from}`), {
        replaceState: true
      });
    }
  });
</script>

<svelte:head><title>New shot · Coffee Nerd</title></svelte:head>

{#if show}
  <!-- A new key per bean or Brew next change starts the form from its own prefill. -->
  {#key `${start.bean.id}:${start.prefill.source}:${opened?.shotId ?? ''}`}
    <ShotForm data={start} problems={form?.problems} origin={data.origin} waiting={opened} />
  {/key}
{/if}
