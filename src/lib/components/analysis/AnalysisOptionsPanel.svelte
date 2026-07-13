<script lang="ts">
  import type { PromptView } from '../../analysis/promptIndex';

  type Props = {
    prompt: PromptView;
    selectedCandidate: number | null;
    onHover: (optionIndex: number | null) => void;
    onSelect: (optionIndex: number | null) => void;
  };

  let { prompt, selectedCandidate, onHover, onSelect }: Props = $props();

  // Rank order when the ranker slate exists; engine order otherwise (opponent/old frames).
  let rows = $derived(prompt.ranker
    ?? prompt.fallbackLabels.map((label, index) => ({
      rank: index + 1,
      label,
      reason: '',
      chosen: prompt.selectedIndices.includes(index),
      score: null,
      optionIndex: index,
      tier: null,
      within: null,
      rule: null,
      oracle: null,
      targetSerial: null,
      factors: [],
    })));

  // The ranker's own pick differs from what was submitted only under DRIVER=ref.
  let rankerDiffers = $derived(
    prompt.rankerSelected !== null
    && JSON.stringify(prompt.rankerSelected) !== JSON.stringify(prompt.selectedIndices),
  );

  function tierClass(tier: string | null): string {
    if (!tier) {
      return '';
    }
    if (tier === 'LETHAL') {
      return 'tier-lethal';
    }
    if (tier === 'SAVE' || tier === 'END') {
      return 'tier-low';
    }
    if (tier === 'ATTACK' || tier === 'VALUE_GUST' || tier === 'DISRUPT_ATTACK') {
      return 'tier-attack';
    }
    return 'tier-setup';
  }

  function formatScore(score: number | null): string {
    if (score === null) {
      return '';
    }
    return Math.abs(score) >= 1000 ? score.toLocaleString('en-US') : String(Math.round(score * 100) / 100);
  }
</script>

<section class="options" aria-label="Option slate">
  <header>
    <strong>Options</strong>
    <span>{rows.length} legal · {prompt.context}{#if !prompt.ranker} · engine order{/if}</span>
  </header>
  <ol onmouseleave={() => onHover(null)}>
    {#each rows as row (row.rank)}
      {@const isSelected = selectedCandidate !== null && row.optionIndex === selectedCandidate}
      <li
        class:chosen={row.chosen}
        class:selected={isSelected}
        onmouseenter={() => onHover(row.optionIndex)}
      >
        <button
          type="button"
          onclick={() => onSelect(isSelected ? null : row.optionIndex)}
          title="Show this option's logic path"
        >
          <span class="rank">{row.rank}</span>
          {#if row.tier}
            <span class="tier {tierClass(row.tier)}">{row.tier}</span>
          {/if}
          <span class="label" title={row.label}>{row.label}</span>
          {#if row.oracle}
            <span class="oracle" class:ko={row.oracle.ko}>{row.oracle.damage}{row.oracle.ko ? '·KO' : ''}</span>
          {/if}
          {#if row.score !== null}
            <span class="score">{formatScore(row.score)}</span>
          {/if}
          {#if row.chosen}
            <span class="played">PLAYED</span>
          {/if}
          {#if rankerDiffers && row.optionIndex !== null && prompt.rankerSelected?.includes(row.optionIndex)}
            <span class="ranker-pick" title="The ranker's own pick (a reference pilot drove this game)">RANKER</span>
          {/if}
        </button>
        {#if (row.chosen || isSelected) && row.reason}
          <p class="reason">{row.reason}</p>
        {/if}
      </li>
    {/each}
  </ol>
</section>

<style>
  .options {
    display: grid;
    gap: 6px;
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  header strong {
    font-size: 13px;
  }

  header span {
    min-width: 0;
    overflow: hidden;
    color: var(--text-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
  }

  ol {
    display: grid;
    gap: 3px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    border: 1px solid var(--surface-inset-border);
    border-radius: 6px;
    background: var(--surface-inset-bg);
  }

  li.chosen {
    border-color: var(--accent-base);
    background: var(--accent-soft);
  }

  li.selected {
    outline: 2px solid var(--accent-base);
    outline-offset: -1px;
  }

  li > button {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    margin: 0;
    padding: 4px 7px;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .rank {
    flex: none;
    min-width: 16px;
    color: var(--text-secondary);
    font-size: 10.5px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .tier {
    flex: none;
    padding: 0 5px;
    border-radius: 8px;
    border: 1px solid var(--surface-inset-border);
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.03em;
    color: var(--text-secondary);
  }

  .tier-lethal {
    border-color: #c04352;
    color: #d4707c;
  }

  .tier-attack {
    border-color: var(--accent-base);
    color: var(--accent-base);
  }

  .tier-low {
    opacity: 0.65;
  }

  .label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 650;
  }

  .oracle {
    flex: none;
    color: var(--text-secondary);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }

  .oracle.ko {
    color: #d4707c;
    font-weight: 800;
  }

  .score {
    flex: none;
    min-width: 48px;
    color: var(--text-secondary);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .played,
  .ranker-pick {
    flex: none;
    color: var(--accent-base);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  .ranker-pick {
    color: var(--text-secondary);
  }

  .reason {
    margin: 0;
    padding: 0 8px 5px 29px;
    color: var(--text-secondary);
    font-size: 10.5px;
    line-height: 1.35;
  }
</style>
