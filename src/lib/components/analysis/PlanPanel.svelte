<script lang="ts">
  // Prize-map plan panel — extracted/adapted from RankerPanel.svelte's plan section
  // (analysis-mode twin; renders the raw Python dict from `_plan`).
  import type { PlanInfo } from '../../analysis/promptIndex';

  type Props = {
    plan: PlanInfo;
    onHoverKoName?: (name: string | null) => void;
  };

  let { plan, onHoverKoName }: Props = $props();
</script>

<section class="plan" aria-label="Prize-map plan">
  <div class="plan-head">
    <strong>Prize-map plan</strong>
    {#if plan.advisory}
      <span class="advisory" title="Computed for display only — the ranker played WITHOUT plan nudges">advisory</span>
    {/if}
    {#if plan.turns != null}
      <span class="turns">{plan.turns} turn{plan.turns === 1 ? '' : 's'} to goal</span>
    {/if}
  </div>
  {#if plan.render}
    <p class="render">{plan.render}</p>
  {/if}
  {#if plan.crucial?.length}
    <div class="plan-sub">Crucial pieces · marginal turns lost if missing</div>
    <ul class="plan-crit">
      {#each plan.crucial as piece}
        <li>
          <span class="critv">{piece.criticality}</span>
          <span class="piece">{piece.piece}</span>
          <span class="tag" class:sec={piece.secured} class:miss={!piece.secured}>
            {piece.secured ? 'secured' : 'MISSING → grab'}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
  {#if plan.ko_set?.length}
    <div class="plan-sub">Takes the prizes by KOing</div>
    <ul class="plan-ko" onmouseleave={() => onHoverKoName?.(null)}>
      {#each plan.ko_set as ko}
        <li onmouseenter={() => onHoverKoName?.(ko.name ?? null)}>
          turn {ko.turn} · {ko.name} <span class="pz">({ko.prize} prize)</span>
        </li>
      {/each}
    </ul>
  {/if}
  {#if plan.needed_pieces?.length}
    <div class="plan-sub">Grab off Ultra / Poffin: <strong>{plan.needed_pieces.join(', ')}</strong></div>
  {/if}
  {#if plan.attack_kos_active || plan.give_prizes}
    <div class="plan-flags">
      {#if plan.attack_kos_active}attack KOs the Active{/if}{#if plan.attack_kos_active && plan.give_prizes} · {/if}{#if plan.give_prizes}self-KO in the line{/if}
    </div>
  {/if}
</section>

<style>
  .plan {
    display: grid;
    gap: 5px;
    padding: 8px 10px;
    border: 1px solid var(--accent-base);
    border-radius: 7px;
    background: var(--accent-soft);
  }

  .plan-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .plan-head strong {
    flex: 1 1 auto;
    font-size: 13px;
  }

  .advisory {
    flex: none;
    padding: 0 7px;
    border: 1px dashed var(--surface-inset-border);
    border-radius: 9px;
    color: var(--text-secondary);
    font-size: 9px;
    font-weight: 700;
  }

  .turns {
    flex: none;
    color: var(--accent-base);
    font-size: 11px;
    font-weight: 800;
  }

  .render {
    margin: 0;
    color: var(--text-secondary);
    font-size: 10.5px;
    line-height: 1.35;
  }

  .plan-sub {
    margin-top: 3px;
    color: var(--text-secondary);
    font-size: 9.5px;
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
    font-size: 11.5px;
  }

  .plan-crit .critv {
    flex: none;
    min-width: 42px;
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
    font-size: 9.5px;
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
    font-size: 11px;
    cursor: default;
  }

  .plan-ko .pz {
    color: var(--text-secondary);
  }

  .plan-flags {
    margin-top: 3px;
    color: var(--text-secondary);
    font-size: 10px;
    font-style: italic;
  }
</style>
