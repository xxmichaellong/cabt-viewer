<script lang="ts">
  import type { PromptView, RankerRow } from '../../analysis/promptIndex';

  type Props = {
    prompt: PromptView;
    /** optionIndex whose path to show; null = the played option. */
    selectedCandidate: number | null;
  };

  let { prompt, selectedCandidate }: Props = $props();

  const TIER_COUNT = 18; // _MAIN_TIERS in run/rulebased/option_ranker.py

  let row = $derived.by((): RankerRow | null => {
    const rows = prompt.ranker;
    if (!rows) {
      return null;
    }
    if (selectedCandidate !== null) {
      return rows.find((candidate) => candidate.optionIndex === selectedCandidate) ?? null;
    }
    return rows.find((candidate) => candidate.chosen) ?? rows[0] ?? null;
  });

  // Tier position for "k of 18": rank among the ordered tier list is not carried on the
  // frame, so derive it from the tier component of the score (tier() = rank*1000 + within).
  let tierRank = $derived(
    row?.score !== null && row?.score !== undefined && row.tier
      ? TIER_COUNT + 1 - Math.round((row.score - (row.within ?? 0)) / 1000)
      : null,
  );

  let crumbs = $derived.by((): string[] => {
    if (!row) {
      return [];
    }
    const parts = [prompt.context];
    if (row.rule) {
      parts.push(row.rule);
    }
    if (row.tier) {
      parts.push(tierRank !== null && tierRank >= 1 && tierRank <= TIER_COUNT
        ? `tier ${row.tier} (${tierRank} of ${TIER_COUNT})`
        : `tier ${row.tier}`);
    }
    if (row.within !== null && row.within !== 0) {
      parts.push(`within ${row.within > 0 ? '+' : ''}${row.within}`);
    }
    return parts;
  });
</script>

<section class="logic" aria-label="Logic path">
  <header>
    <strong>Logic path</strong>
    {#if row}
      <span title={row.label}>{row.label}</span>
    {/if}
  </header>
  {#if !row}
    <p class="empty">No trace on this prompt (opponent move or an old capture).</p>
  {:else}
    <div class="crumbs">
      {#each crumbs as crumb, index}
        {#if index > 0}<span class="arrow">→</span>{/if}
        <span class="crumb">{crumb}</span>
      {/each}
    </div>
    {#if row.oracle}
      <div class="oracle-chip" class:ko={row.oracle.ko}>
        engine truth: {row.oracle.damage} damage{row.oracle.ko ? ' · KNOCKOUT' : ''}
      </div>
    {/if}
    {#if row.factors.length}
      <table>
        <tbody>
          {#each row.factors as factor}
            <tr>
              <td class="fname">{factor.name}</td>
              <td class="fvalue" class:neg={factor.value < 0}>
                {factor.value > 0 && factor.name.includes('bonus') ? '+' : ''}{Math.round(factor.value * 1000) / 1000}
              </td>
              <td class="fnote">{factor.note ?? ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if row.score !== null}
      <div class="total">score <b>{row.score.toLocaleString('en-US')}</b></div>
    {/if}
    {#if row.reason}
      <p class="reason">{row.reason}</p>
    {/if}
  {/if}
</section>

<style>
  .logic {
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

  .empty {
    margin: 0;
    color: var(--text-secondary);
    font-size: 11px;
  }

  .crumbs {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px;
  }

  .crumb {
    padding: 1px 7px;
    border: 1px solid var(--surface-inset-border);
    border-radius: 9px;
    background: var(--surface-inset-bg);
    font-size: 10px;
    font-weight: 700;
  }

  .arrow {
    color: var(--text-secondary);
    font-size: 10px;
  }

  .oracle-chip {
    justify-self: start;
    padding: 2px 8px;
    border: 1px solid var(--accent-base);
    border-radius: 9px;
    color: var(--accent-base);
    font-size: 10px;
    font-weight: 800;
  }

  .oracle-chip.ko {
    border-color: #c04352;
    color: #d4707c;
  }

  table {
    border-collapse: collapse;
    font-size: 11px;
  }

  td {
    padding: 2px 8px 2px 0;
    vertical-align: baseline;
  }

  .fname {
    color: var(--text-primary);
    font-weight: 650;
    white-space: nowrap;
  }

  .fvalue {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .fvalue.neg {
    color: #d4707c;
  }

  .fnote {
    color: var(--text-secondary);
    font-size: 10px;
    line-height: 1.3;
  }

  .total {
    color: var(--text-secondary);
    font-size: 11px;
  }

  .total b {
    color: var(--text-primary);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .reason {
    margin: 0;
    padding-top: 4px;
    border-top: 1px dashed var(--surface-inset-border);
    color: var(--text-secondary);
    font-size: 11px;
    line-height: 1.4;
  }
</style>
