<script lang="ts">
  import { resolve } from '$app/paths';
  import logo from '../../design-system/logo/coffee-nerd-mark.svg';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<!-- Placeholder until Home is built in milestone M8 (docs/screens/Home.png). -->
<main>
  {#if data.flash}
    <!-- D-95: what happened to the shot just saved. The message itself is not designed yet. -->
    <div class="cn-card message" role="status">
      {#if data.flash.kind === 'saved'}
        <span>Shot saved.</span>
      {:else if data.flash.kind === 'finished'}
        <span>Shot saved. {data.flash.beanName} is finished: its bag is used up.</span>
        <form method="POST" action="?/undoFinish">
          <input type="hidden" name="beanId" value={data.flash.beanId} />
          <button type="submit" class="undo tap">Undo</button>
        </form>
      {:else}
        <span>{data.flash.beanName} is open again.</span>
      {/if}
    </div>
  {/if}
  <img src={logo} width="64" height="64" alt="" />
  <h1 class="cn-type-display">Coffee Nerd</h1>
  <!-- Until the tab bar and its "+" exist (M8), a new shot starts here (D-31). -->
  <a class="cn-btn-add tap-strong" href={resolve('/shot/new')}>
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
    >
    New shot
  </a>
  <!-- Until the tab bar exists, the Journal opens from here (docs/open-items.md). -->
  <a class="cn-btn-secondary tap journal" href={resolve('/journal')}>Journal</a>
  <!-- Until Settings exists (M11), signing out lives here; not designed (docs/open-items.md). -->
  <form method="POST" action="/logout">
    <button class="cn-btn-secondary tap" type="submit">Sign out</button>
  </form>
</main>

<style>
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: 0 var(--space-5);
  }

  h1 {
    margin: 0;
  }

  a {
    text-decoration: none;
  }

  .message {
    position: absolute;
    top: var(--space-5);
    left: var(--space-5);
    right: var(--space-5);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: 15px;
  }

  .message span {
    flex: 1;
  }

  .undo {
    height: var(--touch-min);
    padding: 0 var(--space-4);
    border: none;
    border-radius: var(--radius-pill);
    background: var(--control);
    color: var(--ink);
    font-size: 15px;
    font-weight: 700;
  }

  .journal {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
  }

  main > form {
    width: 100%;
    margin-top: var(--space-6);
  }
</style>
