<script lang="ts">
  // Edit bean (D-130).
  import { resolve } from '$app/paths';
  import BeanForm from '#lib/components/BeanForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Edit bean · Coffee Nerd</title></svelte:head>

<BeanForm
  mode="edit"
  text={data.text}
  today={data.today}
  closeHref={resolve('/library/beans')}
  problems={form?.problems}
/>
