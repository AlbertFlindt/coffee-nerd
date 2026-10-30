<script lang="ts">
  // Layout for the sign-in and "Create your account" pages: the logo beside the name as in the Home
  // banner, larger, then the page title, the fields, and one full-width primary action at the bottom
  // with a quiet note under it.
  import type { Snippet } from 'svelte';
  import logo from '../../../design-system/logo/coffee-nerd-mark.svg';

  let {
    title,
    intro,
    action,
    note,
    error,
    children
  }: {
    title: string;
    intro: string;
    action: string;
    /** One caption under the primary action. */
    note: string;
    error?: string;
    children: Snippet;
  } = $props();
</script>

<form method="POST" class="screen">
  <div class="brand">
    <img src={logo} width="64" height="64" alt="" />
    <p class="name">Coffee Nerd</p>
    <p class="cn-type-body tagline">Data that backs up the home barista</p>
  </div>

  <div class="body">
    <hgroup>
      <h1 class="cn-type-title">{title}</h1>
      <p class="cn-type-body intro">{intro}</p>
    </hgroup>
    <div class="fields">
      {@render children()}
    </div>
  </div>

  <div class="bottom">
    {#if error}
      <p class="problem" role="alert">{error}</p>
    {/if}
    <button class="cn-btn-primary cn-tap-strong" type="submit">{action}</button>
    <p class="cn-type-caption note">{note}</p>
  </div>
</form>

<style>
  .screen {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0 var(--space-5) var(--space-5);
  }

  .brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: 56px 0 40px;
    text-align: center;
  }

  .brand p,
  hgroup p,
  h1 {
    margin: 0;
  }

  .name {
    font-size: 26px;
    line-height: 32px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .tagline,
  .intro {
    color: var(--ink-soft);
  }

  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  hgroup {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .bottom {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .problem {
    margin: 0;
    text-align: center;
    font-size: 13px;
    line-height: 1.4;
    color: var(--ink-soft);
  }

  .note {
    margin: 0;
    text-align: center;
    color: var(--ink-muted);
  }
</style>
