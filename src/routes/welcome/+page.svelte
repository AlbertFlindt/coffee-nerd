<script lang="ts">
  import { onMount } from 'svelte';
  import AuthScreen from '#lib/components/AuthScreen.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import type { PageProps } from './$types';

  let { form }: PageProps = $props();
  // The time zone decides what "Today" means (data-model §1.8); without JavaScript the server uses UTC.
  let timeZone = $state('UTC');
  onMount(() => (timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone));
</script>

<svelte:head><title>Create your account · Coffee Nerd</title></svelte:head>

<AuthScreen
  title="Create your account"
  intro="One account protects your Coffee Nerd."
  action="Create account"
  error={form?.error}
>
  <TextField
    label="Name"
    id="name"
    name="name"
    autocomplete="username"
    required
    value={form?.name ?? ''}
  />
  <TextField
    label="Password · at least 8 characters"
    id="password"
    name="password"
    type="password"
    autocomplete="new-password"
    minlength={8}
    required
  />
  <TextField
    label="Password again"
    id="repeat"
    name="repeat"
    type="password"
    autocomplete="new-password"
    required
  />
  <input type="hidden" name="timeZone" value={timeZone} />
</AuthScreen>
