<script lang="ts">
  import type { RankerStepView } from '../game/replay';

  type Props = {
    ranker: RankerStepView;
    /** When provided, the played move becomes a button that jumps the board to its result. */
    onPlayResult?: () => void;
  };

  let { ranker, onPlayResult }: Props = $props();

  const MAX_ROWS = 16;
  let rows = $derived(ranker.candidates.slice(0, MAX_ROWS));
  let hiddenCount = $derived(Math.max(0, ranker.candidates.length - rows.length));
</script>

<section class="ranker" aria-label="Option ranking">
  <div class="ranker-head">
    <strong>Ranking</strong>
    <span>{ranker.optionCount} options{#if ranker.context} · {ranker.context}{/if}</span>
  </div>
  <ol class="ranker-list">
    {#each rows as row}
      <li class:chosen={row.chosen}>
        <div class="line">
          <span class="rank">{row.rank}</span>
          <span class="label" title={row.label}>{row.label}</span>
          {#if row.chosen}
            {#if onPlayResult}
              <button class="pick" type="button" onclick={onPlayResult} title="Jump to the state this move produced">
                ● played →
              </button>
            {:else}
              <span class="pick">● played</span>
            {/if}
          {/if}
        </div>
        {#if row.reason}
          <p class="reason">{row.reason}</p>
        {/if}
      </li>
    {/each}
  </ol>
  {#if hiddenCount}
    <div class="ranker-more">+{hiddenCount} more</div>
  {/if}
</section>

<style>
  .ranker {
    display: grid;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--surface-toolbar-border);
  }

  .ranker-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
    font-size: 13px;
  }

  .ranker-head strong {
    font-size: 15px;
  }

  .ranker-head span {
    min-width: 0;
    overflow: hidden;
    color: var(--text-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
  }

  .ranker-list {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: none;
  }

  .ranker-list li {
    display: grid;
    gap: 2px;
    padding: 4px 6px;
    border: 1px solid var(--surface-inset-border);
    border-radius: 6px;
    background: var(--surface-inset-bg);
  }

  .ranker-list li.chosen {
    border-color: var(--accent-base);
    background: var(--accent-soft);
  }

  .line {
    display: flex;
    align-items: baseline;
    gap: 7px;
  }

  .rank {
    flex: none;
    min-width: 18px;
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 700;
  }

  .reason {
    margin: 0;
    padding-left: 25px;
    color: var(--text-secondary);
    font-size: 11px;
    line-height: 1.35;
  }

  .pick {
    flex: none;
    color: var(--accent-base);
    font-size: 11px;
    font-weight: 800;
  }

  button.pick {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-weight: 800;
    line-height: inherit;
    cursor: pointer;
  }

  button.pick:hover {
    text-decoration: underline;
  }

  .ranker-more {
    color: var(--text-secondary);
    font-size: 10px;
  }
</style>
