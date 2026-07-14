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

{#if ranker.plan}
  {@const plan = ranker.plan}
  <section class="plan" aria-label="Prize-map plan">
    <div class="plan-head">
      <strong>Prize-map plan</strong>
      {#if plan.advisory}
        <span class="plan-advisory" title="Display-only plan (PLANNER_VIEW capture) — it did not steer the played line">advisory</span>
      {/if}
      {#if plan.render}<span class="plan-render">{plan.render}</span>{/if}
    </div>
    {#if plan.crucial.length}
      <div class="plan-sub">Crucial pieces · marginal turns lost if missing</div>
      <ul class="plan-crit">
        {#each plan.crucial as c}
          <li>
            <span class="critv">{c.criticality}</span>
            <span class="piece">{c.piece}</span>
            <span class="tag" class:sec={c.secured} class:miss={!c.secured}>
              {c.secured ? 'secured' : 'MISSING → grab'}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
    {#if plan.koSet.length}
      <div class="plan-sub">Takes the prizes by KOing</div>
      <ul class="plan-ko">
        {#each plan.koSet as k}
          <li>turn {k.turn} · {k.name} <span class="pz">({k.prize} prize)</span></li>
        {/each}
      </ul>
    {/if}
    {#if plan.neededPieces.length}
      <div class="plan-sub">Grab off Ultra / Poffin: <strong>{plan.neededPieces.join(', ')}</strong></div>
    {/if}
    {#if plan.attackKosActive || plan.givePrizes}
      <div class="plan-flags">
        {#if plan.attackKosActive}attack KOs the Active{/if}{#if plan.attackKosActive && plan.givePrizes} · {/if}{#if plan.givePrizes}self-KO in the line{/if}
      </div>
    {/if}
  </section>
{/if}

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
  .plan {
    display: grid;
    gap: 5px;
    margin-bottom: 8px;
    padding: 8px 10px;
    border: 1px solid var(--accent-base);
    border-radius: 7px;
    background: var(--accent-soft);
  }

  .plan-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .plan-head strong {
    font-size: 14px;
  }

  .plan-render {
    min-width: 0;
    overflow: hidden;
    color: var(--text-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }

  .plan-advisory {
    flex: none;
    padding: 0 7px;
    border: 1px dashed var(--surface-inset-border);
    border-radius: 9px;
    color: var(--text-secondary);
    font-size: 9px;
    font-weight: 700;
  }

  .plan-sub {
    margin-top: 3px;
    color: var(--text-secondary);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .plan-crit,
  .plan-ko {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .plan-crit li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
  }

  .plan-crit .critv {
    flex: none;
    min-width: 44px;
    color: var(--accent-base);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .plan-crit .piece {
    flex: 1 1 auto;
    font-weight: 700;
  }

  .plan-crit .tag {
    flex: none;
    padding: 1px 7px;
    border-radius: 10px;
    font-size: 10px;
    white-space: nowrap;
  }

  .plan-crit .tag.sec {
    border: 1px solid var(--accent-base);
    color: var(--accent-base);
  }

  .plan-crit .tag.miss {
    border: 1px solid var(--surface-inset-border);
    background: var(--surface-inset-bg);
    color: var(--text-primary);
  }

  .plan-ko li {
    font-size: 11.5px;
  }

  .plan-ko .pz {
    color: var(--text-secondary);
  }

  .plan-flags {
    margin-top: 3px;
    color: var(--text-secondary);
    font-size: 10.5px;
    font-style: italic;
  }

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
