<script lang="ts">
  // Layout for the sign-in and first-run pages: logo and title on top, fields, one full-width primary
  // action at the bottom (D-14). Not designed yet: built from design-system parts only (D-84).
  import type { Snippet } from 'svelte';
  import logo from '../../../design-system/logo/coffee-nerd-mark.svg';

  let {
    title,
    intro,
    action,
    error,
    children
  }: { title: string; intro: string; action: string; error?: string; children: Snippet } = $props();
</script>

<form method="POST" class="screen">
  <header>
    <img src={logo} width="56" height="56" alt="" />
    <h1 class="cn-type-title">{title}</h1>
    <p class="cn-caption">{intro}</p>
  </header>

  <div class="fields">
    {@render children()}
    {#if error}
      <p class="error cn-type-body" role="alert">{error}</p>
    {/if}
  </div>

  <button class="cn-btn-primary" type="submit">{action}</button>
</form>

<style>
  .screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-5);
  }

  header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-5);
    text-align: center;
  }

  h1,
  p {
    margin: 0;
  }

  .fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .error {
    color: var(--ink);
  }
</style>
