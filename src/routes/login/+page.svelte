<script lang="ts">
  import AuthScreen from '#lib/components/AuthScreen.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import type { PageProps } from './$types';

  let { form }: PageProps = $props();
</script>

<svelte:head><title>Sign in · Coffee Nerd</title></svelte:head>

<AuthScreen
  title="Sign in"
  intro="Welcome back to Coffee Nerd."
  action="Sign in"
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
    label="Password"
    id="password"
    name="password"
    type="password"
    autocomplete="current-password"
    required
  />
</AuthScreen>
