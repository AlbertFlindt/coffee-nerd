<script lang="ts">
  // Add bean (screen 9, D-41).
  import { resolve } from '$app/paths';
  import BeanForm from '#lib/components/BeanForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Add bean · Coffee Nerd</title></svelte:head>

<!-- A re-buy picked in "Same as before" starts the form again from that bean (D-139). -->
{#key data.text}
  <BeanForm
    mode="add"
    text={data.text}
    today={data.today}
    closeHref={resolve('/library/beans')}
    rebuy={data.rebuyName
      ? { name: data.rebuyName, clearHref: resolve('/library/beans/new') }
      : null}
    choices={data.choices.map((c) => ({ ...c, href: `?rebuy=${c.id}` }))}
    problems={form?.problems}
  />
{/key}
