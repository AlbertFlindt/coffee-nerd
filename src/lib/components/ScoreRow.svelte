<script lang="ts">
  // Score 1–10 (D-09): tap to choose, slide to refine (D-10), tap the chosen score again to clear it
  // (D-98). Starts empty (D-11). The last score with this recipe is a dashed cherry outline that sets
  // nothing (D-12).
  let {
    value,
    previous,
    onchange
  }: { value: number | null; previous: number | null; onchange: (v: number | null) => void } =
    $props();

  const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  let row: HTMLDivElement | undefined = $state();
  let startedOn: number | null = null;
  let slid = false;

  function scoreAt(clientX: number): number {
    const box = row!.getBoundingClientRect();
    const share = Math.min(0.999, Math.max(0, (clientX - box.left) / box.width));
    return Math.floor(share * 10) + 1;
  }

  function onpointerdown(e: PointerEvent) {
    row!.setPointerCapture(e.pointerId);
    startedOn = scoreAt(e.clientX);
    slid = false;
  }

  function onpointermove(e: PointerEvent) {
    if (startedOn === null || !row!.hasPointerCapture(e.pointerId)) return;
    const score = scoreAt(e.clientX);
    if (score !== startedOn || slid) {
      slid = true;
      if (score !== value) onchange(score);
    }
  }

  function onpointerup(e: PointerEvent) {
    if (startedOn === null) return;
    const score = scoreAt(e.clientX);
    if (!slid) onchange(score === value ? null : score);
    startedOn = null;
  }

  function onkeydown(e: KeyboardEvent, n: number) {
    // Keyboard and screen readers: Enter or Space chooses, as a tap would.
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onchange(n === value ? null : n);
    }
  }
</script>

<div class="score">
  <div class="head">
    <h2>Score</h2>
    {#if previous !== null}
      <span class="previous"><span class="marker"></span>Last with this recipe: {previous}</span>
    {:else}
      <span class="none">No earlier score</span>
    {/if}
  </div>
  <div
    bind:this={row}
    class="cn-score"
    role="radiogroup"
    aria-label="Overall score 1 to 10"
    tabindex="-1"
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={() => (startedOn = null)}
  >
    {#each SCORES as n (n)}
      <button
        type="button"
        role="radio"
        aria-checked={value === n}
        aria-label={n === previous ? `${n}, last score with this recipe` : undefined}
        class:is-previous={n === previous}
        onkeydown={(e) => onkeydown(e, n)}>{n}</button
      >
    {/each}
  </div>
</div>

<style>
  .score {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .previous,
  .none {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  .previous {
    color: var(--cherry);
  }

  .none {
    color: var(--ink-muted);
  }

  .marker {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    border: 1.5px dashed var(--cherry);
  }

  .cn-score {
    touch-action: none;
  }
</style>
