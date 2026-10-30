<script lang="ts">
  import { onMount } from 'svelte';
  import AuthScreen from '#lib/components/AuthScreen.svelte';
  import PasswordField from '#lib/components/PasswordField.svelte';
  import TextField from '#lib/components/TextField.svelte';
  import type { PageProps } from './$types';

  let { form }: PageProps = $props();
  // The time zone decides what "Today" means (docs/SPEC.md §1.8); without JavaScript the server uses UTC.
  let timeZone = $state('UTC');
  onMount(() => (timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone));
</script>

<svelte:head><title>Create your account · Coffee Nerd</title></svelte:head>

<AuthScreen
  title="Create your account"
  intro="One account keeps your journal private."
  action="Create account"
  note="Everything stays on this server. Nothing is sent anywhere else."
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
    hint="At least 8 characters"
    id="password"
    name="password"
    autocomplete="new-password"
    minlength={8}
    required
  />
  <PasswordField
    label="Password again"
    id="repeat"
    name="repeat"
    autocomplete="new-password"
    required
  />
  <input type="hidden" name="timeZone" value={timeZone} />
</AuthScreen>
