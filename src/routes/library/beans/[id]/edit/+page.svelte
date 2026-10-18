<script lang="ts">
  // Edit bean (D-130).
  import { page } from '$app/state';
  import BeanForm from '#lib/components/BeanForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Edit bean · Coffee Nerd</title></svelte:head>

<BeanForm
  mode="edit"
  beanId={page.params.id}
  text={data.text}
  today={data.today}
  problems={form?.problems}
/>
