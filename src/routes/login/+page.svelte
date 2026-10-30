<script lang="ts">
  import AuthScreen from '#lib/components/AuthScreen.svelte';
  import PasswordField from '#lib/components/PasswordField.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import type { PageProps } from './$types';

  let { form }: PageProps = $props();
</script>

<svelte:head><title>Sign in · Coffee Nerd</title></svelte:head>

<AuthScreen
  title="Sign in"
  intro="Welcome back. Your journal is where you left it."
  action="Sign in"
  note="Forgot your password? The README shows how to reset it."
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
  <PasswordField
    label="Password"
    id="password"
    name="password"
    autocomplete="current-password"
    required
  />
</AuthScreen>
