<script lang="ts">
  // A gear page by its kind (screens 12, 15, 16).
  import BasketForm from '#lib/components/BasketForm.svelte';
  import GrinderForm from '#lib/components/GrinderForm.svelte';
  import MachineForm from '#lib/components/MachineForm.svelte';
  import type { BasketSpec, GrinderSpec, MachineSpec } from '#lib/domain/schemas.ts';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  const item = $derived(data.item);
</script>

<svelte:head><title>{item.name} · Coffee Nerd</title></svelte:head>

{#key item.id}
  {#if item.kind === 'machine'}
    <MachineForm
      name={item.name}
      spec={item.spec as MachineSpec}
      isDefault={item.isDefault}
      usedFeatures={data.usedFeatures}
      problems={form?.problems}
    />
  {:else if item.kind === 'grinder'}
    <GrinderForm
      name={item.name}
      spec={item.spec as GrinderSpec}
      isDefault={item.isDefault}
      problems={form?.problems}
    />
  {:else}
    <BasketForm
      spec={item.spec as BasketSpec}
      isDefault={item.isDefault}
      machines={data.machines}
      problems={form?.problems}
    />
  {/if}
{/key}
