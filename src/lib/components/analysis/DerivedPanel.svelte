<script lang="ts">
  import type { DerivedInfo } from '../../analysis/promptIndex';

  type Props = {
    derived: DerivedInfo;
  };

  let { derived }: Props = $props();

  function roleLabel(role: string): string {
    return role.replaceAll('_', ' ').replace('+damage mover', '+ damage mover');
  }
</script>

<section class="derived" aria-label="Derived information">
  <div class="block">
    <div class="block-head">
      <strong>Our deck · {derived.deckRemaining.reduce((sum, entry) => sum + entry.count, 0)} cards</strong>
      <span class="badge" class:resolved={derived.deckResolved}>
        {derived.deckResolved ? 'exact (prizes deduced)' : 'upper bound'}
      </span>
    </div>
    <ul class="cards">
      {#each derived.deckRemaining as entry (entry.cid)}
        <li><b>{entry.count}</b> {entry.name}</li>
      {/each}
    </ul>
  </div>

  {#if derived.prizes?.length}
    <div class="block">
      <div class="block-head"><strong>Deduced prize cards</strong></div>
      <ul class="cards">
        {#each derived.prizes as entry (entry.cid)}
          <li><b>{entry.count}</b> {entry.name}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if derived.threats.length}
    <div class="block">
      <div class="block-head">
        <strong>Threat read</strong>
        {#if derived.matchup}<span class="badge">{derived.matchup}</span>{/if}
      </div>
      <table>
        <tbody>
          {#each derived.threats as threat (threat.serial ?? threat.cid)}
            <tr class:active={threat.active}>
              <td class="tname">{threat.name}{threat.active ? ' ·A' : ''}</td>
              <td class="thp">{threat.hp}{threat.maxHp ? `/${threat.maxHp}` : ''}</td>
              <td class="tenergy">{threat.energy}E</td>
              <td class="tprize">{threat.prize}pz</td>
              <td class="tthreat">×{threat.threat}</td>
              <td class="trole">{roleLabel(threat.role)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if derived.nextTurnReach !== null}
        <div class="reach">next-turn finish reach ≈ <b>{derived.nextTurnReach}</b></div>
      {/if}
    </div>
  {/if}

  {#if derived.fwd.length}
    <div class="block">
      <div class="block-head"><strong>Engine-truth attacks (on their Active)</strong></div>
      <ul class="cards">
        {#each derived.fwd as attack (attack.attackId)}
          <li><b>{attack.damage}</b> {attack.name}{attack.ko ? ' · KO' : ''}</li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .derived {
    display: grid;
    gap: 10px;
  }

  .block {
    display: grid;
    gap: 4px;
  }

  /* Keep intrinsic (nowrap) content from blowing the panel's grid tracks. */
  .derived > :global(*),
  .block > :global(*) {
    min-width: 0;
  }

  .block-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .block-head strong {
    font-size: 12px;
  }

  .badge {
    flex: none;
    padding: 0 7px;
    border: 1px solid var(--surface-inset-border);
    border-radius: 9px;
    color: var(--text-secondary);
    font-size: 9px;
    font-weight: 700;
  }

  .badge.resolved {
    border-color: var(--accent-base);
    color: var(--accent-base);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
    gap: 1px 10px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--text-secondary);
    font-size: 10.5px;
  }

  .cards b {
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  table {
    border-collapse: collapse;
    font-size: 10.5px;
  }

  td {
    padding: 1px 7px 1px 0;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  tr.active td {
    color: var(--text-primary);
  }

  .tname {
    font-weight: 650;
  }

  .tthreat {
    font-weight: 800;
  }

  .trole {
    font-size: 9.5px;
    font-style: italic;
    white-space: normal;
  }

  .reach {
    color: var(--text-secondary);
    font-size: 10px;
  }

  .reach b {
    color: var(--text-primary);
  }
</style>
