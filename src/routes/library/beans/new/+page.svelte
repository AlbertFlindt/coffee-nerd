<script lang="ts">
  // Add bean (screen 9).
  import BeanForm from '#lib/components/BeanForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Add bean · Coffee Nerd</title></svelte:head>

<!-- A re-buy picked in "Same as before" starts the form again from that bean. -->
{#key data.text}
  <BeanForm
    mode="add"
    text={data.text}
    today={data.today}
    rebuy={data.rebuyName ? { name: data.rebuyName } : null}
    choices={data.choices}
    guide={data.guide}
    problems={form?.problems}
  />
{/key}
