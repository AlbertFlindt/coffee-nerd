<script lang="ts">
  // Add gear (D-147): the kind's page, empty.
  import BasketForm from '#lib/components/BasketForm.svelte';
  import GrinderForm from '#lib/components/GrinderForm.svelte';
  import MachineForm from '#lib/components/MachineForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Add {data.kind} · Coffee Nerd</title></svelte:head>

{#if data.kind === 'machine'}
  <MachineForm problems={form?.problems} />
{:else if data.kind === 'grinder'}
  <GrinderForm problems={form?.problems} />
{:else}
  <BasketForm machines={data.machines} problems={form?.problems} />
{/if}
