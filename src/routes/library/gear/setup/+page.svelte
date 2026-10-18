<script lang="ts">
  // Edit My setup (screen 13, D-45).
  import MySetupForm from '#lib/components/MySetupForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>My setup · Coffee Nerd</title></svelte:head>

<MySetupForm setup={data.setup} problems={form?.problems} />
